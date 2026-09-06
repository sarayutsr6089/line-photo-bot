// ประกอบข้อความบรรยายใต้รูป เช่น "วันนี้เมื่อปีที่แล้วของฟรองซ์ (06 ก.ย. 2568)"
//
// จัดรูปแบบวันที่เองทั้งหมดแทนที่จะพึ่ง Intl หรือการตั้งค่าภาษาของไอโฟน
// เพราะปี พ.ศ. กับชื่อเดือนภาษาไทยต้องออกมาเหมือนเดิมทุกครั้ง ไม่ว่าเครื่องไหนจะตั้งค่าอย่างไร

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * อ่าน วัน/เดือน/ปี จากข้อความวันที่แบบ ISO 8601 ที่ Shortcut ส่งมา
 * อ่านจากตัวอักษรตรง ๆ ไม่แปลงเป็น Date object เพื่อไม่ให้ timezone ทำให้วันเพี้ยนไปหนึ่งวัน
 */
export function parseIsoDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '').trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}

/** "06 ก.ย. 2568" — วันเติมศูนย์หน้า เดือนย่อภาษาไทย ปีเป็น พ.ศ. */
export function formatThaiDate({ year, month, day }) {
  return `${String(day).padStart(2, '0')} ${THAI_MONTHS_SHORT[month - 1]} ${year + 543}`;
}

/**
 * ห่างจากวันนี้กี่ปี
 * ปัดจากจำนวนวันจริง ไม่ใช่ลบเลขปี เพราะ Shortcut ค้นรูปในช่วง +-5 วันรอบวันครบรอบ
 * ถ้าช่วงนั้นคร่อมปีใหม่ การลบเลขปีจะได้คำตอบเกินไปหนึ่งปี
 */
export function yearsAgoFrom(parts, today = new Date()) {
  const then = Date.UTC(parts.year, parts.month - 1, parts.day);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const years = Math.round((now - then) / (365.25 * DAY_MS));
  return years >= 1 ? years : 1;
}

/**
 * ประกอบข้อความเต็ม คืน null ถ้าอ่านวันที่ไม่ได้ เพื่อให้ผู้เรียกไปใช้ข้อความสำรองแทน
 */
export function buildMemoryCaption(takenIso, childName, today = new Date()) {
  const parts = parseIsoDateParts(takenIso);
  if (!parts) return null;

  const years = yearsAgoFrom(parts, today);
  const when = years === 1 ? 'วันนี้เมื่อปีที่แล้ว' : `วันนี้เมื่อ ${years} ปีที่แล้ว`;
  const name = typeof childName === 'string' ? childName.trim() : '';
  const owner = name ? `ของ${name}` : '';

  return `${when}${owner} (${formatThaiDate(parts)})`;
}
