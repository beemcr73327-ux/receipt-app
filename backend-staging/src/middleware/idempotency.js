/**
 * Idempotency Guard Middleware & Utilities
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Phase: 0.3 - Preventing Double Submissions & Concurrent Duplicate Mutations
 */

/**
 * Computes SHA-256 hash of payload using standard Web Crypto API
 * Works across Cloudflare Workers and Node.js v18+
 * @param {string|object} payload
 * @returns {Promise<string>} Hexadecimal SHA-256 string
 */
export async function hashPayload(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Retrieves existing record for an idempotency key from D1
 * @param {Object} db - Cloudflare D1 Database binding
 * @param {string} key - Unique Idempotency Key (UUID)
 * @returns {Promise<Object|null>}
 */
export async function getIdempotentRecord(db, key) {
  if (!key || !db) return null;
  const stmt = db.prepare('SELECT key, endpoint, request_hash, response_body, status_code FROM idempotency_keys WHERE key = ?');
  return await stmt.bind(key).first();
}

/**
 * Saves response for an idempotency key into D1
 * @param {Object} db - Cloudflare D1 Database binding
 * @param {string} key - Unique Idempotency Key (UUID)
 * @param {string} endpoint - API Endpoint pathname
 * @param {string} requestHash - SHA-256 hash of request body
 * @param {string|object} responseBody - The response body to cache
 * @param {number} statusCode - HTTP status code
 */
export async function saveIdempotentRecord(db, key, endpoint, requestHash, responseBody, statusCode = 200) {
  if (!key || !db) return;
  const bodyStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
  
  await db.prepare(`
    INSERT INTO idempotency_keys (key, endpoint, request_hash, response_body, status_code)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      response_body = excluded.response_body,
      status_code = excluded.status_code
  `).bind(key, endpoint, requestHash, bodyStr, statusCode).run();
}

/**
 * High-Order Wrapper for handling requests with Idempotency Guard
 * @param {Object} db - Cloudflare D1 Database binding
 * @param {Request} request - Incoming fetch request
 * @param {Object} corsHeaders - CORS response headers
 * @param {Function} handler - Business logic handler (body, key) => Promise<Response>
 * @returns {Promise<Response>}
 */
export async function handleWithIdempotency(db, request, corsHeaders, handler) {
  const idempotencyKey = request.headers.get('X-Idempotency-Key') || request.headers.get('x-idempotency-key');
  const endpoint = new URL(request.url).pathname;

  let rawBodyText = '';
  let body = {};

  try {
    rawBodyText = await request.clone().text();
    body = rawBodyText ? JSON.parse(rawBodyText) : {};
  } catch (e) {
    body = {};
  }

  // If no idempotency key was provided, proceed normally without caching
  if (!idempotencyKey) {
    return await handler(body, null);
  }

  const requestHash = await hashPayload(rawBodyText);
  const existing = await getIdempotentRecord(db, idempotencyKey);

  if (existing) {
    // 1. Detect Payload Mismatch (Same key used for different request parameters)
    if (existing.request_hash !== requestHash) {
      return new Response(JSON.stringify({
        status: 'error',
        code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        message: 'คำขอปฏิเสธ: มีการนำ Idempotency Key ซ้ำมาใช้กับข้อมูลคำขอที่แตกต่างจากเดิม'
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Cache Hit! Return previous response safely without re-running transaction
    const parsedBody = JSON.parse(existing.response_body);
    return new Response(JSON.stringify({
      ...parsedBody,
      _idempotent: true,
      _cachedAt: existing.created_at || 'hit'
    }), {
      status: existing.status_code || 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Idempotency-Cached': 'HIT',
        'X-Idempotency-Key': idempotencyKey
      }
    });
  }

  // 3. First execution: Run the transaction handler
  const response = await handler(body, idempotencyKey);

  // Cache successful responses and client errors (status < 500)
  if (response.status < 500) {
    try {
      const clonedResp = response.clone();
      const respText = await clonedResp.text();
      await saveIdempotentRecord(db, idempotencyKey, endpoint, requestHash, respText, response.status);
    } catch (saveErr) {
      console.error('Failed to cache idempotency record:', saveErr);
    }
  }

  return response;
}
