// ตรวจสอบและเก็บรูปชั่วคราวใน Cloudflare KV เพื่อให้ LINE มาดึงไปแสดง

import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_TTL_SECONDS,
  MAX_ORIGINAL_BYTES,
  MAX_PREVIEW_BYTES,
} from './config.js';

/**
 * ดูชนิดไฟล์จริงจาก magic bytes ไม่เชื่อ content-type ที่ client ส่งมา
 * เพราะ Shortcuts มักส่ง application/octet-stream หรือแปะ HEIC มาเป็น jpeg
 * คืน 'image/jpeg' | 'image/png' | null
 */
export function sniffImageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

/** ไฟล์ HEIC/HEIF ของ iPhone หน้าตาเป็น ....ftypheic / ftypmif1 ที่ byte 4-11 */
export function looksLikeHeic(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 12) return false;
  const brand = String.fromCharCode(b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11]);
  return brand.startsWith('ftyp') && /heic|heix|hevc|heim|heis|mif1|msf1/.test(brand.slice(4));
}

/**
 * ตรวจรูปหนึ่งใบว่าส่งเข้า LINE ได้ไหม
 * คืน { ok: true, contentType } หรือ { ok: false, status, error, hint }
 */
export function validateImage(bytes, { maxBytes, label }) {
  const size = bytes.byteLength ?? bytes.length ?? 0;

  if (size === 0) {
    return { ok: false, status: 400, error: `${label}: ไม่พบข้อมูลรูป (ไฟล์ว่าง)` };
  }

  if (size > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `${label}: รูปใหญ่เกินไป (${(size / 1024 / 1024).toFixed(2)} MB เกินขีดจำกัด ${(maxBytes / 1024 / 1024).toFixed(2)} MB ของ LINE)`,
      hint: 'ใน Shortcut ให้เพิ่ม action "Resize Image" เป็นความกว้าง 1280 ก่อนส่ง',
    };
  }

  if (looksLikeHeic(bytes)) {
    return {
      ok: false,
      status: 415,
      error: `${label}: เป็นไฟล์ HEIC ซึ่ง LINE แสดงไม่ได้`,
      hint: 'ใน Shortcut ให้เพิ่ม action "Convert Image" เป็น JPEG ก่อนส่ง',
    };
  }

  const contentType = sniffImageType(bytes);
  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    return {
      ok: false,
      status: 415,
      error: `${label}: ไม่ใช่ไฟล์ JPEG หรือ PNG`,
      hint: 'ใน Shortcut ให้เพิ่ม action "Convert Image" เป็น JPEG ก่อนส่ง',
    };
  }

  return { ok: true, contentType, size };
}

export const IMAGE_LIMITS = {
  original: MAX_ORIGINAL_BYTES,
  preview: MAX_PREVIEW_BYTES,
};

/** เก็บรูปลง KV แล้วคืน key ที่ใช้เปิดผ่าน URL */
export async function storeImage(kv, bytes, contentType) {
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const id = `${crypto.randomUUID()}.${ext}`;
  await kv.put(`img:${id}`, bytes, {
    expirationTtl: IMAGE_TTL_SECONDS,
    metadata: { contentType },
  });
  return id;
}

/** อ่านรูปจาก KV คืน null ถ้าไม่มีหรือหมดอายุแล้ว */
export async function loadImage(kv, id) {
  const { value, metadata } = await kv.getWithMetadata(`img:${id}`, { type: 'arrayBuffer' });
  if (!value) return null;
  return { body: value, contentType: metadata?.contentType ?? 'image/jpeg' };
}

/** ประกอบ URL สาธารณะที่ LINE จะเข้ามาดึงรูป */
export function buildImageUrl(requestUrl, publicBaseUrl, id) {
  const base = publicBaseUrl?.trim() ? publicBaseUrl.trim().replace(/\/+$/, '') : new URL(requestUrl).origin;
  return `${base}/i/${id}`;
}
