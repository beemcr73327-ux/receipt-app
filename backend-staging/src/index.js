/**
 * Cloudflare Worker Backend (Staging Environment)
 * Project: Receipt & Payment Voucher & Rubber Lot Management System
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 0.1 Foundation Entry Point)
 */

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
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. Default 404 Route for unhandled paths in Phase 0.1
      return new Response(JSON.stringify({
        status: 'error',
        message: `Endpoint ${path} is not implemented yet in Phase 0.1`,
        phase: 'Phase 0.1 - Foundation Schema Ready'
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
