// ตัวช่วยเล็ก ๆ ที่ใช้ร่วมกันหลายไฟล์

/** ตอบกลับเป็น JSON พร้อม status code */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/**
 * เทียบ string แบบใช้เวลาคงที่ ป้องกัน timing attack ตอนตรวจ secret
 * คืน false ทันทีถ้าความยาวไม่เท่ากัน (ความยาวไม่ใช่ความลับ)
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** แปลง "U123, C456" เป็น ["U123", "C456"] ตัดช่องว่างและค่าว่างทิ้ง */
export function parseTargetIds(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

/** แปลง ArrayBuffer เป็น base64 (ใช้กับลายเซ็น webhook) */
export function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** ปกปิด id ยาว ๆ เวลา log เช่น U1234...cdef ไม่ให้ id เต็มหลุดออกไปใน response */
export function maskId(id) {
  if (typeof id !== 'string' || id.length <= 10) return '***';
  return `${id.slice(0, 5)}...${id.slice(-4)}`;
}
