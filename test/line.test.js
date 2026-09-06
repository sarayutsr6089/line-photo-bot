import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { buildMessages, extractSources, verifyLineSignature } from '../src/line.js';
import { captionEnabled, resolveCaption } from '../src/index.js';

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

const CAPTION_TODAY = new Date('2026-09-06T00:00:00Z');

test('resolveCaption ใช้ข้อความที่ Shortcut เขียนมาเองก่อนเสมอ', () => {
  const caption = resolveCaption(
    { caption: '  ลูกวันนี้  ', taken: '2025-09-06', years: '1' },
    'ฟรองซ์',
    CAPTION_TODAY,
  );
  assert.equal(caption, 'ลูกวันนี้');
});

test('resolveCaption สร้างข้อความจากวันถ่ายรูปเมื่อไม่ได้เขียน caption มา', () => {
  assert.equal(
    resolveCaption({ taken: '2025-09-06T14:23:00+07:00' }, 'ฟรองซ์', CAPTION_TODAY),
    'วันนี้เมื่อปีที่แล้วของฟรองซ์ (06 ก.ย. 2568)',
  );
});

test('resolveCaption ถอยไปใช้จำนวนปีเมื่ออ่านวันถ่ายรูปไม่ได้', () => {
  assert.equal(
    resolveCaption({ taken: 'อ่านไม่ออก', years: '3' }, 'ฟรองซ์', CAPTION_TODAY),
    '📸 ความทรงจำวันนี้ เมื่อ 3 ปีที่แล้ว',
  );
});

test('resolveCaption ใช้ค่าตั้งต้นเมื่อไม่มีข้อมูลอะไรเลย', () => {
  assert.equal(resolveCaption({}, 'ฟรองซ์', CAPTION_TODAY), '📸 ความทรงจำวันนี้');
  assert.equal(resolveCaption(undefined, 'ฟรองซ์', CAPTION_TODAY), '📸 ความทรงจำวันนี้');
  assert.equal(resolveCaption({ years: '0' }, 'ฟรองซ์', CAPTION_TODAY), '📸 ความทรงจำวันนี้');
});

test('captionEnabled เปิดเฉพาะเมื่อตั้งค่าเป็น true เท่านั้น', () => {
  assert.equal(captionEnabled('true'), true);
  assert.equal(captionEnabled('TRUE'), true);
  assert.equal(captionEnabled(' true '), true);
  assert.equal(captionEnabled('false'), false);
  assert.equal(captionEnabled(''), false);
  assert.equal(captionEnabled(undefined), false);
  assert.equal(captionEnabled('1'), false);
});
