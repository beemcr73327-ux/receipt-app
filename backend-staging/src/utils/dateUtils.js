/**
 * Date Utility Helpers for Staging Backend
 * Supports Thai Buddhist Era (พ.ศ.) conversions and YYMM prefix generation
 */

/**
 * คำนวณคำนำหน้าเลขที่เอกสารในรูปแบบ YYMM (ปี พ.ศ. 2 หลัก + เดือน 2 หลัก)
 * ตัวอย่าง: กันยายน 2569 (2026) -> '6909'
 * @param {Date|string} dateInput 
 * @returns {string} e.g. '6909'
 */
export function getThaiDocPrefix(dateInput = new Date()) {
  const d = parseDate(dateInput);
  const thaiYear = d.getFullYear() + 543;
  const year2 = String(thaiYear).slice(-2);
  const month2 = String(d.getMonth() + 1).padStart(2, '0');
  return `${year2}${month2}`;
}

/**
 * แปลง input เป็น Date object ที่ถูกต้องอย่างปลอดภัย
 * @param {Date|string|number} input 
 * @returns {Date}
 */
export function parseDate(input) {
  if (input instanceof Date && !isNaN(input.getTime())) {
    return input;
  }
  if (typeof input === 'string' && input.trim()) {
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

/**
 * จัดรูปแบบวันเวลาภาษาไทยแบบสากล
 * @param {Date|string} dateInput 
 * @returns {string} e.g. "07/09/2569 22:45:00"
 */
export function formatThaiDateTime(dateInput = new Date()) {
  const d = parseDate(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const thaiYear = d.getFullYear() + 543;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${thaiYear} ${hours}:${minutes}:${seconds}`;
}
