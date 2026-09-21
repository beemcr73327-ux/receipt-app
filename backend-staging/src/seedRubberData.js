/**
 * Seed Rubber Trading Database (Clean Reset & 5-Stage Demo Data)
 * Project: Receipt & Payment Voucher & Rubber Lot Management System
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 *
 * คำสั่งรัน:
 * npm run d1:seed
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, '..', 'local_d1.sqlite');
const SCHEMA_FILE = path.join(__dirname, '..', 'schema.sql');

export function seedDatabase() {
  console.log('================================================================');
  console.log('🌱 เริ่มต้นการรีเซ็ตและสร้างชุดข้อมูลมาตรฐานระบบ Lot ยางพารา 5 สถานะ');
  console.log('================================================================');

  const db = new DatabaseSync(DB_FILE);

  // 1. Clean rubber tables before applying schema so new columns and indexes can be created
  console.log('🧹 ล้างโครงสร้างและข้อมูลเดิมในตาราง rubber_sales, rubber_purchases, rubber_lots...');
  db.exec(`
    DROP TABLE IF EXISTS rubber_sales;
    DROP TABLE IF EXISTS rubber_purchases;
    DROP TABLE IF EXISTS rubber_lots;
    DELETE FROM document_sequences WHERE doc_type IN ('rubber_purchase', 'rubber_lot', 'rubber_sale');
  `);

  // 2. Re-apply schema
  if (fs.existsSync(SCHEMA_FILE)) {
    const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf-8');
    db.exec(schemaSql);
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const today = new Date().toISOString().split('T')[0];

  // 3. Insert Stage 5 Data: Completed Lot & Closed Sale
  db.prepare(`
    INSERT INTO rubber_lots (id, lot_no, lot_name, lot_date, product_type, total_weight_kg, total_cost, avg_cost_per_kg, items_count, status, created_at, updated_at)
    VALUES (1, 'LOT-69090001', 'ลุงสมชาย ใจดี, นายวินัย ปลูกยาง', ?, 'น้ำยางสด', 3000, 27024.00, 9.008, 2, 'COMPLETED', ?, ?)
  `).run(today, now, now);

  db.prepare(`
    INSERT INTO rubber_purchases (id, ticket_no, paper_ref, purchase_date, branch, seller_name, product_type, weight_kg, unit_price, drc_percent, dry_weight_kg, total_amount, lot_id, status, notes, created_at, updated_at)
    VALUES 
    (1, 'PB-69090001', 'P-101', ?, 'สาขาแม่สาย', 'ลุงสมชาย ใจดี', 'น้ำยางสด', 1200, 25.00, 35.0, 420, 10500.00, 1, 'ASSIGNED', 'ชั่งรอบเช้า คุณภาพดี', ?, ?),
    (2, 'PB-69090002', 'P-102', ?, 'สาขาแม่สาย', 'นายวินัย ปลูกยาง', 'น้ำยางสด', 1800, 25.50, 36.0, 648, 16524.00, 1, 'ASSIGNED', 'น้ำยางข้นเนื้อดี', ?, ?)
  `).run(today, now, now, today, now, now);

  db.prepare(`
    INSERT INTO rubber_sales (
      id, sale_no, lot_id, ref_lot_no, factory_name, sale_date, ship_date, outbound_weight_kg, factory_weight_kg, factory_drc_percent,
      selling_price_per_kg, net_price_per_kg, gross_revenue, penalty_deduction, transport_cost, other_fees,
      net_revenue, net_profit, margin_per_kg, weight_shrinkage_kg, status, created_at, updated_at
    ) VALUES (
      1, 'SL-69090001', 1, 'LOT-69090001', 'บริษัท ไทยฮั้วยางพารา จำกัด (เชียงราย)', ?, ?, 3000, 2980, 35.8,
      28.00, 10.024, 29871.52, 200.00, 1500.00, 0,
      28171.52, 1147.52, 0.385, 20.00, 'CLOSED', ?, ?
    )
  `).run(today, today, now, now);

  // 4. Insert Stage 3 & 4 Data: Shipped Lot & Pending Sale (รอผลโรงงาน)
  db.prepare(`
    INSERT INTO rubber_lots (id, lot_no, lot_name, lot_date, product_type, total_weight_kg, total_cost, avg_cost_per_kg, items_count, status, created_at, updated_at)
    VALUES (2, 'LOT-69090002', 'ป้าแดง ทองคำ, นางสมพร ค้าขาย', ?, 'ยางก้อนถ้วย', 3500, 73500.00, 21.00, 2, 'SHIPPED', ?, ?)
  `).run(today, now, now);

  db.prepare(`
    INSERT INTO rubber_purchases (id, ticket_no, paper_ref, purchase_date, branch, seller_name, product_type, weight_kg, unit_price, drc_percent, dry_weight_kg, total_amount, lot_id, status, notes, created_at, updated_at)
    VALUES 
    (3, 'PB-69090003', 'P-103', ?, 'สาขาฝาง', 'ป้าแดง ทองคำ', 'ยางก้อนถ้วย', 1500, 21.00, 0, 0, 31500.00, 2, 'ASSIGNED', 'ยางก้อนค้างคืนแห้งดี', ?, ?),
    (4, 'PB-69090004', 'P-104', ?, 'สาขาฝาง', 'นางสมพร ค้าขาย', 'ยางก้อนถ้วย', 2000, 21.00, 0, 0, 42000.00, 2, 'ASSIGNED', 'ส่งลานฝางช่วงบ่าย', ?, ?)
  `).run(today, now, now, today, now, now);

  db.prepare(`
    INSERT INTO rubber_sales (
      id, sale_no, lot_id, ref_lot_no, factory_name, sale_date, ship_date, outbound_weight_kg, factory_weight_kg, factory_drc_percent,
      selling_price_per_kg, net_price_per_kg, gross_revenue, penalty_deduction, transport_cost, other_fees,
      net_revenue, net_profit, margin_per_kg, weight_shrinkage_kg, status, created_at, updated_at
    ) VALUES (
      2, 'SL-69090002', 2, 'LOT-69090002', 'โรงงาน ก. (แม่สาย)', ?, ?, 3500, 0, 0,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 'PENDING', ?, ?
    )
  `).run(today, today, now, now);

  // 5. Insert Stage 2 Data: Grouped & Locked Lot
  db.prepare(`
    INSERT INTO rubber_lots (id, lot_no, lot_name, lot_date, product_type, total_weight_kg, total_cost, avg_cost_per_kg, items_count, status, created_at, updated_at)
    VALUES (3, 'LOT-69090003', 'นายบุญมี ทำสวน, ลุงประสิทธิ์ มีทรัพย์', ?, 'น้ำยางสด', 3000, 27300.00, 9.10, 2, 'LOCKED', ?, ?)
  `).run(today, now, now);

  db.prepare(`
    INSERT INTO rubber_purchases (id, ticket_no, paper_ref, purchase_date, branch, seller_name, product_type, weight_kg, unit_price, drc_percent, dry_weight_kg, total_amount, lot_id, status, notes, created_at, updated_at)
    VALUES 
    (5, 'PB-69090005', 'P-105', ?, 'สาขาแม่สาย', 'นายบุญมี ทำสวน', 'น้ำยางสด', 1400, 26.00, 35.0, 490, 12740.00, 3, 'ASSIGNED', 'จัดเข้า Lot 3 เรียบร้อย', ?, ?),
    (6, 'PB-69090006', 'P-106', ?, 'สาขาแม่สาย', 'ลุงประสิทธิ์ มีทรัพย์', 'น้ำยางสด', 1600, 26.00, 35.0, 560, 14560.00, 3, 'ASSIGNED', 'จัดเข้า Lot 3 เรียบร้อย', ?, ?)
  `).run(today, now, now, today, now, now);

  // 6. Insert Stage 1 Data: Unassigned Purchases
  db.prepare(`
    INSERT INTO rubber_purchases (id, ticket_no, paper_ref, purchase_date, branch, seller_name, product_type, weight_kg, unit_price, drc_percent, dry_weight_kg, total_amount, lot_id, status, notes, created_at, updated_at)
    VALUES 
    (7, 'PB-69090007', 'P-107', ?, 'สาขาแม่สาย', 'นายวีระ เกษตรกร', 'น้ำยางสด', 900, 26.50, 36.0, 324, 8586.00, NULL, 'UNASSIGNED', 'รอจัดกลุ่ม Lot ในแท็บ 03', ?, ?),
    (8, 'PB-69090008', 'P-108', ?, 'สาขาแม่สาย', 'นางอำไพ สวนยาง', 'น้ำยางสด', 1100, 26.50, 35.5, 390.5, 10348.25, NULL, 'UNASSIGNED', 'รอจัดกลุ่ม Lot ในแท็บ 03', ?, ?),
    (9, 'PB-69090009', 'P-109', ?, 'สาขาเชียงของ', 'นายมานพ ผลเจริญ', 'ยางก้อนถ้วย', 850, 20.50, 0, 0, 17425.00, NULL, 'UNASSIGNED', 'รอจัดกลุ่ม Lot ในแท็บ 03', ?, ?)
  `).run(today, now, now, today, now, now, today, now, now);

  // 7. Seed Sequences (prefix must be YYMM '6909' matching getThaiDocPrefix)
  const seqPrefix = '6909';
  db.prepare(`
    INSERT OR REPLACE INTO document_sequences (doc_type, prefix, current_seq, manual_seed, updated_at)
    VALUES 
    ('rubber_purchase', ?, 9, NULL, ?),
    ('rubber_lot', ?, 3, NULL, ?),
    ('rubber_sale', ?, 2, NULL, ?)
  `).run(seqPrefix, now, seqPrefix, now, seqPrefix, now);

  console.log('✅ ติดตั้งข้อมูลตัวอย่างมาตรฐานครบทั้ง 5 สถานะเรียบร้อยแล้ว:');
  console.log('   • ตาราง rubber_purchases: 9 รายการ (PB-69090001 ถึง PB-69090009)');
  console.log('     - บันทึกซื้อรอจัด Lot (UNASSIGNED): 3 ใบ');
  console.log('     - บันทึกซื้อที่จัดเข้า Lot แล้ว: 6 ใบ');
  console.log('   • ตาราง rubber_lots: 3 Lot (LOT-69090001 ถึง LOT-69090003)');
  console.log('================================================================');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase();
}
