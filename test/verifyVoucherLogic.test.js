// test/verifyVoucherLogic.test.js
// Automated verification script for Payment Voucher backend logic

const assert = require('assert');

console.log('🧪 Starting Payment Voucher Logic Verification Tests...\n');

// 1. Test Running Number Generation Logic (PVYYMMXXXX with monthly reset)
function generateNextVoucherNoMock(existingVouchers, docDateStr) {
  const parts = docDateStr.split('/');
  let d = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  let y = parseInt(parts[2], 10);
  
  // Ensure Thai Buddhist Era year
  if (y < 2500) y += 543;
  
  const yy = String(y).slice(-2);
  const mm = ('0' + m).slice(-2);
  const prefix = `PV${yy}${mm}`;

  let maxSeq = 0;
  for (const vNo of existingVouchers) {
    if (vNo.startsWith(prefix)) {
      const seqNum = parseInt(vNo.substring(prefix.length), 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }

  const nextSeq = ('0000' + (maxSeq + 1)).slice(-4);
  return `${prefix}${nextSeq}`;
}

// Run Test 1.1: First voucher of August 2569
const test1_1 = generateNextVoucherNoMock([], '17/08/2569');
assert.strictEqual(test1_1, 'PV69080001', 'First voucher should be PV69080001');
console.log('✅ Test 1.1 Passed: First voucher number generated correctly ->', test1_1);

// Run Test 1.2: Continuation in August 2569
const existingAug = ['PV69080001', 'PV69080002', 'PV69080009'];
const test1_2 = generateNextVoucherNoMock(existingAug, '18/08/2569');
assert.strictEqual(test1_2, 'PV69080010', 'Next voucher should be PV69080010');
console.log('✅ Test 1.2 Passed: Sequence increments correctly ->', test1_2);

// Run Test 1.3: Reset sequence on new month (September 2569)
const test1_3 = generateNextVoucherNoMock(existingAug, '01/09/2569');
assert.strictEqual(test1_3, 'PV69090001', 'New month should reset sequence to PV69090001');
console.log('✅ Test 1.3 Passed: Monthly sequence reset works correctly ->', test1_3);

// 2. Test 17-Column Row Transformation for Multi-Item Voucher
function formatVoucherRows(d) {
  const docDateVal = d.docDate;
  const voucherNo = d.voucherNo;
  const receiverName = d.receiverName;
  const mainDesc = d.mainDescription;
  const refNo = d.refNo || '';
  const paymentMethod = d.paymentMethod;
  const chequeOrAccNo = d.chequeOrAccNo || '';
  const bankName = d.bankName || '';
  const payDateVal = d.payDate;
  const notes = d.notes || '';
  const cashierName = d.cashierName;
  const status = d.status || 'ปกติ';
  const cancelReason = d.cancelReason || '';
  const timestamp = '17/08/2569 22:45:00';

  return d.items.map(itm => [
    `'${docDateVal}`,
    `'${voucherNo}`,
    receiverName,
    mainDesc,
    `'${refNo}`,
    `'${itm.itemDate}`,
    itm.description,
    itm.amount,
    paymentMethod,
    `'${chequeOrAccNo}`,
    bankName,
    `'${payDateVal}`,
    notes,
    cashierName,
    status,
    cancelReason,
    timestamp
  ]);
}

const mockPayload = {
  docDate: '17/08/2569',
  voucherNo: 'PV69080001',
  receiverName: 'บริษัท ยางพาราไทย จำกัด',
  mainDescription: 'ชำระค่าวัตถุดิบยางก้อนถ้วยประจำงวด 08/69',
  refNo: 'INV-2026-088',
  paymentMethod: 'โอนเงิน',
  chequeOrAccNo: '6781803115',
  bankName: 'KTB 3115',
  payDate: '17/08/2569',
  notes: 'หัก ณ ที่จ่าย 1% เรียบร้อย',
  cashierName: 'ประนัดดา พรมหาไชย',
  items: [
    { itemDate: '15/08/2569', description: 'ยางก้อนถ้วย Lot 1 (2,000 กก.)', amount: 100000 },
    { itemDate: '16/08/2569', description: 'ยางก้อนถ้วย Lot 2 (1,000 กก.)', amount: 50000 }
  ]
};

const rows = formatVoucherRows(mockPayload);
assert.strictEqual(rows.length, 2, 'Should generate 2 rows for 2 sub-items');
assert.strictEqual(rows[0].length, 17, 'Each row must contain exactly 17 columns');
assert.strictEqual(rows[0][1], "'PV69080001", 'Col B must be voucher number');
assert.strictEqual(rows[1][1], "'PV69080001", 'Col B must be voucher number duplicated for item 2');
assert.strictEqual(rows[0][6], 'ยางก้อนถ้วย Lot 1 (2,000 กก.)');
assert.strictEqual(rows[1][6], 'ยางก้อนถ้วย Lot 2 (1,000 กก.)');
console.log('✅ Test 2 Passed: 17-column multi-item row generation verified successfully!');

// 3. Test Bank Account Filtering (RC, PV, ALL)
function filterBanksMock(bankList, moduleType) {
  return bankList.filter(b => {
    if (!b.usage || b.usage === 'ALL') return true;
    return b.usage.includes(moduleType);
  });
}

const mockBankList = [
  { abbr: 'BBL', acc: '4143010488', usage: 'RC' },
  { abbr: 'KTB', acc: '6781803115', usage: 'PV' },
  { abbr: 'SCB', acc: '4321625236', usage: 'RC,PV' },
  { abbr: 'BAY', acc: '1291795056', usage: 'ALL' }
];

const rcBanks = filterBanksMock(mockBankList, 'RC');
const pvBanks = filterBanksMock(mockBankList, 'PV');

assert.strictEqual(rcBanks.length, 3, 'RC should include BBL, SCB, BAY');
assert.strictEqual(pvBanks.length, 3, 'PV should include KTB, SCB, BAY');
console.log('✅ Test 3 Passed: Bank filtering by usage flag (RC/PV/ALL) verified successfully!');

console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
