import fs from 'fs';
import * as XLSX from 'xlsx';
import { exportReceiptsToExcel, exportVouchersToExcel } from '../../../src/utils/excelExport.js';

async function runTests() {
  console.log('🧪 Starting Excel Export Utility Tests...\n');
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, testName) {
    if (actual === expected) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} (Expected: ${expected}, Got: ${actual})`);
      failed++;
    }
  }

  // Mock Receipts
  const mockReceipts = [
    {
      receiptNo: '69090001',
      docDate: '2026-09-23',
      buyerName: 'บริษัท กว่างเซิ่นรับเบอร์ (ตรัง) จำกัด',
      buyerAddress: '123 หมู่ 4 ตรัง',
      buyerTaxId: '0925555000111',
      period: '1/69',
      paymentMethod: 'เงินโอน',
      payDate: '2026-09-23',
      notes: 'จ่ายครบถ้วน',
      cashierName: 'ประนิศา พรมหาไชย',
      status: 'ปกติ',
      items: [
        {
          itemTitle: 'ยางเครป',
          quantity: 1000,
          unitPrice: 50,
          drcPercent: 100,
          discountAmount: 0,
          amount: 50000
        },
        {
          itemTitle: 'ส่วนลดพิเศษ',
          quantity: 1,
          unitPrice: 500,
          discountAmount: 500,
          amount: 500
        }
      ]
    }
  ];

  // Test Receipts Export
  const resReceipts = exportReceiptsToExcel(mockReceipts, 'test_receipts.xlsx');
  assertEqual(resReceipts.success, true, 'exportReceiptsToExcel returns success');
  assertEqual(resReceipts.count, 2, 'Receipt with 2 items yields 2 rows in Excel');

  // Verify generated Excel file structure
  const wbR = XLSX.read(fs.readFileSync('test_receipts.xlsx'));
  const sheetR = wbR.Sheets['ใบเสร็จรับเงิน'];
  const dataR = XLSX.utils.sheet_to_json(sheetR, { header: 1 });
  assertEqual(dataR[0].length, 20, 'Receipt Excel sheet has exactly 20 columns');
  assertEqual(dataR[0][0], 'วันที่', 'Col 1 is วันที่');
  assertEqual(dataR[0][1], 'เลขที่ใบเสร็จ', 'Col 2 is เลขที่ใบเสร็จ');
  assertEqual(dataR[0][19], 'วันที่พิมพ์/บันทึก', 'Col 20 is วันที่พิมพ์/บันทึก');
  assertEqual(dataR[1][1], '69090001', 'Row 1 receiptNo matches 69090001');
  assertEqual(dataR[1][6], 'ยางเครป', 'Row 1 item title matches ยางเครป');
  assertEqual(dataR[2][6], 'ส่วนลดพิเศษ', 'Row 2 item title matches ส่วนลดพิเศษ');

  // Mock Vouchers
  const mockVouchers = [
    {
      voucherNo: '69090001',
      docDate: '2026-09-20',
      receiverName: 'สหกรณ์กองทุนสวนยาง',
      mainDescription: 'จ่ายค่ายางพารา',
      refNo: 'REF-001',
      paymentMethod: 'เงินโอน',
      sourceBankAcc: 'BBL 4143010488',
      chequeOrDestAcc: 'KBANK 1234567890',
      destBank: 'กสิกรไทย',
      cashierName: 'ผู้จัดทำ',
      status: 'ปกติ',
      items: [
        {
          itemDate: '2026-09-20',
          description: 'ค่ายางแผ่นงวด 1',
          amount: 85000
        }
      ]
    }
  ];

  const resVouchers = exportVouchersToExcel(mockVouchers, 'test_vouchers.xlsx');
  assertEqual(resVouchers.success, true, 'exportVouchersToExcel returns success');
  assertEqual(resVouchers.count, 1, 'Voucher with 1 item yields 1 row in Excel');

  const wbV = XLSX.read(fs.readFileSync('test_vouchers.xlsx'));
  const sheetV = wbV.Sheets['ใบสำคัญจ่าย'];
  const dataV = XLSX.utils.sheet_to_json(sheetV, { header: 1 });
  assertEqual(dataV[0].length, 18, 'Voucher Excel sheet has exactly 18 columns');
  assertEqual(dataV[0][0], 'วันที่เอกสาร', 'Col 1 is วันที่เอกสาร');
  assertEqual(dataV[0][1], 'เลขที่เอกสาร', 'Col 2 is เลขที่เอกสาร');
  assertEqual(dataV[0][17], 'วันที่บันทึก/พิมพ์', 'Col 18 is วันที่บันทึก/พิมพ์');
  assertEqual(dataV[1][1], '69090001', 'Row 1 voucherNo matches 69090001');
  assertEqual(dataV[1][6], 'ค่ายางแผ่นงวด 1', 'Row 1 description matches ค่ายางแผ่นงวด 1');
  assertEqual(dataV[1][7], 85000, 'Row 1 amount matches 85000');

  // Clean up test files
  import('fs').then(fs => {
    try { fs.unlinkSync('test_receipts.xlsx'); } catch (e) {}
    try { fs.unlinkSync('test_vouchers.xlsx'); } catch (e) {}
  });

  console.log(`\n📊 Excel Export Test Results: ${passed} Passed, ${failed} Failed`);
}

runTests().catch(console.error);
