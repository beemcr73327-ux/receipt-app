/**
 * Unit Tests for Google Sheets Background Sync Service (Phase 1.2)
 * Run with: node backend-staging/src/test/verifyGoogleSheetsSync.js
 */

import assert from 'node:assert';
import {
  DEFAULT_GAS_WEBHOOK_URL,
  getGasWebhookUrl,
  formatThaiDateString,
  buildReceiptSyncPayload,
  buildReceiptCancelPayload,
  buildVoucherSyncPayload,
  buildVoucherCancelPayload,
  sendPayloadToGas,
  syncReceiptToGoogleSheets,
  syncVoucherToGoogleSheets,
  syncCancelReceiptToGoogleSheets,
  syncCancelVoucherToGoogleSheets
} from '../services/googleSheetsSyncService.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err.message);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err.message);
    failed++;
  }
}

console.log('🧪 Starting Google Sheets Background Sync Logic Tests (Phase 1.2)...\n');

// 1. Thai Date Formatting Tests
it('formatThaiDateString converts ISO date 2026-09-11 to Thai BE 11/09/2569', () => {
  const result = formatThaiDateString('2026-09-11');
  assert.strictEqual(result, '11/09/2569');
});

it('formatThaiDateString converts ISO date 2027-01-05 to Thai BE 05/01/2570', () => {
  const result = formatThaiDateString('2027-01-05');
  assert.strictEqual(result, '05/01/2570');
});

it('formatThaiDateString handles non-ISO strings gracefully', () => {
  assert.strictEqual(formatThaiDateString('11/09/2569'), '11/09/2569');
  assert.strictEqual(formatThaiDateString(''), '');
  assert.strictEqual(formatThaiDateString(null), '');
});

// 2. Webhook URL Resolution Tests
it('getGasWebhookUrl falls back to DEFAULT_GAS_WEBHOOK_URL when env is unset', () => {
  const url = getGasWebhookUrl({});
  assert.strictEqual(url, DEFAULT_GAS_WEBHOOK_URL);
});

it('getGasWebhookUrl uses custom env.GOOGLE_SHEETS_WEBHOOK when provided', () => {
  const custom = 'https://script.google.com/macros/s/CUSTOM_HOOK_123/exec';
  const url = getGasWebhookUrl({ GOOGLE_SHEETS_WEBHOOK: custom });
  assert.strictEqual(url, custom);
});

// 3. Receipt Payload Mapping Tests
it('buildReceiptSyncPayload produces correct 20-column GAS payload for Receipts', () => {
  const mockReceipt = {
    receipt_no: '69090001',
    doc_date: '2026-09-11',
    buyer_name: 'นายประสิทธิ์ ยางทอง',
    buyer_address: '123 ม.4 ต.วังหิน อ.เมือง จ.สุราษฎร์ธานี',
    buyer_tax_id: '1234567890123',
    period: 'งวดที่ 1',
    payment_method: 'เงินโอน',
    pay_date: '2026-09-11',
    bank_details: 'BBL 1234',
    notes: 'ส่งมอบยางเรียบร้อย',
    cashierName: 'สมชาย ใจดี',
    status: 'ปกติ',
    items: [
      {
        item_title: 'ยางก้อนถ้วย',
        quantity: 1000,
        unit_price: 65,
        drc_percent: 32,
        discount_amount: 300,
        discount_details: 'หักค่ายางดำ',
        net_amount: 20500
      },
      {
        item_title: 'เศษยาง',
        quantity: 500,
        unit_price: 28,
        drc_percent: 0,
        discount_amount: 0,
        discount_details: '',
        net_amount: 14000
      }
    ]
  };

  const payload = buildReceiptSyncPayload(mockReceipt);

  assert.strictEqual(payload.action, 'saveReceipt');
  assert.strictEqual(payload.receiptNo, '69090001');
  assert.strictEqual(payload.dateThai, '11/09/2569');
  assert.strictEqual(payload.buyerName, 'นายประสิทธิ์ ยางทอง');
  assert.strictEqual(payload.buyerTaxId, '1234567890123');
  assert.strictEqual(payload.paymentMethod, 'เงินโอน');
  assert.strictEqual(payload.paymentDateThai, '11/09/2569');
  assert.strictEqual(payload.items.length, 2);
  assert.strictEqual(payload.items[0].itemTitle, 'ยางก้อนถ้วย');
  assert.strictEqual(payload.items[0].drc, '32%');
  assert.strictEqual(payload.items[0].discountAmount, 300);
  assert.strictEqual(payload.items[0].amount, 20500);
  assert.strictEqual(payload.items[1].amount, 14000);
});

it('buildReceiptCancelPayload maps cancellation fields properly', () => {
  const cancelPayload = buildReceiptCancelPayload('69090001', 'ลูกค้ายกเลิกคำสั่งซื้อ');
  assert.strictEqual(cancelPayload.action, 'saveReceipt');
  assert.strictEqual(cancelPayload.receiptNo, '69090001');
  assert.strictEqual(cancelPayload.status, 'ยกเลิก');
  assert.strictEqual(cancelPayload.cancelReason, 'ลูกค้ายกเลิกคำสั่งซื้อ');
});

// 4. Voucher Payload Mapping Tests
it('buildVoucherSyncPayload produces correct 18-column GAS payload for Payment Vouchers', () => {
  const mockVoucher = {
    voucher_no: '69090001',
    doc_date: '2026-09-11',
    receiver_name: 'นางสาวมาลี รักษ์สวน',
    main_description: 'จ่ายค่าปุ๋ยบำรุงหน้ายางพารา',
    ref_no: 'INV-2026-001',
    payment_method: 'เงินโอน',
    source_bank_acc: 'BBL 1234567890',
    cheque_or_dest_acc: '0987654321',
    dest_bank: 'KBANK กสิกรไทย สาขาวังหิน',
    account_holder: 'มาลี รักษ์สวน',
    pay_date: '2026-09-11',
    notes: 'โอนผ่านเคาน์เตอร์',
    cashier_name: 'สมชาย ใจดี',
    status: 'ปกติ',
    items: [
      {
        item_date: '2026-09-11',
        description: 'ปุ๋ยเคมีสูตร 15-15-15',
        amount: 85000
      },
      {
        item_date: '2026-09-11',
        description: 'กรดฟอร์มิกตราดาว',
        amount: 15000
      }
    ]
  };

  const payload = buildVoucherSyncPayload(mockVoucher);

  assert.strictEqual(payload.action, 'saveVoucher');
  assert.strictEqual(payload.voucherNo, '69090001');
  assert.strictEqual(payload.docDateThai, '11/09/2569');
  assert.strictEqual(payload.receiverName, 'นางสาวมาลี รักษ์สวน');
  assert.strictEqual(payload.mainDescription, 'จ่ายค่าปุ๋ยบำรุงหน้ายางพารา');
  assert.strictEqual(payload.refNo, 'INV-2026-001');
  assert.strictEqual(payload.sourceBankAcc, 'BBL 1234567890');
  assert.strictEqual(payload.chequeOrDestAcc, '0987654321');
  assert.strictEqual(payload.destBank, 'KBANK กสิกรไทย สาขาวังหิน');
  assert.strictEqual(payload.items.length, 2);
  assert.strictEqual(payload.items[0].description, 'ปุ๋ยเคมีสูตร 15-15-15');
  assert.strictEqual(payload.items[0].amount, 85000);
  assert.strictEqual(payload.items[1].amount, 15000);
});

it('buildVoucherCancelPayload maps cancellation fields properly', () => {
  const cancelPayload = buildVoucherCancelPayload('69090001', 'กรอกยอดเงินผิดพลาด');
  assert.strictEqual(cancelPayload.action, 'cancelVoucher');
  assert.strictEqual(cancelPayload.voucherNo, '69090001');
  assert.strictEqual(cancelPayload.status, 'ยกเลิก');
  assert.strictEqual(cancelPayload.cancelReason, 'กรอกยอดเงินผิดพลาด');
});

// 5. Mock Dispatcher & Resilience Tests
await itAsync('sendPayloadToGas handles successful HTTP response', async () => {
  // Save original fetch
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.headers['Content-Type'], 'text/plain;charset=utf-8');
      const parsedBody = JSON.parse(options.body);
      assert.strictEqual(parsedBody.action, 'saveReceipt');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', action: 'inserted', receiptNo: '69090001' })
      };
    };

    const res = await sendPayloadToGas({ action: 'saveReceipt' }, 'https://fake-gas-url.test');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'success');
    assert.strictEqual(res.data.action, 'inserted');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await itAsync('sendPayloadToGas handles timeout and network abort gracefully', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    };

    const res = await sendPayloadToGas({ action: 'saveReceipt' }, 'https://fake-gas-url.test', { timeoutMs: 50 });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 408);
    assert.match(res.error, /timed out/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await itAsync('sendPayloadToGas handles non-JSON response from GAS gracefully', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => 'OK HTML Response'
    });

    const res = await sendPayloadToGas({ action: 'test' }, 'https://fake-gas-url.test');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.raw, 'OK HTML Response');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await itAsync('syncReceiptToGoogleSheets dispatches with proper URL', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success' })
      };
    };

    const res = await syncReceiptToGoogleSheets(
      { receipt_no: '69090001', doc_date: '2026-09-11', buyer_name: 'ทดสอบ' },
      { GOOGLE_SHEETS_WEBHOOK: 'https://test-gas.com/exec' }
    );
    assert.strictEqual(capturedUrl, 'https://test-gas.com/exec');
    assert.strictEqual(res.success, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await itAsync('syncCancelReceiptToGoogleSheets dispatches cancellation correctly', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', action: 'updated' })
      };
    };

    const res = await syncCancelReceiptToGoogleSheets('69090001', 'ยกเลิกเพราะพิมพ์ผิด', {});
    assert.strictEqual(capturedBody.action, 'saveReceipt');
    assert.strictEqual(capturedBody.receiptNo, '69090001');
    assert.strictEqual(capturedBody.status, 'ยกเลิก');
    assert.strictEqual(capturedBody.cancelReason, 'ยกเลิกเพราะพิมพ์ผิด');
    assert.strictEqual(res.success, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await itAsync('syncVoucherToGoogleSheets dispatches voucher correctly', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', action: 'insertedVoucher' })
      };
    };

    const res = await syncVoucherToGoogleSheets(
      { voucher_no: '69090001', doc_date: '2026-09-11', receiver_name: 'ทดสอบ' },
      {}
    );
    assert.strictEqual(capturedBody.action, 'saveVoucher');
    assert.strictEqual(capturedBody.voucherNo, '69090001');
    assert.strictEqual(res.success, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await itAsync('syncCancelVoucherToGoogleSheets dispatches voucher cancellation correctly', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', action: 'cancelledVoucher' })
      };
    };

    const res = await syncCancelVoucherToGoogleSheets('69090001', 'ยกเลิก voucher', {});
    assert.strictEqual(capturedBody.action, 'cancelVoucher');
    assert.strictEqual(capturedBody.voucherNo, '69090001');
    assert.strictEqual(capturedBody.status, 'ยกเลิก');
    assert.strictEqual(capturedBody.cancelReason, 'ยกเลิก voucher');
    assert.strictEqual(res.success, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log(`\n📊 Google Sheets Sync Test Results: ${passed} Passed, ${failed} Failed\n`);

if (failed > 0) {
  process.exit(1);
}
