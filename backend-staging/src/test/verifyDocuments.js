/**
 * Verification Test for Complete Document CRUD Operations (Phase 1.1)
 * Receipts & Payment Vouchers Engine
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

import {
  createReceipt,
  getReceiptByNo,
  cancelReceipt,
  listReceipts,
  createVoucher,
  getVoucherByNo,
  cancelVoucher,
  listVouchers
} from '../services/documentService.js';

async function runTests() {
  console.log('🧪 Starting Document CRUD Engine Logic Tests (Phase 1.1)...\n');
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, testName) {
    if (actual === expected) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} (Expected: ${expected}, Got: ${actual})`);
      failed++;
    }
  }

  // In-memory mock tables for D1
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
          // 1. Sequences Upsert
          if (sql.includes('document_sequences')) {
            const [docType, prefix, defaultSeq] = boundParams;
            const key = `${docType}_${prefix}`;
            let current = mockSequences.get(key) || 0;
            current += 1;
            mockSequences.set(key, current);
            return { current_seq: current };
          }

          // 2. Receipt Check Existing
          if (sql.includes('SELECT id FROM receipts WHERE receipt_no = ?')) {
            const rNo = boundParams[0];
            const found = mockReceipts.find(r => r.receipt_no === rNo);
            return found ? { id: found.id } : null;
          }

          // 3. Insert Receipt Header
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

          // 4. Get Receipt Header
          if (sql.includes('SELECT * FROM receipts WHERE receipt_no = ?')) {
            const rNo = boundParams[0];
            return mockReceipts.find(r => r.receipt_no === rNo) || null;
          }

          // 5. Voucher Check Existing
          if (sql.includes('SELECT id FROM vouchers WHERE voucher_no = ?')) {
            const vNo = boundParams[0];
            const found = mockVouchers.find(v => v.voucher_no === vNo);
            return found ? { id: found.id } : null;
          }

          // 6. Insert Voucher Header
          if (sql.includes('INSERT INTO vouchers')) {
            const [
              voucher_no, doc_date, transaction_timestamp, receiver_name,
              overall_description, ref_doc_no, payment_method, cheque_no,
              bank_account, payment_date, notes, cashier_name
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

          // 7. Get Voucher Header
          if (sql.includes('SELECT * FROM vouchers WHERE voucher_no = ?')) {
            const vNo = boundParams[0];
            return mockVouchers.find(v => v.voucher_no === vNo) || null;
          }

          // 8. Audit Logs last record & insert
          if (sql.includes('SELECT id, record_hash FROM audit_logs')) {
            const last = mockAuditLogs[mockAuditLogs.length - 1];
            return last ? { id: last.id, record_hash: last.record_hash } : null;
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            const [prev_hash, record_hash, actor_email, actor_role, action, resource_type, resource_id] = boundParams;
            const log = { id: mockAuditLogs.length + 1, prev_hash, record_hash, action, resource_type, resource_id };
            mockAuditLogs.push(log);
            return log;
          }

          // 9. Count Queries
          if (sql.includes('COUNT(*) as total FROM receipts')) {
            return { total: mockReceipts.length };
          }
          if (sql.includes('COUNT(*) as total FROM vouchers')) {
            return { total: mockVouchers.length };
          }

          return null;
        },
        async all() {
          // Receipt Items
          if (sql.includes('FROM receipt_items') && sql.includes('WHERE receipt_id = ?')) {
            const rId = boundParams[0];
            const items = mockReceiptItems.filter(it => it.receipt_id === rId);
            return { results: items };
          }
          // Voucher Items
          if (sql.includes('FROM voucher_items') && sql.includes('WHERE voucher_id = ?')) {
            const vId = boundParams[0];
            const items = mockVoucherItems.filter(it => it.voucher_id === vId);
            return { results: items };
          }
          // List Receipts
          if (sql.includes('FROM receipts r')) {
            const mapped = mockReceipts.map(r => ({
              ...r,
              total_amount: mockReceiptItems
                .filter(it => it.receipt_id === r.id)
                .reduce((s, it) => s + it.net_amount, 0),
              item_count: mockReceiptItems.filter(it => it.receipt_id === r.id).length
            }));
            return { results: mapped };
          }
          // List Vouchers
          if (sql.includes('FROM vouchers v')) {
            const mapped = mockVouchers.map(v => ({
              ...v,
              total_amount: mockVoucherItems
                .filter(it => it.voucher_id === v.id)
                .reduce((s, it) => s + it.amount, 0),
              item_count: mockVoucherItems.filter(it => it.voucher_id === v.id).length
            }));
            return { results: mapped };
          }
          return { results: [] };
        },
        async run() {
          // Update Receipts
          if (sql.includes('UPDATE receipts') && sql.includes('ยกเลิก')) {
            const [cancel_reason, receipt_no] = boundParams;
            const target = mockReceipts.find(r => r.receipt_no === receipt_no);
            if (target) {
              target.status = 'ยกเลิก';
              target.cancel_reason = cancel_reason;
            }
            return { success: true };
          }
          // Update Vouchers
          if (sql.includes('UPDATE vouchers') && sql.includes('ยกเลิก')) {
            const [cancel_reason, voucher_no] = boundParams;
            const target = mockVouchers.find(v => v.voucher_no === voucher_no);
            if (target) {
              target.status = 'ยกเลิก';
              target.cancel_reason = cancel_reason;
            }
            return { success: true };
          }
          return { success: true };
        }
      };

      return stmt;
    },
    async batch(statements) {
      for (const stmt of statements) {
        const sql = stmt.sql || '';
        const params = stmt.params || [];
        // Insert Receipt Items
        if (sql.includes('receipt_items')) {
          const [receipt_id, item_title, quantity, unit_price, drc_percent, discount_amount, discount_details, net_amount, sort_order] = params;
          mockReceiptItems.push({
            receipt_id, item_title, quantity, unit_price, drc_percent, discount_amount, discount_details, net_amount, sort_order
          });
        }
        // Insert Voucher Items
        if (sql.includes('voucher_items')) {
          const [voucher_id, item_date, description, amount, sort_order] = params;
          mockVoucherItems.push({
            voucher_id, item_date, description, amount, sort_order
          });
        }
      }
      return [];
    }
  };

  // ==========================================
  // 1. Test Receipts Management
  // ==========================================
  console.log('--- Testing Receipts Creation & Calculations ---');

  const receiptData1 = {
    docDate: '2026-09-11',
    buyerName: 'บริษัท ไทยฮั้วยางพารา จำกัด (มหาชน)',
    buyerAddress: '123 ถ.สุขุมวิท กทม.',
    buyerTaxId: '0105551234567',
    period: 'งวด 1/09/69',
    paymentMethod: 'เงินโอน',
    cashierName: 'นางสาว สมใจ',
    items: [
      {
        itemTitle: 'น้ำยางสด (Field Latex)',
        quantity: 1000,
        unitPrice: 65,
        drcPercent: 32, // DRC 32% => 1000 * 65 * 0.32 = 20,800
        discountAmount: 300,
        discountDetails: 'หักค่ายางจับตัว'
      },
      {
        itemTitle: 'ยางก้อนถ้วย (Cup Lump)',
        quantity: 500,
        unitPrice: 28,
        drcPercent: 0, // No DRC => 500 * 28 = 14,000
        discountAmount: 0
      }
    ]
  };

  const createdR1 = await createReceipt(mockDb, receiptData1);

  assertEqual(createdR1.receipt_no, '69090001', 'First receipt auto-assigned sequence 69090001');
  assertEqual(createdR1.items[0].netAmount, 20500, 'Item 1 net amount calculated: 1000 * 65 * 0.32 - 300 = 20,500');
  assertEqual(createdR1.items[1].netAmount, 14000, 'Item 2 net amount calculated: 500 * 28 = 14,000');
  assertEqual(createdR1.totalNetAmount, 34500, 'Receipt total net amount is 34,500 บาท');

  // Test Audit log for receipt
  assertEqual(mockAuditLogs.some(l => l.action === 'CREATE_RECEIPT' && l.resource_id === '69090001'), true, 'Audit log recorded for CREATE_RECEIPT');

  // Test Second Receipt Sequence Auto-increment
  const receiptData2 = {
    docDate: '2026-09-11',
    buyerName: 'นาย สุรชัย มีทรัพย์',
    cashierName: 'นางสาว สมใจ',
    items: [{ itemTitle: 'เศษยาง', quantity: 200, unitPrice: 15, discountAmount: 0 }]
  };
  const createdR2 = await createReceipt(mockDb, receiptData2);
  assertEqual(createdR2.receipt_no, '69090002', 'Second receipt increments sequence to 69090002');

  // Test Get Receipt By No
  const fetchedR1 = await getReceiptByNo(mockDb, '69090001');
  assertEqual(fetchedR1.buyer_name, 'บริษัท ไทยฮั้วยางพารา จำกัด (มหาชน)', 'Fetched receipt matches buyer name');
  assertEqual(fetchedR1.items.length, 2, 'Fetched receipt includes all items');

  // Test Receipt Cancellation
  const cancelledR1 = await cancelReceipt(mockDb, '69090001', {
    reason: 'ลูกค้าขอเปลี่ยนรอบบิล',
    cancelledByEmail: 'admin@srisuk-rubber.com',
    cancelledByName: 'ผู้จัดการ'
  });
  assertEqual(cancelledR1.status, 'ยกเลิก', 'Receipt status changed to ยกเลิก');
  assertEqual(cancelledR1.cancel_reason, 'ลูกค้าขอเปลี่ยนรอบบิล', 'Receipt cancel reason recorded');

  // Prevent double cancellation
  let doubleCancelBlocked = false;
  try {
    await cancelReceipt(mockDb, '69090001', { reason: 'ยกเลิกซ้ำ' });
  } catch (e) {
    doubleCancelBlocked = true;
  }
  assertEqual(doubleCancelBlocked, true, 'Double cancellation is blocked with error');

  // Test List Receipts
  const receiptsList = await listReceipts(mockDb, { page: 1, pageSize: 10 });
  assertEqual(receiptsList.total, 2, 'List receipts returns total count 2');

  // ==========================================
  // 2. Test Payment Vouchers Management
  // ==========================================
  console.log('\n--- Testing Payment Vouchers Creation & Flow ---');

  const voucherData1 = {
    docDate: '2026-09-11',
    receiverName: 'สหกรณ์กองทุนสวนยาง จำกัด',
    overallDescription: 'จ่ายค่าซื้อยางแผ่นดิบเข้าโกดัง',
    refDocNo: 'PO-6909-008',
    paymentMethod: 'เงินโอน',
    bankAccount: 'กสิกรไทย 123-4-56789-0',
    cashierName: 'นาย ประสิทธิ์',
    items: [
      { itemDate: '2026-09-11', description: 'ยางแผ่นดิบเกรด 3 งวดที่ 1', amount: 85000 },
      { itemDate: '2026-09-11', description: 'ค่ายางก้นถ้วยล้างเสร็จ', amount: 15000 }
    ]
  };

  const createdV1 = await createVoucher(mockDb, voucherData1);
  assertEqual(createdV1.voucher_no, '69090001', 'First voucher auto-assigned sequence 69090001 (Independent sequence)');
  assertEqual(createdV1.totalAmount, 100000, 'Voucher total amount is sum of items: 85,000 + 15,000 = 100,000 บาท');
  assertEqual(mockAuditLogs.some(l => l.action === 'CREATE_VOUCHER' && l.resource_id === '69090001'), true, 'Audit log recorded for CREATE_VOUCHER');

  // Test Get Voucher By No
  const fetchedV1 = await getVoucherByNo(mockDb, '69090001');
  assertEqual(fetchedV1.receiver_name, 'สหกรณ์กองทุนสวนยาง จำกัด', 'Fetched voucher matches receiver name');
  assertEqual(fetchedV1.items.length, 2, 'Fetched voucher includes 2 items');

  // Test Voucher Cancellation
  const cancelledV1 = await cancelVoucher(mockDb, '69090001', {
    reason: 'ระบุยอดเงินผิดพลาด ต้องแก้ไขบิลใหม่',
    cancelledByEmail: 'admin@srisuk-rubber.com',
    cancelledByName: 'ผู้จัดการ'
  });
  assertEqual(cancelledV1.status, 'ยกเลิก', 'Voucher status changed to ยกเลิก');
  assertEqual(mockAuditLogs.some(l => l.action === 'CANCEL_VOUCHER' && l.resource_id === '69090001'), true, 'Audit log recorded for CANCEL_VOUCHER');

  // Test List Vouchers
  const vouchersList = await listVouchers(mockDb, { page: 1, pageSize: 10 });
  assertEqual(vouchersList.total, 1, 'List vouchers returns total count 1');

  console.log(`\n📊 Document CRUD Test Results: ${passed} Passed, ${failed} Failed`);
}

runTests().catch(console.error);
