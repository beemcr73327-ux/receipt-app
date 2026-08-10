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
  USERS: 'receipt_user_profiles',
  CURRENT_USER: 'receipt_current_user',
  RECEIPTS: 'receipt_log_records',
  SETTINGS: 'receipt_app_settings'
};

// User's provided Sheet IDs
export const CONFIG_SHEET_ID = "1FiWYtzhqsO_7TJ222INNWI8QsgXVJ7lWv83S3bfY7qM";
export const LOG_SHEET_ID = "1YE4F8WjWT13R_aMOYVmR2NuhaA6FE8ua1cKsdMlttwk";

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
  // 🔥 [สำคัญ] นำ Webhook URL (หรือ Cloudflare URL) มาวางที่บรรทัดนี้ได้เลยครับ!
  webhookUrl: 'https://script.google.com/macros/s/AKfycbwYhD8P2zH2q7nQ-aI3951FfT1HnC0O2b0sM3u_n1p/exec', // <-- เปลี่ยนเป็น URL ของคุณ
  cloudflareWorkerUrl: '',
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

  // --- Dynamic Bank Accounts ---
  getBanks() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.BANKS)) || DEFAULT_BANKS;
      return raw.filter(b => {
        const s = String(b || '').toLowerCase().trim();
        return s && !s.includes('bank number') && !s.includes('bank_number') && s !== 'ธนาคาร' && s !== 'เลขที่บัญชี';
      });
    } catch {
      return DEFAULT_BANKS;
    }
  }

  addBank(bankString) {
    if (!bankString || !bankString.trim()) return;
    const clean = bankString.trim();
    const list = this.getBanks();
    if (!list.includes(clean)) {
      list.push(clean);
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
    const targetUrl = settings.webhookUrl || settings.cloudflareWorkerUrl;
    if (!targetUrl) return { success: false, message: 'ไม่มี Webhook URL' };

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', email: email.toLowerCase().trim(), password })
      });
      const data = await response.json();
      if (data.status === 'success' && data.user) {
         this.setCurrentUser(data.user);
         return { success: true, user: data.user };
      } else {
         return { success: false, message: data.message || 'รหัสผ่านหรืออีเมลไม่ถูกต้อง' };
      }
    } catch (e) {
      return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' };
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
    const targetUrl = settings.webhookUrl || settings.cloudflareWorkerUrl;

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

  // --- App Settings ---
  getSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEYS.SETTINGS)) || DEFAULT_SETTINGS;
      if (!stored.webhookUrl && !stored.cloudflareWorkerUrl) {
         stored.webhookUrl = DEFAULT_SETTINGS.webhookUrl;
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
    const targetUrl = settings.webhookUrl || settings.cloudflareWorkerUrl;

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
    const targetUrl = settings.webhookUrl || settings.cloudflareWorkerUrl;

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
        if (data.banks && Array.isArray(data.banks) && data.banks.length > 0) {
          const cleanBanks = data.banks.filter(b => {
            const s = String(b || '').toLowerCase().trim();
            return s && !s.includes('bank number') && !s.includes('bank_number') && s !== 'ธนาคาร' && s !== 'เลขที่บัญชี';
          });
          localStorage.setItem(KEYS.BANKS, JSON.stringify(cleanBanks));
          console.log(`✅ Banks: อัปเดต ${cleanBanks.length} รายการ`);
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
        console.log('🎉 ดึงข้อมูล Config สำเร็จทั้งหมด!');
        console.groupEnd();
        return { success: true, users: freshUserProfiles };
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
