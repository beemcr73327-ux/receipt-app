/**
 * Verification Test for Outbound Factory Sales & Reconciliation Engine (Phase 2.3)
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

import {
  calculateSaleSettlement,
  createSaleRecord,
  settleFactoryResult,
  getSaleByNo,
  getSaleByLotNo,
  listSales,
  cancelSaleRecord
} from '../services/rubberSaleService.js';

import { createPurchaseTicket } from '../services/rubberPurchaseService.js';
import { createLot, lockLot } from '../services/rubberLotService.js';

async function runTests() {
  console.log('🧪 Starting Rubber Factory Sales & Settlement Engine (Phase 2.3) Tests...\n');
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
  // Section 1: Test Mathematical Formulas
  // ==========================================
  console.log('--- Section 1: Factory Settlement Math & Formulas ---');

  // Test 1.1: Direct rubber without DRC (e.g. เศษยาง 2,500 kg @ 12.00 บาท)
  const lotNoDrc = { product_type: 'เศษยาง', total_cost: 25000, total_weight_kg: 2520 };
  const res1 = calculateSaleSettlement(lotNoDrc, {
    sellingPricePerKg: 12.00,
    factoryWeightKg: 2500,
    factoryDrcPercent: 0,
    penaltyDeduction: 200,
    transportCost: 1500,
    otherFees: 0,
    outboundWeightKg: 2520
  });

  assertEqual(res1.netPricePerKg, 12.00, 'Direct sale net price should equal selling price');
  assertEqual(res1.grossRevenue, 30000, 'Gross revenue: 2,500 * 12.00 = 30,000 บาท');
  assertEqual(res1.netRevenue, 28300, 'Net revenue: 30,000 - 200 - 1,500 = 28,300 บาท');
  assertEqual(res1.weightShrinkageKg, 20, 'Weight shrinkage: 2,520 - 2,500 = 20 kg');
  assertEqual(res1.netProfit, 3300, 'Net profit: 28,300 - 25,000 = 3,300 บาท');
  assertEqual(res1.marginPerKg, 1.32, 'Margin per kg: 3,300 / 2,500 = 1.32 บาท/กก.');

  // Test 1.2: Latex with Factory Lab DRC (e.g. น้ำยางสด 12,000 kg @ 75.00 บาท, Factory DRC 34.5%)
  // Net price = round(75.00 * 0.345, 2) = round(25.875, 2) = 25.88 บาท/กก.
  // Gross revenue = 12,000 * 25.88 = 310,560 บาท
  // Net revenue = 310,560 - 500 - 3,000 - 200 = 306,860 บาท
  // Net profit = 306,860 - 280,000 = 26,860 บาท
  // Margin/kg = round(26,860 / 12,000, 2) = 2.24 บาท/กก.
  const lotLatex = { product_type: 'น้ำยางสด', total_cost: 280000, total_weight_kg: 12100 };
  const res2 = calculateSaleSettlement(lotLatex, {
    sellingPricePerKg: 75.00,
    factoryWeightKg: 12000,
    factoryDrcPercent: 34.5,
    penaltyDeduction: 500,
    transportCost: 3000,
    otherFees: 200,
    outboundWeightKg: 12100
  });

  assertEqual(res2.netPricePerKg, 25.88, 'Net price rounded to 2 decimals (75 * 34.5% = 25.88)');
  assertEqual(res2.grossRevenue, 310560, 'Gross revenue: 12,000 * 25.88 = 310,560 บาท');
  assertEqual(res2.netRevenue, 306860, 'Net revenue after all deductions = 306,860 บาท');
  assertEqual(res2.weightShrinkageKg, 100, 'Weight shrinkage: 12,100 - 12,000 = 100 kg');
  assertEqual(res2.netProfit, 26860, 'Net profit: 306,860 - 280,000 = 26,860 บาท');
  assertEqual(res2.marginPerKg, 2.24, 'Margin/kg: 26,860 / 12,000 = 2.24 บาท/กก.');

  // ==========================================
  // Section 2: Mock In-Memory D1 Database Setup
  // ==========================================
  console.log('\n--- Section 2: D1 Database & Sales Lifecycle ---');

  const mockPurchases = [];
  const mockLots = [];
  const mockSales = [];
  const mockSequences = new Map();
  const mockAuditLogs = [];
  let purchaseIdInc = 1;
  let lotIdInc = 1;
  let saleIdInc = 1;

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
              lot_no, lot_name, product_type, total_weight_kg, total_cost,
              avg_cost_per_kg, items_count
            ] = boundParams;

            const record = {
              id: lotIdInc++,
              lot_no,
              lot_name,
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

          // 6. Select lot by id
          if (sql.includes('SELECT * FROM rubber_lots WHERE id = ?')) {
            const [lotId] = boundParams;
            return mockLots.find(l => l.id === lotId) || null;
          }

          // 7. Update rubber_lots
          if (sql.includes('UPDATE rubber_lots')) {
            if (sql.includes("SET status = 'LOCKED'")) {
              const [lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) { lot.status = 'LOCKED'; return lot; }
            } else if (sql.includes("SET status = 'SHIPPED'")) {
              const [lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) { lot.status = 'SHIPPED'; return lot; }
            } else if (sql.includes("SET status = 'COMPLETED'")) {
              const [lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) { lot.status = 'COMPLETED'; return lot; }
            }
            return null;
          }

          // 8. Insert into rubber_sales
          if (sql.includes('INSERT INTO rubber_sales')) {
            const [sale_no, lot_id, factory_name, ship_date, outbound_weight_kg, selling_price_per_kg] = boundParams;
            const record = {
              id: saleIdInc++,
              sale_no,
              lot_id,
              factory_name,
              ship_date,
              outbound_weight_kg,
              factory_weight_kg: 0,
              factory_drc_percent: 0,
              selling_price_per_kg,
              net_price_per_kg: 0,
              gross_revenue: 0,
              penalty_deduction: 0,
              transport_cost: 0,
              other_fees: 0,
              net_revenue: 0,
              net_profit: 0,
              margin_per_kg: 0,
              weight_shrinkage_kg: 0,
              status: 'PENDING',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            mockSales.push(record);
            return record;
          }

          // 9. Select sale by sale_no
          if (sql.includes('SELECT * FROM rubber_sales WHERE sale_no = ?')) {
            const [saleNo] = boundParams;
            return mockSales.find(s => s.sale_no === saleNo) || null;
          }

          // 10. Select sale by lot_id
          if (sql.includes('SELECT * FROM rubber_sales WHERE lot_id = ?')) {
            const [lotId] = boundParams;
            return mockSales.find(s => s.lot_id === lotId) || null;
          }

          // 11. Update rubber_sales (settleFactoryResult)
          if (sql.includes('UPDATE rubber_sales') && sql.includes("status = 'CLOSED'")) {
            const [
              factory_weight_kg, factory_drc_percent, selling_price_per_kg,
              net_price_per_kg, gross_revenue, penalty_deduction, transport_cost,
              other_fees, net_revenue, net_profit, margin_per_kg, weight_shrinkage_kg,
              saleNo
            ] = boundParams;

            const sale = mockSales.find(s => s.sale_no === saleNo);
            if (sale) {
              sale.factory_weight_kg = factory_weight_kg;
              sale.factory_drc_percent = factory_drc_percent;
              sale.selling_price_per_kg = selling_price_per_kg;
              sale.net_price_per_kg = net_price_per_kg;
              sale.gross_revenue = gross_revenue;
              sale.penalty_deduction = penalty_deduction;
              sale.transport_cost = transport_cost;
              sale.other_fees = other_fees;
              sale.net_revenue = net_revenue;
              sale.net_profit = net_profit;
              sale.margin_per_kg = margin_per_kg;
              sale.weight_shrinkage_kg = weight_shrinkage_kg;
              sale.status = 'CLOSED';
              sale.updated_at = new Date().toISOString();
              return sale;
            }
            return null;
          }

          // 12. Stats for sales
          if (sql.includes('SELECT') && sql.includes('COUNT(*) as total_count') && sql.includes('FROM rubber_sales')) {
            return {
              total_count: mockSales.length,
              sum_outbound_weight: mockSales.reduce((acc, s) => acc + s.outbound_weight_kg, 0),
              sum_factory_weight: mockSales.reduce((acc, s) => acc + s.factory_weight_kg, 0),
              sum_gross_revenue: mockSales.reduce((acc, s) => acc + s.gross_revenue, 0),
              sum_net_revenue: mockSales.reduce((acc, s) => acc + s.net_revenue, 0),
              sum_net_profit: mockSales.reduce((acc, s) => acc + s.net_profit, 0)
            };
          }

          // 13. Audit logs
          if (sql.includes('INSERT INTO audit_logs')) {
            mockAuditLogs.push({ params: boundParams });
            return { id: mockAuditLogs.length };
          }

          return null;
        },

        async run() {
          // Update lot status
          if (sql.includes('UPDATE rubber_lots')) {
            if (sql.includes("SET status = 'SHIPPED'")) {
              const [lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) lot.status = 'SHIPPED';
            } else if (sql.includes("SET status = 'COMPLETED'")) {
              const [lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) lot.status = 'COMPLETED';
            } else if (sql.includes("SET status = 'LOCKED'")) {
              const [lotId] = boundParams;
              const lot = mockLots.find(l => l.id === lotId);
              if (lot) lot.status = 'LOCKED';
            }
            return { success: true };
          }

          // Update purchases
          if (sql.includes('UPDATE rubber_purchases')) {
            if (sql.includes("SET lot_id = ?, status = 'ASSIGNED'")) {
              const [lotId, ticketNo] = boundParams;
              const t = mockPurchases.find(p => p.ticket_no === ticketNo);
              if (t) { t.lot_id = lotId; t.status = 'ASSIGNED'; }
            }
            return { success: true };
          }

          // Delete from rubber_sales (cancel)
          if (sql.includes('DELETE FROM rubber_sales')) {
            const [saleId] = boundParams;
            const idx = mockSales.findIndex(s => s.id === saleId);
            if (idx >= 0) mockSales.splice(idx, 1);
            return { success: true };
          }

          return { success: true };
        },

        async all() {
          if (sql.includes('FROM rubber_purchases WHERE lot_id = ?')) {
            const [lotId] = boundParams;
            return { results: mockPurchases.filter(p => p.lot_id === lotId) };
          }
          if (sql.includes('FROM rubber_sales')) {
            return { results: mockSales };
          }
          return { results: [] };
        }
      };
      return stmt;
    }
  };

  // Setup Test Data
  const t1 = await createPurchaseTicket(mockDb, {
    purchaseDate: '2026-09-15',
    sellerName: 'ลุงสมชาย ใจดี',
    productType: 'น้ำยางสด',
    weightKg: 812,
    unitPrice: 24.5,
    drcPercent: 35.5
  });

  const t2 = await createPurchaseTicket(mockDb, {
    purchaseDate: '2026-09-15',
    sellerName: 'นายวินัย ปลูกยาง',
    productType: 'น้ำยางสด',
    weightKg: 955,
    unitPrice: 24.8,
    drcPercent: 35.5
  });

  // Create Lot
  const lotRes = await createLot(mockDb, {
    lotName: 'Lot น้ำยางสด ส่งโรงงานไทยฮั้ว',
    productType: 'น้ำยางสด',
    ticketNos: [t1.ticket_no, t2.ticket_no],
    lotDate: '2026-09-15'
  });
  const lot = lotRes.lot;

  // Test 2.1: Block creating sale for OPEN lot
  try {
    await createSaleRecord(mockDb, {
      lotNo: lot.lot_no,
      factoryName: 'บริษัท ไทยฮั้วยางพารา จำกัด (มหาชน)',
      sellingPricePerKg: 75.00
    });
    console.error('❌ FAIL: Should block dispatching OPEN lot');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('LOCKED'), 'Rejects dispatching OPEN lot (must lock first)');
  }

  // Lock Lot
  await lockLot(mockDb, lot.lot_no);

  // Test 2.2: Dispatch Lot to Factory (Create Sale: PENDING)
  const sale = await createSaleRecord(mockDb, {
    lotNo: lot.lot_no,
    factoryName: 'บริษัท ไทยฮั้วยางพารา จำกัด (มหาชน)',
    shipDate: '2026-09-15',
    outboundWeightKg: 1767,
    sellingPricePerKg: 75.00
  }, { actorEmail: 'manager@srisuk.com' });

  assertTrue(sale.sale_no.startsWith('SL-6909'), `Sale number should start with SL-6909... (Got: ${sale.sale_no})`);
  assertEqual(sale.sale_no, 'SL-69090001', 'First sale should be SL-69090001');
  assertEqual(sale.status, 'PENDING', 'Initial sale status must be PENDING');
  assertEqual(lot.status, 'SHIPPED', 'Lot status must transition to SHIPPED');

  // Test 2.3: Settle Factory Result (Close Sale & Complete Lot)
  // Actual Factory Weight: 1,750 kg (Shrinkage: 17 kg)
  // Factory Lab DRC: 36.0%
  // Net price = round(75.00 * 0.36, 2) = 27.00 บาท/กก.
  // Gross revenue = 1,750 * 27.00 = 47,250.00 บาท
  // Transport cost: 1,200 บาท, Penalty: 150 บาท -> Total deductions = 1,350 บาท
  // Net revenue = 47,250 - 1,350 = 45,900.00 บาท
  // Lot Cost = 7,062.37 + 8,410.66 = 15,473.03 บาท
  // Net Profit = 45,900 - 15,473.03 = 30,426.97 บาท
  // Margin/kg = round(30,426.97 / 1,750, 2) = 17.39 บาท/กก.
  const settled = await settleFactoryResult(mockDb, 'SL-69090001', {
    factoryWeightKg: 1750,
    factoryDrcPercent: 36.0,
    penaltyDeduction: 150,
    transportCost: 1200,
    otherFees: 0
  }, { actorEmail: 'manager@srisuk.com' });

  assertEqual(settled.status, 'CLOSED', 'Sale status should be CLOSED');
  assertEqual(lot.status, 'COMPLETED', 'Lot status should be COMPLETED');
  assertEqual(settled.net_price_per_kg, 27.00, 'Net price per kg should be 27.00');
  assertEqual(settled.gross_revenue, 47250, 'Gross revenue: 1,750 * 27.00 = 47,250 บาท');
  assertEqual(settled.net_revenue, 45900, 'Net revenue: 47,250 - 1,350 = 45,900 บาท');
  assertEqual(settled.weight_shrinkage_kg, 17, 'Shrinkage: 1,767 - 1,750 = 17 kg');
  const expectedNetProfit = Math.round((45900 - lot.total_cost) * 100) / 100;
  assertEqual(settled.net_profit, expectedNetProfit, `Net profit: 45,900 - ${lot.total_cost} = ${expectedNetProfit} บาท`);
  assertEqual(settled.margin_per_kg, 17.39, 'Margin/kg: 30,429.81 / 1,750 = 17.39 บาท/กก.');

  // Test 2.4: Block Double Settlement
  try {
    await settleFactoryResult(mockDb, 'SL-69090001', {
      factoryWeightKg: 1750
    });
    console.error('❌ FAIL: Should block settling already closed sale');
    failed++;
  } catch (err) {
    assertTrue(err.message.includes('ปิดยอดโรงงานเรียบร้อยแล้ว'), 'Rejects double settlement');
  }

  // Test 2.5: Get Sale Details
  const fetched = await getSaleByNo(mockDb, 'SL-69090001');
  assertTrue(fetched !== null, 'Sale record retrieved');
  assertEqual(fetched.sale.sale_no, 'SL-69090001', 'Sale number matches');
  assertEqual(fetched.lot.lot_no, lot.lot_no, 'Linked lot matches');
  assertEqual(fetched.items.length, 2, 'Linked purchase items count matches');

  // Test 2.6: List Sales
  const salesList = await listSales(mockDb);
  assertEqual(salesList.total, 1, 'Total sales count is 1');
  assertEqual(salesList.sumGrossRevenue, 47250, 'Sum gross revenue matches');
  assertEqual(salesList.sumNetRevenue, 45900, 'Sum net revenue matches');
  assertEqual(salesList.sumNetProfit, expectedNetProfit, 'Sum net profit matches');

  // Test 2.7: Cancel Sale Record & Revert Lot to LOCKED
  const cancelRes = await cancelSaleRecord(mockDb, 'SL-69090001', 'ยกเลิกผลแล็บผิดพลาด', {
    actorEmail: 'admin@srisuk.com'
  });
  assertTrue(cancelRes.success, 'Sale cancelled successfully');
  assertEqual(lot.status, 'LOCKED', 'Lot status safely reverted to LOCKED');
  assertEqual(mockSales.length, 0, 'Sale removed from active sales list');

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
