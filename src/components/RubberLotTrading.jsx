import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Scale,
  Layers,
  Send,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Calendar,
  Filter,
  ArrowRight,
  RefreshCw,
  Plus,
  Trash2,
  FileSpreadsheet
} from 'lucide-react';
import { rubberLotApiClient } from '../services/rubberLotApiClient';

export default function RubberLotTrading({ currentUser }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'buy' | 'records' | 'sell' | 'factory'
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Dashboard State
  const [dashSummary, setDashSummary] = useState({
    todayWeight: 0,
    todayCount: 0,
    openCost: 0,
    openCount: 0,
    pendingSalesCount: 0,
    closedLotsMonthCount: 0,
    totalProfitMonth: 0,
    recentPurchases: [],
    recentLots: []
  });

  // 2. Buy Form State
  const [fDate, setFDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fBranch, setFBranch] = useState('สาขาแม่สาย');
  const [fFarmer, setFFarmer] = useState('');
  const [fProduct, setFProduct] = useState('น้ำยางสด');
  const [fWeight, setFWeight] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fDrc, setFDrc] = useState('');
  const [fPaperRef, setFPaperRef] = useState('');
  const [todaysEntries, setTodaysEntries] = useState([]);
  const farmerInputRef = useRef(null);

  // 3. Records State
  const [unassignedList, setUnassignedList] = useState([]);
  const [filtBranch, setFiltBranch] = useState('');
  const [filtProduct, setFiltProduct] = useState('');
  const [filtFrom, setFiltFrom] = useState('');
  const [filtTo, setFiltTo] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 4. Sell State
  const [currentSellLines, setCurrentSellLines] = useState([]);
  const [sellBillNo, setSellBillNo] = useState('');
  const [sellFactory, setSellFactory] = useState('โรงงาน ก. (แม่สาย)');
  const [sellShipDate, setSellShipDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sellShipWeight, setSellShipWeight] = useState('');

  // 5. Factory State
  const [salesList, setSalesList] = useState([]);
  const [openForms, setOpenForms] = useState(new Set());
  const [factoryInputs, setFactoryInputs] = useState({});

  // Formatting helpers
  const fmt = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const fmtMoney = (n) => '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Calculate buy total
  const buyWeight = parseFloat(fWeight) || 0;
  const buyPrice = parseFloat(fPrice) || 0;
  const buyDrc = parseFloat(fDrc) || 0;
  const buyTotal = buyDrc > 0
    ? Math.round((buyWeight * buyPrice * buyDrc / 100) * 100) / 100
    : Math.round((buyWeight * buyPrice) * 100) / 100;

  // Initial and reactive data load
  useEffect(() => {
    loadData();
  }, [refreshKey, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const summary = await rubberLotApiClient.getDashboardSummary();
        setDashSummary(summary);
      } else if (activeTab === 'records') {
        const list = await rubberLotApiClient.getUnassignedPurchases({
          branch: filtBranch,
          productType: filtProduct,
          dateFrom: filtFrom,
          dateTo: filtTo
        });
        setUnassignedList(list);
      } else if (activeTab === 'factory') {
        const sales = await rubberLotApiClient.listSales();
        setSalesList(sales);
      }
    } catch (err) {
      console.warn('Load data error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ------------------ Buy Handlers ------------------
  const clearBuyForm = () => {
    setFFarmer('');
    setFWeight('');
    setFPrice('');
    setFDrc('');
    setFPaperRef('');
    if (farmerInputRef.current) farmerInputRef.current.focus();
  };

  const handleSaveBuyEntry = async (closeAfter = false) => {
    if (!fFarmer.trim() || !buyWeight || !buyPrice) {
      alert('กรุณากรอก ชื่อชาวสวน, น้ำหนัก และราคา ให้ครบถ้วนก่อนบันทึก');
      return;
    }

    try {
      const payload = {
        purchaseDate: fDate,
        branch: fBranch,
        sellerName: fFarmer.trim(),
        productType: fProduct,
        weightKg: buyWeight,
        unitPrice: buyPrice,
        drcPercent: buyDrc,
        paperRef: fPaperRef.trim()
      };

      const created = await rubberLotApiClient.createPurchaseTicket(payload, currentUser);
      setTodaysEntries(prev => [created, ...prev]);

      clearBuyForm();
      if (closeAfter) {
        setActiveTab('dashboard');
      } else {
        if (farmerInputRef.current) farmerInputRef.current.focus();
      }
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    }
  };

  // ------------------ Records / Lot Mix Handlers ------------------
  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(unassignedList.map(p => p.id || p.ticket_no));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  // Check Single Product Rule
  const selectedItems = unassignedList.filter(p => selectedIds.has(p.id || p.ticket_no));
  const distinctProductTypes = Array.from(new Set(selectedItems.map(p => p.product || p.product_type)));
  const isProductMismatch = distinctProductTypes.length > 1;

  const selTotalWeight = selectedItems.reduce((s, p) => s + (p.weight || p.weight_kg || 0), 0);
  const selTotalCost = selectedItems.reduce((s, p) => s + (p.total_amount || ((p.weight || 0) * (p.price || 0))), 0);

  const handleGoToSell = () => {
    if (selectedItems.length === 0) {
      alert('กรุณาเลือกรายการซื้ออย่างน้อย 1 รายการ');
      return;
    }
    if (isProductMismatch) {
      alert(`⚠️ กฎเหล็ก: 1 Lot ต้องบรรจุยางชนิดเดียวกัน 100%\nปัจจุบันคุณเลือกปนกัน ${distinctProductTypes.length} ชนิด: ${distinctProductTypes.join(', ')}`);
      return;
    }

    setCurrentSellLines(selectedItems);
    setSellBillNo(`SL-2026-${String(Math.floor(100 + Math.random() * 900))}`);
    setSellShipWeight(selTotalWeight);
    setActiveTab('sell');
  };

  // ------------------ Sell Handlers ------------------
  const sellTotalWeight = currentSellLines.reduce((s, p) => s + (p.weight || p.weight_kg || 0), 0);
  const sellTotalCost = currentSellLines.reduce((s, p) => s + (p.total_amount || ((p.weight || 0) * (p.price || 0))), 0);
  const sellAvgCost = sellTotalWeight > 0 ? (sellTotalCost / sellTotalWeight) : 0;

  const handleConfirmSell = async () => {
    if (currentSellLines.length === 0) return;
    try {
      const payload = {
        billNo: sellBillNo,
        factory: sellFactory,
        shipDate: sellShipDate,
        shipWeight: parseFloat(sellShipWeight) || sellTotalWeight,
        productType: currentSellLines[0]?.product || currentSellLines[0]?.product_type || 'น้ำยางสด',
        ticketNos: currentSellLines.map(p => p.id || p.ticket_no)
      };

      await rubberLotApiClient.createSaleFromPurchases(payload, currentUser);
      alert(`✓ สร้างบิลขาย ${sellBillNo} เรียบร้อย — เข้าคิวรอผลโรงงานแล้ว`);
      setSelectedIds(new Set());
      setCurrentSellLines([]);
      setActiveTab('factory');
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการสร้างบิลขาย: ' + err.message);
    }
  };

  // ------------------ Factory Settlement Handlers ------------------
  const toggleFactoryForm = (idx) => {
    setOpenForms(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleFactoryInputChange = (idx, field, val) => {
    setFactoryInputs(prev => ({
      ...prev,
      [idx]: {
        ...(prev[idx] || {}),
        [field]: val
      }
    }));
  };

  const handleSettleSale = async (lot, idx) => {
    const inputs = factoryInputs[idx] || {};
    const aw = parseFloat(inputs.actualWeight) || lot.weight || lot.outbound_weight_kg;
    const drc = parseFloat(inputs.drc) || 0;
    const sp = parseFloat(inputs.sellPrice) || 0;
    const penalty = parseFloat(inputs.penalty) || 0;
    const transport = parseFloat(inputs.transport) || 0;
    const other = parseFloat(inputs.other) || 0;

    if (!sp || sp <= 0) {
      alert('กรุณาระบุราคาขายต่อ กก. จากโรงงาน');
      return;
    }

    try {
      const payload = {
        factoryWeightKg: aw,
        factoryDrcPercent: drc,
        sellingPricePerKg: sp,
        penaltyDeduction: penalty,
        transportCost: transport,
        otherFees: other,
        settlementDate: new Date().toISOString().split('T')[0]
      };

      await rubberLotApiClient.settleFactorySale(lot.sale_no || lot.billNo, payload, currentUser);
      alert(`✓ บันทึกผลโรงงานและปิดยอด Lot ${lot.sale_no || lot.billNo} เรียบร้อย`);
      toggleFactoryForm(idx);
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกผลโรงงาน: ' + err.message);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden font-sans text-[#21301F] bg-[#F1ECDE]">
      
      {/* 1. Left Nav / Tabs Bar (สไตล์ LivingOS + Traditional Ledger) */}
      <aside className="w-full md:w-60 bg-[#21301F] text-[#F1ECDE] p-5 flex md:flex-col justify-between shrink-0 shadow-lg select-none z-10">
        <div>
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#F1ECDE]/20">
            <div className="w-8 h-8 rounded-full bg-[#8C6239] flex items-center justify-center text-[#F1ECDE] font-bold text-sm shadow">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="font-serif font-bold text-sm leading-tight text-[#F1ECDE]">
                โรงรับซื้อยางพารา
              </div>
              <div className="text-[10px] text-[#F1ECDE]/60 uppercase tracking-wider font-mono">
                BUY · MIX · SELL
              </div>
            </div>
          </div>

          <nav className="flex md:flex-col gap-1 mt-4 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer text-left ${
                activeTab === 'dashboard' ? 'bg-[#3C6E63] text-white shadow' : 'text-[#F1ECDE]/70 hover:bg-[#F1ECDE]/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10.5px] opacity-60">01</span>
              <span>ภาพรวม</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('buy')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer text-left ${
                activeTab === 'buy' ? 'bg-[#3C6E63] text-white shadow' : 'text-[#F1ECDE]/70 hover:bg-[#F1ECDE]/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10.5px] opacity-60">02</span>
              <span>บันทึกซื้อ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer text-left ${
                activeTab === 'records' ? 'bg-[#3C6E63] text-white shadow' : 'text-[#F1ECDE]/70 hover:bg-[#F1ECDE]/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10.5px] opacity-60">03</span>
              <span>รายการซื้อ / จัด Lot</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sell')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer text-left ${
                activeTab === 'sell' ? 'bg-[#3C6E63] text-white shadow' : 'text-[#F1ECDE]/70 hover:bg-[#F1ECDE]/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10.5px] opacity-60">04</span>
              <span>สร้างบิลขาย</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('factory')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer text-left ${
                activeTab === 'factory' ? 'bg-[#3C6E63] text-white shadow' : 'text-[#F1ECDE]/70 hover:bg-[#F1ECDE]/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10.5px] opacity-60">05</span>
              <span>รอผลโรงงาน (DRC)</span>
            </button>
          </nav>
        </div>

        <div className="hidden md:block pt-4 border-t border-[#F1ECDE]/15 text-[10.5px] text-[#F1ECDE]/50 leading-relaxed">
          ระบบ Lot ยางพารา v5.0<br />
          บจก. ศรีสุข พูนทรัพย์ ยางพารา
        </div>
      </aside>

      {/* 2. Main Workspace (Scrollable Content Area) */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-6xl">

        {/* ========================================================= */}
        {/* VIEW 01: DASHBOARD                                        */}
        {/* ========================================================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-[#8C6239] font-bold">
                  ภาพรวมวันนี้ · REAL-TIME ANALYTICS
                </p>
                <h1 className="text-2xl font-serif font-bold text-[#21301F] mt-1">
                  สรุปการรับซื้อ & สถานะ Lot ยางพารา
                </h1>
                <p className="text-xs text-[#425842] mt-0.5">
                  เชื่อมโยงข้อมูล 3 สาขา (แม่สาย, ฝาง, เชียงของ) อัปเดตแบบเรียลไทม์
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('buy')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#3C6E63] hover:bg-[#2A4E46] text-white rounded-lg text-xs font-bold transition shadow cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ บันทึกรายการซื้อใหม่</span>
              </button>
            </div>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-4 shadow-sm">
                <div className="text-xs text-[#425842] font-semibold">น้ำหนักรับซื้อวันนี้</div>
                <div className="font-mono text-2xl font-bold text-[#21301F] mt-1">
                  {fmt(dashSummary.todayWeight)} กก.
                </div>
                <div className="text-[11px] text-[#425842] mt-1">
                  บันทึกแล้ว {dashSummary.todayCount} รายการ
                </div>
              </div>

              <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-4 shadow-sm">
                <div className="text-xs text-[#425842] font-semibold">ยอดซื้อสะสม (ยังไม่จัด Lot)</div>
                <div className="font-mono text-2xl font-bold text-[#8C6239] mt-1">
                  {fmtMoney(dashSummary.openCost)}
                </div>
                <div className="text-[11px] text-[#425842] mt-1">
                  รอจัดกลุ่มเป็น Lot ขาย ({dashSummary.openCount || 0} บิล)
                </div>
              </div>

              <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-4 shadow-sm">
                <div className="text-xs text-[#425842] font-semibold">Lot รอผลโรงงาน</div>
                <div className="font-mono text-2xl font-bold text-[#A23E32] mt-1">
                  {dashSummary.pendingSalesCount} Lot
                </div>
                <div className="text-[11px] text-[#425842] mt-1">
                  รอชั่งน้ำหนัก / ค่าแล็บ DRC%
                </div>
              </div>

              <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-4 shadow-sm">
                <div className="text-xs text-[#425842] font-semibold">กำไรสุทธิสะสมเดือนนี้</div>
                <div className="font-mono text-2xl font-bold text-[#3C6E63] mt-1">
                  {fmtMoney(dashSummary.totalProfitMonth)}
                </div>
                <div className="text-[11px] text-[#425842] mt-1">
                  ปิดยอดแล้ว {dashSummary.closedLotsMonthCount} Lot
                </div>
              </div>
            </div>

            {/* Stamp Badges Panel */}
            <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-[#21301F]">สถานะ Lot ล่าสุด (Lot Stamps)</h3>
              <div className="flex flex-wrap gap-2.5">
                {dashSummary.recentLots?.length > 0 ? (
                  dashSummary.recentLots.map((lot, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 border-2 rounded-full font-mono text-[11px] font-bold tracking-wider uppercase -rotate-1 shadow-2xs ${
                        lot.status === 'CLOSED'
                          ? 'border-[#2A4E46] text-[#2A4E46] bg-emerald-50/50'
                          : 'border-[#A23E32] text-[#A23E32] bg-rose-50/50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>{lot.lot_no} · {lot.status === 'CLOSED' ? 'ปิดแล้ว' : 'รอผล DRC'}</span>
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-[#425842]">ยังไม่มีรายการ Lot ในระบบ</p>
                )}
              </div>
            </div>

            {/* Recent Unassigned Purchases */}
            <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#21301F]">รายการซื้อล่าสุด (ยังไม่จัดกลุ่มเข้า Lot)</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('records')}
                  className="text-xs font-bold text-[#3C6E63] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>ดูทั้งหมด & จัดกลุ่ม Lot</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {dashSummary.recentPurchases?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b-2 border-[#21301F]/20 text-[#425842] font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-2 px-2">วันที่</th>
                        <th className="py-2 px-2">สาขา</th>
                        <th className="py-2 px-2">ชาวสวน</th>
                        <th className="py-2 px-2">ประเภท</th>
                        <th className="py-2 px-2 text-right">น้ำหนัก</th>
                        <th className="py-2 px-2 text-right">รวมเงิน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#21301F]/10 font-medium">
                      {dashSummary.recentPurchases.map((p, i) => (
                        <tr key={i} className="hover:bg-white/40 transition">
                          <td className="py-2.5 px-2 font-mono">{p.date || p.purchase_date}</td>
                          <td className="py-2.5 px-2">{p.branch}</td>
                          <td className="py-2.5 px-2 font-semibold">{p.farmer || p.seller_name}</td>
                          <td className="py-2.5 px-2">
                            <span className="px-2 py-0.5 rounded-full bg-[#DED4B7] text-[#21301F] text-[10.5px] font-bold">
                              {p.product || p.product_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-right">{fmt(p.weight || p.weight_kg)} กก.</td>
                          <td className="py-2.5 px-2 font-mono text-right font-bold text-[#8C6239]">
                            {fmtMoney(p.total_amount || ((p.weight || 0) * (p.price || 0)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-[#425842]">
                  ไม่มีรายการค้าง — บันทึกบิลซื้อใหม่ได้ที่แท็บ "บันทึกซื้อ"
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 02: BUY TICKET (FAST ENTRY FORM)                     */}
        {/* ========================================================= */}
        {activeTab === 'buy' && (
          <div className="space-y-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#8C6239] font-bold">
                หน้าที่ 2 — คีย์ข้อมูลจากใบชั่งกระดาษ
              </p>
              <h1 className="text-2xl font-serif font-bold text-[#21301F] mt-1">
                บันทึกซื้อยางพาราหน้าลาน
              </h1>
              <p className="text-xs text-[#425842] mt-0.5">
                กรอกทีละใบชั่ง กด "บันทึก + กรอกใบถัดไป" เพื่อบันทึกอย่างต่อเนื่องและรวดเร็ว
              </p>
            </div>

            {/* Classical Ticket Card */}
            <div className="bg-[#E7E0CB] border border-[#21301F]/30 rounded-t-sm rounded-b-2xl shadow-md overflow-hidden">
              <div className="bg-[#8C6239] text-white px-6 py-3.5 flex items-center justify-between border-b border-[#6B4A29]">
                <div className="font-serif font-bold text-sm flex items-center gap-2">
                  <span>🧾</span>
                  <span>ใบชั่งซื้อสินค้า (ยางพารา)</span>
                </div>
                <div className="font-mono text-xs text-white/90 font-bold tracking-wider">
                  เลขที่: อัตโนมัติ (PB-YYMMXXXX)
                </div>
              </div>

              {/* Perforation line simulation */}
              <div className="border-t-2 border-dashed border-[#DED4B7]"></div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#425842] mb-1">วันที่รับซื้อ</label>
                    <input
                      type="date"
                      value={fDate}
                      onChange={(e) => setFDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono text-[#21301F] focus:outline-none focus:ring-2 focus:ring-[#3C6E63]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#425842] mb-1">สาขา</label>
                    <select
                      value={fBranch}
                      onChange={(e) => setFBranch(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-medium text-[#21301F] focus:outline-none focus:ring-2 focus:ring-[#3C6E63]"
                    >
                      <option>สาขาแม่สาย</option>
                      <option>สาขาฝาง</option>
                      <option>สาขาเชียงของ</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#425842] mb-1">ชาวสวน (ผู้ขาย)</label>
                    <input
                      ref={farmerInputRef}
                      type="text"
                      value={fFarmer}
                      onChange={(e) => setFFarmer(e.target.value)}
                      placeholder="ชื่อ-สกุล / รหัสสมาชิกชาวสวน"
                      className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-semibold text-[#21301F] focus:outline-none focus:ring-2 focus:ring-[#3C6E63]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#425842] mb-1">ประเภทสินค้า</label>
                    <select
                      value={fProduct}
                      onChange={(e) => setFProduct(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-bold text-[#21301F] focus:outline-none focus:ring-2 focus:ring-[#3C6E63]"
                    >
                      <option>น้ำยางสด</option>
                      <option>ยางก้อนถ้วย</option>
                      <option>เศษยาง</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#425842] mb-1">น้ำหนักชั่ง (กก.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fWeight}
                      onChange={(e) => setFWeight(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono font-bold text-[#21301F] focus:outline-none focus:ring-2 focus:ring-[#3C6E63]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#425842] mb-1">ราคา/กก. (บาท)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fPrice}
                      onChange={(e) => setFPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono font-bold text-[#21301F] focus:outline-none focus:ring-2 focus:ring-[#3C6E63]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#425842] mb-1">%DRC (ถ้ามี)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={fDrc}
                      onChange={(e) => setFDrc(e.target.value)}
                      placeholder="เว้นว่างถ้าไม่มี DRC"
                      className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono text-[#21301F] focus:outline-none focus:ring-2 focus:ring-[#3C6E63]"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-[#425842] mb-1">เลขที่ใบชั่งกระดาษ (อ้างอิงเดิม)</label>
                    <input
                      type="text"
                      value={fPaperRef}
                      onChange={(e) => setFPaperRef(e.target.value)}
                      placeholder="เช่น ใบชั่งลานที่ 0148/69"
                      className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono text-[#21301F] focus:outline-none focus:ring-2 focus:ring-[#3C6E63]"
                    />
                  </div>
                </div>

                {/* Total Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#21301F]/15">
                  <button
                    type="button"
                    onClick={clearBuyForm}
                    className="px-4 py-2 border border-[#21301F]/30 hover:bg-white/60 text-[#21301F] rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    ล้างฟอร์ม
                  </button>

                  <div className="text-right">
                    <div className="text-[11px] text-[#425842]">รวมเงินสุทธิรายการนี้</div>
                    <div className="font-mono text-2xl font-bold text-[#8C6239]">
                      {fmtMoney(buyTotal)}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveBuyEntry(false)}
                    className="w-full py-3 bg-[#8C6239] hover:bg-[#6B4A29] text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✓ บันทึก + กรอกใบถัดไป (คีย์ด่วน)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveBuyEntry(true)}
                    className="w-full py-3 bg-white border border-[#21301F]/30 hover:bg-[#F1ECDE] text-[#21301F] rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>บันทึกแล้วกลับหน้าภาพรวม</span>
                  </button>
                </div>

                {/* Today's Entries Strip */}
                <div className="pt-5 border-t border-[#21301F]/15 space-y-2.5">
                  <h4 className="text-xs font-bold text-[#425842] uppercase tracking-wider">
                    บันทึกแล้วในรอบนี้ ({todaysEntries.length} รายการ)
                  </h4>

                  {todaysEntries.length > 0 ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {todaysEntries.map((e, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/70 border border-[#21301F]/10">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] text-[#425842]">{e.time || '14:20'}</span>
                            <span className="font-bold text-[#21301F]">{e.farmer || e.seller_name}</span>
                            <span className="text-[11px] text-[#425842]">{e.branch}</span>
                            <span className="px-1.5 py-0.5 rounded bg-[#DED4B7] text-[10px] font-semibold">{e.product || e.product_type}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-[#21301F]">{fmt(e.weight || e.weight_kg)} กก.</span>
                            <span className="font-mono font-bold text-[#8C6239]">{fmtMoney(e.total_amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#425842]/70 italic">ยังไม่มีรายการที่บันทึกในรอบปัจจุบัน</p>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 03: RECORDS / LOT GROUPING                           */}
        {/* ========================================================= */}
        {activeTab === 'records' && (
          <div className="space-y-6 pb-20">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#8C6239] font-bold">
                หน้าที่ 3 — เลือกรายการมาผสมเป็น Lot
              </p>
              <h1 className="text-2xl font-serif font-bold text-[#21301F] mt-1">
                รายการชั่งซื้อทั้งหมด (รอจัดกลุ่ม)
              </h1>
              <p className="text-xs text-[#425842] mt-0.5">
                ติ๊กเลือกรายการจากหลายวัน หลายสาขา เพื่อนำมารวมเป็น Lot สินค้าใหม่สำหรับส่งโรงงาน
              </p>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-2.5 items-center bg-[#E7E0CB] p-3 rounded-xl border border-[#21301F]/20 shadow-2xs">
              <select
                value={filtBranch}
                onChange={(e) => setFiltBranch(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#21301F]/20 rounded-lg text-xs font-semibold"
              >
                <option value="">ทุกสาขา</option>
                <option>สาขาแม่สาย</option>
                <option>สาขาฝาง</option>
                <option>สาขาเชียงของ</option>
              </select>

              <select
                value={filtProduct}
                onChange={(e) => setFiltProduct(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#21301F]/20 rounded-lg text-xs font-semibold"
              >
                <option value="">ทุกประเภทสินค้า</option>
                <option>น้ำยางสด</option>
                <option>ยางก้อนถ้วย</option>
                <option>เศษยาง</option>
              </select>

              <input
                type="date"
                value={filtFrom}
                onChange={(e) => setFiltFrom(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono"
              />
              <span className="text-xs text-[#425842]">ถึง</span>
              <input
                type="date"
                value={filtTo}
                onChange={(e) => setFiltTo(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono"
              />

              <button
                type="button"
                onClick={() => { setFiltBranch(''); setFiltProduct(''); setFiltFrom(''); setFiltTo(''); }}
                className="px-3 py-1.5 border border-[#21301F]/30 hover:bg-white text-xs font-bold rounded-lg transition ml-auto cursor-pointer"
              >
                ล้างตัวกรอง
              </button>
            </div>

            {/* Mismatch Warning Alert */}
            {isProductMismatch && (
              <div className="p-3.5 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2.5 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  ⚠️ กฎเหล็กความปลอดภัย: 1 Lot ต้องบรรจุยางชนิดเดียวกัน 100% คุณเลือกปะปนกัน {distinctProductTypes.length} ชนิด ({distinctProductTypes.join(', ')}) กรุณาเลือกเฉพาะยางชนิดเดียวกัน
                </span>
              </div>
            )}

            {/* Records Table */}
            <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b-2 border-[#21301F]/20 text-[#425842] font-bold uppercase tracking-wider text-[11px] bg-black/5">
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={unassignedList.length > 0 && selectedIds.size === unassignedList.length}
                        onChange={handleSelectAll}
                        className="rounded accent-[#3C6E63] cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-2">วันที่</th>
                    <th className="py-3 px-2">สาขา</th>
                    <th className="py-3 px-2">ชาวสวน</th>
                    <th className="py-3 px-2">ประเภท</th>
                    <th className="py-3 px-2 text-right">น้ำหนัก</th>
                    <th className="py-3 px-2 text-right">ราคา/กก.</th>
                    <th className="py-3 px-2 text-right">รวมเงิน</th>
                    <th className="py-3 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21301F]/10">
                  {unassignedList.length > 0 ? (
                    unassignedList.map((item, idx) => {
                      const id = item.id || item.ticket_no;
                      const isSelected = selectedIds.has(id);
                      return (
                        <tr
                          key={idx}
                          className={`transition ${isSelected ? 'bg-[#3C6E63]/10 font-semibold' : 'hover:bg-white/40'}`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(id)}
                              className="rounded accent-[#3C6E63] cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-2 font-mono">{item.date || item.purchase_date}</td>
                          <td className="py-2.5 px-2">{item.branch}</td>
                          <td className="py-2.5 px-2 font-bold">{item.farmer || item.seller_name}</td>
                          <td className="py-2.5 px-2">
                            <span className="px-2 py-0.5 rounded-full bg-[#DED4B7] text-[10px] font-bold">
                              {item.product || item.product_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-right">{fmt(item.weight || item.weight_kg)} กก.</td>
                          <td className="py-2.5 px-2 font-mono text-right">฿{fmt(item.price || item.unit_price)}</td>
                          <td className="py-2.5 px-2 font-mono text-right font-bold text-[#8C6239]">
                            {fmtMoney(item.total_amount || ((item.weight || 0) * (item.price || 0)))}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 border border-[#8C6239] text-[#8C6239] rounded-full">
                              ยังไม่จัด Lot
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-xs text-[#425842]">
                        ไม่มีรายการที่ตรงเงื่อนไขตัวกรอง
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Sticky Selection Summary Bar */}
            {selectedIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#21301F] text-[#F1ECDE] px-6 py-3.5 rounded-2xl shadow-2xl flex flex-wrap items-center gap-6 z-40 border border-[#F1ECDE]/20 animate-in fade-in slide-in-from-bottom-3 duration-200">
                <div className="text-xs">
                  เลือกแล้ว <span className="font-mono font-bold text-amber-400">{selectedIds.size}</span> รายการ
                </div>
                <div className="text-xs">
                  น้ำหนักรวม <span className="font-mono font-bold text-emerald-400">{fmt(selTotalWeight)}</span> กก.
                </div>
                <div className="text-xs">
                  ต้นทุนรวม <span className="font-mono font-bold text-amber-300">{fmtMoney(selTotalCost)}</span>
                </div>

                <button
                  type="button"
                  disabled={isProductMismatch}
                  onClick={handleGoToSell}
                  className={`ml-auto px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow ${
                    isProductMismatch
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-[#3C6E63] hover:bg-[#2A4E46] text-white'
                  }`}
                >
                  <span>สร้าง Lot ขาย จากรายการที่เลือก</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 04: SELL BUILDER                                     */}
        {/* ========================================================= */}
        {activeTab === 'sell' && (
          <div className="space-y-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#8C6239] font-bold">
                หน้าที่ 4 — รวม Lot และออกบิลขาย
              </p>
              <h1 className="text-2xl font-serif font-bold text-[#21301F] mt-1">
                สร้างบิลส่งขายโรงงาน
              </h1>
              <p className="text-xs text-[#425842] mt-0.5">
                ตรวจสอบรายการใบชั่งที่ผสมอยู่ในล็อตนี้ และคำนวณต้นทุนเฉลี่ยต่อ กก. ก่อนออกบิล
              </p>
            </div>

            {currentSellLines.length === 0 ? (
              <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-8 text-center text-xs text-[#425842] space-y-3">
                <p>ยังไม่ได้เลือกรายการซื้อเพื่อสร้าง Lot</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('records')}
                  className="px-4 py-2 bg-[#3C6E63] text-white rounded-lg font-bold text-xs cursor-pointer shadow"
                >
                  ไปหน้า "รายการซื้อ" เพื่อเลือกบิล →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left: Selected Lines List */}
                <div className="lg:col-span-2 bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-[#21301F]/15 pb-2">
                    <h3 className="font-bold text-sm text-[#21301F]">
                      รายการที่ผสมอยู่ใน Lot นี้ ({currentSellLines.length} รายการ)
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#3C6E63] text-white text-[10.5px] font-bold">
                      {currentSellLines[0]?.product || currentSellLines[0]?.product_type}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {currentSellLines.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-white/70 rounded-lg border border-[#21301F]/10 text-xs">
                        <div>
                          <div className="font-bold text-[#21301F]">{p.farmer || p.seller_name}</div>
                          <div className="text-[11px] text-[#425842]">{p.date || p.purchase_date} · {p.branch}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-[#21301F]">{fmt(p.weight || p.weight_kg)} กก.</div>
                          <div className="font-mono text-[#8C6239] text-[11px]">
                            {fmtMoney(p.total_amount || ((p.weight || 0) * (p.price || 0)))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Cost Summary & Dispatch Form */}
                <div className="space-y-5">
                  <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-5 shadow-sm space-y-3">
                    <h3 className="font-bold text-sm text-[#21301F] border-b border-[#21301F]/15 pb-2">
                      สรุปต้นทุน Lot (Weighted Cost)
                    </h3>

                    <div className="flex justify-between text-xs py-1 border-b border-[#21301F]/10">
                      <span className="text-[#425842]">น้ำหนักซื้อรวม (ของเรา)</span>
                      <span className="font-mono font-bold text-[#21301F]">{fmt(sellTotalWeight)} กก.</span>
                    </div>

                    <div className="flex justify-between text-xs py-1 border-b border-[#21301F]/10">
                      <span className="text-[#425842]">ต้นทุนซื้อรวม</span>
                      <span className="font-mono font-bold text-[#8C6239]">{fmtMoney(sellTotalCost)}</span>
                    </div>

                    <div className="flex justify-between text-sm py-2 font-bold text-[#3C6E63] border-t-2 border-[#21301F]/20">
                      <span>ต้นทุนเฉลี่ยต่อ กก.</span>
                      <span className="font-mono">{fmtMoney(sellAvgCost)}/กก.</span>
                    </div>
                  </div>

                  <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-5 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-[#21301F] border-b border-[#21301F]/15 pb-2">
                      ข้อมูลบิลส่งขายโรงงาน
                    </h3>

                    <div>
                      <label className="block text-xs font-bold text-[#425842] mb-1">เลขที่บิลขาย</label>
                      <input
                        type="text"
                        value={sellBillNo}
                        onChange={(e) => setSellBillNo(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono font-bold text-[#21301F]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#425842] mb-1">โรงงานปลายทาง</label>
                      <select
                        value={sellFactory}
                        onChange={(e) => setSellFactory(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-semibold text-[#21301F]"
                      >
                        <option>โรงงาน ก. (แม่สาย)</option>
                        <option>โรงงาน ข. (เชียงราย)</option>
                        <option>โรงงาน ค. (ลำปาง)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#425842] mb-1">วันที่จัดส่ง</label>
                      <input
                        type="date"
                        value={sellShipDate}
                        onChange={(e) => setSellShipDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono text-[#21301F]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#425842] mb-1">น้ำหนักชั่งส่งออก (กก.)</label>
                      <input
                        type="number"
                        value={sellShipWeight}
                        onChange={(e) => setSellShipWeight(e.target.value)}
                        placeholder={sellTotalWeight}
                        className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono text-[#21301F]"
                      />
                      <span className="text-[10.5px] text-[#425842] mt-0.5 block">
                        * เว้นว่างหรือใช้ค่าน้ำหนักรวม หากรอชั่งหน้าโรงงาน
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmSell}
                      className="w-full py-3 bg-[#3C6E63] hover:bg-[#2A4E46] text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>✓ ยืนยันส่งออก → เข้าคิวรอผลโรงงาน</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 05: FACTORY DRC & P&L RECONCILIATION                */}
        {/* ========================================================= */}
        {activeTab === 'factory' && (
          <div className="space-y-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#8C6239] font-bold">
                หน้าที่ 5 — ปิด Lot และคำนวณกำไร-ขาดทุน
              </p>
              <h1 className="text-2xl font-serif font-bold text-[#21301F] mt-1">
                รอผลชั่งน้ำหนัก / ค่าแล็บ DRC จากโรงงาน
              </h1>
              <p className="text-xs text-[#425842] mt-0.5">
                เมื่อโรงงานแจ้งผลชั่งและใบแล็บ DRC กลับมา กรอกที่นี่เพื่อคำนวณเงินโอนจริงและปิด Lot
              </p>
            </div>

            {salesList.length === 0 ? (
              <div className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-8 text-center text-xs text-[#425842] space-y-3">
                <p>ยังไม่มี Lot ที่จัดส่งออก — สามารถสร้างบิลขายได้ที่แท็บ "สร้างบิลขาย"</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('sell')}
                  className="px-4 py-2 bg-[#3C6E63] text-white rounded-lg font-bold text-xs cursor-pointer shadow"
                >
                  ไปหน้า "สร้างบิลขาย" →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {salesList.map((lot, idx) => {
                  const isClosed = lot.status === 'closed' || lot.status === 'CLOSED';
                  const isFormOpen = openForms.has(idx);
                  const netProfit = lot.net_profit !== undefined && lot.net_profit !== null
                    ? lot.net_profit
                    : (lot.revenue || 0) - (lot.cost || lot.lot_total_cost || 0);

                  return (
                    <div
                      key={idx}
                      className="bg-[#E7E0CB] border border-[#21301F]/20 rounded-xl p-5 shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-sm text-[#21301F] flex items-center gap-2">
                            <span>{lot.sale_no || lot.billNo}</span>
                            <span className="text-xs font-normal text-[#425842]">·</span>
                            <span>{lot.destination_factory || lot.factory || lot.factory_name}</span>
                          </div>
                          <div className="text-xs text-[#425842] mt-0.5">
                            ส่งวันที่ {lot.shipping_date || lot.shipDate} · น้ำหนักส่ง {fmt(lot.outbound_weight_kg || lot.weight)} กก. · ต้นทุน {fmtMoney(lot.lot_total_cost || lot.cost)}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 border-2 rounded-full font-mono text-[11px] font-bold tracking-wider uppercase -rotate-1 shadow-2xs ${
                              isClosed
                                ? 'border-[#2A4E46] text-[#2A4E46] bg-emerald-50/50'
                                : 'border-[#A23E32] text-[#A23E32] bg-rose-50/50'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{isClosed ? 'ปิด Lot แล้ว' : 'รอผลโรงงาน'}</span>
                          </span>

                          {!isClosed && (
                            <button
                              type="button"
                              onClick={() => toggleFactoryForm(idx)}
                              className="px-3 py-1.5 bg-white border border-[#21301F]/30 hover:bg-[#F1ECDE] rounded-lg text-xs font-bold text-[#21301F] cursor-pointer shadow-2xs transition"
                            >
                              {isFormOpen ? 'ซ่อนแบบฟอร์ม' : 'กรอกผลจากโรงงาน'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Pending: Factory Settlement Input Form */}
                      {!isClosed && isFormOpen && (
                        <div className="pt-4 border-t border-dashed border-[#21301F]/20 space-y-4 bg-white/40 p-4 rounded-xl">
                          <h4 className="text-xs font-bold text-[#21301F] uppercase tracking-wider">
                            บันทึกผลชั่งจริง & แล็บ DRC จากโรงงาน
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-[#425842] mb-1">
                                น้ำหนักจริงจากโรงงาน (กก.)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={lot.outbound_weight_kg || lot.weight}
                                value={factoryInputs[idx]?.actualWeight || ''}
                                onChange={(e) => handleFactoryInputChange(idx, 'actualWeight', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-[#425842] mb-1">
                                %DRC ผลแล็บโรงงาน
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="เช่น 34.5"
                                value={factoryInputs[idx]?.drc || ''}
                                onChange={(e) => handleFactoryInputChange(idx, 'drc', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-[#425842] mb-1">
                                ราคาขาย/กก. (บาท)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={factoryInputs[idx]?.sellPrice || ''}
                                onChange={(e) => handleFactoryInputChange(idx, 'sellPrice', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-[#425842] mb-1">
                                หักค่าขนส่ง/ค่าปรับ (บาท)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={factoryInputs[idx]?.penalty || ''}
                                onChange={(e) => handleFactoryInputChange(idx, 'penalty', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#21301F]/20 rounded-lg text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => handleSettleSale(lot, idx)}
                              className="px-5 py-2.5 bg-[#3C6E63] hover:bg-[#2A4E46] text-white rounded-xl text-xs font-bold shadow transition cursor-pointer flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>✓ บันทึกผล & ปิด Lot คำนวณกำไร-ขาดทุน</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Closed: Settlement Summary Details */}
                      {isClosed && (
                        <div className="bg-white/80 border border-[#21301F]/15 rounded-xl p-4 space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-[#21301F]/10">
                            <span className="text-[#425842]">น้ำหนักจริงโรงงาน & ค่าแล็บ</span>
                            <span className="font-mono font-bold text-[#21301F]">
                              {fmt(lot.actual_weight_kg || lot.actualWeight)} กก. (DRC {lot.factory_drc_percent || lot.drc}%)
                            </span>
                          </div>

                          <div className="flex justify-between py-1 border-b border-[#21301F]/10">
                            <span className="text-[#425842]">ราคาขายต่อ กก.</span>
                            <span className="font-mono text-[#21301F]">฿{fmt(lot.selling_price_per_kg || lot.sellPrice)}</span>
                          </div>

                          <div className="flex justify-between py-1 border-b border-[#21301F]/10">
                            <span className="text-[#425842]">รายรับสุทธิหลังหักค่าใช้จ่าย</span>
                            <span className="font-mono font-bold text-[#8C6239]">{fmtMoney(lot.net_revenue || lot.revenue)}</span>
                          </div>

                          <div className="flex justify-between py-2 border-t-2 border-[#21301F]/20 text-sm font-bold">
                            <span>ผลกำไร-ขาดทุนสุทธิ</span>
                            <span className={`font-mono ${netProfit >= 0 ? 'text-[#2A4E46]' : 'text-[#A23E32]'}`}>
                              {netProfit >= 0 ? '+' : ''}{fmtMoney(netProfit)}
                            </span>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
