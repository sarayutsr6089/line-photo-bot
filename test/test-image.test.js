import test from 'node:test';
import assert from 'node:assert/strict';
import { testImageBytes } from '../src/test-image.js';
import { IMAGE_LIMITS, sniffImageType, validateImage } from '../src/images.js';
import { TEST_CAPTION } from '../src/index.js';

test('รูปทดสอบถอดรหัสออกมาเป็น PNG ที่ใช้ได้จริง', () => {
  const bytes = testImageBytes();
  assert.ok(bytes.length > 0);
  assert.equal(sniffImageType(bytes), 'image/png');
});

test('รูปทดสอบเล็กพอจะใช้เป็น preview ของ LINE ได้ (ไม่เกิน 1 MB)', () => {
  const result = validateImage(testImageBytes(), { maxBytes: IMAGE_LIMITS.preview, label: 'รูปทดสอบ' });
  assert.equal(result.ok, true);
  assert.ok(result.size < IMAGE_LIMITS.preview);
});

test('ข้อความกำกับรูปทดสอบบอกชัดว่าเป็นการทดสอบ', () => {
  assert.match(TEST_CAPTION, /ทดสอบ/);
  assert.ok(TEST_CAPTION.length <= 500);
});
