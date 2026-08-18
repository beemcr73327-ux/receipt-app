/**
 * Date utility functions for Thai Buddhist Era (พ.ศ.)
 */

/**
 * Formats a Date object or ISO string into DD/MM/YYYY (พ.ศ.) format
 * @param {Date|string} dateInput 
 * @returns {string} e.g. "01/08/2569"
 */
export function formatThaiDate(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const thaiYear = d.getFullYear() + 543;

  return `${day}/${month}/${thaiYear}`;
}

/**
 * Formats a Date into DD/MM/YYYY HH:mm:ss (พ.ศ.) format
 * @param {Date|string} dateInput 
 * @returns {string} e.g. "01/08/2569 20:30:21"
 */
export function formatThaiDateTime(dateInput = new Date()) {
  if (!dateInput) return formatThaiDateTime(new Date());
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // Handle strings with Thai Year >= 2500 (e.g., "Fri Aug 11 2569 10:12:02 GMT+0700")
    const thaiYearMatch = trimmed.match(/\b(25\d{2})\b/);
    if (thaiYearMatch) {
      const tYear = parseInt(thaiYearMatch[1], 10);
      const gYear = tYear - 543;
      const convertedStr = trimmed.replace(thaiYearMatch[1], String(gYear));
      const parsedD = new Date(convertedStr);
      if (!isNaN(parsedD.getTime())) {
        const day = String(parsedD.getDate()).padStart(2, '0');
        const month = String(parsedD.getMonth() + 1).padStart(2, '0');
        const hours = String(parsedD.getHours()).padStart(2, '0');
        const minutes = String(parsedD.getMinutes()).padStart(2, '0');
        const seconds = String(parsedD.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${tYear} ${hours}:${minutes}:${seconds}`;
      }
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    // If parsing failed, fallback to current Thai DateTime
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const thaiYear = now.getFullYear() + 543;
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${thaiYear} ${hours}:${minutes}:${seconds}`;
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const thaiYear = year < 2500 ? year + 543 : year;

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${thaiYear} ${hours}:${minutes}:${seconds}`;
}

/**
 * Returns year (2-digit พ.ศ.) and month (2-digit) string for receipt prefix calculation
 * @param {Date} dateInput 
 * @returns {{ year2: string, month2: string }} e.g. { year2: '69', month2: '08' }
 */
export function getThaiYearMonthPrefix(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const thaiYear = (d.getFullYear() + 543).toString();
  const year2 = thaiYear.slice(-2);
  const month2 = String(d.getMonth() + 1).padStart(2, '0');

  return { year2, month2 };
}

/**
 * Converts standard HTML date input (YYYY-MM-DD) to Thai Date (DD/MM/YYYY พ.ศ.)
 */
export function isoToThaiDate(isoDateString) {
  if (!isoDateString) return '';
  const [year, month, day] = isoDateString.split('-');
  if (!year || !month || !day) return '';
  const thaiYear = parseInt(year, 10) + 543;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${thaiYear}`;
}

/**
 * Gets today's ISO date string (YYYY-MM-DD) for HTML <input type="date">
 */
export function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats period input into MM/YYYY (พ.ศ.) format e.g. "08/2569"
 * @param {string|Date} periodInput 
 * @returns {string} e.g. "08/2569"
 */
export function formatPeriod(periodInput) {
  if (!periodInput) return '';
  const str = String(periodInput).trim();
  if (!str || str === '-') return '';

  const mMatch = str.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (mMatch) {
    const m = mMatch[1].padStart(2, '0');
    let y = mMatch[2];
    if (y.length === 2) y = `25${y}`;
    return `${m}/${y}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const thaiYear = year < 2500 ? year + 543 : year;
    return `${month}/${thaiYear}`;
  }

  return str;
}

/**
 * Normalizes any date input to DD/MM/YYYY (พ.ศ.) format
 */
export function normalizeThaiDate(val) {
  if (!val) return '';
  const trimmed = String(val).trim();
  if (!trimmed || trimmed === '-') return '';

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  const thaiYearMatch = trimmed.match(/\b(25\d{2})\b/);
  if (thaiYearMatch) {
    const tYear = parseInt(thaiYearMatch[1], 10);
    const gYear = tYear - 543;
    const convertedStr = trimmed.replace(thaiYearMatch[1], String(gYear));
    const parsedD = new Date(convertedStr);
    if (!isNaN(parsedD.getTime())) {
      const day = String(parsedD.getDate()).padStart(2, '0');
      const month = String(parsedD.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${tYear}`;
    }
  }

  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const thaiYear = year < 2500 ? year + 543 : year;
    return `${day}/${month}/${thaiYear}`;
  }

  return trimmed;
}
