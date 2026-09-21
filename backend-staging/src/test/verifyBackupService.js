/**
 * Verification Tests for Automated Database Backup & Disaster Recovery (Phase 3)
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

import {
  calculateSha256,
  createDatabaseSnapshot,
  uploadSnapshotToR2,
  listBackupsFromR2,
  getLatestBackupMetadata,
  inspectSnapshot
} from '../services/backupService.js';

async function runTests() {
  console.log('🧪 Starting Phase 3: Automated Database Backup & R2 Storage Tests...\n');
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, testName) {
    if (actual === expected) {
      console.log(`✅ PASS: ${testName} (Actual: ${actual})`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} (Expected: ${expected}, Got: ${actual})`);
      failed++;
    }
  }

  function assertTrue(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // ==========================================
  // Section 1: SHA-256 Checksum Calculation
  // ==========================================
  console.log('--- Section 1: Cryptographic Checksum Engine ---');

  const testStr = 'บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด';
  const hash1 = await calculateSha256(testStr);
  const hash2 = await calculateSha256(testStr);

  assertEqual(hash1, hash2, 'SHA-256 should be deterministic for identical input');
  assertEqual(hash1.length, 64, 'SHA-256 hex output should be 64 characters long');
  assertTrue(/^[0-9a-f]{64}$/.test(hash1), 'Hash should consist of lowercase hexadecimal characters');

  // ==========================================
  // Section 2: Mock D1 & Snapshot Creation
  // ==========================================
  console.log('\n--- Section 2: D1 Database Snapshot Creation ---');

  const mockDbData = {
    receipts: [
      { id: 1, receipt_no: 'RC-69090001', customer_name: 'สมชาย ใจดี', total_amount: 15000 },
      { id: 2, receipt_no: 'RC-69090002', customer_name: 'วิชัย ปลูกยาง', total_amount: 25000 }
    ],
    vouchers: [
      { id: 1, voucher_no: 'PV-69090001', payee_name: 'การไฟฟ้าส่วนภูมิภาค', total_amount: 3500 }
    ],
    rubber_purchases: [
      { id: 1, ticket_no: 'PB-69090001', seller_name: 'สมชาย ใจดี', weight_kg: 1000, total_amount: 25000 },
      { id: 2, ticket_no: 'PB-69090002', seller_name: 'แดง ทองคำ', weight_kg: 1500, total_amount: 37500 }
    ],
    rubber_lots: [
      { id: 1, lot_no: 'LOT-69090001', lot_name: 'สมชาย ใจดี, แดง ทองคำ', lot_date: '2026-09-21', status: 'LOCKED' }
    ],
    rubber_sales: [
      { id: 1, sale_no: 'SL-69090001', ref_lot_no: 'LOT-69090001', sale_date: '2026-09-21', status: 'PENDING' }
    ],
    document_sequences: [
      { id: 1, doc_type: 'receipt', prefix: '6909', current_seq: 2 }
    ],
    audit_logs: [
      { id: 1, action: 'CREATE_RECEIPT', resource_id: 'RC-69090001' }
    ]
  };

  const mockDb = {
    prepare(sql) {
      return {
        bind() { return this; },
        async all() {
          for (const tableName of Object.keys(mockDbData)) {
            if (sql.includes(`FROM ${tableName}`)) {
              return { results: mockDbData[tableName] };
            }
          }
          return { results: [] };
        },
        async first() {
          return { success: true };
        },
        async run() {
          return { success: true };
        }
      };
    }
  };

  const snapshot = await createDatabaseSnapshot(mockDb, { environment: 'staging' });

  assertEqual(snapshot.version, '5.0', 'Snapshot version should be 5.0');
  assertEqual(snapshot.recordCounts.receipts, 2, 'Snapshot contains 2 receipts');
  assertEqual(snapshot.recordCounts.vouchers, 1, 'Snapshot contains 1 voucher');
  assertEqual(snapshot.recordCounts.rubber_purchases, 2, 'Snapshot contains 2 rubber purchases');
  assertEqual(snapshot.recordCounts.rubber_lots, 1, 'Snapshot contains 1 rubber lot');
  assertEqual(snapshot.recordCounts.rubber_sales, 1, 'Snapshot contains 1 rubber sale');
  assertTrue(!!snapshot.checksumSha256, 'Snapshot contains SHA-256 checksum');

  // ==========================================
  // Section 3: Snapshot Integrity Inspection
  // ==========================================
  console.log('\n--- Section 3: Snapshot Integrity Verification ---');

  const validInspection = await inspectSnapshot(snapshot);
  assertTrue(validInspection.valid, 'Authentic snapshot should pass integrity check');
  assertEqual(validInspection.calculatedChecksum, snapshot.checksumSha256, 'Calculated checksum matches stated checksum');

  // Tamper with snapshot data
  const tamperedSnapshot = JSON.parse(JSON.stringify(snapshot));
  tamperedSnapshot.tables.receipts[0].total_amount = 9999999;
  const tamperedInspection = await inspectSnapshot(tamperedSnapshot);
  assertTrue(!tamperedInspection.valid, 'Tampered snapshot should fail integrity check');
  assertTrue(tamperedInspection.calculatedChecksum !== tamperedSnapshot.checksumSha256, 'Checksum mismatch detected upon tampering');

  // ==========================================
  // Section 4: Cloudflare R2 Upload & Pointers
  // ==========================================
  console.log('\n--- Section 4: Cloudflare R2 Storage Operations ---');

  const r2Storage = new Map();
  const mockR2Bucket = {
    async put(key, content, options = {}) {
      r2Storage.set(key, {
        content: typeof content === 'string' ? content : JSON.stringify(content),
        size: (typeof content === 'string' ? content : JSON.stringify(content)).length,
        uploaded: new Date().toISOString(),
        customMetadata: options.customMetadata || {}
      });
      return { key };
    },
    async get(key) {
      const item = r2Storage.get(key);
      if (!item) return null;
      return {
        key,
        size: item.size,
        text: () => Promise.resolve(item.content),
        customMetadata: item.customMetadata
      };
    },
    async list(options = {}) {
      const prefix = options.prefix || '';
      const objects = [];
      for (const [key, val] of r2Storage.entries()) {
        if (key.startsWith(prefix)) {
          objects.push({
            key,
            size: val.size,
            uploaded: val.uploaded,
            customMetadata: val.customMetadata
          });
        }
      }
      return { objects };
    }
  };

  const uploadResult = await uploadSnapshotToR2(mockR2Bucket, snapshot, { db: mockDb });

  assertTrue(uploadResult.success, 'Upload returns success: true');
  assertTrue(uploadResult.key.startsWith('backups/'), `Backup key is in backups/ path (Got: ${uploadResult.key})`);
  assertTrue(r2Storage.has(uploadResult.key), 'Snapshot file is stored in R2 bucket');
  assertTrue(r2Storage.has('backups/latest.json'), 'Latest pointer backups/latest.json is updated in R2');

  const latestMeta = await getLatestBackupMetadata(mockR2Bucket);
  assertTrue(!!latestMeta, 'Latest metadata is retrievable');
  assertEqual(latestMeta.latestKey, uploadResult.key, 'Latest metadata points to correct backup key');
  assertEqual(latestMeta.checksum, snapshot.checksumSha256, 'Latest metadata contains matching checksum');

  // ==========================================
  // Section 5: List Backups
  // ==========================================
  console.log('\n--- Section 5: R2 Listing & Safeguards ---');

  // Upload a second backup with a different timestamp
  const snapshot2 = await createDatabaseSnapshot(mockDb, { environment: 'staging' });
  await uploadSnapshotToR2(mockR2Bucket, snapshot2, { db: mockDb });

  const backupsList = await listBackupsFromR2(mockR2Bucket);
  assertEqual(backupsList.length, 2, 'R2 listing should return 2 backup files (excluding latest.json)');

  // Missing bucket safeguard
  try {
    await uploadSnapshotToR2(null, snapshot);
    console.error('❌ FAIL: Should throw when bucket is null');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('BACKUP_BUCKET'), 'Rejects upload when BACKUP_BUCKET is missing');
  }

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n==========================================');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('==========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('💥 Test Execution Error:', err);
  process.exit(1);
});
