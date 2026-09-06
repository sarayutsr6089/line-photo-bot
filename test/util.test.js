import test from 'node:test';
import assert from 'node:assert/strict';
import { maskId, parseTargetIds, timingSafeEqual } from '../src/util.js';

test('parseTargetIds แยก id ด้วยจุลภาคและช่องว่าง', () => {
  assert.deepEqual(parseTargetIds('U111, C222'), ['U111', 'C222']);
  assert.deepEqual(parseTargetIds(' U111 \n C222 '), ['U111', 'C222']);
  assert.deepEqual(parseTargetIds('U111,,C222,'), ['U111', 'C222']);
});

test('parseTargetIds คืน array ว่างเมื่อไม่ได้ตั้งค่า', () => {
  assert.deepEqual(parseTargetIds(''), []);
  assert.deepEqual(parseTargetIds(undefined), []);
  assert.deepEqual(parseTargetIds(null), []);
});

test('timingSafeEqual ตรงเฉพาะเมื่อเหมือนกันเป๊ะ', () => {
  assert.equal(timingSafeEqual('secret', 'secret'), true);
  assert.equal(timingSafeEqual('secret', 'secreT'), false);
  assert.equal(timingSafeEqual('secret', 'secret2'), false);
  assert.equal(timingSafeEqual('', ''), true);
  assert.equal(timingSafeEqual(undefined, 'secret'), false);
});

test('maskId ไม่เผย id เต็ม', () => {
  assert.equal(maskId('U1234567890abcdef'), 'U1234...cdef');
  assert.equal(maskId('short'), '***');
});
