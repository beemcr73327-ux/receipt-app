/**
 * Verification Test for Authentication & RBAC System
 * Phase 0.5 - PBKDF2/SHA-256 Hashing, Web Crypto JWT, and Role Enforcement
 */

import {
  generateSalt,
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  createUser,
  authenticateUser,
  seedAdminUser,
  requireAuth,
  requireRole
} from '../services/authService.js';

async function runTests() {
  console.log('🧪 Starting Authentication & RBAC Engine Logic Tests...\n');
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, testName) {
    if (actual === expected) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} (Expected: ${expected}, Got: ${actual})`);
      failed++;
    }
  }

  // 1. Test Salt Generation
  const salt1 = generateSalt();
  const salt2 = generateSalt();
  assertEqual(salt1.length, 32, 'Salt length must be 32 hex characters (16 bytes)');
  assertEqual(salt1 !== salt2, true, 'Salts must be cryptographically random and unique');

  // 2. Test PBKDF2/SHA-256 Hashing
  const password = 'SecurePassword@2026';
  const hash1 = await hashPassword(password, salt1);
  const hash2 = await hashPassword(password, salt1);
  const hashDiffSalt = await hashPassword(password, salt2);

  assertEqual(hash1.length, 64, 'PBKDF2 hash is 64 hex characters (256 bits)');
  assertEqual(hash1 === hash2, true, 'Deterministic hashing with same salt');
  assertEqual(hash1 !== hashDiffSalt, true, 'Rainbow table protection: same password with different salts produces different hashes');

  // 3. Test Password Verification
  const isCorrect = await verifyPassword(password, hash1, salt1);
  const isWrong = await verifyPassword('WrongPassword@123', hash1, salt1);
  assertEqual(isCorrect, true, 'Correct password verifies successfully');
  assertEqual(isWrong, false, 'Incorrect password fails verification');

  // 4. Test Web Crypto JWT Token Creation & Verification
  const testSecret = 'test_srisuk_jwt_secret_xyz123';
  const userPayload = {
    sub: 1,
    email: 'somchai@srisuk-rubber.com',
    fullName: 'สมชาย ศรีสุข',
    role: 'Cashier'
  };

  const token = await signJwt(userPayload, testSecret, 3600); // 1 hour
  assertEqual(token.split('.').length, 3, 'JWT token has valid 3-part structure (Header.Payload.Signature)');

  const decoded = await verifyJwt(token, testSecret);
  assertEqual(decoded.email, 'somchai@srisuk-rubber.com', 'Decoded token email matches payload');
  assertEqual(decoded.role, 'Cashier', 'Decoded token role matches payload');

  // 5. Test JWT Security & Tamper Detection
  let invalidSignatureFailed = false;
  try {
    await verifyJwt(token, 'wrong_secret_key_999');
  } catch (e) {
    invalidSignatureFailed = true;
  }
  assertEqual(invalidSignatureFailed, true, 'JWT with wrong secret key fails verification');

  let expiredTokenFailed = false;
  try {
    const expiredToken = await signJwt(userPayload, testSecret, -10); // expired 10 seconds ago
    await verifyJwt(expiredToken, testSecret);
  } catch (e) {
    expiredTokenFailed = true;
  }
  assertEqual(expiredTokenFailed, true, 'Expired JWT token is detected and rejected');

  // 6. Mock D1 Database for User Management
  const mockUsersTable = [];
  let userAutoIncId = 1;

  const mockDb = {
    prepare(sql) {
      let boundParams = [];
      return {
        bind(...params) {
          boundParams = params;
          return this;
        },
        async first() {
          if (sql.includes('WHERE role = "Admin"') || sql.includes("WHERE role = 'Admin'")) {
            const admin = mockUsersTable.find(u => u.role === 'Admin');
            return admin ? { id: admin.id } : null;
          }
          if (sql.includes('FROM users') && sql.includes('WHERE email = ?')) {
            const email = boundParams[0];
            return mockUsersTable.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
          }
          if (sql.includes('INSERT INTO users')) {
            const [email, password_hash, salt, first_name, last_name, role, status] = boundParams;
            const newUser = {
              id: userAutoIncId++,
              email,
              password_hash,
              salt,
              first_name,
              last_name,
              role,
              status,
              created_at: new Date().toISOString()
            };
            mockUsersTable.push(newUser);
            return newUser;
          }
          return null;
        }
      };
    }
  };

  // 7. Test Admin User Seeding (Genesis)
  const seed1 = await seedAdminUser(mockDb, {
    email: 'admin@srisuk-rubber.com',
    password: 'Admin@Srisuk2026',
    firstName: 'ผู้จัดการ',
    lastName: 'ศรีสุข'
  });
  assertEqual(seed1.created, true, 'Genesis Admin created successfully');
  assertEqual(seed1.admin.email, 'admin@srisuk-rubber.com', 'Admin email assigned correctly');

  // Idempotent seed check: running seed again should not duplicate admin
  const seed2 = await seedAdminUser(mockDb);
  assertEqual(seed2.created, false, 'Admin seed is idempotent (will not create duplicates)');

  // 8. Test Authentication Flow (Login)
  const authSuccess = await authenticateUser(mockDb, 'admin@srisuk-rubber.com', 'Admin@Srisuk2026');
  assertEqual(authSuccess.email, 'admin@srisuk-rubber.com', 'Authentication succeeds for valid admin credentials');
  assertEqual(authSuccess.role, 'Admin', 'User role is correctly loaded as Admin');

  // Login failure tests
  let loginWrongPwFailed = false;
  try {
    await authenticateUser(mockDb, 'admin@srisuk-rubber.com', 'WrongPassword123');
  } catch (e) {
    loginWrongPwFailed = true;
  }
  assertEqual(loginWrongPwFailed, true, 'Authentication fails on invalid password');

  let loginUnknownUserFailed = false;
  try {
    await authenticateUser(mockDb, 'hacker@unknown.com', 'AnyPassword');
  } catch (e) {
    loginUnknownUserFailed = true;
  }
  assertEqual(loginUnknownUserFailed, true, 'Authentication fails for non-existent user');

  // 9. Test Creating Non-Admin User (Cashier)
  const cashierUser = await createUser(mockDb, {
    email: 'cashier1@srisuk-rubber.com',
    password: 'Cashier@Pass2026',
    firstName: 'วิภา',
    lastName: 'ใจดี',
    role: 'User'
  });
  assertEqual(cashierUser.role, 'User', 'Cashier created with User role');

  const cashierAuth = await authenticateUser(mockDb, 'cashier1@srisuk-rubber.com', 'Cashier@Pass2026');
  assertEqual(cashierAuth.fullName, 'วิภา ใจดี', 'Cashier authenticates and returns full name');

  // 10. Test RBAC (Role-Based Access Control) Enforcement
  const adminToken = await signJwt({ sub: seed1.admin.id, email: seed1.admin.email, role: 'Admin' }, testSecret);
  const cashierToken = await signJwt({ sub: cashierUser.id, email: cashierUser.email, role: 'User' }, testSecret);

  function createMockAuthRequest(tokenString) {
    return new Request('http://localhost/api/v1/auth/users', {
      headers: new Headers({
        'Authorization': `Bearer ${tokenString}`
      })
    });
  }

  // Admin accessing Admin route -> Allowed
  const adminReq = createMockAuthRequest(adminToken);
  const authorizedAdmin = await requireRole(adminReq, testSecret, ['Admin']);
  assertEqual(authorizedAdmin.role, 'Admin', 'Admin is authorized to access Admin-only route');

  // Cashier (User) accessing Admin route -> Forbidden
  const cashierReq = createMockAuthRequest(cashierToken);
  let cashierBlocked = false;
  try {
    await requireRole(cashierReq, testSecret, ['Admin']);
  } catch (e) {
    cashierBlocked = true;
  }
  assertEqual(cashierBlocked, true, 'Non-admin user is rejected from Admin-only route (Forbidden)');

  console.log(`\n📊 Auth & RBAC Test Results: ${passed} Passed, ${failed} Failed`);
}

runTests().catch(console.error);
