import React, { useState } from 'react';
import {
  Search,
  Printer,
  Ban,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  History,
  Plus,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { formatThaiDateTime, normalizeThaiDate } from '../utils/dateUtils';

// Helper to convert Thai Date "DD/MM/YYYY" (พ.ศ.) to Comparable ISO Date (YYYY-MM-DD)
const parseThaiDateToISO = (dateStr) => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    let year = parseInt(match[3], 10);
    if (year > 2400) year -= 543;
    return `${year}-${month}-${day}`;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
};

export default function VoucherHistoryModal({ onCreateNewVoucher, onViewVoucherDetails, onSelectVoucher, onRefresh }) {
  // Filter States
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, NORMAL, CANCELLED
  const [datePreset, setDatePreset] = useState('ALL'); // ALL, TODAY, THIS_MONTH, THIS_YEAR, CUSTOM
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [cancelModalVoucher, setCancelModalVoucher] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);

  const cleanStr = (val) => String(val || '').replace(/^'+/, '').trim();
  const rawVouchers = storageService.getVouchers();
  const vouchers = rawVouchers.map(v => ({
    ...v,
    voucherNo: cleanStr(v.voucherNo),
    docDateThai: normalizeThaiDate(v.docDateThai || v.dateThai),
    receiverName: cleanStr(v.receiverName),
    mainDescription: cleanStr(v.mainDescription),
    cashierName: cleanStr(v.cashierName),
    refNo: cleanStr(v.refNo),
    payDateThai: normalizeThaiDate(v.payDateThai),
    items: v.items ? v.items.map(it => ({
      ...it,
      description: cleanStr(it.description),
      itemDateThai: normalizeThaiDate(it.itemDateThai || it.itemDate)
    })) : []
  }));

  // Date Preset Handler
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayISO = `${year}-${month}-${day}`;

    if (preset === 'TODAY') {
      setStartDate(todayISO);
      setEndDate(todayISO);
    } else if (preset === 'THIS_MONTH') {
      const firstDay = `${year}-${month}-01`;
      const lastDayNum = new Date(year, today.getMonth() + 1, 0).getDate();
      const lastDay = `${year}-${month}-${String(lastDayNum).padStart(2, '0')}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'THIS_YEAR') {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
    setCurrentPage(1);
  };

  const handleSearchSubmit = () => {
    setActiveSearchTerm(searchInput.trim());
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setStatusFilter('ALL');
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setSearchInput('');
    setActiveSearchTerm('');
    setCurrentPage(1);
  };

  // Filtered List
  const filteredVouchers = vouchers.filter(v => {
    // 1. Status Filter
    if (statusFilter === 'NORMAL' && v.status === 'ยกเลิก') return false;
    if (statusFilter === 'CANCELLED' && v.status !== 'ยกเลิก') return false;

    // 2. Date Range Filter
    const itemISO = parseThaiDateToISO(v.docDateThai || v.dateThai);
    if (startDate && itemISO && itemISO < startDate) return false;
    if (endDate && itemISO && itemISO > endDate) return false;

    // 3. Keyword Search Filter
    if (activeSearchTerm) {
      const q = activeSearchTerm.toLowerCase();
      const itemStr = v.items ? v.items.map(i => i.description).join(' ') : (v.description || '');
      const match = (
        (v.voucherNo && v.voucherNo.toLowerCase().includes(q)) ||
        (v.receiverName && v.receiverName.toLowerCase().includes(q)) ||
        (v.mainDescription && v.mainDescription.toLowerCase().includes(q)) ||
        (itemStr && itemStr.toLowerCase().includes(q)) ||
        (v.cashierName && v.cashierName.toLowerCase().includes(q)) ||
        (v.refNo && v.refNo.toLowerCase().includes(q))
      );
      if (!match) return false;
    }

    return true;
  });

  // Pagination Calculations
  const totalPages = Math.ceil(filteredVouchers.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedVouchers = filteredVouchers.slice(startIndex, startIndex + pageSize);

  const isFiltered = statusFilter !== 'ALL' || datePreset !== 'ALL' || startDate || endDate || activeSearchTerm;

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      setError('กรุณาระบุสาเหตุที่ยกเลิกใบสำคัญจ่าย');
      return;
    }

    await storageService.cancelVoucher(cancelModalVoucher.voucherNo, cancelReason.trim());
    setCancelModalVoucher(null);
    setCancelReason('');
    setError('');
    if (onRefresh) onRefresh();
  };

  // Pagination range numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let start = Math.max(1, safeCurrentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F6FA] text-slate-800 no-print overflow-hidden">
      
      {/* 1. Workspace Header & Action Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500 font-medium mb-1.5">
            <span>บัญชีการเงิน</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>จ่ายชำระ</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-blue-600 font-semibold">ใบสำคัญจ่าย</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-bold">ประวัติทั้งหมด</span>
          </div>

          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 leading-tight">ประวัติใบสำคัญจ่ายทั้งหมด</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold border border-blue-200">
              {filteredVouchers.length} รายการ
            </span>
          </div>
        </div>

        {/* Right: Create Voucher Button */}
        <div>
          <button
            type="button"
            onClick={onCreateNewVoucher}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition flex items-center gap-2 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างใบสำคัญจ่าย</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Workspace */}
      <div className="flex-1 p-4 md:p-6 flex flex-col gap-4 overflow-hidden min-h-0">
        
        {/* Search, Filter & Table Card Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col flex-1 min-h-0 overflow-hidden">
          
          {/* Filter Bar (สไตล์ LivingOS) */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* Dropdown 1: สถานะ */}
              <div className="relative min-w-[130px]">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full h-10 pl-3.5 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="ALL">ทั้งหมด</option>
                  <option value="NORMAL">ปกติ</option>
                  <option value="CANCELLED">ยกเลิก</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Dropdown 2: ช่วงเวลา */}
              <div className="relative min-w-[140px]">
                <select
                  value={datePreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full h-10 pl-3.5 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="ALL">ช่วงวันที่</option>
                  <option value="TODAY">วันนี้</option>
                  <option value="THIS_MONTH">เดือนนี้</option>
                  <option value="THIS_YEAR">ปีนี้</option>
                  <option value="CUSTOM">กำหนดเอง</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Date Range Inputs */}
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setDatePreset('CUSTOM'); setCurrentPage(1); }}
                    className="h-10 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <span className="text-slate-400 text-xs font-medium">-</span>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setDatePreset('CUSTOM'); setCurrentPage(1); }}
                    className="h-10 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSubmit(); }}
                  placeholder="ค้นหาตามเลขที่ใบสำคัญจ่าย, ชื่อผู้รับเงิน, รายการ หรือผู้จัดทำ..."
                  className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                />
              </div>

              {/* Search Button */}
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="h-10 px-5 bg-[#2F6FED] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>ค้นหา</span>
              </button>

              {/* Reset Filter Button */}
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="ล้างตัวกรองทั้งหมด"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ล้างค่า</span>
                </button>
              )}

            </div>
          </div>

          {/* Table Content (ตัวหนังสือ 13-14px สบายตา) */}
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {filteredVouchers.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-5 h-5" />
                </div>
                <p className="font-semibold text-slate-700 text-sm">ไม่พบบันทึกประวัติใบสำคัญจ่าย</p>
                <p className="text-xs text-slate-400">
                  {isFiltered ? 'ลองปรับเปลี่ยนเงื่อนไขการค้นหา หรือกดปุ่มล้างค่าตัวกรอง' : 'ยังไม่มีข้อมูลใบสำคัญจ่ายในระบบ'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 shadow-2xs">
                    <tr>
                      <th className="py-3 px-4 bg-slate-50">วันที่เอกสาร</th>
                      <th className="py-3 px-4 bg-slate-50">เลขที่เอกสาร</th>
                      <th className="py-3 px-4 bg-slate-50">จ่ายให้ (Receiver)</th>
                      <th className="py-3 px-4 bg-slate-50">คำอธิบาย / รายการย่อย</th>
                      <th className="py-3 px-4 text-right bg-slate-50">ยอดรวม (บาท)</th>
                      <th className="py-3 px-4 bg-slate-50">การชำระเงิน</th>
                      <th className="py-3 px-4 bg-slate-50">ผู้จัดทำ</th>
                      <th className="py-3 px-4 text-center bg-slate-50">สถานะ</th>
                      <th className="py-3 px-4 text-center bg-slate-50">Time Stamp</th>
                      <th className="py-3 px-4 text-center w-28 bg-slate-50">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedVouchers.map((v) => {
                      const isCancelled = v.status === 'ยกเลิก';
                      const total = v.totalAmount || (v.items ? v.items.reduce((s, it) => s + Number(it.amount || 0), 0) : 0);
                      const itemCount = v.items ? v.items.length : 1;

                      return (
                        <tr
                          key={v.voucherNo}
                          className={`hover:bg-slate-50/80 transition h-[48px] ${isCancelled ? 'opacity-60 bg-slate-100/80 grayscale-[0.5]' : ''}`}
                        >
                          {/* วันที่เอกสาร */}
                          <td className="py-3 px-4 font-medium whitespace-nowrap text-slate-600">{v.docDateThai || v.dateThai || '-'}</td>

                          {/* เลขที่เอกสาร */}
                          <td className="py-3 px-4 font-bold whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => !isCancelled && onViewVoucherDetails && onViewVoucherDetails(v)}
                              disabled={isCancelled}
                              className={`text-left font-bold ${isCancelled ? 'text-slate-400 cursor-not-allowed' : 'text-[#2F6FED] hover:underline cursor-pointer'}`}
                              title={isCancelled ? "ใบสำคัญจ่ายถูกยกเลิกแล้ว" : "คลิกเพื่อดูรายละเอียดใบสำคัญจ่าย"}
                            >
                              {v.voucherNo}
                            </button>
                          </td>

                          {/* จ่ายให้ */}
                          <td className="py-3 px-4 font-semibold text-slate-900 max-w-[180px] truncate" title={v.receiverName}>
                            {v.receiverName || '-'}
                          </td>

                          {/* คำอธิบาย */}
                          <td className="py-3 px-4 max-w-[220px]">
                            <div className="font-medium text-slate-800 truncate" title={v.mainDescription}>
                              {v.mainDescription || (v.items && v.items[0]?.description) || '-'}
                            </div>
                            {itemCount > 1 && (
                              <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                                รวม {itemCount} รายการย่อย
                              </span>
                            )}
                          </td>

                          {/* ยอดรวม */}
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                            ฿{Number(total).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* การชำระเงิน */}
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[11px] font-semibold text-slate-700">
                              {v.paymentMethod || 'เงินโอน'}
                            </span>
                          </td>

                          {/* ผู้จัดทำ */}
                          <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                            {v.cashierName || '-'}
                          </td>

                          {/* สถานะ */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isCancelled ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200">
                                <Ban className="w-3 h-3" />
                                <span>ยกเลิก</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>ปกติ</span>
                              </span>
                            )}
                          </td>

                          {/* Time Stamp */}
                          <td className="py-3 px-4 text-center whitespace-nowrap text-[12px] text-slate-500 font-medium">
                            {v.printedTimestamp ? formatThaiDateTime(v.printedTimestamp) : '-'}
                          </td>

                          {/* ปุ่มจัดการ */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              {/* Print Button */}
                              <button
                                onClick={() => {
                                  const nowTs = formatThaiDateTime();
                                  storageService.updateVoucherPrintTimestamp(v.voucherNo, nowTs);
                                  setLocalRefresh(prev => prev + 1);
                                  if (onSelectVoucher) onSelectVoucher({ ...v, printedTimestamp: nowTs });
                                  if (onRefresh) onRefresh();
                                }}
                                className="p-1.5 text-slate-400 hover:text-[#2F6FED] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="พิมพ์ใบสำคัญจ่าย"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Cancel Button (Admin Only) */}
                              {!isCancelled && (
                                <button
                                  onClick={() => {
                                    const cUser = storageService.getCurrentUser();
                                    if (cUser && cUser.role !== 'Admin') {
                                      alert('คุณไม่มีสิทธิ์ยกเลิกใบสำคัญจ่าย กรุณาติดต่อ Admin');
                                    } else {
                                      setCancelModalVoucher(v);
                                      setCancelReason('');
                                      setError('');
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="กดยกเลิกใบสำคัญจ่าย"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. Pagination Footer (สไตล์ LivingOS) */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            {/* Left: Info */}
            <div className="font-medium text-slate-500">
              หน้า: <span className="font-bold text-slate-800">{safeCurrentPage}</span> / {totalPages} (ทั้งหมด {filteredVouchers.length} รายการ)
            </div>

            {/* Right: Page Navigation & Page Size Selector */}
            <div className="flex items-center gap-2">
              {/* First Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="หน้าแรก"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              {/* Prev Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safeCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1">
                {getPageNumbers().map(pageNum => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                      pageNum === safeCurrentPage
                        ? 'bg-[#2F6FED] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              {/* Next Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="หน้าถัดไป"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Last Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="หน้าสุดท้าย"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>

              {/* Page Size Selector */}
              <div className="relative ml-2">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 pl-2.5 pr-6 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value={10}>10 / หน้า</option>
                  <option value={20}>20 / หน้า</option>
                  <option value={50}>50 / หน้า</option>
                  <option value={100}>100 / หน้า</option>
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 4. Cancel Voucher Modal Confirmation */}
      {cancelModalVoucher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการยกเลิกใบสำคัญจ่าย</h3>
                <p className="text-xs text-slate-500 font-medium">เลขที่ {cancelModalVoucher.voucherNo}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              การยกเลิกจะไม่ลบรายการออกจากระบบ แต่จะปรับเปลี่ยนสถานะเป็น <strong className="text-rose-600 font-bold">"ยกเลิก"</strong> และส่งไปอัปเดตบน Google Sheet อัตโนมัติ
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ระบุสาเหตุการยกเลิก <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="เช่น ข้อมูลยอดเงินผิดพลาด, ยกเลิกการสั่งจ่าย..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none transition resize-none"
              />
              {error && <p className="text-[11px] text-rose-600 font-bold mt-1">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCancelModalVoucher(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-600/20 cursor-pointer"
              >
                ยืนยันยกเลิกเอกสาร
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
