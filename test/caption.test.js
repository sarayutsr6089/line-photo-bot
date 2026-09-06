import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMemoryCaption, formatThaiDate, parseIsoDateParts, yearsAgoFrom } from '../src/caption.js';

const TODAY = new Date('2026-09-06T00:00:00Z');

test('parseIsoDateParts อ่านวันที่จากข้อความ ISO ได้', () => {
  assert.deepEqual(parseIsoDateParts('2025-09-06T14:23:00+07:00'), { year: 2025, month: 9, day: 6 });
  assert.deepEqual(parseIsoDateParts('2025-09-06'), { year: 2025, month: 9, day: 6 });
});

test('parseIsoDateParts ไม่แปลง timezone ให้วันเพี้ยน', () => {
  // เที่ยงคืนครึ่งตามเวลาไทย ถ้าแปลงเป็น UTC จะกลายเป็นวันก่อนหน้า ต้องยังได้วันที่ 6
  assert.deepEqual(parseIsoDateParts('2025-09-06T00:30:00+07:00'), { year: 2025, month: 9, day: 6 });
});

test('parseIsoDateParts คืน null เมื่ออ่านไม่ได้', () => {
  assert.equal(parseIsoDateParts('6 กันยายน 2568'), null);
  assert.equal(parseIsoDateParts(''), null);
  assert.equal(parseIsoDateParts(undefined), null);
  assert.equal(parseIsoDateParts('2025-13-06'), null);
  assert.equal(parseIsoDateParts('2025-09-45'), null);
});

test('formatThaiDate ใช้เดือนย่อไทยและปี พ.ศ.', () => {
  assert.equal(formatThaiDate({ year: 2025, month: 9, day: 6 }), '06 ก.ย. 2568');
  assert.equal(formatThaiDate({ year: 2024, month: 1, day: 31 }), '31 ม.ค. 2567');
  assert.equal(formatThaiDate({ year: 2023, month: 12, day: 30 }), '30 ธ.ค. 2566');
});

test('yearsAgoFrom นับจากจำนวนวันจริง จึงถูกต้องแม้ช่วงค้นหาคร่อมปีใหม่', () => {
  // ถ่าย 30 ธ.ค. 2024 ดูวันที่ 2 ม.ค. 2026 = ผ่านมา 1 ปี ไม่ใช่ 2 ปีตามผลต่างเลขปี
  assert.equal(yearsAgoFrom({ year: 2024, month: 12, day: 30 }, new Date('2026-01-02T00:00:00Z')), 1);
  assert.equal(yearsAgoFrom({ year: 2025, month: 9, day: 6 }, TODAY), 1);
  assert.equal(yearsAgoFrom({ year: 2023, month: 9, day: 6 }, TODAY), 3);
});

test('yearsAgoFrom ไม่คืนค่าต่ำกว่า 1 ปี', () => {
  assert.equal(yearsAgoFrom({ year: 2026, month: 9, day: 1 }, TODAY), 1);
});

test('buildMemoryCaption ประกอบข้อความตามรูปแบบที่ต้องการ', () => {
  assert.equal(
    buildMemoryCaption('2025-09-06T14:23:00+07:00', 'ฟรองซ์', TODAY),
    'วันนี้เมื่อปีที่แล้วของฟรองซ์ (06 ก.ย. 2568)',
  );
});

test('buildMemoryCaption เติมจำนวนปีเมื่อเกินหนึ่งปี', () => {
  assert.equal(
    buildMemoryCaption('2023-09-06', 'ฟรองซ์', TODAY),
    'วันนี้เมื่อ 3 ปีที่แล้วของฟรองซ์ (06 ก.ย. 2566)',
  );
});

test('buildMemoryCaption ตัดชื่อออกเมื่อไม่ได้ตั้งชื่อไว้', () => {
  assert.equal(buildMemoryCaption('2025-09-06', '', TODAY), 'วันนี้เมื่อปีที่แล้ว (06 ก.ย. 2568)');
  assert.equal(buildMemoryCaption('2025-09-06', '   ', TODAY), 'วันนี้เมื่อปีที่แล้ว (06 ก.ย. 2568)');
  assert.equal(buildMemoryCaption('2025-09-06', undefined, TODAY), 'วันนี้เมื่อปีที่แล้ว (06 ก.ย. 2568)');
});

test('buildMemoryCaption คืน null เมื่ออ่านวันที่ไม่ได้ เพื่อให้ใช้ข้อความสำรอง', () => {
  assert.equal(buildMemoryCaption('ไม่ใช่วันที่', 'ฟรองซ์', TODAY), null);
  assert.equal(buildMemoryCaption(undefined, 'ฟรองซ์', TODAY), null);
});
