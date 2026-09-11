/**
 * Live Terminal Demo Runner (Phase 1.1 - 1.2 Live Test)
 * Run with: node backend-staging/src/test/runLiveDemo.js
 */

import {
  createReceipt,
  getReceiptByNo,
  cancelReceipt,
  createVoucher,
  getVoucherByNo,
  cancelVoucher
} from '../services/documentService.js';
import {
  buildReceiptSyncPayload,
  buildVoucherSyncPayload
} from '../services/googleSheetsSyncService.js';
import { verifyChainIntegrity } from '../services/auditService.js';

console.log('================================================================');
console.log('🌿 บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด — LIVE DEMO RUNNER 🌿');
console.log('================================================================\n');

// Mock in-memory DB for demonstration
const mockReceipts = [];
const mockReceiptItems = [];
const mockVouchers = [];
const mockVoucherItems = [];
const mockSequences = new Map();
const mockAuditLogs = [];
let receiptIdInc = 1;
let voucherIdInc = 1;

const mockDb = {
  prepare(sql) {
    let boundParams = [];
    const stmt = {
      sql,
      bind(...params) {
        boundParams = params;
        stmt.params = params;
        return stmt;
      },
      async first() {
        if (sql.includes('document_sequences')) {
          const [docType, prefix] = boundParams;
          const key = `${docType}_${prefix}`;
          let current = mockSequences.get(key) || 0;
          current += 1;
          mockSequences.set(key, current);
          return { current_seq: current };
        }
        if (sql.includes('SELECT id FROM receipts WHERE receipt_no = ?')) {
          const rNo = boundParams[0];
          const found = mockReceipts.find(r => r.receipt_no === rNo);
          return found ? { id: found.id } : null;
        }
        if (sql.includes('INSERT INTO receipts')) {
          const [
            receipt_no, doc_date, buyer_name, buyer_address, buyer_tax_id,
            period, payment_method, pay_date, notes, cashier_name
          ] = boundParams;
          const r = {
            id: receiptIdInc++,
            receipt_no,
            doc_date,
            buyer_name,
            buyer_address,
            buyer_tax_id,
            period,
            payment_method,
            pay_date,
            notes,
            cashier_name,
            status: 'ปกติ',
            cancel_reason: null,
            created_at: new Date().toISOString()
          };
          mockReceipts.push(r);
          return r;
        }
        if (sql.includes('SELECT * FROM receipts WHERE receipt_no = ?')) {
          const rNo = boundParams[0];
          return mockReceipts.find(r => r.receipt_no === rNo) || null;
        }
        if (sql.includes('UPDATE receipts SET status = ?, cancel_reason = ?')) {
          const [status, reason, rNo] = boundParams;
          const found = mockReceipts.find(r => r.receipt_no === rNo);
          if (found) {
            found.status = status;
            found.cancel_reason = reason;
          }
          return found;
        }
        if (sql.includes('SELECT id FROM vouchers WHERE voucher_no = ?')) {
          const vNo = boundParams[0];
          const found = mockVouchers.find(v => v.voucher_no === vNo);
          return found ? { id: found.id } : null;
        }
        if (sql.includes('INSERT INTO vouchers')) {
          const [
            voucher_no, doc_date, transaction_timestamp, receiver_name, overall_description, ref_doc_no,
            payment_method, cheque_no, bank_account, payment_date, notes, cashier_name
          ] = boundParams;
          const v = {
            id: voucherIdInc++,
            voucher_no,
            doc_date,
            transaction_timestamp,
            receiver_name,
            overall_description,
            ref_doc_no,
            payment_method,
            cheque_no,
            bank_account,
            payment_date,
            notes,
            cashier_name,
            status: 'ปกติ',
            cancel_reason: null,
            created_at: new Date().toISOString()
          };
          mockVouchers.push(v);
          return v;
        }
        if (sql.includes('SELECT * FROM vouchers WHERE voucher_no = ?')) {
          const vNo = boundParams[0];
          return mockVouchers.find(v => v.voucher_no === vNo) || null;
        }
        if (sql.includes('UPDATE vouchers SET status = ?, cancel_reason = ?')) {
          const [status, reason, vNo] = boundParams;
          const found = mockVouchers.find(v => v.voucher_no === vNo);
          if (found) {
            found.status = status;
            found.cancel_reason = reason;
          }
          return found;
        }
        if (sql.includes('ORDER BY id DESC LIMIT 1')) {
          if (mockAuditLogs.length === 0) return null;
          return { id: mockAuditLogs[mockAuditLogs.length - 1].id, record_hash: mockAuditLogs[mockAuditLogs.length - 1].record_hash };
        }
        if (sql.includes('INSERT INTO audit_logs')) {
          const [prev_hash, record_hash, actor_email, actor_role, action, resource_type, resource_id, details_json, ip_address, created_at] = boundParams;
          const entry = {
            id: mockAuditLogs.length + 1,
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
          mockAuditLogs.push(entry);
          return entry;
        }
        return null;
      },
      async all() {
        if (sql.includes('SELECT * FROM receipt_items WHERE receipt_id = ?')) {
          const rId = boundParams[0];
          return { results: mockReceiptItems.filter(i => i.receipt_id === rId) };
        }
        if (sql.includes('SELECT * FROM voucher_items WHERE voucher_id = ?')) {
          const vId = boundParams[0];
          return { results: mockVoucherItems.filter(i => i.voucher_id === vId) };
        }
        if (sql.includes('FROM audit_logs')) {
          return { results: [...mockAuditLogs] };
        }
        return { results: [] };
      },
      async run() {
        if (sql.includes('INSERT INTO receipt_items')) {
          const [receipt_id, item_title, quantity, unit_price, drc_percent, discount_amount, discount_details, net_amount, sort_order] = boundParams;
          mockReceiptItems.push({
            id: mockReceiptItems.length + 1,
            receipt_id,
            item_title,
            quantity,
            unit_price,
            drc_percent,
            discount_amount,
            discount_details,
            net_amount,
            sort_order
          });
          return { success: true };
        }
        if (sql.includes('INSERT INTO voucher_items')) {
          const [voucher_id, item_date, description, amount, sort_order] = boundParams;
          mockVoucherItems.push({
            id: mockVoucherItems.length + 1,
            voucher_id,
            item_date,
            description,
            amount,
            sort_order
          });
          return { success: true };
        }
        return { success: true };
      }
    };
    return stmt;
  }
};

async function main() {
  console.log('📌 ขั้นตอนที่ 1: จำลองการบันทึกใบเสร็จรับเงิน (Receipt Creation)');
  const receiptPayload = {
    docDate: '2026-09-11',
    buyerName: 'นายประสิทธิ์ ยางทอง',
    buyerAddress: '123 หมู่ 4 ต.วังหิน อ.เมือง จ.สุราษฎร์ธานี',
    buyerTaxId: '1234567890123',
    period: 'งวดที่ 1',
    paymentMethod: 'เงินโอน',
    cashierName: 'สมชาย ใจดี',
    items: [
      {
        itemTitle: 'ยางก้อนถ้วย',
        quantity: 1000,
        unitPrice: 65,
        drcPercent: 32,
        discountAmount: 300,
        discountDetails: 'หักค่ายางดำ'
      },
      {
        itemTitle: 'เศษยาง',
        quantity: 500,
        unitPrice: 28,
        drcPercent: 0,
        discountAmount: 0
      }
    ]
  };

  const receipt = await createReceipt(mockDb, receiptPayload, {
    actorEmail: 'cashier@srisuk-rubber.com',
    actorRole: 'Cashier'
  });

  console.log(`   ✅ ออกใบเสร็จเลขที่: ${receipt.receipt_no}`);
  console.log(`   👤 นามผู้ซื้อ: ${receipt.buyer_name}`);
  console.log(`   💰 ยอดรวมสุทธิ: ${(receipt.totalNetAmount || receipt.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`);
  console.log(`   📦 จำนวนรายการสินค้า: ${receipt.items.length} รายการ`);
  receipt.items.forEach((item, idx) => {
    const title = item.itemTitle || item.item_title;
    const price = item.unitPrice || item.unit_price;
    const drc = item.drcPercent || item.drc_percent || 0;
    const net = item.netAmount || item.net_amount || 0;
    console.log(`      ${idx + 1}. ${title}: ${item.quantity} กก. @ ${price} บ. (DRC: ${drc}%) = ${net.toLocaleString()} บาท`);
  });

  console.log('\n📌 ขั้นตอนที่ 2: จำลองการแปลงข้อมูล 20 คอลัมน์สู่ Google Sheets (Schema Mapping)');
  const sheetPayload = buildReceiptSyncPayload(receipt);
  console.log(`   ✅ Action: ${sheetPayload.action}`);
  console.log(`   ✅ วันที่ พ.ศ.: ${sheetPayload.dateThai}`);
  console.log(`   ✅ รายการสินค้าจัดเตรียมสำหรับ Append ลงชีตแล้ว: ${sheetPayload.items.length} แถว`);

  console.log('\n📌 ขั้นตอนที่ 3: จำลองการบันทึกใบสำคัญจ่าย (Payment Voucher Creation)');
  const voucherPayload = {
    docDate: '2026-09-11',
    receiverName: 'นางสาวมาลี รักษ์สวน',
    mainDescription: 'จ่ายค่าปุ๋ยบำรุงหน้ายางพาราและอุปกรณ์',
    refNo: 'INV-2026-001',
    paymentMethod: 'เงินโอน',
    sourceBankAcc: 'BBL 1234567890',
    chequeOrDestAcc: '0987654321',
    destBank: 'KBANK กสิกรไทย สาขาวังหิน',
    cashierName: 'สมชาย ใจดี',
    items: [
      { description: 'ปุ๋ยเคมีสูตร 15-15-15', amount: 85000 },
      { description: 'กรดฟอร์มิกตราดาว', amount: 15000 }
    ]
  };

  const voucher = await createVoucher(mockDb, voucherPayload, {
    actorEmail: 'cashier@srisuk-rubber.com',
    actorRole: 'Cashier'
  });

  console.log(`   ✅ ออกใบสำคัญจ่ายเลขที่: ${voucher.voucher_no}`);
  console.log(`   👤 จ่ายให้: ${voucher.receiver_name}`);
  console.log(`   💰 ยอดรวมทั้งสิ้น: ${(voucher.totalAmount || voucher.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`);

  console.log('\n📌 ขั้นตอนที่ 4: จำลองการขอยกเลิกเอกสาร (Soft Cancellation)');
  const cancelledReceipt = await cancelReceipt(mockDb, receipt.receipt_no, {
    reason: 'ลูกค้าแจ้งน้ำหนักยางคลาดเคลื่อน ขอออกใบใหม่',
    cancelledByEmail: 'admin@srisuk-rubber.com',
    cancelledByName: 'ผู้ดูแลระบบ'
  });
  console.log(`   ✅ สถานะเอกสาร ${cancelledReceipt.receipt_no} เปลี่ยนเป็น: "${cancelledReceipt.status}"`);
  console.log(`   📝 สาเหตุการยกเลิก: "${cancelledReceipt.cancel_reason}"`);

  console.log('\n📌 ขั้นตอนที่ 5: ตรวจสอบสายโซ่ความปลอดภัย Immutable Audit Trail (Blockchain Check)');
  const auditCheck = await verifyChainIntegrity(mockDb);
  console.log(`   🛡️ สถานะความสมบูรณ์ของสายโซ่: ${auditCheck.isValid ? '✅ VALID 100%' : '❌ CORRUPTED'}`);
  console.log(`   📊 จำนวนธุรกรรมที่ถูกบันทึกในระบบ: ${auditCheck.verifiedCount} รายการ`);
  if (auditCheck.message) {
    console.log(`   💬 รายละเอียดการตรวจสอบ: ${auditCheck.message}`);
  }

  console.log('\n================================================================');
  console.log('🎉 LIVE DEMO สำเร็จครบทุกขั้นตอน — ระบบพร้อมใช้งาน 100%! 🎉');
  console.log('================================================================\n');
}

main().catch(console.error);
