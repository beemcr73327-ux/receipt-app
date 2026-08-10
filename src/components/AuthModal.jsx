import React, { useState } from 'react';
import { LogIn, UserCheck, ShieldCheck, Mail, User, Settings, Lock } from 'lucide-react';
import { storageService } from '../services/storageService';

export default function AuthModal({ currentUser, onLoginSuccess, onOpenSettings }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (!currentUser) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [currentUser]);

  const handleSimulatedGoogleLogin = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    if (!password) {
      setError('กรุณากรอกรหัสผ่าน');
      return;
    }
    setError('');
    setIsLoading(true);
    
    const normalizedEmail = email.trim().toLowerCase();

    console.group('🔐 [Login] เริ่มกระบวนการเข้าสู่ระบบ:', normalizedEmail);
    const loginResult = await storageService.loginWithPassword(normalizedEmail, password);
    console.log('📡 [Login] result:', loginResult);
    console.groupEnd();

    setIsLoading(false);

    if (loginResult.success) {
      onLoginSuccess(loginResult.user);
    } else {
      if (loginResult.message === 'ไม่พบอีเมลนี้ในระบบ') {
        setStep(2);
      } else {
        setError(loginResult.message);
      }
    }
  };

  const handleRegisterName = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
      setError('กรุณากรอกชื่อจริง และนามสกุล ให้ครบถ้วน (เช่น สมชาย ใจดี)');
      return;
    }

    const [fName, ...lNameArr] = fullName.trim().split(' ');
    const lName = lNameArr.join(' ');

    const cleanEmail = email.trim().toLowerCase();

    const newUser = {
      email: cleanEmail,
      firstName: fName,
      lastName: lName,
      fullName: fullName.trim(),
      role: 'User',
      status: 'Pending',
      registeredAt: new Date().toISOString()
    };

    // Save locally to cache immediately for instant local reflection
    const profiles = storageService.getUserProfiles();
    profiles[cleanEmail] = newUser;
    localStorage.setItem('receipt_user_profiles', JSON.stringify(profiles));

    await storageService.registerUser(newUser);
    setError('ลงทะเบียนสำเร็จ! กรุณารอ Admin อนุมัติการเข้าใช้งาน');
    
    // Go back to step 1 with email prefilled so they can see the status error message directly
    setStep(1);
    setEmail(cleanEmail);
    setFullName('');
  };

  if (currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        
        <div className="text-center mb-6 mt-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-3 shadow-md shadow-blue-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">เข้าสู่ระบบออกใบเสร็จ</h2>
          <p className="text-xs text-slate-500 mt-1">บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSimulatedGoogleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                อีเมล (Email)
              </label>
              <div className="relative mb-3">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.name@gmail.com"
                  required
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                />
              </div>

              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</span>
            </button>

            <p className="text-[11px] text-center text-slate-400 mt-3">
              * เข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ Admin กำหนดให้
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegisterName} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs mb-3 font-medium">
              ยินดีต้อนรับ! กรุณายืนยันชื่อจริง-นามสกุล เพื่อใช้แสดงเป็น <b>"ผู้รับเงิน"</b> ในใบเสร็จรับเงิน
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                อีเมล Gmail
              </label>
              <input
                type="text"
                value={email}
                disabled
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อจริง และ นามสกุล <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="เช่น นายสมชาย ใจดี"
                  required
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                className="w-2/3 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>ยืนยันและเริ่มใช้งาน</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
