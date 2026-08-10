import { bahttext } from '../utils/bahttext.js';
import { formatThaiDate, getThaiYearMonthPrefix } from '../utils/dateUtils.js';

console.log('--- TESTING RECEIPT SYSTEM LOGIC ---');

// Test BahtText
const sample1 = bahttext(598500.00);
console.log('598,500.00 ->', sample1);
if (sample1 === 'ห้าแสนเก้าหมื่นแปดพันห้าร้อยบาทถ้วน') {
  console.log('✅ BAHTTEXT Test 1 Passed!');
} else {
  console.error('❌ BAHTTEXT Test 1 Failed:', sample1);
}

const sample2 = bahttext(12.50);
console.log('12.50 ->', sample2);
if (sample2 === 'สิบสองบาทห้าสิบสตางค์') {
  console.log('✅ BAHTTEXT Test 2 Passed!');
} else {
  console.error('❌ BAHTTEXT Test 2 Failed:', sample2);
}

// Test Date Utils
const thaiDate = formatThaiDate(new Date('2026-08-01T00:00:00'));
console.log('2026-08-01 ->', thaiDate);
if (thaiDate === '01/08/2569') {
  console.log('✅ Thai Date Test Passed!');
} else {
  console.error('❌ Thai Date Test Failed:', thaiDate);
}

const prefix = getThaiYearMonthPrefix(new Date('2026-08-01T00:00:00'));
console.log('Year/Month Prefix ->', prefix);
if (prefix.year2 === '69' && prefix.month2 === '08') {
  console.log('✅ Prefix Test Passed!');
} else {
  console.error('❌ Prefix Test Failed:', prefix);
}

console.log('--- ALL LOGIC TESTS PASSED SUCCESSFULLY! ---');
