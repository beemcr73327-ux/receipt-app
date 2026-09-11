/**
 * Cloudflare Worker Backend (Staging Environment)
 * Project: Receipt & Payment Voucher & Rubber Lot Management System
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 0.2 Atomic Sequence Engine Ready)
 */

import {
  getNextDocumentNumber,
  previewNextDocumentNumber,
  setManualSeed,
  getSequenceStatus
} from './services/sequenceService.js';
import { handleWithIdempotency } from './middleware/idempotency.js';
import {
  recordAuditLog,
  verifyChainIntegrity,
  getAuditLogs
} from './services/auditService.js';
import {
  authenticateUser,
  seedAdminUser,
  createUser,
  signJwt,
  requireAuth,
  requireRole
} from './services/authService.js';
import {
  createReceipt,
  getReceiptByNo,
  cancelReceipt,
  listReceipts,
  createVoucher,
  getVoucherByNo,
  cancelVoucher,
  listVouchers
} from './services/documentService.js';
import {
  syncReceiptToGoogleSheets,
  syncCancelReceiptToGoogleSheets,
  syncVoucherToGoogleSheets,
  syncCancelVoucherToGoogleSheets
} from './services/googleSheetsSyncService.js';

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const jwtSecret = env.JWT_SECRET || 'srisuk_jwt_secret_staging_key_2026';

    try {
      // 1. Health Check Endpoint
      if (path === '/health' || path === '/api/health') {
        const d1Connected = !!env.DB;
        return new Response(JSON.stringify({
          status: 'online',
          environment: env.ENVIRONMENT || 'staging',
          service: 'receipt-backend-staging',
          d1BindingReady: d1Connected,
          phase: 'Phase 1.2 - Google Sheets Background Sync Online',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ตรวจสอบการเชื่อมต่อ D1 Binding
      if (!env.DB) {
        return new Response(JSON.stringify({
          status: 'error',
          message: 'D1 Database Binding (env.DB) is not configured. Please check wrangler.toml.'
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. Atomic Sequence Endpoints (Phase 0.2 & 0.3)
      
      // 2.1 POST /api/v1/sequence/next - ออกเลขที่เอกสารถัดไปแบบ Atomic (พร้อม Idempotency Guard)
      if (path === '/api/v1/sequence/next' && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const docType = body.docType || body.type;
          const dateInput = body.date || new Date();

          if (!docType) {
            return errorResponse(corsHeaders, 'กรุณาระบุ docType (เช่น receipt หรือ voucher)', 400);
          }

          const seqData = await getNextDocumentNumber(env.DB, docType, dateInput);
          return successResponse(corsHeaders, seqData, 'ออกเลขที่เอกสารสำเร็จ');
        });
      }

      // 2.2 GET /api/v1/sequence/preview - ดูตัวอย่างเลขถัดไปโดยไม่เพิ่มตัวนับ
      if (path === '/api/v1/sequence/preview' && request.method === 'GET') {
        const docType = url.searchParams.get('docType') || url.searchParams.get('type');
        const dateInput = url.searchParams.get('date') || new Date();

        if (!docType) {
          return errorResponse(corsHeaders, 'กรุณาระบุ query parameter ?docType= (เช่น receipt หรือ voucher)', 400);
        }

        const previewData = await previewNextDocumentNumber(env.DB, docType, dateInput);
        return successResponse(corsHeaders, previewData);
      }

      // 2.3 POST /api/v1/sequence/seed - กำหนดเลขเริ่มต้น (Manual Seed Config)
      if (path === '/api/v1/sequence/seed' && request.method === 'POST') {
        const body = await parseJsonBody(request);
        const { docType, prefix, seedValue } = body;

        if (!docType || seedValue === undefined) {
          return errorResponse(corsHeaders, 'กรุณาระบุ docType และ seedValue', 400);
        }

        const seedResult = await setManualSeed(env.DB, docType, prefix, seedValue);

        // บันทึก Immutable Audit Log สำหรับการเปลี่ยนค่าตัวนับ (Phase 0.4)
        try {
          await recordAuditLog(env.DB, {
            actorEmail: request.headers.get('X-User-Email') || 'admin@srisuk-rubber.com',
            actorRole: 'Admin',
            action: 'SET_MANUAL_SEED',
            resourceType: 'sequence',
            resourceId: `${docType}:${seedResult.prefix}`,
            details: { previousSeq: seedResult.previousSeq, newSeed: seedValue },
            ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1'
          });
        } catch (auditErr) {
          console.error('Audit log error on seed:', auditErr);
        }

        return successResponse(corsHeaders, seedResult, 'ตั้งค่าเลขเริ่มต้น (Manual Seed) สำเร็จ');
      }

      // 2.4 GET /api/v1/sequence/status - ตรวจสอบสถานะตัวนับปัจจุบัน
      if (path === '/api/v1/sequence/status' && request.method === 'GET') {
        const docType = url.searchParams.get('docType') || url.searchParams.get('type');
        const prefix = url.searchParams.get('prefix');

        if (!docType) {
          return errorResponse(corsHeaders, 'กรุณาระบุ ?docType=', 400);
        }

        const statusData = await getSequenceStatus(env.DB, docType, prefix);
        return successResponse(corsHeaders, statusData);
      }

      // 3. Immutable Audit Log Endpoints (Phase 0.4)

      // 3.1 GET /api/v1/audit/verify - ตรวจสอบสายใยความสมบูรณ์ของ Hash Chain (Tamper-detection)
      if (path === '/api/v1/audit/verify' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '5000', 10);
        const report = await verifyChainIntegrity(env.DB, limit);
        return successResponse(corsHeaders, report, 'ผลการตรวจสอบสายใยความสมบูรณ์ของประวัติธุรกรรม');
      }

      // 3.2 GET /api/v1/audit/logs - ค้นหาและดูประวัติ Audit Logs
      if (path === '/api/v1/audit/logs' && request.method === 'GET') {
        const resourceType = url.searchParams.get('resourceType');
        const resourceId = url.searchParams.get('resourceId');
        const actorEmail = url.searchParams.get('actorEmail');
        const action = url.searchParams.get('action');
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

        const logsData = await getAuditLogs(env.DB, {
          resourceType,
          resourceId,
          actorEmail,
          action,
          page,
          pageSize
        });

        return successResponse(corsHeaders, logsData);
      }

      // 4. Authentication & RBAC Endpoints (Phase 0.5)

      // 4.1 POST /api/v1/auth/seed-admin - สร้างแอดมินคนแรกของระบบ (Genesis Admin)
      if (path === '/api/v1/auth/seed-admin' && request.method === 'POST') {
        const body = await parseJsonBody(request);
        const seedResult = await seedAdminUser(env.DB, body);

        if (seedResult.created) {
          try {
            await recordAuditLog(env.DB, {
              actorEmail: seedResult.admin.email,
              actorRole: 'Admin',
              action: 'SEED_ADMIN',
              resourceType: 'auth',
              resourceId: String(seedResult.admin.id),
              details: { email: seedResult.admin.email },
              ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1'
            });
          } catch (e) {
            console.error('Audit log error:', e);
          }
        }

        return successResponse(corsHeaders, seedResult, seedResult.message);
      }

      // 4.2 POST /api/v1/auth/login - ตรวจสอบรหัสผ่าน PBKDF2 และออก Token JWT
      if (path === '/api/v1/auth/login' && request.method === 'POST') {
        const body = await parseJsonBody(request);
        const { email, password } = body;

        if (!email || !password) {
          return errorResponse(corsHeaders, 'กรุณาระบุอีเมลและรหัสผ่าน', 400);
        }

        const user = await authenticateUser(env.DB, email, password);

        // ออก JWT Token อายุ 24 ชั่วโมง
        const token = await signJwt({
          sub: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }, jwtSecret, 86400);

        // บันทึก Audit Log เมื่อเข้าสู่ระบบสำเร็จ
        try {
          await recordAuditLog(env.DB, {
            actorEmail: user.email,
            actorRole: user.role,
            action: 'LOGIN_SUCCESS',
            resourceType: 'auth',
            resourceId: String(user.id),
            details: { email: user.email },
            ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1'
          });
        } catch (e) {
          console.error('Audit log error:', e);
        }

        return successResponse(corsHeaders, {
          token,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role
          }
        }, 'เข้าสู่ระบบสำเร็จ');
      }

      // 4.3 GET /api/v1/auth/me - ตรวจสอบ Token และดึงโปรไฟล์ผู้ใช้งาน
      if (path === '/api/v1/auth/me' && request.method === 'GET') {
        const currentUser = await requireAuth(request, jwtSecret);
        return successResponse(corsHeaders, { user: currentUser });
      }

      // 4.4 POST /api/v1/auth/users - แอดมินสร้างผู้ใช้งานใหม่ (เช่น พนักงาน Cashier / Manager)
      if (path === '/api/v1/auth/users' && request.method === 'POST') {
        const adminUser = await requireRole(request, jwtSecret, ['Admin']);
        const body = await parseJsonBody(request);
        const { email, password, firstName, lastName, role = 'User' } = body;

        const newUser = await createUser(env.DB, {
          email,
          password,
          firstName,
          lastName,
          role
        });

        // บันทึก Audit Log เมื่อแอดมินสร้างผู้ใช้ใหม่
        try {
          await recordAuditLog(env.DB, {
            actorEmail: adminUser.email,
            actorRole: adminUser.role,
            action: 'CREATE_USER',
            resourceType: 'user',
            resourceId: String(newUser.id),
            details: { createdEmail: newUser.email, assignedRole: newUser.role },
            ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1'
          });
        } catch (e) {
          console.error('Audit log error:', e);
        }

        return successResponse(corsHeaders, newUser, 'สร้างบัญชีผู้ใช้งานใหม่สำเร็จ');
      }

      // 5. Receipts Management Endpoints (Phase 1.1)

      // 5.1 POST /api/v1/receipts - สร้างใบเสร็จรับเงินใหม่ (พร้อม Idempotency Guard)
      if (path === '/api/v1/receipts' && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const actorEmail = request.headers.get('X-User-Email') || 'cashier@srisuk-rubber.com';
          const actorRole = request.headers.get('X-User-Role') || 'Cashier';
          const ipAddress = request.headers.get('CF-Connecting-IP') || '127.0.0.1';

          const receipt = await createReceipt(env.DB, body, {
            actorEmail,
            actorRole,
            ipAddress
          });

          // Phase 1.2: Asynchronous background sync to Google Sheets (Non-blocking)
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(
              syncReceiptToGoogleSheets(receipt, env).catch((err) =>
                console.warn('Background Sheets sync failed for receipt:', receipt.receipt_no, err.message)
              )
            );
          }

          return successResponse(corsHeaders, receipt, 'สร้างใบเสร็จรับเงินสำเร็จ', 201);
        });
      }

      // 5.2 GET /api/v1/receipts - ค้นหาและดูรายการใบเสร็จรับเงิน (Pagination & Filters)
      if (path === '/api/v1/receipts' && request.method === 'GET') {
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || '';
        const startDate = url.searchParams.get('startDate') || '';
        const endDate = url.searchParams.get('endDate') || '';
        const cashierName = url.searchParams.get('cashierName') || '';
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

        const listData = await listReceipts(env.DB, {
          search,
          status,
          startDate,
          endDate,
          cashierName,
          page,
          pageSize
        });

        return successResponse(corsHeaders, listData);
      }

      // 5.3 GET /api/v1/receipts/:receiptNo - ดึงข้อมูลใบเสร็จใบเดี่ยวพร้อมรายการสินค้า
      if (path.startsWith('/api/v1/receipts/') && request.method === 'GET') {
        const receiptNo = decodeURIComponent(path.replace('/api/v1/receipts/', '').trim());
        const receipt = await getReceiptByNo(env.DB, receiptNo);

        if (!receipt) {
          return errorResponse(corsHeaders, `ไม่พบใบเสร็จรับเงินเลขที่ ${receiptNo}`, 404);
        }

        return successResponse(corsHeaders, receipt);
      }

      // 5.4 POST /api/v1/receipts/:receiptNo/cancel - ขอยกเลิกใบเสร็จรับเงิน
      if (path.startsWith('/api/v1/receipts/') && path.endsWith('/cancel') && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const receiptNo = decodeURIComponent(path.replace('/api/v1/receipts/', '').replace('/cancel', '').trim());
          const reason = body.reason || body.cancelReason;
          const cancelledByEmail = request.headers.get('X-User-Email') || 'admin@srisuk-rubber.com';
          const cancelledByName = request.headers.get('X-User-Name') || 'ผู้ดูแลระบบ';

          const cancelled = await cancelReceipt(env.DB, receiptNo, {
            reason,
            cancelledByEmail,
            cancelledByName
          });

          // Phase 1.2: Asynchronous background sync to Google Sheets (Non-blocking)
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(
              syncCancelReceiptToGoogleSheets(receiptNo, reason, env).catch((err) =>
                console.warn('Background Sheets sync failed for cancel receipt:', receiptNo, err.message)
              )
            );
          }

          return successResponse(corsHeaders, cancelled, `ยกเลิกใบเสร็จรับเงินเลขที่ ${receiptNo} สำเร็จ`);
        });
      }

      // 6. Payment Vouchers Management Endpoints (Phase 1.1)

      // 6.1 POST /api/v1/vouchers - สร้างใบสำคัญจ่ายใหม่ (พร้อม Idempotency Guard)
      if (path === '/api/v1/vouchers' && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const actorEmail = request.headers.get('X-User-Email') || 'cashier@srisuk-rubber.com';
          const actorRole = request.headers.get('X-User-Role') || 'Cashier';
          const ipAddress = request.headers.get('CF-Connecting-IP') || '127.0.0.1';

          const voucher = await createVoucher(env.DB, body, {
            actorEmail,
            actorRole,
            ipAddress
          });

          // Phase 1.2: Asynchronous background sync to Google Sheets (Non-blocking)
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(
              syncVoucherToGoogleSheets(voucher, env).catch((err) =>
                console.warn('Background Sheets sync failed for voucher:', voucher.voucher_no, err.message)
              )
            );
          }

          return successResponse(corsHeaders, voucher, 'สร้างใบสำคัญจ่ายสำเร็จ', 201);
        });
      }

      // 6.2 GET /api/v1/vouchers - ค้นหาและดูรายการใบสำคัญจ่าย (Pagination & Filters)
      if (path === '/api/v1/vouchers' && request.method === 'GET') {
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || '';
        const startDate = url.searchParams.get('startDate') || '';
        const endDate = url.searchParams.get('endDate') || '';
        const cashierName = url.searchParams.get('cashierName') || '';
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

        const listData = await listVouchers(env.DB, {
          search,
          status,
          startDate,
          endDate,
          cashierName,
          page,
          pageSize
        });

        return successResponse(corsHeaders, listData);
      }

      // 6.3 GET /api/v1/vouchers/:voucherNo - ดึงข้อมูลใบสำคัญจ่ายพร้อมรายการย่อย
      if (path.startsWith('/api/v1/vouchers/') && request.method === 'GET') {
        const voucherNo = decodeURIComponent(path.replace('/api/v1/vouchers/', '').trim());
        const voucher = await getVoucherByNo(env.DB, voucherNo);

        if (!voucher) {
          return errorResponse(corsHeaders, `ไม่พบใบสำคัญจ่ายเลขที่ ${voucherNo}`, 404);
        }

        return successResponse(corsHeaders, voucher);
      }

      // 6.4 POST /api/v1/vouchers/:voucherNo/cancel - ขอยกเลิกใบสำคัญจ่าย
      if (path.startsWith('/api/v1/vouchers/') && path.endsWith('/cancel') && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const voucherNo = decodeURIComponent(path.replace('/api/v1/vouchers/', '').replace('/cancel', '').trim());
          const reason = body.reason || body.cancelReason;
          const cancelledByEmail = request.headers.get('X-User-Email') || 'admin@srisuk-rubber.com';
          const cancelledByName = request.headers.get('X-User-Name') || 'ผู้ดูแลระบบ';

          const cancelled = await cancelVoucher(env.DB, voucherNo, {
            reason,
            cancelledByEmail,
            cancelledByName
          });

          // Phase 1.2: Asynchronous background sync to Google Sheets (Non-blocking)
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(
              syncCancelVoucherToGoogleSheets(voucherNo, reason, env).catch((err) =>
                console.warn('Background Sheets sync failed for cancel voucher:', voucherNo, err.message)
              )
            );
          }

          return successResponse(corsHeaders, cancelled, `ยกเลิกใบสำคัญจ่ายเลขที่ ${voucherNo} สำเร็จ`);
        });
      }

      // 7. Manual Google Sheets Sync Endpoints (Phase 1.2)
      // 7.1 POST /api/v1/sync/receipts/:receiptNo - สั่งซิงค์ใบเสร็จไปยัง Google Sheets ด้วยตนเอง
      if (path.startsWith('/api/v1/sync/receipts/') && request.method === 'POST') {
        const receiptNo = decodeURIComponent(path.replace('/api/v1/sync/receipts/', '').trim());
        const receipt = await getReceiptByNo(env.DB, receiptNo);
        if (!receipt) {
          return errorResponse(corsHeaders, `ไม่พบใบเสร็จเลขที่ ${receiptNo}`, 404);
        }
        const syncResult = await syncReceiptToGoogleSheets(receipt, env);
        return successResponse(corsHeaders, syncResult, `ส่งข้อมูลใบเสร็จ ${receiptNo} ไปยัง Google Sheets สำเร็จ`);
      }

      // 7.2 POST /api/v1/sync/vouchers/:voucherNo - สั่งซิงค์ใบสำคัญจ่ายไปยัง Google Sheets ด้วยตนเอง
      if (path.startsWith('/api/v1/sync/vouchers/') && request.method === 'POST') {
        const voucherNo = decodeURIComponent(path.replace('/api/v1/sync/vouchers/', '').trim());
        const voucher = await getVoucherByNo(env.DB, voucherNo);
        if (!voucher) {
          return errorResponse(corsHeaders, `ไม่พบใบสำคัญจ่ายเลขที่ ${voucherNo}`, 404);
        }
        const syncResult = await syncVoucherToGoogleSheets(voucher, env);
        return successResponse(corsHeaders, syncResult, `ส่งข้อมูลใบสำคัญจ่าย ${voucherNo} ไปยัง Google Sheets สำเร็จ`);
      }

      // Default 404 Route
      return new Response(JSON.stringify({
        status: 'error',
        message: `Endpoint ${path} not found`,
        phase: 'Phase 1.2 - Google Sheets Background Sync Online'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        status: 'error',
        message: err.message || 'Internal Staging Server Error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Helper: Parse JSON Body
 */
async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

/**
 * Helper: Success Response JSON
 */
function successResponse(headers, data, message = 'Success') {
  return new Response(JSON.stringify({
    status: 'success',
    message,
    data
  }), {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

/**
 * Helper: Error Response JSON
 */
function errorResponse(headers, message, status = 400) {
  return new Response(JSON.stringify({
    status: 'error',
    message
  }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}
