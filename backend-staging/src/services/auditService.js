/**
 * Immutable Audit Logging Service
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Phase: 0.4 - Blockchain-like Hash Chaining for Tamper-Proof Financial Audit Trail
 */

/**
 * Computes SHA-256 hash across audit record components
 * @param {string} prevHash - Previous record's hash (or '0' for genesis)
 * @param {string} actorEmail - User/Cashier email
 * @param {string} actorRole - User role (Admin, Cashier, etc.)
 * @param {string} action - Action verb (e.g. CREATE_RECEIPT, CANCEL_RECEIPT, SEED_SEQUENCE)
 * @param {string} resourceType - Type of entity (receipt, voucher, lot, sequence)
 * @param {string} resourceId - Unique ID of entity (e.g. 69090001)
 * @param {string} detailsJson - Serialized JSON details
 * @param {string} timestamp - ISO timestamp
 * @returns {Promise<string>} 64-character SHA-256 Hex string
 */
export async function computeRecordHash(prevHash, actorEmail, actorRole, action, resourceType, resourceId, detailsJson, timestamp) {
  const payloadString = [
    prevHash || '0',
    actorEmail || 'system',
    actorRole || 'System',
    action || 'UNKNOWN',
    resourceType || 'UNKNOWN',
    resourceId || 'UNKNOWN',
    detailsJson || '{}',
    timestamp
  ].join('|');

  const msgBuffer = new TextEncoder().encode(payloadString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Appends a new immutable audit record to D1 with hash chaining
 * @param {Object} db - Cloudflare D1 Database binding
 * @param {Object} logEntry - Audit entry parameters
 * @returns {Promise<Object>} Inserted audit record
 */
export async function recordAuditLog(db, {
  actorEmail = 'system@srisuk-rubber.com',
  actorRole = 'System',
  action,
  resourceType,
  resourceId,
  details = {},
  ipAddress = '127.0.0.1'
}) {
  if (!db) {
    throw new Error('D1 database binding is required to record audit log');
  }

  if (!action || !resourceType || !resourceId) {
    throw new Error('Missing required audit parameters: action, resourceType, resourceId');
  }

  // 1. Fetch latest record to acquire previous hash
  const lastRecord = await db.prepare(
    'SELECT id, record_hash FROM audit_logs ORDER BY id DESC LIMIT 1'
  ).first();

  const prevHash = lastRecord ? lastRecord.record_hash : '0';
  const timestamp = new Date().toISOString();
  const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);

  // 2. Compute cryptographic record hash
  const recordHash = await computeRecordHash(
    prevHash,
    actorEmail,
    actorRole,
    action,
    resourceType,
    resourceId,
    detailsJson,
    timestamp
  );

  // 3. Insert-only into D1
  const result = await db.prepare(`
    INSERT INTO audit_logs (
      prev_hash, record_hash, actor_email, actor_role,
      action, resource_type, resource_id, details_json, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id, prev_hash, record_hash, action, resource_type, resource_id, created_at
  `).bind(
    prevHash,
    recordHash,
    actorEmail,
    actorRole,
    action,
    resourceType,
    resourceId,
    detailsJson,
    ipAddress,
    timestamp
  ).first();

  return result;
}

/**
 * Verifies the integrity of the audit log chain (Tamper-detection engine)
 * Traverses from Genesis block to latest, re-verifying every SHA-256 hash.
 * @param {Object} db - Cloudflare D1 Database binding
 * @param {number} limit - Maximum records to check in this audit pass
 * @returns {Promise<Object>} Integrity check report
 */
export async function verifyChainIntegrity(db, limit = 5000) {
  if (!db) {
    throw new Error('D1 database binding is required for integrity check');
  }

  const records = await db.prepare(
    `SELECT id, prev_hash, record_hash, actor_email, actor_role, action, resource_type, resource_id, details_json, created_at
     FROM audit_logs
     ORDER BY id ASC
     LIMIT ?`
  ).bind(limit).all();

  const list = records.results || [];

  if (list.length === 0) {
    return {
      isValid: true,
      verifiedCount: 0,
      message: 'Audit log is currently empty (Genesis state)'
    };
  }

  let expectedPrevHash = '0';

  for (let i = 0; i < list.length; i++) {
    const row = list[i];

    // Check 1: Chain linkage - prev_hash must match previous row's record_hash
    if (row.prev_hash !== expectedPrevHash) {
      return {
        isValid: false,
        corruptedAtId: row.id,
        reason: 'BROKEN_CHAIN_LINK',
        expectedPrevHash,
        actualPrevHash: row.prev_hash,
        message: `สายใยข้อมูลขาดที่ ID: ${row.id} - prev_hash ไม่ตรงกับ record_hash ของรายการก่อนหน้า`
      };
    }

    // Check 2: Content integrity - Recompute hash from content
    const recomputedHash = await computeRecordHash(
      row.prev_hash,
      row.actor_email,
      row.actor_role,
      row.action,
      row.resource_type,
      row.resource_id,
      row.details_json,
      row.created_at
    );

    if (recomputedHash !== row.record_hash) {
      return {
        isValid: false,
        corruptedAtId: row.id,
        reason: 'TAMPERED_RECORD_DATA',
        expectedHash: recomputedHash,
        storedHash: row.record_hash,
        message: `พบการแอบแก้ไขข้อมูลย้อนหลังที่ ID: ${row.id} - ข้อมูลไม่ตรงกับ Hash ลายเซ็นเดิม`
      };
    }

    expectedPrevHash = row.record_hash;
  }

  return {
    isValid: true,
    verifiedCount: list.length,
    latestRecordId: list[list.length - 1].id,
    latestHash: list[list.length - 1].record_hash,
    message: `ตรวจสอบความถูกต้องสมบูรณ์ 100% ทั้งหมด ${list.length} รายการ (ไม่พบการแก้ไขย้อนหลัง)`
  };
}

/**
 * Retrieves audit logs with optional filters and pagination
 * @param {Object} db - Cloudflare D1 Database binding
 * @param {Object} filterOptions
 */
export async function getAuditLogs(db, {
  resourceType = null,
  resourceId = null,
  actorEmail = null,
  action = null,
  page = 1,
  pageSize = 20
} = {}) {
  const conditions = [];
  const bindings = [];

  if (resourceType) {
    conditions.push('resource_type = ?');
    bindings.push(resourceType);
  }
  if (resourceId) {
    conditions.push('resource_id = ?');
    bindings.push(resourceId);
  }
  if (actorEmail) {
    conditions.push('actor_email = ?');
    bindings.push(actorEmail);
  }
  if (action) {
    conditions.push('action = ?');
    bindings.push(action);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * pageSize;

  const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
  const countStmt = db.prepare(countQuery);
  const totalRes = bindings.length > 0 ? await countStmt.bind(...bindings).first() : await countStmt.first();
  const total = totalRes ? totalRes.total : 0;

  const listQuery = `
    SELECT id, prev_hash, record_hash, actor_email, actor_role, action, resource_type, resource_id, details_json, ip_address, created_at
    FROM audit_logs
    ${whereClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `;
  const listStmt = db.prepare(listQuery);
  const listBindings = [...bindings, pageSize, offset];
  const listRes = await listStmt.bind(...listBindings).all();

  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    logs: listRes.results || []
  };
}
