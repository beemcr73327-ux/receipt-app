/**
 * Verification Test for Rubber Purchasing Engine (Phase 2.1)
 * Inbound Weighing & Buying Management
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

import {
  calculatePurchaseAmounts,
  createPurchaseTicket,
  getPurchaseTicketByNo,
  getUnassignedPurchases,
  listPurchases,
  cancelPurchaseTicket,
  RUBBER_PRODUCTS
} from '../services/rubberPurchaseService.js';

async function runTests() {
  console.log('🧪 Starting Rubber Purchasing Engine (Phase 2.1) Tests...\n');
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
  // Section 1: Test Math & DRC Formulas
  // ==========================================
  console.log('--- Section 1: Math & DRC Formulas ---');

  // Test 1.1: Direct buy without DRC (e.g. เศษยาง 210 kg @ 9.50 THB)
  const calc1 = calculatePurchaseAmounts(210, 9.5, 0);
  assertEqual(calc1.dryWeightKg, 210, 'Direct buy dry weight should equal raw weight');
  assertEqual(calc1.totalAmount, 1995, 'Direct buy total should equal weight * price (210 * 9.5 = 1995)');

  // Test 1.2: DRC buy (e.g. น้ำยางสด 812 kg @ 24.50 THB, DRC 35.5%)
  // Dry Weight = 812 * 0.355 = 288.26 kg
  // Total Amount = 812 * 24.5 * 0.355 = 7062.37 THB
  const calc2 = calculatePurchaseAmounts(812, 24.5, 35.5);
  assertEqual(calc2.dryWeightKg, 288.26, 'DRC dry weight (812 * 35.5% = 288.26)');
  assertEqual(calc2.totalAmount, 7062.37, 'DRC total amount rounded to 2 decimal places (7062.37)');

  // Test 1.3: Cup lump (ยางก้อนถ้วย 430 kg @ 18.20 THB, DRC 50%)
  const calc3 = calculatePurchaseAmounts(430, 18.2, 50);
  assertEqual(calc3.dryWeightKg, 215, 'DRC 50% dry weight should be half');
  assertEqual(calc3.totalAmount, 3913, 'DRC 50% total amount (430 * 18.2 * 0.5 = 3913)');

  // Test 1.4: Zero weight or price returns 0
  const calc4 = calculatePurchaseAmounts(0, 25, 30);
  assertEqual(calc4.totalAmount, 0, 'Zero weight should produce 0 total amount');

  // ==========================================
  // Section 2: Mock In-Memory D1 Database Setup
  // ==========================================
  console.log('\n--- Section 2: D1 Database & Sequence Integration ---');

  const mockPurchases = [];
  const mockSequences = new Map();
  const mockAuditLogs = [];
  let purchaseIdInc = 1;

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
          // 1. Sequence upsert
          if (sql.includes('document_sequences')) {
            const [docType, prefix] = boundParams;
            const key = `${docType}_${prefix}`;
            let current = mockSequences.get(key) || 0;
            current += 1;
            mockSequences.set(key, current);
            return { current_seq: current };
          }

          // 2. Insert into rubber_purchases
          if (sql.includes('INSERT INTO rubber_purchases')) {
            const [
              ticket_no, paper_ref, purchase_date, branch, seller_name,
              product_type, weight_kg, unit_price, drc_percent, dry_weight_kg,
              total_amount, notes
            ] = boundParams;

            const record = {
              id: purchaseIdInc++,
              ticket_no,
              paper_ref,
              purchase_date,
              branch,
              seller_name,
              product_type,
              weight_kg,
              unit_price,
              drc_percent,
              dry_weight_kg,
              total_amount,
              lot_id: null,
              status: 'UNASSIGNED',
              notes,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            mockPurchases.push(record);
            return record;
          }

          // 3. Select ticket by ticket_no
          if (sql.includes('SELECT * FROM rubber_purchases WHERE ticket_no = ?')) {
            const [ticketNo] = boundParams;
            return mockPurchases.find(p => p.ticket_no === ticketNo) || null;
          }

          // 4. Update status / cancel
          if (sql.includes('UPDATE rubber_purchases') && sql.includes("SET status = 'CANCELLED'")) {
            const [notes, ticketNo] = boundParams;
            const target = mockPurchases.find(p => p.ticket_no === ticketNo);
            if (target) {
              target.status = 'CANCELLED';
              target.notes = notes;
              target.updated_at = new Date().toISOString();
              return target;
            }
            return null;
          }

          // 5. Stat counts
          if (sql.includes('SELECT') && sql.includes('COUNT(*) as total_count')) {
            let filtered = mockPurchases;
            return {
              total_count: filtered.length,
              sum_weight: filtered.reduce((acc, p) => acc + p.weight_kg, 0),
              sum_amount: filtered.reduce((acc, p) => acc + p.total_amount, 0)
            };
          }

          // 6. Audit logs
          if (sql.includes('INSERT INTO audit_logs')) {
            mockAuditLogs.push({ params: boundParams });
            return { id: mockAuditLogs.length };
          }

          return null;
        },

        async all() {
          if (sql.includes('FROM rubber_purchases')) {
            let items = [...mockPurchases];
            // Filter unassigned
            if (sql.includes("status = 'UNASSIGNED'")) {
              items = items.filter(p => p.status === 'UNASSIGNED' && p.lot_id === null);
            }
            // Filter product_type if bound
            if (boundParams.length > 0) {
              const productParam = boundParams.find(p => ['น้ำยางสด', 'ยางก้อนถ้วย', 'เศษยาง', 'ยางก้อน'].includes(p));
              if (productParam) {
                items = items.filter(p => p.product_type === productParam);
              }
            }
            return { results: items };
          }
          return { results: [] };
        }
      };
      return stmt;
    }
  };

  // Test 2.1: Create first purchase ticket (PB-YYMM0001)
  const ticket1 = await createPurchaseTicket(mockDb, {
    paperRef: '0042',
    purchaseDate: '2026-09-15',
    branch: 'สาขาแม่สาย',
    sellerName: 'ลุงสมชาย ใจดี',
    productType: 'น้ำยางสด',
    weightKg: 812,
    unitPrice: 24.5,
    drcPercent: 35.5,
    notes: 'ส่งเช้า ยางสวย'
  }, { actorEmail: 'cashier@srisuk.com' });

  assertTrue(ticket1.ticket_no.startsWith('PB-6909'), `Ticket number prefix should be PB-6909... (Got: ${ticket1.ticket_no})`);
  assertEqual(ticket1.ticket_no, 'PB-69090001', 'First ticket should be PB-69090001');
  assertEqual(ticket1.paper_ref, '0042', 'Paper ref should be preserved');
  assertEqual(ticket1.dry_weight_kg, 288.26, 'Dry weight should match calculation');
  assertEqual(ticket1.total_amount, 7062.37, 'Total amount should match calculation');
  assertEqual(ticket1.status, 'UNASSIGNED', 'Initial status must be UNASSIGNED');

  // Test 2.2: Create second purchase ticket (PB-69090002)
  const ticket2 = await createPurchaseTicket(mockDb, {
    paperRef: '0043',
    purchaseDate: '2026-09-15',
    branch: 'สาขาฝาง',
    sellerName: 'ป้าแดง ทองคำ',
    productType: 'ยางก้อนถ้วย',
    weightKg: 430,
    unitPrice: 18.2,
    drcPercent: 50
  });

  assertEqual(ticket2.ticket_no, 'PB-69090002', 'Second ticket should increment sequence to PB-69090002');
  assertEqual(ticket2.dry_weight_kg, 215, 'Second ticket dry weight');
  assertEqual(ticket2.total_amount, 3913, 'Second ticket total amount');

  // Test 2.3: Create third ticket without DRC (ขี้ยาง/เศษยาง)
  const ticket3 = await createPurchaseTicket(mockDb, {
    purchaseDate: '2026-09-15',
    branch: 'สาขาเชียงของ',
    sellerName: 'นายประสิทธิ์ สวนยาง',
    productType: 'เศษยาง',
    weightKg: 210,
    unitPrice: 9.5,
    drcPercent: 0
  });

  assertEqual(ticket3.ticket_no, 'PB-69090003', 'Third ticket sequence should be PB-69090003');
  assertEqual(ticket3.dry_weight_kg, 210, 'No DRC dry weight equals raw weight');
  assertEqual(ticket3.total_amount, 1995, 'No DRC amount equals 210 * 9.5');

  // ==========================================
  // Section 3: Validation & Error Handling
  // ==========================================
  console.log('\n--- Section 3: Validation Safeguards ---');

  // Test 3.1: Reject missing seller name
  try {
    await createPurchaseTicket(mockDb, {
      sellerName: '',
      productType: 'น้ำยางสด',
      weightKg: 100,
      unitPrice: 20
    });
    console.error('❌ FAIL: Should have rejected empty sellerName');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('sellerName'), 'Should reject empty sellerName');
  }

  // Test 3.2: Reject zero weight
  try {
    await createPurchaseTicket(mockDb, {
      sellerName: 'สมชาย',
      productType: 'น้ำยางสด',
      weightKg: 0,
      unitPrice: 20
    });
    console.error('❌ FAIL: Should have rejected zero weight');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('weightKg'), 'Should reject zero or negative weight');
  }

  // Test 3.3: Reject DRC > 100%
  try {
    await createPurchaseTicket(mockDb, {
      sellerName: 'สมชาย',
      productType: 'น้ำยางสด',
      weightKg: 100,
      unitPrice: 20,
      drcPercent: 120
    });
    console.error('❌ FAIL: Should have rejected DRC > 100');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('DRC%'), 'Should reject DRC over 100%');
  }

  // ==========================================
  // Section 4: Query & Unassigned Purchases
  // ==========================================
  console.log('\n--- Section 4: Retrieval & Filtering ---');

  // Test 4.1: Query by Ticket No
  const found = await getPurchaseTicketByNo(mockDb, 'PB-69090001');
  assertEqual(found.ticket_no, 'PB-69090001', 'Can find ticket by ticket_no');
  assertEqual(found.seller_name, 'ลุงสมชาย ใจดี', 'Seller name matches');

  // Test 4.2: Get unassigned tickets
  const unassigned = await getUnassignedPurchases(mockDb);
  assertEqual(unassigned.length, 3, 'All 3 created tickets should be unassigned');

  // Test 4.3: Filter unassigned by product type
  const latexOnly = await getUnassignedPurchases(mockDb, { productType: 'น้ำยางสด' });
  assertEqual(latexOnly.length, 1, 'Only 1 latex ticket was unassigned');

  // ==========================================
  // Section 5: Cancellation Rules & Integrity
  // ==========================================
  console.log('\n--- Section 5: Ticket Cancellation ---');

  // Test 5.1: Cancel an unassigned ticket
  const cancelled = await cancelPurchaseTicket(mockDb, 'PB-69090003', 'น้ำหนักผิดพลาด', {
    actorEmail: 'admin@srisuk.com'
  });
  assertEqual(cancelled.status, 'CANCELLED', 'Status should change to CANCELLED');
  assertTrue(cancelled.notes.includes('น้ำหนักผิดพลาด'), 'Notes should contain cancellation reason');

  // Test 5.2: Cannot cancel already cancelled ticket
  try {
    await cancelPurchaseTicket(mockDb, 'PB-69090003', 'พยายามยกเลิกซ้ำ');
    console.error('❌ FAIL: Should not allow cancelling already cancelled ticket');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('ยกเลิกไปแล้ว'), 'Rejects double cancellation');
  }

  // Test 5.3: Cannot cancel ticket assigned to a Lot
  ticket1.status = 'ASSIGNED';
  ticket1.lot_id = 99;
  try {
    await cancelPurchaseTicket(mockDb, 'PB-69090001', 'จะยกเลิก');
    console.error('❌ FAIL: Should reject cancelling ticket assigned to a Lot');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('จัดเข้า Lot แล้ว'), 'Rejects cancelling ticket assigned to Lot');
  }

  // ==========================================
  // Summary
  // ==========================================
  console.log(`\n==========================================`);
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`==========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('💥 Test Execution Error:', err);
  process.exit(1);
});
