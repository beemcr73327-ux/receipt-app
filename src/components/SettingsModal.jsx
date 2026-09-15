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
  ShieldCheck
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

  const handleSave = (e) => {
    e.preventDefault();
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
                  onChange={() => setApiMode('production')}
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
                  onChange={() => setApiMode('staging')}
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
                  placeholder="http://localhost:8787"
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
                    <p>• คำแนะนำ: ตรวจสอบว่าได้รันคำสั่ง <code className="bg-rose-100 px-1.5 py-0.5 rounded font-mono">npm run dev</code> ในโฟลเดอร์ <code className="bg-rose-100 px-1.5 py-0.5 rounded font-mono">backend-staging</code> แล้วหรือไม่</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
