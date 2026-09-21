/**
 * Local D1 Server (Zero-Dependency SQLite Runner for Local Development)
 * Project: Receipt & Payment Voucher & Rubber Lot Management System
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 *
 * รันเซิร์ฟเวอร์จำลอง Cloudflare Worker + D1 Local บน Node.js:
 * node backend-staging/src/localServer.js
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';
import worker from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8787;
const DB_FILE = path.join(__dirname, '..', 'local_d1.sqlite');
const SCHEMA_FILE = path.join(__dirname, '..', 'schema.sql');

// 0. Auto-free port if already occupied by an old process
try {
  const pids = execSync(`lsof -ti:${PORT}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  if (pids) {
    for (const pidStr of pids.split(/\s+/)) {
      const pid = parseInt(pidStr, 10);
      if (pid && pid !== process.pid) {
        try {
          process.kill(pid, 'SIGKILL');
          console.log(`🧹 เคลียร์โปรเซสเดิมที่ค้างบนพอร์ต ${PORT} (PID: ${pid}) สำเร็จ`);
        } catch (e) {}
      }
    }
    execSync('sleep 0.3');
  }
} catch (e) {}

console.log('================================================================');
console.log('🚀 เริ่มต้นเซิร์ฟเวอร์จำลอง Cloudflare Worker + D1 Local (v5.0)');
console.log('================================================================');

// 1. Initialize SQLite Database
const db = new DatabaseSync(DB_FILE);
console.log(`📁 ฐานข้อมูล SQLite เชื่อมต่อสำเร็จ: ${DB_FILE}`);

// 2. Initialize Schema if needed
if (fs.existsSync(SCHEMA_FILE)) {
  const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf-8');
  try {
    db.exec(schemaSql);
    console.log('✓ โครงสร้างตาราง (Schema SQL) ถูกติดตั้ง/อัปเดตเรียบร้อยแล้ว');
  } catch (err) {
    console.warn('⚠️ ข้อมูลการรัน Schema:', err.message);
  }
}

// 3. Create Cloudflare D1 Compatibility Wrapper
function createD1Wrapper(sqliteDb) {
  return {
    exec(sql) {
      sqliteDb.exec(sql);
      return Promise.resolve({ success: true });
    },
    prepare(sql) {
      return {
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first(column = null) {
          try {
            const stmt = sqliteDb.prepare(sql);
            const row = stmt.get(...this._params);
            if (!row) return null;
            if (column) return row[column];
            return row;
          } catch (err) {
            console.error('[D1 Wrapper Error - first]', err.message, '\nSQL:', sql, '\nParams:', this._params);
            throw err;
          }
        },
        async all() {
          try {
            const stmt = sqliteDb.prepare(sql);
            const results = stmt.all(...this._params);
            return {
              results: results || [],
              success: true
            };
          } catch (err) {
            console.error('[D1 Wrapper Error - all]', err.message, '\nSQL:', sql, '\nParams:', this._params);
            throw err;
          }
        },
        async run() {
          try {
            const stmt = sqliteDb.prepare(sql);
            const info = stmt.run(...this._params);
            return {
              success: true,
              meta: {
                changes: info.changes,
                last_row_id: info.lastInsertRowid
              }
            };
          } catch (err) {
            console.error('[D1 Wrapper Error - run]', err.message, '\nSQL:', sql, '\nParams:', this._params);
            throw err;
          }
        }
      };
    }
  };
}

// 3.5 Create Local R2 Backup Provider Wrapper
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function createR2Wrapper(baseDir) {
  return {
    async put(key, content, options = {}) {
      const filePath = path.join(baseDir, key);
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      const stringData = typeof content === 'string' ? content : JSON.stringify(content);
      fs.writeFileSync(filePath, stringData, 'utf-8');

      const metaPath = `${filePath}.meta.json`;
      const meta = {
        key,
        size: Buffer.byteLength(stringData),
        uploaded: new Date().toISOString(),
        customMetadata: options.customMetadata || {},
        httpMetadata: options.httpMetadata || {}
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta), 'utf-8');
      return meta;
    },

    async get(key) {
      const filePath = path.join(baseDir, key);
      if (!fs.existsSync(filePath)) return null;
      const textContent = fs.readFileSync(filePath, 'utf-8');
      const metaPath = `${filePath}.meta.json`;
      let customMetadata = {};
      if (fs.existsSync(metaPath)) {
        try { customMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8')).customMetadata || {}; } catch {}
      }
      return {
        key,
        size: Buffer.byteLength(textContent),
        text: () => Promise.resolve(textContent),
        json: () => Promise.resolve(JSON.parse(textContent)),
        customMetadata
      };
    },

    async list(options = {}) {
      const prefix = options.prefix || '';
      const objects = [];

      function walk(dir) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile() && !entry.name.endsWith('.meta.json')) {
            const relKey = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            if (relKey.startsWith(prefix)) {
              const stat = fs.statSync(fullPath);
              const metaPath = `${fullPath}.meta.json`;
              let customMetadata = {};
              if (fs.existsSync(metaPath)) {
                try { customMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8')).customMetadata || {}; } catch {}
              }
              objects.push({
                key: relKey,
                size: stat.size,
                uploaded: stat.mtime.toISOString(),
                customMetadata
              });
            }
          }
        }
      }

      walk(baseDir);
      return {
        objects: objects.slice(0, options.limit || 50),
        truncated: false
      };
    }
  };
}

const mockEnv = {
  DB: createD1Wrapper(db),
  BACKUP_BUCKET: createR2Wrapper(BACKUP_DIR),
  ENVIRONMENT: 'staging-local',
  JWT_EXPIRATION_HOURS: '24',
  GOOGLE_SHEETS_WEBHOOK: 'https://script.google.com/macros/s/dummy/exec'
};

// 4. Create HTTP Server bridging to worker.fetch
const requestHandler = async (req, res) => {
  const timestamp = new Date().toLocaleTimeString('th-TH');

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    console.log(`[${timestamp}] 🟡 OPTIONS ${req.url} (CORS Preflight)`);
    const reqHeaders = req.headers['access-control-request-headers'];
    res.writeHead(200, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'access-control-allow-headers': reqHeaders || 'Content-Type, Authorization, X-Idempotency-Key, X-User-Email, X-User-Name, *',
      'access-control-max-age': '86400'
    });
    res.end();
    return;
  }

  // Read request body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const bodyBuffer = Buffer.concat(chunks);

  const fullUrl = `http://127.0.0.1:${PORT}${req.url}`;
  const workerHeaders = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => workerHeaders.append(key, v));
      } else {
        workerHeaders.set(key, value);
      }
    }
  }

  const workerRequest = new Request(fullUrl, {
    method: req.method,
    headers: workerHeaders,
    body: req.method !== 'GET' && req.method !== 'HEAD' && bodyBuffer.length > 0 ? bodyBuffer : undefined
  });

  try {
    const workerResponse = await worker.fetch(workerRequest, mockEnv, {});

    // Collect all headers in strictly lowercase to prevent duplicate CORS headers
    const responseHeaders = {};
    for (const [key, val] of workerResponse.headers.entries()) {
      responseHeaders[key.toLowerCase()] = val;
    }
    // Guarantee clean CORS headers (single instance)
    responseHeaders['access-control-allow-origin'] = '*';
    responseHeaders['access-control-allow-headers'] = 'Content-Type, Authorization, X-Idempotency-Key, X-User-Email, X-User-Name, *';
    responseHeaders['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';

    res.writeHead(workerResponse.status, responseHeaders);
    const resBody = await workerResponse.arrayBuffer();
    res.end(Buffer.from(resBody));

    console.log(`[${timestamp}] 🟢 ${req.method} ${req.url} -> ${workerResponse.status}`);
  } catch (err) {
    console.error(`[${timestamp}] 🔴 ERROR ${req.method} ${req.url}:`, err.message);
    res.writeHead(500, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Content-Type, Authorization, X-Idempotency-Key, X-User-Email, X-User-Name, *',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    });
    res.end(JSON.stringify({ status: 'error', message: err.message }));
  }
};

// Bind IPv4 (0.0.0.0 covers 127.0.0.1 and localhost)
const server = http.createServer(requestHandler);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ พอร์ต ${PORT} กำลังถูกใช้งานอยู่โดยโปรเซสอื่น`);
    console.error(`💡 กรุณารันคำสั่งนี้ใน Terminal เพื่อเคลียร์พอร์ต: kill -9 $(lsof -ti:${PORT})\n`);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✨ เซิร์ฟเวอร์ Staging ทำงานพร้อมรับการเชื่อมต่อแล้วที่: http://localhost:${PORT}`);
  console.log(`• หรือเชื่อมต่อผ่าน: http://127.0.0.1:${PORT}`);
  console.log(`• Health Check: http://127.0.0.1:${PORT}/health`);
  console.log(`• ทดสอบในหน้าเว็บ: ไปที่ "ตั้งค่าระบบ" -> เลือกโหมด "Staging Mode"`);
  console.log(`• กด Ctrl + C เพื่อหยุดการทำงาน\n`);
});

// Bind IPv6 (::1) เพิ่มเติมสำหรับ macOS
try {
  const serverIpv6 = http.createServer(requestHandler);
  serverIpv6.listen(PORT, '::1', () => {});
  serverIpv6.on('error', () => {});
} catch (e) {}
