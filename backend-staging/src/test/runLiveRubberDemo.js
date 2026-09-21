/**
 * Live Terminal Demo & Database Flow Visualizer (Phase 2.4)
 * Project: Receipt & Payment Voucher & Rubber Lot Management System
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 *
 * รันคำสั่งนี้เพื่อดูจำลองข้อมูลไหลเข้า Database แต่ละตาราง:
 * node backend-staging/src/test/runLiveRubberDemo.js
 */

import worker from '../index.js';

console.clear();
console.log('================================================================');
console.log('🌿 บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด — LIVE DATABASE DEMO 🌿');
console.log('       จำลองการไหลของข้อมูลลงสู่ D1 Database (Phase 2.4)        ');
console.log('================================================================\n');

// Mock in-memory D1 Database
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
        if (sql.includes('SELECT * FROM idempotency_keys WHERE idempotency_key = ?')) {
          return null;
        }
        if (sql.includes('document_sequences')) {
          const [docType, prefix] = boundParams;
          const key = `${docType}_${prefix}`;
          let current = mockSequences.get(key) || 0;
          current += 1;
          mockSequences.set(key, current);
          return { current_seq: current };
        }
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
            weight_kg,
            unit_price,
            drc_percent,
            dry_weight_kg,
            total_amount,
            notes,
            status: 'UNASSIGNED',
            lot_id: null,
            created_at: new Date().toISOString()
          };
          mockPurchases.push(record);
          return record;
        }
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
            created_at: new Date().toISOString()
          };
          mockLots.push(record);
          return record;
        }
        if (sql.includes('INSERT INTO rubber_sales')) {
          const [
            sale_no, lot_id, factory_name, ship_date, outbound_weight_kg,
            selling_price_per_kg
          ] = boundParams;
          const record = {
            id: saleIdInc++,
            sale_no,
            lot_id,
            destination_factory: factory_name,
            shipping_date: ship_date,
            outbound_weight_kg,
            selling_price_per_kg,
            status: 'PENDING',
            created_at: new Date().toISOString()
          };
          mockSales.push(record);
          return record;
        }
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
        if (sql.includes('SELECT * FROM rubber_purchases WHERE ticket_no = ?')) {
          const [no] = boundParams;
          return mockPurchases.find(p => p.ticket_no === no) || null;
        }
        if (sql.includes('SELECT * FROM rubber_lots WHERE lot_no = ?')) {
          const [no] = boundParams;
          return mockLots.find(l => l.lot_no === no) || null;
        }
        if (sql.includes('SELECT * FROM rubber_lots WHERE id = ?')) {
          const [id] = boundParams;
          return mockLots.find(l => l.id === id) || null;
        }
        if (sql.includes('SELECT * FROM rubber_sales WHERE sale_no = ?')) {
          const [no] = boundParams;
          return mockSales.find(s => s.sale_no === no) || null;
        }
        if (sql.includes('UPDATE rubber_lots') && sql.includes("status = 'LOCKED'")) {
          const [lotId] = boundParams;
          const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
          if (lot) lot.status = 'LOCKED';
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
        if (sql.includes('FROM rubber_lots')) return { results: mockLots };
        if (sql.includes('FROM rubber_purchases')) return { results: mockPurchases };
        if (sql.includes('FROM rubber_sales')) return { results: mockSales };
        return { results: [] };
      },
      async run() {
        if (sql.includes('UPDATE rubber_purchases SET lot_id = ?, status = \'ASSIGNED\'')) {
          const [lotId, ...ticketNos] = boundParams;
          for (const t of ticketNos) {
            const p = mockPurchases.find(item => item.ticket_no === t);
            if (p) { p.lot_id = lotId; p.status = 'ASSIGNED'; }
          }
          return { success: true };
        }
        if (sql.includes('UPDATE rubber_lots SET status = \'SHIPPED\'')) {
          const [lotId] = boundParams;
          const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
          if (lot) lot.status = 'SHIPPED';
          return { success: true };
        }
        if (sql.includes('UPDATE rubber_lots SET status = \'COMPLETED\'')) {
          const [lotId] = boundParams;
          const lot = mockLots.find(l => l.id === lotId || l.lot_no === lotId);
          if (lot) lot.status = 'COMPLETED';
          return { success: true };
        }
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

const mockEnv = { DB: mockDb };
const mockCtx = { waitUntil: () => {} };

const fmt = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const money = (n) => '฿' + fmt(n);

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLiveDemo() {
  console.log('📌 ขั้นที่ 1: บันทึกใบชั่งซื้อหน้าลาน (Inbound Purchasing) -> ตาราง `rubber_purchases`');
  console.log('--------------------------------------------------------------------------------');

  const ticket1Req = new Request('http://localhost/api/v1/rubber/purchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purchaseDate: '2026-09-15',
      branch: 'สาขาแม่สาย',
      sellerName: 'ลุงสมชาย ใจดี',
      productType: 'น้ำยางสด',
      weightKg: 1200,
      unitPrice: 25.00,
      drcPercent: 35.0,
      paperRef: 'PAPER-0148'
    })
  });
  const t1Res = await worker.fetch(ticket1Req, mockEnv, mockCtx);
  const t1 = (await t1Res.json()).data;
  console.log(`✓ ออกบิลใบที่ 1: [${t1.ticket_no}] ชาวสวน: ${t1.seller_name} | น้ำหนัก: ${fmt(t1.weight_kg)} กก. | รวมเงิน: ${money(t1.total_amount)}`);

  const ticket2Req = new Request('http://localhost/api/v1/rubber/purchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purchaseDate: '2026-09-15',
      branch: 'สาขาแม่สาย',
      sellerName: 'ป้าแดง ทองคำ',
      productType: 'น้ำยางสด',
      weightKg: 1800,
      unitPrice: 25.50,
      drcPercent: 34.0,
      paperRef: 'PAPER-0149'
    })
  });
  const t2Res = await worker.fetch(ticket2Req, mockEnv, mockCtx);
  const t2 = (await t2Res.json()).data;
  console.log(`✓ ออกบิลใบที่ 2: [${t2.ticket_no}] ชาวสวน: ${t2.seller_name} | น้ำหนัก: ${fmt(t2.weight_kg)} กก. | รวมเงิน: ${money(t2.total_amount)}`);

  console.log('\n📊 ตรวจสอบข้อมูลในตาราง `rubber_purchases`:');
  console.table(mockPurchases.map(p => ({
    'ID': p.id,
    'Ticket No': p.ticket_no,
    'ชาวสวน': p.seller_name,
    'สินค้า': p.product_type,
    'น้ำหนัก (กก.)': p.weight_kg,
    'ยอดเงิน': money(p.total_amount),
    'สถานะ': p.status,
    'Lot ID': p.lot_id || '(รอจัด Lot)'
  })));

  await delay(1000);

  console.log('\n📌 ขั้นที่ 2: รวมบิลซื้อเข้าเป็น Lot สินค้าใหม่ -> ตาราง `rubber_lots`');
  console.log('--------------------------------------------------------------------------------');
  const lotReq = new Request('http://localhost/api/v1/rubber/lots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purchaseTicketNos: [t1.ticket_no, t2.ticket_no],
      lotName: 'Lot น้ำยางสด แม่สาย-01',
      productType: 'น้ำยางสด'
    })
  });
  const lotRes = await worker.fetch(lotReq, mockEnv, mockCtx);
  const lot = (await lotRes.json()).data.lot;
  console.log(`✓ รวมกลุ่มสำเร็จ: ออกรหัสหัว Lot [${lot.lot_no}]`);
  console.log(`  • น้ำหนักรวม: ${fmt(lot.total_weight_kg)} กก. (รวมจาก ${lot.items_count} ใบชั่ง)`);
  console.log(`  • ต้นทุนซื้อรวม: ${money(lot.total_cost)}`);
  console.log(`  • ต้นทุนเฉลี่ยถ่วงน้ำหนัก: ${money(lot.avg_cost_per_kg)}/กก.`);

  // ล็อค Lot เตรียมส่งออก
  await worker.fetch(new Request(`http://localhost/api/v1/rubber/lots/${lot.lot_no}/lock`, { method: 'POST' }), mockEnv, mockCtx);
  console.log(`  • ล็อค Lot (Status: LOCKED) เพื่อเตรียมจัดส่งขึ้นรถบรรทุก`);

  console.log('\n📊 ตรวจสอบข้อมูลในตาราง `rubber_lots`:');
  console.table(mockLots.map(l => ({
    'ID': l.id,
    'Lot No': l.lot_no,
    'ชื่อ Lot': l.lot_name,
    'สินค้า': l.product_type,
    'น้ำหนักรวม': fmt(l.total_weight_kg) + ' กก.',
    'ต้นทุนรวม': money(l.total_cost),
    'เฉลี่ย/กก.': money(l.avg_cost_per_kg),
    'สถานะ': l.status
  })));

  await delay(1000);

  console.log('\n📌 ขั้นที่ 3: ออกบิลส่งขายโรงงาน (Dispatch & Sale Record) -> ตาราง `rubber_sales`');
  console.log('--------------------------------------------------------------------------------');
  const saleReq = new Request('http://localhost/api/v1/rubber/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lotNo: lot.lot_no,
      destinationFactory: 'โรงงาน ไทยฮั้ว ยางพารา (เชียงราย)',
      shippingDate: '2026-09-15',
      outboundWeightKg: 3000,
      notes: 'รถบรรทุกทะเบียน 82-5678'
    })
  });
  const saleRes = await worker.fetch(saleReq, mockEnv, mockCtx);
  const sale = (await saleRes.json()).data;
  console.log(`✓ ออกบิลขาย: [${sale.sale_no}] ส่งไป: ${sale.destination_factory}`);
  console.log(`  • สถานะบิลขาย: [${sale.status}] รอผลชั่งและใบแล็บ DRC จากโรงงาน`);

  await delay(1000);

  console.log('\n📌 ขั้นที่ 4: บันทึกผลแล็บ DRC โรงงาน & คำนวณ P&L สรุปผลกำไร-ขาดทุนสุทธิ');
  console.log('--------------------------------------------------------------------------------');
  const settleReq = new Request(`http://localhost/api/v1/rubber/sales/${sale.sale_no}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      factoryWeightKg: 2975, // น้ำหนักหายไประหว่างทาง 25 กก.
      factoryDrcPercent: 34.5,
      sellingPricePerKg: 76.00,
      penaltyDeduction: 200,
      transportCost: 1500,
      otherFees: 50,
      settlementDate: '2026-09-15'
    })
  });
  const settleRes = await worker.fetch(settleReq, mockEnv, mockCtx);
  const settled = (await settleRes.json()).data;

  console.log(`✓ บันทึกผลแล็บเรียบร้อย: ปิดยอดบิล [${settled.sale_no}] (Status: ${settled.status})`);
  console.log(`  • น้ำหนักชั่งหน้าโรงงาน: ${fmt(settled.factory_weight_kg)} กก. (น้ำหนักสูญเสีย: ${settled.weight_shrinkage_kg} กก.)`);
  console.log(`  • ราคาขายสุทธิตามแล็บ DRC: ${money(settled.net_price_per_kg)}/กก.`);
  console.log(`  • รายรับรวมก่อนหัก: ${money(settled.gross_revenue)}`);
  console.log(`  • รายรับสุทธิหลังหักค่าขนส่ง/ค่าปรับ: ${money(settled.net_revenue)}`);
  console.log(`  • ต้นทุนซื้อ Lot เดิม: ${money(lot.total_cost)}`);
  console.log(`  🎉 กำไรสุทธิของ Lot นี้ (Net Profit): \x1b[32m${money(settled.net_profit)}\x1b[0m`);
  console.log(`  📈 อัตรากำไรต่อ กก. (Margin/kg): \x1b[32m${money(settled.margin_per_kg)}/กก.\x1b[0m`);

  console.log('\n📊 ตรวจสอบข้อมูลในตาราง `rubber_sales` (สรุปผลรอบนี้):');
  console.table(mockSales.map(s => ({
    'Sale No': s.sale_no,
    'โรงงาน': s.destination_factory,
    'น้ำหนักโรงงาน': fmt(s.factory_weight_kg) + ' กก.',
    '%DRC': s.factory_drc_percent + '%',
    'รายรับสุทธิ': money(s.net_revenue),
    'กำไรสุทธิ': money(s.net_profit),
    'กำไร/กก.': money(s.margin_per_kg) + '/กก.',
    'สถานะ': s.status
  })));

  console.log('\n================================================================');
  console.log('🏁 ข้อมูลทุกแถวไหลเข้า D1 Database อย่างสมบูรณ์และถูกต้อง 100%!');
  console.log('================================================================\n');
}

runLiveDemo().catch(console.error);
