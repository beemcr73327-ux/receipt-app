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
  ChevronRight,
  ChevronDown,
  FileText,
  DollarSign,
  CreditCard,
  User,
  RotateCcw,
  X,
  Search,
  Building2
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { bahttext } from '../utils/bahttext';
import { formatThaiDate, formatThaiDateTime, getTodayISO, isoToThaiDate } from '../utils/dateUtils';
import { storageService } from '../services/storageService';

const splitCombinedBank = (combinedStr) => {
  const str = String(combinedStr || '').trim();
  if (!str) return { bankName: '', accHolder: '' };
  const spaceIdx = str.indexOf(' ');
  if (spaceIdx > 0) {
    return {
      bankName: str.substring(0, spaceIdx).trim(),
      accHolder: str.substring(spaceIdx + 1).trim()
    };
  }
  return {
    bankName: str,
    accHolder: ''
  };
};

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
  
  // Smart Destination Account States (เงินโอน)
  const [isHolderModalOpen, setIsHolderModalOpen] = useState(false);
  const [holderSearchQuery, setHolderSearchQuery] = useState('');
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [selectedViaHolder, setSelectedViaHolder] = useState(false);
  const [pendingBankOptions, setPendingBankOptions] = useState([]);
  const [pendingAccOptions, setPendingAccOptions] = useState([]);
  
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
  const isFormFilled = receiverName.trim() !== '' || items.some(it => it.description.trim() !== '' || Number(it.amount) > 0) || mainDescription.trim() !== '' || chequeOrDestAcc.trim() !== '' || refNo.trim() !== '' || notes.trim() !== '';
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
    setIsAccountLocked(false);
    setIsHolderModalOpen(false);
    setHolderSearchQuery('');
    setPendingBankOptions([]);
    setPendingAccOptions([]);
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
          let bName = (matched.bankName || '').trim();
          let aHolder = (matched.accHolder || '').trim();
          if (bName && !aHolder) {
            const split = splitCombinedBank(bName);
            bName = split.bankName;
            aHolder = split.accHolder;
          }
          setDestBankName(bName);
          setDestAccountName(aHolder);
        } else {
          const split = splitCombinedBank(rawDestBank);
          setDestBankName(split.bankName);
          setDestAccountName(split.accHolder);
        }
        setIsAccountLocked(true);
        setIsHolderModalOpen(false);
        setHolderSearchQuery('');
        setPendingBankOptions([]);
        setPendingAccOptions([]);
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
  const bahtTextString = totalAmount !== 0 ? bahttext(totalAmount) : '-';

  // Get normalized list of destination banks (with clean bankName and accHolder)
  const getNormalizedDestBanks = () => {
    return destBanks.map(b => {
      let bName = (b.bankName || '').trim();
      let aHolder = (b.accHolder || '').trim();
      if (!aHolder && bName) {
        const split = splitCombinedBank(bName);
        bName = split.bankName;
        aHolder = split.accHolder;
      }
      return {
        accNo: String(b.accNo || '').trim(),
        bankName: bName,
        accHolder: aHolder,
        formatted: b.formatted
      };
    }).filter(b => b.accNo);
  };

  // Pure unique account numbers for search
  const uniqueAccNumbers = Array.from(new Set(getNormalizedDestBanks().map(b => b.accNo).filter(Boolean)));

  // Destination Account Select Handler (Auto-fills Bank Name & Account Name)
  const handleDestAccSelect = (val) => {
    const list = getNormalizedDestBanks();
    const matched = list.find(b => b.accNo === val || (val && b.accNo.startsWith(val)));
    if (matched) {
      setChequeOrDestAcc(matched.accNo);
      setDestBankName(matched.bankName);
      setDestAccountName(matched.accHolder);
      setIsAccountLocked(false);
      setSelectedViaHolder(false);
      setPendingBankOptions([]);
      setPendingAccOptions([]);
    } else {
      setChequeOrDestAcc(val);
      if (!val) {
        setIsAccountLocked(false);
        setSelectedViaHolder(false);
        setDestBankName('');
        setDestAccountName('');
      }
    }
  };

  // Direct Exact Account Select Handler (used by Modal Popup)
  const handleSelectExactAccount = (accNo, bankName, accHolder) => {
    setChequeOrDestAcc(accNo || '');
    setDestBankName(bankName || '');
    setDestAccountName(accHolder || '');
    setIsAccountLocked(true);
    setSelectedViaHolder(true);
    setPendingBankOptions([]);
    setPendingAccOptions([]);
    setIsHolderModalOpen(false);
    setHolderSearchQuery('');
  };

  // Grouped account holders with summary of accounts/banks for the Modal
  const getHolderSummaryList = () => {
    const list = getNormalizedDestBanks();
    const map = new Map();
    list.forEach(item => {
      const h = item.accHolder || 'ไม่ระบุชื่อ';
      if (!map.has(h)) {
        map.set(h, { name: h, banks: new Set(), accounts: [] });
      }
      const entry = map.get(h);
      if (item.bankName) entry.banks.add(item.bankName);
      if (item.accNo) entry.accounts.push({ accNo: item.accNo, bankName: item.bankName });
    });

    return Array.from(map.values()).map(entry => ({
      name: entry.name,
      banks: Array.from(entry.banks),
      accounts: entry.accounts,
      accountCount: entry.accounts.length
    }));
  };

  const filteredHolderSummary = getHolderSummaryList().filter(h => {
    const q = (holderSearchQuery || '').toLowerCase().trim();
    if (!q) return true;
    return (
      h.name.toLowerCase().includes(q) ||
      h.banks.some(b => b.toLowerCase().includes(q)) ||
      h.accounts.some(a => a.accNo.includes(q))
    );
  });

  // Reset / Clear Destination Account
  const handleResetDestBank = () => {
    setChequeOrDestAcc('');
    setDestBankName('');
    setDestAccountName('');
    setIsAccountLocked(false);
    setSelectedViaHolder(false);
    setPendingBankOptions([]);
    setPendingAccOptions([]);
    setIsHolderModalOpen(false);
    setHolderSearchQuery('');
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
    const validItems = items.filter(it => it.description.trim() !== '' && Number(it.amount) !== 0 && !isNaN(Number(it.amount)));
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
  const canPrintInForm = isSaved && !viewVoucherData;

  const handlePrint = () => {
    if (!canPrintInForm) return;
    const nowTs = formatThaiDateTime();
    const payload = buildPayload();
    payload.printedTimestamp = nowTs;
    storageService.updateVoucherPrintTimestamp(voucherNo, nowTs);
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

    // 1. Validate payment details based on method
    if (paymentMethod === 'เช็ค') {
      if (!chequeOrDestAcc.trim()) {
        setStatusMessage({ type: 'error', text: 'กรุณากรอกเลขที่เช็ค' });
        return;
      }
      if (!chequeBankName.trim()) {
        setStatusMessage({ type: 'error', text: 'กรุณากรอกธนาคารที่ออกเช็ค' });
        return;
      }
      if (!chequeBranch.trim()) {
        setStatusMessage({ type: 'error', text: 'กรุณากรอกสาขาของเช็ค' });
        return;
      }
    } else if (paymentMethod === 'เงินโอน') {
      if (!chequeOrDestAcc.trim()) {
        setStatusMessage({ type: 'error', text: 'กรุณากรอกเลขที่บัญชีปลายทาง' });
        return;
      }
    }

    // 2. Validate all payment item rows
    if (items.length === 0) {
      setStatusMessage({ type: 'error', text: 'กรุณากรอกรายการจ่ายอย่างน้อย 1 รายการ' });
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.description.trim()) {
        setStatusMessage({ type: 'error', text: `กรุณากรอกรายละเอียดของรายการจ่ายแถวที่ ${i + 1}` });
        return;
      }
      const amt = Number(it.amount);
      if (isNaN(amt) || amt === 0) {
        setStatusMessage({ type: 'error', text: `กรุณากรอกจำนวนเงิน (ไม่เป็น 0) ของรายการจ่ายแถวที่ ${i + 1}` });
        return;
      }
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
    <div className="flex-1 flex flex-col h-full bg-[#F5F6FA] overflow-hidden">
      {/* 1. Header Toolbar & Breadcrumb */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
            <span>บัญชีการเงิน</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>จ่ายชำระ</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <button
              type="button"
              onClick={onBackToHistory}
              className="text-blue-600 hover:text-blue-700 hover:underline font-semibold cursor-pointer"
            >
              ใบสำคัญจ่าย
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-bold">
              {viewVoucherData ? 'รายละเอียดใบสำคัญจ่าย' : 'สร้างใบสำคัญจ่าย'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {viewVoucherData ? `รายละเอียดใบสำคัญจ่าย (${viewVoucherData.voucherNo || voucherNo})` : 'สร้างใบสำคัญจ่าย'}
            </h2>
            {viewVoucherData?.status === 'ยกเลิก' && (
              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 text-xs rounded-full font-bold border border-rose-200">
                ยกเลิกแล้ว
              </span>
            )}
          </div>
        </div>

        {/* Right: Action Buttons (สร้างใหม่, พิมพ์, บันทึก) */}
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
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 cursor-pointer'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'กำลังบันทึก...' : isSaved ? 'บันทึกแล้ว' : 'บันทึก'}</span>
          </button>
        </div>
      </div>

      {/* 2. Status Feedback Banner */}
      {statusMessage && (
        <div className={`mx-4 mt-2 p-2.5 rounded-xl flex items-center gap-2 text-xs font-bold shrink-0 ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 3. Main Form Compact Container (Fit 1 Page, No Page Scroll) */}
      <div className="p-3 flex-1 flex flex-col gap-2.5 max-w-7xl w-full mx-auto overflow-hidden min-h-0">

        {/* TOP SECTION: 2-Column Grid (ข้อมูลเอกสาร + ข้อมูลการชำระเงิน) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 shrink-0">

          {/* CARD 1 (LEFT): ข้อมูลเอกสาร (Document Header) */}
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>ข้อมูลเอกสาร</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Col 1: เลขที่เอกสาร */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  เลขที่ใบสำคัญจ่าย
                </label>
                <input
                  type="text"
                  value={voucherNo}
                  disabled
                  readOnly
                  tabIndex={-1}
                  className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs font-medium cursor-not-allowed pointer-events-none select-none"
                />
              </div>

              {/* Col 2: วันที่เอกสาร */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  วันที่เอกสาร
                </label>
                <input
                  type="text"
                  value={docDateThai}
                  disabled
                  readOnly
                  tabIndex={-1}
                  className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs font-medium cursor-not-allowed pointer-events-none select-none"
                />
              </div>

              {/* Col 3: เลขที่เอกสารอ้างอิง */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  เลขที่เอกสารอ้างอิง
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

            {/* จ่ายให้ (Receiver) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                จ่ายให้ (Receiver) <span className="text-rose-500">*</span>
              </label>
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
                  placeholder="ค้นหาชื่อหรือพิมพ์ชื่อผู้รับเงิน"
                  className="w-full"
                />
              )}
            </div>

            {/* คำอธิบายภาพรวมเอกสาร */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                คำอธิบายภาพรวมเอกสาร
              </label>
              <input
                type="text"
                maxLength={200}
                value={mainDescription}
                onChange={(e) => setMainDescription(e.target.value.slice(0, 200))}
                disabled={isReadOnly}
                placeholder="ระบุคำอธิบายภาพรวมเอกสาร..."
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
              />
            </div>
          </div>

          {/* CARD 2 (RIGHT): ข้อมูลการชำระเงิน (Payment Section) */}
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-start">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                <span>ข้อมูลการชำระเงิน</span>
              </div>
            </div>

            {/* Case 1: เงินสด (Cash) */}
            {paymentMethod === 'เงินสด' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ชำระโดย <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={isReadOnly}
                        className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {payments.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
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
              /* Case 2: เช็ค (Cheque) */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* 1. ชำระโดย */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ชำระโดย <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={isReadOnly}
                        className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {payments.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* 2. บัญชีต้นทาง */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      บัญชีต้นทาง (บริษัท)
                    </label>
                    <div className="relative">
                      <select
                        value={sourceBankAcc}
                        onChange={(e) => {
                          setSourceBankAcc(e.target.value);
                          const selected = sourceBanks.find(b => (typeof b === 'object' ? b.fullValue : b) === e.target.value);
                          setSourceBankDisplay(selected ? (typeof selected === 'object' ? selected.formatted : selected) : e.target.value);
                        }}
                        disabled={isReadOnly}
                        className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {sourceBanks.map(b => (
                          <option key={typeof b === 'object' ? b.fullValue : b} value={typeof b === 'object' ? b.fullValue : b}>
                            {typeof b === 'object' ? b.formatted : b}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* 3. เลขที่เช็ค */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      เลขที่เช็ค <span className="text-rose-500">*</span>
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
                      ธนาคารที่ออกเช็ค <span className="text-rose-500">*</span>
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
                      สาขา <span className="text-rose-500">*</span>
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

                <div className="grid grid-cols-12 gap-2">
                  {/* 6. วันที่ชำระเงิน */}
                  <div className="col-span-5">
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
                  <div className="col-span-7">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      หมายเหตุเพิ่มเติม
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={isReadOnly}
                      placeholder="เช่น หัก ณ ที่จ่าย 1%..."
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Case 3: เงินโอน (Transfer) */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* 1. ชำระโดย */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ชำระโดย <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={isReadOnly}
                        className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {payments.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* 2. บัญชีต้นทาง */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      บัญชีต้นทาง (บริษัท)
                    </label>
                    <div className="relative">
                      <select
                        value={sourceBankAcc}
                        onChange={(e) => {
                          setSourceBankAcc(e.target.value);
                          const selected = sourceBanks.find(b => (typeof b === 'object' ? b.fullValue : b) === e.target.value);
                          setSourceBankDisplay(selected ? (typeof selected === 'object' ? selected.formatted : selected) : e.target.value);
                        }}
                        disabled={isReadOnly}
                        className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {sourceBanks.map(b => (
                          <option key={typeof b === 'object' ? b.fullValue : b} value={typeof b === 'object' ? b.fullValue : b}>
                            {typeof b === 'object' ? b.formatted : b}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>

                {!Boolean(chequeOrDestAcc || destBankName || destAccountName) ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      เลขที่บัญชีปลายทาง <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <SearchableSelect
                          options={uniqueAccNumbers}
                          value={chequeOrDestAcc}
                          onChange={handleDestAccSelect}
                          allowCustom={false}
                          showAllOnFocus={true}
                          placeholder="ค้นหาเลขที่บัญชี หรือเลือกจากรายการ..."
                          className="w-full"
                          inputClassName="w-full pl-3 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
                        />
                      </div>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsHolderModalOpen(true);
                            setHolderSearchQuery('');
                          }}
                          title="กดเพื่อค้นหาตามชื่อบัญชี"
                          className="w-[34px] h-[34px] aspect-square flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition cursor-pointer shrink-0 shadow-2xs hover:shadow-xs"
                        >
                          <User className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-left duration-200">
                    {/* 3. เลขที่บัญชีปลายทาง */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 h-5">
                        <label className="block text-[11px] font-semibold text-slate-700 leading-none">
                          เลขที่บัญชีปลายทาง <span className="text-rose-500">*</span>
                        </label>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsHolderModalOpen(true);
                              setHolderSearchQuery('');
                            }}
                            title="กดเพื่อเปิดหน้าต่างค้นหาตามชื่อบัญชี"
                            className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-1.5 py-0.5 rounded-md transition cursor-pointer font-medium leading-none"
                          >
                            <User className="w-3 h-3" />
                            <span>ตามชื่อ</span>
                          </button>
                        )}
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={handleResetDestBank}
                            title="ล้างข้อมูล / ปลดล็อค"
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition cursor-pointer leading-none"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {isReadOnly || selectedViaHolder ? (
                        <input
                          type="text"
                          value={chequeOrDestAcc}
                          readOnly
                          className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-not-allowed pointer-events-none select-none"
                        />
                      ) : (
                        <SearchableSelect
                          options={uniqueAccNumbers}
                          value={chequeOrDestAcc}
                          onChange={handleDestAccSelect}
                          allowCustom={false}
                          showAllOnFocus={true}
                          placeholder="เลือกเลขบัญชี หรือพิมพ์..."
                          className="w-full"
                          inputClassName="w-full pl-2.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1.5 focus:ring-blue-500 focus:outline-none transition"
                        />
                      )}
                    </div>

                    {/* 4. ธนาคารปลายทาง */}
                    <div className="animate-in fade-in slide-in-from-left duration-200">
                      <div className="flex items-center mb-1 h-5">
                        <label className="block text-[11px] font-semibold text-slate-700 leading-none">
                          ธนาคารปลายทาง
                        </label>
                      </div>
                      <input
                        type="text"
                        value={destBankName}
                        onChange={(e) => setDestBankName(e.target.value)}
                        disabled={isReadOnly || isAccountLocked}
                        readOnly={isAccountLocked}
                        placeholder="เช่น ธนาคารไทยพาณิชย์"
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed pointer-events-none select-none"
                      />
                    </div>

                    {/* 5. ชื่อบัญชีปลายทาง */}
                    <div className="animate-in fade-in slide-in-from-left duration-200">
                      <div className="flex items-center mb-1 h-5">
                        <label className="block text-[11px] font-semibold text-slate-700 leading-none">
                          ชื่อบัญชีปลายทาง
                        </label>
                      </div>
                      <input
                        type="text"
                        value={destAccountName}
                        onChange={(e) => setDestAccountName(e.target.value)}
                        disabled={isReadOnly || isAccountLocked}
                        readOnly={isAccountLocked}
                        placeholder="เช่น นายสมศักดิ์ รักดี"
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed pointer-events-none select-none"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-12 gap-2">
                  {/* 6. วันที่ชำระเงิน */}
                  <div className="col-span-5">
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
                  <div className="col-span-7">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      หมายเหตุเพิ่มเติม
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={isReadOnly}
                      placeholder="เช่น หัก ณ ที่จ่าย 1%..."
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1.5 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* BOTTOM SECTION: CARD 3 (รายการจ่าย - Sub-item Section with Full-Width Table) */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs space-y-2 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
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
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-[120px] rounded-lg border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2 px-2.5 w-10 text-center">ลำดับ</th>
                  <th className="py-2 px-2.5 w-36">วันที่รายการย่อย</th>
                  <th className="py-2 px-2.5">รายการ (Description) <span className="text-rose-500">*</span></th>
                  <th className="py-2 px-2.5 w-40 text-right">จำนวนเงิน (บาท) <span className="text-rose-500">*</span></th>
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

                    {/* จำนวนเงิน (รองรับค่าติดลบ เช่น รายการหักภาษี) */}
                    <td className="py-1.5 px-2.5">
                      <input
                        type="number"
                        step="any"
                        value={itm.amount}
                        onChange={(e) => handleItemFieldChange(itm.id, 'amount', e.target.value)}
                        onKeyDown={(e) => handleAmountKeyDown(e, index)}
                        disabled={isReadOnly}
                        placeholder="0.00"
                        className={`w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-right focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          Number(itm.amount) < 0 ? 'text-rose-600' : 'text-slate-900'
                        }`}
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

          {/* สรุปยอดรวม */}
          <div className="flex items-center justify-end gap-3 px-3.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200/80 shrink-0">
            <span className="text-xs font-bold text-slate-600 uppercase">ยอดรวมสุทธิ:</span>
            <span className="text-lg font-extrabold text-blue-700">
              ฿{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

      </div>

      {/* ─── Modal Popup: ค้นหาตามชื่อบัญชีผู้รับเงิน ─────────────────────────── */}
      {isHolderModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsHolderModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">ค้นหาตามชื่อบัญชี</h3>
                  <p className="text-[11px] text-slate-500">คลิกเลือกชื่อบัญชีเพื่อกรอกข้อมูลอัตโนมัติ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  value={holderSearchQuery}
                  onChange={(e) => setHolderSearchQuery(e.target.value)}
                  placeholder="พิมพ์ค้นหาชื่อบัญชี หรือธนาคาร..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* List of Account Holders */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[420px]">
              {filteredHolderSummary.length > 0 ? (
                filteredHolderSummary.map((item, idx) => (
                  <div 
                    key={idx}
                    className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 transition hover:border-blue-200 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-200/70 text-slate-600 rounded-full shrink-0">
                        {item.accountCount} บัญชี
                      </span>
                    </div>

                    {/* Account Options to Click Directly */}
                    <div className="space-y-1.5">
                      {item.accounts.map((acc, accIdx) => (
                        <button
                          key={accIdx}
                          type="button"
                          onClick={() => handleSelectExactAccount(acc.accNo, acc.bankName, item.name)}
                          className="w-full text-left px-2.5 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition flex items-center justify-between group cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="text-xs text-slate-700 font-medium truncate group-hover:text-blue-700">
                              {acc.bankName || 'ไม่ระบุธนาคาร'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700 font-mono">
                              {acc.accNo}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  ไม่พบรายชื่อบัญชีที่ตรงกับคำค้นหา
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>พบทั้งหมด {filteredHolderSummary.length} รายการ</span>
              <button
                type="button"
                onClick={() => setIsHolderModalOpen(false)}
                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer font-medium"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default VoucherForm;
