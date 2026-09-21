/**
 * Verification Tests for System Health & Observability Engine (Phase 3)
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

import { getDetailedSystemHealth } from '../services/systemHealthService.js';
import worker from '../index.js';

async function runTests() {
  console.log('🧪 Starting Phase 3: System Health & Observability Tests...\n');
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
  // Section 1: Deep Health Check Functionality
  // ==========================================
  console.log('--- Section 1: Detailed Health Diagnostics ---');

  const mockDbData = {
    receipts: [{ id: 1 }, { id: 2 }],
    vouchers: [{ id: 1 }],
    rubber_purchases: [{ id: 1 }, { id: 2 }, { id: 3 }],
    rubber_lots: [{ id: 1 }],
    rubber_sales: [{ id: 1 }],
    document_sequences: [{ id: 1 }],
    audit_logs: [{ id: 1 }, { id: 2 }]
  };

  const mockDb = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('SELECT 1')) return { ping: 1 };
          for (const t of Object.keys(mockDbData)) {
            if (sql.includes(`FROM ${t}`)) {
              return { total: mockDbData[t].length };
            }
          }
          return { total: 0 };
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        }
      };
    }
  };

  const r2Storage = new Map();
  const mockR2 = {
    async get(key) {
      if (key === 'backups/latest.json') {
        return {
          text: () => Promise.resolve(JSON.stringify({
            latestKey: 'backups/2026-09/backup-01.json',
            timestamp: '2026-09-21T15:00:00.000Z',
            totalRecords: 10
          }))
        };
      }
      return null;
    },
    async put(key, content) {
      r2Storage.set(key, content);
      return { key };
    },
    async list() {
      return { objects: [{ key: 'backups/2026-09/backup-01.json', size: 1024, uploaded: new Date().toISOString() }] };
    }
  };

  const healthyEnv = {
    DB: mockDb,
    BACKUP_BUCKET: mockR2,
    ENVIRONMENT: 'staging',
    GOOGLE_SHEETS_WEBHOOK: 'https://script.google.com/macros/s/AKfycbyg/exec'
  };

  const healthReport = await getDetailedSystemHealth(healthyEnv);
  assertEqual(healthReport.status, 'HEALTHY', 'Overall system status is HEALTHY');
  assertEqual(healthReport.components.d1Database.status, 'HEALTHY', 'D1 database status is HEALTHY');
  assertTrue(healthReport.components.d1Database.latencyMs >= 0, 'D1 latency is measured in milliseconds');
  assertEqual(healthReport.components.r2Storage.status, 'HEALTHY', 'R2 backup storage is HEALTHY');
  assertEqual(healthReport.components.r2Storage.latestBackupKey, 'backups/2026-09/backup-01.json', 'Reports latest backup key');
  assertTrue(healthReport.components.googleSheetsIntegration.configured, 'Google Sheets Webhook is configured');
  assertEqual(healthReport.metrics.recordCounts.rubber_purchases, 3, 'Counts rubber purchases correctly');
  assertEqual(healthReport.metrics.totalBusinessDocuments, 7, 'Calculates total business documents (2+1+3+1 = 7)');

  // Test 1.2: Unhealthy D1
  const failingDb = {
    prepare() {
      return {
        async first() { throw new Error('D1 Connection timeout'); }
      };
    }
  };
  const unhealthyEnv = { ...healthyEnv, DB: failingDb };
  const unhealthyReport = await getDetailedSystemHealth(unhealthyEnv);
  assertEqual(unhealthyReport.status, 'UNHEALTHY', 'Overall status is UNHEALTHY when D1 fails');
  assertEqual(unhealthyReport.components.d1Database.status, 'UNHEALTHY', 'D1 component status is UNHEALTHY');
  assertTrue(unhealthyReport.components.d1Database.error.includes('D1 Connection timeout'), 'Captures D1 failure error message');

  // ==========================================
  // Section 2: Worker HTTP Endpoints
  // ==========================================
  console.log('\n--- Section 2: Worker Phase 3 HTTP Endpoints ---');

  // 2.1 GET /api/v1/system/health
  const reqHealth = new Request('http://localhost/api/v1/system/health', { method: 'GET' });
  const resHealth = await worker.fetch(reqHealth, healthyEnv, {});
  assertEqual(resHealth.status, 200, 'GET /api/v1/system/health returns 200 OK');
  const jsonHealth = await resHealth.json();
  assertEqual(jsonHealth.status, 'HEALTHY', 'Response JSON contains HEALTHY status');

  // 2.2 POST /api/v1/backup/trigger
  const reqBackupTrigger = new Request('http://localhost/api/v1/backup/trigger', {
    method: 'POST',
    headers: { 'X-User-Email': 'admin@srisuk.com' }
  });
  const resBackup = await worker.fetch(reqBackupTrigger, healthyEnv, {});
  assertEqual(resBackup.status, 200, 'POST /api/v1/backup/trigger returns 200 OK');
  const jsonBackup = await resBackup.json();
  assertTrue(jsonBackup.data.success, 'Backup execution returned success');
  assertTrue(jsonBackup.data.key.startsWith('backups/'), 'Backup file stored in backups/');

  // 2.3 GET /api/v1/backup/latest
  const reqLatest = new Request('http://localhost/api/v1/backup/latest', { method: 'GET' });
  const resLatest = await worker.fetch(reqLatest, healthyEnv, {});
  assertEqual(resLatest.status, 200, 'GET /api/v1/backup/latest returns 200 OK');
  const jsonLatest = await resLatest.json();
  assertTrue(!!jsonLatest.data.latestKey, 'Returns latest backup key');

  // 2.4 GET /api/v1/backup/list
  const reqList = new Request('http://localhost/api/v1/backup/list', { method: 'GET' });
  const resList = await worker.fetch(reqList, healthyEnv, {});
  assertEqual(resList.status, 200, 'GET /api/v1/backup/list returns 200 OK');
  const jsonList = await resList.json();
  assertTrue(Array.isArray(jsonList.data), 'Returns backup list array');

  // ==========================================
  // Section 3: Worker Scheduled Cron Handler
  // ==========================================
  console.log('\n--- Section 3: Worker Scheduled Cron Trigger ---');

  let cronSuccess = false;
  try {
    await worker.scheduled({ cron: '0 18 * * *' }, healthyEnv, {});
    cronSuccess = true;
  } catch (e) {
    console.error('Scheduled error:', e);
  }
  assertTrue(cronSuccess, 'worker.scheduled runs daily backup without error');

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
