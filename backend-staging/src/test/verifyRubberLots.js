/**
 * Verification Test for Rubber Lot Grouping Engine (Phase 2.2)
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

import {
  calculateLotAggregates,
  createLot,
  getLotByNo,
  addTicketsToLot,
  removeTicketFromLot,
  lockLot,
  unlockLot,
  cancelLot,
  listLots
} from '../services/rubberLotService.js';

import { createPurchaseTicket } from '../services/rubberPurchaseService.js';

async function runTests() {
  console.log('🧪 Starting Rubber Lot Grouping Engine (Phase 2.2) Tests...\n');
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
  // Section 1: Test Mathematical Aggregates
  // ==========================================
  console.log('--- Section 1: Lot Math & Weighted Average Cost ---');

  const sampleTickets = [
    { weight_kg: 812, total_amount: 7062.37 },
    { weight_kg: 955, total_amount: 8411.64 },
    { weight_kg: 770, total_amount: 6712.16 }
  ];

  const agg = calculateLotAggregates(sampleTickets);
  assertEqual(agg.totalWeightKg, 2537, 'Total weight should sum: 812 + 955 + 770 = 2537 kg');
  assertEqual(agg.totalCost, 22186.17, 'Total cost should sum: 7062.37 + 8411.64 + 6712.16 = 22186.17 บาท');
  assertEqual(agg.avgCostPerKg, 8.75, 'Avg cost per kg: 22186.17 / 2537 = 8.745 -> 8.75 บาท/กก.');
  assertEqual(agg.itemsCount, 3, 'Items count should be 3');

  // ==========================================
  // Section 2: Mock In-Memory D1 Database Setup
  // ==========================================
  console.log('\n--- Section 2: D1 Database & Lot Lifecycle ---');

  const mockPurchases = [];
  const mockLots = [];
  const mockSequences = new Map();
  const mockAuditLogs = [];
  let purchaseIdInc = 1;
  let lotIdInc = 1;

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

          // 4. Insert into rubber_lots
          if (sql.includes('INSERT INTO rubber_lots')) {
            const [
              lot_no, lot_name, lot_date, product_type, total_weight_kg, total_cost,
              avg_cost_per_kg, items_count
            ] = boundParams;

            const record = {
              id: lotIdInc++,
              lot_no,
              lot_name,
              lot_date,
              product_type,
              total_weight_kg,
              total_cost,
              avg_cost_per_kg,
              items_count,
              status: 'OPEN',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            mockLots.push(record);
            return record;
          }

          // 5. Select lot by lot_no
          if (sql.includes('SELECT * FROM rubber_lots WHERE lot_no = ?')) {
            const [lotNo] = boundParams;
            return mockLots.find(l => l.lot_no === lotNo) || null;
          }

          // 6. Update rubber_lots
          if (sql.includes('UPDATE rubber_lots')) {
            if (sql.includes('SET total_weight_kg = ?')) {
              const [total_weight_kg, total_cost, avg_cost_per_kg, items_count, lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) {
                lot.total_weight_kg = total_weight_kg;
                lot.total_cost = total_cost;
                lot.avg_cost_per_kg = avg_cost_per_kg;
                lot.items_count = items_count;
                lot.updated_at = new Date().toISOString();
                return lot;
              }
            } else if (sql.includes("SET status = 'LOCKED'")) {
              const [lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) {
                lot.status = 'LOCKED';
                lot.updated_at = new Date().toISOString();
                return lot;
              }
            } else if (sql.includes("SET status = 'OPEN'")) {
              const [lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) {
                lot.status = 'OPEN';
                lot.updated_at = new Date().toISOString();
                return lot;
              }
            } else if (sql.includes("SET status = 'CANCELLED'")) {
              const [lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) {
                lot.status = 'CANCELLED';
                lot.updated_at = new Date().toISOString();
                return lot;
              }
            }
            return null;
          }

          // 7. Audit log insert
          if (sql.includes('INSERT INTO audit_logs')) {
            mockAuditLogs.push({ params: boundParams });
            return { id: mockAuditLogs.length };
          }

          // 8. Lot stats query
          if (sql.includes('SELECT') && sql.includes('COUNT(*) as total_count') && sql.includes('FROM rubber_lots')) {
            return {
              total_count: mockLots.length,
              sum_weight: mockLots.reduce((acc, l) => acc + l.total_weight_kg, 0),
              sum_cost: mockLots.reduce((acc, l) => acc + l.total_cost, 0)
            };
          }

          return null;
        },

        async run() {
          // Update rubber_purchases (link or unlink)
          if (sql.includes('UPDATE rubber_purchases')) {
            if (sql.includes("SET lot_id = ?, status = 'ASSIGNED'")) {
              const [lotId, ticketNo] = boundParams;
              const t = mockPurchases.find(p => p.ticket_no === ticketNo);
              if (t) {
                t.lot_id = lotId;
                t.status = 'ASSIGNED';
              }
            } else if (sql.includes("SET lot_id = NULL, status = 'UNASSIGNED'")) {
              if (sql.includes('WHERE ticket_no = ?')) {
                const [ticketNo] = boundParams;
                const t = mockPurchases.find(p => p.ticket_no === ticketNo);
                if (t) {
                  t.lot_id = null;
                  t.status = 'UNASSIGNED';
                }
              } else if (sql.includes('WHERE lot_id = ?')) {
                const [lotId] = boundParams;
                mockPurchases.filter(p => p.lot_id === lotId).forEach(t => {
                  t.lot_id = null;
                  t.status = 'UNASSIGNED';
                });
              }
            }
            return { success: true };
          }
          return { success: true };
        },

        async all() {
          if (sql.includes('FROM rubber_purchases WHERE lot_id = ?')) {
            const [lotId] = boundParams;
            const items = mockPurchases.filter(p => p.lot_id === lotId);
            return { results: items };
          }

          if (sql.includes('FROM rubber_lots')) {
            return { results: mockLots };
          }

          return { results: [] };
        }
      };
      return stmt;
    }
  };

  // Seed Inbound Purchase Tickets
  const t1 = await createPurchaseTicket(mockDb, {
    purchaseDate: '2026-09-15',
    sellerName: 'ลุงสมชาย ใจดี',
    productType: 'น้ำยางสด',
    weightKg: 812,
    unitPrice: 24.5,
    drcPercent: 35.5
  }); // Total: 7062.37

  const t2 = await createPurchaseTicket(mockDb, {
    purchaseDate: '2026-09-15',
    sellerName: 'นายวินัย ปลูกยาง',
    productType: 'น้ำยางสด',
    weightKg: 955,
    unitPrice: 24.8,
    drcPercent: 35.5
  }); // Total: 8410.66

  const t3 = await createPurchaseTicket(mockDb, {
    purchaseDate: '2026-09-15',
    sellerName: 'ป้าแดง ทองคำ',
    productType: 'ยางก้อนถ้วย',
    weightKg: 430,
    unitPrice: 18.2,
    drcPercent: 50
  }); // Different product type!

  const t4 = await createPurchaseTicket(mockDb, {
    purchaseDate: '2026-09-15',
    sellerName: 'ลุงเปี๊ยก สวนปาล์ม',
    productType: 'น้ำยางสด',
    weightKg: 770,
    unitPrice: 24.5,
    drcPercent: 35.5
  }); // Total: 6696.83

  // Test 2.1: Create First Lot (น้ำยางสด)
  const created = await createLot(mockDb, {
    lotName: 'Lot น้ำยางสด สายเช้า 15/09',
    productType: 'น้ำยางสด',
    ticketNos: [t1.ticket_no, t2.ticket_no],
    lotDate: '2026-09-15'
  }, { actorEmail: 'manager@srisuk.com' });

  assertTrue(created.lot.lot_no.startsWith('LOT-6909'), `Lot number prefix should be LOT-6909... (Got: ${created.lot.lot_no})`);
  assertEqual(created.lot.lot_no, 'LOT-69090001', 'First Lot should be LOT-69090001');
  assertEqual(created.lot.items_count, 2, 'Initial Lot items count should be 2');
  assertEqual(created.lot.total_weight_kg, 1767, 'Total weight: 812 + 955 = 1767 kg');
  assertEqual(created.lot.status, 'OPEN', 'Initial status of Lot must be OPEN');
  assertEqual(t1.status, 'ASSIGNED', 'Ticket 1 status must change to ASSIGNED');
  assertEqual(t2.status, 'ASSIGNED', 'Ticket 2 status must change to ASSIGNED');

  // Test 2.2: Single Product Rule Enforcement
  try {
    await createLot(mockDb, {
      lotName: 'Lot ผิดกฎ',
      productType: 'น้ำยางสด',
      ticketNos: [t3.ticket_no] // t3 is ยางก้อนถ้วย
    });
    console.error('❌ FAIL: Should reject ticket of mismatched product type');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('ไม่ตรงกับประเภทยางของ Lot'), 'Rejects mismatched product type');
  }

  // Test 2.3: Reject Already Assigned Ticket
  try {
    await createLot(mockDb, {
      lotName: 'Lot แย่งบิล',
      productType: 'น้ำยางสด',
      ticketNos: [t1.ticket_no] // t1 is already assigned to LOT-69090001
    });
    console.error('❌ FAIL: Should reject already assigned ticket');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('ถูกจัดเข้า Lot อื่นไปแล้ว'), 'Rejects already assigned ticket');
  }

  // Test 2.4: Add Ticket to Existing OPEN Lot
  const added = await addTicketsToLot(mockDb, 'LOT-69090001', [t4.ticket_no], {
    actorEmail: 'manager@srisuk.com'
  });
  assertEqual(added.lot.items_count, 3, 'Items count after adding should be 3');
  assertEqual(added.lot.total_weight_kg, 2537, 'Total weight after adding: 1767 + 770 = 2537 kg');
  assertEqual(t4.status, 'ASSIGNED', 'Ticket 4 status changed to ASSIGNED');

  // Test 2.5: Remove Ticket from OPEN Lot
  const removed = await removeTicketFromLot(mockDb, 'LOT-69090001', t4.ticket_no, {
    actorEmail: 'manager@srisuk.com'
  });
  assertEqual(removed.lot.items_count, 2, 'Items count after removal should decrease back to 2');
  assertEqual(removed.lot.total_weight_kg, 1767, 'Total weight should decrease back to 1767 kg');
  assertEqual(t4.status, 'UNASSIGNED', 'Removed ticket returns to UNASSIGNED');
  assertEqual(t4.lot_id, null, 'Removed ticket lot_id reset to null');

  // Test 2.6: Lock Lot (OPEN -> LOCKED)
  const locked = await lockLot(mockDb, 'LOT-69090001', { actorEmail: 'manager@srisuk.com' });
  assertEqual(locked.status, 'LOCKED', 'Lot status changed to LOCKED');

  // Test 2.7: Block Adding Tickets to LOCKED Lot
  try {
    await addTicketsToLot(mockDb, 'LOT-69090001', [t4.ticket_no]);
    console.error('❌ FAIL: Should block adding ticket to LOCKED lot');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('LOCKED'), 'Rejects modification of LOCKED lot');
  }

  // Test 2.8: Unlock Lot (LOCKED -> OPEN)
  const unlocked = await unlockLot(mockDb, 'LOT-69090001', { actorEmail: 'manager@srisuk.com' });
  assertEqual(unlocked.status, 'OPEN', 'Lot status returned to OPEN');

  // Test 2.9: Cancel Lot & Unlink Tickets
  const cancelled = await cancelLot(mockDb, 'LOT-69090001', 'ยกเลิกรอจัดส่งรอบใหม่', {
    actorEmail: 'admin@srisuk.com'
  });
  assertEqual(cancelled.status, 'CANCELLED', 'Lot status changed to CANCELLED');
  assertEqual(t1.status, 'UNASSIGNED', 'Ticket 1 returned to UNASSIGNED');
  assertEqual(t2.status, 'UNASSIGNED', 'Ticket 2 returned to UNASSIGNED');
  assertEqual(t1.lot_id, null, 'Ticket 1 lot_id cleared');
  assertEqual(t2.lot_id, null, 'Ticket 2 lot_id cleared');

  // Test 2.10: Re-group Unlinked Tickets into New Lot (LOT-69090002)
  const newLot = await createLot(mockDb, {
    lotName: 'Lot น้ำยางสด รวมใหม่',
    productType: 'น้ำยางสด',
    ticketNos: [t1.ticket_no, t2.ticket_no, t4.ticket_no],
    lotDate: '2026-09-15'
  });
  assertEqual(newLot.lot.lot_no, 'LOT-69090002', 'Second Lot increments sequence to LOT-69090002');
  assertEqual(newLot.lot.items_count, 3, 'Second lot contains all 3 tickets');

  // Test 2.11: List Lots
  const lotsList = await listLots(mockDb);
  assertEqual(lotsList.total, 2, 'Total lots count is 2 (1 CANCELLED, 1 OPEN)');
  assertTrue(lotsList.items.length > 0, 'Items array is populated');

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
