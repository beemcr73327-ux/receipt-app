/**
 * Automated Database Backup & Disaster Recovery Service (Phase 3)
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 3 R2 Backup Engine)
 */

import { recordAuditLog } from './auditService.js';

/**
 * คำนวณ SHA-256 Checksum สำหรับตรวจสอบความสมบูรณ์ของ Snapshot
 * @param {string} str 
 * @returns {Promise<string>}
 */
export async function calculateSha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ดึงข้อมูลทุกตารางหลักและสร้าง JSON Database Snapshot พร้อม Checksum
 * @param {D1Database} db 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function createDatabaseSnapshot(db, options = {}) {
  const tablesToBackup = [
    'receipts',
    'vouchers',
    'rubber_purchases',
    'rubber_lots',
    'rubber_sales',
    'document_sequences',
    'audit_logs'
  ];

  const tables = {};
  const recordCounts = {};

  for (const table of tablesToBackup) {
    try {
      const query = `SELECT * FROM ${table} ORDER BY id ASC`;
      const res = await db.prepare(query).all();
      const records = res?.results || (Array.isArray(res) ? res : []);
      tables[table] = records;
      recordCounts[table] = records.length;
    } catch (err) {
      console.warn(`⚠️ Backup notice: Table '${table}' could not be queried (${err.message}). Storing empty list.`);
      tables[table] = [];
      recordCounts[table] = 0;
    }
  }

  const timestamp = new Date().toISOString();
  const rawPayload = {
    version: '5.0',
    phase: 'Phase 3 - Cloudflare R2 Automated Backup',
    organization: 'บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด',
    environment: options.environment || 'staging',
    timestamp,
    recordCounts,
    tables
  };

  const payloadString = JSON.stringify(rawPayload);
  const checksum = await calculateSha256(payloadString);

  return {
    ...rawPayload,
    checksumSha256: checksum
  };
}

/**
 * อัปโหลด Database Snapshot ขึ้น Cloudflare R2 Bucket
 * @param {R2Bucket} bucket 
 * @param {object} snapshot 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function uploadSnapshotToR2(bucket, snapshot, options = {}) {
  if (!bucket || typeof bucket.put !== 'function') {
    throw new Error('ไม่พบคลาวด์บัคเก็ต R2 (BACKUP_BUCKET is not configured or available)');
  }

  const now = new Date();
  const yyyymm = now.toISOString().substring(0, 7);
  const timeFormatted = now.toISOString().replace(/[:.]/g, '-');
  const uniqueSuffix = Math.random().toString(36).substring(2, 7);
  const backupKey = options.key || `backups/${yyyymm}/backup-${timeFormatted}-${uniqueSuffix}.json`;

  const content = JSON.stringify(snapshot, null, 2);
  const totalCount = Object.values(snapshot.recordCounts || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);

  // 1. จัดเก็บไฟล์ Snapshot หลัก
  await bucket.put(backupKey, content, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: {
      version: snapshot.version || '5.0',
      timestamp: snapshot.timestamp,
      checksum: snapshot.checksumSha256,
      totalRecords: String(totalCount)
    }
  });

  // 2. อัปเดต pointer ล่าสุดที่ backups/latest.json สำหรับ Disaster Recovery รวดเร็ว
  const latestMeta = {
    latestKey: backupKey,
    timestamp: snapshot.timestamp,
    checksum: snapshot.checksumSha256,
    recordCounts: snapshot.recordCounts,
    totalRecords: totalCount
  };

  await bucket.put('backups/latest.json', JSON.stringify(latestMeta, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });

  // 3. บันทึกประวัติใน Audit Logs
  if (options.db && typeof options.db.prepare === 'function') {
    try {
      await recordAuditLog(options.db, {
        actorEmail: options.actorEmail || 'system@srisuk-rubber.com',
        actorRole: options.actorRole || 'System',
        action: 'DATABASE_BACKUP_CREATED',
        resourceType: 'system_backup',
        resourceId: backupKey,
        details: {
          key: backupKey,
          checksum: snapshot.checksumSha256,
          totalRecords: totalCount,
          recordCounts: snapshot.recordCounts,
          sizeBytes: content.length
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Backup audit warning:', auditErr.message);
    }
  }

  return {
    success: true,
    key: backupKey,
    latestKey: 'backups/latest.json',
    sizeBytes: content.length,
    timestamp: snapshot.timestamp,
    checksum: snapshot.checksumSha256,
    recordCounts: snapshot.recordCounts,
    totalRecords: totalCount
  };
}

/**
 * ดึงรายการไฟล์สำรองข้อมูลย้อนหลังจาก Cloudflare R2
 * @param {R2Bucket} bucket 
 * @param {object} [options] 
 * @returns {Promise<Array<object>>}
 */
export async function listBackupsFromR2(bucket, options = {}) {
  if (!bucket || typeof bucket.list !== 'function') {
    return [];
  }

  const prefix = options.prefix || 'backups/';
  const limit = options.limit || 50;
  const listResult = await bucket.list({ prefix, limit });

  const objects = listResult?.objects || [];
  return objects
    .filter(obj => obj.key !== 'backups/latest.json')
    .map(obj => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      customMetadata: obj.customMetadata || {}
    }))
    .sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));
}

/**
 * ดึงข้อมูลสรุปการสำรองข้อมูลล่าสุด
 * @param {R2Bucket} bucket 
 * @returns {Promise<object | null>}
 */
export async function getLatestBackupMetadata(bucket) {
  if (!bucket || typeof bucket.get !== 'function') {
    return null;
  }

  try {
    const latestObj = await bucket.get('backups/latest.json');
    if (!latestObj) return null;
    const text = await latestObj.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn('⚠️ Failed to read backups/latest.json:', err.message);
    return null;
  }
}

/**
 * ตรวจสอบความถูกต้องสมบูรณ์ของ Snapshot (Integrity Check)
 * @param {string | object} snapshotInput 
 * @returns {Promise<{ valid: boolean, calculatedChecksum: string, statedChecksum: string, error?: string }>}
 */
export async function inspectSnapshot(snapshotInput) {
  try {
    const snapshot = typeof snapshotInput === 'string' ? JSON.parse(snapshotInput) : snapshotInput;
    const { checksumSha256, ...dataWithoutChecksum } = snapshot;

    if (!checksumSha256) {
      return { valid: false, calculatedChecksum: '', statedChecksum: '', error: 'Snapshot does not contain checksumSha256' };
    }

    const recalculated = await calculateSha256(JSON.stringify(dataWithoutChecksum));
    const valid = recalculated === checksumSha256;

    return {
      valid,
      calculatedChecksum: recalculated,
      statedChecksum: checksumSha256,
      error: valid ? undefined : 'Checksum mismatch: data may be corrupted or modified'
    };
  } catch (err) {
    return { valid: false, calculatedChecksum: '', statedChecksum: '', error: err.message };
  }
}
