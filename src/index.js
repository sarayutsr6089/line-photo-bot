// Cloudflare Worker: รับรูปจาก iOS Shortcut แล้วส่งเข้า LINE ให้ทุกปลายทางที่ตั้งไว้
//
// เส้นทางที่เปิดให้เรียก
//   GET  /            เช็คว่า worker ยังมีชีวิตและตั้งค่าครบไหม
//   POST /ingest      Shortcut ยิงรูปเข้ามาที่นี่ (ต้องมี header X-Bot-Secret)
//   GET  /i/:id       LINE มาดึงรูปที่เก็บไว้ชั่วคราว (เปิดสาธารณะ)
//   POST /webhook     LINE ส่ง event มาที่นี่ ใช้เก็บ user id / group id อัตโนมัติ
//   GET  /ids         ดูรายชื่อ id ที่เก็บได้ (ต้องมี secret)
//   GET  /status      ดูผลการส่งย้อนหลัง (ต้องมี secret)

import { KV_LOG_KEY, KV_SOURCES_KEY, MAX_LOG_ENTRIES } from './config.js';
import {
  IMAGE_LIMITS,
  buildImageUrl,
  loadImage,
  storeImage,
  validateImage,
} from './images.js';
import { buildMessages, extractSources, pushToAll, verifyLineSignature } from './line.js';
import { json, maskId, parseTargetIds, timingSafeEqual } from './util.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (request.method === 'GET' && path === '/') return handleHealth(env);
      if (request.method === 'POST' && path === '/ingest') return handleIngest(request, env);
      if (request.method === 'GET' && path.startsWith('/i/')) {
        return handleServeImage(env, decodeURIComponent(path.slice('/i/'.length)));
      }
      if (request.method === 'POST' && path === '/webhook') return handleWebhook(request, env);
      if (request.method === 'GET' && path === '/ids') return handleIds(request, env);
      if (request.method === 'GET' && path === '/status') return handleStatus(request, env);

      return json({ ok: false, error: 'ไม่พบเส้นทางนี้' }, 404);
    } catch (err) {
      // อย่าปล่อยรายละเอียด internal ออกไป แต่ยังบอกให้รู้ว่าพังตรงไหนกว้าง ๆ
      console.error('unhandled error', err);
      return json({ ok: false, error: 'เกิดข้อผิดพลาดภายในระบบ ดู log ใน Cloudflare dashboard' }, 500);
    }
  },
};

/** ตรวจ secret จาก header X-Bot-Secret หรือ query ?key= (สำหรับเปิดดูในเบราว์เซอร์) */
function isAuthorized(request, env) {
  const expected = env.INGEST_SECRET;
  if (!expected) return false;
  const provided = request.headers.get('x-bot-secret') ?? new URL(request.url).searchParams.get('key') ?? '';
  return timingSafeEqual(provided, expected);
}

function handleHealth(env) {
  const targets = parseTargetIds(env.LINE_TARGET_IDS);
  return json({
    ok: true,
    service: 'line-photo-bot',
    config: {
      hasAccessToken: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN),
      hasChannelSecret: Boolean(env.LINE_CHANNEL_SECRET),
      hasIngestSecret: Boolean(env.INGEST_SECRET),
      targetCount: targets.length,
    },
  });
}

/** ดึงไฟล์กับข้อความบรรยายออกจาก request ไม่ว่าจะส่งมาแบบ form หรือแบบไฟล์ดิบ */
async function readIngestPayload(request) {
  const contentType = request.headers.get('content-type') ?? '';
  const params = new URL(request.url).searchParams;

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    const photo = form.get('photo') ?? form.get('file') ?? form.get('image');
    const preview = form.get('preview');
    return {
      photo: photo && typeof photo !== 'string' ? new Uint8Array(await photo.arrayBuffer()) : null,
      preview: preview && typeof preview !== 'string' ? new Uint8Array(await preview.arrayBuffer()) : null,
      caption: form.get('caption') ?? params.get('caption'),
      years: form.get('years') ?? params.get('years'),
    };
  }

  // ส่งไฟล์ดิบมาทั้ง body
  const bytes = new Uint8Array(await request.arrayBuffer());
  return {
    photo: bytes.byteLength > 0 ? bytes : null,
    preview: null,
    caption: params.get('caption'),
    years: params.get('years'),
  };
}

/**
 * LINE นับโควตาเป็น "รายข้อความ x ปลายทาง" ข้อความบรรยายจึงทำให้ใช้โควตาเป็นสองเท่า
 * แผนฟรีของไทยให้ 200 ข้อความ/เดือน จึงปิดข้อความบรรยายไว้ก่อน ส่งเฉพาะรูป
 */
export function captionEnabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

/** ข้อความบรรยายที่แนบไปกับรูป ถ้า Shortcut ไม่ได้ส่งมาก็ใช้ค่าตั้งต้น */
export function resolveCaption(caption, years) {
  const trimmed = typeof caption === 'string' ? caption.trim() : '';
  if (trimmed) return trimmed.slice(0, 500);

  const n = Number.parseInt(years, 10);
  if (Number.isInteger(n) && n > 0) return `📸 ความทรงจำวันนี้ เมื่อ ${n} ปีที่แล้ว`;
  return '📸 ความทรงจำวันนี้';
}

async function handleIngest(request, env) {
  if (!isAuthorized(request, env)) {
    return json({ ok: false, error: 'secret ไม่ถูกต้อง' }, 401);
  }
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    return json({ ok: false, error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN' }, 500);
  }

  const targets = parseTargetIds(env.LINE_TARGET_IDS);
  if (targets.length === 0) {
    return json({ ok: false, error: 'ยังไม่ได้ตั้งค่า LINE_TARGET_IDS ว่าจะส่งเข้าใคร' }, 500);
  }

  const payload = await readIngestPayload(request);
  if (!payload.photo) {
    return json({ ok: false, error: 'ไม่พบรูปใน request', hint: 'ส่งเป็น form field ชื่อ photo' }, 400);
  }

  const photoCheck = validateImage(payload.photo, { maxBytes: IMAGE_LIMITS.original, label: 'รูปหลัก' });
  if (!photoCheck.ok) return json({ ok: false, ...photoCheck }, photoCheck.status);

  // ถ้าไม่ได้ส่ง preview มาและรูปหลักเล็กพอ ก็ใช้รูปเดียวกันเป็น preview ได้เลย
  const previewBytes = payload.preview;
  let previewCheck = null;
  if (previewBytes) {
    previewCheck = validateImage(previewBytes, { maxBytes: IMAGE_LIMITS.preview, label: 'รูป preview' });
    if (!previewCheck.ok) return json({ ok: false, ...previewCheck }, previewCheck.status);
  } else if (photoCheck.size > IMAGE_LIMITS.preview) {
    return json(
      {
        ok: false,
        error: `รูปใหญ่เกิน ${IMAGE_LIMITS.preview / 1024 / 1024} MB จึงใช้เป็น preview ของ LINE ไม่ได้`,
        hint: 'ใน Shortcut ให้เพิ่ม action "Resize Image" เป็นความกว้าง 1280 ก่อนส่ง',
      },
      413,
    );
  }

  const photoId = await storeImage(env.PHOTOS, payload.photo, photoCheck.contentType);
  const originalUrl = buildImageUrl(request.url, env.PUBLIC_BASE_URL, photoId);
  let previewUrl = originalUrl;

  if (previewBytes) {
    const previewId = await storeImage(env.PHOTOS, previewBytes, previewCheck.contentType);
    previewUrl = buildImageUrl(request.url, env.PUBLIC_BASE_URL, previewId);
  }

  const caption = captionEnabled(env.SEND_CAPTION) ? resolveCaption(payload.caption, payload.years) : '';
  const messages = buildMessages({ caption, originalUrl, previewUrl });
  const outcome = await pushToAll(env.LINE_CHANNEL_ACCESS_TOKEN, targets, messages);

  await appendLog(env.PHOTOS, {
    at: new Date().toISOString(),
    caption,
    // โควตา LINE นับต่อ message ต่อปลายทาง เก็บไว้ให้เห็นใน /status
    lineMessagesUsed: messages.length * outcome.sent,
    sizeKb: Math.round(photoCheck.size / 1024),
    sent: outcome.sent,
    failed: outcome.failed,
    errors: outcome.results.filter((r) => !r.ok).map((r) => ({ to: maskId(r.to), status: r.status, detail: r.detail })),
  });

  // ส่งไม่สำเร็จสักปลายทางเดียวถือว่าพัง จะได้เห็นใน Shortcut ทันที
  const status = outcome.sent === 0 ? 502 : 200;
  return json(
    {
      ok: outcome.sent > 0,
      caption,
      sent: outcome.sent,
      failed: outcome.failed,
      results: outcome.results.map((r) => ({ to: maskId(r.to), ok: r.ok, status: r.status, detail: r.detail })),
    },
    status,
  );
}

async function handleServeImage(env, id) {
  // กัน path แปลก ๆ ที่พยายามอ่าน key อื่นใน KV
  if (!/^[a-f0-9-]{36}\.(jpg|png)$/i.test(id)) {
    return json({ ok: false, error: 'รหัสรูปไม่ถูกต้อง' }, 400);
  }

  const image = await loadImage(env.PHOTOS, id);
  if (!image) return json({ ok: false, error: 'ไม่พบรูปนี้แล้ว (เก็บไว้ 3 วัน)' }, 404);

  return new Response(image.body, {
    headers: {
      'content-type': image.contentType,
      'cache-control': 'public, max-age=86400',
      // รูปครอบครัว ไม่ควรให้ search engine เก็บ index
      'x-robots-tag': 'noindex, noimageindex',
    },
  });
}

async function handleWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-line-signature');

  const valid = await verifyLineSignature(env.LINE_CHANNEL_SECRET, rawBody, signature);
  if (!valid) return json({ ok: false, error: 'ลายเซ็นไม่ถูกต้อง' }, 401);

  let events = [];
  try {
    events = JSON.parse(rawBody).events ?? [];
  } catch {
    events = [];
  }

  const sources = extractSources(events);
  if (sources.length > 0) await recordSources(env.PHOTOS, sources);

  // ต้องตอบ 200 เสมอ ไม่งั้น LINE จะมองว่า webhook ใช้ไม่ได้
  return json({ ok: true, recorded: sources.length });
}

async function handleIds(request, env) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'secret ไม่ถูกต้อง' }, 401);
  const stored = (await env.PHOTOS.get(KV_SOURCES_KEY, { type: 'json' })) ?? [];
  return json({
    ok: true,
    hint: 'คัดลอก id ที่ต้องการไปใส่ใน LINE_TARGET_IDS ใน wrangler.toml แล้ว deploy ใหม่',
    sources: stored,
  });
}

async function handleStatus(request, env) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'secret ไม่ถูกต้อง' }, 401);
  const log = (await env.PHOTOS.get(KV_LOG_KEY, { type: 'json' })) ?? [];
  return json({ ok: true, recent: log });
}

/** เก็บ id ที่เจอใหม่ ไม่เก็บซ้ำ */
async function recordSources(kv, sources) {
  const existing = (await kv.get(KV_SOURCES_KEY, { type: 'json' })) ?? [];
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const source of sources) {
    if (!byId.has(source.id)) byId.set(source.id, source);
  }
  await kv.put(KV_SOURCES_KEY, JSON.stringify([...byId.values()]));
}

/** เก็บ log การส่งล่าสุดไว้ไม่กี่รายการ พอให้ย้อนดูได้เวลามีปัญหา */
async function appendLog(kv, entry) {
  const log = (await kv.get(KV_LOG_KEY, { type: 'json' })) ?? [];
  log.unshift(entry);
  await kv.put(KV_LOG_KEY, JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)));
}
