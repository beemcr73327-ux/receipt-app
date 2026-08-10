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
  User
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
      return saved ? JSON.parse(saved) : { finance: true, masterData: false };
    } catch {
      return { finance: true, masterData: false };
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

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col h-full shrink-0 transition-all duration-300 z-30 select-none no-print ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* 1. Header & Logo */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <TreeDeciduous className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h1 className="text-xs font-bold text-slate-900 leading-tight truncate">
                ศรีสุข พูนทรัพย์ ยางพารา
              </h1>
            </div>
          </div>
        ) : (
          <div className="w-8.5 h-8.5 mx-auto rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-600 flex items-center justify-center text-white shadow-md">
            <TreeDeciduous className="w-5 h-5" />
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          title={collapsed ? 'ขยายเมนู' : 'ยุบเมนู'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. Menu Search Input Box */}
      {!collapsed && (
        <div className="p-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเมนู..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>
        </div>
      )}

      {/* 3. Tree Navigation Menu (เฉพาะธุรกิจของคุณ 100%) */}
      <div className="flex-1 overflow-y-auto sidebar-scroll py-2 px-2 space-y-1">
        
        {/* GROUP 1: บัญชีการเงิน > รับชำระ > ใบเสร็จรับเงิน */}
        <div>
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {!collapsed && 'บัญชีการเงิน'}
          </div>

          <button
            onClick={() => toggleGroup('finance')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              openGroups.finance || isSearchActive ? 'text-blue-700 bg-blue-50/50' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 text-blue-600" />
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
            <div className="ml-7 pl-2 border-l border-blue-200 my-1 space-y-1 text-xs">
              
              {/* Sub-group: รับชำระ */}
              <div>
                <button
                  onClick={() => setIsPaymentOpen(!isPaymentOpen)}
                  className="w-full px-2 py-1 font-semibold text-slate-700 flex items-center justify-between hover:text-slate-900 cursor-pointer rounded transition"
                >
                  <span>รับชำระ</span>
                  {isPaymentOpen || isSearchActive ? (
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  )}
                </button>

                {(isPaymentOpen || isSearchActive) && (
                  <div className="ml-3 my-1 space-y-1">
                    {/* ACTIVE ITEM HIGHLIGHT: ใบเสร็จ */}
                    <button
                      onClick={() => onNavigate('history')}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-start cursor-pointer ${
                        activePage === 'history' || activePage === 'create_receipt'
                          ? 'text-blue-600 font-bold border-transparent hover:bg-blue-50/40'
                          : 'text-slate-600 font-medium border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <span>ใบเสร็จ</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* SYSTEM TOOLS: ตั้งค่าระบบ (แสดงเฉพาะ Admin เท่านั้น) */}
        {currentUser?.role === 'Admin' && (
          <div className="pt-3 border-t border-slate-100 mt-3 space-y-1">
            {!collapsed && (
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                จัดการระบบ
              </div>
            )}

            <button
              onClick={() => onNavigate('user_management')}
              className={`w-full px-3 py-2 text-xs rounded-lg flex items-center gap-2.5 cursor-pointer transition font-medium border ${
                activePage === 'user_management'
                  ? 'bg-blue-50 text-blue-700 font-bold border-blue-200/60 shadow-2xs'
                  : 'text-slate-600 border-transparent hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-600" />
              {!collapsed && <span>จัดการผู้ใช้งานระบบ</span>}
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className={`w-full px-3 py-2 text-xs rounded-lg flex items-center gap-2.5 cursor-pointer transition font-medium border ${
                activePage === 'settings'
                  ? 'bg-blue-50 text-blue-700 font-bold border-blue-200/60 shadow-2xs'
                  : 'text-slate-600 border-transparent hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-500" />
              {!collapsed && <span>ตั้งค่า Google Sheet</span>}
            </button>
          </div>
        )}

      </div>

      {/* 4. User Profile Footer (ออนไลน์ + ปุ่ม Logout) */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center border border-blue-200">
                <User className="w-4 h-4" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
            </div>

            {!collapsed && (
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {currentUser?.fullName || 'ผู้รับเงิน'}
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">
                  ออนไลน์
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
