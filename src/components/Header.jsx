import React from 'react';
import {
  ChevronRight,
  Building2,
  ChevronDown,
  Grid,
  History,
  Settings,
  LogOut,
  User,
  Cloud,
  HelpCircle,
  Printer,
  Save,
  ChevronLeft
} from 'lucide-react';

export default function Header({
  currentUser,
  onOpenHistory,
  onOpenSettings,
  onLogout,
  onNewForm,
  onPrint,
  onSave
}) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print select-none">
      
      {/* LINE 1: PMS LivingOS Top Breadcrumb & Company Selector */}
      <div className="h-12 px-6 flex items-center justify-between border-b border-slate-100 text-xs">
        
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 font-medium text-slate-500">
          <span className="hover:text-blue-600 cursor-pointer">บัญชีการเงิน</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="hover:text-blue-600 cursor-pointer">รับชำระ</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="hover:text-blue-600 cursor-pointer text-blue-600 font-semibold">ใบเสร็จรับเงิน</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-bold">สร้างใบเสร็จ</span>
        </div>

        {/* Right: Company Selector (⇄) & System Controls */}
        <div className="flex items-center gap-2">
          
          {/* Company Switcher Dropdown */}
          <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold shadow-2xs hover:bg-slate-50 cursor-pointer transition">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="truncate max-w-[240px]">บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด</span>
            <span className="text-slate-400 font-normal">⇄</span>
          </div>

          {/* Grid Apps Icon */}
          <button
            onClick={onOpenHistory}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition border border-slate-200 cursor-pointer"
            title="ประวัติใบเสร็จ"
          >
            <History className="w-4 h-4 text-blue-600" />
          </button>

          {currentUser?.role === 'Admin' && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition border border-slate-200 cursor-pointer"
              title="ตั้งค่าระบบ"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* User Badge */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-none">
                  {currentUser.fullName}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* LINE 2: PMS LivingOS Action Bar */}
      <div className="h-14 px-6 flex items-center justify-between">
        
        {/* Left Title & Help Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-bold text-slate-900 text-base">
            <ChevronLeft className="w-4 h-4 text-slate-500 cursor-pointer hover:text-slate-900" />
            <span>สร้างใบเสร็จรับเงิน</span>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-full cursor-pointer hover:bg-amber-100 transition">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>ดูวิธีใช้งาน</span>
          </span>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewForm}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer shadow-2xs"
          >
            สร้างใหม่
          </button>

          <button
            type="button"
            onClick={onPrint}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer shadow-2xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>พิมพ์</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-blue-500/30 transition cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>บันทึก</span>
          </button>
        </div>

      </div>

    </header>
  );
}
