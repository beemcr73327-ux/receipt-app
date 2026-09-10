/**
 * Authentication & RBAC Service (Phase 0.5)
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Cryptography: PBKDF2/SHA-256 + Unique Salt & Native Web Crypto JWT (Zero External Dependencies)
 */

/**
 * Converts ArrayBuffer / Uint8Array to Hex string
 */
function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts Hex string to Uint8Array
 */
function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Base64URL Encoding/Decoding
 */
function base64UrlEncode(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(base64Url) {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Generates cryptographically secure random 16-byte salt (32 hex chars)
 */
export function generateSalt() {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  return bufferToHex(saltBytes);
}

/**
 * Derives PBKDF2/SHA-256 hash from password and salt
 * @param {string} password
 * @param {string} saltHex
 * @param {number} iterations
 * @returns {Promise<string>} 64-character Hex string
 */
export async function hashPassword(password, saltHex, iterations = 100000) {
  const pwBuffer = new TextEncoder().encode(password);
  const saltBuffer = hexToBuffer(saltHex);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    pwBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    256 // 32 bytes (256 bits)
  );

  return bufferToHex(derivedBits);
}

/**
 * Timing-safe password verification
 */
export async function verifyPassword(password, storedHash, saltHex, iterations = 100000) {
  const computedHash = await hashPassword(password, saltHex, iterations);
  if (computedHash.length !== storedHash.length) return false;

  let match = 0;
  for (let i = 0; i < computedHash.length; i++) {
    match |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return match === 0;
}

/**
 * Generates and signs a JWT Token using HMAC-SHA256
 * @param {Object} payloadData
 * @param {string} secret
 * @param {number} expiresInSeconds (Default: 24 Hours)
 * @returns {Promise<string>} Encoded JWT string
 */
export async function signJwt(payloadData, secret = 'default_srisuk_jwt_secret', expiresInSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...payloadData,
    iat: now,
    exp: now + expiresInSeconds
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(dataToSign)
  );

  const signatureB64 = base64UrlEncode(
    Array.from(new Uint8Array(signatureBuffer)).map(b => String.fromCharCode(b)).join('')
  );

  return `${dataToSign}.${signatureB64}`;
}

/**
 * Verifies a JWT Token and decodes payload
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<Object>} Decoded payload if valid
 */
export async function verifyJwt(token, secret = 'default_srisuk_jwt_secret') {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or invalid format');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT structure');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const dataToSign = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Decode binary signature from base64url
  const rawSig = base64UrlDecode(signatureB64);
  const sigBytes = new Uint8Array(rawSig.length);
  for (let i = 0; i < rawSig.length; i++) {
    sigBytes[i] = rawSig.charCodeAt(i);
  }

  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(dataToSign)
  );

  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error('JWT Token has expired');
  }

  return payload;
}

/**
 * Creates a new user in D1 Database
 */
export async function createUser(db, { email, password, firstName, lastName, role = 'User', status = 'Approved' }) {
  if (!email || !password || !firstName || !lastName) {
    throw new Error('Email, password, first_name and last_name are required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const result = await db.prepare(`
    INSERT INTO users (email, password_hash, salt, first_name, last_name, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING id, email, first_name, last_name, role, status, created_at
  `).bind(normalizedEmail, passwordHash, salt, firstName.trim(), lastName.trim(), role, status).first();

  return result;
}

/**
 * Authenticates user credentials against D1
 */
export async function authenticateUser(db, email, password) {
  if (!email || !password) {
    throw new Error('กรุณาระบุอีเมลและรหัสผ่าน');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.prepare(`
    SELECT id, email, password_hash, salt, first_name, last_name, role, status
    FROM users
    WHERE email = ?
  `).bind(normalizedEmail).first();

  if (!user) {
    throw new Error('ไม่พบบัญชีผู้ใช้งานในระบบ');
  }

  if (user.status !== 'Approved') {
    throw new Error(`บัญชีของคุณอยู่ในสถานะ: ${user.status} ไม่สามารถเข้าใช้งานได้`);
  }

  const isMatch = await verifyPassword(password, user.password_hash, user.salt);
  if (!isMatch) {
    throw new Error('รหัสผ่านไม่ถูกต้อง');
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName: `${user.first_name} ${user.last_name}`,
    role: user.role,
    status: user.status
  };
}

/**
 * Seeds Genesis Administrator user if no admin exists
 */
export async function seedAdminUser(db, adminData = {}) {
  const defaultAdmin = {
    email: adminData.email || 'admin@srisuk-rubber.com',
    password: adminData.password || 'Admin@Srisuk2026',
    firstName: adminData.firstName || 'ผู้ดูแลระบบ',
    lastName: adminData.lastName || 'ศรีสุขพูนทรัพย์',
    role: 'Admin',
    status: 'Approved'
  };

  const existing = await db.prepare('SELECT id FROM users WHERE role = "Admin" LIMIT 1').first();
  if (existing) {
    return {
      created: false,
      message: 'มีบัญชี Admin ในระบบอยู่แล้ว',
      adminId: existing.id
    };
  }

  const newAdmin = await createUser(db, defaultAdmin);
  return {
    created: true,
    message: 'สร้างบัญชีปฐมบท Admin สำเร็จเรียบร้อยแล้ว',
    admin: newAdmin
  };
}

/**
 * Helper: Extracts Bearer token from Request Authorization Header
 */
export function extractBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7).trim();
}

/**
 * Middleware: Verifies Authentication from Request
 */
export async function requireAuth(request, secret) {
  const token = extractBearerToken(request);
  if (!token) {
    throw new Error('Unauthorized: กรุณาเข้าสู่ระบบ (Missing Bearer Token)');
  }
  return await verifyJwt(token, secret);
}

/**
 * Middleware: Verifies Role Permission from Request
 */
export async function requireRole(request, secret, allowedRoles = ['Admin']) {
  const user = await requireAuth(request, secret);
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Forbidden: สิทธิ์ ${user.role} ไม่สามารถเข้าถึงส่วนนี้ได้ (ต้องการ: ${allowedRoles.join('/')})`);
  }
  return user;
}
