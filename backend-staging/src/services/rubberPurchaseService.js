/**
 * Rubber Purchase Engine (Phase 2.1)
 * Inbound Weighing & Buying Management
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 2.1)
 */

import { getNextDocumentNumber } from './sequenceService.js';
import { recordAuditLog } from './auditService.js';

export const RUBBER_PRODUCTS = [
  { code: 'AA', name: 'ยางก้อน', hasDrc: true },
  { code: 'BB', name: 'ขี้ยาง', hasDrc: false },
  { code: 'CC', name: 'ยางแผ่นดิบ', hasDrc: false },
  { code: 'DD', name: 'ยางแผ่นรมควัน (RSS)', hasDrc: false },
  { code: 'EE', name: 'น้ำยางสด', hasDrc: true },
  { code: 'FF', name: 'เศษยาง', hasDrc: false }
];

/**
 * คำนวณน้ำหนักแห้งและยอดเงินสุทธิ
 * @param {number} weightKg - น้ำหนักสด (กก.)
 * @param {number} unitPrice - ราคาต่อ กก. (บาท)
 * @param {number} [drcPercent] - ค่า DRC% (0-100)
 * @returns {{ dryWeightKg: number, totalAmount: number }}
 */
export function calculatePurchaseAmounts(weightKg, unitPrice, drcPercent = 0) {
  const weight = Math.max(0, parseFloat(weightKg) || 0);
  const price = Math.max(0, parseFloat(unitPrice) || 0);
  const drc = Math.max(0, parseFloat(drcPercent) || 0);

  let dryWeightKg = weight;
  let totalAmount = 0;

  if (drc > 0) {
    // ถ้ายางมีค่า DRC: น้ำหนักแห้ง = Weight * (DRC / 100), ยอดเงิน = Weight * Price * (DRC / 100)
    dryWeightKg = Math.round((weight * (drc / 100)) * 100) / 100;
    totalAmount = Math.round((weight * price * (drc / 100)) * 100) / 100;
  } else {
    // ถ้ายางไม่มีค่า DRC: ยอดเงิน = Weight * Price
    dryWeightKg = Math.round(weight * 100) / 100;
    totalAmount = Math.round((weight * price) * 100) / 100;
  }

  return {
    dryWeightKg,
    totalAmount
  };
}

/**
 * สร้างใบชั่งซื้อยางหน้าลานใหม่ (Inbound Purchase Ticket)
 * @param {D1Database} db 
 * @param {object} payload 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function createPurchaseTicket(db, payload, options = {}) {
  const {
    paperRef = null,
    purchaseDate,
    branch = 'สำนักงานใหญ่',
    sellerName,
    productType,
    weightKg,
    unitPrice,
    drcPercent = 0,
    notes = null
  } = payload;

  if (!sellerName || !String(sellerName).trim()) {
    throw new Error('กรุณาระบุชื่อชาวสวน/ผู้ขาย (sellerName)');
  }

  if (!productType || !String(productType).trim()) {
    throw new Error('กรุณาระบุประเภทสินค้า (productType)');
  }

  const weight = parseFloat(weightKg);
  if (isNaN(weight) || weight <= 0) {
    throw new Error('น้ำหนักยาง (weightKg) ต้องมากกว่า 0');
  }

  const price = parseFloat(unitPrice);
  if (isNaN(price) || price <= 0) {
    throw new Error('ราคาต่อ กก. (unitPrice) ต้องมากกว่า 0');
  }

  const drc = Math.max(0, parseFloat(drcPercent) || 0);
  if (drc > 100) {
    throw new Error('ค่า DRC% ต้องอยู่ระหว่าง 0 - 100%');
  }

  // กำหนดวันที่ซื้อ (ถ้าไม่ระบุให้ใช้วันนี้)
  const dateStr = purchaseDate || new Date().toISOString().split('T')[0];

  // คำนวณน้ำหนักแห้งและยอดเงินสุทธิ
  const { dryWeightKg, totalAmount } = calculatePurchaseAmounts(weight, price, drc);

  // ออกเลขที่ใบชั่งซื้อ atomic sequence (PB-YYMMXXXX)
  const seqInfo = await getNextDocumentNumber(db, 'rubber_purchase', dateStr);
  const ticketNo = seqInfo.formattedNumber;

  const insertSql = `
    INSERT INTO rubber_purchases (
      ticket_no, paper_ref, purchase_date, branch, seller_name,
      product_type, weight_kg, unit_price, drc_percent, dry_weight_kg,
      total_amount, lot_id, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'UNASSIGNED', ?, DATETIME('now', '+7 hours'), DATETIME('now', '+7 hours'))
    RETURNING *;
  `;

  const cleanPaperRef = paperRef && String(paperRef).trim() ? String(paperRef).trim() : null;
  const cleanNotes = notes && String(notes).trim() ? String(notes).trim() : null;

  const row = await db.prepare(insertSql).bind(
    ticketNo,
    cleanPaperRef,
    dateStr,
    String(branch).trim(),
    String(sellerName).trim(),
    String(productType).trim(),
    weight,
    price,
    drc,
    dryWeightKg,
    totalAmount,
    cleanNotes
  ).first();

  // บันทึก Audit Log (ถ้ามีผู้ดำเนินการ)
  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Weigher',
        action: 'CREATE_RUBBER_PURCHASE',
        resourceType: 'rubber_purchase',
        resourceId: ticketNo,
        details: {
          ticketNo,
          paperRef: cleanPaperRef,
          sellerName: String(sellerName).trim(),
          productType: String(productType).trim(),
          weightKg: weight,
          unitPrice: price,
          drcPercent: drc,
          totalAmount
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return row || {
    ticket_no: ticketNo,
    paper_ref: cleanPaperRef,
    purchase_date: dateStr,
    branch: String(branch).trim(),
    seller_name: String(sellerName).trim(),
    product_type: String(productType).trim(),
    weight_kg: weight,
    unit_price: price,
    drc_percent: drc,
    dry_weight_kg: dryWeightKg,
    total_amount: totalAmount,
    lot_id: null,
    status: 'UNASSIGNED',
    notes: cleanNotes
  };
}

/**
 * ดึงข้อมูลใบชั่งซื้อจาก ticket_no
 * @param {D1Database} db 
 * @param {string} ticketNo 
 * @returns {Promise<object|null>}
 */
export async function getPurchaseTicketByNo(db, ticketNo) {
  const sql = `SELECT * FROM rubber_purchases WHERE ticket_no = ?`;
  return await db.prepare(sql).bind(ticketNo).first();
}

/**
 * ดึงรายการซื้อที่ยังไม่ได้จัดเข้า Lot (สำหรับเตรียมรวมบิลใน Phase 2.2)
 * @param {D1Database} db 
 * @param {object} [filters] 
 * @returns {Promise<Array<object>>}
 */
export async function getUnassignedPurchases(db, filters = {}) {
  let conditions = [`status = 'UNASSIGNED'`, `lot_id IS NULL`];
  let params = [];

  if (filters.productType && String(filters.productType).trim()) {
    conditions.push(`product_type = ?`);
    params.push(String(filters.productType).trim());
  }

  if (filters.branch && String(filters.branch).trim()) {
    conditions.push(`branch = ?`);
    params.push(String(filters.branch).trim());
  }

  if (filters.dateFrom) {
    conditions.push(`purchase_date >= ?`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push(`purchase_date <= ?`);
    params.push(filters.dateTo);
  }

  if (filters.search && String(filters.search).trim()) {
    conditions.push(`(ticket_no LIKE ? OR seller_name LIKE ? OR paper_ref LIKE ?)`);
    const term = `%${String(filters.search).trim()}%`;
    params.push(term, term, term);
  }

  const query = `
    SELECT * FROM rubber_purchases 
    WHERE ${conditions.join(' AND ')}
    ORDER BY purchase_date ASC, id ASC
  `;

  const { results } = await db.prepare(query).bind(...params).all();
  return results || [];
}

/**
 * ดึงรายการซื้อทั้งหมดพร้อม Pagination และตัวกรอง
 * @param {D1Database} db 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function listPurchases(db, options = {}) {
  const {
    page = 1,
    pageSize = 20,
    status,
    productType,
    branch,
    dateFrom,
    dateTo,
    search
  } = options;

  let conditions = ['1=1'];
  let params = [];

  if (status && String(status).trim()) {
    conditions.push(`status = ?`);
    params.push(String(status).trim());
  }

  if (productType && String(productType).trim()) {
    conditions.push(`product_type = ?`);
    params.push(String(productType).trim());
  }

  if (branch && String(branch).trim()) {
    conditions.push(`branch = ?`);
    params.push(String(branch).trim());
  }

  if (dateFrom) {
    conditions.push(`purchase_date >= ?`);
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(`purchase_date <= ?`);
    params.push(dateTo);
  }

  if (search && String(search).trim()) {
    conditions.push(`(ticket_no LIKE ? OR seller_name LIKE ? OR paper_ref LIKE ?)`);
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term);
  }

  const whereClause = conditions.join(' AND ');

  // 1. นับจำนวนและคำนวณผลรวม
  const statQuery = `
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(weight_kg), 0) as sum_weight,
      COALESCE(SUM(total_amount), 0) as sum_amount
    FROM rubber_purchases 
    WHERE ${whereClause}
  `;
  const stats = await db.prepare(statQuery).bind(...params).first();

  const total = stats ? stats.total_count : 0;
  const sumWeight = stats ? stats.sum_weight : 0;
  const sumAmount = stats ? stats.sum_amount : 0;

  // 2. ดึงรายการข้อมูลตามหน้า
  const offset = (Math.max(1, page) - 1) * pageSize;
  const listQuery = `
    SELECT * FROM rubber_purchases 
    WHERE ${whereClause}
    ORDER BY purchase_date DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  const listParams = [...params, pageSize, offset];
  const { results } = await db.prepare(listQuery).bind(...listParams).all();

  return {
    items: results || [],
    total,
    totalWeight: Math.round(sumWeight * 100) / 100,
    totalAmount: Math.round(sumAmount * 100) / 100,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / pageSize) || 1
  };
}

/**
 * ยกเลิกใบชั่งซื้อยางหน้าลาน
 * @param {D1Database} db 
 * @param {string} ticketNo 
 * @param {string} [cancelReason] 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function cancelPurchaseTicket(db, ticketNo, cancelReason = '', options = {}) {
  const ticket = await getPurchaseTicketByNo(db, ticketNo);
  if (!ticket) {
    throw new Error(`ไม่พบใบชั่งซื้อเลขที่ '${ticketNo}' ในระบบ`);
  }

  if (ticket.status === 'CANCELLED') {
    throw new Error(`ใบชั่งซื้อเลขที่ '${ticketNo}' ถูกยกเลิกไปแล้ว`);
  }

  if (ticket.status === 'ASSIGNED' || ticket.lot_id !== null) {
    throw new Error(`ไม่สามารถยกเลิกใบชั่งซื้อที่ถูกจัดเข้า Lot แล้วได้ (กรุณาปลดออกจาก Lot ก่อน)`);
  }

  const reasonNote = cancelReason ? `[ยกเลิก: ${cancelReason}]` : '[ยกเลิก]';
  const updatedNotes = ticket.notes ? `${ticket.notes} ${reasonNote}` : reasonNote;

  const updateSql = `
    UPDATE rubber_purchases 
    SET status = 'CANCELLED', notes = ?, updated_at = DATETIME('now', '+7 hours')
    WHERE ticket_no = ?
    RETURNING *;
  `;

  const updated = await db.prepare(updateSql).bind(updatedNotes, ticketNo).first();

  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'CANCEL_RUBBER_PURCHASE',
        resourceType: 'rubber_purchase',
        resourceId: ticketNo,
        details: {
          ticketNo,
          cancelReason,
          weightKg: ticket.weight_kg,
          totalAmount: ticket.total_amount
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return updated || {
    ...ticket,
    status: 'CANCELLED',
    notes: updatedNotes
  };
}
