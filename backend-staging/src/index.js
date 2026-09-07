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

    try {
      // 1. Health Check Endpoint
      if (path === '/health' || path === '/api/health') {
        const d1Connected = !!env.DB;
        return new Response(JSON.stringify({
          status: 'online',
          environment: env.ENVIRONMENT || 'staging',
          service: 'receipt-backend-staging',
          d1BindingReady: d1Connected,
          phase: 'Phase 0.3 - Idempotency Guard Online',
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

      // Default 404 Route
      return new Response(JSON.stringify({
        status: 'error',
        message: `Endpoint ${path} not found`,
        phase: 'Phase 0.2 - Atomic Sequence Engine Ready'
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
