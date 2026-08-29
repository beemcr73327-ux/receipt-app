import React, { useState, useEffect } from 'react';
import {
  TreeDeciduous,
  Leaf,
  Search,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Receipt,
  Users,
  Package,
  History,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  Landmark
} from 'lucide-react';

const MENU_STORAGE_KEY = 'receipt_sidebar_open_groups_v3';

export default function Sidebar({
  currentUser,
  activePage = 'create_receipt',
  collapsed,
  onToggleCollapse,
  onNavigate,
  onLogout
}) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Accordion state
  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(MENU_STORAGE_KEY);
      return saved ? JSON.parse(saved) : { finance: true, accountRecords: true, masterData: false };
    } catch {
      return { finance: true, accountRecords: true, masterData: false };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(openGroups));
    } catch (e) {
      console.warn('Could not save sidebar state:', e);
    }
  }, [openGroups]);

  const toggleGroup = (key) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isSearchActive = searchQuery.trim().length > 0;

  const [isPaymentOpen, setIsPaymentOpen] = useState(true);
  const [isPayoutOpen, setIsPayoutOpen] = useState(true);

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col h-full shrink-0 transition-all duration-300 z-30 select-none no-print ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* 1. Header & Logo (สไตล์ LivingOS 14px bold / 11px gray) */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <TreeDeciduous className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h1 className="text-[13.5px] font-bold text-slate-900 leading-tight truncate">
                ศรีสุข พูนทรัพย์
              </h1>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                ระบบจัดการบัญชีการเงิน
              </p>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-600 flex items-center justify-center text-white shadow-md">
            <TreeDeciduous className="w-5 h-5" />
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          title={collapsed ? 'ขยายเมนู' : 'ยุบเมนู'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. Menu Search Input Box */}
      {!collapsed && (
        <div className="p-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเมนู..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>
        </div>
      )}

      {/* 3. Tree Navigation Menu */}
      <div className="flex-1 overflow-y-auto sidebar-scroll py-2 px-2 space-y-1">
        
        {/* GROUP 1: บัญชีการเงิน */}
        <div>
          {!collapsed && (
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              บัญชีการเงิน
            </div>
          )}

          <button
            onClick={() => toggleGroup('finance')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13.5px] font-semibold transition cursor-pointer ${
              openGroups.finance || isSearchActive ? 'text-blue-700 bg-blue-50/50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4.5 h-4.5 text-blue-600 shrink-0" />
              {!collapsed && <span>บัญชีการเงิน</span>}
            </div>
            {!collapsed && (
              <span>
                {openGroups.finance || isSearchActive ? (
                  <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </span>
            )}
          </button>

          {(openGroups.finance || isSearchActive) && !collapsed && (
            <div className="ml-6 pl-2.5 border-l border-blue-200 my-1 space-y-1 text-[13px]">
              
              {/* Sub-group: รับชำระ */}
              <div>
                <button
                  onClick={() => setIsPaymentOpen(!isPaymentOpen)}
                  className="w-full px-2.5 py-1.5 font-semibold text-slate-700 flex items-center justify-between hover:text-slate-900 cursor-pointer rounded-lg transition"
                >
                  <span>รับชำระ</span>
                  {isPaymentOpen || isSearchActive ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {(isPaymentOpen || isSearchActive) && (
                  <div className="ml-2.5 my-1 space-y-1">
                    {/* ACTIVE ITEM HIGHLIGHT: ใบเสร็จ */}
                    <button
                      onClick={() => onNavigate('history')}
                      className={`w-full px-3 py-2 rounded-xl text-[13px] transition flex items-center justify-start cursor-pointer ${
                        activePage === 'history' || activePage === 'create_receipt'
                          ? 'bg-[#EAF2FF] text-[#2F6FED] font-bold shadow-2xs'
                          : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>ใบเสร็จ</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Sub-group: จ่ายชำระ */}
              <div>
                <button
                  onClick={() => setIsPayoutOpen(!isPayoutOpen)}
                  className="w-full px-2.5 py-1.5 font-semibold text-slate-700 flex items-center justify-between hover:text-slate-900 cursor-pointer rounded-lg transition"
                >
                  <span>จ่ายชำระ</span>
                  {isPayoutOpen || isSearchActive ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {(isPayoutOpen || isSearchActive) && (
                  <div className="ml-2.5 my-1 space-y-1">
                    {/* ACTIVE ITEM HIGHLIGHT: ใบสำคัญจ่าย */}
                    <button
                      onClick={() => onNavigate('voucher_history')}
                      className={`w-full px-3 py-2 rounded-xl text-[13px] transition flex items-center justify-start cursor-pointer ${
                        activePage === 'voucher_history' || activePage === 'create_voucher'
                          ? 'bg-[#EAF2FF] text-[#2F6FED] font-bold shadow-2xs'
                          : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>ใบสำคัญจ่าย</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* GROUP 2: บันทึกข้อมูลบัญชี */}
        <div>
          {!collapsed && (
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-2">
              บันทึกข้อมูลบัญชี
            </div>
          )}

          <button
            onClick={() => toggleGroup('accountRecords')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13.5px] font-semibold transition cursor-pointer ${
              openGroups.accountRecords || isSearchActive ? 'text-blue-700 bg-blue-50/50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Landmark className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              {!collapsed && <span>บันทึกข้อมูลบัญชี</span>}
            </div>
            {!collapsed && (
              <span>
                {openGroups.accountRecords || isSearchActive ? (
                  <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </span>
            )}
          </button>

          {(openGroups.accountRecords || isSearchActive) && !collapsed && (
            <div className="ml-6 pl-2.5 border-l border-emerald-200 my-1 space-y-1 text-[13px]">
              <button
                onClick={() => onNavigate('bank_account_rc')}
                className={`w-full px-3 py-2 rounded-xl text-[13px] transition flex items-center justify-start cursor-pointer ${
                  activePage === 'bank_account_rc'
                    ? 'text-emerald-700 font-bold bg-emerald-50/80 shadow-2xs'
                    : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>ข้อมูลธุรกรรมรับชำระเงิน</span>
              </button>

              <button
                onClick={() => onNavigate('bank_account_pv')}
                className={`w-full px-3 py-2 rounded-xl text-[13px] transition flex items-center justify-start cursor-pointer ${
                  activePage === 'bank_account_pv'
                    ? 'text-rose-700 font-bold bg-rose-50/80 shadow-2xs'
                    : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>ข้อมูลธุรกรรมจ่ายชำระเงิน</span>
              </button>
            </div>
          )}
        </div>

        {/* SYSTEM TOOLS: ตั้งค่าระบบ (แสดงเฉพาะ Admin เท่านั้น) */}
        {currentUser?.role === 'Admin' && (
          <div className="pt-3 border-t border-slate-100 mt-3 space-y-1">
            {!collapsed && (
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                จัดการระบบ
              </div>
            )}

            <button
              onClick={() => onNavigate('user_management')}
              className={`w-full px-3 py-2 text-[13px] rounded-xl flex items-center gap-2.5 cursor-pointer transition font-medium border ${
                activePage === 'user_management'
                  ? 'bg-blue-50 text-blue-700 font-bold border-blue-200/60 shadow-2xs'
                  : 'text-slate-600 border-transparent hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              {!collapsed && <span>จัดการผู้ใช้งานระบบ</span>}
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className={`w-full px-3 py-2 text-[13px] rounded-xl flex items-center gap-2.5 cursor-pointer transition font-medium border ${
                activePage === 'settings'
                  ? 'bg-blue-50 text-blue-700 font-bold border-blue-200/60 shadow-2xs'
                  : 'text-slate-600 border-transparent hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              <Settings className="w-4.5 h-4.5 text-slate-500 shrink-0" />
              {!collapsed && <span>ตั้งค่า Google Sheet</span>}
            </button>
          </div>
        )}

      </div>

      {/* 4. User Profile Footer (Avatar + ชื่อ 13px + สถานะ 11px) */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            <div className="relative shrink-0">
              <div className="w-8.5 h-8.5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center border border-blue-200">
                <User className="w-4.5 h-4.5" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
            </div>

            {!collapsed && (
              <div className="truncate">
                <div className="text-[13px] font-bold text-slate-900 truncate">
                  {currentUser?.fullName || 'ผู้รับเงิน'}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium">
                  ออนไลน์
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer rounded-lg hover:bg-rose-50"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
