import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImageUrl, looksLikeHeic, sniffImageType, validateImage } from '../src/images.js';

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** สร้างไฟล์ปลอมขนาดตามต้องการ โดยขึ้นต้นด้วย header ที่กำหนด */
function fakeFile(header, totalBytes = 1024) {
  const bytes = new Uint8Array(totalBytes);
  bytes.set(header, 0);
  return bytes;
}

function fakeHeic() {
  const bytes = new Uint8Array(64);
  const brand = 'ftypheic';
  for (let i = 0; i < brand.length; i++) bytes[4 + i] = brand.charCodeAt(i);
  return bytes;
}

test('sniffImageType รู้จัก JPEG กับ PNG', () => {
  assert.equal(sniffImageType(fakeFile(JPEG_HEADER)), 'image/jpeg');
  assert.equal(sniffImageType(fakeFile(PNG_HEADER)), 'image/png');
  assert.equal(sniffImageType(new Uint8Array([1, 2, 3])), null);
});

test('looksLikeHeic จับไฟล์ HEIC ของ iPhone ได้', () => {
  assert.equal(looksLikeHeic(fakeHeic()), true);
  assert.equal(looksLikeHeic(fakeFile(JPEG_HEADER)), false);
});

test('validateImage ผ่านเมื่อเป็น JPEG ขนาดพอดี', () => {
  const result = validateImage(fakeFile(JPEG_HEADER, 5000), { maxBytes: 10000, label: 'รูปหลัก' });
  assert.equal(result.ok, true);
  assert.equal(result.contentType, 'image/jpeg');
  assert.equal(result.size, 5000);
});

test('validateImage ปฏิเสธไฟล์ว่าง', () => {
  const result = validateImage(new Uint8Array(0), { maxBytes: 10000, label: 'รูปหลัก' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test('validateImage ปฏิเสธไฟล์ใหญ่เกินและบอกวิธีแก้', () => {
  const result = validateImage(fakeFile(JPEG_HEADER, 20000), { maxBytes: 10000, label: 'รูปหลัก' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
  assert.match(result.hint, /Resize/);
});

test('validateImage ปฏิเสธ HEIC ก่อนที่ LINE จะปฏิเสธเอง', () => {
  const result = validateImage(fakeHeic(), { maxBytes: 10000, label: 'รูปหลัก' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 415);
  assert.match(result.error, /HEIC/);
});

test('validateImage ปฏิเสธไฟล์ที่ไม่ใช่รูป', () => {
  const result = validateImage(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { maxBytes: 10000, label: 'รูปหลัก' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 415);
});

test('buildImageUrl ใช้ origin ของ request เมื่อไม่ได้ตั้ง PUBLIC_BASE_URL', () => {
  assert.equal(
    buildImageUrl('https://bot.example.workers.dev/ingest', '', 'abc.jpg'),
    'https://bot.example.workers.dev/i/abc.jpg',
  );
});

test('buildImageUrl ใช้ PUBLIC_BASE_URL เมื่อกำหนดไว้ และตัด / ท้ายทิ้ง', () => {
  assert.equal(
    buildImageUrl('https://bot.example.workers.dev/ingest', 'https://photos.example.com/', 'abc.jpg'),
    'https://photos.example.com/i/abc.jpg',
  );
});
