import React, { useState } from 'react';
import { Search, Ban, CheckCircle2, AlertCircle, ChevronRight, History, Plus, Eye, DollarSign, Calendar, RefreshCw, Printer } from 'lucide-react';
import { storageService } from '../services/storageService';
import { formatThaiDateTime, normalizeThaiDate } from '../utils/dateUtils';

export default function VoucherHistoryModal({ onCreateNewVoucher, onViewVoucherDetails, onSelectVoucher, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [cancelModalVoucher, setCancelModalVoucher] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);

  const cleanStr = (val) => String(val || '').replace(/^'/, '').trim();
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

  const filteredVouchers = vouchers.filter(v => {
    const q = searchTerm.toLowerCase();
    const itemStr = v.items ? v.items.map(i => i.description).join(' ') : (v.description || '');
    return (
      (v.voucherNo && v.voucherNo.toLowerCase().includes(q)) ||
      (v.receiverName && v.receiverName.toLowerCase().includes(q)) ||
      (v.mainDescription && v.mainDescription.toLowerCase().includes(q)) ||
      (itemStr && itemStr.toLowerCase().includes(q)) ||
      (v.cashierName && v.cashierName.toLowerCase().includes(q)) ||
      (v.refNo && v.refNo.toLowerCase().includes(q))
    );
  });

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

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await storageService.fetchConfigFromGoogleSheets();
    setIsRefreshing(false);
    if (onRefresh) onRefresh();
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F6FA] text-slate-800 no-print overflow-hidden">
      
      {/* 1. Header Toolbar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
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
              {vouchers.length} รายการ
            </span>
          </div>
        </div>

        <div>
          <button
            onClick={onCreateNewVoucher}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition flex items-center gap-2 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างใบสำคัญจ่าย</span>
          </button>
        </div>
      </div>

      {/* Main Content Workspace */}
      <div className="flex-1 p-4 md:p-6 flex flex-col gap-4 overflow-hidden min-h-0">
        
        {/* Search & Table Card Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col flex-1 min-h-0 overflow-hidden">
          
          {/* Search Bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาตามเลขที่ใบสำคัญจ่าย, ชื่อผู้รับเงิน, รายการ หรือผู้จัดทำ..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0 custom-scrollbar">
            {filteredVouchers.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                ไม่พบบันทึกประวัติใบสำคัญจ่าย
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase bg-slate-50">
                      <th className="py-3 px-3">วันที่เอกสาร</th>
                      <th className="py-3 px-3">เลขที่เอกสาร</th>
                      <th className="py-3 px-3">จ่ายให้ (Receiver)</th>
                      <th className="py-3 px-3">คำอธิบาย / รายการย่อย</th>
                      <th className="py-3 px-3 text-right">ยอดรวม (บาท)</th>
                      <th className="py-3 px-3">การชำระเงิน</th>
                      <th className="py-3 px-3">ผู้จัดทำ</th>
                      <th className="py-3 px-3 text-center">สถานะ</th>
                      <th className="py-3 px-3 text-center">Time Stamp</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVouchers.map((v) => {
                      const isCancelled = v.status === 'ยกเลิก';
                      const total = v.totalAmount || (v.items ? v.items.reduce((s, it) => s + Number(it.amount || 0), 0) : 0);
                      const itemCount = v.items ? v.items.length : 1;

                      return (
                        <tr
                          key={v.voucherNo}
                          className={`hover:bg-slate-50 transition ${isCancelled ? 'opacity-60 bg-slate-100/80 grayscale-[0.5]' : ''}`}
                        >
                          {/* วันที่เอกสาร */}
                          <td className="py-3 px-3 font-medium whitespace-nowrap">{v.docDateThai || v.dateThai || '-'}</td>

                          {/* เลขที่เอกสาร */}
                          <td className="py-3 px-3 font-bold whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => !isCancelled && onViewVoucherDetails && onViewVoucherDetails(v)}
                              disabled={isCancelled}
                              className={`text-left font-bold ${isCancelled ? 'text-slate-400 cursor-not-allowed' : 'hover:underline cursor-pointer text-blue-700'}`}
                              title={isCancelled ? "ใบสำคัญจ่ายถูกยกเลิกแล้ว" : "คลิกเพื่อดูรายละเอียดใบสำคัญจ่าย"}
                            >
                              {v.voucherNo}
                            </button>
                          </td>

                          {/* จ่ายให้ */}
                          <td className="py-3 px-3 font-semibold text-slate-900 max-w-[180px] truncate" title={v.receiverName}>
                            {v.receiverName || '-'}
                          </td>

                          {/* คำอธิบาย */}
                          <td className="py-3 px-3 max-w-[220px]">
                            <div className="font-medium text-slate-800 truncate" title={v.mainDescription}>
                              {v.mainDescription || (v.items && v.items[0]?.description) || '-'}
                            </div>
                            {itemCount > 1 && (
                              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                                รวม {itemCount} รายการย่อย
                              </span>
                            )}
                          </td>

                          {/* ยอดรวม */}
                          <td className="py-3 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                            ฿{Number(total).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* การชำระเงิน */}
                          <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[11px] font-semibold">
                              {v.paymentMethod || 'เงินโอน'}
                            </span>
                          </td>

                          {/* ผู้จัดทำ */}
                          <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                            {v.cashierName || '-'}
                          </td>

                          {/* สถานะ */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
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
                          <td className="py-3 px-3 text-center whitespace-nowrap text-[11px] text-slate-500 font-medium">
                            {v.printedTimestamp ? formatThaiDateTime(v.printedTimestamp) : '-'}
                          </td>

                          {/* ปุ่มจัดการ */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  const nowTs = formatThaiDateTime();
                                  storageService.updateVoucherPrintTimestamp(v.voucherNo, nowTs);
                                  setLocalRefresh(prev => prev + 1);
                                  if (onSelectVoucher) onSelectVoucher({ ...v, printedTimestamp: nowTs });
                                  if (onRefresh) onRefresh();
                                }}
                                className="p-1.5 rounded-lg transition border bg-slate-100 hover:bg-blue-50 text-blue-600 border-slate-200 cursor-pointer"
                                title="พิมพ์ใบสำคัญจ่าย"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

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
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition border border-rose-200 cursor-pointer"
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
