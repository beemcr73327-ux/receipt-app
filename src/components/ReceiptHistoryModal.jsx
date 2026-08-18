import React, { useState } from 'react';
import { Search, Printer, Ban, CheckCircle2, AlertCircle, ChevronRight, History, Plus, Eye } from 'lucide-react';
import { storageService } from '../services/storageService';
import { formatThaiDateTime, normalizeThaiDate } from '../utils/dateUtils';

export default function ReceiptHistoryModal({ onCreateNewReceipt, onViewReceiptDetails, onSelectReceipt, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [cancelModalReceipt, setCancelModalReceipt] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');

  const cleanStr = (val) => String(val || '').replace(/^'/, '').trim();
  const rawReceipts = storageService.getReceipts();
  const receipts = rawReceipts.map(r => ({
    ...r,
    receiptNo: cleanStr(r.receiptNo),
    dateThai: normalizeThaiDate(r.dateThai),
    buyerName: cleanStr(r.buyerName),
    buyerAddress: cleanStr(r.buyerAddress),
    buyerTaxId: cleanStr(r.buyerTaxId),
    taxId: cleanStr(r.taxId),
    paymentMethod: cleanStr(r.paymentMethod),
    paymentDateThai: normalizeThaiDate(r.paymentDateThai),
    cashierName: cleanStr(r.cashierName),
    items: r.items ? r.items.map(it => ({
      ...it,
      title: cleanStr(it.title),
      period: cleanStr(it.period)
    })) : []
  }));

  const filteredReceipts = receipts.filter(r => {
    const q = searchTerm.toLowerCase();
    const itemStr = r.items ? r.items.map(i => i.title).join(' ') : (r.itemTitle || '');
    return (
      (r.receiptNo && r.receiptNo.toLowerCase().includes(q)) ||
      (r.buyerName && r.buyerName.toLowerCase().includes(q)) ||
      (itemStr && itemStr.toLowerCase().includes(q)) ||
      (r.cashierName && r.cashierName.toLowerCase().includes(q))
    );
  });

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      setError('กรุณาระบุสาเหตุที่ยกเลิกใบเสร็จ');
      return;
    }

    await storageService.cancelReceipt(cancelModalReceipt.receiptNo, cancelReason.trim());
    setCancelModalReceipt(null);
    setCancelReason('');
    setError('');
    if (onRefresh) onRefresh();
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F6FA] text-slate-800 no-print overflow-hidden">
      
      {/* Workspace Header & Action Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
            <span>บัญชีการเงิน</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>รับชำระ</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-blue-600 font-semibold">ใบเสร็จ</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-bold">ประวัติทั้งหมด</span>
          </div>

          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 leading-tight">ประวัติใบเสร็จรับเงินทั้งหมด</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold border border-blue-200">
              {receipts.length} รายการ
            </span>
          </div>
        </div>

        {/* Right: Create Receipt Button */}
        <div>
          <button
            type="button"
            onClick={onCreateNewReceipt}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition flex items-center gap-2 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างใบเสร็จ</span>
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
                placeholder="ค้นหาตามเลขที่ใบเสร็จ, ชื่อผู้ซื้อ, รายการสินค้า หรือผู้รับเงิน..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0 custom-scrollbar">
            {filteredReceipts.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                ไม่พบบันทึกประวัติใบเสร็จ
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase bg-slate-50">
                      <th className="py-3 px-3">วันที่</th>
                      <th className="py-3 px-3">เลขที่ใบเสร็จ</th>
                      <th className="py-3 px-3">นามผู้ซื้อ</th>
                      <th className="py-3 px-3">รายการสินค้า</th>
                      <th className="py-3 px-3 text-right">จำนวนเงิน</th>
                      <th className="py-3 px-3">ผู้รับเงิน</th>
                      <th className="py-3 px-3 text-center">สถานะ</th>
                      <th className="py-3 px-3 text-center">Time Stamp</th>
                      <th className="py-3 px-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReceipts.map((r, idx) => {
                      const isCancelled = r.status === 'ยกเลิก';
                      const firstItem = r.items && r.items[0];
                      const rawTitle = firstItem ? (firstItem.title || firstItem.itemTitle || '') : '';
                      const cleanTitle = rawTitle.includes('(') ? rawTitle.split('(')[0].trim() : rawTitle;
                      const firstItemTitle = cleanTitle ? (r.items.length > 1 ? `${cleanTitle} (และอีก ${r.items.length - 1} รายการ)` : cleanTitle) : '-';

                      const computedTotal = (r.items && r.items.length > 0)
                        ? r.items.reduce((sum, item) => {
                            const q = Number(item.quantity || 0);
                            const p = Number(item.unitPrice || 0);
                            let drcFactor = 1;
                            if (item.drc && item.drc !== '-') {
                              const cleanDrc = parseFloat(item.drc.toString().replace('%', ''));
                              if (!isNaN(cleanDrc)) drcFactor = cleanDrc / 100;
                            }
                            const subtotal = item.subtotal || (q * p * drcFactor);
                            const disc = Number(item.discountAmount || 0);
                            const amt = (item.amount !== undefined && item.amount !== null && Number(item.amount) > 0)
                              ? Number(item.amount)
                              : Math.max(0, subtotal - disc);
                            return sum + amt;
                          }, 0)
                        : Number(r.totalAmount || 0);

                      return (
                        <tr key={idx} className={`hover:bg-slate-50 transition ${isCancelled ? 'opacity-60 bg-slate-100/80 grayscale-[0.5]' : ''}`}>
                          <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">{r.dateThai}</td>
                          <td className="py-3 px-3 font-bold text-blue-700 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => !isCancelled && onViewReceiptDetails && onViewReceiptDetails(r)}
                              disabled={isCancelled}
                              className={`text-left font-bold ${isCancelled ? 'text-slate-400 cursor-not-allowed' : 'hover:underline cursor-pointer text-blue-700'}`}
                              title={isCancelled ? "ใบเสร็จถูกยกเลิกแล้ว" : "คลิกเพื่อดูรายละเอียดใบเสร็จ"}
                            >
                              {r.receiptNo}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-slate-800 font-medium">{r.buyerName}</td>
                          <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{firstItemTitle}</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                            {Number(computedTotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-xs">{r.cashierName}</td>
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
                          <td className="py-3 px-3 text-center whitespace-nowrap text-[11px] text-slate-500 font-medium">
                            {isCancelled
                              ? (r.cancelledAt ? formatThaiDateTime(r.cancelledAt) : r.updatedAt ? formatThaiDateTime(r.updatedAt) : '-')
                              : (r.updatedAt ? formatThaiDateTime(r.updatedAt) : r.printedTimestamp ? formatThaiDateTime(r.printedTimestamp) : '-')}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  onSelectReceipt(r);
                                }}
                                className={`p-1.5 rounded-lg transition border bg-slate-100 hover:bg-blue-50 text-blue-600 border-slate-200 cursor-pointer`}
                                title="พิมพ์ใบเสร็จ"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {!isCancelled && (
                                <button
                                  onClick={() => {
                                    const cUser = storageService.getCurrentUser();
                                    if (cUser && cUser.role !== 'Admin') {
                                      alert('คุณไม่มีสิทธิ์ยกเลิกใบเสร็จ กรุณาติดต่อ Admin');
                                    } else {
                                      setCancelModalReceipt(r);
                                    }
                                  }}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition border border-rose-200 cursor-pointer"
                                  title="กดยกเลิกใบเสร็จ"
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

      {/* Cancel Confirmation Sub-Modal */}
      {cancelModalReceipt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">ยืนยันการยกเลิกใบเสร็จ</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              คุณกำลังจะยกเลิกใบเสร็จเลขที่ <b className="text-blue-700">{cancelModalReceipt.receiptNo}</b>
            </p>

            {error && (
              <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ระบุสาเหตุที่ยกเลิก <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="เช่น กรอกจำนวนเงินผิดพลาด, ลูกค้ายกเลิกออเดอร์..."
                rows={3}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCancelModalReceipt(null)}
                className="w-1/2 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleConfirmCancel}
                className="w-1/2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
              >
                ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
