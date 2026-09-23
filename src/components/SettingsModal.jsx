import React, { useState } from 'react';
import {
  Cloud,
  Save,
  Copy,
  Check,
  ChevronRight,
  Server,
  Zap,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Database,
  Layers,
  ShieldCheck,
  UploadCloud,
  Hash
} from 'lucide-react';
import {
  storageService,
  CONFIG_SHEET_ID,
  LOG_SHEET_ID,
  VOUCHER_SHEET_ID
} from '../services/storageService';
import { checkStagingHealth, DEFAULT_STAGING_API_URL } from '../services/stagingApiClient';

export default function SettingsModal() {
  const currentSettings = storageService.getSettings();
  const [apiMode, setApiMode] = useState(currentSettings.apiMode || 'production');
  const [webhookUrl, setWebhookUrl] = useState(currentSettings.webhookUrl || '');
  const [cloudflareWorkerUrl, setCloudflareWorkerUrl] = useState(currentSettings.cloudflareWorkerUrl || '');
  const [stagingApiUrl, setStagingApiUrl] = useState(currentSettings.stagingApiUrl || DEFAULT_STAGING_API_URL);
  const [enableRubberLotTrading, setEnableRubberLotTrading] = useState(currentSettings.enableRubberLotTrading || false);

  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Health check state
  const [isTesting, setIsTesting] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  // Migration & Sequence states
  const [localStats, setLocalStats] = useState(() => storageService.getLocalStats());
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  const [previewSeq, setPreviewSeq] = useState({ receipt: '', voucher: '' });
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [seedReceiptInput, setSeedReceiptInput] = useState('');
  const [seedVoucherInput, setSeedVoucherInput] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatusMessage, setSeedStatusMessage] = useState(null);

  const handleFetchPreviews = async () => {
    setIsLoadingPreview(true);
    try {
      const pR = await storageService.previewSequence('receipt', stagingApiUrl);
      const pV = await storageService.previewSequence('voucher', stagingApiUrl);
      setPreviewSeq({
        receipt: pR.nextFormattedNumber,
        voucher: pV.nextFormattedNumber
      });
    } catch (e) {
      console.warn('Failed to preview sequences:', e.message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRunMigration = async () => {
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const result = await storageService.migrateLocalStorageToD1(stagingApiUrl);
      setMigrationResult({ success: true, data: result });
      setLocalStats(storageService.getLocalStats());
      handleFetchPreviews();
    } catch (err) {
      setMigrationResult({ success: false, error: err.message });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleApplySequenceSeed = async () => {
    setIsSeeding(true);
    setSeedStatusMessage(null);
    try {
      const messages = [];
      if (seedReceiptInput && !isNaN(parseInt(seedReceiptInput, 10))) {
        const resR = await storageService.seedSequence('receipt', null, parseInt(seedReceiptInput, 10), stagingApiUrl);
        messages.push(`ใบเสร็จ: เริ่มต้นที่ ${resR.manualSeed} (ใบถัดไป: ${resR.nextFormattedNumber})`);
      }
      if (seedVoucherInput && !isNaN(parseInt(seedVoucherInput, 10))) {
        const resV = await storageService.seedSequence('voucher', null, parseInt(seedVoucherInput, 10), stagingApiUrl);
        messages.push(`ใบสำคัญจ่าย: เริ่มต้นที่ ${resV.manualSeed} (ใบถัดไป: ${resV.nextFormattedNumber})`);
      }
      if (messages.length === 0) {
        setSeedStatusMessage({ type: 'warning', text: 'กรุณาระบุตัวเลขเริ่มต้นที่ต้องการตั้งค่า' });
      } else {
        setSeedStatusMessage({ type: 'success', text: messages.join(' | ') });
        handleFetchPreviews();
        setSeedReceiptInput('');
        setSeedVoucherInput('');
      }
    } catch (err) {
      setSeedStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleTestStagingConnection = async () => {
    setIsTesting(true);
    setHealthStatus(null);
    const startTime = Date.now();
    try {
      const res = await checkStagingHealth(stagingApiUrl);
      const latency = Date.now() - startTime;
      setHealthStatus({ ...res, latency });
    } catch (err) {
      setHealthStatus({ online: false, error: err.message, latency: Date.now() - startTime });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleRubberLotTrading = (enabled) => {
    setEnableRubberLotTrading(enabled);
    const updated = {
      ...storageService.getSettings(),
      enableRubberLotTrading: enabled
    };
    storageService.saveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSelectApiMode = (mode) => {
    setApiMode(mode);
    const updated = {
      ...storageService.getSettings(),
      apiMode: mode,
      stagingApiUrl: stagingApiUrl.trim() || DEFAULT_STAGING_API_URL
    };
    storageService.saveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSave = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    storageService.saveSettings({
      ...currentSettings,
      apiMode,
      webhookUrl: webhookUrl.trim(),
      cloudflareWorkerUrl: cloudflareWorkerUrl.trim(),
      stagingApiUrl: stagingApiUrl.trim() || DEFAULT_STAGING_API_URL,
      enableRubberLotTrading
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const sampleAppsScriptCode = `// Google Apps Script Code (โปรดคัดลอกโค้ดนี้ทั้งหมดไปวางใน Apps Script)
var CONFIG_SHEET_ID = "${CONFIG_SHEET_ID}";
var LOG_SHEET_ID = "${LOG_SHEET_ID}";

function doGet(e) {
  try {
    var configSs = SpreadsheetApp.openById(CONFIG_SHEET_ID);
    var supplierSheet = configSs.getSheetByName("datasupplier");
    var suppliers = [];
    if (supplierSheet && supplierSheet.getLastRow() > 1) {
      var supVals = supplierSheet.getRange("A2:C" + supplierSheet.getLastRow()).getValues();
      suppliers = supVals.map(function(r) { 
        return { name: r[0], address: r[1], taxId: String(r[2] || '') }; 
      }).filter(function(s) { return s.name; });
    }
    
    var topSheet = configSs.getSheetByName("TOPS");
    var tops = [];
    if (topSheet && topSheet.getLastRow() > 1) {
      var topVals = topSheet.getRange("A2:B" + topSheet.getLastRow()).getValues();
      tops = topVals.map(function(r) { 
        var name = String(r[0] || '').trim();
        var code = String(r[1] || '').trim();
        return { name: name, code: code, formatted: code ? (code + ":" + name) : name }; 
      }).filter(function(t) { return t.name || t.code; });
    }

    var paymentSheet = configSs.getSheetByName("Payment");
    var payments = [];
    if (paymentSheet && paymentSheet.getLastRow() >= 1) {
      payments = paymentSheet.getRange("A1:A" + paymentSheet.getLastRow()).getValues().map(function(r) { return r[0]; }).filter(Boolean);
    }

    var bankSheet = configSs.getSheetByName("Bankacc") || configSs.getSheetByName("Bank");
    var banks = [];
    if (bankSheet && bankSheet.getLastRow() > 1) {
      banks = bankSheet.getRange("A2:B" + bankSheet.getLastRow()).getValues().map(function(r) { 
        var name = String(r[0] || '').trim();
        var num = String(r[1] || '').trim();
        return (name && num) ? (name + " " + num) : (name || num);
      }).filter(Boolean);
    }

    var gmailSheet = configSs.getSheetByName("gmail") || configSs.getSheetByName("Gmail");
    var users = [];
    if (gmailSheet && gmailSheet.getLastRow() >= 1) {
      var gmailVals = gmailSheet.getRange("A1:E" + gmailSheet.getLastRow()).getValues();
      var startIdx = (String(gmailVals[0][0]).includes("ชื่อ") || String(gmailVals[0][3]).includes("Gmail")) ? 1 : 0;
      for (var u = startIdx; u < gmailVals.length; u++) {
        var r = gmailVals[u];
        if (r[3]) {
          users.push({
            firstName: String(r[0] || '').trim(),
            lastName: String(r[1] || '').trim(),
            role: String(r[2] || 'User').trim(),
            email: String(r[3] || '').trim().toLowerCase(),
            status: String(r[4] || 'Approved').trim()
          });
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success", suppliers: suppliers, tops: tops, payments: payments, banks: banks, users: users
    })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(sampleAppsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F6FA] text-slate-800 no-print overflow-hidden">
      
      {/* Workspace Header & Action Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
            <span>จัดการระบบ</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-blue-600 font-semibold">ตั้งค่า</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-bold">โหมดระบบ & การเชื่อมต่อ</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              ตั้งค่าระบบหลังบ้าน (Backend Engine) & การเชื่อมต่อ
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer self-end md:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>บันทึกการตั้งค่า</span>
        </button>
      </div>

      {/* Main Content Workspace */}
      <div className="flex-1 p-4 md:p-6 flex flex-col gap-6 max-w-4xl overflow-y-auto min-h-0 custom-scrollbar">
        
        {savedSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs flex items-center gap-2 font-medium shadow-2xs animate-in fade-in duration-200">
            <Check className="w-4 h-4" />
            <span>บันทึกการตั้งค่าระบบเรียบร้อยแล้ว! การเปลี่ยนแปลงมีผลทันที</span>
          </div>
        )}

        {/* 1. BACKEND ENGINE SELECTOR (Production vs Staging 5.0) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>เลือกระบบเครื่องยนต์หลังบ้าน (Backend Engine Mode)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือกสลับระหว่างระบบ Production เดิม หรือระบบ Staging Edge 5.0 เพื่อทดสอบระบบใหม่ได้แบบปลอดภัย Zero-Risk
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              apiMode === 'staging'
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}>
              {apiMode === 'staging' ? '⚡ Staging Mode Active' : '🟢 Production Mode Active'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Option 1: Production Mode */}
            <label
              className={`relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition ${
                apiMode === 'production'
                  ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold text-slate-900">🟢 Production Mode (เดิม)</span>
                </div>
                <input
                  type="radio"
                  name="apiMode"
                  value="production"
                  checked={apiMode === 'production'}
                  onChange={() => handleSelectApiMode('production')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                ส่งข้อมูลตรงเข้า Google Sheets ผ่าน Google Apps Script Webhook และ Cloudflare Proxy เดิม เสถียรและเหมาะสำหรับการใช้งานจริงประจำวัน
              </p>
            </label>

            {/* Option 2: Staging Mode */}
            <label
              className={`relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition ${
                apiMode === 'staging'
                  ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900">⚡ Staging Mode (Edge D1 5.0)</span>
                </div>
                <input
                  type="radio"
                  name="apiMode"
                  value="staging"
                  checked={apiMode === 'staging'}
                  onChange={() => handleSelectApiMode('staging')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                เชื่อมต่อระบบใหม่: Cloudflare Worker + Cloudflare D1 SQL + Idempotency Guard (ป้องกันบันทึกซ้ำ) + DRC Engine + Hash-Chained Audit Trail
              </p>
            </label>
          </div>
        </div>

        {/* 2. STAGING SETTINGS & HEALTH CHECK */}
        <div className={`bg-white border rounded-2xl p-5 shadow-2xs space-y-4 transition ${
          apiMode === 'staging' ? 'border-blue-300 ring-2 ring-blue-500/10' : 'border-slate-200 opacity-90'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-800">
                การตั้งค่า Staging Worker API (Cloudflare Worker + D1)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Default: http://localhost:8787
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Staging API Base URL (ปลายทางสำหรับเชื่อมต่อระบบทดสอบ 5.0)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={stagingApiUrl}
                  onChange={(e) => setStagingApiUrl(e.target.value)}
                  placeholder={DEFAULT_STAGING_API_URL}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleTestStagingConnection}
                  disabled={isTesting}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'กำลังทดสอบ...' : 'ทดสอบเชื่อมต่อ (Test Connection)'}</span>
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px]">
                <span className="text-slate-400 font-medium">สลับเซิร์ฟเวอร์ด่วน:</span>
                <button
                  type="button"
                  onClick={() => setStagingApiUrl(DEFAULT_STAGING_API_URL)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    stagingApiUrl === DEFAULT_STAGING_API_URL
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>☁️ Cloudflare D1 (Cloud แนะนำ)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStagingApiUrl('http://127.0.0.1:8787')}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    stagingApiUrl.includes('8787')
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>💻 Local SQLite Server (8787)</span>
                </button>
              </div>
            </div>

            {/* Health Status Box */}
            {healthStatus && (
              <div className={`p-4 rounded-xl border text-xs space-y-1.5 transition ${
                healthStatus.online
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm">
                  {healthStatus.online ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>เชื่อมต่อ Staging Backend สำเร็จ! (Online)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>ไม่สามารถเชื่อมต่อ Staging Backend ได้ (Offline)</span>
                    </>
                  )}
                </div>
                
                {healthStatus.online ? (
                  <div className="space-y-1 text-[11.5px] text-emerald-800 pt-1">
                    <p>• บริการ: <strong>{healthStatus.data?.service || 'receipt-rubber-backend'}</strong> (v{healthStatus.data?.version || '5.0.0'})</p>
                    <p>• ฐานข้อมูล: <strong>{healthStatus.data?.database || 'D1 Database Connected'}</strong></p>
                    <p>• ความเร็วตอบสนอง (Latency): <strong>{healthStatus.latency} ms</strong></p>
                    <p>• วันเวลาเซิร์ฟเวอร์: <span className="font-mono">{healthStatus.data?.timestamp || new Date().toISOString()}</span></p>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11.5px] text-rose-800 pt-1">
                    <p>• ข้อความผิดพลาด: <span className="font-mono">{healthStatus.error || 'Connection Refused'}</span></p>
                    <p>• คำแนะนำ: ตรวจสอบว่าได้รันคำสั่ง <code className="bg-rose-100 px-1.5 py-0.5 rounded font-mono">npm run staging:server</code> ใน Terminal แล้วหรือไม่ หรือลองเปลี่ยนเป็น <code className="bg-rose-100 px-1.5 py-0.5 rounded font-mono">http://127.0.0.1:8787</code></p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2.1 DATA MIGRATION & SEQUENCE CONTROL (เมื่อใช้งานโหมด Staging D1) */}
        {apiMode === 'staging' && (
          <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  เครื่องมือนำเข้าข้อมูลประวัติ & จัดการลำดับเลขที่เอกสาร (D1 Database)
                </h3>
              </div>
              <span className="px-2 py-0.5 text-[10.5px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Single Source of Truth
              </span>
            </div>

            {/* A. ข้อมูลในเครื่อง & ปุ่มนำเข้า */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">1. นำเข้าข้อมูลจากเครื่องนี้เข้าสู่ Cloudflare D1 Database</h4>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">
                    นำเข้าประวัติใบเสร็จและใบสำคัญจ่ายที่เคยบันทึกไว้ในเบราว์เซอร์นี้เข้าสู่ฐานข้อมูล D1 (ระบบจะข้ามรายการที่มีอยู่แล้วอัตโนมัติ ไม่สร้างบิลซ้ำ)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold">ใบเสร็จในเครื่อง</div>
                  <div className="text-base font-extrabold text-emerald-700">{localStats.receiptCount} <span className="text-xs font-normal">ใบ</span></div>
                  <div className="text-[9.5px] text-slate-400 font-mono truncate">ล่าสุด: {localStats.latestReceiptNo}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold">ใบสำคัญจ่ายในเครื่อง</div>
                  <div className="text-base font-extrabold text-rose-700">{localStats.voucherCount} <span className="text-xs font-normal">ใบ</span></div>
                  <div className="text-[9.5px] text-slate-400 font-mono truncate">ล่าสุด: {localStats.latestVoucherNo}</div>
                </div>
                <div className="col-span-2 flex items-center">
                  <button
                    type="button"
                    onClick={handleRunMigration}
                    disabled={isMigrating || (localStats.receiptCount === 0 && localStats.voucherCount === 0)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <UploadCloud className={`w-4 h-4 ${isMigrating ? 'animate-bounce' : ''}`} />
                    <span>{isMigrating ? 'กำลังนำเข้าข้อมูล...' : '🚀 นำเข้าข้อมูลประวัติเข้าสู่ Database'}</span>
                  </button>
                </div>
              </div>

              {migrationResult && (
                <div className={`p-3 rounded-lg border text-xs ${
                  migrationResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  {migrationResult.success ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">{migrationResult.data?.message || 'นำเข้าข้อมูลสำเร็จ'}</div>
                        <div className="text-[11px] text-emerald-700 mt-0.5">
                          ระบบได้ปรับลำดับเลขที่เอกสารล่าสุดให้อัตโนมัติ เพื่อให้ออกบิลใบถัดไปได้ต่อเนื่องทันที
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">เกิดข้อผิดพลาดในการนำเข้า</div>
                        <div className="text-[11px] text-rose-700 mt-0.5">{migrationResult.error}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* B. ตัวอย่างและตั้งค่าลำดับเลขที่เอกสาร */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">2. ตั้งค่าและตรวจสอบลำดับเลขที่เอกสาร (Sequence Seed)</h4>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">
                    กำหนดเลขที่เริ่มต้นของเดือนปัจจุบัน (YYMM) เพื่อให้ระบบรันเลขบิลต่อจากเล่มเอกสารกระดาษ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFetchPreviews}
                  disabled={isLoadingPreview}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                  <span>ตรวจสอบเลขถัดไป</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* ใบเสร็จรับเงิน */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-emerald-600" />
                      ใบเสร็จรับเงิน (Receipt)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ถัดไป: <strong>{previewSeq.receipt || 'รอตรวจสอบ'}</strong>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="เช่น 43 (เพื่อเริ่มที่ 69090043)"
                      value={seedReceiptInput}
                      onChange={(e) => setSeedReceiptInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* ใบสำคัญจ่าย */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-rose-600" />
                      ใบสำคัญจ่าย (Voucher)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ถัดไป: <strong>{previewSeq.voucher || 'รอตรวจสอบ'}</strong>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="เช่น 15 (เพื่อเริ่มที่ 69090015)"
                      value={seedVoucherInput}
                      onChange={(e) => setSeedVoucherInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">
                  * ระบบจะไม่ยอมให้ตั้งค่าย้อนกลับไปต่ำกว่าเลขที่เคยออกไปแล้วเพื่อความถูกต้องของบัญชี
                </span>
                <button
                  type="button"
                  onClick={handleApplySequenceSeed}
                  disabled={isSeeding || (!seedReceiptInput && !seedVoucherInput)}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-40"
                >
                  {isSeeding ? 'กำลังบันทึก...' : 'บันทึกเลขเริ่มต้น'}
                </button>
              </div>

              {seedStatusMessage && (
                <div className={`p-3 rounded-lg border text-xs ${
                  seedStatusMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  {seedStatusMessage.text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2.5 FEATURE FLAGS (โมดูลเสริม & ระบบซื้อขาย Lot ยางพารา Phase 2) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-800">
                ระบบโมดูลเสริมและระบบทดลอง (Feature Flags - Phase 2)
              </h3>
            </div>
            <span className="px-2 py-0.5 text-[10.5px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Enterprise 5.0
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-xs">
                  ระบบซื้อขายและจัดการ Lot ยางพารา (Rubber Lot Trading Engine)
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  enableRubberLotTrading 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {enableRubberLotTrading ? 'เปิดใช้งาน (Active)' : 'ปิดอยู่ (Disabled)'}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 leading-relaxed">
                เปิดหน้าจอระบบจัดการ Lot ยางพารา 5 แท็บ (ภาพรวม Dashboard, บันทึกใบชั่งซื้อหน้าลาน PB-, รวมกลุ่มจัด Lot, สร้างบิลส่งขายโรงงาน SL-, และบันทึกผลแล็บ DRC สรุปกำไร-ขาดทุนสุทธิ)
              </p>
              <p className="text-[10.5px] text-slate-400">
                * ปิดไว้เป็นค่าเริ่มต้น (Default: OFF) เพื่อรับประกันความปลอดภัยและไม่กระทบหน้าใบเสร็จ/ใบสำคัญจ่ายเดิม 100%
              </p>
            </div>

            <div className="flex items-center shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={enableRubberLotTrading}
                onClick={() => handleToggleRubberLotTrading(!enableRubberLotTrading)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                  enableRubberLotTrading ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    enableRubberLotTrading ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 3. PRODUCTION URL SETTINGS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Cloud className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800">
              การตั้งค่า Production Webhook & Cloudflare Proxy
            </h3>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Apps Script Web App URL (GAS Webhook สำหรับรับข้อมูลใบเสร็จ/ใบสำคัญจ่าย)
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                ระบุ URL เพื่อส่งข้อมูลใบเสร็จที่บันทึกเข้าไปยัง Google Sheet แบบ Realtime
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Cloudflare Worker URL (Production Proxy)
              </label>
              <input
                type="url"
                value={cloudflareWorkerUrl}
                onChange={(e) => setCloudflareWorkerUrl(e.target.value)}
                placeholder="https://receipt-backend-worker.beemcr73327.workers.dev/"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Bound Sheet IDs Info */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-[11.5px] text-slate-600">
              <div className="font-bold text-slate-800 text-xs">📌 Google Sheet IDs ที่ผูกไว้ในระบบ:</div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>ไฟล์ Config (`datasupplier`, `TOPS`):</span>
                <code className="bg-white px-2 py-0.5 border border-slate-200 rounded text-blue-700 font-mono select-all text-xs">{CONFIG_SHEET_ID}</code>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>ไฟล์เก็บบันทึกประวัติใบเสร็จ (`Receipts`):</span>
                <code className="bg-white px-2 py-0.5 border border-slate-200 rounded text-blue-700 font-mono select-all text-xs">{LOG_SHEET_ID}</code>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>ไฟล์เก็บบันทึกประวัติใบสำคัญจ่าย (`Vouchers`):</span>
                <code className="bg-white px-2 py-0.5 border border-slate-200 rounded text-blue-700 font-mono select-all text-xs">{VOUCHER_SHEET_ID}</code>
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการตั้งค่าทั้งหมด</span>
            </button>
          </form>
        </div>

        {/* 4. Apps Script Sample Code Guide */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold text-slate-800">
              โค้ดตัวอย่าง Google Apps Script (สำหรับวางใน Apps Script ของ Sheet)
            </h3>
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}</span>
            </button>
          </div>

          <pre className="bg-slate-900 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto border border-slate-800 max-h-56">
            {sampleAppsScriptCode}
          </pre>
        </div>

      </div>

    </div>
  );
}
