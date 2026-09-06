import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { buildMessages, extractSources, verifyLineSignature } from '../src/line.js';
import { resolveCaption } from '../src/index.js';

const SECRET = 'test-channel-secret';

function signLikeLine(body) {
  return createHmac('sha256', SECRET).update(body).digest('base64');
}

test('verifyLineSignature ผ่านเมื่อลายเซ็นถูกต้อง', async () => {
  const body = JSON.stringify({ events: [] });
  assert.equal(await verifyLineSignature(SECRET, body, signLikeLine(body)), true);
});

test('verifyLineSignature ไม่ผ่านเมื่อ body ถูกแก้', async () => {
  const signature = signLikeLine(JSON.stringify({ events: [] }));
  assert.equal(await verifyLineSignature(SECRET, '{"events":[{"x":1}]}', signature), false);
});

test('verifyLineSignature ไม่ผ่านเมื่อไม่มีลายเซ็นหรือไม่มี secret', async () => {
  const body = '{}';
  assert.equal(await verifyLineSignature(SECRET, body, null), false);
  assert.equal(await verifyLineSignature('', body, signLikeLine(body)), false);
});

test('buildMessages ส่งข้อความบรรยายก่อนแล้วตามด้วยรูป', () => {
  const messages = buildMessages({
    caption: 'สวัสดี',
    originalUrl: 'https://x/i/a.jpg',
    previewUrl: 'https://x/i/b.jpg',
  });
  assert.equal(messages.length, 2);
  assert.deepEqual(messages[0], { type: 'text', text: 'สวัสดี' });
  assert.equal(messages[1].type, 'image');
  assert.equal(messages[1].originalContentUrl, 'https://x/i/a.jpg');
  assert.equal(messages[1].previewImageUrl, 'https://x/i/b.jpg');
});

test('buildMessages ส่งเฉพาะรูปเมื่อไม่มีข้อความบรรยาย', () => {
  const messages = buildMessages({ caption: '', originalUrl: 'https://x/i/a.jpg', previewUrl: 'https://x/i/a.jpg' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'image');
});

test('extractSources แยก user กับ group ออกจากกันได้', () => {
  const sources = extractSources([
    { source: { type: 'user', userId: 'U111' } },
    { source: { type: 'group', groupId: 'C222', userId: 'U333' } },
    { source: { type: 'room', roomId: 'R444' } },
    { source: {} },
    {},
  ]);
  assert.equal(sources.length, 3);
  assert.equal(sources[0].type, 'user');
  assert.equal(sources[0].id, 'U111');
  assert.equal(sources[1].type, 'group');
  assert.equal(sources[1].id, 'C222');
  assert.equal(sources[1].memberUserId, 'U333');
  assert.equal(sources[2].type, 'room');
});

test('extractSources ทนกับ events ที่หายไป', () => {
  assert.deepEqual(extractSources(undefined), []);
  assert.deepEqual(extractSources([]), []);
});

test('resolveCaption ใช้ข้อความที่ Shortcut ส่งมาก่อนเสมอ', () => {
  assert.equal(resolveCaption('  ลูกวันนี้  ', '1'), 'ลูกวันนี้');
});

test('resolveCaption สร้างข้อความจากจำนวนปีเมื่อไม่ได้ส่ง caption', () => {
  assert.equal(resolveCaption('', '1'), '📸 ความทรงจำวันนี้ เมื่อ 1 ปีที่แล้ว');
  assert.equal(resolveCaption(null, '3'), '📸 ความทรงจำวันนี้ เมื่อ 3 ปีที่แล้ว');
});

test('resolveCaption ใช้ค่าตั้งต้นเมื่อไม่มีข้อมูลอะไรเลย', () => {
  assert.equal(resolveCaption(null, null), '📸 ความทรงจำวันนี้');
  assert.equal(resolveCaption('', 'abc'), '📸 ความทรงจำวันนี้');
  assert.equal(resolveCaption('', '0'), '📸 ความทรงจำวันนี้');
});
