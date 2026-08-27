import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import ReceiptForm from './components/ReceiptForm';
import PrintReceipt, { openPrintInNewTab } from './components/PrintReceipt';
import ReceiptHistoryModal from './components/ReceiptHistoryModal';
import VoucherForm from './components/VoucherForm';
import PrintVoucher, { openVoucherPrintDialog } from './components/PrintVoucher';
import VoucherHistoryModal from './components/VoucherHistoryModal';
import SettingsModal from './components/SettingsModal';
import UserManagementModal from './components/UserManagementModal';
import BankAccountManagement from './components/BankAccountManagement';
import { storageService } from './services/storageService';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Navigation Active Page ('history' | 'create_receipt' | 'voucher_history' | 'create_voucher' | 'user_management' | 'settings')
  const [activePage, setActivePage] = useState('history');
  
  // Selected receipt / voucher for viewing details in read-only mode
  const [viewReceiptData, setViewReceiptData] = useState(null);
  const [viewVoucherData, setViewVoucherData] = useState(null);
  
  // Print Payload Data & Active Type ('receipt' | 'voucher')
  const [printReceiptData, setPrintReceiptData] = useState(null);
  const [printVoucherData, setPrintVoucherData] = useState(null);
  const [activePrintType, setActivePrintType] = useState('receipt');

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Dirty Form Navigation Guard State
  const [pendingTarget, setPendingTarget] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const receiptFormRef = useRef(null);
  const voucherFormRef = useRef(null);

  useEffect(() => {
    // Initial mount: load current user from storage
    const initialUser = storageService.getCurrentUser();
    if (initialUser && !currentUser) {
      setCurrentUser(initialUser);
    }

    let intervalId;
    
    const checkUserStatus = async () => {
      if (currentUser) {
        // Fetch live config options from Google Sheets
        const fetchResult = await storageService.fetchConfigFromGoogleSheets();
        
        let profiles;
        if (fetchResult.success && fetchResult.users) {
          profiles = fetchResult.users;
        } else {
          profiles = storageService.getUserProfiles();
        }
        const updatedUser = profiles[currentUser.email.toLowerCase()];
        
        if (updatedUser) {
          if (updatedUser.status === 'Blocked') {
            handleLogout();
            alert('บัญชีของคุณถูกระงับการใช้งานโดย Admin');
            return;
          }

          if (updatedUser.role !== currentUser.role || updatedUser.status !== currentUser.status) {
            storageService.setCurrentUser(updatedUser);
            setCurrentUser(updatedUser);
          }
        }
        
        setRefreshTrigger(prev => prev + 1);
      } else {
        await storageService.fetchConfigFromGoogleSheets();
      }
    };

    checkUserStatus();

    intervalId = setInterval(checkUserStatus, 30000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentUser]);

  const handleLogout = () => {
    storageService.setCurrentUser(null);
    setCurrentUser(null);
    setActivePage('history');
    setViewReceiptData(null);
    setViewVoucherData(null);
  };

  const isFormDirty = () => {
    if (activePage === 'create_receipt' && receiptFormRef.current?.getIsDirty) {
      return receiptFormRef.current.getIsDirty();
    }
    if (activePage === 'create_voucher' && voucherFormRef.current?.getIsDirty) {
      return voucherFormRef.current.getIsDirty();
    }
    return false;
  };

  const handleSafeNavigate = (targetPageKey) => {
    if (targetPageKey === activePage && activePage !== 'create_receipt' && activePage !== 'create_voucher') return;
    if (isFormDirty()) {
      setPendingTarget({ type: 'navigate', pageKey: targetPageKey });
      setShowLeaveModal(true);
    } else {
      if (targetPageKey === 'create_receipt') {
        setViewReceiptData(null);
      }
      if (targetPageKey === 'create_voucher') {
        setViewVoucherData(null);
      }
      setActivePage(targetPageKey);
    }
  };

  const handleSafeLogout = () => {
    if (isFormDirty()) {
      setPendingTarget({ type: 'logout' });
      setShowLeaveModal(true);
    } else {
      handleLogout();
    }
  };

  const handleReqNewForm = () => {
    if (isFormDirty()) {
      setPendingTarget({ type: 'new_form' });
      setShowLeaveModal(true);
    } else {
      if (activePage === 'create_receipt') {
        receiptFormRef.current?.handleNewFormDirect?.();
      } else if (activePage === 'create_voucher') {
        voucherFormRef.current?.handleNewFormDirect?.();
      }
    }
  };

  const confirmLeaveAndNavigate = () => {
    setShowLeaveModal(false);
    if (!pendingTarget) return;

    if (pendingTarget.type === 'navigate') {
      if (pendingTarget.pageKey === 'create_receipt') {
        setViewReceiptData(null);
        receiptFormRef.current?.handleNewFormDirect?.();
      } else if (pendingTarget.pageKey === 'create_voucher') {
        setViewVoucherData(null);
        voucherFormRef.current?.handleNewFormDirect?.();
      }
      setActivePage(pendingTarget.pageKey);
    } else if (pendingTarget.type === 'logout') {
      handleLogout();
    } else if (pendingTarget.type === 'new_form') {
      if (activePage === 'create_receipt') {
        setViewReceiptData(null);
        receiptFormRef.current?.handleNewFormDirect?.();
      } else if (activePage === 'create_voucher') {
        setViewVoucherData(null);
        voucherFormRef.current?.handleNewFormDirect?.();
      }
    }
    setPendingTarget(null);
  };

  const handleReceiptSelectForPrint = (receiptRecord) => {
    flushSync(() => {
      setActivePrintType('receipt');
      setPrintReceiptData(receiptRecord);
    });
    openPrintInNewTab(receiptRecord);
  };

  const handleVoucherSelectForPrint = (voucherRecord) => {
    flushSync(() => {
      setActivePrintType('voucher');
      setPrintVoucherData(voucherRecord);
    });
    openVoucherPrintDialog(voucherRecord);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F5F6FA] text-slate-800 font-sans antialiased flex flex-col">

      {/* Authentication Modal (Google Login + Register Name) */}
      {!currentUser && (
        <AuthModal
          currentUser={currentUser}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setActivePage('history');
            setViewReceiptData(null);
            setViewVoucherData(null);
          }}
        />
      )}

      {/* Logged in Application Layout */}
      {currentUser && (
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Column: Sidebar Accordion Tree Menu */}
          <Sidebar
            currentUser={currentUser}
            activePage={activePage}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onNavigate={(pageKey) => handleSafeNavigate(pageKey)}
            onLogout={handleSafeLogout}
          />

          {/* Right Column: Main Content Workspace (Full-page Views) */}
          <main className="flex-1 overflow-hidden h-full bg-[#F5F6FA]">
            {activePage === 'create_receipt' && (
              <ReceiptForm
                ref={receiptFormRef}
                currentUser={currentUser}
                viewReceiptData={viewReceiptData}
                refreshTrigger={refreshTrigger}
                onSaveSuccess={(savedData) => {
                  setActivePrintType('receipt');
                  setPrintReceiptData(savedData);
                  setRefreshTrigger(prev => prev + 1);
                }}
                onPrintTrigger={(payloadData) => {
                  flushSync(() => {
                    setActivePrintType('receipt');
                    setPrintReceiptData(payloadData);
                  });
                  openPrintInNewTab(payloadData);
                }}
                onBackToHistory={() => handleSafeNavigate('history')}
                onClearViewData={() => setViewReceiptData(null)}
                onReqNewForm={handleReqNewForm}
              />
            )}

            {activePage === 'history' && (
              <ReceiptHistoryModal
                onCreateNewReceipt={() => handleSafeNavigate('create_receipt')}
                onViewReceiptDetails={(record) => {
                  setViewReceiptData(record);
                  setActivePage('create_receipt');
                }}
                onSelectReceipt={handleReceiptSelectForPrint}
                onRefresh={() => setRefreshTrigger(prev => prev + 1)}
              />
            )}

            {activePage === 'create_voucher' && (
              <VoucherForm
                ref={voucherFormRef}
                currentUser={currentUser}
                viewVoucherData={viewVoucherData}
                refreshTrigger={refreshTrigger}
                onSaveSuccess={(savedData) => {
                  setActivePrintType('voucher');
                  setPrintVoucherData(savedData);
                  setRefreshTrigger(prev => prev + 1);
                }}
                onPrintTrigger={(payloadData) => {
                  flushSync(() => {
                    setActivePrintType('voucher');
                    setPrintVoucherData(payloadData);
                  });
                  openVoucherPrintDialog(payloadData);
                }}
                onBackToHistory={() => handleSafeNavigate('voucher_history')}
                onClearViewData={() => setViewVoucherData(null)}
                onReqNewForm={handleReqNewForm}
              />
            )}

            {activePage === 'voucher_history' && (
              <VoucherHistoryModal
                onCreateNewVoucher={() => handleSafeNavigate('create_voucher')}
                onViewVoucherDetails={(record) => {
                  setViewVoucherData(record);
                  setActivePage('create_voucher');
                }}
                onSelectVoucher={handleVoucherSelectForPrint}
                onRefresh={() => setRefreshTrigger(prev => prev + 1)}
              />
            )}

            {activePage === 'bank_account_rc' && (
              <BankAccountManagement mode="rc" />
            )}

            {activePage === 'bank_account_pv' && (
              <BankAccountManagement mode="pv" />
            )}

            {activePage === 'user_management' && (
              <UserManagementModal />
            )}

            {activePage === 'settings' && (
              <SettingsModal />
            )}
          </main>

        </div>
      )}

      {/* Dirty Form Warning / Leave Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5 text-amber-600 mb-3">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">คุณมีข้อมูลที่ยังไม่ได้บันทึก</h3>
                <p className="text-xs text-slate-500 font-medium">โปรดตรวจสอบก่อนเปลี่ยนหน้า</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              คุณกำลังกรอกเอกสารและมีข้อมูลที่ยังไม่ได้กดบันทึก หากคุณสลับหน้าไปหน้าอื่นหรือสร้างใหม่ ข้อมูลที่คุณกรอกไว้จะสูญหาย
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                ทำรายการต่อ
              </button>
              <button
                type="button"
                onClick={confirmLeaveAndNavigate}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-500/20 cursor-pointer"
              >
                ยืนยันละทิ้งข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Container (ONLY visible when window.print() is called) */}
      <div className="print-only">
        {activePrintType === 'receipt' && <PrintReceipt receiptData={printReceiptData} />}
        {activePrintType === 'voucher' && <PrintVoucher voucherData={printVoucherData} />}
      </div>

    </div>
  );
}

