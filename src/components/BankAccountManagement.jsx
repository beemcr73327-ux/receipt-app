import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Building2,
  User,
  Hash,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { storageService } from '../services/storageService';

const COMMON_BANKS = [
  { name: 'ธนาคารกสิกรไทย', abbr: 'KBANK' },
  { name: 'ธนาคารกรุงเทพ', abbr: 'BBL' },
  { name: 'ธนาคารไทยพาณิชย์', abbr: 'SCB' },
  { name: 'ธนาคารกรุงไทย', abbr: 'KTB' },
  { name: 'ธนาคารกรุงศรีอยุธยา', abbr: 'BAY' },
  { name: 'ธนาคารออมสิน', abbr: 'GSB' },
  { name: 'ธนาคารทหารไทยธนชาต', abbr: 'TTB' },
  { name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', abbr: 'BAAC' },
  { name: 'ธนาคารอาคารสงเคราะห์', abbr: 'GHB' },
  { name: 'ธนาคาร ยูโอบี', abbr: 'UOB' },
  { name: 'ธนาคาร ซีไอเอ็มบี ไทย', abbr: 'CIMBT' }
];

export const formatBankAccount = (val = '') => {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length > 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits;
};

const OFFICIAL_THAI_BANK_ICONS = {
  BBL: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/BBL.png',
  KBANK: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/KBANK.png',
  SCB: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/SCB.png',
  KTB: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/KTB.png',
  BAY: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/BAY.png',
  TTB: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/TTB.png',
  GSB: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/GSB.png',
  BAAC: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/BAAC.png',
  GHB: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/GHB.png',
  UOB: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/UOB.png',
  CIMBT: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/CIMB.png',
  CIMB: 'https://cdn.jsdelivr.net/gh/casperstack/thai-banks-logo@master/icons/CIMB.png'
};

export function ThaiBankLogo({ abbr, className = "w-8 h-8" }) {
  const code = (abbr || '').toUpperCase().trim();
  const [hasError, setHasError] = useState(false);
  const iconUrl = OFFICIAL_THAI_BANK_ICONS[code];

  if (iconUrl && !hasError) {
    return (
      <img
        src={iconUrl}
        alt={code}
        loading="lazy"
        onError={() => setHasError(true)}
        className={`${className} rounded-lg object-contain shrink-0 shadow-2xs bg-white`}
      />
    );
  }

  // Fallback if image fails or code is unknown
  return (
    <div className={`${className} rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0 border border-blue-100 text-[11px] font-mono`}>
      {code.slice(0, 4) || 'BANK'}
    </div>
  );
}

// Helper to cleanly extract and separate bankName, bankAbbr and accountHolder
const extractBankInfo = (rawBankName = '', rawBankAbbr = '', rawAccountHolder = '') => {
  let bankName = (rawBankName || '').trim();
  let bankAbbr = (rawBankAbbr || '').trim().toUpperCase();
  let accountHolder = (rawAccountHolder || '').trim();

  // Match against COMMON_BANKS
  for (const preset of COMMON_BANKS) {
    if (bankName.includes(preset.name) || (preset.abbr && (bankAbbr === preset.abbr || bankName.includes(preset.abbr)))) {
      if (!bankAbbr || bankAbbr === 'ธนาค' || bankAbbr === 'PV' || bankAbbr === 'BANK' || bankAbbr === 'ALL') {
        bankAbbr = preset.abbr;
      }
      // If accountHolder is empty or was merged into bankName, extract the leftover part
      if (!accountHolder && bankName.length > preset.name.length) {
        const leftover = bankName.replace(preset.name, '').trim();
        if (leftover) {
          accountHolder = leftover;
        }
      }
      bankName = preset.name;
      break;
    }
  }

  if (bankAbbr && (!bankName || bankName === 'ธนาคาร')) {
    const foundByAbbr = COMMON_BANKS.find(b => b.abbr === bankAbbr);
    if (foundByAbbr) {
      bankName = foundByAbbr.name;
    }
  }

  return { bankName, bankAbbr, accountHolder };
};

export default function BankAccountManagement({ mode = 'rc' }) {
  const isRC = mode === 'rc';
  const defaultUsage = isRC ? 'ALL' : 'PV';

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Notification alert
  const [toast, setToast] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [isCustomBank, setIsCustomBank] = useState(false);
  const [formData, setFormData] = useState({
    bankAbbr: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    usage: defaultUsage,
    rowIndex: null
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [deletingAccount, setDeletingAccount] = useState(null);

  useEffect(() => {
    loadData();
  }, [mode]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async (forceFetch = false) => {
    setLoading(true);
    try {
      // Sync fresh data from Google Sheets Master_Banks on load
      setSyncing(true);
      await storageService.fetchConfigFromGoogleSheets();
      setSyncing(false);

      // Read from local storage (synced from GAS Master_Banks)
      let list = [];
      if (isRC) {
        const rawSource = storageService.getSourceBanks();
        list = rawSource.map((b, idx) => {
          const extracted = extractBankInfo(
            b.bankFullName || b.bankName || 'ธนาคาร',
            b.bankAbbr || (b.formatted ? b.formatted.split(' ')[0] : ''),
            b.accountHolder || ''
          );
          return {
            rowIndex: b.rowIndex || (idx + 2),
            bankAbbr: extracted.bankAbbr || 'BANK',
            bankName: extracted.bankName || 'ธนาคาร',
            accountNumber: b.fullAccNum || b.fullValue || b.last4 || '',
            accountName: extracted.accountHolder,
            usage: b.usage || 'ALL'
          };
        });
      } else {
        const rawDest = storageService.getDestBanks();
        list = rawDest.map((b, idx) => {
          const extracted = extractBankInfo(
            b.bankFullName || b.bankName || '',
            b.bankAbbr || '',
            b.accHolder || b.accountHolder || ''
          );
          return {
            rowIndex: b.rowIndex || (idx + 2),
            bankAbbr: extracted.bankAbbr || 'PV',
            bankName: extracted.bankName || 'ธนาคาร',
            accountNumber: b.accNo || b.fullAccNum || '',
            accountName: extracted.accountHolder,
            usage: b.usage || 'PV'
          };
        });
      }

      setAccounts(list);
    } catch (err) {
      console.error('Error loading bank accounts:', err);
      showToast('error', 'ไม่สามารถโหลดข้อมูลบัญชีได้');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingAccount(null);
    setIsCustomBank(false);
    setFormData({
      bankAbbr: '',
      bankName: '',
      accountNumber: '',
      accountName: '',
      usage: defaultUsage,
      rowIndex: null
    });
    setIsModalOpen(true);
  };

  const openEditModal = (acc) => {
    setEditingAccount(acc);
    const isPreset = COMMON_BANKS.some(b => b.name === acc.bankName);
    setIsCustomBank(!isPreset && !!acc.bankName);
    setFormData({
      bankAbbr: acc.bankAbbr || '',
      bankName: acc.bankName || '',
      accountNumber: acc.accountNumber || '',
      accountName: acc.accountName || '',
      usage: acc.usage || defaultUsage,
      rowIndex: acc.rowIndex || null
    });
    setIsModalOpen(true);
  };

  const handleBankSelect = (e) => {
    const selectedVal = e.target.value;
    if (selectedVal === 'OTHER') {
      setIsCustomBank(true);
      setFormData(prev => ({
        ...prev,
        bankName: '',
        bankAbbr: ''
      }));
    } else if (!selectedVal) {
      setIsCustomBank(false);
      setFormData(prev => ({
        ...prev,
        bankName: '',
        bankAbbr: ''
      }));
    } else {
      setIsCustomBank(false);
      const found = COMMON_BANKS.find(b => b.name === selectedVal);
      setFormData(prev => ({
        ...prev,
        bankName: selectedVal,
        bankAbbr: found ? found.abbr : prev.bankAbbr
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.accountNumber.trim()) {
      showToast('error', 'กรุณากรอกเลขที่บัญชีธนาคาร');
      return;
    }

    setSubmitting(true);
    try {
      const cleanAccNum = formData.accountNumber.replace(/\D/g, '');
      const payload = {
        bankAbbr: formData.bankAbbr.trim().toUpperCase() || 'BANK',
        bankName: formData.bankName.trim(),
        fullAccNum: cleanAccNum,
        accountHolder: formData.accountName.trim(),
        usage: formData.usage || defaultUsage,
        ...(editingAccount && editingAccount.accountNumber ? { originalFullAccNum: editingAccount.accountNumber } : {})
      };

      const result = await storageService.saveBankToGoogleSheets(payload);
      
      if (result && result.success) {
        showToast('success', editingAccount ? 'อัปเดตข้อมูลบัญชีเรียบร้อย' : 'เพิ่มบัญชีใหม่เรียบร้อยแล้ว');
        setIsModalOpen(false);
        await loadData(true);
      } else {
        showToast('error', 'ไม่สามารถบันทึกข้อมูลไปยัง Google Sheets ได้');
      }
    } catch (err) {
      console.error('Submit error:', err);
      showToast('error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;

    setSubmitting(true);
    try {
      const payload = {
        fullAccNum: deletingAccount.accountNumber
      };

      const result = await storageService.deleteBankFromGoogleSheets(payload);
      
      if (result && result.success) {
        showToast('success', 'ลบข้อมูลบัญชีเรียบร้อยแล้ว');
        setDeletingAccount(null);
        await loadData(true);
      } else {
        showToast('error', 'ไม่สามารถลบข้อมูลจาก Google Sheets ได้');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('error', 'เกิดข้อผิดพลาดในการลบข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  // Search Filter
  const filteredAccounts = accounts.filter(acc => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const formattedAcc = formatBankAccount(acc.accountNumber);
    return (
      (acc.bankName && acc.bankName.toLowerCase().includes(q)) ||
      (acc.bankAbbr && acc.bankAbbr.toLowerCase().includes(q)) ||
      (acc.accountNumber && acc.accountNumber.includes(q)) ||
      (formattedAcc && formattedAcc.includes(q)) ||
      (acc.accountName && acc.accountName.toLowerCase().includes(q))
    );
  });

  const isPresetSelected = !isCustomBank && COMMON_BANKS.some(b => b.name === formData.bankName);

  return (
    <div className="h-full flex flex-col bg-[#F5F6FA] text-slate-800 no-print overflow-hidden">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border transition-all duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* 1. Workspace Header & Action Bar (ตรงกับหน้าใบเสร็จและใบสำคัญจ่าย) */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
            <span>บันทึกข้อมูลบัญชี</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className={isRC ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold"}>
              {isRC ? 'ข้อมูลธุรกรรมรับชำระเงิน' : 'ข้อมูลธุรกรรมจ่ายชำระเงิน'}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-bold">รายการทั้งหมด</span>
          </div>

          <div className="flex items-center gap-2.5">
            <CreditCard className={`w-5 h-5 ${isRC ? 'text-emerald-600' : 'text-rose-600'}`} />
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {isRC ? 'ข้อมูลธุรกรรมรับชำระเงิน' : 'ข้อมูลธุรกรรมจ่ายชำระเงิน'}
            </h2>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
              isRC 
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                : 'bg-rose-100 text-rose-700 border-rose-200'
            }`}>
              {filteredAccounts.length} รายการ
            </span>
          </div>
        </div>

        {/* Right: Add New Bank Account Button */}
        <div>
          <button
            type="button"
            onClick={openAddModal}
            className={`h-10 px-5 text-white font-bold text-sm rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer ${
              isRC 
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มบัญชีใหม่</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Workspace (ตรงกับขอบล่างของหน้าใบเสร็จและใบสำคัญจ่าย) */}
      <div className="flex-1 p-4 md:p-6 flex flex-col gap-4 overflow-hidden min-h-0">
        {/* Search & Table Card Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อธนาคาร, เลขที่บัญชี, ชื่อบัญชี..."
                className={`w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 text-xs font-medium transition ${
                  isRC ? 'focus:ring-emerald-500' : 'focus:ring-rose-500'
                }`}
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <Loader2 className={`w-8 h-8 animate-spin ${isRC ? 'text-emerald-600' : 'text-rose-600'}`} />
                <span className="text-xs">กำลังโหลดข้อมูลบัญชีธนาคาร...</span>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <CreditCard className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">ไม่พบรายการบัญชีธนาคาร</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery ? 'ลองค้นหาด้วยคำค้นอื่น หรือกดปุ่มเพิ่มบัญชีใหม่ด้านบน' : 'ยังไม่มีข้อมูลบัญชีธนาคารในระบบ กดปุ่ม "เพิ่มบัญชีใหม่" เพื่อเริ่มบันทึกข้อมูล'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 shadow-2xs">
                    <tr>
                      <th className="py-3.5 px-4 bg-slate-50">ธนาคาร / ตัวย่อ</th>
                      <th className="py-3.5 px-4 bg-slate-50">เลขที่บัญชี</th>
                      <th className="py-3.5 px-4 bg-slate-50">ชื่อบัญชี</th>
                      <th className="py-3.5 px-4 text-center w-28 bg-slate-50">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredAccounts.map((acc, index) => (
                      <tr key={index} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <ThaiBankLogo abbr={acc.bankAbbr} className="w-8 h-8" />
                            <div>
                              <div className="font-semibold text-slate-900">{acc.bankName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{acc.bankAbbr}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2.5 py-1 rounded-md inline-block tracking-wide">
                            {formatBankAccount(acc.accountNumber)}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {acc.accountName || <span className="text-slate-300 font-normal italic">- ไม่ระบุชื่อ -</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(acc)}
                              className={`p-1.5 text-slate-400 rounded-lg transition cursor-pointer ${
                                isRC ? 'hover:text-emerald-600 hover:bg-emerald-50' : 'hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title="แก้ไขบัญชี"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingAccount(acc)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="ลบบัญชี"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add / Edit Account */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                  isRC ? 'bg-emerald-600' : 'bg-rose-600'
                }`}>
                  <CreditCard className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">
                  {editingAccount ? 'แก้ไขข้อมูลบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคารใหม่'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Preset Bank Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  เลือกธนาคาร
                </label>
                <div className="relative">
                  <select
                    onChange={handleBankSelect}
                    value={isCustomBank ? 'OTHER' : (COMMON_BANKS.some(b => b.name === formData.bankName) ? formData.bankName : '')}
                    className={`w-full pl-3.5 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:bg-white transition cursor-pointer font-medium appearance-none ${
                      isRC ? 'focus:ring-emerald-500' : 'focus:ring-rose-500'
                    }`}
                  >
                    <option value="">-- เลือกจากรายชื่อธนาคาร --</option>
                    {COMMON_BANKS.map((b, idx) => (
                      <option key={idx} value={b.name}>{b.name}</option>
                    ))}
                    <option value="OTHER">อื่นๆ (ระบุเอง)</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Bank Name */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อธนาคาร <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    {formData.bankAbbr ? (
                      <div className="absolute left-2 z-10 flex items-center justify-center">
                        <ThaiBankLogo abbr={formData.bankAbbr} className="w-6 h-6 !p-1 !rounded-lg" />
                      </div>
                    ) : (
                      <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    )}
                    <input
                      type="text"
                      required
                      disabled={isPresetSelected}
                      value={formData.bankName}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                      placeholder="เช่น ธนาคารกสิกรไทย"
                      className={`w-full ${formData.bankAbbr ? 'pl-10' : 'pl-9'} pr-3 py-2 rounded-xl text-xs transition border ${
                        isPresetSelected
                          ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                          : `bg-white text-slate-800 border-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 ${isRC ? 'focus:ring-emerald-500' : 'focus:ring-rose-500'}`
                      }`}
                    />
                  </div>
                </div>

                {/* Bank Abbr */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ตัวย่อ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isPresetSelected}
                    value={formData.bankAbbr}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankAbbr: e.target.value.toUpperCase() }))}
                    placeholder="KBANK"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold uppercase text-center transition border ${
                      isPresetSelected
                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                        : `bg-white text-slate-800 border-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 ${isRC ? 'focus:ring-emerald-500' : 'focus:ring-rose-500'}`
                    }`}
                  />
                </div>
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลขที่บัญชีธนาคาร <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formatBankAccount(formData.accountNumber)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
                      setFormData(prev => ({ ...prev, accountNumber: digits }));
                    }}
                    placeholder="เช่น 123-456-7890"
                    className={`w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition tracking-wide ${
                      isRC ? 'focus:ring-emerald-500' : 'focus:ring-rose-500'
                    }`}
                  />
                </div>
              </div>

              {/* Account Holder Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อบัญชี
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.accountName}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                    placeholder="เช่น บจก. ศรีสุข พูนทรัพย์ ยางพารา"
                    className={`w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                      isRC ? 'focus:ring-emerald-500' : 'focus:ring-rose-500'
                    }`}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 ${
                    isRC ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingAccount ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลลง Google Sheet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">ยืนยันการลบบัญชีธนาคาร?</h3>
              <p className="text-xs text-slate-500">
                ต้องการลบ <strong className="text-slate-900">{deletingAccount.bankName}</strong> ({deletingAccount.accountNumber}) ออกจาก Google Sheets หรือไม่?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingAccount(null)}
                className="w-1/2 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                onClick={handleDelete}
                disabled={submitting}
                className="w-1/2 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>ยืนยันลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
