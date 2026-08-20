import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Plus,
  FilePlus,
  Trash2,
  Edit2,
  Copy,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  HelpCircle,
  Printer,
  Save,
  ChevronLeft
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import AddItemModal from './AddItemModal';
import { bahttext } from '../utils/bahttext';
import { formatThaiDate, formatThaiDateTime, getTodayISO, isoToThaiDate, formatPeriod } from '../utils/dateUtils';
import { storageService } from '../services/storageService';

const ReceiptForm = forwardRef(({ currentUser, viewReceiptData, refreshTrigger, onSaveSuccess, onPrintTrigger, onBackToHistory, onClearViewData, onReqNewForm }, ref) => {
  const prevViewReceiptDataRef = useRef(undefined);

  // Form State
  const [receiptNo, setReceiptNo] = useState('');
  const [dateIso, setDateIso] = useState(getTodayISO());
  const [dateThai, setDateThai] = useState(formatThaiDate());

  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerTaxId, setBuyerTaxId] = useState('');

  // Multi-item list
  const [items, setItems] = useState([]);

  // Payment Section
  const [paymentMethod, setPaymentMethod] = useState('เงินโอน');
  const [bankDetails, setBankDetails] = useState('');
  const [bankDetailsDisplay, setBankDetailsDisplay] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [paymentDateIso, setPaymentDateIso] = useState(getTodayISO());
  const [paymentDateThai, setPaymentDateThai] = useState(formatThaiDate());
  const [notes, setNotes] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Save & Print Status Lock (1 Save / 1 Receipt, Print only allowed after save)
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Status Feedback
  const [statusMessage, setStatusMessage] = useState(null);

  // Config Lists — re-read from localStorage whenever refreshTrigger changes
  const [suppliers, setSuppliers] = useState(() => storageService.getSuppliers());
  const [banks, setBanks] = useState(() => storageService.getBanks());
  const [payments, setPayments] = useState(() => storageService.getPayments());

  useEffect(() => {
    setSuppliers(storageService.getSuppliers());
    setBanks(storageService.getBanks());
    setPayments(storageService.getPayments());
  }, [refreshTrigger]);

  const isFormFilled = buyerName.trim() !== '' || items.length > 0 || notes.trim() !== '' || bankDetails.trim() !== '' || chequeNo.trim() !== '';
  const isDirty = !isSaved && !viewReceiptData && isFormFilled;

  // Reset form for new receipt
  const handleNewFormDirect = () => {
    if (onClearViewData) onClearViewData();
    const nextNo = storageService.generateReceiptNumber();
    setReceiptNo(nextNo);
    setDateIso(getTodayISO());
    setDateThai(formatThaiDate());

    setBuyerName('');
    setBuyerAddress('');
    setBuyerTaxId('');

    setItems([]);
    setPaymentMethod('เงินโอน');
    setBankDetails('');
    setBankDetailsDisplay('');
    setChequeNo('');
    setPaymentDateIso(getTodayISO());
    setPaymentDateThai(formatThaiDate());

    setNotes('');
    setIsSaved(false);
    setIsSaving(false);
    setStatusMessage(null);
  };

  const handleNewForm = () => {
    if (isDirty && onReqNewForm) {
      onReqNewForm();
    } else {
      handleNewFormDirect();
    }
  };

  const getBankDisplayLabel = (fullVal) => {
    if (!fullVal) return '';
    const cleanFull = String(fullVal).replace(/^'/, '').trim();
    const matched = banks.find(b => typeof b === 'object' && b !== null && (cleanFull === String(b.fullValue).replace(/^'/, '').trim() || cleanFull === String(b.formatted).replace(/^'/, '').trim()));
    if (matched) return String(matched.formatted).replace(/^'/, '').trim();
    return cleanFull;
  };

  useEffect(() => {
    if (prevViewReceiptDataRef.current !== viewReceiptData) {
      if (viewReceiptData) {
        const cleanStr = (val) => String(val || '').replace(/^'/, '').trim();
        
        setReceiptNo(cleanStr(viewReceiptData.receiptNo));
        setDateIso(viewReceiptData.dateIso || getTodayISO());
        setDateThai(cleanStr(viewReceiptData.dateThai) || formatThaiDate());
        setBuyerName(cleanStr(viewReceiptData.buyerName));
        setBuyerAddress(cleanStr(viewReceiptData.buyerAddress));
        setBuyerTaxId(cleanStr(viewReceiptData.buyerTaxId || viewReceiptData.taxId));
        const normalizedItems = (viewReceiptData.items || []).map(item => {
          let title = cleanStr(item.title || item.itemTitle);
          let details = cleanStr(item.details || item.itemDetails);
          if (!details && title.includes('(') && title.endsWith(')')) {
            const m = title.match(/^(.*?)\s*\((.*?)\)$/);
            if (m) {
              title = m[1].trim();
              details = m[2].trim();
            }
          }
          const q = Number(item.quantity || 0);
          const p = Number(item.unitPrice || 0);
          let drcFactor = 1;
          if (item.drc && item.drc !== '-') {
            const cleanDrc = parseFloat(item.drc.toString().replace('%', ''));
            if (!isNaN(cleanDrc)) drcFactor = cleanDrc / 100;
          }
          const subtotal = item.subtotal || (q * p * drcFactor);
          const discVal = Number(item.discountAmount || 0);
          const netAmt = item.amount !== undefined && item.amount !== null && Number(item.amount) > 0
            ? Number(item.amount)
            : Math.max(0, subtotal - discVal);

          return {
            ...item,
            title,
            details,
            subtotal,
            discountAmount: discVal,
            amount: netAmt
          };
        });

        setItems(normalizedItems);
        const rawPayMethod = cleanStr(viewReceiptData.paymentMethod) || 'เงินโอน';
        let normPayMethod = rawPayMethod;
        let rawBank = cleanStr(viewReceiptData.bankDetails);

        if (rawPayMethod !== 'เงินสด' && !rawPayMethod.startsWith('เช็ค') && rawPayMethod !== 'เช็ค') {
          normPayMethod = 'เงินโอน';
          if (!rawBank) {
            rawBank = rawPayMethod; // Fallback to paymentMethod for old records
          }
        }

        setPaymentMethod(normPayMethod);
        setBankDetails(rawBank);
        setBankDetailsDisplay(getBankDisplayLabel(rawBank));
        setChequeNo(cleanStr(viewReceiptData.chequeNo));
        setPaymentDateIso(viewReceiptData.paymentDateIso || getTodayISO());
        setPaymentDateThai(cleanStr(viewReceiptData.paymentDateThai) || formatThaiDate());
        setNotes(cleanStr(viewReceiptData.notes));
        setIsSaved(true);
        setIsSaving(false);
        setStatusMessage(null);
      } else {
        handleNewFormDirect();
      }
      prevViewReceiptDataRef.current = viewReceiptData;
    } else {
      if (viewReceiptData) {
        const rawBank = String(viewReceiptData.bankDetails || '').replace(/^'/, '').trim();
        setBankDetailsDisplay(getBankDisplayLabel(rawBank));
      }
    }
  }, [viewReceiptData, banks]);

  const handleDateIsoChange = (val) => {
    setDateIso(val);
    setDateThai(isoToThaiDate(val));
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      setReceiptNo(storageService.generateReceiptNumber(d));
    }
  };

  const handlePaymentDateIsoChange = (val) => {
    setPaymentDateIso(val);
    setPaymentDateThai(isoToThaiDate(val));
  };

  const handleSupplierNameChange = (val) => {
    const nameStr = typeof val === 'object' ? (val.name || '') : String(val || '');
    setBuyerName(nameStr);
    const match = suppliers.find(s => s.name === nameStr);
    if (match) {
      setBuyerAddress(match.address || '');
      setBuyerTaxId(match.taxId || match.taxNo || '');
    } else {
      setBuyerAddress('');
      setBuyerTaxId('');
    }
  };

  const handleSelectSupplier = (supplierOpt) => {
    if (typeof supplierOpt === 'object') {
      setBuyerName(supplierOpt.name || '');
      setBuyerAddress(supplierOpt.address || '');
      setBuyerTaxId(supplierOpt.taxId || supplierOpt.taxNo || '');
    } else {
      handleSupplierNameChange(supplierOpt);
    }
  };

  // Total amount
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Add / Edit item
  const handleSaveItemFromModal = (itemData) => {
    if (editingItem) {
      setItems(prev => prev.map(it => it.id === itemData.id ? itemData : it));
      setEditingItem(null);
    } else {
      setItems(prev => [...prev, itemData]);
    }
  };

  const handleDeleteItem = (id) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handleDuplicateItem = (itemToCopy) => {
    const newItem = {
      ...itemToCopy,
      id: Date.now() + Math.random()
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const buildPayload = () => {
    const cleanedItems = items.map(item => {
      let title = String(item.title || item.itemTitle || '').trim();
      if (title.includes(':')) {
        const parts = title.split(':');
        if (parts.length > 1 && parts[0].length <= 5) {
          title = parts.slice(1).join(':').trim();
        }
      }
      return {
        ...item,
        title,
        itemTitle: title
      };
    });

    const firstItem = cleanedItems[0] || {};
    const nowTimestamp = formatThaiDateTime();
    const bahtTextString = bahttext(totalAmount);

    return {
      receiptNo,
      dateIso,
      dateThai,
      buyerName,
      buyerAddress,
      buyerTaxId,
      taxId: buyerTaxId,
      items: cleanedItems,
      quantity: firstItem.quantity || '',
      itemTitle: firstItem.title || '',
      itemDetails: firstItem.details || '',
      unitPrice: firstItem.unitPrice || '',
      drc: firstItem.drc || '',
      totalAmount,
      bahtText: bahtTextString,
      paymentMethod,
      bankDetails: paymentMethod === 'เงินโอน' ? bankDetails : '',
      chequeNo: paymentMethod === 'เช็ค' ? chequeNo : '',
      paymentDateIso,
      paymentDateThai,
      notes,
      cashierName: currentUser?.fullName || (currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : '') || 'ผู้รับเงิน',
      status: 'ปกติ',
      printedTimestamp: nowTimestamp
    };
  };

  const handleSave = async () => {
    if (isSaved) return; // บันทึกได้เพียง 1 ครั้ง/1 ใบเสร็จ เท่านั้น
    if (!buyerName.trim()) {
      setStatusMessage({ type: 'error', text: 'กรุณาระบุนามผู้ซื้อ' });
      return;
    }
    if (items.length === 0) {
      setStatusMessage({ type: 'error', text: 'กรุณากด "+ เพิ่มรายการ" เพื่อระบุรายการสินค้าอย่างน้อย 1 รายการ' });
      return;
    }
    if (paymentMethod === 'เงินโอน' && !bankDetails.trim()) {
      setStatusMessage({ type: 'error', text: 'กรุณาระบุบัญชีที่โอนเข้า' });
      return;
    }
    if (paymentMethod === 'เช็ค' && !chequeNo.trim()) {
      setStatusMessage({ type: 'error', text: 'กรุณาระบุเลขที่เช็ค' });
      return;
    }

    try {
      setIsSaving(true);
      const payload = buildPayload();
      await storageService.saveReceipt(payload);

      if (buyerName && buyerAddress) {
        storageService.addSupplier({ name: buyerName, address: buyerAddress });
      }
      if (paymentMethod === 'เงินโอน' && bankDetails) {
        storageService.addBank(bankDetails);
      }

      setIsSaved(true);
      setStatusMessage({ type: 'success', text: `บันทึกใบเสร็จเลขที่ ${receiptNo} เรียบร้อยแล้ว!` });
      if (onSaveSuccess) onSaveSuccess(payload);
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    } finally {
      setIsSaving(false);
    }
  };

  const canPrintInForm = isSaved && !viewReceiptData;

  const handlePrint = () => {
    console.log('🖨️ [handlePrint] clicked. canPrintInForm:', canPrintInForm);
    if (!canPrintInForm) return;
    try {
      const nowTs = formatThaiDateTime();
      const payload = buildPayload();
      payload.printedTimestamp = nowTs;
      storageService.updateReceiptPrintTimestamp(receiptNo, nowTs);
      console.log('🖨️ [handlePrint] payload built successfully with realtime timestamp:', payload);
      onPrintTrigger(payload);
    } catch (e) {
      console.error('🖨️ [handlePrint] Error building payload or triggering print:', e);
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    handleNewForm,
    handleNewFormDirect,
    handleSave,
    handlePrint,
    getIsDirty: () => isDirty
  }));

  return (
    <div className="h-full flex flex-col bg-[#F5F6FA] text-slate-800 no-print overflow-hidden">
      
      {/* Workspace Header & Action Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        
        {/* Left: Breadcrumb & Title */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
            <span>บัญชีการเงิน</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>รับชำระ</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <button
              type="button"
              onClick={onBackToHistory}
              className="text-blue-600 hover:text-blue-700 hover:underline font-semibold cursor-pointer"
            >
              ใบเสร็จ
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-bold">
              {viewReceiptData ? 'รายละเอียดใบเสร็จ' : 'สร้างใบเสร็จ'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {viewReceiptData ? `รายละเอียดใบเสร็จ (${viewReceiptData.receiptNo})` : 'สร้างใบเสร็จรับเงิน'}
            </h2>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleNewForm}
            className="h-10 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-sm font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <FilePlus className="w-4 h-4 text-slate-500" />
            <span>สร้างใหม่</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!canPrintInForm}
            className={`h-10 px-4 text-sm font-semibold rounded-xl transition flex items-center gap-2 ${
              canPrintInForm
                ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer shadow-2xs'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed pointer-events-none opacity-60'
            }`}
          >
            <Printer className={`w-4 h-4 ${canPrintInForm ? 'text-slate-600' : 'text-slate-400'}`} />
            <span>พิมพ์</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaved || isSaving}
            className={`h-10 px-5 text-sm font-bold rounded-xl transition flex items-center gap-2 ${
              isSaved
                ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed pointer-events-none opacity-80'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/30 cursor-pointer'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'กำลังบันทึก...' : isSaved ? 'บันทึกแล้ว' : 'บันทึก'}</span>
          </button>
        </div>

      </div>

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div className="px-5 pt-3 shrink-0">
          <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
            statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <div className="flex items-center gap-2">
              {statusMessage.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">ปิด</button>
          </div>
        </div>
      )}

      {/* Main Dashboard Layout (2-Column Fit Screen) */}
      <div className="flex-1 p-4 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">

        {/* LEFT COLUMN: ข้อมูลใบเสร็จ & ตารางรายการสินค้า */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0 overflow-hidden">
          
          {/* SECTION 1: รายละเอียดใบเสร็จ (Compact) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs shrink-0">
            <h3 className="text-xs font-bold text-slate-900 pb-2 mb-2.5 border-b border-slate-100 flex items-center justify-between">
              <span>รายละเอียดใบเสร็จ</span>
            </h3>

            <div className="grid grid-cols-12 gap-3">
              
              {/* เลขที่ใบเสร็จ */}
              <div className="col-span-12 sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  เลขที่ใบเสร็จ
                </label>
                <input
                  type="text"
                  value={receiptNo}
                  disabled
                  readOnly
                  tabIndex={-1}
                  className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs font-medium cursor-not-allowed pointer-events-none select-none"
                />
              </div>

              {/* นามผู้ซื้อ */}
              <div className="col-span-12 sm:col-span-6">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  นามผู้ซื้อ <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={suppliers}
                  value={buyerName}
                  onChange={handleSupplierNameChange}
                  onSelectOption={handleSelectSupplier}
                  placeholder=""
                  disabled={isSaved}
                />
              </div>

              {/* วันที่เอกสาร (ล็อคดูได้อย่างเดียว วันปัจจุบันเท่านั้น) */}
              <div className="col-span-12 sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  วันที่เอกสาร
                </label>
                <input
                  type="text"
                  value={dateThai}
                  disabled
                  readOnly
                  tabIndex={-1}
                  className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs font-medium cursor-not-allowed pointer-events-none select-none"
                />
              </div>

              {/* ที่อยู่ (Read-only ล็อคตาม Config) */}
              <div className="col-span-12 sm:col-span-8">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ที่อยู่
                </label>
                <input
                  type="text"
                  value={buyerAddress}
                  disabled
                  readOnly
                  tabIndex={-1}
                  placeholder=""
                  className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs font-medium cursor-not-allowed pointer-events-none select-none"
                />
              </div>

              {/* เลขประจำตัวผู้เสียภาษี (Read-only ล็อคตาม Config) */}
              <div className="col-span-12 sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  เลขประจำตัวผู้เสียภาษี
                </label>
                <input
                  type="text"
                  value={buyerTaxId}
                  disabled
                  readOnly
                  tabIndex={-1}
                  placeholder=""
                  className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs font-medium cursor-not-allowed pointer-events-none select-none"
                />
              </div>

            </div>
          </div>

          {/* SECTION 2: รายการใช้จ่าย / รายการสินค้า (Flex Auto Fit Table) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  รายการรายรับ
                </h3>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">
                  {items.length} รายการ
                </span>
              </div>

              {/* ปุ่ม + เพิ่มรายการ */}
              <button
                type="button"
                disabled={isSaved}
                onClick={() => {
                  setEditingItem(null);
                  setIsModalOpen(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg shadow-2xs transition ${
                  isSaved
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มรายการ</span>
              </button>
            </div>

            {/* Table displaying items with flex-1 overflow scroll */}
            <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-lg custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10 shadow-2xs">
                  <tr className="text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-2 px-2.5 text-center w-10">ลำดับ</th>
                    <th className="py-2 px-2.5">รายรับ</th>
                    <th className="py-2 px-2.5">รายละเอียด</th>
                    <th className="py-2 px-2.5 text-center w-20">งวด</th>
                    <th className="py-2 px-2.5 text-right w-24">ราคา/หน่วย</th>
                    <th className="py-2 px-2.5 text-center w-16">จำนวน</th>
                    <th className="py-2 px-2.5 text-center w-16">DRC</th>
                    <th className="py-2 px-2.5 text-right w-20">เพิ่มลด</th>
                    <th className="py-2 px-2.5 text-right w-28">จำนวนเงิน</th>
                    <th className="py-2 px-2.5 text-center w-16">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length > 0 ? (
                    items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-2.5 text-center font-medium text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-2.5 font-semibold text-slate-900">
                          {String(item.title || '').replace(/^[A-Za-z0-9]+:\s*/, '')}
                        </td>
                        <td className="py-2 px-2.5 text-slate-600 max-w-[150px] truncate">
                          {item.details || '-'}
                          {item.discountDetails ? (
                            <span className="block text-[10px] italic text-amber-700">
                              *{item.discountDetails}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 px-2.5 text-center text-slate-600 font-medium">{formatPeriod(item.period) || '-'}</td>
                        <td className="py-2 px-2.5 text-right font-medium text-slate-800">
                          {Number(item.unitPrice || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2.5 text-center font-semibold text-slate-800">
                          {Number(item.quantity || 0).toLocaleString('th-TH')}
                        </td>
                        <td className="py-2 px-2.5 text-center font-medium text-slate-700">
                          {item.drc ? (item.drc.includes('%') ? item.drc : `${item.drc}%`) : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-medium text-amber-700">
                          {Number(item.discountAmount || 0) > 0
                            ? `-${Number(item.discountAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-blue-700">
                          {Number(item.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          {isSaved ? (
                            <span className="text-slate-300 text-[10px] font-medium">-</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(item)}
                                className="p-1 text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                                title="ทำสำเนา"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                title="แก้ไข"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="ลบ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="h-56 py-16 text-center align-middle text-slate-400 text-xs font-medium">
                        ยังไม่มีรายการสินค้า กดปุ่ม "+ เพิ่มรายการ" เพื่อเพิ่มรายการ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: ข้อมูลการชำระเงิน & สรุปยอดรวม */}
        <div className="w-full lg:w-[360px] xl:w-[400px] flex flex-col gap-3 shrink-0 overflow-y-auto min-h-0 custom-scrollbar">
          
          {/* SECTION 3: ข้อมูลการชำระเงิน */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 pb-2 border-b border-slate-100">
                ข้อมูลการชำระเงิน
              </h3>

              {/* ประเภทการชำระ */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ประเภทการชำระ
                </label>
                <select
                  value={paymentMethod}
                  disabled={isSaved}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPaymentMethod(val);
                    if (val === 'เงินสด') {
                      const today = getTodayISO();
                      setPaymentDateIso(today);
                      setPaymentDateThai(isoToThaiDate(today));
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  {payments.map((p, idx) => (
                    <option key={idx} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* โอนเข้าบัญชี / เลขที่เช็ค */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {paymentMethod === 'เช็ค' ? (
                    <>เลขที่เช็ค <span className="text-rose-500">*</span></>
                  ) : paymentMethod === 'เงินโอน' ? (
                    <>โอนเข้าบัญชี <span className="text-rose-500">*</span></>
                  ) : (
                    'โอนเข้าบัญชี'
                  )}
                </label>
                {paymentMethod === 'เงินโอน' ? (
                  <SearchableSelect
                    options={banks}
                    value={bankDetailsDisplay}
                    onChange={(val) => {
                      setBankDetailsDisplay(val);
                      setBankDetails(val);
                    }}
                    onSelectOption={(opt) => {
                      if (typeof opt === 'object' && opt !== null) {
                        setBankDetailsDisplay(String(opt.formatted || '').replace(/^'/, '').trim());
                        setBankDetails(String(opt.fullValue || '').replace(/^'/, '').trim());
                      } else {
                        const clean = String(opt || '').replace(/^'/, '').trim();
                        setBankDetailsDisplay(clean);
                        setBankDetails(clean);
                      }
                    }}
                    showAllOnFocus={true}
                    placeholder=""
                    disabled={isSaved}
                  />
                ) : paymentMethod === 'เช็ค' ? (
                  <input
                    type="text"
                    value={chequeNo}
                    disabled={isSaved}
                    onChange={(e) => setChequeNo(e.target.value)}
                    placeholder=""
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                ) : (
                  <input
                    type="text"
                    value="เงินสด"
                    disabled
                    readOnly
                    tabIndex={-1}
                    className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs font-medium cursor-not-allowed pointer-events-none select-none"
                  />
                )}
              </div>

              {/* วันที่โอน / วันที่ชำระ */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  วันที่โอน / วันที่ชำระ
                </label>
                {paymentMethod === 'เงินสด' ? (
                  <input
                    type="text"
                    value={dateThai}
                    disabled
                    readOnly
                    tabIndex={-1}
                    className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs font-medium cursor-not-allowed pointer-events-none select-none"
                  />
                ) : (
                  <input
                    type="date"
                    value={paymentDateIso}
                    max={getTodayISO()}
                    disabled={isSaved}
                    onChange={(e) => handlePaymentDateIsoChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                )}
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  หมายเหตุ
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  disabled={isSaved}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="หมายเหตุเพิ่มเติม..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* GRAND TOTAL HIGHLIGHT BOX (Premium Blue Card) */}
            <div className="sticky bottom-2 z-20 mt-4 p-4 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl text-white shadow-lg shadow-blue-500/30 text-center">
              <div className="text-xs font-medium uppercase tracking-wider mb-1 opacity-90">
                ยอดเงินรวมทั้งสิ้น
              </div>
              
              <div className="text-2xl xl:text-3xl font-extrabold tracking-tight">
                ฿ {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Add / Edit Item Modal Popup */}
      <AddItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddItem={handleSaveItemFromModal}
        initialData={editingItem}
      />

    </div>
  );
});

export default ReceiptForm;
