/**
 * Rubber Dashboard Analytics Service
 * Project: Receipt & Payment Voucher & Rubber Lot Management System
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 2.4 Real-time Dashboard Analytics)
 */

/**
 * ดึงข้อมูลสรุปภาพรวมสำหรับหน้า Dashboard
 * @param {object} db - D1 Database Binding
 * @param {string} [todayStr] - วันที่เป้าหมาย (YYYY-MM-DD)
 * @returns {Promise<object>}
 */
export async function getRubberDashboardSummary(db, todayStr = null) {
  const targetDate = todayStr || new Date().toISOString().split('T')[0];
  const targetMonth = targetDate.substring(0, 7); // YYYY-MM

  // 1. น้ำหนักรับซื้อรวมวันนี้
  const todayPurchases = await db.prepare(`
    SELECT COALESCE(SUM(weight_kg), 0) AS today_weight, COUNT(*) AS today_count
    FROM rubber_purchases
    WHERE purchase_date = ? AND status != 'CANCELLED'
  `).bind(targetDate).first();

  // 2. ยอดซื้อสะสมที่ยังไม่จัด Lot (Open Cost)
  const openPurchases = await db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) AS open_cost, 
           COALESCE(SUM(weight_kg), 0) AS open_weight, 
           COUNT(*) AS open_count
    FROM rubber_purchases
    WHERE (lot_id IS NULL OR status = 'UNASSIGNED') AND status != 'CANCELLED'
  `).first();

  // 3. จำนวนบิลขายโรงงานที่รอผลแล็บ DRC (Pending Factory Result)
  const pendingSales = await db.prepare(`
    SELECT COUNT(*) AS pending_count
    FROM rubber_sales
    WHERE status = 'PENDING'
  `).first();

  // 4. จำนวน Lot ที่ปิดยอดแล้วเดือนนี้ (Closed This Month) และกำไรสุทธิรวม
  const closedSales = await db.prepare(`
    SELECT COUNT(*) AS closed_count, COALESCE(SUM(net_profit), 0) AS total_profit
    FROM rubber_sales
    WHERE status = 'CLOSED' AND (settlement_date LIKE ? OR updated_at LIKE ?)
  `).bind(`${targetMonth}%`, `${targetMonth}%`).first();

  // 5. รายการ Lot ล่าสุดสำหรับ Stamp Badges
  const recentLots = await db.prepare(`
    SELECT lot_no, product_name, total_weight_kg, total_cost, avg_cost_per_kg, status, created_at
    FROM rubber_lots
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  // 6. รายการรับซื้อล่าสุดที่ยังไม่จัดเข้า Lot
  const recentPurchases = await db.prepare(`
    SELECT purchase_no, purchase_date, branch, seller_name, product_name, weight_kg, unit_price, total_amount, status
    FROM rubber_purchases
    WHERE (lot_id IS NULL OR status = 'UNASSIGNED') AND status != 'CANCELLED'
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  return {
    targetDate,
    targetMonth,
    todayWeight: Number(todayPurchases?.today_weight || 0),
    todayCount: Number(todayPurchases?.today_count || 0),
    openCost: Number(openPurchases?.open_cost || 0),
    openWeight: Number(openPurchases?.open_weight || 0),
    openCount: Number(openPurchases?.open_count || 0),
    pendingSalesCount: Number(pendingSales?.pending_count || 0),
    closedLotsMonthCount: Number(closedSales?.closed_count || 0),
    totalProfitMonth: Number(closedSales?.total_profit || 0),
    recentLots: recentLots?.results || [],
    recentPurchases: recentPurchases?.results || []
  };
}
