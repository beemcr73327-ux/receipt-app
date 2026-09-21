/**
 * Rubber Lot Trading API Client
 * Project: Receipt & Payment Voucher & Rubber Lot Management System
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 2.4 UI Integration)
 */

import { storageService } from './storageService';
import { DEFAULT_STAGING_API_URL } from './stagingApiClient';

const LOCAL_PURCHASES_KEY = 'rubber_trading_local_purchases_v1';
const LOCAL_LOTS_KEY = 'rubber_trading_local_lots_v1';
const LOCAL_SALES_KEY = 'rubber_trading_local_sales_v1';

// Seed initial mock data from prototype if empty
const INITIAL_PURCHASES = [
  { id: 'PB-0142', ticket_no: 'PB-0142', date: '2026-08-27', purchase_date: '2026-08-27', branch: 'สาขาแม่สาย', farmer: 'ลุงสมชาย ใจดี', seller_name: 'ลุงสมชาย ใจดี', product: 'น้ำยางสด', product_type: 'น้ำยางสด', weight: 812, weight_kg: 812, price: 24.5, unit_price: 24.5, total_amount: 19894, lotId: null, lot_id: null, status: 'UNASSIGNED' },
  { id: 'PB-0143', ticket_no: 'PB-0143', date: '2026-08-27', purchase_date: '2026-08-27', branch: 'สาขาฝาง', farmer: 'ป้าแดง ทองคำ', seller_name: 'ป้าแดง ทองคำ', product: 'ยางก้อนถ้วย', product_type: 'ยางก้อนถ้วย', weight: 430, weight_kg: 430, price: 18.2, unit_price: 18.2, total_amount: 7826, lotId: null, lot_id: null, status: 'UNASSIGNED' },
  { id: 'PB-0144', ticket_no: 'PB-0144', date: '2026-08-28', purchase_date: '2026-08-28', branch: 'สาขาแม่สาย', farmer: 'นายวินัย ปลูกยาง', seller_name: 'นายวินัย ปลูกยาง', product: 'น้ำยางสด', product_type: 'น้ำยางสด', weight: 955, weight_kg: 955, price: 24.8, unit_price: 24.8, total_amount: 23684, lotId: null, lot_id: null, status: 'UNASSIGNED' },
  { id: 'PB-0145', ticket_no: 'PB-0145', date: '2026-08-28', purchase_date: '2026-08-28', branch: 'สาขาเชียงของ', farmer: 'นางสมพร ค้าขาย', seller_name: 'นางสมพร ค้าขาย', product: 'เศษยาง', product_type: 'เศษยาง', weight: 210, weight_kg: 210, price: 9.5, unit_price: 9.5, total_amount: 1995, lotId: null, lot_id: null, status: 'UNASSIGNED' },
  { id: 'PB-0146', ticket_no: 'PB-0146', date: '2026-08-29', purchase_date: '2026-08-29', branch: 'สาขาแม่สาย', farmer: 'ลุงสมชาย ใจดี', seller_name: 'ลุงสมชาย ใจดี', product: 'น้ำยางสด', product_type: 'น้ำยางสด', weight: 770, weight_kg: 770, price: 24.6, unit_price: 24.6, total_amount: 18942, lotId: null, lot_id: null, status: 'UNASSIGNED' },
  { id: 'PB-0147', ticket_no: 'PB-0147', date: '2026-08-29', purchase_date: '2026-08-29', branch: 'สาขาฝาง', farmer: 'นายบุญมี ทำสวน', seller_name: 'นายบุญมี ทำสวน', product: 'ยางก้อนถ้วย', product_type: 'ยางก้อนถ้วย', weight: 388, weight_kg: 388, price: 18.0, unit_price: 18.0, total_amount: 6984, lotId: null, lot_id: null, status: 'UNASSIGNED' }
];

const INITIAL_SALES = [
  {
    sale_no: 'SL-2026-014',
    billNo: 'SL-2026-014',
    lot_no: 'LOT-69080001',
    factory_name: 'โรงงาน ข. (เชียงราย)',
    destination_factory: 'โรงงาน ข. (เชียงราย)',
    ship_date: '2026-08-24',
    shipping_date: '2026-08-24',
    outbound_weight_kg: 2100,
    weight: 2100,
    lot_total_cost: 48200,
    cost: 48200,
    status: 'closed',
    actual_weight_kg: 2085,
    actualWeight: 2085,
    factory_drc_percent: 34.2,
    drc: 34.2,
    selling_price_per_kg: 26.1,
    sellPrice: 26.1,
    gross_revenue: 54418,
    net_revenue: 54418,
    revenue: 54418,
    net_profit: 6218,
    margin_per_kg: 2.98,
    weight_shrinkage_kg: 15
  },
  {
    sale_no: 'SL-2026-015',
    billNo: 'SL-2026-015',
    lot_no: 'LOT-69080002',
    factory_name: 'โรงงาน ก. (แม่สาย)',
    destination_factory: 'โรงงาน ก. (แม่สาย)',
    ship_date: '2026-08-26',
    shipping_date: '2026-08-26',
    outbound_weight_kg: 1640,
    weight: 1640,
    lot_total_cost: 37650,
    cost: 37650,
    status: 'pending',
    actual_weight_kg: null,
    actualWeight: null,
    factory_drc_percent: null,
    drc: null,
    selling_price_per_kg: null,
    sellPrice: null,
    gross_revenue: null,
    net_revenue: null,
    revenue: null,
    net_profit: null,
    margin_per_kg: null,
    weight_shrinkage_kg: null
  }
];

function getLocalStore(key, defaultData) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultData;
  } catch {
    return defaultData;
  }
}

function setLocalStore(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

/**
 * Safely encode HTTP header values to prevent ByteString TypeError with non-ASCII (Thai) text
 */
function safeHeaderValue(val) {
  if (!val) return '';
  try {
    return encodeURIComponent(String(val).trim());
  } catch (e) {
    return '';
  }
}

class RubberLotApiClient {
  getBaseUrl() {
    const settings = storageService.getSettings();
    return (settings.stagingApiUrl || DEFAULT_STAGING_API_URL).replace(/\/+$/, '');
  }

  isStagingActive() {
    const settings = storageService.getSettings();
    // เชื่อมต่อ Staging D1 Worker ทันทีเมื่อเปิดโหมด Staging หรือเปิดระบบ Lot ยางพารา
    return settings.apiMode === 'staging' || settings.enableRubberLotTrading === true;
  }

  // 1. Dashboard Summary
  async getDashboardSummary(targetDate = null) {
    if (this.isStagingActive()) {
      try {
        const query = targetDate ? `?date=${encodeURIComponent(targetDate)}` : '';
        const res = await fetch(`${this.getBaseUrl()}/api/v1/rubber/dashboard${query}`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Staging backend unreachable, falling back to local storage:', err.message);
      }
    }

    // Fallback: Local Calculation
    const purchases = getLocalStore(LOCAL_PURCHASES_KEY, INITIAL_PURCHASES);
    const sales = getLocalStore(LOCAL_SALES_KEY, INITIAL_SALES);
    const date = targetDate || new Date().toISOString().split('T')[0];

    const todayPurchases = purchases.filter(p => (p.date === date || p.purchase_date === date) && p.status !== 'CANCELLED');
    const todayWeight = todayPurchases.reduce((s, p) => s + (p.weight || p.weight_kg || 0), 0);

    const unlotted = purchases.filter(p => (!p.lotId && !p.lot_id) && p.status !== 'CANCELLED');
    const openCost = unlotted.reduce((s, p) => s + ((p.weight || p.weight_kg || 0) * (p.price || p.unit_price || 0)), 0);

    const pendingSalesCount = sales.filter(s => s.status === 'pending' || s.status === 'PENDING').length;
    const closedSales = sales.filter(s => s.status === 'closed' || s.status === 'CLOSED');
    const closedCount = closedSales.length;
    const totalProfit = closedSales.reduce((s, item) => s + (item.net_profit || (item.revenue - item.cost) || 0), 0);

    return {
      todayWeight,
      todayCount: todayPurchases.length,
      openCost,
      openCount: unlotted.length,
      pendingSalesCount,
      closedLotsMonthCount: closedCount,
      totalProfitMonth: totalProfit,
      recentPurchases: unlotted.slice(-10).reverse(),
      recentLots: sales.map(s => ({
        lot_no: s.sale_no || s.billNo,
        status: s.status === 'closed' || s.status === 'CLOSED' ? 'CLOSED' : 'PENDING'
      }))
    };
  }

  // 2. Unassigned Purchases List
  async getUnassignedPurchases(filters = {}) {
    if (this.isStagingActive()) {
      try {
        const params = new URLSearchParams();
        if (filters.branch) params.set('branch', filters.branch);
        if (filters.productType) params.set('productName', filters.productType);
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${this.getBaseUrl()}/api/v1/rubber/purchases/unassigned${query}`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (err) {
        console.warn('Staging getUnassignedPurchases error, fallback to local:', err.message);
      }
    }

    // Fallback: Local Storage
    const purchases = getLocalStore(LOCAL_PURCHASES_KEY, INITIAL_PURCHASES);
    return purchases.filter(p => {
      if (p.lotId || p.lot_id) return false;
      if (p.status === 'CANCELLED') return false;
      if (filters.branch && p.branch !== filters.branch) return false;
      if (filters.productType && (p.product !== filters.productType && p.product_type !== filters.productType)) return false;
      if (filters.dateFrom && (p.date < filters.dateFrom || p.purchase_date < filters.dateFrom)) return false;
      if (filters.dateTo && (p.date > filters.dateTo || p.purchase_date > filters.dateTo)) return false;
      return true;
    });
  }

  // 3. Create Purchase Ticket
  async createPurchaseTicket(payload, user = null) {
    if (this.isStagingActive()) {
      try {
        const enrichedPayload = {
          ...payload,
          createdByName: user?.fullName || 'เจ้าหน้าที่ชั่ง',
          createdByEmail: user?.email || ''
        };
        const res = await fetch(`${this.getBaseUrl()}/api/v1/rubber/purchases`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(enrichedPayload)
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Server error (HTTP ${res.status})`);
        }
      } catch (err) {
        console.error('Staging backend error:', err);
        throw new Error(`ไม่สามารถส่งข้อมูลเข้าฐานข้อมูล D1 ได้ (${err.message}). กรุณาตรวจสอบว่าเปิด terminal รันคำสั่ง npm run staging:server หรือยัง`);
      }
    }

    // Local Store
    const purchases = getLocalStore(LOCAL_PURCHASES_KEY, INITIAL_PURCHASES);
    const counter = purchases.length + 150;
    const ticketNo = `PB-${String(counter).padStart(4, '0')}`;
    const weight = parseFloat(payload.weightKg || payload.weight) || 0;
    const price = parseFloat(payload.unitPrice || payload.price) || 0;
    const drc = parseFloat(payload.drcPercent || payload.drc) || 0;
    const total = drc > 0 ? Math.round((weight * price * drc / 100) * 100) / 100 : Math.round((weight * price) * 100) / 100;

    const entry = {
      id: ticketNo,
      ticket_no: ticketNo,
      purchase_no: ticketNo,
      date: payload.purchaseDate || payload.date || new Date().toISOString().split('T')[0],
      purchase_date: payload.purchaseDate || payload.date || new Date().toISOString().split('T')[0],
      branch: payload.branch || 'สาขาแม่สาย',
      farmer: payload.sellerName || payload.farmer,
      seller_name: payload.sellerName || payload.farmer,
      product: payload.productType || payload.product,
      product_type: payload.productType || payload.product,
      weight,
      weight_kg: weight,
      price,
      unit_price: price,
      drc_percent: drc,
      total_amount: total,
      lotId: null,
      lot_id: null,
      paperRef: payload.paperRef || '',
      paper_ref: payload.paperRef || '',
      status: 'UNASSIGNED',
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };

    purchases.unshift(entry);
    setLocalStore(LOCAL_PURCHASES_KEY, purchases);
    return entry;
  }

  // 4. Create Lot and Sales Bill (Sell Builder)
  async createSaleFromPurchases(salePayload, user = null) {
    if (this.isStagingActive()) {
      try {
        // Step A: Create Lot
        const lotRes = await fetch(`${this.getBaseUrl()}/api/v1/rubber/lots`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            purchaseTicketNos: salePayload.ticketNos,
            lotName: salePayload.lotName,
            lotDate: salePayload.lotDate || salePayload.shipDate || new Date().toISOString().split('T')[0],
            productType: salePayload.productType,
            createdByName: user?.fullName || 'ผู้จัดการคลัง',
            createdByEmail: user?.email || ''
          })
        });

        if (lotRes.ok) {
          const lotJson = await lotRes.json();
          const lotNo = lotJson.data.lot?.lot_no || lotJson.data.lot_no;

          // Step B: Lock Lot
          await fetch(`${this.getBaseUrl()}/api/v1/rubber/lots/${lotNo}/lock`, { method: 'POST' });

          // Step C: Create Sale Record
          const saleRes = await fetch(`${this.getBaseUrl()}/api/v1/rubber/sales`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              lotNo,
              refLotNo: lotNo,
              destinationFactory: salePayload.factory,
              saleDate: salePayload.saleDate || salePayload.shipDate || new Date().toISOString().split('T')[0],
              shippingDate: salePayload.shipDate || new Date().toISOString().split('T')[0],
              outboundWeightKg: salePayload.shipWeight,
              notes: salePayload.notes,
              createdByName: user?.fullName || 'เจ้าหน้าที่ฝ่ายขาย',
              createdByEmail: user?.email || ''
            })
          });

          if (saleRes.ok) {
            const saleJson = await saleRes.json();
            return saleJson.data;
          }
        }
      } catch (err) {
        console.error('Staging backend error:', err);
        throw new Error(`ไม่สามารถสร้างบิลขายไปยังฐานข้อมูล D1 ได้ (${err.message})`);
      }
    }

    // Fallback: Local Storage
    const purchases = getLocalStore(LOCAL_PURCHASES_KEY, INITIAL_PURCHASES);
    const sales = getLocalStore(LOCAL_SALES_KEY, INITIAL_SALES);

    const billNo = salePayload.billNo || `SL-2026-${String(sales.length + 16).padStart(3, '0')}`;
    const selectedPurchases = purchases.filter(p => salePayload.ticketNos.includes(p.id || p.ticket_no));
    
    const totalW = selectedPurchases.reduce((s, p) => s + (p.weight || p.weight_kg || 0), 0);
    const totalC = selectedPurchases.reduce((s, p) => s + (p.total_amount || (p.weight * p.price) || 0), 0);

    const sellersList = [...new Set(selectedPurchases.map(p => p.farmer || p.seller_name).filter(Boolean))].join(', ');
    const fallbackLotNo = salePayload.refLotNo || `LOT-6909${String(sales.length + 1).padStart(4, '0')}`;
    const dateStr = salePayload.saleDate || salePayload.shipDate || new Date().toISOString().split('T')[0];

    const newSale = {
      sale_no: billNo,
      billNo,
      ref_lot_no: fallbackLotNo,
      lot_no: fallbackLotNo,
      lot_name: salePayload.lotName || sellersList || `Lot ${salePayload.productType}`,
      lot_date: salePayload.lotDate || dateStr,
      sale_date: dateStr,
      factory: salePayload.factory,
      factory_name: salePayload.factory,
      destination_factory: salePayload.factory,
      shipDate: salePayload.shipDate || dateStr,
      shipping_date: salePayload.shipDate || dateStr,
      weight: totalW,
      outbound_weight_kg: salePayload.shipWeight || totalW,
      cost: totalC,
      lot_total_cost: totalC,
      status: 'pending',
      actualWeight: null,
      drc: null,
      sellPrice: null,
      revenue: null,
      net_profit: null,
      margin_per_kg: null,
      lines: selectedPurchases
    };

    // Mark purchases as assigned
    selectedPurchases.forEach(p => {
      p.lotId = billNo;
      p.lot_id = billNo;
      p.status = 'ASSIGNED';
    });

    sales.unshift(newSale);
    setLocalStore(LOCAL_PURCHASES_KEY, purchases);
    setLocalStore(LOCAL_SALES_KEY, sales);

    return newSale;
  }

  // 5. Get Sales List
  async listSales() {
    if (this.isStagingActive()) {
      try {
        const res = await fetch(`${this.getBaseUrl()}/api/v1/rubber/sales`);
        if (res.ok) {
          const json = await res.json();
          const items = json.data?.items || json.data?.records || (Array.isArray(json.data) ? json.data : []);
          return Array.isArray(items) ? items : [];
        }
      } catch (err) {
        console.warn('Staging error, fallback to local:', err.message);
      }
    }

    return getLocalStore(LOCAL_SALES_KEY, INITIAL_SALES);
  }

  // 6. Settle Factory DRC & Close Lot
  async settleFactorySale(saleNo, settlementData, user = null) {
    if (this.isStagingActive()) {
      try {
        const res = await fetch(`${this.getBaseUrl()}/api/v1/rubber/sales/${encodeURIComponent(saleNo)}/settle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...settlementData,
            settledByName: user?.fullName || '',
            settledByEmail: user?.email || ''
          })
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Server error (HTTP ${res.status})`);
        }
      } catch (err) {
        console.error('Staging backend error:', err);
        throw new Error(`ไม่สามารถบันทึกผลโรงงาน/ปิด Lot ไปยังฐานข้อมูล D1 ได้ (${err.message})`);
      }
    }

    // Local Storage
    const sales = getLocalStore(LOCAL_SALES_KEY, INITIAL_SALES);
    const sale = sales.find(s => (s.sale_no === saleNo || s.billNo === saleNo));
    if (!sale) throw new Error(`ไม่พบบิลขายเลขที่ ${saleNo}`);

    const aw = parseFloat(settlementData.factoryWeightKg || settlementData.actualWeight) || sale.weight || sale.outbound_weight_kg;
    const drc = parseFloat(settlementData.factoryDrcPercent || settlementData.drc) || 0;
    const sp = parseFloat(settlementData.sellingPricePerKg || settlementData.sellPrice) || 0;
    const penalty = parseFloat(settlementData.penaltyDeduction) || 0;
    const transport = parseFloat(settlementData.transportCost) || 0;
    const other = parseFloat(settlementData.otherFees) || 0;

    const netPrice = drc > 0 ? Math.round((sp * drc / 100) * 100) / 100 : sp;
    const grossRev = Math.round((aw * netPrice) * 100) / 100;
    const netRev = Math.round((grossRev - penalty - transport - other) * 100) / 100;
    const netProfit = Math.round((netRev - (sale.cost || sale.lot_total_cost || 0)) * 100) / 100;
    const margin = aw > 0 ? Math.round((netProfit / aw) * 100) / 100 : 0;
    const shrinkage = (sale.weight || sale.outbound_weight_kg || aw) - aw;

    sale.actualWeight = aw;
    sale.actual_weight_kg = aw;
    sale.drc = drc;
    sale.factory_drc_percent = drc;
    sale.sellPrice = sp;
    sale.selling_price_per_kg = sp;
    sale.net_price_per_kg = netPrice;
    sale.gross_revenue = grossRev;
    sale.revenue = netRev;
    sale.net_revenue = netRev;
    sale.net_profit = netProfit;
    sale.margin_per_kg = margin;
    sale.weight_shrinkage_kg = shrinkage;
    sale.status = 'closed';
    sale.settlement_date = settlementData.settlementDate || new Date().toISOString().split('T')[0];

    setLocalStore(LOCAL_SALES_KEY, sales);
    return sale;
  }
}

export const rubberLotApiClient = new RubberLotApiClient();
