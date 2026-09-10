/**
 * Verification Test for Immutable Audit Logging Service
 * Phase 0.4 - Hash Chaining & Tamper Detection
 */

import {
  computeRecordHash,
  recordAuditLog,
  verifyChainIntegrity,
  getAuditLogs
} from '../services/auditService.js';

async function runTests() {
  console.log('🧪 Starting Immutable Audit Logging Logic Tests...\n');
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

  // 1. Test Hash Generation
  const hash1 = await computeRecordHash('0', 'cashier1@srisuk.com', 'Cashier', 'CREATE', 'receipt', '69090001', '{}', '2026-09-10T10:00:00.000Z');
  const hash2 = await computeRecordHash('0', 'cashier1@srisuk.com', 'Cashier', 'CREATE', 'receipt', '69090001', '{}', '2026-09-10T10:00:00.000Z');
  const hashDifferent = await computeRecordHash('0', 'cashier1@srisuk.com', 'Cashier', 'CREATE', 'receipt', '69090002', '{}', '2026-09-10T10:00:00.000Z');

  assertEqual(hash1 === hash2, true, 'Deterministic SHA-256 hash generation');
  assertEqual(hash1 !== hashDifferent, true, 'Hash changes when resource ID changes');
  assertEqual(hash1.length, 64, 'Record hash is 64 hex characters');

  // 2. Mock D1 Database for Audit Logs
  const mockTable = [];
  let autoIncrementId = 1;

  const mockDb = {
    prepare(sql) {
      let boundParams = [];
      return {
        bind(...params) {
          boundParams = params;
          return this;
        },
        async first() {
          if (sql.includes('SELECT id, record_hash FROM audit_logs ORDER BY id DESC LIMIT 1')) {
            if (mockTable.length === 0) return null;
            const last = mockTable[mockTable.length - 1];
            return { id: last.id, record_hash: last.record_hash };
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            const [
              prev_hash, record_hash, actor_email, actor_role,
              action, resource_type, resource_id, details_json, ip_address, created_at
            ] = boundParams;
            const record = {
              id: autoIncrementId++,
              prev_hash,
              record_hash,
              actor_email,
              actor_role,
              action,
              resource_type,
              resource_id,
              details_json,
              ip_address,
              created_at
            };
            mockTable.push(record);
            return record;
          }
          if (sql.includes('COUNT(*)')) {
            return { total: mockTable.length };
          }
          return null;
        },
        async all() {
          if (sql.includes('ORDER BY id ASC')) {
            return { results: [...mockTable] };
          }
          if (sql.includes('ORDER BY id DESC')) {
            return { results: [...mockTable].reverse() };
          }
          return { results: [] };
        }
      };
    }
  };

  // 3. Test Genesis Record (First entry in database)
  const log1 = await recordAuditLog(mockDb, {
    actorEmail: 'cashier@srisuk-rubber.com',
    actorRole: 'Cashier',
    action: 'CREATE_RECEIPT',
    resourceType: 'receipt',
    resourceId: '69090001',
    details: { totalAmount: 150000, customer: 'นาย สมชาย' }
  });

  assertEqual(log1.prev_hash, '0', 'Genesis record has prev_hash = "0"');
  assertEqual(log1.id, 1, 'First record assigned ID = 1');
  assertEqual(typeof log1.record_hash, 'string', 'First record has valid record_hash');

  // 4. Test Second Record (Chained to first record)
  const log2 = await recordAuditLog(mockDb, {
    actorEmail: 'cashier@srisuk-rubber.com',
    actorRole: 'Cashier',
    action: 'CREATE_RECEIPT',
    resourceType: 'receipt',
    resourceId: '69090002',
    details: { totalAmount: 220000, customer: 'นาง สมหญิง' }
  });

  assertEqual(log2.prev_hash, log1.record_hash, 'Second record prev_hash links exactly to first record hash');
  assertEqual(log2.id, 2, 'Second record assigned ID = 2');

  // 5. Test Third Record (Sensitive Admin Seed Action)
  const log3 = await recordAuditLog(mockDb, {
    actorEmail: 'admin@srisuk-rubber.com',
    actorRole: 'Admin',
    action: 'SET_MANUAL_SEED',
    resourceType: 'sequence',
    resourceId: 'receipt:6909',
    details: { previousSeq: 2, newSeed: 500 }
  });

  assertEqual(log3.prev_hash, log2.record_hash, 'Third record chains to second record');

  // 6. Verify Uncompromised Chain Integrity
  const integrityBefore = await verifyChainIntegrity(mockDb);
  assertEqual(integrityBefore.isValid, true, 'Uncompromised chain passes integrity check');
  assertEqual(integrityBefore.verifiedCount, 3, 'Integrity check verified all 3 records');

  // 7. Test Tamper Detection: Case A (Content modified in database)
  // Simulate an unauthorized person modifying details in Record 2 directly in DB
  const originalDetails = mockTable[1].details_json;
  mockTable[1].details_json = JSON.stringify({ totalAmount: 50000 }); // changed 220000 to 50000!

  const integrityTampered = await verifyChainIntegrity(mockDb);
  assertEqual(integrityTampered.isValid, false, 'Tampered data is detected as INVALID');
  assertEqual(integrityTampered.corruptedAtId, 2, 'Tamper detection points exactly to corrupted record ID 2');
  assertEqual(integrityTampered.reason, 'TAMPERED_RECORD_DATA', 'Detection reason is TAMPERED_RECORD_DATA');

  // Restore content
  mockTable[1].details_json = originalDetails;
  const integrityRestored = await verifyChainIntegrity(mockDb);
  assertEqual(integrityRestored.isValid, true, 'Restored chain passes integrity check again');

  // 8. Test Tamper Detection: Case B (Record deleted / broken link)
  // Simulate attacker modifying prev_hash of record 3
  const originalPrevHash = mockTable[2].prev_hash;
  mockTable[2].prev_hash = 'fake_tampered_prev_hash_123';

  const integrityBrokenLink = await verifyChainIntegrity(mockDb);
  assertEqual(integrityBrokenLink.isValid, false, 'Broken chain link detected as INVALID');
  assertEqual(integrityBrokenLink.corruptedAtId, 3, 'Broken link detected at record ID 3');
  assertEqual(integrityBrokenLink.reason, 'BROKEN_CHAIN_LINK', 'Detection reason is BROKEN_CHAIN_LINK');

  // Restore link
  mockTable[2].prev_hash = originalPrevHash;

  // 9. Test Query & Pagination
  const queryResult = await getAuditLogs(mockDb, { page: 1, pageSize: 10 });
  assertEqual(queryResult.total, 3, 'Query reports total 3 audit records');
  assertEqual(queryResult.logs.length, 3, 'Query returns all 3 logs');

  console.log(`\n📊 Audit Log Test Results: ${passed} Passed, ${failed} Failed`);
}

runTests().catch(console.error);
