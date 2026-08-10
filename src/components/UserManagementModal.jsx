import React, { useState } from 'react';
import { UserCheck, UserX, Shield, Search, ChevronRight } from 'lucide-react';
import { storageService } from '../services/storageService';

export default function UserManagementModal() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState(storageService.getUserProfiles());

  React.useEffect(() => {
    setLoading(true);
    storageService.fetchConfigFromGoogleSheets().then(() => {
      setProfiles(storageService.getUserProfiles());
      setLoading(false);
    });
  }, []);

  const usersList = Object.values(profiles);

  const filteredUsers = usersList.filter(u => {
    const q = searchTerm.toLowerCase();
    const fullName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return (
      (fullName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  const handleStatusChange = async (email, currentRole, newStatus) => {
    setLoading(true);
    await storageService.updateUserStatus(email, currentRole, newStatus);
    await storageService.fetchConfigFromGoogleSheets();
    setProfiles(storageService.getUserProfiles());
    setLoading(false);
  };

  const handleRoleChange = async (email, newRole, currentStatus) => {
    setLoading(true);
    await storageService.updateUserStatus(email, newRole, currentStatus);
    await storageService.fetchConfigFromGoogleSheets();
    setProfiles(storageService.getUserProfiles());
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F6FA] text-slate-800 no-print overflow-hidden">
      
      {/* Workspace Header & Action Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
            <span>จัดการระบบ</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-blue-600 font-semibold">ผู้ใช้งาน</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-bold">จัดการผู้ใช้งานระบบ</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">จัดการผู้ใช้งานระบบ</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Workspace */}
      <div className="flex-1 p-4 md:p-6 flex flex-col gap-4 overflow-hidden min-h-0">
        
        {/* Search & Table Card Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col flex-1 min-h-0 overflow-hidden relative">
          
          {/* Search Bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาตามชื่อ หรือ อีเมล..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                disabled={loading}
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0 custom-scrollbar relative">
            {loading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                 <div className="text-blue-600 font-bold text-sm bg-white px-4 py-2 rounded-xl shadow-lg border border-blue-100 animate-pulse">
                    กำลังอัปเดตข้อมูล...
                 </div>
              </div>
            )}
            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                ไม่พบรายชื่อผู้ใช้งาน
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase bg-slate-50">
                      <th className="py-3 px-3">ชื่อ-นามสกุล</th>
                      <th className="py-3 px-3">อีเมล (Gmail)</th>
                      <th className="py-3 px-3 text-center">ระดับสิทธิ์ (Role)</th>
                      <th className="py-3 px-3 text-center">สถานะ (Status)</th>
                      <th className="py-3 px-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u, idx) => {
                      const fullName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim();
                      const status = u.status || 'Approved';
                      const role = u.role || 'User';
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-3 text-slate-800 font-bold whitespace-nowrap">
                            {fullName}
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-medium">
                            {u.email}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <select
                              value={role}
                              onChange={(e) => handleRoleChange(u.email, e.target.value, status)}
                              className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2 py-1 focus:ring-blue-500 focus:border-blue-500 font-semibold cursor-pointer"
                              disabled={loading}
                            >
                              <option value="Admin">Admin</option>
                              <option value="User">User</option>
                            </select>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {status === 'Pending' && <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[11px]">รออนุมัติ</span>}
                            {status === 'Approved' && <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px]">ใช้งานได้</span>}
                            {status === 'Blocked' && <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[11px]">ระงับการใช้งาน</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {status !== 'Approved' && (
                                  <button
                                    onClick={() => handleStatusChange(u.email, role, 'Approved')}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition border border-emerald-200 cursor-pointer"
                                    title="อนุมัติ"
                                    disabled={loading}
                                  >
                                    <UserCheck className="w-4 h-4" />
                                  </button>
                              )}
                              {status !== 'Blocked' && (
                                  <button
                                    onClick={() => handleStatusChange(u.email, role, 'Blocked')}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition border border-rose-200 cursor-pointer"
                                    title="ระงับบัญชี"
                                    disabled={loading}
                                  >
                                    <UserX className="w-4 h-4" />
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
    </div>
  );
}
