/**
 * Complete Document CRUD Service (Phase 1.1)
 * Receipts & Payment Vouchers Management Engine
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

import { getNextDocumentNumber } from './sequenceService.js';
import { recordAuditLog } from './auditService.js';

/**
 * Normalizes numbers safely
 */
function toNum(val, fallback = 0) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

// ==========================================
// 1. RECEIPTS MANAGEMENT (ใบเสร็จรับเงิน)
// ==========================================

/**
 * Creates a new Receipt with Header & Items in D1 Transaction
 */
export async function createReceipt(db, payload, options = {}) {
  const {
    docDate,
    buyerName,
    buyerAddress = '',
    buyerTaxId = '',
    period = '',
    paymentMethod = 'เงินโอน',
    payDate = '',
    notes = '',
    cashierName = 'ระบบส่วนกลาง',
    items = []
  } = payload;

  if (!docDate || !buyerName) {
    throw new Error('กรุณาระบุ วันที่เอกสาร (docDate) และ นามผู้ซื้อ (buyerName)');
  }

  if (!items || items.length === 0) {
    throw new Error('ใบเสร็จต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
  }

  // 1. Generate Atomic Document Sequence Number if not provided
  let receiptNo = payload.receiptNo;
  if (!receiptNo) {
    const seq = await getNextDocumentNumber(db, 'receipt', docDate);
    receiptNo = seq.formattedNumber || seq.documentNumber;
  }

  // Check unique receipt_no
  const existing = await db.prepare('SELECT id FROM receipts WHERE receipt_no = ?').bind(receiptNo).first();
  if (existing) {
    throw new Error(`เลขที่ใบเสร็จ ${receiptNo} มีอยู่ในระบบแล้ว`);
  }

  // 2. Validate and calculate item amounts
  const processedItems = items.map((item, index) => {
    const quantity = toNum(item.quantity);
    const unitPrice = toNum(item.unitPrice || item.price);
    const drcPercent = toNum(item.drcPercent || item.drc, 0);
    const discountAmount = toNum(item.discountAmount || item.discount, 0);
    
    // DRC multiplier: if DRC is specified (> 0), multiply weight by DRC%
    const drcMultiplier = drcPercent > 0 ? drcPercent / 100 : 1;
    const baseTotal = quantity * unitPrice * drcMultiplier;
    const netAmount = Math.round((baseTotal - discountAmount) * 100) / 100;

    return {
      itemTitle: (item.itemTitle || item.title || item.item || 'ยางพารา').trim(),
      quantity,
      unitPrice,
      drcPercent,
      discountAmount,
      discountDetails: (item.discountDetails || item.discountDetail || '').trim(),
      netAmount,
      sortOrder: index + 1
    };
  });

  const totalNetAmount = processedItems.reduce((sum, item) => sum + item.netAmount, 0);

  // 3. Insert Header into D1
  const headerStmt = db.prepare(`
    INSERT INTO receipts (
      receipt_no, doc_date, buyer_name, buyer_address, buyer_tax_id,
      period, payment_method, pay_date, notes, cashier_name, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ปกติ')
    RETURNING id, receipt_no, doc_date, buyer_name, buyer_address, buyer_tax_id,
              period, payment_method, pay_date, notes, cashier_name, status, created_at
  `).bind(
    receiptNo,
    docDate,
    buyerName.trim(),
    buyerAddress.trim(),
    buyerTaxId.trim(),
    period.trim(),
    paymentMethod,
    payDate || docDate,
    notes.trim(),
    cashierName.trim()
  );

  const header = await headerStmt.first();
  const receiptId = header.id;

  // 4. Batch Insert Items into D1
  const itemStatements = processedItems.map(item => {
    return db.prepare(`
      INSERT INTO receipt_items (
        receipt_id, item_title, quantity, unit_price, drc_percent,
        discount_amount, discount_details, net_amount, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      receiptId,
      item.itemTitle,
      item.quantity,
      item.unitPrice,
      item.drcPercent,
      item.discountAmount,
      item.discountDetails,
      item.netAmount,
      item.sortOrder
    );
  });

  if (typeof db.batch === 'function') {
    await db.batch(itemStatements);
  } else {
    for (const stmt of itemStatements) {
      await stmt.run();
    }
  }

  // 5. Record Immutable Audit Log
  const actorEmail = options.actorEmail || 'system@srisuk-rubber.com';
  const actorRole = options.actorRole || 'Cashier';
  try {
    await recordAuditLog(db, {
      actorEmail,
      actorRole,
      action: 'CREATE_RECEIPT',
      resourceType: 'receipt',
      resourceId: receiptNo,
      details: {
        receiptId,
        buyerName,
        totalNetAmount,
        itemCount: processedItems.length
      },
      ipAddress: options.ipAddress || '127.0.0.1'
    });
  } catch (auditErr) {
    console.error('Audit Log Error:', auditErr);
  }

  return {
    ...header,
    totalNetAmount,
    items: processedItems
  };
}

/**
 * Gets a single Receipt by receipt_no with all items
 */
export async function getReceiptByNo(db, receiptNo) {
  const header = await db.prepare(`
    SELECT * FROM receipts WHERE receipt_no = ?
  `).bind(receiptNo).first();

  if (!header) return null;

  const itemsRes = await db.prepare(`
    SELECT id, item_title, quantity, unit_price, drc_percent,
           discount_amount, discount_details, net_amount, sort_order
    FROM receipt_items
    WHERE receipt_id = ?
    ORDER BY sort_order ASC
  `).bind(header.id).all();

  const items = itemsRes.results || [];
  const totalNetAmount = items.reduce((sum, it) => sum + it.net_amount, 0);

  return {
    ...header,
    totalNetAmount,
    items
  };
}

/**
 * Cancels a Receipt with reason and writes audit log
 */
export async function cancelReceipt(db, receiptNo, { reason, cancelledByEmail, cancelledByName }) {
  if (!reason) {
    throw new Error('กรุณาระบุสาเหตุการยกเลิกใบเสร็จ');
  }

  const receipt = await getReceiptByNo(db, receiptNo);
  if (!receipt) {
    throw new Error(`ไม่พบใบเสร็จเลขที่ ${receiptNo} ในระบบ`);
  }

  if (receipt.status === 'ยกเลิก') {
    throw new Error(`ใบเสร็จเลขที่ ${receiptNo} ถูกยกเลิกไปก่อนหน้านี้แล้ว`);
  }

  await db.prepare(`
    UPDATE receipts
    SET status = 'ยกเลิก',
        cancel_reason = ?,
        updated_at = DATETIME('now', '+7 hours')
    WHERE receipt_no = ?
  `).bind(reason.trim(), receiptNo).run();

  // Audit log
  try {
    await recordAuditLog(db, {
      actorEmail: cancelledByEmail || 'admin@srisuk-rubber.com',
      actorRole: 'Admin',
      action: 'CANCEL_RECEIPT',
      resourceType: 'receipt',
      resourceId: receiptNo,
      details: {
        reason,
        cancelledByName,
        originalAmount: receipt.totalNetAmount
      }
    });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }

  return {
    ...receipt,
    status: 'ยกเลิก',
    cancel_reason: reason
  };
}

/**
 * Lists Receipts with Filtering and Pagination
 */
export async function listReceipts(db, {
  search = '',
  status = '',
  startDate = '',
  endDate = '',
  cashierName = '',
  page = 1,
  pageSize = 20
} = {}) {
  const conditions = [];
  const bindings = [];

  if (status) {
    conditions.push('r.status = ?');
    bindings.push(status);
  }
  if (startDate) {
    conditions.push('r.doc_date >= ?');
    bindings.push(startDate);
  }
  if (endDate) {
    conditions.push('r.doc_date <= ?');
    bindings.push(endDate);
  }
  if (cashierName) {
    conditions.push('r.cashier_name = ?');
    bindings.push(cashierName);
  }
  if (search) {
    conditions.push('(r.receipt_no LIKE ? OR r.buyer_name LIKE ? OR r.notes LIKE ?)');
    const term = `%${search.trim()}%`;
    bindings.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * pageSize;

  const countQuery = `SELECT COUNT(*) as total FROM receipts r ${whereClause}`;
  const countStmt = db.prepare(countQuery);
  const totalRes = bindings.length > 0 ? await countStmt.bind(...bindings).first() : await countStmt.first();
  const total = totalRes ? totalRes.total : 0;

  const listQuery = `
    SELECT r.id, r.receipt_no, r.doc_date, r.buyer_name, r.period,
           r.payment_method, r.pay_date, r.cashier_name, r.status, r.cancel_reason, r.created_at,
           COALESCE(SUM(ri.net_amount), 0) as total_amount,
           COUNT(ri.id) as item_count
    FROM receipts r
    LEFT JOIN receipt_items ri ON r.id = ri.receipt_id
    ${whereClause}
    GROUP BY r.id
    ORDER BY r.id DESC
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
    receipts: listRes.results || []
  };
}

// ==========================================
// 2. PAYMENT VOUCHERS MANAGEMENT (ใบสำคัญจ่าย)
// ==========================================

/**
 * Creates a new Payment Voucher with Header & Items in D1 Transaction
 */
export async function createVoucher(db, payload, options = {}) {
  const {
    docDate,
    receiverName,
    overallDescription = '',
    refDocNo = '',
    paymentMethod = 'เงินโอน',
    chequeNo = '',
    bankAccount = '',
    paymentDate = '',
    notes = '',
    cashierName = 'ระบบส่วนกลาง',
    items = []
  } = payload;

  if (!docDate || !receiverName) {
    throw new Error('กรุณาระบุ วันที่เอกสาร (docDate) และ จ่ายให้ (receiverName)');
  }

  if (!items || items.length === 0) {
    throw new Error('ใบสำคัญจ่ายต้องมีรายการย่อยอย่างน้อย 1 รายการ');
  }

  // 1. Generate Atomic Voucher Sequence Number if not provided
  let voucherNo = payload.voucherNo;
  if (!voucherNo) {
    const seq = await getNextDocumentNumber(db, 'voucher', docDate);
    voucherNo = seq.formattedNumber || seq.documentNumber;
  }

  // Check unique voucher_no
  const existing = await db.prepare('SELECT id FROM vouchers WHERE voucher_no = ?').bind(voucherNo).first();
  if (existing) {
    throw new Error(`เลขที่ใบสำคัญจ่าย ${voucherNo} มีอยู่ในระบบแล้ว`);
  }

  const timestamp = new Date().toISOString();

  // 2. Insert Voucher Header
  const headerStmt = db.prepare(`
    INSERT INTO vouchers (
      voucher_no, doc_date, transaction_timestamp, receiver_name,
      overall_description, ref_doc_no, payment_method, cheque_no,
      bank_account, payment_date, notes, cashier_name, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ปกติ')
    RETURNING id, voucher_no, doc_date, receiver_name, overall_description,
              ref_doc_no, payment_method, cheque_no, bank_account,
              payment_date, notes, cashier_name, status, created_at
  `).bind(
    voucherNo,
    docDate,
    timestamp,
    receiverName.trim(),
    overallDescription.trim(),
    refDocNo.trim(),
    paymentMethod,
    chequeNo.trim(),
    bankAccount.trim(),
    paymentDate || docDate,
    notes.trim(),
    cashierName.trim()
  );

  const header = await headerStmt.first();
  const voucherId = header.id;

  // 3. Batch Insert Items
  let totalAmount = 0;
  const processedItems = items.map((item, index) => {
    const amount = toNum(item.amount);
    totalAmount += amount;
    return {
      itemDate: (item.itemDate || docDate).trim(),
      description: (item.description || item.title || '').trim(),
      amount,
      sortOrder: index + 1
    };
  });

  const itemStatements = processedItems.map(item => {
    return db.prepare(`
      INSERT INTO voucher_items (
        voucher_id, item_date, description, amount, sort_order
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      voucherId,
      item.itemDate,
      item.description,
      item.amount,
      item.sortOrder
    );
  });

  if (typeof db.batch === 'function') {
    await db.batch(itemStatements);
  } else {
    for (const stmt of itemStatements) {
      await stmt.run();
    }
  }

  // 4. Record Immutable Audit Log
  try {
    await recordAuditLog(db, {
      actorEmail: options.actorEmail || 'system@srisuk-rubber.com',
      actorRole: options.actorRole || 'Cashier',
      action: 'CREATE_VOUCHER',
      resourceType: 'voucher',
      resourceId: voucherNo,
      details: {
        voucherId,
        receiverName,
        totalAmount,
        itemCount: processedItems.length
      },
      ipAddress: options.ipAddress || '127.0.0.1'
    });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }

  return {
    ...header,
    totalAmount,
    items: processedItems
  };
}

/**
 * Gets a single Payment Voucher by voucher_no with all items
 */
export async function getVoucherByNo(db, voucherNo) {
  const header = await db.prepare(`
    SELECT * FROM vouchers WHERE voucher_no = ?
  `).bind(voucherNo).first();

  if (!header) return null;

  const itemsRes = await db.prepare(`
    SELECT id, item_date, description, amount, sort_order
    FROM voucher_items
    WHERE voucher_id = ?
    ORDER BY sort_order ASC
  `).bind(header.id).all();

  const items = itemsRes.results || [];
  const totalAmount = items.reduce((sum, it) => sum + it.amount, 0);

  return {
    ...header,
    totalAmount,
    items
  };
}

/**
 * Cancels a Payment Voucher with reason and audit log
 */
export async function cancelVoucher(db, voucherNo, { reason, cancelledByEmail, cancelledByName }) {
  if (!reason) {
    throw new Error('กรุณาระบุสาเหตุการยกเลิกใบสำคัญจ่าย');
  }

  const voucher = await getVoucherByNo(db, voucherNo);
  if (!voucher) {
    throw new Error(`ไม่พบใบสำคัญจ่ายเลขที่ ${voucherNo} ในระบบ`);
  }

  if (voucher.status === 'ยกเลิก') {
    throw new Error(`ใบสำคัญจ่ายเลขที่ ${voucherNo} ถูกยกเลิกไปแล้ว`);
  }

  await db.prepare(`
    UPDATE vouchers
    SET status = 'ยกเลิก',
        cancel_reason = ?,
        updated_at = DATETIME('now', '+7 hours')
    WHERE voucher_no = ?
  `).bind(reason.trim(), voucherNo).run();

  try {
    await recordAuditLog(db, {
      actorEmail: cancelledByEmail || 'admin@srisuk-rubber.com',
      actorRole: 'Admin',
      action: 'CANCEL_VOUCHER',
      resourceType: 'voucher',
      resourceId: voucherNo,
      details: {
        reason,
        cancelledByName,
        originalAmount: voucher.totalAmount
      }
    });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }

  return {
    ...voucher,
    status: 'ยกเลิก',
    cancel_reason: reason
  };
}

/**
 * Lists Payment Vouchers with Filtering and Pagination
 */
export async function listVouchers(db, {
  search = '',
  status = '',
  startDate = '',
  endDate = '',
  cashierName = '',
  page = 1,
  pageSize = 20
} = {}) {
  const conditions = [];
  const bindings = [];

  if (status) {
    conditions.push('v.status = ?');
    bindings.push(status);
  }
  if (startDate) {
    conditions.push('v.doc_date >= ?');
    bindings.push(startDate);
  }
  if (endDate) {
    conditions.push('v.doc_date <= ?');
    bindings.push(endDate);
  }
  if (cashierName) {
    conditions.push('v.cashier_name = ?');
    bindings.push(cashierName);
  }
  if (search) {
    conditions.push('(v.voucher_no LIKE ? OR v.receiver_name LIKE ? OR v.overall_description LIKE ?)');
    const term = `%${search.trim()}%`;
    bindings.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * pageSize;

  const countQuery = `SELECT COUNT(*) as total FROM vouchers v ${whereClause}`;
  const countStmt = db.prepare(countQuery);
  const totalRes = bindings.length > 0 ? await countStmt.bind(...bindings).first() : await countStmt.first();
  const total = totalRes ? totalRes.total : 0;

  const listQuery = `
    SELECT v.id, v.voucher_no, v.doc_date, v.receiver_name, v.overall_description,
           v.payment_method, v.payment_date, v.cashier_name, v.status, v.cancel_reason, v.created_at,
           COALESCE(SUM(vi.amount), 0) as total_amount,
           COUNT(vi.id) as item_count
    FROM vouchers v
    LEFT JOIN voucher_items vi ON v.id = vi.voucher_id
    ${whereClause}
    GROUP BY v.id
    ORDER BY v.id DESC
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
    vouchers: listRes.results || []
  };
}
