/**
 * Outbound Factory Sales & Reconciliation Engine (Phase 2.3)
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 2.3)
 */

import { getNextDocumentNumber } from './sequenceService.js';
import { recordAuditLog } from './auditService.js';

/**
 * คำนวณสรุปยอดเงินและกำไร-ขาดทุนจากผลตรวจโรงงาน
 * @param {object} lot - ข้อมูลหัว Lot
 * @param {object} settlementInput - ข้อมูลผลชั่งและค่าใช้จ่าย
 * @returns {object}
 */
export function calculateSaleSettlement(lot, settlementInput) {
  const sellingPrice = Math.max(0, parseFloat(settlementInput.sellingPricePerKg) || 0);
  const factoryWeight = Math.max(0, parseFloat(settlementInput.factoryWeightKg) || 0);
  const factoryDrc = Math.max(0, parseFloat(settlementInput.factoryDrcPercent) || 0);
  const penalty = Math.max(0, parseFloat(settlementInput.penaltyDeduction) || 0);
  const transport = Math.max(0, parseFloat(settlementInput.transportCost) || 0);
  const other = Math.max(0, parseFloat(settlementInput.otherFees) || 0);
  const outboundWeight = Math.max(0, parseFloat(settlementInput.outboundWeightKg || lot.total_weight_kg) || 0);
  const lotCost = Math.max(0, parseFloat(lot.total_cost) || 0);

  // ตรวจสอบว่าสินค้านี้ต้องคิด DRC หรือไม่
  const hasDrc = factoryDrc > 0 || ['น้ำยางสด', 'ยางก้อน', 'ยางก้อนถ้วย'].includes(lot.product_type);

  let netPricePerKg = 0;
  let grossRevenue = 0;

  if (hasDrc && factoryDrc > 0) {
    // ราคาขายสุทธิ = round(ราคาขาย * DRC%, 2) ป้องกันข้อผิดพลาด floating point
    netPricePerKg = Math.round((sellingPrice * factoryDrc + Number.EPSILON)) / 100;
    grossRevenue = Math.round((factoryWeight * netPricePerKg) * 100) / 100;
  } else {
    // ยางไม่มี DRC: ราคาขายสุทธิ = ราคาขายตกลง
    netPricePerKg = Math.round(sellingPrice * 100) / 100;
    grossRevenue = Math.round((factoryWeight * sellingPrice) * 100) / 100;
  }

  // หักค่าปรับ ค่าขนส่ง ค่าธรรมเนียม
  const totalDeductions = Math.round((penalty + transport + other) * 100) / 100;
  const netRevenue = Math.round((grossRevenue - totalDeductions) * 100) / 100;

  // น้ำหนักที่สูญเสียระหว่างทาง
  const weightShrinkageKg = outboundWeight > factoryWeight
    ? Math.round((outboundWeight - factoryWeight) * 100) / 100
    : 0;

  // กำไร-ขาดทุนสุทธิ = รายรับสุทธิ - ต้นทุนรวมของ Lot
  const netProfit = Math.round((netRevenue - lotCost) * 100) / 100;

  // กำไรต่อ กก. = กำไรสุทธิ / น้ำหนักจริงโรงงาน
  const marginPerKg = factoryWeight > 0
    ? Math.round((netProfit / factoryWeight) * 100) / 100
    : 0;

  return {
    netPricePerKg,
    grossRevenue,
    penaltyDeduction: penalty,
    transportCost: transport,
    otherFees: other,
    netRevenue,
    weightShrinkageKg,
    netProfit,
    marginPerKg
  };
}

/**
 * สร้างบิลส่งขายโรงงานใหม่ (Outbound Sale Record) - ขั้นที่ 1: สถานะ PENDING
 * @param {D1Database} db 
 * @param {object} payload 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function createSaleRecord(db, payload, options = {}) {
  const {
    lotNo,
    factoryName,
    shipDate,
    outboundWeightKg,
    sellingPricePerKg
  } = payload;

  if (!lotNo || !String(lotNo).trim()) {
    throw new Error('กรุณาระบุเลขที่ Lot ที่ต้องการส่งขาย (lotNo)');
  }

  if (!factoryName || !String(factoryName).trim()) {
    throw new Error('กรุณาระบุชื่อโรงงานปลายทาง (factoryName)');
  }

  const sellingPrice = parseFloat(sellingPricePerKg);
  if (isNaN(sellingPrice) || sellingPrice <= 0) {
    throw new Error('ราคาตกลงขายต่อ กก. (sellingPricePerKg) ต้องมากกว่า 0');
  }

  // 1. ดึงข้อมูล Lot เพื่อตรวจสอบสถานะ
  const cleanLotNo = String(lotNo).trim();
  const lotQuery = `SELECT * FROM rubber_lots WHERE lot_no = ?`;
  const lot = await db.prepare(lotQuery).bind(cleanLotNo).first();

  if (!lot) {
    throw new Error(`ไม่พบ Lot เลขที่ '${cleanLotNo}' ในระบบ`);
  }

  if (lot.status === 'OPEN') {
    throw new Error(`Lot '${cleanLotNo}' ยังมีสถานะเป็น 'OPEN' กรุณาล็อค Lot (LOCKED) ให้เสร็จสิ้นก่อนส่งขาย`);
  }

  if (lot.status === 'SHIPPED') {
    throw new Error(`Lot '${cleanLotNo}' ถูกส่งขายโรงงานไปแล้ว`);
  }

  if (lot.status === 'COMPLETED') {
    throw new Error(`Lot '${cleanLotNo}' ปิดยอดและสรุปผลกำไรไปแล้ว`);
  }

  if (lot.status === 'CANCELLED') {
    throw new Error(`Lot '${cleanLotNo}' ถูกยกเลิกไปแล้ว ไม่สามารถส่งขายได้`);
  }

  const outboundWeight = outboundWeightKg !== undefined && outboundWeightKg !== null
    ? Math.max(0, parseFloat(outboundWeightKg) || 0)
    : lot.total_weight_kg;

  const dateStr = shipDate || new Date().toISOString().split('T')[0];

  // 2. ออกรหัสบิลขาย (SL-YYMMXXXX)
  const seqInfo = await getNextDocumentNumber(db, 'rubber_sale', dateStr);
  const saleNo = seqInfo.formattedNumber;

  // 3. บันทึกลงตาราง rubber_sales
  const insertSaleSql = `
    INSERT INTO rubber_sales (
      sale_no, lot_id, factory_name, ship_date, outbound_weight_kg,
      factory_weight_kg, factory_drc_percent, selling_price_per_kg, net_price_per_kg,
      gross_revenue, penalty_deduction, transport_cost, other_fees,
      net_revenue, net_profit, margin_per_kg, weight_shrinkage_kg,
      status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      0, 0, ?, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      'PENDING', DATETIME('now', '+7 hours'), DATETIME('now', '+7 hours')
    )
    RETURNING *;
  `;

  const cleanFactory = String(factoryName).trim();
  const saleRecord = await db.prepare(insertSaleSql).bind(
    saleNo,
    lot.id,
    cleanFactory,
    dateStr,
    outboundWeight,
    sellingPrice
  ).first();

  // 4. ปรับปรุงสถานะ Lot เป็น 'SHIPPED'
  const updateLotSql = `
    UPDATE rubber_lots 
    SET status = 'SHIPPED', updated_at = DATETIME('now', '+7 hours')
    WHERE id = ?;
  `;
  await db.prepare(updateLotSql).bind(lot.id).run();

  // 5. บันทึก Audit Log
  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'CREATE_RUBBER_SALE',
        resourceType: 'rubber_sale',
        resourceId: saleNo,
        details: {
          saleNo,
          lotNo: cleanLotNo,
          factoryName: cleanFactory,
          outboundWeightKg: outboundWeight,
          sellingPricePerKg: sellingPrice
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return saleRecord || {
    sale_no: saleNo,
    lot_id: lot.id,
    factory_name: cleanFactory,
    ship_date: dateStr,
    outbound_weight_kg: outboundWeight,
    selling_price_per_kg: sellingPrice,
    status: 'PENDING'
  };
}

/**
 * บันทึกผลชั่งจริงและแล็บโรงงาน พร้อมสรุปผลกำไร-ขาดทุน (Settle Factory Result) - ขั้นที่ 2: สถานะ CLOSED
 * @param {D1Database} db 
 * @param {string} saleNo 
 * @param {object} payload 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function settleFactoryResult(db, saleNo, payload, options = {}) {
  const cleanSaleNo = String(saleNo).trim();
  const saleQuery = `SELECT * FROM rubber_sales WHERE sale_no = ?`;
  const sale = await db.prepare(saleQuery).bind(cleanSaleNo).first();

  if (!sale) {
    throw new Error(`ไม่พบเอกสารบิลส่งขายเลขที่ '${cleanSaleNo}' ในระบบ`);
  }

  if (sale.status === 'CLOSED') {
    throw new Error(`บิลส่งขายเลขที่ '${cleanSaleNo}' ปิดยอดโรงงานเรียบร้อยแล้ว`);
  }

  const factoryWeight = parseFloat(payload.factoryWeightKg);
  if (isNaN(factoryWeight) || factoryWeight <= 0) {
    throw new Error('น้ำหนักจริงหน้าโรงงาน (factoryWeightKg) ต้องมากกว่า 0');
  }

  // ดึงข้อมูล Lot เพื่อนำต้นทุนและประเภทยางมาคำนวณ
  const lotQuery = `SELECT * FROM rubber_lots WHERE id = ?`;
  const lot = await db.prepare(lotQuery).bind(sale.lot_id).first();

  if (!lot) {
    throw new Error(`ไม่พบ Lot ที่ผูกกับบิลส่งขายนี้ (Lot ID: ${sale.lot_id})`);
  }

  const sellingPrice = payload.sellingPricePerKg !== undefined
    ? parseFloat(payload.sellingPricePerKg)
    : sale.selling_price_per_kg;

  // คำนวณยอดเงินและกำไร-ขาดทุน
  const settlement = calculateSaleSettlement(lot, {
    sellingPricePerKg: sellingPrice,
    factoryWeightKg: factoryWeight,
    factoryDrcPercent: payload.factoryDrcPercent !== undefined ? payload.factoryDrcPercent : sale.factory_drc_percent,
    penaltyDeduction: payload.penaltyDeduction || 0,
    transportCost: payload.transportCost || 0,
    otherFees: payload.otherFees || 0,
    outboundWeightKg: sale.outbound_weight_kg
  });

  // อัปเดตตาราง rubber_sales
  const updateSaleSql = `
    UPDATE rubber_sales 
    SET 
      factory_weight_kg = ?,
      factory_drc_percent = ?,
      selling_price_per_kg = ?,
      net_price_per_kg = ?,
      gross_revenue = ?,
      penalty_deduction = ?,
      transport_cost = ?,
      other_fees = ?,
      net_revenue = ?,
      net_profit = ?,
      margin_per_kg = ?,
      weight_shrinkage_kg = ?,
      status = 'CLOSED',
      updated_at = DATETIME('now', '+7 hours')
    WHERE sale_no = ?
    RETURNING *;
  `;

  const updatedSale = await db.prepare(updateSaleSql).bind(
    factoryWeight,
    payload.factoryDrcPercent || 0,
    sellingPrice,
    settlement.netPricePerKg,
    settlement.grossRevenue,
    settlement.penaltyDeduction,
    settlement.transportCost,
    settlement.otherFees,
    settlement.netRevenue,
    settlement.netProfit,
    settlement.marginPerKg,
    settlement.weightShrinkageKg,
    cleanSaleNo
  ).first();

  // อัปเดตสถานะ Lot เป็น 'COMPLETED'
  const updateLotSql = `
    UPDATE rubber_lots 
    SET status = 'COMPLETED', updated_at = DATETIME('now', '+7 hours')
    WHERE id = ?;
  `;
  await db.prepare(updateLotSql).bind(lot.id).run();

  // บันทึก Audit Log
  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'SETTLE_RUBBER_SALE',
        resourceType: 'rubber_sale',
        resourceId: cleanSaleNo,
        details: {
          saleNo: cleanSaleNo,
          factoryWeightKg: factoryWeight,
          grossRevenue: settlement.grossRevenue,
          netRevenue: settlement.netRevenue,
          netProfit: settlement.netProfit,
          marginPerKg: settlement.marginPerKg
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return updatedSale || {
    ...sale,
    ...settlement,
    factory_weight_kg: factoryWeight,
    status: 'CLOSED'
  };
}

/**
 * ดึงข้อมูลบิลขายพร้อมข้อมูล Lot และบิลซื้อย่อยทั้งหมด
 * @param {D1Database} db 
 * @param {string} saleNo 
 * @returns {Promise<{ sale: object, lot: object, items: Array<object> } | null>}
 */
export async function getSaleByNo(db, saleNo) {
  const saleSql = `SELECT * FROM rubber_sales WHERE sale_no = ?`;
  const sale = await db.prepare(saleSql).bind(saleNo).first();
  if (!sale) return null;

  const lotSql = `SELECT * FROM rubber_lots WHERE id = ?`;
  const lot = await db.prepare(lotSql).bind(sale.lot_id).first();

  const itemsSql = `SELECT * FROM rubber_purchases WHERE lot_id = ? ORDER BY id ASC`;
  const { results } = await db.prepare(itemsSql).bind(sale.lot_id).all();

  return {
    sale,
    lot,
    items: results || []
  };
}

/**
 * ดึงข้อมูลบิลขายจากรหัส Lot
 * @param {D1Database} db 
 * @param {string} lotNo 
 * @returns {Promise<object | null>}
 */
export async function getSaleByLotNo(db, lotNo) {
  const lotSql = `SELECT id FROM rubber_lots WHERE lot_no = ?`;
  const lot = await db.prepare(lotSql).bind(lotNo).first();
  if (!lot) return null;

  const saleSql = `SELECT * FROM rubber_sales WHERE lot_id = ?`;
  return await db.prepare(saleSql).bind(lot.id).first();
}

/**
 * ดึงรายการบิลขายทั้งหมดพร้อม Pagination, Filter, และสรุปผลรวมกำไร
 * @param {D1Database} db 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function listSales(db, options = {}) {
  const {
    page = 1,
    pageSize = 20,
    status,
    factoryName,
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

  if (factoryName && String(factoryName).trim()) {
    conditions.push(`factory_name = ?`);
    params.push(String(factoryName).trim());
  }

  if (dateFrom) {
    conditions.push(`ship_date >= ?`);
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(`ship_date <= ?`);
    params.push(dateTo);
  }

  if (search && String(search).trim()) {
    conditions.push(`(sale_no LIKE ? OR factory_name LIKE ?)`);
    const term = `%${String(search).trim()}%`;
    params.push(term, term);
  }

  const whereClause = conditions.join(' AND ');

  const statQuery = `
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(outbound_weight_kg), 0) as sum_outbound_weight,
      COALESCE(SUM(factory_weight_kg), 0) as sum_factory_weight,
      COALESCE(SUM(gross_revenue), 0) as sum_gross_revenue,
      COALESCE(SUM(net_revenue), 0) as sum_net_revenue,
      COALESCE(SUM(net_profit), 0) as sum_net_profit
    FROM rubber_sales 
    WHERE ${whereClause}
  `;
  const stats = await db.prepare(statQuery).bind(...params).first();

  const total = stats ? stats.total_count : 0;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const listQuery = `
    SELECT * FROM rubber_sales 
    WHERE ${whereClause}
    ORDER BY ship_date DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  const listParams = [...params, pageSize, offset];
  const { results } = await db.prepare(listQuery).bind(...listParams).all();

  return {
    items: results || [],
    total,
    sumOutboundWeight: stats ? Math.round(stats.sum_outbound_weight * 100) / 100 : 0,
    sumFactoryWeight: stats ? Math.round(stats.sum_factory_weight * 100) / 100 : 0,
    sumGrossRevenue: stats ? Math.round(stats.sum_gross_revenue * 100) / 100 : 0,
    sumNetRevenue: stats ? Math.round(stats.sum_net_revenue * 100) / 100 : 0,
    sumNetProfit: stats ? Math.round(stats.sum_net_profit * 100) / 100 : 0,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / pageSize) || 1
  };
}

/**
 * ยกเลิกบิลส่งขายและคืนสถานะ Lot กลับเป็น 'LOCKED'
 * @param {D1Database} db 
 * @param {string} saleNo 
 * @param {string} [cancelReason] 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
export async function cancelSaleRecord(db, saleNo, cancelReason = '', options = {}) {
  const cleanSaleNo = String(saleNo).trim();
  const saleQuery = `SELECT * FROM rubber_sales WHERE sale_no = ?`;
  const sale = await db.prepare(saleQuery).bind(cleanSaleNo).first();

  if (!sale) {
    throw new Error(`ไม่พบเอกสารบิลส่งขายเลขที่ '${cleanSaleNo}' ในระบบ`);
  }

  // 1. คืนสถานะ Lot เป็น 'LOCKED' เพื่อให้แก้ไขหรือส่งขายใหม่ได้
  const updateLotSql = `
    UPDATE rubber_lots 
    SET status = 'LOCKED', updated_at = DATETIME('now', '+7 hours')
    WHERE id = ?;
  `;
  await db.prepare(updateLotSql).bind(sale.lot_id).run();

  // 2. ลบบิลขายหรือเคลียร์สถานะ
  const deleteSaleSql = `DELETE FROM rubber_sales WHERE id = ?;`;
  await db.prepare(deleteSaleSql).bind(sale.id).run();

  if (options.actorEmail) {
    try {
      await recordAuditLog(db, {
        actorEmail: options.actorEmail,
        actorRole: options.actorRole || 'Manager',
        action: 'CANCEL_RUBBER_SALE',
        resourceType: 'rubber_sale',
        resourceId: cleanSaleNo,
        details: {
          saleNo: cleanSaleNo,
          cancelReason,
          lotId: sale.lot_id
        },
        ipAddress: options.ipAddress || '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('⚠️ Audit log warning:', auditErr.message);
    }
  }

  return { success: true, message: `ยกเลิกบิลส่งขาย '${cleanSaleNo}' และคืนสถานะ Lot เรียบร้อยแล้ว` };
}
