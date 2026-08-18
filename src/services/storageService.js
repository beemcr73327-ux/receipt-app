/**
 * Storage Service
 * Manages configuration lists, receipts log, running numbers, user profiles,
 * and handles syncing with Google Sheets / Cloudflare Worker API.
 */

import { getThaiYearMonthPrefix, formatThaiDate, formatThaiDateTime, getTodayISO } from '../utils/dateUtils';

const KEYS = {
  SUPPLIERS: 'receipt_config_suppliers',
  TOPS: 'receipt_config_tops',
  PAYMENTS: 'receipt_config_payments',
  BANKS: 'receipt_config_banks',
  VOUCHER_BANKS: 'voucher_config_banks',
  SOURCE_BANKS: 'voucher_config_source_banks',
  DEST_BANKS: 'voucher_config_dest_banks',
  RECEIVERS: 'voucher_config_receivers',
  USERS: 'receipt_user_profiles',
  CURRENT_USER: 'receipt_current_user',
  RECEIPTS: 'receipt_log_records',
  VOUCHERS: 'voucher_log_records',
  SETTINGS: 'receipt_app_settings'
};

// User's provided Sheet IDs
export const CONFIG_SHEET_ID = "1FiWYtzhqsO_7TJ222INNWI8QsgXVJ7lWv83S3bfY7qM";
export const LOG_SHEET_ID = "1YE4F8WjWT13R_aMOYVmR2NuhaA6FE8ua1cKsdMlttwk";
export const VOUCHER_SHEET_ID = "1EjB8pdeRTlvu5q9YqltYPfHauy2CLxSWaowkz49zORk";

const DEFAULT_RECEIVERS = [
  { name: 'บริษัท ยางพาราไทย จำกัด', address: '164 หมู่ที่ 1 ถนนตรัง-สิเกา ตำบลนาเมืองเพชร อำเภอสิเกา จังหวัดตรัง', taxId: '0925549000221' },
  { name: 'บริษัท นอร์ทอีส รับเบอร์ จำกัด (มหาชน)', address: '398 หมู่ 4 ตำบลโคกม้า อำเภอประโคนชัย จังหวัดบุรีรัมย์ 31140', taxId: '0315555000123' },
  { name: 'หจก. เพิ่มพูน การเกษตร', address: '12 หมู่ 2 ต.บ้านกรวด อ.บ้านกรวด จ.บุรีรัมย์ 31180', taxId: '0313559000999' }
];

const DEFAULT_SUPPLIERS = [
  { name: 'บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด', address: '17 หมู่ที่ 14 ตำบลปราสาท อำเภอบ้านกรวด จังหวัดบุรีรัมย์ 31180', taxId: '0315560001234' },
  { name: 'หจก. พลอยไพลิน ยางพารา', address: '88 หมู่ 3 ต.ในเมือง อ.เมือง จ.บุรีรัมย์ 31000', taxId: '0313559000567' },
  { name: 'ร้าน สุรินทร์การเกษตร', address: '45/1 ถนนเฉลิมพระเกียรติ ต.ในเมือง อ.เมือง จ.สุรินทร์ 32000', taxId: '3320100456789' },
  { name: 'คุณสมชาย ใจดี (เกษตรกรชาวสวนยาง)', address: '12 หมู่ 5 ต.บ้านกรวด อ.บ้านกรวด จ.บุรีรัมย์ 31180', taxId: '1319900123456' }
];

const DEFAULT_TOPS = [
  { code: 'AA', name: 'ยางก้อน', formatted: 'AA:ยางก้อน' },
  { code: 'BB', name: 'ขี้ยาง', formatted: 'BB:ขี้ยาง' },
  { code: 'CC', name: 'ยางแผ่นดิบ', formatted: 'CC:ยางแผ่นดิบ' },
  { code: 'DD', name: 'ยางแผ่นรมควัน (RSS)', formatted: 'DD:ยางแผ่นรมควัน (RSS)' },
  { code: 'EE', name: 'น้ำยางสด', formatted: 'EE:น้ำยางสด' },
  { code: 'FF', name: 'เศษยาง', formatted: 'FF:เศษยาง' }
];

const DEFAULT_PAYMENTS = [
  'เงินโอน',
  'เช็ค',
  'เงินสด'
];

const DEFAULT_BANKS = [
  'SCB SA 1234',
  'KBANK 5678',
  'BBL 9012',
  'KTB 3456'
];

const DEFAULT_SETTINGS = {
  webhookUrl: 'https://script.google.com/macros/s/AKfycbwYhD8P2zH2q7nQ-aI3951FfT1HnC0O2b0sM3u_n1p/exec',
  cloudflareWorkerUrl: 'https://receipt-backend-worker.beemcr73327.workers.dev/',
  configSheetId: CONFIG_SHEET_ID,
  logSheetId: LOG_SHEET_ID
};

class StorageService {
  constructor() {
    this.initDefaults();
  }

  initDefaults() {
    if (!localStorage.getItem(KEYS.SUPPLIERS)) {
      localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(DEFAULT_SUPPLIERS));
    }
    if (!localStorage.getItem(KEYS.TOPS)) {
      localStorage.setItem(KEYS.TOPS, JSON.stringify(DEFAULT_TOPS));
    }
    if (!localStorage.getItem(KEYS.PAYMENTS)) {
      localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(DEFAULT_PAYMENTS));
    }
    if (!localStorage.getItem(KEYS.BANKS)) {
      localStorage.setItem(KEYS.BANKS, JSON.stringify(DEFAULT_BANKS));
    }
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(KEYS.RECEIPTS)) {
      localStorage.setItem(KEYS.RECEIPTS, JSON.stringify([]));
    }
  }

  // --- Suppliers (datasupplier) ---
  getSuppliers() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.SUPPLIERS)) || DEFAULT_SUPPLIERS;
    } catch {
      return DEFAULT_SUPPLIERS;
    }
  }

  addSupplier(supplier) {
    const list = this.getSuppliers();
    if (!list.some(s => s.name === supplier.name)) {
      list.push(supplier);
      localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(list));
    }
  }

  // --- TOPS (Categories/Items) ---
  getTops() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.TOPS)) || DEFAULT_TOPS;
    } catch {
      return DEFAULT_TOPS;
    }
  }

  addTop(item) {
    const list = this.getTops();
    if (!list.includes(item)) {
      list.push(item);
      localStorage.setItem(KEYS.TOPS, JSON.stringify(list));
    }
  }

  // --- Payment Methods ---
  getPayments() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.PAYMENTS)) || DEFAULT_PAYMENTS;
    } catch {
      return DEFAULT_PAYMENTS;
    }
  }

  // --- Receivers (Payment Voucher จ่ายให้) ---
  getReceivers() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.RECEIVERS)) || DEFAULT_RECEIVERS;
    } catch {
      return DEFAULT_RECEIVERS;
    }
  }

  addReceiver(receiverInput) {
    if (!receiverInput) return;
    const name = typeof receiverInput === 'object' ? receiverInput.name : String(receiverInput).trim();
    if (!name) return;

    const list = this.getReceivers();
    const exists = list.some(r => (typeof r === 'object' ? r.name : r).toLowerCase().trim() === name.toLowerCase().trim());
    if (!exists) {
      const newRec = typeof receiverInput === 'object' ? receiverInput : { name, address: '', taxId: '' };
      list.push(newRec);
      localStorage.setItem(KEYS.RECEIVERS, JSON.stringify(list));
    }
  }

  // --- Source Bank Accounts (บริษัทเราเอง - Short code: ALL) ---
  getSourceBanks() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.SOURCE_BANKS));
      if (raw && Array.isArray(raw) && raw.length > 0) return raw;
    } catch {}
    return [
      'BBL 4143010488',
      'KTB 6781803115',
      'SCB 4321625236',
      'SCB 7732609083',
      'BAY 1291795056'
    ];
  }

  // --- Destination Bank Accounts (ผู้รับเงิน - Short code: PV) ---
  getDestBanks() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.DEST_BANKS));
      if (raw && Array.isArray(raw) && raw.length > 0) return raw;
    } catch {}
    return [
      { accNo: '6781803115', bankName: 'ธนาคารกรุงไทย นายสมศักดิ์', formatted: '6781803115 (ธนาคารกรุงไทย นายสมศักดิ์)' },
      { accNo: '4321625236', bankName: 'ธนาคารไทยพาณิชย์ นายสมบูรณ์', formatted: '4321625236 (ธนาคารไทยพาณิชย์ นายสมบูรณ์)' }
    ];
  }

  // --- Voucher Bank Accounts (Legacy helper) ---
  getVoucherBanks() {
    return this.getSourceBanks();
  }

  // --- Dynamic Bank Accounts (Receipts - 4 digits) ---
  getBanks() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.BANKS)) || DEFAULT_BANKS;
      const parsed = raw.map(b => {
        if (typeof b === 'object' && b !== null) return b;
        return { formatted: String(b), fullValue: String(b) };
      });
      return parsed.filter(b => {
        const s = String(b.formatted || '').toLowerCase().trim();
        return s && !s.includes('bank number') && !s.includes('bank_number') && s !== 'ธนาคาร' && s !== 'เลขที่บัญชี';
      });
    } catch {
      return DEFAULT_BANKS.map(b => ({ formatted: b, fullValue: b }));
    }
  }

  addBank(bankString) {
    if (!bankString || !bankString.trim()) return;
    const clean = bankString.trim();
    const list = this.getBanks();
    const exists = list.some(b => {
      const val = typeof b === 'object' && b !== null ? b.fullValue : String(b);
      return val.toLowerCase().trim() === clean.toLowerCase().trim();
    });
    if (!exists) {
      list.push({ formatted: clean, fullValue: clean });
      localStorage.setItem(KEYS.BANKS, JSON.stringify(list));
    }
  }

  // --- User Authentication & Profiles ---
  getCurrentUser() {
    try {
      // ⬇️ Use sessionStorage first for tab isolation, fallback to localStorage
      const userStr = sessionStorage.getItem(KEYS.CURRENT_USER) || localStorage.getItem(KEYS.CURRENT_USER);
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  setCurrentUser(user) {
    if (user) {
      if (!user.fullName) {
        user.fullName = (`${user.firstName || ''} ${user.lastName || ''}`).trim();
      }
      sessionStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      const profiles = this.getUserProfiles();
      profiles[user.email] = user;
      localStorage.setItem(KEYS.USERS, JSON.stringify(profiles));
    } else {
      sessionStorage.removeItem(KEYS.CURRENT_USER);
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  }

  async loginWithPassword(email, password) {
    const settings = this.getSettings();
    const targetUrl = settings.cloudflareWorkerUrl || settings.webhookUrl;
    if (!targetUrl) return { success: false, message: 'ไม่มี Webhook URL กรุณาตั้งค่าการเชื่อมต่อ' };

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();

    // 1. Try direct POST first (Works if using Cloudflare Worker Proxy or CORS-enabled backend)
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', email: cleanEmail, password: cleanPassword })
      });
      
      const text = await response.text();
      let data = {};
      try { data = JSON.parse(text); } catch(e) {}

      if (data.status === 'success' && data.user) {
         this.setCurrentUser(data.user);
         return { success: true, user: data.user };
      } else if (data.status === 'error') {
         return { success: false, message: data.message || 'รหัสผ่านหรืออีเมลไม่ถูกต้อง' };
      }
    } catch (e) {
      console.warn('⚠️ POST Login failed/CORS blocked, attempting GET fallback...', e.message);
    }

    // 2. Fallback: Use GET request (Google Apps Script doGet supports CORS headers cleanly in browsers)
    try {
      const configRes = await this.fetchConfigFromGoogleSheets();
      const usersDict = (configRes && configRes.users) ? configRes.users : this.getUserProfiles();
      const user = usersDict ? usersDict[cleanEmail] : null;

      if (user) {
        if (user.status === 'Blocked') {
          return { success: false, message: 'บัญชีของคุณถูกระงับการใช้งาน' };
        }
        if (user.status === 'Pending') {
          return { success: false, message: 'บัญชีอยู่ระหว่างรอการอนุมัติจาก Admin' };
        }

        // Compare password if rawPassword is provided in sheet
        if (user.rawPassword && user.rawPassword !== cleanPassword) {
          return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
        }

        const safeUser = { ...user };
        delete safeUser.rawPassword;
        this.setCurrentUser(safeUser);
        return { success: true, user: safeUser };
      } else {
        return { success: false, message: 'ไม่พบอีเมลนี้ในระบบ' };
      }
    } catch (fallbackErr) {
      console.error('❌ Login fallback failed:', fallbackErr);
      return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ (URL 404 หรือเครือข่ายขัดข้อง)' };
    }
  }

  getUserProfiles() {
    try {
      const usersList = JSON.parse(localStorage.getItem(KEYS.USERS));
      if (Array.isArray(usersList)) {
         // Convert array back to dictionary for easy access
         const profiles = {};
         usersList.forEach(u => { 
            if (u && u.email) {
               profiles[u.email.toLowerCase().trim()] = u; 
            }
         });
         return profiles;
      }
      return usersList || {};
    } catch {
      return {};
    }
  }

  async sendApiPost(payload) {
    const settings = this.getSettings();
    const targetUrl = settings.cloudflareWorkerUrl || settings.webhookUrl;

    console.group(`🔄 [sendApiPost] Action: ${payload.action}`);
    console.log('📌 URL:', targetUrl || '❌ ไม่ได้ตั้งค่า');

    if (!targetUrl) {
      console.warn('⚠️ ไม่มี Webhook URL');
      console.groupEnd();
      return { success: false, reason: 'NO_URL' };
    }

    const payloadString = JSON.stringify(payload);

    // วิธีที่ 1: fetch แบบ redirect: follow (รองรับ Google Apps Script redirect)
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadString
      });
      const responseText = await response.text();
      console.log('✅ [วิธี 1] Status:', response.status, 'Response:', responseText);
      console.groupEnd();
      return { success: true, response: responseText };
    } catch (err) {
      console.warn('⚠️ [วิธี 1] CORS/Redirect error:', err.message);
    }

    // วิธีที่ 2: no-cors mode fallback
    try {
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadString
      });
      console.log('✅ [วิธี 2 - no-cors] Request sent successfully');
      console.groupEnd();
      return { success: true, mode: 'no-cors' };
    } catch (fallbackErr) {
      console.error('❌ [sendApiPost] ทุกวิธีล้มเหลว:', fallbackErr.message);
      console.groupEnd();
      return { success: false, error: fallbackErr.message };
    }
  }

  async registerUser(userData) {
    const cleanEmail = String(userData.email || '').trim().toLowerCase();
    const newUser = {
      ...userData,
      email: cleanEmail,
      status: userData.status || 'Pending'
    };

    // Update local profiles cache
    const profiles = this.getUserProfiles();
    profiles[cleanEmail] = newUser;
    localStorage.setItem(KEYS.USERS, JSON.stringify(profiles));

    const payload = {
      action: 'registerUser',
      data: newUser
    };

    return await this.sendApiPost(payload);
  }

  async updateUserStatus(email, role, status) {
    const cleanEmail = String(email || '').trim().toLowerCase();

    // Update local profiles cache
    const profiles = this.getUserProfiles();
    if (profiles[cleanEmail]) {
      profiles[cleanEmail].role = role || profiles[cleanEmail].role;
      profiles[cleanEmail].status = status || profiles[cleanEmail].status;
    } else {
      profiles[cleanEmail] = { email: cleanEmail, role, status };
    }
    localStorage.setItem(KEYS.USERS, JSON.stringify(profiles));

    const payload = {
      action: 'updateUserStatus',
      data: { email: cleanEmail, role, status }
    };

    return await this.sendApiPost(payload);
  }

  // --- Running Number Generator (YYMMXXXX without REV prefix) ---
  generateReceiptNumber(dateObj = new Date()) {
    const { year2, month2 } = getThaiYearMonthPrefix(dateObj);
    const prefix = `${year2}${month2}`;
    const receipts = this.getReceipts();

    let maxSeq = 0;
    receipts.forEach(r => {
      if (r.receiptNo) {
        // Strip non-digits or REV prefix if any existed before
        const cleanNo = r.receiptNo.replace(/^[^\d]+/, '');
        if (cleanNo.startsWith(prefix)) {
          const seqStr = cleanNo.substring(prefix.length);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `${prefix}${nextSeq}`;
  }

  // --- Receipts Log ---
  getReceipts() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.RECEIPTS)) || [];
    } catch {
      return [];
    }
  }

  async saveReceipt(receiptData) {
    const receipts = this.getReceipts();
    
    const existingIndex = receipts.findIndex(r => r.receiptNo === receiptData.receiptNo);
    const updatedData = {
      ...receiptData,
      status: receiptData.status || 'ปกติ',
      updatedAt: formatThaiDateTime()
    };

    if (existingIndex >= 0) {
      receipts[existingIndex] = updatedData;
    } else {
      receipts.unshift(updatedData);
    }

    localStorage.setItem(KEYS.RECEIPTS, JSON.stringify(receipts));

    if (receiptData.paymentMethod === 'เงินโอน' && receiptData.bankDetails) {
      this.addBank(receiptData.bankDetails);
    }

    // ⬇️ ใช้ await เพื่อให้ error ไม่ถูกกลืน
    const syncResult = await this.syncToGoogleSheets(updatedData);
    console.log('📋 [saveReceipt] Sync result:', syncResult);

    return updatedData;
  }

  async cancelReceipt(receiptNo, reason) {
    const receipts = this.getReceipts();
    const index = receipts.findIndex(r => r.receiptNo === receiptNo);
    if (index >= 0) {
      receipts[index].status = 'ยกเลิก';
      receipts[index].cancelReason = reason;
      receipts[index].cancelledAt = formatThaiDateTime();
      localStorage.setItem(KEYS.RECEIPTS, JSON.stringify(receipts));
      await this.syncToGoogleSheets(receipts[index]);
      return receipts[index];
    }
    return null;
  }

  // --- Payment Voucher (PV) Running Number Generator (YYMMXXXX - 8 Digits with monthly reset) ---
  generateVoucherNumber(dateObj = new Date()) {
    const { year2, month2 } = getThaiYearMonthPrefix(dateObj);
    const prefix = `${year2}${month2}`; // e.g. "6908"
    const vouchers = this.getVouchers();

    let maxSeq = 0;
    vouchers.forEach(v => {
      if (v.voucherNo) {
        const cleanNo = String(v.voucherNo).replace(/^[^\d]+/, '');
        if (cleanNo.startsWith(prefix)) {
          const seqStr = cleanNo.substring(prefix.length);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `${prefix}${nextSeq}`;
  }

  // --- Vouchers Log ---
  getVouchers() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.VOUCHERS)) || [];
    } catch {
      return [];
    }
  }

  async saveVoucher(voucherData) {
    const vouchers = this.getVouchers();
    
    // Auto-save Receiver
    if (voucherData.receiverName) {
      this.addReceiver(voucherData.receiverName);
    }

    const existingIndex = vouchers.findIndex(v => v.voucherNo === voucherData.voucherNo);
    const updatedData = {
      ...voucherData,
      status: voucherData.status || 'ปกติ',
      updatedAt: formatThaiDateTime()
    };

    if (existingIndex >= 0) {
      vouchers[existingIndex] = updatedData;
    } else {
      vouchers.unshift(updatedData);
    }

    localStorage.setItem(KEYS.VOUCHERS, JSON.stringify(vouchers));

    // Sync to Google Sheets via Cloudflare Proxy
    const syncResult = await this.syncVoucherToGoogleSheets(updatedData);
    console.log('📋 [saveVoucher] Sync result:', syncResult);

    return updatedData;
  }

  async cancelVoucher(voucherNo, reason) {
    const vouchers = this.getVouchers();
    const index = vouchers.findIndex(v => v.voucherNo === voucherNo);
    if (index >= 0) {
      vouchers[index].status = 'ยกเลิก';
      vouchers[index].cancelReason = reason;
      vouchers[index].cancelledAt = formatThaiDateTime();
      localStorage.setItem(KEYS.VOUCHERS, JSON.stringify(vouchers));
      await this.syncVoucherToGoogleSheets(vouchers[index], true);
      return vouchers[index];
    }
    return null;
  }

  async syncVoucherToGoogleSheets(voucherRecord, isCancel = false) {
    const settings = this.getSettings();
    const targetUrl = settings.cloudflareWorkerUrl || settings.webhookUrl;

    if (!targetUrl) {
      console.warn('⚠️ ยังไม่ได้กรอก Webhook URL — บันทึกเฉพาะ LocalStorage');
      return { success: false, reason: 'NO_URL' };
    }

    const payload = {
      action: isCancel ? 'cancelVoucher' : 'saveVoucher',
      logSheetId: VOUCHER_SHEET_ID,
      data: voucherRecord
    };

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      let result = {};
      try { result = JSON.parse(text); } catch { result = { text }; }
      return { success: true, result };
    } catch (e) {
      console.warn('⚠️ Sync Voucher failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  // --- App Settings ---
  getSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEYS.SETTINGS)) || DEFAULT_SETTINGS;
      if (!stored.cloudflareWorkerUrl) {
         stored.cloudflareWorkerUrl = DEFAULT_SETTINGS.cloudflareWorkerUrl;
      }
      return stored;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  }

  async syncToGoogleSheets(receiptRecord) {
    const settings = this.getSettings();
    const targetUrl = settings.cloudflareWorkerUrl || settings.webhookUrl;

    console.group('🔄 [syncToGoogleSheets] Debug Info');
    console.log('📌 URL ที่ใช้ส่ง:', targetUrl || '❌ ไม่ได้ตั้งค่า');

    if (!targetUrl) {
      console.warn('⚠️ ยังไม่ได้กรอก Webhook URL — ข้อมูลบันทึกเฉพาะ LocalStorage');
      console.groupEnd();
      return { success: false, reason: 'NO_URL' };
    }

    const payload = {
      action: 'saveReceipt',
      configSheetId: CONFIG_SHEET_ID,
      logSheetId: LOG_SHEET_ID,
      data: receiptRecord
    };
    const payloadString = JSON.stringify(payload);

    console.log('📦 Payload ที่ส่ง:', payload);
    console.log('📏 ขนาด Payload:', payloadString.length, 'bytes');

    // วิธีที่ 1: ลอง fetch แบบ redirect: follow (รองรับ Google Apps Script redirect)
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadString
      });
      const responseText = await response.text();
      console.log('✅ [วิธี 1] Response status:', response.status);
      console.log('✅ [วิธี 1] Response body:', responseText);
      console.groupEnd();
      return { success: true, response: responseText };
    } catch (err) {
      console.warn('⚠️ [วิธี 1] CORS/Redirect error:', err.message);
    }

    // วิธีที่ 2: no-cors mode (ข้อมูลจะถูกส่ง แต่ response เป็น opaque - อ่านไม่ได้)
    try {
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadString
      });
      console.log('✅ [วิธี 2 - no-cors] ส่ง request แล้ว (response เป็น opaque อ่านไม่ได้)');
      console.groupEnd();
      return { success: true, mode: 'no-cors' };
    } catch (fallbackErr) {
      console.error('❌ ทุกวิธีล้มเหลว:', fallbackErr.message);
      console.groupEnd();
      return { success: false, error: fallbackErr.message };
    }
  }

  async fetchConfigFromGoogleSheets() {
    const settings = this.getSettings();
    const targetUrl = settings.cloudflareWorkerUrl || settings.webhookUrl;

    console.group('🔄 [fetchConfig] ดึงข้อมูล Config จาก Google Sheets');
    console.log('📌 URL:', targetUrl || '❌ ไม่ได้ตั้งค่า');

    if (!targetUrl) {
      console.warn('⚠️ ไม่มี Webhook URL — ใช้ข้อมูล Default จาก localStorage');
      console.groupEnd();
      return { success: false, users: null };
    }

    try {
      // ⬇️ Force bypass ALL browser caches (especially Safari's aggressive caching)
      const cacheBusterUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + '_t=' + Date.now() + '&_r=' + Math.random().toString(36).substring(7);
      const res = await fetch(cacheBusterUrl, {
        method: 'GET',
        redirect: 'follow'
      });
      console.log('📡 Response status:', res.status, res.statusText);
      
      const data = await res.json();
      console.log('📦 ข้อมูลที่ได้รับ:', data);

      if (data.status === 'success') {
        if (data.suppliers && Array.isArray(data.suppliers) && data.suppliers.length > 0) {
          localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(data.suppliers));
          console.log(`✅ Suppliers: อัปเดต ${data.suppliers.length} รายชื่อ`);
        }
        if (data.tops && Array.isArray(data.tops) && data.tops.length > 0) {
          const topsList = data.tops.map(t => {
            if (typeof t === 'object') {
              const code = (t.code || t.shortCode || t.shortName || '').trim();
              const name = (t.name || t.type || '').trim();
              const formatted = t.formatted || (code ? `${code}:${name}` : name);
              return { code, name, formatted };
            }
            const strVal = String(t).trim();
            return { code: '', name: strVal, formatted: strVal };
          }).filter(t => t.name || t.code);
          localStorage.setItem(KEYS.TOPS, JSON.stringify(topsList));
          console.log(`✅ TOPS: อัปเดต ${topsList.length} รายการ`);
        }
        if (data.payments && Array.isArray(data.payments) && data.payments.length > 0) {
          localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(data.payments));
          console.log(`✅ Payments: อัปเดต ${data.payments.length} รายการ`);
        }
        const sourceBanks = (data.receiptBanks && Array.isArray(data.receiptBanks) && data.receiptBanks.length > 0)
          ? data.receiptBanks 
          : data.banks;

        if (sourceBanks && Array.isArray(sourceBanks) && sourceBanks.length > 0) {
          const cleanBanks = sourceBanks.map(b => {
            if (typeof b === 'object' && b !== null) {
              const shortLabel = (b.bankAbbr && b.last4)
                ? `${b.bankAbbr} ${b.last4}`.trim()
                : (b.formatted || `${b.bankAbbr || ''} ${b.last4 || ''}`.trim());
              const fullVal = b.sourceBankFormatted || `${b.bankAbbr || ''} ${b.fullAccNum || ''}`.trim();
              return { formatted: shortLabel, fullValue: fullVal };
            }
            return { formatted: String(b || '').trim(), fullValue: String(b || '').trim() };
          }).filter(item => {
            const low = item.formatted.toLowerCase();
            return item.formatted && !low.includes('bank number') && !low.includes('bank_number') && low !== 'ธนาคาร' && low !== 'เลขที่บัญชี';
          });
          localStorage.setItem(KEYS.BANKS, JSON.stringify(cleanBanks));
          console.log(`✅ Banks: อัปเดต ${cleanBanks.length} รายการ (แสดงตัวย่อ + เลขท้าย 4 หลัก)`);
        }

        // ⬇️ Parse users and save to localStorage + return fresh data to caller
        let freshUserProfiles = null;
        if (data.users && Array.isArray(data.users) && data.users.length > 0) {
          const userProfiles = {};
          data.users.forEach(u => {
            if (u && u.email) {
              const rawEmail = String(u.email).trim();
              const emailParts = rawEmail.split(/\s+/);
              const cleanEmail = emailParts[0].toLowerCase();
              let cleanStatus = String(u.status || '').trim();

              if ((!cleanStatus || cleanStatus === 'Approved') && emailParts.length > 1) {
                cleanStatus = emailParts[1].trim();
              }
              if (!cleanStatus) cleanStatus = 'Approved';

              const fName = String(u.firstName || '').trim();
              const lName = String(u.lastName || '').trim();
              const fullName = u.fullName || `${fName} ${lName}`.trim();

              userProfiles[cleanEmail] = {
                ...u,
                email: cleanEmail,
                firstName: fName,
                lastName: lName,
                fullName: fullName,
                role: String(u.role || 'User').trim(),
                status: cleanStatus
              };
            }
          });
          localStorage.setItem(KEYS.USERS, JSON.stringify(userProfiles));
          freshUserProfiles = userProfiles;
          console.log(`✅ Users: อัปเดต ${Object.keys(userProfiles).length} รายการ`, userProfiles);
        }
        if (data.receipts && Array.isArray(data.receipts)) {
          localStorage.setItem(KEYS.RECEIPTS, JSON.stringify(data.receipts));
          console.log(`✅ Receipts: อัปเดตประวัติใบเสร็จ ${data.receipts.length} รายการจาก Google Sheet`);
        }
        if (data.receivers && Array.isArray(data.receivers) && data.receivers.length > 0) {
          localStorage.setItem(KEYS.RECEIVERS, JSON.stringify(data.receivers));
          console.log(`✅ Receivers: อัปเดตผู้รับเงิน ${data.receivers.length} รายการ`);
        }
        const rawBanks = data.voucherBanks || data.banks || [];
        if (rawBanks && Array.isArray(rawBanks) && rawBanks.length > 0) {
          // 1. บัญชีต้นทาง (ALL) -> แสดงแบบย่อบนเว็บ (BBL 0488) แต่เก็บเต็มส่ง Sheet (BBL 4143010488)
          const sourceList = rawBanks.filter(b => b.usage === 'ALL' || b.usage === 'ALL,RC' || b.usage === 'RC,PV,ALL').map(b => {
            if (typeof b === 'object' && b !== null) {
              const shortLabel = (b.bankAbbr ? b.bankAbbr + " " : "") + (b.last4 || '');
              const fullVal = b.sourceBankFormatted || `${b.bankAbbr || ''} ${b.fullAccNum || ''}`.trim();
              return { formatted: shortLabel.trim(), fullValue: fullVal };
            }
            return { formatted: String(b), fullValue: String(b) };
          });
          localStorage.setItem(KEYS.SOURCE_BANKS, JSON.stringify(sourceList));

          // 2. บัญชีปลายทาง (PV) -> แสดงเต็มบนเว็บ (เลขที่บัญชีเต็ม)
          const destList = rawBanks.filter(b => b.usage === 'PV' || b.usage === 'RC,PV' || b.usage === 'ALL,PV').map(b => {
            if (typeof b === 'object' && b !== null) {
              const label = `${b.fullAccNum || b.last4 || ''} (${b.bankFullName || ''} ${b.accountHolder || ''})`.trim();
              return { 
                accNo: b.fullAccNum || b.last4 || '', 
                bankName: `${b.bankFullName || ''} ${b.accountHolder || ''}`.trim(),
                formatted: label
              };
            }
            return { accNo: String(b), bankName: '', formatted: String(b) };
          });
          localStorage.setItem(KEYS.DEST_BANKS, JSON.stringify(destList));
          localStorage.setItem(KEYS.VOUCHER_BANKS, JSON.stringify(sourceList));
          console.log(`✅ บัญชีธนาคารใบสำคัญจ่ายอัปเดตแล้ว: ต้นทาง (ALL) ${sourceList.length} รายการ, ปลายทาง (PV) ${destList.length} รายการ`);
        }
        if (data.vouchers && Array.isArray(data.vouchers)) {
          localStorage.setItem(KEYS.VOUCHERS, JSON.stringify(data.vouchers));
          console.log(`✅ Vouchers: อัปเดตประวัติใบสำคัญจ่าย ${data.vouchers.length} รายการจาก Google Sheet`);
        }
        console.log('🎉 ดึงข้อมูล Config สำเร็จทั้งหมด!');
        console.groupEnd();
        return { success: true, users: freshUserProfiles, receipts: data.receipts || [], vouchers: data.vouchers || [] };
      } else {
        console.error('❌ ดึงข้อมูลไม่ได้, API แจ้ง Error:', data.message);
        // alert('Apps Script แจ้งข้อผิดพลาด: ' + (data.message || 'Unknown Error'));
      }
    } catch (err) {
      console.error('❌ ดึงข้อมูลไม่ได้:', err.message);
      console.log('💡 อาจเกิดจาก CORS — ลองใช้ Cloudflare Worker เป็นตัวกลาง');
      // alert('ไม่สามารถดึงข้อมูลใหม่จาก Google Sheet ได้: ' + err.message + '\n\nกรุณาตรวจสอบว่า URL ของ Apps Script ใช้งานได้ (ทดสอบเปิด URL บนเบราว์เซอร์ดูว่าได้ 404 หรือไม่)');
      return { success: false, users: null };
    }
    console.groupEnd();
    return { success: false, users: null };
  }
}

export const storageService = new StorageService();
