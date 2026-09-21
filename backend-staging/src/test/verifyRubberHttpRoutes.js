/**
 * Verification Test for Rubber Trading HTTP Endpoints & Worker Router (Phase 2.4)
 * Tests Worker fetch(request, env, ctx) dispatching for all /api/v1/rubber/* routes
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

import worker from '../index.js';

async function runTests() {
  console.log('🧪 Starting Rubber HTTP Routes & Worker Router (Phase 2.4) Tests...\n');
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
  // Mock In-Memory D1 Database for HTTP Tests
  // ==========================================
  const mockPurchases = [];
  const mockLots = [];
  const mockSales = [];
  const mockSequences = new Map();
  const mockIdempotency = new Map();
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
          // Idempotency check
          if (sql.includes('SELECT * FROM idempotency_keys WHERE idempotency_key = ?')) {
            const [key] = boundParams;
            return mockIdempotency.get(key) || null;
          }

          // Sequence generator
          if (sql.includes('document_sequences')) {
            const [docType, prefix] = boundParams;
            const key = `${docType}_${prefix}`;
            let current = mockSequences.get(key) || 0;
            current += 1;
            mockSequences.set(key, current);
            return { current_seq: current };
          }

          // Insert into rubber_purchases (uses RETURNING * with .first())
          if (sql.includes('INSERT INTO rubber_purchases')) {
            const [
              ticket_no, paper_ref, purchase_date, branch, seller_name,
              product_type, weight_kg, unit_price, drc_percent, dry_weight_kg,
              total_amount, notes
            ] = boundParams;
            const record = {
              id: purchaseIdInc++,
              ticket_no,
              purchase_no: ticket_no,
              paper_ref,
              purchase_date,
              branch,
              seller_name,
              product_type,
              product_name: product_type,
              weight_kg,
              unit_price,
              drc_percent,
              dry_weight_kg,
              total_amount,
              notes,
              status: 'UNASSIGNED',
              lot_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            mockPurchases.push(record);
            return record;
          }

          // Insert into rubber_lots (uses RETURNING * with .first())
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
              product_name: product_type,
              total_weight_kg,
              total_cost,
              avg_cost_per_kg,
              ticket_count: items_count,
              items_count,
              status: 'OPEN',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            mockLots.push(record);
            return record;
          }

          // Insert into rubber_sales (uses RETURNING * with .first())
          if (sql.includes('INSERT INTO rubber_sales')) {
            const [
              sale_no, lot_id, ref_lot_no, factory_name, sale_date, ship_date, outbound_weight_kg,
              selling_price_per_kg
            ] = boundParams;
            const record = {
              id: saleIdInc++,
              sale_no,
              lot_id,
              ref_lot_no,
              destination_factory: factory_name,
              factory_name,
              sale_date,
              shipping_date: ship_date,
              ship_date,
              outbound_weight_kg,
              selling_price_per_kg,
              status: 'PENDING',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            mockSales.push(record);
            return record;
          }

          // Dashboard queries
          if (sql.includes('COALESCE(SUM(weight_kg), 0) AS today_weight')) {
            const [targetDate] = boundParams;
            const matches = mockPurchases.filter(p => p.purchase_date === targetDate && p.status !== 'CANCELLED');
            const totalW = matches.reduce((sum, p) => sum + p.weight_kg, 0);
            return { today_weight: totalW, today_count: matches.length };
          }
          if (sql.includes('COALESCE(SUM(total_amount), 0) AS open_cost')) {
            const matches = mockPurchases.filter(p => (!p.lot_id || p.status === 'UNASSIGNED') && p.status !== 'CANCELLED');
            const totalCost = matches.reduce((sum, p) => sum + p.total_amount, 0);
            const totalW = matches.reduce((sum, p) => sum + p.weight_kg, 0);
            return { open_cost: totalCost, open_weight: totalW, open_count: matches.length };
          }
          if (sql.includes('COUNT(*) AS pending_count FROM rubber_sales')) {
            const count = mockSales.filter(s => s.status === 'PENDING').length;
            return { pending_count: count };
          }
          if (sql.includes('COUNT(*) AS closed_count, COALESCE(SUM(net_profit), 0) AS total_profit')) {
            const matches = mockSales.filter(s => s.status === 'CLOSED');
            const totalProfit = matches.reduce((sum, s) => sum + (s.net_profit || 0), 0);
            return { closed_count: matches.length, total_profit: totalProfit };
          }

          // Purchases queries
          if (sql.includes('SELECT * FROM rubber_purchases WHERE ticket_no = ?')) {
            const [no] = boundParams;
            return mockPurchases.find(p => p.ticket_no === no) || null;
          }

          // Lots queries
          if (sql.includes('SELECT * FROM rubber_lots WHERE lot_no = ?')) {
            const [no] = boundParams;
            return mockLots.find(l => l.lot_no === no) || null;
          }
          if (sql.includes('SELECT * FROM rubber_lots WHERE id = ?')) {
            const [id] = boundParams;
            return mockLots.find(l => l.id === id) || null;
          }

          // Sales queries
          if (sql.includes('SELECT * FROM rubber_sales WHERE sale_no = ?')) {
            const [no] = boundParams;
            return mockSales.find(s => s.sale_no === no) || null;
          }
          if (sql.includes('SELECT * FROM rubber_sales WHERE lot_no = ?')) {
            const [no] = boundParams;
            return mockSales.find(s => s.lot_no === no) || null;
          }
          if (sql.includes('SELECT * FROM rubber_sales WHERE lot_id = ?')) {
            const [lotId] = boundParams;
            return mockSales.find(s => s.lot_id === lotId) || null;
          }

          // Update queries returning records or status
          if (sql.includes('UPDATE rubber_purchases') && sql.includes("status = 'CANCELLED'")) {
            const [notes, ticketNo] = boundParams;
            const item = mockPurchases.find(p => p.ticket_no === ticketNo);
            if (item) {
              item.status = 'CANCELLED';
              item.cancel_reason = notes;
            }
            return item;
          }
          if (sql.includes('UPDATE rubber_lots') && sql.includes("status = 'LOCKED'")) {
            const [lotId] = boundParams;
            const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
            if (lot) lot.status = 'LOCKED';
            return lot;
          }
          if (sql.includes('UPDATE rubber_lots') && sql.includes("status = 'OPEN'")) {
            const [lotId] = boundParams;
            const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
            if (lot) lot.status = 'OPEN';
            return lot;
          }
          if (sql.includes('UPDATE rubber_lots') && sql.includes("status = 'CANCELLED'")) {
            const [reason, lotId] = boundParams;
            const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
            if (lot) {
              lot.status = 'CANCELLED';
              lot.cancel_reason = reason;
            }
            return lot;
          }
          if (sql.includes('UPDATE rubber_sales') && sql.includes('factory_weight_kg = ?')) {
            const [
              factory_weight_kg, factory_drc_percent, selling_price_per_kg,
              net_price_per_kg, gross_revenue, penalty_deduction,
              transport_cost, other_fees, net_revenue, net_profit,
              margin_per_kg, weight_shrinkage_kg, saleNo
            ] = boundParams;
            const s = mockSales.find(sale => sale.sale_no === saleNo);
            if (s) {
              s.factory_weight_kg = factory_weight_kg;
              s.factory_drc_percent = factory_drc_percent;
              s.selling_price_per_kg = selling_price_per_kg;
              s.net_price_per_kg = net_price_per_kg;
              s.gross_revenue = gross_revenue;
              s.penalty_deduction = penalty_deduction;
              s.transport_cost = transport_cost;
              s.other_fees = other_fees;
              s.net_revenue = net_revenue;
              s.net_profit = net_profit;
              s.margin_per_kg = margin_per_kg;
              s.weight_shrinkage_kg = weight_shrinkage_kg;
              s.settlement_date = new Date().toISOString();
              s.status = 'CLOSED';
            }
            return s;
          }

          return null;
        },
        async all() {
          // Dashboard recent lots
          if (sql.includes('SELECT lot_no, product_name') && sql.includes('FROM rubber_lots')) {
            return { results: [...mockLots].reverse().slice(0, 10) };
          }
          // Dashboard recent unassigned purchases
          if (sql.includes('SELECT purchase_no, purchase_date') && sql.includes('FROM rubber_purchases')) {
            const filtered = mockPurchases.filter(p => (!p.lot_id || p.status === 'UNASSIGNED') && p.status !== 'CANCELLED');
            return { results: [...filtered].reverse().slice(0, 10) };
          }
          // Purchases: unassigned
          if (sql.includes('FROM rubber_purchases') && (sql.includes('lot_id IS NULL') || sql.includes("status = 'UNASSIGNED'"))) {
            const unassigned = mockPurchases.filter(p => (!p.lot_id || p.status === 'UNASSIGNED') && p.status !== 'CANCELLED');
            return { results: unassigned };
          }
          // Purchases: list
          if (sql.includes('SELECT * FROM rubber_purchases')) {
            return { results: mockPurchases };
          }
          // Purchases linked to lot
          if (sql.includes('FROM rubber_purchases WHERE lot_id = ?')) {
            const [lotId] = boundParams;
            return { results: mockPurchases.filter(p => p.lot_id === lotId) };
          }
          // Lots: list
          if (sql.includes('SELECT * FROM rubber_lots')) {
            return { results: mockLots };
          }
          // Sales: list
          if (sql.includes('SELECT * FROM rubber_sales')) {
            return { results: mockSales };
          }

          return { results: [] };
        },
        async run() {
          // Idempotency insert/update
          if (sql.includes('INSERT INTO idempotency_keys')) {
            const [k, s, r, e] = boundParams;
            mockIdempotency.set(k, { idempotency_key: k, status: s, response_body: r, expires_at: e });
            return { success: true };
          }
          if (sql.includes('UPDATE idempotency_keys')) {
            const [s, r, k] = boundParams;
            const existing = mockIdempotency.get(k) || {};
            mockIdempotency.set(k, { ...existing, status: s, response_body: r });
            return { success: true };
          }

          // Link purchases to lot
          if (sql.includes('UPDATE rubber_purchases SET lot_id = ?, status = \'ASSIGNED\'')) {
            const [lotId, ...ticketNos] = boundParams;
            for (const t of ticketNos) {
              const p = mockPurchases.find(item => item.ticket_no === t);
              if (p) {
                p.lot_id = lotId;
                p.status = 'ASSIGNED';
              }
            }
            return { success: true };
          }

          // Lock lot
          if (sql.includes('UPDATE rubber_lots SET status = \'LOCKED\'')) {
            const [lotId] = boundParams;
            const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
            if (lot) lot.status = 'LOCKED';
            return { success: true };
          }

          // Unlock lot
          if (sql.includes('UPDATE rubber_lots SET status = \'OPEN\'')) {
            const [lotId] = boundParams;
            const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
            if (lot) lot.status = 'OPEN';
            return { success: true };
          }

          // Cancel lot
          if (sql.includes('UPDATE rubber_lots SET status = \'CANCELLED\'')) {
            const [reason, lotId] = boundParams;
            const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
            if (lot) {
              lot.status = 'CANCELLED';
              lot.cancel_reason = reason;
            }
            return { success: true };
          }

          // Unlink purchases from lot
          if (sql.includes('UPDATE rubber_purchases SET lot_id = NULL, status = \'UNASSIGNED\' WHERE lot_id = ?')) {
            const [lotId] = boundParams;
            for (const p of mockPurchases) {
              if (p.lot_id === lotId) {
                p.lot_id = null;
                p.status = 'UNASSIGNED';
              }
            }
            return { success: true };
          }

          // Update lot to SHIPPED
          if (sql.includes('UPDATE rubber_lots SET status = \'SHIPPED\'')) {
            const [lotId] = boundParams;
            const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
            if (lot) lot.status = 'SHIPPED';
            return { success: true };
          }

          // Update lot to COMPLETED
          if (sql.includes('UPDATE rubber_lots SET status = \'COMPLETED\'')) {
            const [lotId] = boundParams;
            const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
            if (lot) lot.status = 'COMPLETED';
            return { success: true };
          }

          // Cancel sale record
          if (sql.includes('UPDATE rubber_sales SET status = \'CANCELLED\'')) {
            const [notes, saleNo] = boundParams;
            const s = mockSales.find(sale => sale.sale_no === saleNo);
            if (s) {
              s.status = 'CANCELLED';
              s.cancel_notes = notes;
            }
            return { success: true };
          }

          // Insert audit log
          if (sql.includes('INSERT INTO audit_logs')) {
            mockAuditLogs.push(boundParams);
            return { success: true };
          }

          return { success: true };
        }
      };
      return stmt;
    }
  };

  const mockEnv = {
    DB: mockDb,
    JWT_SECRET: 'test-secret'
  };

  const mockCtx = {
    waitUntil(promise) {
      if (promise && typeof promise.then === 'function') {
        promise.catch(e => console.warn('mockCtx waitUntil error:', e));
      }
    }
  };

  // ==========================================
  // Section 1: Dashboard API Endpoint
  // ==========================================
  console.log('--- Section 1: Test GET /api/v1/rubber/dashboard (Initial State) ---');
  {
    const req = new Request('http://localhost/api/v1/rubber/dashboard', { method: 'GET' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assertEqual(res.status, 200, 'GET /api/v1/rubber/dashboard returns 200 OK');
    const json = await res.json();
    assertEqual(json.status, 'success', 'Dashboard response status is success');
    assertEqual(json.data.todayWeight, 0, 'Initial today weight is 0');
    assertEqual(json.data.openCost, 0, 'Initial open cost is 0');
    assertEqual(json.data.pendingSalesCount, 0, 'Initial pending sales count is 0');
  }

  // ==========================================
  // Section 2: Rubber Purchases HTTP Endpoints
  // ==========================================
  console.log('\n--- Section 2: Test Rubber Purchases Endpoints ---');
  let createdPurchaseNo1 = null;
  let createdPurchaseNo2 = null;

  // 2.1 POST /api/v1/rubber/purchases - Create Ticket 1
  {
    const payload = {
      purchaseDate: '2026-09-15',
      branch: 'สาขาแม่สาย',
      sellerName: 'ลุงสมชาย ใจดี',
      productType: 'น้ำยางสด',
      weightKg: 1000,
      unitPrice: 25.00,
      drcPercent: 35.0,
      paperRef: 'PAPER-101'
    };
    const req = new Request('http://localhost/api/v1/rubber/purchases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'key-buy-001',
        'X-User-Name': 'Weigher Mae Sai'
      },
      body: JSON.stringify(payload)
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assertEqual(res.status, 200, 'POST /api/v1/rubber/purchases ticket 1 created');
    const json = await res.json();
    assertEqual(json.status, 'success', 'Response status is success');
    assertTrue(json.data.purchase_no.startsWith('PB-'), 'Ticket number has prefix PB-');
    assertEqual(json.data.total_amount, 8750, 'Calculated total amount (1000 * 25 * 35% = 8,750)');
    createdPurchaseNo1 = json.data.purchase_no;
  }

  // 2.2 POST /api/v1/rubber/purchases - Create Ticket 2
  {
    const payload = {
      purchaseDate: '2026-09-15',
      branch: 'สาขาแม่สาย',
      sellerName: 'ป้าแดง ทองคำ',
      productType: 'น้ำยางสด',
      weightKg: 1500,
      unitPrice: 26.00,
      drcPercent: 34.0,
      paperRef: 'PAPER-102'
    };
    const req = new Request('http://localhost/api/v1/rubber/purchases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'key-buy-002'
      },
      body: JSON.stringify(payload)
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    const json = await res.json();
    assertEqual(json.data.total_amount, 13260, 'Ticket 2 total amount (1500 * 26 * 34% = 13,260)');
    createdPurchaseNo2 = json.data.purchase_no;
  }

  // 2.3 GET /api/v1/rubber/purchases/unassigned
  {
    const req = new Request('http://localhost/api/v1/rubber/purchases/unassigned', { method: 'GET' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assertEqual(res.status, 200, 'GET unassigned purchases returns 200');
    const json = await res.json();
    assertEqual(json.data.length, 2, 'Found 2 unassigned tickets in queue');
  }

  // 2.4 GET /api/v1/rubber/purchases/:purchaseNo
  {
    const req = new Request(`http://localhost/api/v1/rubber/purchases/${createdPurchaseNo1}`, { method: 'GET' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assertEqual(res.status, 200, `GET /api/v1/rubber/purchases/${createdPurchaseNo1} returns 200`);
    const json = await res.json();
    assertEqual(json.data.seller_name, 'ลุงสมชาย ใจดี', 'Found correct seller name');
  }

  // ==========================================
  // Section 3: Rubber Lots HTTP Endpoints
  // ==========================================
  console.log('\n--- Section 3: Test Rubber Lots Endpoints ---');
  let createdLotNo = null;

  // 3.1 POST /api/v1/rubber/lots - Group tickets into a Lot
  {
    const payload = {
      purchaseTicketNos: [createdPurchaseNo1, createdPurchaseNo2],
      notes: 'Lot ทดสอบส่งโรงงานไทยฮั้ว'
    };
    const req = new Request('http://localhost/api/v1/rubber/lots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'key-lot-001'
      },
      body: JSON.stringify(payload)
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assertEqual(res.status, 200, 'POST /api/v1/rubber/lots returns 200');
    const json = await res.json();
    const lotData = json.data.lot || json.data;
    createdLotNo = lotData.lot_no;
    assertTrue(createdLotNo.startsWith('LOT-'), 'Lot number has prefix LOT-');
    assertEqual(lotData.items_count || lotData.ticket_count, 2, 'Lot includes 2 purchase tickets');
    assertEqual(lotData.total_weight_kg, 2500, 'Total lot weight: 1,000 + 1,500 = 2,500 kg');
    assertEqual(lotData.total_cost, 22010, 'Total lot cost: 8,750 + 13,260 = 22,010 บาท');
    assertEqual(lotData.avg_cost_per_kg, 8.8, 'Weighted avg cost: 22,010 / 2,500 = 8.80 บาท/กก.');
  }

  // 3.2 GET /api/v1/rubber/lots/:lotNo
  {
    const req = new Request(`http://localhost/api/v1/rubber/lots/${createdLotNo}`, { method: 'GET' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assertEqual(res.status, 200, 'GET lot details returns 200');
    const json = await res.json();
    const fetchedLotNo = json.data.lot ? json.data.lot.lot_no : json.data.lot_no;
    assertEqual(fetchedLotNo, createdLotNo, 'Retrieved matching lot details');
  }

  // 3.3 POST /api/v1/rubber/lots/:lotNo/lock
  {
    const req = new Request(`http://localhost/api/v1/rubber/lots/${createdLotNo}/lock`, { method: 'POST' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assertEqual(res.status, 200, 'POST lock lot returns 200');
    const json = await res.json();
    assertEqual(json.data.status, 'LOCKED', 'Lot status transitioned to LOCKED');
  }

  // ==========================================
  // Section 4: Rubber Sales & Reconciliation Endpoints
  // ==========================================
  console.log('\n--- Section 4: Test Rubber Sales & Settlement Endpoints ---');
  let createdSaleNo = null;

  // 4.1 POST /api/v1/rubber/sales - Dispatch Lot to Factory
  {
    const payload = {
      lotNo: createdLotNo,
      destinationFactory: 'โรงงาน ไทยฮั้ว ยางพารา (เชียงราย)',
      buyerName: 'บจก. ไทยฮั้วยางพารา',
      shippingDate: '2026-09-15',
      outboundWeightKg: 2500,
      notes: 'ส่งรถบรรทุกทะเบียน 82-1234'
    };
    const req = new Request('http://localhost/api/v1/rubber/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'key-sale-001'
      },
      body: JSON.stringify(payload)
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    const json = await res.json();
    if (res.status !== 200) {
      console.error('❌ Sale create error details:', json);
    }
    assertEqual(res.status, 200, 'POST /api/v1/rubber/sales returns 200');
    assertTrue(json.data.sale_no.startsWith('SL-'), 'Sale record has prefix SL-');
    assertEqual(json.data.status, 'PENDING', 'Initial sale status is PENDING');
    createdSaleNo = json.data.sale_no;
  }

  // 4.2 POST /api/v1/rubber/sales/:saleNo/settle - Settle Lab DRC & P&L
  {
    const settlementPayload = {
      factoryWeightKg: 2480, // น้ำหนักหาย 20 kg
      factoryDrcPercent: 34.5,
      sellingPricePerKg: 75.00,
      penaltyDeduction: 150,
      transportCost: 1200,
      otherFees: 50,
      settlementDate: '2026-09-15',
      notes: 'ผลตรวจแล็บผ่านเกณฑ์มาตรฐาน'
    };
    const req = new Request(`http://localhost/api/v1/rubber/sales/${createdSaleNo}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'key-settle-001'
      },
      body: JSON.stringify(settlementPayload)
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assertEqual(res.status, 200, 'POST settle factory result returns 200');
    const json = await res.json();
    assertEqual(json.data.status, 'CLOSED', 'Sale status updated to CLOSED');
    // Net price: 75 * 34.5% = 25.88
    assertEqual(json.data.net_price_per_kg, 25.88, 'Net selling price per kg = 25.88');
    // Gross: 2,480 * 25.88 = 64,182.40
    assertEqual(json.data.gross_revenue, 64182.4, 'Gross revenue = 64,182.40 บาท');
    // Net Revenue: 64,182.40 - 150 - 1200 - 50 = 62,782.40
    assertEqual(json.data.net_revenue, 62782.4, 'Net revenue = 62,782.40 บาท');
    // Shrinkage: 2,500 - 2,480 = 20 kg
    assertEqual(json.data.weight_shrinkage_kg, 20, 'Shrinkage = 20 kg');
    // Net Profit: 62,782.40 - 22,010 = 40,772.40
    assertEqual(json.data.net_profit, 40772.4, 'Net Profit = 40,772.40 บาท');
    // Margin/kg: 40,772.40 / 2,480 = 16.44 บาท/กก.
    assertEqual(json.data.margin_per_kg, 16.44, 'Margin per kg = 16.44 บาท/กก.');
  }

  // ==========================================
  // Section 5: Dashboard Analytics Verification
  // ==========================================
  console.log('\n--- Section 5: Test Dashboard Analytics Metrics After Cycle ---');
  {
    const req = new Request('http://localhost/api/v1/rubber/dashboard?date=2026-09-15', { method: 'GET' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    const json = await res.json();
    assertEqual(json.data.todayWeight, 2500, 'Today purchased weight updated to 2,500 kg');
    assertEqual(json.data.todayCount, 2, 'Today purchased count updated to 2');
    assertEqual(json.data.closedLotsMonthCount, 1, 'Closed sales count this month = 1');
    assertEqual(json.data.totalProfitMonth, 40772.4, 'Total net profit this month = 40,772.40 บาท');
    assertTrue(json.data.recentLots.length > 0, 'Recent lots list populated in dashboard');
  }

  console.log(`\n========================================`);
  console.log(`🏁 Test Summary: Passed: ${passed}, Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed!`);
  }
}

runTests().catch(err => {
  console.error('Fatal Error running tests:', err);
  process.exit(1);
});
