/**
 * Rubber Lot Grouping & Aggregation Engine (Phase 2.2)
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 2.2)
 */

import { getNextDocumentNumber } from './sequenceService.js';
import { recordAuditLog } from './auditService.js';

/**
 * คำนวณผลรวมน้ำหนัก ต้นทุน และต้นทุนเฉลี่ยต่อ กก.
 * @param {Array<object>} tickets 
 * @returns {{ totalWeightKg: number, totalCost: number, avgCostPerKg: number, itemsCount: number }}
 */
export function calculateLotAggregates(tickets = []) {
  let totalWeight = 0;
  let totalCost = 0;

  for (const t of tickets) {
    totalWeight += (parseFloat(t.weight_kg) || 0);
    totalCost += (parseFloat(t.total_amount) || 0);
  }

  const roundedWeight = Math.round(totalWeight * 100) / 100;
  const roundedCost = Math.round(totalCost * 100) / 100;
  const avgCost = roundedWeight > 0 ? Math.round((roundedCost / roundedWeight) * 100) / 100 : 0;

  return {
    totalWeightKg: roundedWeight,
    totalCost: roundedCost,
    avgCostPerKg: avgCost,
    itemsCount: tickets.length
  };
}

/**
 * สร้าง Lot สินค้ายางพาราใหม่ จากการรวมบิลซื้อหน้าลาน (Inbound Tickets)
 * @param {D1Database} db 
 * @param {object} payload 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function createLot(db, payload, options = {}) {
  const ticketNos = payload.ticketNos || payload.purchaseTicketNos || [];
  let productType = payload.productType || payload.product_type;
  let lotName = payload.lotName || payload.name;
  const lotDate = payload.lotDate || payload.date;

  if (!Array.isArray(ticketNos) || ticketNos.length === 0) {
    throw new Error('ต้องระบุใบชั่งซื้อ (ticketNos) อย่างน้อย 1 รายการเพื่อสร้าง Lot');
  }

  // Auto-detect productType from first ticket if not explicitly provided
  if (!productType || !String(productType).trim()) {
    const firstNo = String(ticketNos[0]).trim();
    const firstTicket = await db.prepare('SELECT * FROM rubber_purchases WHERE ticket_no = ?').bind(firstNo).first();
    if (firstTicket && firstTicket.product_type) {
      productType = firstTicket.product_type;
    } else {
      throw new Error('กรุณาระบุประเภทยางพาราสำหรับ Lot (productType)');
    }
  }

  const cleanProductType = String(productType).trim();
  if (!lotName || !String(lotName).trim()) {
    lotName = `Lot ${cleanProductType} (${new Date().toLocaleDateString('th-TH')})`;
  }
  const cleanLotName = String(lotName).trim();

  // 1. ดึงและตรวจสอบความถูกต้องของใบชั่งซื้อทุกใบ
  const fetchedTickets = [];
  for (const ticketNo of ticketNos) {
    const cleanNo = String(ticketNo).trim();
    const query = `SELECT * FROM rubber_purchases WHERE ticket_no = ?`;
    const ticket = await db.prepare(query).bind(cleanNo).first();

    if (!ticket) {
      throw new Error(`ไม่พบใบชั่งซื้อเลขที่ '${cleanNo}' ในระบบ`);
    }

    if (ticket.status === 'CANCELLED') {
      throw new Error(`ใบชั่งซื้อเลขที่ '${cleanNo}' ถูกยกเลิกไปแล้ว ไม่สามารถนำมารวม Lot ได้`);
    }

    if (ticket.status === 'ASSIGNED' || ticket.lot_id !== null) {
      throw new Error(`ใบชั่งซื้อเลขที่ '${cleanNo}' ถูกจัดเข้า Lot อื่นไปแล้ว ไม่สามารถจัดซ้ำได้`);
    }

    // กฎเหล็ก Single Product Rule: ยางใน Lot ต้องเป็นชนิดเดียวกัน 100%
    if (ticket.product_type !== cleanProductType) {
      throw new Error(`ใบชั่งซื้อ '${cleanNo}' เป็นประเภท '${ticket.product_type}' ซึ่งไม่ตรงกับประเภทยางของ Lot '${cleanProductType}'`);
    }

    fetchedTickets.push(ticket);
  }

  // 2. คำนวณผลรวมของ Lot
  const aggregates = calculateLotAggregates(fetchedTickets);
  const dateStr = lotDate || new Date().toISOString().split('T')[0];

  // 3. ออกรหัส Lot เลขที่ถัดไป (LOT-YYMMXXXX)
  const seqInfo = await getNextDocumentNumber(db, 'rubber_lot', dateStr);
  const lotNo = seqInfo.formattedNumber;

  // 4. บันทึกหัวตาราง rubber_lots
  const insertLotSql = `
    INSERT INTO rubber_lots (
      lot_no, lot_name, product_type, total_weight_kg, total_cost,
      avg_cost_per_kg, items_count, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', DATETIME('now', '+7 hours'), DATETIME('now', '+7 hours'))
    RETURNING *;
  `;

  const lotRecord = await db.prepare(insertLotSql).bind(
    lotNo,
    cleanLotName,
    cleanProductType,
    aggregates.totalWeightKg,
    aggregates.totalCost,
    aggregates.avgCostPerKg,
    aggregates.itemsCount
  ).first();

  const lotId = lotRecord ? lotRecord.id : null;

  // 5. อัปเดตสถานะใบชั่งซื้อทุกใบให้ผูกกับ Lot นี้
  for (const ticket of fetchedTickets) {
    const updateTicketSql = `
      UPDATE rubber_purchases 
      SET lot_id = ?, status = 'ASSIGNED', updated_at = DATETIME('now', '+7 hours')
      WHERE ticket_no = ?;
    `;
    await db.prepare(updateTicketSql).bind(lotId, ticket.ticket_no).run();
  }

  // 6. บันทึก Audit Log
  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'CREATE_RUBBER_LOT',
        resourceType: 'rubber_lot',
        resourceId: lotNo,
        details: {
          lotNo,
          lotName: cleanLotName,
          productType: cleanProductType,
          totalWeightKg: aggregates.totalWeightKg,
          totalCost: aggregates.totalCost,
          avgCostPerKg: aggregates.avgCostPerKg,
          itemsCount: aggregates.itemsCount,
          ticketNos
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return {
    lot: lotRecord || {
      id: lotId,
      lot_no: lotNo,
      lot_name: cleanLotName,
      product_type: cleanProductType,
      total_weight_kg: aggregates.totalWeightKg,
      total_cost: aggregates.totalCost,
      avg_cost_per_kg: aggregates.avgCostPerKg,
      items_count: aggregates.itemsCount,
      status: 'OPEN'
    },
    items: fetchedTickets.map(t => ({ ...t, lot_id: lotId, status: 'ASSIGNED' }))
  };
}

/**
 * ดึงข้อมูล Lot พร้อมรายการใบชั่งซื้อทั้งหมดใน Lot
 * @param {D1Database} db 
 * @param {string} lotNo 
 * @returns {Promise<{ lot: object, items: Array<object> } | null>}
 */
export async function getLotByNo(db, lotNo) {
  const lotSql = `SELECT * FROM rubber_lots WHERE lot_no = ?`;
  const lot = await db.prepare(lotSql).bind(lotNo).first();
  if (!lot) return null;

  const itemsSql = `SELECT * FROM rubber_purchases WHERE lot_id = ? ORDER BY id ASC`;
  const { results } = await db.prepare(itemsSql).bind(lot.id).all();

  return {
    lot,
    items: results || []
  };
}

/**
 * เพิ่มใบชั่งซื้อเข้า Lot เดิมที่ยังเปิดอยู่ (Status: OPEN)
 * @param {D1Database} db 
 * @param {string} lotNo 
 * @param {Array<string>} ticketNos 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function addTicketsToLot(db, lotNo, ticketNos = [], options = {}) {
  const lotData = await getLotByNo(db, lotNo);
  if (!lotData || !lotData.lot) {
    throw new Error(`ไม่พบ Lot เลขที่ '${lotNo}' ในระบบ`);
  }

  const { lot, items: currentItems } = lotData;

  if (lot.status !== 'OPEN') {
    throw new Error(`ไม่สามารถเพิ่มใบชั่งซื้อได้เนื่องจาก Lot มีสถานะเป็น '${lot.status}' (ต้องเป็น 'OPEN' เท่านั้น)`);
  }

  if (!Array.isArray(ticketNos) || ticketNos.length === 0) {
    throw new Error('กรุณาระบุใบชั่งซื้อที่ต้องการเพิ่ม (ticketNos)');
  }

  const newTickets = [];
  for (const ticketNo of ticketNos) {
    const cleanNo = String(ticketNo).trim();
    const query = `SELECT * FROM rubber_purchases WHERE ticket_no = ?`;
    const ticket = await db.prepare(query).bind(cleanNo).first();

    if (!ticket) {
      throw new Error(`ไม่พบใบชั่งซื้อเลขที่ '${cleanNo}' ในระบบ`);
    }

    if (ticket.status === 'CANCELLED') {
      throw new Error(`ใบชั่งซื้อเลขที่ '${cleanNo}' ถูกยกเลิกไปแล้ว`);
    }

    if (ticket.status === 'ASSIGNED' || ticket.lot_id !== null) {
      throw new Error(`ใบชั่งซื้อเลขที่ '${cleanNo}' ถูกจัดเข้า Lot ไปแล้ว`);
    }

    if (ticket.product_type !== lot.product_type) {
      throw new Error(`ใบชั่งซื้อ '${cleanNo}' เป็นประเภท '${ticket.product_type}' ซึ่งไม่ตรงกับประเภทยางของ Lot '${lot.product_type}'`);
    }

    newTickets.push(ticket);
  }

  // ผูกใบชั่งซื้อใหม่เข้า Lot
  for (const ticket of newTickets) {
    const updateTicketSql = `
      UPDATE rubber_purchases 
      SET lot_id = ?, status = 'ASSIGNED', updated_at = DATETIME('now', '+7 hours')
      WHERE ticket_no = ?;
    `;
    await db.prepare(updateTicketSql).bind(lot.id, ticket.ticket_no).run();
  }

  // คำนวณผลรวมใหม่ทั้งหมด
  const allTickets = [...currentItems, ...newTickets];
  const aggregates = calculateLotAggregates(allTickets);

  const updateLotSql = `
    UPDATE rubber_lots 
    SET 
      total_weight_kg = ?, 
      total_cost = ?, 
      avg_cost_per_kg = ?, 
      items_count = ?, 
      updated_at = DATETIME('now', '+7 hours')
    WHERE id = ?
    RETURNING *;
  `;

  const updatedLot = await db.prepare(updateLotSql).bind(
    aggregates.totalWeightKg,
    aggregates.totalCost,
    aggregates.avgCostPerKg,
    aggregates.itemsCount,
    lot.id
  ).first();

  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'ADD_TICKETS_TO_LOT',
        resourceType: 'rubber_lot',
        resourceId: lotNo,
        details: {
          lotNo,
          addedTicketNos: ticketNos,
          newItemsCount: aggregates.itemsCount,
          newTotalWeightKg: aggregates.totalWeightKg,
          newTotalCost: aggregates.totalCost
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return {
    lot: updatedLot || {
      ...lot,
      total_weight_kg: aggregates.totalWeightKg,
      total_cost: aggregates.totalCost,
      avg_cost_per_kg: aggregates.avgCostPerKg,
      items_count: aggregates.itemsCount
    },
    items: allTickets
  };
}

/**
 * ปลดใบชั่งซื้อออกจาก Lot (เฉพาะ Lot ที่ยังเป็น OPEN)
 * @param {D1Database} db 
 * @param {string} lotNo 
 * @param {string} ticketNo 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function removeTicketFromLot(db, lotNo, ticketNo, options = {}) {
  const lotData = await getLotByNo(db, lotNo);
  if (!lotData || !lotData.lot) {
    throw new Error(`ไม่พบ Lot เลขที่ '${lotNo}' ในระบบ`);
  }

  const { lot, items } = lotData;

  if (lot.status !== 'OPEN') {
    throw new Error(`ไม่สามารถปลดใบชั่งซื้อได้เนื่องจาก Lot มีสถานะเป็น '${lot.status}' (ต้องเป็น 'OPEN' เท่านั้น)`);
  }

  const cleanNo = String(ticketNo).trim();
  const existingTicket = items.find(t => t.ticket_no === cleanNo);
  if (!existingTicket) {
    throw new Error(`ไม่พบใบชั่งซื้อ '${cleanNo}' อยู่ใน Lot '${lotNo}'`);
  }

  if (items.length <= 1) {
    throw new Error('ไม่สามารถปลดบิลใบสุดท้ายออกจาก Lot ได้ หากต้องการยกเลิกกรุณาใช้คำสั่งยกเลิก Lot (cancelLot)');
  }

  // ปลดบิลคืนสู่ UNASSIGNED
  const unlinkSql = `
    UPDATE rubber_purchases 
    SET lot_id = NULL, status = 'UNASSIGNED', updated_at = DATETIME('now', '+7 hours')
    WHERE ticket_no = ?;
  `;
  await db.prepare(unlinkSql).bind(cleanNo).run();

  // คำนวณผลรวมใหม่
  const remainingTickets = items.filter(t => t.ticket_no !== cleanNo);
  const aggregates = calculateLotAggregates(remainingTickets);

  const updateLotSql = `
    UPDATE rubber_lots 
    SET 
      total_weight_kg = ?, 
      total_cost = ?, 
      avg_cost_per_kg = ?, 
      items_count = ?, 
      updated_at = DATETIME('now', '+7 hours')
    WHERE id = ?
    RETURNING *;
  `;

  const updatedLot = await db.prepare(updateLotSql).bind(
    aggregates.totalWeightKg,
    aggregates.totalCost,
    aggregates.avgCostPerKg,
    aggregates.itemsCount,
    lot.id
  ).first();

  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'REMOVE_TICKET_FROM_LOT',
        resourceType: 'rubber_lot',
        resourceId: lotNo,
        details: {
          lotNo,
          removedTicketNo: cleanNo,
          newItemsCount: aggregates.itemsCount,
          newTotalWeightKg: aggregates.totalWeightKg,
          newTotalCost: aggregates.totalCost
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return {
    lot: updatedLot || {
      ...lot,
      total_weight_kg: aggregates.totalWeightKg,
      total_cost: aggregates.totalCost,
      avg_cost_per_kg: aggregates.avgCostPerKg,
      items_count: aggregates.itemsCount
    },
    items: remainingTickets
  };
}

/**
 * ล็อค Lot เพื่อปิดรับบิลเพิ่ม และเตรียมส่งออก (OPEN -> LOCKED)
 * @param {D1Database} db 
 * @param {string} lotNo 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function lockLot(db, lotNo, options = {}) {
  const lotData = await getLotByNo(db, lotNo);
  if (!lotData || !lotData.lot) {
    throw new Error(`ไม่พบ Lot เลขที่ '${lotNo}' ในระบบ`);
  }

  const { lot } = lotData;
  if (lot.status !== 'OPEN') {
    throw new Error(`Lot '${lotNo}' มีสถานะเป็น '${lot.status}' แล้ว ไม่สามารถล็อคซ้ำได้`);
  }

  const updateSql = `
    UPDATE rubber_lots 
    SET status = 'LOCKED', updated_at = DATETIME('now', '+7 hours')
    WHERE id = ?
    RETURNING *;
  `;

  const updated = await db.prepare(updateSql).bind(lot.id).first();

  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'LOCK_RUBBER_LOT',
        resourceType: 'rubber_lot',
        resourceId: lotNo,
        details: { lotNo },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return updated || { ...lot, status: 'LOCKED' };
}

/**
 * ปลดล็อค Lot เพื่อเปิดให้แก้ไขเพิ่ม/ลดบิลได้อีกครั้ง (LOCKED -> OPEN)
 * @param {D1Database} db 
 * @param {string} lotNo 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function unlockLot(db, lotNo, options = {}) {
  const lotData = await getLotByNo(db, lotNo);
  if (!lotData || !lotData.lot) {
    throw new Error(`ไม่พบ Lot เลขที่ '${lotNo}' ในระบบ`);
  }

  const { lot } = lotData;
  if (lot.status !== 'LOCKED') {
    throw new Error(`Lot '${lotNo}' ต้องมีสถานะเป็น 'LOCKED' จึงจะสามารถปลดล็อคได้ (สถานะปัจจุบัน: '${lot.status}')`);
  }

  const updateSql = `
    UPDATE rubber_lots 
    SET status = 'OPEN', updated_at = DATETIME('now', '+7 hours')
    WHERE id = ?
    RETURNING *;
  `;

  const updated = await db.prepare(updateSql).bind(lot.id).first();

  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'UNLOCK_RUBBER_LOT',
        resourceType: 'rubber_lot',
        resourceId: lotNo,
        details: { lotNo },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return updated || { ...lot, status: 'OPEN' };
}

/**
 * ยกเลิก Lot และปลดบิลชั่งซื้อทั้งหมดคืนสู่คลัง (Status: UNASSIGNED)
 * @param {D1Database} db 
 * @param {string} lotNo 
 * @param {string} [cancelReason] 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function cancelLot(db, lotNo, cancelReason = '', options = {}) {
  const lotData = await getLotByNo(db, lotNo);
  if (!lotData || !lotData.lot) {
    throw new Error(`ไม่พบ Lot เลขที่ '${lotNo}' ในระบบ`);
  }

  const { lot, items } = lotData;

  if (lot.status === 'CANCELLED') {
    throw new Error(`Lot '${lotNo}' ถูกยกเลิกไปแล้ว`);
  }

  if (['SHIPPED', 'COMPLETED'].includes(lot.status)) {
    throw new Error(`ไม่สามารถยกเลิก Lot '${lotNo}' ที่ส่งออกโรงงานหรือสรุปผลไปแล้วได้ (สถานะปัจจุบัน: '${lot.status}')`);
  }

  // 1. ปลดบิลชั่งซื้อทั้งหมดใน Lot นี้คืนสถานะ UNASSIGNED
  const unlinkAllSql = `
    UPDATE rubber_purchases 
    SET lot_id = NULL, status = 'UNASSIGNED', updated_at = DATETIME('now', '+7 hours')
    WHERE lot_id = ?;
  `;
  await db.prepare(unlinkAllSql).bind(lot.id).run();

  // 2. ปรับสถานะ Lot เป็น CANCELLED
  const updateLotSql = `
    UPDATE rubber_lots 
    SET status = 'CANCELLED', updated_at = DATETIME('now', '+7 hours')
    WHERE id = ?
    RETURNING *;
  `;
  const updatedLot = await db.prepare(updateLotSql).bind(lot.id).first();

  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'CANCEL_RUBBER_LOT',
        resourceType: 'rubber_lot',
        resourceId: lotNo,
        details: {
          lotNo,
          cancelReason,
          unlinkedTicketCount: items.length
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return updatedLot || { ...lot, status: 'CANCELLED' };
}

/**
 * ดึงรายการ Lot ทั้งหมดพร้อม Pagination และตัวกรอง
 * @param {D1Database} db 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function listLots(db, options = {}) {
  const {
    page = 1,
    pageSize = 20,
    status,
    productType,
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

  if (search && String(search).trim()) {
    conditions.push(`(lot_no LIKE ? OR lot_name LIKE ?)`);
    const term = `%${String(search).trim()}%`;
    params.push(term, term);
  }

  const whereClause = conditions.join(' AND ');

  const statQuery = `
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(total_weight_kg), 0) as sum_weight,
      COALESCE(SUM(total_cost), 0) as sum_cost
    FROM rubber_lots 
    WHERE ${whereClause}
  `;
  const stats = await db.prepare(statQuery).bind(...params).first();

  const total = stats ? stats.total_count : 0;
  const sumWeight = stats ? stats.sum_weight : 0;
  const sumCost = stats ? stats.sum_cost : 0;

  const offset = (Math.max(1, page) - 1) * pageSize;
  const listQuery = `
    SELECT * FROM rubber_lots 
    WHERE ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  const listParams = [...params, pageSize, offset];
  const { results } = await db.prepare(listQuery).bind(...listParams).all();

  return {
    items: results || [],
    total,
    totalWeight: Math.round(sumWeight * 100) / 100,
    totalCost: Math.round(sumCost * 100) / 100,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / pageSize) || 1
  };
}
