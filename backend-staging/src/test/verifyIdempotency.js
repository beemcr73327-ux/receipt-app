/**
 * Verification Test for Idempotency Guard
 * Phase 0.3 - Prevents Duplicate Mutations & Replays
 */

import { hashPayload, handleWithIdempotency } from '../middleware/idempotency.js';

async function runTests() {
  console.log('🧪 Starting Idempotency Guard Engine Logic Tests...\n');
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

  // 1. Test Hash Payload Consistency
  const payloadA = { docType: 'receipt', customer: 'นาย ก' };
  const payloadACopy = { docType: 'receipt', customer: 'นาย ก' };
  const payloadB = { docType: 'receipt', customer: 'นาย ข' };

  const hashA1 = await hashPayload(payloadA);
  const hashA2 = await hashPayload(payloadACopy);
  const hashB = await hashPayload(payloadB);

  assertEqual(hashA1 === hashA2, true, 'Identical payloads must produce identical SHA-256 hashes');
  assertEqual(hashA1 !== hashB, true, 'Different payloads must produce different hashes');
  assertEqual(hashA1.length, 64, 'SHA-256 hash must be 64 characters long hex string');

  // 2. Mock D1 Database for Idempotency Storage
  const mockIdempotencyTable = new Map();

  const mockDb = {
    prepare(sql) {
      let boundParams = [];
      return {
        bind(...params) {
          boundParams = params;
          return this;
        },
        async first() {
          if (sql.includes('SELECT')) {
            const key = boundParams[0];
            return mockIdempotencyTable.get(key) || null;
          }
          return null;
        },
        async run() {
          if (sql.includes('INSERT')) {
            const [key, endpoint, request_hash, response_body, status_code] = boundParams;
            mockIdempotencyTable.set(key, {
              key,
              endpoint,
              request_hash,
              response_body,
              status_code,
              created_at: new Date().toISOString()
            });
            return { success: true };
          }
          return { success: true };
        }
      };
    }
  };

  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
  let handlerInvocationCount = 0;

  // Mock handler simulating receipt creation
  const mockCreateHandler = async (body, key) => {
    handlerInvocationCount++;
    return new Response(JSON.stringify({
      status: 'success',
      docNo: `6909000${handlerInvocationCount}`,
      received: body
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  function createMockRequest(url, method, headers, bodyObj) {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : '';
    return new Request(url, {
      method,
      headers: new Headers(headers),
      body: bodyStr || undefined
    });
  }

  // 3. First Submission (Fresh Key)
  handlerInvocationCount = 0;
  const key1 = '550e8400-e29b-41d4-a716-446655440000';
  const req1 = createMockRequest(
    'http://localhost/api/v1/sequence/next',
    'POST',
    { 'X-Idempotency-Key': key1, 'Content-Type': 'application/json' },
    { docType: 'receipt' }
  );

  const res1 = await handleWithIdempotency(mockDb, req1, corsHeaders, mockCreateHandler);
  const data1 = await res1.json();

  assertEqual(res1.status, 200, 'First request with fresh key returns HTTP 200');
  assertEqual(handlerInvocationCount, 1, 'Handler was called exactly once on first request');
  assertEqual(data1.docNo, '69090001', 'First request received document 69090001');

  // 4. Duplicate Submission (Same Key, Same Body) -> Cache Hit!
  const req2 = createMockRequest(
    'http://localhost/api/v1/sequence/next',
    'POST',
    { 'X-Idempotency-Key': key1, 'Content-Type': 'application/json' },
    { docType: 'receipt' }
  );

  const res2 = await handleWithIdempotency(mockDb, req2, corsHeaders, mockCreateHandler);
  const data2 = await res2.json();

  assertEqual(res2.status, 200, 'Duplicate request returns HTTP 200');
  assertEqual(handlerInvocationCount, 1, 'Duplicate request DID NOT re-run handler (prevented double billing!)');
  assertEqual(data2.docNo, '69090001', 'Duplicate request returns original document number 69090001');
  assertEqual(data2._idempotent, true, 'Duplicate response is flagged with _idempotent: true');
  assertEqual(res2.headers.get('X-Idempotency-Cached'), 'HIT', 'Duplicate response has X-Idempotency-Cached: HIT');

  // 5. Duplicate Key with DIFFERENT Body -> 409 Conflict Error
  const req3 = createMockRequest(
    'http://localhost/api/v1/sequence/next',
    'POST',
    { 'X-Idempotency-Key': key1, 'Content-Type': 'application/json' },
    { docType: 'voucher' } // Different payload!
  );

  const res3 = await handleWithIdempotency(mockDb, req3, corsHeaders, mockCreateHandler);
  const data3 = await res3.json();

  assertEqual(res3.status, 409, 'Key reused with different payload returns HTTP 409 Conflict');
  assertEqual(data3.code, 'IDEMPOTENCY_PAYLOAD_MISMATCH', 'Error code indicates IDEMPOTENCY_PAYLOAD_MISMATCH');
  assertEqual(handlerInvocationCount, 1, 'Handler was NOT called on payload mismatch');

  // 6. Request WITHOUT Idempotency Key -> Always executes
  const reqNoKey1 = createMockRequest(
    'http://localhost/api/v1/sequence/next',
    'POST',
    { 'Content-Type': 'application/json' },
    { docType: 'receipt' }
  );
  const reqNoKey2 = createMockRequest(
    'http://localhost/api/v1/sequence/next',
    'POST',
    { 'Content-Type': 'application/json' },
    { docType: 'receipt' }
  );

  await handleWithIdempotency(mockDb, reqNoKey1, corsHeaders, mockCreateHandler);
  await handleWithIdempotency(mockDb, reqNoKey2, corsHeaders, mockCreateHandler);

  assertEqual(handlerInvocationCount, 3, 'Requests without Idempotency Key execute each time (count increased to 3)');

  console.log(`\n📊 Idempotency Test Results: ${passed} Passed, ${failed} Failed`);
}

runTests().catch(console.error);
