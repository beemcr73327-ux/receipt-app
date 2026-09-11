/**
 * Unit Tests for Frontend Staging API Client (Phase 1.3)
 * Run with: node backend-staging/src/test/verifyStagingClient.js
 */

import assert from 'node:assert';
import {
  DEFAULT_STAGING_API_URL,
  generateUUID,
  cleanApiUrl,
  checkStagingHealth,
  createReceiptStaging,
  cancelReceiptStaging,
  createVoucherStaging,
  cancelVoucherStaging
} from '../../../src/services/stagingApiClient.js';

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

console.log('🧪 Starting Frontend Staging Client Logic Tests (Phase 1.3)...\n');

// 1. UUID Generation Tests
it('generateUUID creates a valid UUIDv4 string', () => {
  const uuid = generateUUID();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(uuid, uuidRegex);
});

it('generateUUID produces unique IDs across multiple calls', () => {
  const u1 = generateUUID();
  const u2 = generateUUID();
  assert.notStrictEqual(u1, u2);
});

// 2. URL Cleaning Tests
it('cleanApiUrl removes trailing slashes properly', () => {
  assert.strictEqual(cleanApiUrl('http://localhost:8787///'), 'http://localhost:8787');
  assert.strictEqual(cleanApiUrl('https://my-worker.workers.dev/'), 'https://my-worker.workers.dev');
  assert.strictEqual(cleanApiUrl(''), DEFAULT_STAGING_API_URL);
  assert.strictEqual(cleanApiUrl(null), DEFAULT_STAGING_API_URL);
});

// 3. Health Check Tests
await itAsync('checkStagingHealth handles online response', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      assert.strictEqual(url, 'http://localhost:8787/health');
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'online', phase: 'Phase 1.2' })
      };
    };

    const res = await checkStagingHealth('http://localhost:8787');
    assert.strictEqual(res.online, true);
    assert.strictEqual(res.data.status, 'online');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// 4. Create Receipt Tests
await itAsync('createReceiptStaging injects X-Idempotency-Key and formats payload', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedHeaders = null;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      assert.strictEqual(url, 'http://localhost:8787/api/v1/receipts');
      assert.strictEqual(options.method, 'POST');
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);

      return {
        ok: true,
        status: 201,
        headers: new Headers({ 'X-Idempotency-Cached': 'MISS' }),
        json: async () => ({
          status: 'success',
          data: { receipt_no: '69090001', buyer_name: capturedBody.buyerName, totalNetAmount: 20500 }
        })
      };
    };

    const receiptInput = {
      docDate: '2026-09-11',
      buyerName: 'นายประสิทธิ์ ยางทอง',
      buyerTaxId: '1234567890123',
      items: [
        { itemTitle: 'ยางก้อนถ้วย', quantity: 1000, unitPrice: 65, drc: '32%', discountAmount: 300 }
      ]
    };

    const res = await createReceiptStaging(receiptInput, 'http://localhost:8787');

    assert.ok(capturedHeaders['X-Idempotency-Key'], 'Must have X-Idempotency-Key header');
    assert.strictEqual(capturedBody.buyerName, 'นายประสิทธิ์ ยางทอง');
    assert.strictEqual(capturedBody.items[0].drcPercent, 32);
    assert.strictEqual(res.receipt_no, '69090001');
    assert.strictEqual(res._cached, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// 5. Cancel Receipt Tests
await itAsync('cancelReceiptStaging calls cancel endpoint with reason', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl = '';
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ status: 'success', data: { receipt_no: '69090001', status: 'ยกเลิก' } })
      };
    };

    const res = await cancelReceiptStaging('69090001', 'คำนวณผิด', 'http://localhost:8787');
    assert.strictEqual(capturedUrl, 'http://localhost:8787/api/v1/receipts/69090001/cancel');
    assert.strictEqual(capturedBody.reason, 'คำนวณผิด');
    assert.strictEqual(res.status, 'ยกเลิก');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// 6. Create Voucher Tests
await itAsync('createVoucherStaging injects Idempotency Key and formats voucher payload', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      assert.strictEqual(url, 'http://localhost:8787/api/v1/vouchers');
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => ({
          status: 'success',
          data: { voucher_no: '69090001', receiver_name: capturedBody.receiverName, totalAmount: 100000 }
        })
      };
    };

    const voucherInput = {
      docDate: '2026-09-11',
      receiverName: 'นางสาวมาลี รักษ์สวน',
      overallDescription: 'จ่ายค่าปุ๋ย',
      items: [
        { description: 'ปุ๋ยเคมี', amount: 85000 },
        { description: 'กรดฟอร์มิก', amount: 15000 }
      ]
    };

    const res = await createVoucherStaging(voucherInput, 'http://localhost:8787');
    assert.strictEqual(capturedBody.receiverName, 'นางสาวมาลี รักษ์สวน');
    assert.strictEqual(capturedBody.items.length, 2);
    assert.strictEqual(res.voucher_no, '69090001');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// 7. Cancel Voucher Tests
await itAsync('cancelVoucherStaging calls voucher cancel endpoint', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ status: 'success', data: { voucher_no: '69090001', status: 'ยกเลิก' } })
      };
    };

    const res = await cancelVoucherStaging('69090001', 'ยกเลิกจ่ายเงิน', 'http://localhost:8787');
    assert.strictEqual(capturedUrl, 'http://localhost:8787/api/v1/vouchers/69090001/cancel');
    assert.strictEqual(res.status, 'ยกเลิก');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log(`\n📊 Staging Client Test Results: ${passed} Passed, ${failed} Failed\n`);

if (failed > 0) {
  process.exit(1);
}
