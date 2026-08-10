import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Calculator, AlertCircle } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { storageService } from '../services/storageService';
import { getThaiYearMonthPrefix } from '../utils/dateUtils';

export default function AddItemModal({ isOpen, onClose, onAddItem, initialData = null }) {
  const tops = storageService.getTops();
  const { year2, month2 } = getThaiYearMonthPrefix();
  const currentPeriod = `${month2}/25${year2}`;

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [period, setPeriod] = useState(currentPeriod);
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [drc, setDrc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDetails(initialData.details || '');
      setPeriod(initialData.period || currentPeriod);
      setUnitPrice(initialData.unitPrice || '');
      setQuantity(initialData.quantity || '');
      setDrc(initialData.drc || '');
    } else {
      setTitle('');
      setDetails('');
      setPeriod(currentPeriod);
      setUnitPrice('');
      setQuantity('');
      setDrc('');
    }
    setError('');
  }, [isOpen, initialData]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Real-time calculation inside modal
  const calculateModalAmount = () => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(unitPrice) || 0;
    let drcFactor = 1;

    if (drc !== null && drc !== undefined && drc !== '') {
      const cleanDrc = parseFloat(drc.toString().replace('%', ''));
      if (!isNaN(cleanDrc)) {
        drcFactor = cleanDrc / 100;
      }
    }

    return q * p * drcFactor;
  };

  const lineAmount = calculateModalAmount();

  const handleConfirm = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('กรุณาเลือกหรือระบุรายรับ (ชนิดสินค้า)');
      return;
    }
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
      setError('กรุณากรอกจำนวนให้ถูกต้อง');
      return;
    }
    if (!unitPrice || isNaN(unitPrice) || Number(unitPrice) < 0) {
      setError('กรุณากรอกราคาต่อหน่วยให้ถูกต้อง');
      return;
    }

    const cleanTitle = title.replace(/^[A-Za-z0-9]+:\s*/, '').trim();

    onAddItem({
      id: initialData?.id || Date.now(),
      title: cleanTitle,
      details: details.trim(),
      period: period.trim(),
      unitPrice: parseFloat(unitPrice),
      quantity: parseFloat(quantity),
      drc: drc.trim(),
      amount: lineAmount
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2 text-slate-800">
            <Plus className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold">
              {initialData ? 'แก้ไขรายการสินค้า' : 'เพิ่มรายการสินค้า/บริการ'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. รายรับ (Dropdown เลือกชนิดสินค้า) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รายรับ (หมวดหมู่สินค้า) <span className="text-rose-500">*</span>
            </label>
            <SearchableSelect
              options={tops}
              value={title}
              onChange={(val) => setTitle(val)}
              placeholder=""
            />
          </div>

          {/* 2. รายละเอียด (พิมพ์ข้อความอิสระ) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รายละเอียดเพิ่มเติม
            </label>
            <input
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder=""
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 3. งวด (Dropdown แบบค้นหา/พิมพ์ได้) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              งวด
            </label>
            <SearchableSelect
              options={(() => {
                const opts = [];
                const now = new Date();
                for (let i = -12; i <= 6; i++) {
                  const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const thaiYear = d.getFullYear() + 543;
                  opts.push(`${month}/${thaiYear}`);
                }
                return opts.reverse();
              })()}
              value={period}
              onChange={(val) => setPeriod(val)}
              showAllOnFocus={true}
              placeholder=""
            />
          </div>

          {/* 4 & 5. ราคาต่อหน่วย & จำนวน */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ราคาต่อหน่วย <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder=""
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                จำนวน <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder=""
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* 6. DRC (%) Optional */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              DRC (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={drc}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setDrc(val);
              }}
              placeholder=""
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 7. จำนวนเงินรวมรายการที่บันทึก (Real-time Calculated Box) */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between mt-2">
            <span className="text-xs font-semibold text-blue-900">จำนวนเงินรวมรายการที่บันทึก</span>
            <span className="text-lg font-bold text-blue-700">
              ฿ {lineAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Action Buttons: [ปิด] & [ตกลง] */}
          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition cursor-pointer"
            >
              ปิด
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-500/25 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>ตกลง</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
