/**
 * Real-Time Database Monitor & Live Watcher (D1 SQLite)
 * Project: Rubber Lot Trading & Financial Management System
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 *
 * รันคำสั่งนี้เพื่อเปิดหน้าต่างเฝ้าดูข้อมูลไหลเข้า Database แบบ REAL-TIME:
 * npm run d1:watch
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'local_d1.sqlite');

let lastPurchaseCount = -1;
let lastLotCount = -1;
let lastSaleCount = -1;

function renderMonitor() {
  let db;
  try {
    db = new DatabaseSync(DB_FILE);
  } catch (err) {
    console.log('⏳ กำลังรอฐานข้อมูลเริ่มต้น...', err.message);
    return;
  }

  const purchases = db.prepare('SELECT id, ticket_no, seller_name, product_type, weight_kg, unit_price, total_amount, status, created_at FROM rubber_purchases ORDER BY id DESC LIMIT 10').all();
  const lots = db.prepare('SELECT id, lot_no, lot_name, product_type, total_weight_kg, total_cost, avg_cost_per_kg, status FROM rubber_lots ORDER BY id DESC LIMIT 5').all();
  const sales = db.prepare('SELECT id, sale_no, factory_name, factory_weight_kg, net_revenue, net_profit, status FROM rubber_sales ORDER BY id DESC LIMIT 5').all();

  const currentPurchaseCount = db.prepare('SELECT COUNT(*) as c FROM rubber_purchases').get().c;
  const currentLotCount = db.prepare('SELECT COUNT(*) as c FROM rubber_lots').get().c;
  const currentSaleCount = db.prepare('SELECT COUNT(*) as c FROM rubber_sales').get().c;

  const isNewData = (lastPurchaseCount !== -1 && currentPurchaseCount > lastPurchaseCount) ||
                    (lastLotCount !== -1 && currentLotCount > lastLotCount) ||
                    (lastSaleCount !== -1 && currentSaleCount > lastSaleCount);

  lastPurchaseCount = currentPurchaseCount;
  lastLotCount = currentLotCount;
  lastSaleCount = currentSaleCount;

  console.clear();
  const timeStr = new Date().toLocaleTimeString('th-TH');
  console.log('================================================================================');
  console.log(`🌿 บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด — REAL-TIME D1 DATABASE MONITOR 🌿`);
  console.log(`📡 กำลังเฝ้าดูฐานข้อมูลสด (Live Polling ทุก 0.5 วินาที) | อัปเดตล่าสุด: ${timeStr}`);
  console.log('================================================================================');

  if (isNewData) {
    process.stdout.write('\u0007'); // Terminal Bell Alert
    console.log(`\n🎉 ⚡ ตรวจพบข้อมูลใหม่ไหลเข้าสู่ Database สำเร็จเมื่อสักครู่นี้! (${timeStr})\n`);
  }

  console.log(`\n📦 [ตาราง 1: rubber_purchases] ใบชั่งซื้อยางเข้าลาน (ทั้งหมด ${currentPurchaseCount} ใบ):`);
  if (purchases.length === 0) {
    console.log('   (ยังไม่มีรายการ — รอรับข้อมูลจากหน้าเว็บ Tab 02)');
  } else {
    console.table(purchases);
  }

  console.log(`\n🏭 [ตาราง 2: rubber_lots] กลุ่ม Lot สินค้าจัดส่ง (ทั้งหมด ${currentLotCount} Lot):`);
  if (lots.length === 0) {
    console.log('   (ยังไม่มี Lot — รวมบิลได้จากหน้าเว็บ Tab 03)');
  } else {
    console.table(lots);
  }

  console.log(`\n🚚 [ตาราง 3: rubber_sales] บิลขายส่งโรงงาน & DRC กำไรสุทธิ (ทั้งหมด ${currentSaleCount} รายการ):`);
  if (sales.length === 0) {
    console.log('   (ยังไม่มีรายการขาย — สร้างบิลขายได้จากหน้าเว็บ Tab 04-05)');
  } else {
    console.table(sales);
  }

  console.log('\n💡 คำแนะนำ: เปิดหน้าต่างนี้ค้างไว้คู่กับเบราว์เซอร์ ทุกครั้งที่กดบันทึกในหน้าเว็บ ข้อมูลจะโผล่ที่นี่ทันที!');
  console.log('   กด Ctrl + C เพื่อปิดการเฝ้าดู');
}

// Render first time
renderMonitor();

// Poll every 500ms for instant real-time reflection
setInterval(renderMonitor, 500);
