import React, { useState } from 'react';
import { Cloud, Save, Copy, Check, ChevronRight } from 'lucide-react';
import { storageService, CONFIG_SHEET_ID, LOG_SHEET_ID } from '../services/storageService';

export default function SettingsModal() {
  const settings = storageService.getSettings();
  const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl || '');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    storageService.saveSettings({
      ...settings,
      webhookUrl: webhookUrl.trim()
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
            <span className="text-slate-900 font-bold">การเชื่อมต่อ Google Sheet</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 leading-tight">ตั้งค่าการเชื่อมต่อ Google Sheet & Cloudflare</h2>
          </div>
        </div>
      </div>

      {/* Main Content Workspace */}
      <div className="flex-1 p-4 md:p-6 flex flex-col gap-6 max-w-4xl overflow-y-auto min-h-0 custom-scrollbar">
        
        {savedSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs flex items-center gap-2 font-medium shadow-2xs">
            <Check className="w-4 h-4" />
            <span>บันทึกการตั้งค่าสำเร็จ!</span>
          </div>
        )}

        {/* Bound Sheet IDs Info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 text-xs">
          <div className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">📌 Google Sheet IDs ที่ผูกไว้ในระบบ:</div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-600">
            <span>ไฟล์ Config (`datasupplier`, `TOPS`):</span>
            <code className="bg-slate-50 px-2.5 py-1 border border-slate-200 rounded-lg text-blue-700 font-mono select-all">{CONFIG_SHEET_ID}</code>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-600">
            <span>ไฟล์เก็บบันทึกประวัติ (`Receipts`):</span>
            <code className="bg-slate-50 px-2.5 py-1 border border-slate-200 rounded-lg text-blue-700 font-mono select-all">{LOG_SHEET_ID}</code>
          </div>
        </div>

        {/* Webhook Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Apps Script Web App URL / Cloudflare Worker API URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                ระบุ URL เพื่อส่งข้อมูลใบเสร็จที่บันทึกเข้าไปยัง Google Sheet แบบ Realtime
              </p>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการตั้งค่า</span>
            </button>
          </form>
        </div>

        {/* Guide section */}
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

          <pre className="bg-slate-900 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto border border-slate-800 max-h-64">
            {sampleAppsScriptCode}
          </pre>
        </div>

      </div>

    </div>
  );
}
