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
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const thaiYear = d.getFullYear() + 543;

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
