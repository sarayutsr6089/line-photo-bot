// คุยกับ LINE Messaging API และตรวจลายเซ็นของ webhook

import { LINE_PUSH_ENDPOINT } from './config.js';
import { toBase64 } from './util.js';

/**
 * ตรวจว่า request นี้มาจาก LINE จริง
 * LINE เซ็น body ด้วย HMAC-SHA256 โดยใช้ Channel secret แล้วส่งมาใน header X-Line-Signature
 */
export async function verifyLineSignature(channelSecret, rawBody, signature) {
  if (!channelSecret || !signature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = toBase64(mac);

  // เทียบแบบ byte ต่อ byte ความยาวคงที่ (ทั้งคู่เป็น base64 ของ 32 bytes เสมอ)
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** สร้างชุด message ที่จะส่ง: ข้อความบรรยาย 1 อัน + รูป 1 อัน */
export function buildMessages({ caption, originalUrl, previewUrl }) {
  const messages = [];
  if (caption) messages.push({ type: 'text', text: caption });
  messages.push({
    type: 'image',
    originalContentUrl: originalUrl,
    previewImageUrl: previewUrl,
  });
  return messages;
}

/**
 * ส่งเข้าปลายทางเดียว
 * ใช้ push เพราะ multicast ส่งเข้ากลุ่มไม่ได้ ส่งได้เฉพาะ user
 */
export async function pushToTarget(accessToken, to, messages) {
  const response = await fetch(LINE_PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (response.ok) return { ok: true, status: response.status };

  // LINE ตอบ error มาเป็น JSON ที่อ่านรู้เรื่อง เก็บไว้ให้ debug ได้
  const detail = await response.text().catch(() => '');
  return { ok: false, status: response.status, detail: detail.slice(0, 500) };
}

/** ส่งเข้าทุกปลายทางพร้อมกัน แล้วสรุปผลรายตัว */
export async function pushToAll(accessToken, targets, messages) {
  const results = await Promise.all(
    targets.map(async (to) => ({ to, ...(await pushToTarget(accessToken, to, messages)) })),
  );
  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

/** ดึง userId / groupId / roomId ออกจาก event ที่ LINE ส่งมา */
export function extractSources(events) {
  const sources = [];
  for (const event of events ?? []) {
    const source = event?.source;
    if (!source) continue;
    const id = source.groupId ?? source.roomId ?? source.userId;
    if (!id) continue;
    sources.push({
      id,
      type: source.groupId ? 'group' : source.roomId ? 'room' : 'user',
      // เก็บ userId ของคนที่พิมพ์ในกลุ่มไว้ด้วย เผื่ออยากส่งหาคนนั้นแยก
      memberUserId: source.groupId || source.roomId ? source.userId ?? null : null,
      seenAt: new Date().toISOString(),
    });
  }
  return sources;
}
