/**
 * System Health & Observability Service (Phase 3)
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 3 Enterprise Observability)
 */

import { getLatestBackupMetadata } from './backupService.js';

/**
 * ดึงรายงานสุขภาพระบบเชิงลึก (Deep Health Check & System Diagnostics)
 * @param {object} env - Cloudflare Worker Environment (env.DB, env.BACKUP_BUCKET, etc.)
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function getDetailedSystemHealth(env, options = {}) {
  const timestamp = new Date().toISOString();
  let overallStatus = 'HEALTHY';

  // 1. ตรวจสอบสถานะและความหน่วงของ Cloudflare D1 Database
  let d1Health = { status: 'HEALTHY', latencyMs: 0 };
  const d1Start = Date.now();
  try {
    if (!env?.DB) {
      throw new Error('D1 Database binding (env.DB) is missing');
    }
    await env.DB.prepare('SELECT 1 AS ping;').first();
    d1Health.latencyMs = Date.now() - d1Start;
  } catch (err) {
    overallStatus = 'UNHEALTHY';
    d1Health = {
      status: 'UNHEALTHY',
      latencyMs: Date.now() - d1Start,
      error: err.message
    };
  }

  // 2. ตรวจสอบจำนวนข้อมูลในแต่ละตารางหลัก
  const recordCounts = {};
  const tables = [
    'receipts',
    'vouchers',
    'rubber_purchases',
    'rubber_lots',
    'rubber_sales',
    'document_sequences',
    'audit_logs'
  ];

  if (d1Health.status === 'HEALTHY') {
    for (const table of tables) {
      try {
        const countRes = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table};`).first();
        recordCounts[table] = countRes?.total ?? 0;
      } catch {
        recordCounts[table] = 0;
      }
    }
  }

  // 3. ตรวจสอบสถานะ Cloudflare R2 Backup Bucket
  let r2Health = { status: 'HEALTHY', configured: true };
  let latestBackup = null;
  if (!env?.BACKUP_BUCKET) {
    r2Health = { status: 'NOT_CONFIGURED', configured: false, note: 'R2 bucket binding is not bound' };
  } else {
    try {
      latestBackup = await getLatestBackupMetadata(env.BACKUP_BUCKET);
      r2Health.latestBackupKey = latestBackup?.latestKey || null;
      r2Health.lastBackupTime = latestBackup?.timestamp || null;
      r2Health.totalBackedUpRecords = latestBackup?.totalRecords ?? null;
    } catch (r2Err) {
      r2Health.status = 'DEGRADED';
      r2Health.error = r2Err.message;
    }
  }

  // 4. ตรวจสอบสถานะการเชื่อมต่อ Google Sheets Webhook
  const sheetsWebhookConfigured = Boolean(env?.GOOGLE_SHEETS_WEBHOOK && String(env.GOOGLE_SHEETS_WEBHOOK).startsWith('http'));

  return {
    status: overallStatus,
    timestamp,
    environment: env?.ENVIRONMENT || 'staging',
    version: '5.0',
    phase: 'Phase 3 - Automated R2 Backup & Monitoring',
    organization: 'บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด',
    components: {
      d1Database: d1Health,
      r2Storage: r2Health,
      googleSheetsIntegration: {
        configured: sheetsWebhookConfigured,
        webhookUrlMasked: sheetsWebhookConfigured ? `${env.GOOGLE_SHEETS_WEBHOOK.substring(0, 45)}...` : null
      }
    },
    metrics: {
      recordCounts,
      totalBusinessDocuments: (recordCounts.receipts || 0) + (recordCounts.vouchers || 0) + (recordCounts.rubber_purchases || 0) + (recordCounts.rubber_sales || 0)
    }
  };
}
