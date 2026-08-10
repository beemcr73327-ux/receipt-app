/**
 * Converts a number to Thai Baht text (BAHTTEXT) format.
 * @param {number|string} amount 
 * @returns {string} Thai text representation (e.g. "ห้าแสนเก้าหมื่นแปดพันห้าร้อยบาทถ้วน")
 */
export function bahttext(amount) {
  if (amount === null || amount === undefined || amount === '' || isNaN(amount)) {
    return 'ศูนย์บาทถ้วน';
  }

  let num = Number(amount);
  if (num === 0) return 'ศูนย์บาทถ้วน';

  // Round to 2 decimal places
  num = Math.round(num * 100) / 100;
  
  const textNum = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const textPosition = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const parts = num.toFixed(2).split('.');
  let bahtStr = parts[0];
  let satangStr = parts[1];

  function convertGroup(groupStr) {
    let result = '';
    const len = groupStr.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(groupStr[i]);
      const pos = len - i - 1;

      if (digit !== 0) {
        if (pos === 1 && digit === 1) {
          result += 'สิบ';
        } else if (pos === 1 && digit === 2) {
          result += 'ยี่สิบ';
        } else if (pos === 0 && digit === 1 && len > 1) {
          result += 'เอ็ด';
        } else {
          result += textNum[digit] + textPosition[pos];
        }
      }
    }
    return result;
  }

  function convertNumber(numStr) {
    if (numStr === '0' || numStr === '') return '';
    let result = '';
    let len = numStr.length;
    
    // Process in chunks of 6 digits (million groups)
    while (len > 0) {
      const start = Math.max(0, len - 6);
      const chunk = numStr.substring(start, len);
      const chunkText = convertGroup(chunk);
      
      if (result !== '') {
        result = chunkText + 'ล้าน' + result;
      } else {
        result = chunkText;
      }
      len = start;
    }
    return result;
  }

  let result = '';
  if (num < 0) {
    result += 'ลบ';
    bahtStr = bahtStr.replace('-', '');
  }

  const bahtText = convertNumber(bahtStr);
  if (bahtText !== '') {
    result += bahtText + 'บาท';
  } else if (parseInt(satangStr) > 0) {
    result += 'ศูนย์บาท';
  }

  if (parseInt(satangStr) === 0) {
    result += 'ถ้วน';
  } else {
    const satangText = convertGroup(satangStr);
    result += satangText + 'สตางค์';
  }

  return result;
}
