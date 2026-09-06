// ค่าคงที่ของระบบ รวมไว้ที่เดียวเพื่อให้แก้ง่าย

// ขีดจำกัดของ LINE Messaging API สำหรับ image message
export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024; // รูปหลัก ไม่เกิน 10 MB
export const MAX_PREVIEW_BYTES = 1 * 1024 * 1024; // รูป preview ไม่เกิน 1 MB

// เก็บรูปไว้ 3 วันแล้วลบอัตโนมัติ นานพอให้ LINE ดึงไปแสดงและให้เราย้อนดูเวลา debug
export const IMAGE_TTL_SECONDS = 3 * 24 * 60 * 60;

// LINE รองรับเฉพาะ JPEG กับ PNG เท่านั้น (HEIC ของ iPhone ใช้ไม่ได้)
export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

// จำนวน log การส่งย้อนหลังที่เก็บไว้ดูใน /status
export const MAX_LOG_ENTRIES = 20;

export const KV_LOG_KEY = 'meta:log';
export const KV_SOURCES_KEY = 'meta:sources';

export const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';
