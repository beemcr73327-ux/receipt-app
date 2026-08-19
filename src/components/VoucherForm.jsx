import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Plus,
  FilePlus,
  Printer,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Save,
  ChevronLeft,
  FileText,
  DollarSign,
  CreditCard
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { bahttext } from '../utils/bahttext';
import { formatThaiDate, formatThaiDateTime, getTodayISO, isoToThaiDate } from '../utils/dateUtils';
import { storageService } from '../services/storageService';

const VoucherForm = forwardRef(({ currentUser, viewVoucherData, refreshTrigger, onSaveSuccess, onBackToHistory, onClearViewData, onReqNewForm, onPrintTrigger }, ref) => {
  // Document Header State (Col A to Col E)
  const [voucherNo, setVoucherNo] = useState('');
  const [docDateIso, setDocDateIso] = useState(getTodayISO());
  const [docDateThai, setDocDateThai] = useState(formatThaiDate());

  const [receiverName, setReceiverName] = useState('');
  const [mainDescription, setMainDescription] = useState('');
  const [refNo, setRefNo] = useState('');

  // Multi-item Sub-list (Col F to Col H)
  const [items, setItems] = useState([
    { id: 1, itemDateIso: getTodayISO(), itemDateThai: formatThaiDate(), description: '', amount: '' }
  ]);

  // Payment Section State (Col I to Col N)
  const [paymentMethod, setPaymentMethod] = useState('เงินโอน');
  const [sourceBankAcc, setSourceBankAcc] = useState('');
  const [sourceBankDisplay, setSourceBankDisplay] = useState('');
  const [chequeOrDestAcc, setChequeOrDestAcc] = useState('');
  
  // Separated fields for Transfer & Cheque
  const [destBankName, setDestBankName] = useState('');
  const [destAccountName, setDestAccountName] = useState('');
  const [chequeBankName, setChequeBankName] = useState('ธนาคารกรุงเทพ');
  const [chequeBranch, setChequeBranch] = useState('สาขาบ้านกรวด');

  const [paymentDateIso, setPaymentDateIso] = useState(getTodayISO());
  const [paymentDateThai, setPaymentDateThai] = useState(formatThaiDate());
  const [notes, setNotes] = useState('');

  // Save / UI States
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Config Lists from Storage
  const [receivers, setReceivers] = useState(() => storageService.getReceivers());
  const [sourceBanks, setSourceBanks] = useState(() => storageService.getSourceBanks());
  const [destBanks, setDestBanks] = useState(() => storageService.getDestBanks());
  const [payments, setPayments] = useState(() => storageService.getPayments());

  useEffect(() => {
    setReceivers(storageService.getReceivers());
    setSourceBanks(storageService.getSourceBanks());
    setDestBanks(storageService.getDestBanks());
    setPayments(storageService.getPayments());
  }, [refreshTrigger]);

  const getSourceBankDisplay = (fullAccStr) => {
    if (!fullAccStr) return '';
    const matched = sourceBanks.find(b => b.fullValue === fullAccStr);
    if (matched) return matched.formatted;
    
    // Fallback: extract last 4 digits (e.g. "BBL 4143010488" -> "BBL 0488")
    const parts = fullAccStr.trim().split(/\s+/);
    if (parts.length >= 2) {
      const abbr = parts[0];
      const acc = parts[1];
      if (abbr && acc && acc.length > 4) {
        return `${abbr} ${acc.slice(-4)}`;
      }
    }
    return fullAccStr;
  };

  // Handle Form Dirty Checking
  const isFormFilled = receiverName.trim() !== '' || items.some(it => it.description.trim() !== '' || Number(it.amount) > 0) || mainDescription.trim() !== '' || sourceBankAcc.trim() !== '' || chequeOrDestAcc.trim() !== '';
  const isDirty = !isSaved && !viewVoucherData && isFormFilled;

  useImperativeHandle(ref, () => ({
    getIsDirty: () => isDirty,
    handleNewFormDirect: () => handleNewFormDirect()
  }));

  // Reset form to brand new voucher (8-digit numeric)
  const handleNewFormDirect = () => {
    if (onClearViewData) onClearViewData();
    const nextNo = storageService.generateVoucherNumber(new Date());
    setVoucherNo(nextNo);
    setDocDateIso(getTodayISO());
    setDocDateThai(formatThaiDate());

    setReceiverName('');
    setMainDescription('');
    setRefNo('');

    setItems([
      { id: Date.now(), itemDateIso: getTodayISO(), itemDateThai: formatThaiDate(), description: '', amount: '' }
    ]);

    setPaymentMethod('เงินโอน');
    
    const defaultSource = sourceBanks[0];
    const defFull = defaultSource && typeof defaultSource === 'object' ? defaultSource.fullValue : 'BBL 4143010488';
    const defShort = defaultSource && typeof defaultSource === 'object' ? defaultSource.formatted : 'BBL 0488';
    setSourceBankAcc(defFull);
    setSourceBankDisplay(defShort);
    
    setChequeOrDestAcc('');
    setDestBankName('');
    setDestAccountName('');
    setChequeBankName('ธนาคารกรุงเทพ');
    setChequeBranch('สาขาบ้านกรวด');

    setPaymentDateIso(getTodayISO());
    setPaymentDateThai(formatThaiDate());
    setNotes('');

    setIsSaved(false);
    setIsSaving(false);
    setStatusMessage(null);
  };

  // Sync state when mounting or switching between View/Edit modes
  useEffect(() => {
    if (viewVoucherData) {
      const cleanStr = (val) => String(val || '').replace(/^'/, '').trim();
      
      setVoucherNo(cleanStr(viewVoucherData.voucherNo).replace(/^[^\d]+/, ''));
      setDocDateThai(cleanStr(viewVoucherData.docDateThai) || formatThaiDate());
      setReceiverName(cleanStr(viewVoucherData.receiverName));
      setMainDescription(cleanStr(viewVoucherData.mainDescription));
      setRefNo(cleanStr(viewVoucherData.refNo));

      if (viewVoucherData.items && viewVoucherData.items.length > 0) {
        setItems(viewVoucherData.items.map((it, idx) => ({
          id: it.id || idx + 1,
          itemDateThai: cleanStr(it.itemDateThai || it.itemDate || viewVoucherData.docDateThai),
          itemDateIso: getTodayISO(),
          description: cleanStr(it.description),
          amount: it.amount || 0
        })));
      }

      const method = cleanStr(viewVoucherData.paymentMethod) || 'เงินโอน';
      setPaymentMethod(method);
      const fullAcc = cleanStr(viewVoucherData.sourceBankAcc || viewVoucherData.bankDetails);
      setSourceBankAcc(fullAcc);
      setSourceBankDisplay(getSourceBankDisplay(fullAcc));
      
      setChequeOrDestAcc(cleanStr(viewVoucherData.chequeOrDestAcc || viewVoucherData.chequeOrAccNo));
      
      const rawDestBank = cleanStr(viewVoucherData.destBank || viewVoucherData.bankName);
      if (method === 'เช็ค') {
        if (rawDestBank.includes('สาขา')) {
          const parts = rawDestBank.split(/สาขา/);
          setChequeBankName(parts[0]?.trim() || 'ธนาคารกรุงเทพ');
          setChequeBranch(parts[1]?.trim() || '');
        } else {
          setChequeBankName(rawDestBank || 'ธนาคารกรุงเทพ');
          setChequeBranch('');
        }
      } else {
        // Try matching with destBanks
        const matched = destBanks.find(b => rawDestBank.includes(b.bankName) || rawDestBank.includes(b.accHolder));
        if (matched) {
          setDestBankName(matched.bankName || '');
          setDestAccountName(matched.accHolder || '');
        } else {
          setDestBankName(rawDestBank);
          setDestAccountName('');
        }
      }

      setPaymentDateThai(cleanStr(viewVoucherData.payDateThai) || formatThaiDate());
      setNotes(cleanStr(viewVoucherData.notes));

      setIsSaved(true);
    } else {
      handleNewFormDirect();
    }
  }, [viewVoucherData]);

  // Multi-item handlers
  const handleAddItemRow = () => {
    const newItemId = Date.now() + Math.random();
    setItems(prev => [
      ...prev,
      { id: newItemId, itemDateIso: docDateIso, itemDateThai: docDateThai, description: '', amount: '' }
    ]);
  };

  const handleDuplicateItemRow = (indexToDup) => {
    const itemToDup = items[indexToDup];
    if (!itemToDup) return;
    const newItemId = Date.now() + Math.random();
    const newItem = {
      id: newItemId,
      itemDateIso: itemToDup.itemDateIso || docDateIso,
      itemDateThai: itemToDup.itemDateThai || docDateThai,
      description: itemToDup.description,
      amount: itemToDup.amount
    };
    const newItems = [...items];
    newItems.splice(indexToDup + 1, 0, newItem);
    setItems(newItems);
  };

  const handleRemoveItemRow = (idToRemove) => {
    if (items.length <= 1) {
      setItems([{ id: Date.now(), itemDateIso: docDateIso, itemDateThai: docDateThai, description: '', amount: '' }]);
      return;
    }
    setItems(prev => prev.filter(it => it.id !== idToRemove));
  };

  const handleItemFieldChange = (id, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.id === id) {
        if (field === 'itemDateIso') {
          return { ...it, itemDateIso: value, itemDateThai: isoToThaiDate(value) };
        }
        return { ...it, [field]: value };
      }
      return it;
    }));
  };

  const handleAmountKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newItemId = Date.now() + Math.random();
      const newItem = {
        id: newItemId,
        itemDateIso: docDateIso,
        itemDateThai: docDateThai,
        description: '',
        amount: ''
      };
      const newItems = [...items];
      newItems.splice(index + 1, 0, newItem);
      setItems(newItems);

      setTimeout(() => {
        const nextDescInput = document.getElementById(`item-desc-${newItemId}`);
        if (nextDescInput) {
          nextDescInput.focus();
        }
      }, 50);
    }
  };

  // Calculations
  const totalAmount = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
  const bahtTextString = totalAmount > 0 ? bahttext(totalAmount) : '-';

  // Destination Account Select Handler (Auto-fills Bank Name & Account Name)
  const handleDestAccSelect = (val) => {
    setChequeOrDestAcc(val);
    const matched = destBanks.find(b => (b.accNo === val || b.formatted === val || String(b) === val));
    if (matched) {
      if (matched.bankName) setDestBankName(matched.bankName);
      if (matched.accHolder) setDestAccountName(matched.accHolder);
    }
  };

  const getCombinedDestBank = () => {
    if (paymentMethod === 'เงินสด') {
      return '';
    }
    if (paymentMethod === 'เช็ค') {
      const bName = chequeBankName.trim();
      const bBranch = chequeBranch.trim();
      if (bName && bBranch) {
        return bBranch.startsWith('สาขา') ? `${bName} ${bBranch}` : `${bName} สาขา${bBranch}`;
      }
      return bName || bBranch || '';
    }
    // เงินโอน
    return [destBankName.trim(), destAccountName.trim()].filter(Boolean).join(' ');
  };

  const buildPayload = () => {
    const validItems = items.filter(it => it.description.trim() !== '' && Number(it.amount) > 0);
    const nowTimestamp = formatThaiDateTime();
    const destBankCombined = getCombinedDestBank();

    return {
      voucherNo: voucherNo,
      docDate: docDateThai,
      docDateThai: docDateThai,
      docDateIso: docDateIso,
      receiverName: receiverName.trim(),
      mainDescription: mainDescription.trim(),
      refNo: refNo.trim(),
      items: validItems.length > 0 ? validItems.map(it => ({
        itemDate: it.itemDateThai || docDateThai,
        description: it.description.trim(),
        amount: Number(it.amount)
      })) : [{ itemDate: docDateThai, description: mainDescription || 'จ่ายชำระค่าสินค้า/บริการ', amount: totalAmount }],
      totalAmount: totalAmount,
      bahtText: bahtTextString,
      paymentMethod: paymentMethod,
      sourceBankAcc: paymentMethod === 'เงินสด' ? '' : sourceBankAcc.trim(),
      chequeOrDestAcc: paymentMethod === 'เงินสด' ? '' : chequeOrDestAcc.trim(),
      destBank: destBankCombined,
      payDate: paymentDateThai,
      payDateThai: paymentDateThai,
      payDateIso: paymentDateIso,
      notes: notes.trim(),
      cashierName: currentUser?.fullName || 'ผู้จัดทำ',
      status: viewVoucherData?.status || 'ปกติ',
      printedTimestamp: viewVoucherData?.printedTimestamp || nowTimestamp
    };
  };

  const isReadOnly = Boolean(viewVoucherData);
  const canPrintInForm = isSaved || isReadOnly;

  const handlePrint = () => {
    if (!canPrintInForm) return;
    const payload = buildPayload();
    if (onPrintTrigger) {
      onPrintTrigger(payload);
    }
  };

  const handleNewForm = () => {
    if (isDirty && onReqNewForm) {
      onReqNewForm();
    } else {
      handleNewFormDirect();
    }
  };

  // Save Voucher Action (18 Columns Mapping)
  const handleSave = async () => {
    if (isSaved) return;
    if (!receiverName.trim()) {
      setStatusMessage({ type: 'error', text: 'กรุณาระบุชื่อผู้รับเงิน (จ่ายให้)' });
      return;
    }

    const validItems = items.filter(it => it.description.trim() !== '' && Number(it.amount) > 0);
    if (validItems.length === 0) {
      setStatusMessage({ type: 'error', text: 'กรุณากรอกรายการย่อยและจำนวนเงินอย่างน้อย 1 รายการ' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const payload = buildPayload();

    try {
      const savedResult = await storageService.saveVoucher(payload);
      setIsSaved(true);
      setStatusMessage({ type: 'success', text: `บันทึกใบสำคัญจ่ายเลขที่ ${voucherNo} สำเร็จ!` });
      if (onSaveSuccess) onSaveSuccess(savedResult);
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F6FA] overflow-y-auto">
      {/* 1. Header Toolbar & Breadcrumb */}
      <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHistory}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            title="กลับไปหน้าประวัติ"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>บัญชีการเงิน</span>
              <span>/</span>
              <span>จ่ายชำระ</span>
              <span>/</span>
              <span className="text-blue-600 font-bold">ใบสำคัญจ่าย</span>
            </div>
            <h1 className="text-sm md:text-base font-bold text-slate-800 flex items-center gap-2">
              {isReadOnly ? `รายละเอียดใบสำคัญจ่าย (${viewVoucherData?.voucherNo || voucherNo})` : 'สร้างใบสำคัญจ่าย (Payment Voucher)'}
              {viewVoucherData?.status === 'ยกเลิก' && (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded-full font-bold">ยกเลิกแล้ว</span>
              )}
            </h1>
          </div>
        </div>

        {/* Right: Action Buttons (สร้างใหม่, พิมพ์, บันทึก) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewForm}
            className="h-9 px-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FilePlus className="w-3.5 h-3.5 text-slate-500" />
            <span>สร้างใหม่</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!canPrintInForm}
            className={`h-9 px-3.5 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 ${
              canPrintInForm
                ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer shadow-2xs'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed pointer-events-none opacity-60'
            }`}
          >
            <Printer className={`w-3.5 h-3.5 ${canPrintInForm ? 'text-slate-600' : 'text-slate-400'}`} />
            <span>พิมพ์</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaved || isSaving}
            className={`h-9 px-4 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              isSaved
                ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed pointer-events-none opacity-80'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/30 cursor-pointer'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'กำลังบันทึก...' : isSaved ? 'บันทึกแล้ว' : 'บันทึก'}</span>
          </button>
        </div>
      </div>

      {/* 2. Status Feedback Banner */}
      {statusMessage && (
        <div className={`mx-4 mt-2 p-2.5 rounded-xl flex items-center gap-2 text-xs font-bold ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 3. Main Form Compact Container */}
      <div className="p-3.5 space-y-2.5 max-w-7xl w-full mx-auto flex-1 flex flex-col justify-start">

        {/* CARD 1: ข้อมูลหลักระดับเอกสาร (Document Header) */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>ข้อมูลหลักของเอกสาร</span>
            </div>
            <div className="text-[11px] text-slate-400">
              เลขที่เอกสารรันอัตโนมัติ 8 หลัก (YYMMXXXX เช่น 69080001)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Col 1: เลขที่เอกสาร (ดูได้อย่างเดียว ไม่สามารถกดได้) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                เลขที่ใบสำคัญจ่าย <span className="text-slate-400 font-normal">(ดูได้อย่างเดียว)</span>
              </label>
              <input
                type="text"
                value={voucherNo}
                readOnly
                tabIndex={-1}
                className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-blue-700 cursor-default select-none focus:outline-none"
              />
            </div>

            {/* Col 2: วันที่เอกสาร (วันปัจจุบันเสมอ ดูได้อย่างเดียว ไม่สามารถกดได้) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                วันที่เอกสาร <span className="text-slate-400 font-normal">(ดูได้อย่างเดียว)</span>
              </label>
              <input
                type="text"
                value={docDateThai}
                readOnly
                tabIndex={-1}
                className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-default select-none focus:outline-none"
              />
            </div>

            {/* Col 3: เลขที่เอกสารอ้างอิง */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                เลขที่เอกสารอ้างอิง <span className="text-slate-400 font-normal">(บิล/ใบแจ้งหนี้)</span>
              </label>
              <input
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                disabled={isReadOnly}
                placeholder="เช่น INV-2026-088"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
            {/* จ่ายให้ (Receiver with 200 max char limit) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  จ่ายให้ (Receiver) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">จำกัด 200 ตัวอักษร</span>
              </div>
              {isReadOnly ? (
                <input
                  type="text"
                  value={receiverName}
                  readOnly
                  className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                />
              ) : (
                <SearchableSelect
                  options={receivers.map(r => typeof r === 'object' ? r.name : r)}
                  value={receiverName}
                  maxLength={200}
                  onChange={(val) => setReceiverName(val ? val.slice(0, 200) : '')}
                  placeholder="ค้นหาชื่อ หรือพิมพ์ชื่อผู้รับเงินใหม่ (บันทึกให้อัตโนมัติ)..."
                  className="w-full"
                />
              )}
            </div>

            {/* คำอธิบายภาพรวมเอกสาร with 200 max char limit */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  คำอธิบายภาพรวมเอกสาร
                </label>
                <span className="text-[10px] text-slate-400 font-medium">จำกัด 200 ตัวอักษร</span>
              </div>
              <input
                type="text"
                maxLength={200}
                value={mainDescription}
                onChange={(e) => setMainDescription(e.target.value.slice(0, 200))}
                disabled={isReadOnly}
                placeholder="เช่น ชำระค่าวัตถุดิบยางก้อนถ้วยประจำงวด 08/69"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* CARD 2: รายการจ่าย (Sub-item Section) */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>รายการจ่าย</span>
              <span className="text-[11px] px-2 py-0.2 bg-blue-50 text-blue-700 rounded-full font-bold">
                {items.length} รายการ
              </span>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleAddItemRow}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มบรรทัดรายการ</span>
              </button>
            )}
          </div>

          {/* Scrollable Table Container */}
          <div className="overflow-x-auto overflow-y-auto max-h-[175px] rounded-lg border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2 px-2.5 w-10 text-center">ลำดับ</th>
                  <th className="py-2 px-2.5 w-36">วันที่รายการย่อย</th>
                  <th className="py-2 px-2.5">รายการ (Description)</th>
                  <th className="py-2 px-2.5 w-40 text-right">จำนวนเงิน (บาท)</th>
                  {!isReadOnly && <th className="py-2 px-2 w-20 text-center">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((itm, index) => (
                  <tr key={itm.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-1.5 px-2.5 text-center text-slate-400 font-semibold">{index + 1}</td>
                    
                    {/* วันที่รายการย่อย */}
                    <td className="py-1.5 px-2.5">
                      <input
                        type="date"
                        value={itm.itemDateIso || docDateIso}
                        onChange={(e) => handleItemFieldChange(itm.id, 'itemDateIso', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* รายการ */}
                    <td className="py-1.5 px-2.5">
                      <input
                        id={`item-desc-${itm.id}`}
                        type="text"
                        value={itm.description}
                        onChange={(e) => handleItemFieldChange(itm.id, 'description', e.target.value)}
                        disabled={isReadOnly}
                        placeholder="ระบุรายละเอียดรายการ..."
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* จำนวนเงิน */}
                    <td className="py-1.5 px-2.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={itm.amount}
                        onChange={(e) => handleItemFieldChange(itm.id, 'amount', e.target.value)}
                        onKeyDown={(e) => handleAmountKeyDown(e, index)}
                        disabled={isReadOnly}
                        placeholder="0.00"
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-right text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* ปุ่มจัดการ (ทำสำเนา + ลบ) */}
                    {!isReadOnly && (
                      <td className="py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateItemRow(index)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="ทำสำเนาแถวนี้"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(itm.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="ลบแถวนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* สรุปยอดรวม (นำจำนวนเงินตัวอักษรออกตามสั่ง) */}
          <div className="flex items-center justify-end gap-3 px-3.5 py-2 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-xs font-bold text-slate-600 uppercase">ยอดรวมสุทธิ:</span>
            <span className="text-lg font-extrabold text-blue-700">
              ฿{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* CARD 3: ข้อมูลการชำระเงิน (Payment Section) */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <CreditCard className="w-3.5 h-3.5 text-purple-600" />
              <span>ข้อมูลการชำระเงิน</span>
            </div>
            <span className="text-[11px] text-slate-400">
              {paymentMethod === 'เงินสด' ? 'ชำระด้วยเงินสด' : paymentMethod === 'เช็ค' ? 'ระบุข้อมูลเช็คและธนาคาร' : 'แยกธนาคารปลายทางและชื่อบัญชี'}
            </span>
          </div>

          {/* Case 1: เงินสด (Cash) - ไม่แสดงบัญชีต้นทาง */}
          {paymentMethod === 'เงินสด' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  ชำระโดย <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none"
                >
                  {payments.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  วันที่ชำระเงิน
                </label>
                <input
                  type="date"
                  value={paymentDateIso}
                  onChange={(e) => {
                    setPaymentDateIso(e.target.value);
                    setPaymentDateThai(isoToThaiDate(e.target.value));
                  }}
                  disabled={isReadOnly}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="เช่น จ่ายเงินสดหน้าเคาน์เตอร์..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : paymentMethod === 'เช็ค' ? (
            /* Case 2: เช็ค (Cheque) - แยก ธนาคาร และ สาขา */
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. ชำระโดย */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ชำระโดย <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none"
                  >
                    {payments.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* 2. บัญชีต้นทาง */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    บัญชีต้นทาง (บริษัท)
                  </label>
                  <select
                    value={sourceBankAcc}
                    onChange={(e) => {
                      setSourceBankAcc(e.target.value);
                      const selected = sourceBanks.find(b => (typeof b === 'object' ? b.fullValue : b) === e.target.value);
                      setSourceBankDisplay(selected ? (typeof selected === 'object' ? selected.formatted : selected) : e.target.value);
                    }}
                    disabled={isReadOnly}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none"
                  >
                    {sourceBanks.map(b => (
                      <option key={typeof b === 'object' ? b.fullValue : b} value={typeof b === 'object' ? b.fullValue : b}>
                        {typeof b === 'object' ? b.formatted : b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 3. เลขที่เช็ค */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    เลขที่เช็ค
                  </label>
                  <input
                    type="text"
                    value={chequeOrDestAcc}
                    onChange={(e) => setChequeOrDestAcc(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="ระบุเลขที่เช็ค..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
                  />
                </div>

                {/* 4. ธนาคารที่ออกเช็ค */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ธนาคารที่ออกเช็ค
                  </label>
                  <input
                    type="text"
                    value={chequeBankName}
                    onChange={(e) => setChequeBankName(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="เช่น ธนาคารกรุงเทพ"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
                  />
                </div>

                {/* 5. สาขา */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    สาขา
                  </label>
                  <input
                    type="text"
                    value={chequeBranch}
                    onChange={(e) => setChequeBranch(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="เช่น สาขาบ้านกรวด"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 6. วันที่ชำระเงิน */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    วันที่ชำระเงิน
                  </label>
                  <input
                    type="date"
                    value={paymentDateIso}
                    onChange={(e) => {
                      setPaymentDateIso(e.target.value);
                      setPaymentDateThai(isoToThaiDate(e.target.value));
                    }}
                    disabled={isReadOnly}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500"
                  />
                </div>

                {/* 7. หมายเหตุ */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    หมายเหตุเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="เช่น หัก ณ ที่จ่าย 1% เรียบร้อยแล้ว..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Case 3: เงินโอน (Transfer) - แยก ธนาคารปลายทาง และ ชื่อบัญชี */
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. ชำระโดย */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ชำระโดย <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none"
                  >
                    {payments.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* 2. บัญชีต้นทาง */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    บัญชีต้นทาง (บริษัท)
                  </label>
                  <select
                    value={sourceBankAcc}
                    onChange={(e) => {
                      setSourceBankAcc(e.target.value);
                      const selected = sourceBanks.find(b => (typeof b === 'object' ? b.fullValue : b) === e.target.value);
                      setSourceBankDisplay(selected ? (typeof selected === 'object' ? selected.formatted : selected) : e.target.value);
                    }}
                    disabled={isReadOnly}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none"
                  >
                    {sourceBanks.map(b => (
                      <option key={typeof b === 'object' ? b.fullValue : b} value={typeof b === 'object' ? b.fullValue : b}>
                        {typeof b === 'object' ? b.formatted : b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 3. เลขที่บัญชีปลายทาง */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    เลขที่บัญชีปลายทาง (ผู้รับเงิน - PV)
                  </label>
                  {isReadOnly ? (
                    <input
                      type="text"
                      value={chequeOrDestAcc}
                      readOnly
                      className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    />
                  ) : (
                    <SearchableSelect
                      options={destBanks.map(b => b.accNo || b.formatted || b)}
                      value={chequeOrDestAcc}
                      onChange={handleDestAccSelect}
                      placeholder="เลือกเลขบัญชี หรือพิมพ์ใหม่..."
                      className="w-full"
                    />
                  )}
                </div>

                {/* 4. ธนาคารปลายทาง */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ธนาคารปลายทาง
                  </label>
                  <input
                    type="text"
                    value={destBankName}
                    onChange={(e) => setDestBankName(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="เช่น ธนาคารไทยพาณิชย์"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
                  />
                </div>

                {/* 5. ชื่อบัญชีปลายทาง */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ชื่อบัญชีปลายทาง
                  </label>
                  <input
                    type="text"
                    value={destAccountName}
                    onChange={(e) => setDestAccountName(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="เช่น นายสมศักดิ์ รักดี"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 6. วันที่ชำระเงิน */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    วันที่ชำระเงิน
                  </label>
                  <input
                    type="date"
                    value={paymentDateIso}
                    onChange={(e) => {
                      setPaymentDateIso(e.target.value);
                      setPaymentDateThai(isoToThaiDate(e.target.value));
                    }}
                    disabled={isReadOnly}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500"
                  />
                </div>

                {/* 7. หมายเหตุ */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    หมายเหตุเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="เช่น หัก ณ ที่จ่าย 1% เรียบร้อยแล้ว..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
});

export default VoucherForm;
