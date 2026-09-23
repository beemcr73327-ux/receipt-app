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
  listVouchers,
  batchImportDocuments
} from './services/documentService.js';
import {
  syncReceiptToGoogleSheets,
  syncCancelReceiptToGoogleSheets,
  syncVoucherToGoogleSheets,
  syncCancelVoucherToGoogleSheets
} from './services/googleSheetsSyncService.js';
import {
  createPurchaseTicket,
  getPurchaseTicketByNo as getPurchaseByNo,
  listPurchases,
  getUnassignedPurchases,
  cancelPurchaseTicket
} from './services/rubberPurchaseService.js';
import {
  createLot,
  getLotByNo,
  listLots,
  addTicketsToLot,
  removeTicketFromLot,
  lockLot,
  unlockLot,
  cancelLot
} from './services/rubberLotService.js';
import {
  createSaleRecord,
  settleFactoryResult,
  getSaleByNo,
  getSaleByLotNo,
  listSales,
  cancelSaleRecord
} from './services/rubberSaleService.js';
import {
  getRubberDashboardSummary
} from './services/rubberDashboardService.js';
import {
  createDatabaseSnapshot,
  uploadSnapshotToR2,
  listBackupsFromR2,
  getLatestBackupMetadata
} from './services/backupService.js';
import {
  getDetailedSystemHealth
} from './services/systemHealthService.js';

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key, X-User-Email, X-User-Name, *',
      'Access-Control-Max-Age': '86400',
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
          // Disabled by default (D1 Database Only mode)
          if (env.ENABLE_GOOGLE_SHEETS_SYNC === 'true' && ctx && typeof ctx.waitUntil === 'function') {
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
          // Disabled by default (D1 Database Only mode)
          if (env.ENABLE_GOOGLE_SHEETS_SYNC === 'true' && ctx && typeof ctx.waitUntil === 'function') {
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
          // Disabled by default (D1 Database Only mode)
          if (env.ENABLE_GOOGLE_SHEETS_SYNC === 'true' && ctx && typeof ctx.waitUntil === 'function') {
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
          // Disabled by default (D1 Database Only mode)
          if (env.ENABLE_GOOGLE_SHEETS_SYNC === 'true' && ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(
              syncCancelVoucherToGoogleSheets(voucherNo, reason, env).catch((err) =>
                console.warn('Background Sheets sync failed for cancel voucher:', voucherNo, err.message)
              )
            );
          }

          return successResponse(corsHeaders, cancelled, `ยกเลิกใบสำคัญจ่ายเลขที่ ${voucherNo} สำเร็จ`);
        });
      }

      // 6.5 POST /api/v1/documents/import-batch - นำเข้าข้อมูลใบเสร็จและใบสำคัญจ่ายเดิมแบบ Batch
      if (path === '/api/v1/documents/import-batch' && request.method === 'POST') {
        const body = await parseJsonBody(request);
        const { receipts = [], vouchers = [] } = body;

        const importResult = await batchImportDocuments(env.DB, { receipts, vouchers });

        // Record Audit Log for Data Migration
        try {
          await recordAuditLog(env.DB, {
            actorEmail: request.headers.get('X-User-Email') || 'admin@srisuk-rubber.com',
            actorRole: 'Admin',
            action: 'BATCH_IMPORT_DOCUMENTS',
            resourceType: 'migration',
            resourceId: 'local_to_d1',
            details: {
              importedReceipts: importResult.importedReceipts,
              skippedReceipts: importResult.skippedReceipts,
              importedVouchers: importResult.importedVouchers,
              skippedVouchers: importResult.skippedVouchers
            },
            ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1'
          });
        } catch (auditErr) {
          console.error('Audit log error on import-batch:', auditErr);
        }

        return successResponse(corsHeaders, importResult, importResult.message);
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

      // 8. Rubber Purchases Endpoints (Phase 2.1)
      // 8.1 GET /api/v1/rubber/purchases/unassigned - รายการชั่งซื้อรอจัด Lot
      if (path === '/api/v1/rubber/purchases/unassigned' && request.method === 'GET') {
        const branch = url.searchParams.get('branch');
        const productName = url.searchParams.get('productName') || url.searchParams.get('product');
        const result = await getUnassignedPurchases(env.DB, { branch, productName });
        return successResponse(corsHeaders, result, `ดึงรายการชั่งซื้อรอจัด Lot สำเร็จ (${result.length} รายการ)`);
      }

      // 8.2 POST /api/v1/rubber/purchases - สร้างใบชั่งซื้อใหม่ (PB-YYMMXXXX)
      if (path === '/api/v1/rubber/purchases' && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const createdByEmail = request.headers.get('X-User-Email') || body.createdByEmail || 'system@srisuk-rubber.com';
          const createdByName = decodeHeaderValue(request.headers.get('X-User-Name')) || body.createdByName || 'เจ้าหน้าที่ชั่ง';
          const newPurchase = await createPurchaseTicket(env.DB, body, { createdByEmail, createdByName });
          const ticketNo = newPurchase.ticket_no || newPurchase.purchase_no;
          newPurchase.ticket_no = ticketNo;
          newPurchase.purchase_no = ticketNo;
          return successResponse(corsHeaders, newPurchase, `สร้างใบชั่งซื้อเลขที่ ${ticketNo} สำเร็จ`);
        });
      }

      // 8.3 POST /api/v1/rubber/purchases/:purchaseNo/cancel - ขอยกเลิกใบชั่งซื้อ
      if (path.startsWith('/api/v1/rubber/purchases/') && path.endsWith('/cancel') && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const purchaseNo = decodeURIComponent(path.replace('/api/v1/rubber/purchases/', '').replace('/cancel', '').trim());
          const reason = body.reason || body.cancelReason || 'ยกเลิกรายการ';
          const cancelled = await cancelPurchaseTicket(env.DB, purchaseNo, reason);
          return successResponse(corsHeaders, cancelled, `ยกเลิกใบชั่งซื้อเลขที่ ${purchaseNo} สำเร็จ`);
        });
      }

      // 8.4 GET /api/v1/rubber/purchases/:purchaseNo - ดึงข้อมูลใบชั่งซื้อตามเลขที่
      if (path.startsWith('/api/v1/rubber/purchases/') && !path.endsWith('/cancel') && !path.endsWith('/unassigned') && request.method === 'GET') {
        const purchaseNo = decodeURIComponent(path.replace('/api/v1/rubber/purchases/', '').trim());
        const item = await getPurchaseByNo(env.DB, purchaseNo);
        if (!item) return errorResponse(corsHeaders, `ไม่พบใบชั่งซื้อเลขที่ ${purchaseNo}`, 404);
        return successResponse(corsHeaders, item, `ดึงข้อมูลใบชั่งซื้อ ${purchaseNo} สำเร็จ`);
      }

      // 8.5 GET /api/v1/rubber/purchases - รายการชั่งซื้อทั้งหมด
      if (path === '/api/v1/rubber/purchases' && request.method === 'GET') {
        const branch = url.searchParams.get('branch');
        const productName = url.searchParams.get('productName') || url.searchParams.get('product');
        const status = url.searchParams.get('status');
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const result = await listPurchases(env.DB, { branch, productName, status, startDate, endDate, limit, offset });
        return successResponse(corsHeaders, result, `ดึงรายการชั่งซื้อสำเร็จ (${result.total} รายการ)`);
      }

      // 9. Rubber Lots Endpoints (Phase 2.2)
      // 9.1 POST /api/v1/rubber/lots - สร้าง Lot สินค้าใหม่ (LOT-YYMMXXXX)
      if (path === '/api/v1/rubber/lots' && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const createdByEmail = request.headers.get('X-User-Email') || body.createdByEmail || 'system@srisuk-rubber.com';
          const createdByName = decodeHeaderValue(request.headers.get('X-User-Name')) || body.createdByName || 'ผู้จัดการคลัง';
          const newLot = await createLot(env.DB, body, { createdByEmail, createdByName });
          const lotNo = newLot.lot?.lot_no || newLot.lot_no;
          return successResponse(corsHeaders, newLot, `สร้าง Lot สินค้าเลขที่ ${lotNo} สำเร็จ`);
        });
      }

      // 9.2 POST /api/v1/rubber/lots/:lotNo/lock - ล็อค Lot เพื่อเตรียมจัดส่ง
      if (path.startsWith('/api/v1/rubber/lots/') && path.endsWith('/lock') && request.method === 'POST') {
        const lotNo = decodeURIComponent(path.replace('/api/v1/rubber/lots/', '').replace('/lock', '').trim());
        const lockedLot = await lockLot(env.DB, lotNo);
        return successResponse(corsHeaders, lockedLot, `ล็อค Lot สินค้า ${lotNo} เพื่อเตรียมส่งออกสำเร็จ`);
      }

      // 9.3 POST /api/v1/rubber/lots/:lotNo/unlock - ปลดล็อค Lot
      if (path.startsWith('/api/v1/rubber/lots/') && path.endsWith('/unlock') && request.method === 'POST') {
        const lotNo = decodeURIComponent(path.replace('/api/v1/rubber/lots/', '').replace('/unlock', '').trim());
        const unlockedLot = await unlockLot(env.DB, lotNo);
        return successResponse(corsHeaders, unlockedLot, `ปลดล็อค Lot สินค้า ${lotNo} สำเร็จ`);
      }

      // 9.4 POST /api/v1/rubber/lots/:lotNo/cancel - ยกเลิก Lot สินค้า
      if (path.startsWith('/api/v1/rubber/lots/') && path.endsWith('/cancel') && request.method === 'POST') {
        const lotNo = decodeURIComponent(path.replace('/api/v1/rubber/lots/', '').replace('/cancel', '').trim());
        const body = await parseJsonBody(request);
        const cancelled = await cancelLot(env.DB, lotNo, body.reason || 'ยกเลิก Lot');
        return successResponse(corsHeaders, cancelled, `ยกเลิก Lot สินค้า ${lotNo} สำเร็จ`);
      }

      // 9.5 GET /api/v1/rubber/lots/:lotNo - ดึงข้อมูล Lot ตามเลขที่
      if (path.startsWith('/api/v1/rubber/lots/') && !path.endsWith('/lock') && !path.endsWith('/unlock') && !path.endsWith('/cancel') && request.method === 'GET') {
        const lotNo = decodeURIComponent(path.replace('/api/v1/rubber/lots/', '').trim());
        const lot = await getLotByNo(env.DB, lotNo);
        if (!lot) return errorResponse(corsHeaders, `ไม่พบ Lot เลขที่ ${lotNo}`, 404);
        return successResponse(corsHeaders, lot, `ดึงข้อมูล Lot ${lotNo} สำเร็จ`);
      }

      // 9.6 GET /api/v1/rubber/lots - รายการ Lot ทั้งหมด
      if (path === '/api/v1/rubber/lots' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        const productName = url.searchParams.get('productName') || url.searchParams.get('product');
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const result = await listLots(env.DB, { status, productName, limit, offset });
        return successResponse(corsHeaders, result, `ดึงรายการ Lot สำเร็จ (${result.total} รายการ)`);
      }

      // 10. Rubber Sales Endpoints (Phase 2.3)
      // 10.1 POST /api/v1/rubber/sales - สร้างบิลส่งขายโรงงาน (SL-YYMMXXXX)
      if (path === '/api/v1/rubber/sales' && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const createdByEmail = request.headers.get('X-User-Email') || body.createdByEmail || 'system@srisuk-rubber.com';
          const createdByName = decodeHeaderValue(request.headers.get('X-User-Name')) || body.createdByName || 'เจ้าหน้าที่ฝ่ายขาย';
          const sale = await createSaleRecord(env.DB, body, { createdByEmail, createdByName });
          return successResponse(corsHeaders, sale, `สร้างบิลส่งขายเลขที่ ${sale.sale_no} สำเร็จ`);
        });
      }

      // 10.2 POST /api/v1/rubber/sales/:saleNo/settle - บันทึกผลแล็บ DRC และปิดยอด
      if (path.startsWith('/api/v1/rubber/sales/') && path.endsWith('/settle') && request.method === 'POST') {
        return await handleWithIdempotency(env.DB, request, corsHeaders, async (body) => {
          const saleNo = decodeURIComponent(path.replace('/api/v1/rubber/sales/', '').replace('/settle', '').trim());
          const settled = await settleFactoryResult(env.DB, saleNo, body);
          return successResponse(corsHeaders, settled, `บันทึกผลโรงงานและปิดยอดบิลขาย ${saleNo} สำเร็จ`);
        });
      }

      // 10.3 POST /api/v1/rubber/sales/:saleNo/cancel - ขอยกเลิกบิลส่งขาย
      if (path.startsWith('/api/v1/rubber/sales/') && path.endsWith('/cancel') && request.method === 'POST') {
        const saleNo = decodeURIComponent(path.replace('/api/v1/rubber/sales/', '').replace('/cancel', '').trim());
        const body = await parseJsonBody(request);
        const cancelled = await cancelSaleRecord(env.DB, saleNo, body.reason || 'ยกเลิกบิลขาย');
        return successResponse(corsHeaders, cancelled, `ยกเลิกบิลส่งขาย ${saleNo} สำเร็จ`);
      }

      // 10.4 GET /api/v1/rubber/sales/:saleNo - ดึงข้อมูลบิลขายตามเลขที่
      if (path.startsWith('/api/v1/rubber/sales/') && !path.endsWith('/settle') && !path.endsWith('/cancel') && request.method === 'GET') {
        const saleNo = decodeURIComponent(path.replace('/api/v1/rubber/sales/', '').trim());
        const sale = await getSaleByNo(env.DB, saleNo);
        if (!sale) return errorResponse(corsHeaders, `ไม่พบรายการขายเลขที่ ${saleNo}`, 404);
        return successResponse(corsHeaders, sale, `ดึงข้อมูลบิลขาย ${saleNo} สำเร็จ`);
      }

      // 10.5 GET /api/v1/rubber/sales - รายการบิลส่งขายทั้งหมด
      if (path === '/api/v1/rubber/sales' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        const factory = url.searchParams.get('factory') || url.searchParams.get('destination_factory');
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const result = await listSales(env.DB, { status, factory, limit, offset });
        return successResponse(corsHeaders, result, `ดึงรายการบิลขายสำเร็จ (${result.total} รายการ)`);
      }

      // 11. Rubber Dashboard Analytics Endpoint (Phase 2.4)
      if (path === '/api/v1/rubber/dashboard' && request.method === 'GET') {
        const date = url.searchParams.get('date');
        const summary = await getRubberDashboardSummary(env.DB, date);
        return successResponse(corsHeaders, summary, 'ดึงข้อมูลสรุปภาพรวมระบบซื้อขาย Lot ยางพาราสำเร็จ');
      }

      // 12. Phase 3: Automated Database Backup & System Health Monitoring Endpoints
      // 12.1 GET /api/v1/system/health or /health/detailed - ตรวจสุขภาพระบบเชิงลึก
      if ((path === '/api/v1/system/health' || path === '/health/detailed') && request.method === 'GET') {
        const healthReport = await getDetailedSystemHealth(env);
        const statusCode = healthReport.status === 'HEALTHY' ? 200 : 503;
        return new Response(JSON.stringify(healthReport), {
          status: statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 12.2 POST /api/v1/backup/trigger - สั่งสำรองข้อมูลฉุกเฉิน / On-Demand ทันที
      if (path === '/api/v1/backup/trigger' && request.method === 'POST') {
        if (!env.DB) {
          return errorResponse(corsHeaders, 'D1 Database binding is missing', 500);
        }
        if (!env.BACKUP_BUCKET) {
          return errorResponse(corsHeaders, 'R2 Backup Bucket binding (BACKUP_BUCKET) is not configured', 500);
        }
        const actorEmail = request.headers.get('X-User-Email') || 'admin@srisuk-rubber.com';
        const actorRole = 'Admin';
        const snapshot = await createDatabaseSnapshot(env.DB, { environment: env.ENVIRONMENT || 'staging' });
        const result = await uploadSnapshotToR2(env.BACKUP_BUCKET, snapshot, {
          db: env.DB,
          actorEmail,
          actorRole
        });
        return successResponse(corsHeaders, result, `สำรองข้อมูลลง Cloudflare R2 สำเร็จ (${result.key})`);
      }

      // 12.3 GET /api/v1/backup/list - ดึงรายการไฟล์สำรองข้อมูลใน R2
      if (path === '/api/v1/backup/list' && request.method === 'GET') {
        if (!env.BACKUP_BUCKET) {
          return errorResponse(corsHeaders, 'R2 Backup Bucket binding (BACKUP_BUCKET) is not configured', 500);
        }
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const list = await listBackupsFromR2(env.BACKUP_BUCKET, { limit });
        return successResponse(corsHeaders, list, `ดึงรายการไฟล์สำรองข้อมูลสำเร็จ (${list.length} รายการ)`);
      }

      // 12.4 GET /api/v1/backup/latest - ดึงข้อมูลสรุปการสำรองข้อมูลล่าสุด
      if (path === '/api/v1/backup/latest' && request.method === 'GET') {
        if (!env.BACKUP_BUCKET) {
          return errorResponse(corsHeaders, 'R2 Backup Bucket binding (BACKUP_BUCKET) is not configured', 500);
        }
        const latest = await getLatestBackupMetadata(env.BACKUP_BUCKET);
        if (!latest) {
          return errorResponse(corsHeaders, 'ยังไม่มีประวัติการสำรองข้อมูลใน R2', 404);
        }
        return successResponse(corsHeaders, latest, 'ดึงข้อมูลสรุปการสำรองข้อมูลล่าสุดสำเร็จ');
      }

      // Default 404 Route
      return new Response(JSON.stringify({
        status: 'error',
        message: `Endpoint ${path} not found`,
        phase: 'Phase 3 - Automated R2 Backup & Monitoring Online'
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
  },

  /**
   * Cloudflare Cron Trigger Handler (Phase 3 Daily Automated Backup)
   */
  async scheduled(event, env, ctx) {
    console.log('⏰ Cloudflare Scheduled Event Triggered:', event?.cron, new Date().toISOString());
    if (!env?.DB || !env?.BACKUP_BUCKET) {
      console.warn('⚠️ Scheduled backup skipped: DB or BACKUP_BUCKET binding is missing');
      return;
    }
    try {
      const snapshot = await createDatabaseSnapshot(env.DB, { environment: env.ENVIRONMENT || 'production' });
      const uploadResult = await uploadSnapshotToR2(env.BACKUP_BUCKET, snapshot, {
        db: env.DB,
        actorEmail: 'cron-trigger@srisuk-rubber.com',
        actorRole: 'System'
      });
      console.log('✅ Automated daily backup completed successfully:', uploadResult.key);
    } catch (err) {
      console.error('❌ Automated daily backup failed:', err);
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

/**
 * Helper: Safely decode URI encoded header values (UTF-8 Thai text)
 */
function decodeHeaderValue(val, fallback = '') {
  if (!val) return fallback;
  try {
    return decodeURIComponent(val);
  } catch (e) {
    return val;
  }
}
