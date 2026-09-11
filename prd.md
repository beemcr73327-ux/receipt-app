# 📄 Product Requirement Document (PRD) — Financial & Rubber Lot Management System

> **ระบบออกใบเสร็จรับเงิน ใบสำคัญจ่าย บันทึกบัญชี และระบบซื้อขาย Lot ยางพารา**  
> **บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด**  
> **เวอร์ชันเอกสาร:** 5.0  
> **วันที่อัปเดตล่าสุด:** 11 กันยายน 2569 (2026-09-11)

---

## 1. 🎯 วัตถุประสงค์ของโปรเจกต์ (Project Overview & Objectives)

ระบบเว็บแอปพลิเคชันบริหารจัดการเอกสารทางการเงิน การบัญชี และระบบซื้อขาย Lot ยางพารา พัฒนาขึ้นเพื่อทดแทนกระดาษ ลดความผิดพลาดในการคำนวณเงินสด/ส่วนลด/DRC และยกระดับสู่สถาปัตยกรรมระดับองค์กร (Enterprise Edge Architecture) โดยครอบคลุม 4 โมดูลหลัก:

1. **ระบบออกใบเสร็จรับเงิน (Receipt Management):** สร้าง ค้นหา ยกเลิก และพิมพ์ใบเสร็จรับเงินมาตรฐาน A4 (ธีมสีเขียวมรกต Emerald)
2. **ระบบออกใบสำคัญจ่าย (Payment Voucher Management):** สร้าง ค้นหา ยกเลิก และพิมพ์ใบสำคัญจ่ายมาตรฐาน A4 พร้อมแปลงตัวเลขเป็นคำอ่านภาษาไทย (ธีมสีแดงกุหลาบ Rose)
3. **ระบบบันทึกข้อมูลบัญชี (Bank Account Management):** จัดการบัญชีธนาคารสำหรับรับชำระเงินและจ่ายเงิน พร้อมไอคอนทางการของธนาคารไทยครบวงจร
4. **ระบบซื้อขาย Lot ยางพาราและสต็อกสินค้า (Rubber Lot Trading & Stock):** บันทึกการชั่งซื้อยาง, จัดกลุ่มรายการซื้อเข้า Lot, ออกบิลขายส่งโรงงาน, บันทึกผลชั่ง/DRC จริง, และคำนวณสรุปผลกำไร-ขาดทุน (P&L Dashboard)

---

## 2. 🏛️ โครงสร้างสถาปัตยกรรมระบบ (System Architecture)

### 2.1 สถาปัตยกรรมเป้าหมายเวอร์ชัน 5.0 (Target Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite + Tailwind CSS)          │
│  ├── ReceiptForm / ReceiptHistoryModal / PrintReceipt                  │
│  ├── VoucherForm / VoucherHistoryModal / PrintVoucher                  │
│  ├── BankAccountManagement / ThaiBankLogo                              │
│  └── LotManagement / WeighingForm / PnLDashboard (Phase 2)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (RESTful API / JWT Bearer / Idempotency Key)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Cloudflare Worker Backend (Application Layer)              │
│  ├── Authentication (PBKDF2/SHA-256 Hashing + JWT + RBAC)              │
│  ├── Atomic Sequence Engine (YYMMXXXX Generator & Manual Seed)         │
│  ├── Idempotency Guard (UUIDv4 Anti-duplicate Lock)                    │
│  ├── Immutable Audit Logger (SHA-256 Hash Chaining)                    │
│  └── Business Logic & Sync Service                                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────────────┐          ┌──────────────────────┐
│  Cloudflare D1 (SQLite Database)     │          │ Cloudflare R2        │
│  - Single Source of Truth (SSOT)     │          │ - Automated Backup   │
│  - Normalized Header/Items Tables    │          └──────────────────────┘
│  - Strict Constraints & FK Locks     │                     │ (Sync Service)
└──────────────────────────────────────┘                     ▼
                                                  ┌──────────────────────┐
                                                  │ Google Sheets        │
                                                  │ - Read-Only Report   │
                                                  └──────────────────────┘
```

---

## 3. 📊 โครงสร้างฐานข้อมูล (Database Schema)

### 3.1 โครงสร้างฐานข้อมูล Cloudflare D1 (Primary SSOT Database)
*ออกแบบตามหลัก Normalized Database เพื่อความรวดเร็วและความปลอดภัยสูงสุด*

| ตาราง (Table) | หน้าที่การทำงาน | ฟิลด์สำคัญ (Key Columns) |
|:---|:---|:---|
| **`users`** | ข้อมูลพนักงานและสิทธิ์ | `id`, `email`, `password_hash`, `salt`, `first_name`, `last_name`, `role` (Admin/Manager/User), `status` |
| **`master_banks`** | สมุดบัญชีธนาคาร | `id`, `short_code`, `bank_name`, `account_no` (UNIQUE), `account_name`, `branch`, `usage` (ALL/PV) |
| **`receipts`** | หัวใบเสร็จรับเงิน (Header) | `id`, `receipt_no` (UNIQUE), `doc_date`, `buyer_name`, `buyer_tax_id`, `payment_method`, `status`, `cashier_name` |
| **`receipt_items`** | รายการย่อยในใบเสร็จ (Items) | `id`, `receipt_id` (FK), `item_title`, `quantity`, `unit_price`, `drc_percent`, `discount_amount`, `net_amount` |
| **`vouchers`** | หัวใบสำคัญจ่าย (Header) | `id`, `voucher_no` (UNIQUE), `doc_date`, `receiver_name`, `overall_description`, `bank_account`, `status`, `cashier_name` |
| **`voucher_items`** | รายการย่อยใบสำคัญจ่าย (Items) | `id`, `voucher_id` (FK), `item_date`, `description`, `amount` |
| **`document_sequences`** | ตัวนับเลขที่เอกสาร Atomic | `doc_type`, `prefix` (e.g. 6909), `current_seq`, `manual_seed`, `updated_at` (PK: doc_type, prefix) |
| **`idempotency_keys`** | ป้องกันการกดส่งซ้ำ | `key` (UUID), `endpoint`, `request_hash`, `response_body`, `status_code`, `created_at` |
| **`audit_logs`** | กล่องดำบันทึกประวัติการเงิน | `id`, `prev_hash`, `record_hash`, `actor_email`, `action`, `resource_type`, `resource_id`, `details_json` |

---

### 3.2 โครงสร้างฐานข้อมูลเดิมใน Google Sheets (Reporting Layer)

* **ใบเสร็จรับเงิน (Receipts):** 20 คอลัมน์ (วันที่, เลขที่ใบเสร็จ, นามผู้ซื้อ, ที่อยู่, เลขผู้เสียภาษี, งวด, รายการ, จำนวน, ราคา, DRC, เพิ่มลด, รายละเอียด, จำนวนเงินสุทธิ, ชำระโดย, วันที่โอน, หมายเหตุ, ผู้รับเงิน, สถานะ, สาเหตุยกเลิก, วันที่พิมพ์)
* **ใบสำคัญจ่าย (Payment Vouchers):** 16 คอลัมน์ (Timestamp, เลขที่เอกสาร, จ่ายให้, คำอธิบายรวม, วันที่เอกสาร, เอกสารอ้างอิง, วันที่รายการย่อย, รายการ, จำนวนเงิน, ชำระโดย, เลขที่เช็ค, ธนาคาร, วันที่ชำระเงิน, หมายเหตุ, ผู้จัดทำ, สถานะ)
* **Master_Banks:** 6 คอลัมน์ (ตัวย่อ, ชื่อธนาคาร, เลขที่บัญชี, ชื่อบัญชี, สาขา, สิทธิ์การใช้งาน)

---

## 4. 🛡️ กลไกหลักด้านความปลอดภัยทางบัญชี (Core Primitives)

### 4.1 Atomic Sequence Generator (Phase 0.2 ✅ เสร็จสมบูรณ์)
- **ตำแหน่งไฟล์:** [`backend-staging/src/services/sequenceService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/sequenceService.js), [`dateUtils.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/utils/dateUtils.js)
- **หลักการทำงาน:** รันเลขที่เอกสารจากเซิร์ฟเวอร์แบบ Atomic ผ่าน SQLite Upsert (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING current_seq`) บนตาราง `document_sequences` ป้องกันเลขซ้ำหรือชนกันแม้มีผู้ใช้งานกดพร้อมกันหลายเครื่อง
- **รูปแบบรหัส:** `YYMMXXXX` (ปี พ.ศ. 2 หลัก + เดือน 2 หลัก + ลำดับ 4 หลัก เช่น `69090001` ถึง `69099999`)
- **Manual Seed Config:** แอดมินสามารถกำหนดเลขเริ่มต้นของแต่ละเดือนได้ (เช่น เริ่มที่ 500) และมี Guard ป้องกันการปรับตัวเลขนับถอยหลังต่ำกว่าเลขเอกสารที่เคยออกไปแล้ว
- **API Endpoints:**
  - `POST /api/v1/sequence/next` — ขอเลขที่เอกสารถัดไปแบบ Atomic
  - `GET /api/v1/sequence/preview` — ดูตัวอย่างเลขถัดไปโดยไม่เพิ่มตัวนับจริง
  - `POST /api/v1/sequence/seed` — ตั้งค่าเลขเริ่มต้นของงวด
  - `GET /api/v1/sequence/status` — ตรวจสอบสถานะตัวนับปัจจุบัน
- **ผลการทดสอบ:** ผ่านการทดสอบ Unit Test ครบ 13/13 รายการ (`verifySequence.js`)

### 4.2 Idempotency Guard (Phase 0.3 ✅ เสร็จสมบูรณ์)
- **ตำแหน่งไฟล์:** [`backend-staging/src/middleware/idempotency.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/middleware/idempotency.js)
- **หลักการทำงาน:** ใช้ HTTP Header `X-Idempotency-Key` (UUIDv4) ร่วมกับการคำนวณ SHA-256 Request Payload Hash เพื่อรับประกันว่าการทำธุรกรรมจะเกิดขึ้น **เพียงครั้งเดียวแน่นอน (Exactly-Once Semantics)**
- **การจัดการสถานการณ์ซ้ำ (Duplicate Replay):** หากส่งคำขอซ้ำด้วย Key และข้อมูลเดิม ระบบจะดึงผลลัพธ์เดิมที่แคชไว้ในตาราง `idempotency_keys` ส่งกลับทันที โดยไม่รันธุรกรรมซ้ำ ไม่บวกเลขบิลเพิ่ม พร้อมแนบ Header `X-Idempotency-Cached: HIT` และแฟล็ก `_idempotent: true`
- **การตรวจจับความผิดปกติ (Payload Mismatch):** หากมีการนำ Key เดิมมาสวมรอยส่งข้อมูลต่างไปจากเดิม ระบบจะปฏิเสธคำขอทันทีด้วยรหัส HTTP `409 Conflict (IDEMPOTENCY_PAYLOAD_MISMATCH)`
- **ผลการทดสอบ:** ผ่านการทดสอบ Unit Test ครบ 15/15 รายการ (`verifyIdempotency.js`)

### 4.3 Immutable Audit Trail (Phase 0.4 ✅ เสร็จสมบูรณ์)
- **ตำแหน่งไฟล์:** [`backend-staging/src/services/auditService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/auditService.js)
- **หลักการทำงาน:** บันทึกประวัติกิจกรรมทางการเงินลงในตาราง `audit_logs` แบบ Insert-Only โดยแต่ละรายการจะดึงรหัส SHA-256 ของรายการก่อนหน้า (`prev_hash`) มาร้อยเรียงต่อกันเป็นสายโซ่ข้อมูลแบบบล็อกเชน (Blockchain-like Hash Chaining)
- **ระบบตรวจจับการทุจริตและการแอบแก้ไขย้อนหลัง (Tamper Detection Engine):** ฟังก์ชัน `verifyChainIntegrity` ทำการตรวจสอบความถูกต้องของสายโซ่ตั้งแต่แถวแรกจนถึงแถวล่าสุด หากมีการแอบแก้ไขตัวเลข หรือลบแถวทิ้ง ระบบจะตรวจพบและชี้เป้าระบุ ID ที่เสียหายได้ทันที
- **API Endpoints:**
  - `GET /api/v1/audit/verify` — ตรวจสอบความสมบูรณ์และโปร่งใสของสายใยข้อมูล (สำหรับผู้สอบบัญชี)
  - `GET /api/v1/audit/logs` — ค้นหาและดูประวัติย้อนหลัง พร้อมระบบ Filter และ Pagination
- **ผลการทดสอบ:** ผ่านการทดสอบ Unit Test ครบ 20/20 รายการ (`verifyAuditLog.js`)

### 4.4 Authentication & RBAC System (Phase 0.5 ✅ เสร็จสมบูรณ์)
- **ตำแหน่งไฟล์:** [`backend-staging/src/services/authService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/authService.js)
- **หลักการทำงาน:** ระบบยืนยันตัวตนและควบคุมการเข้าถึงระดับองค์กรโดยใช้ Native Web Crypto API ในตัว Cloudflare Worker (Zero External Library)
  - **Password Security:** แฮชรหัสผ่านด้วย PBKDF2/SHA-256 จำนวน 100,000 รอบ พร้อมสุ่ม Salt 16 ไบต์ (32 ตัวอักษร) ประจำตัวผู้ใช้แต่ละคน ป้องกัน Rainbow Table Attack
  - **Native Web Crypto JWT:** ออกและตรวจสอบโทเค็น JSON Web Token (HMAC-SHA256) พร้อมกำหนดอายุโทเค็น (24 ชั่วโมง)
  - **Role-Based Access Control (RBAC):** กำหนดสิทธิ์ตามบทบาท (`Admin`, `Manager`, `User`/`Cashier`) พร้อม Middleware ตรวจสอบสิทธิ์ `requireAuth` และ `requireRole`
  - **Genesis Admin Seeding:** ระบบสร้างผู้ดูแลระบบคนแรกของบริษัท (`seedAdminUser`) แบบปลอดภัย
- **API Endpoints:**
  - `POST /api/v1/auth/seed-admin` — สร้างแอดมินคนแรกของระบบ
  - `POST /api/v1/auth/login` — เข้าสู่ระบบ ตรวจสอบรหัสผ่าน และรับ JWT Token
  - `GET /api/v1/auth/me` — ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบันจาก Token
  - `POST /api/v1/auth/users` — แอดมินสร้างบัญชีพนักงานใหม่
- **ผลการทดสอบ:** ผ่านการทดสอบ Unit Test ครบ 23/23 รายการ (`verifyAuth.js`)

### 4.5 Complete Document CRUD Engine (Phase 1.1 ✅ เสร็จสมบูรณ์)
- **ตำแหน่งไฟล์:** [`backend-staging/src/services/documentService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/documentService.js)
- **หลักการทำงาน:** จัดการเอกสารใบเสร็จรับเงิน (Receipts) และใบสำคัญจ่าย (Payment Vouchers) ครบวงจรบนฐานข้อมูล Normalized D1 (Header + Items Tables)
  - **ระบบคำนวณราคายางพารา:** คำนวณยอดเงินสุทธิอัตโนมัติรองรับน้ำหนัก, ราคาต่อหน่วย, DRC%, และส่วนลดเพิ่มลด (`(quantity * unitPrice * DRC%) - discount`)
  - **ระบบบันทึกใบสำคัญจ่าย:** จัดการรายการจ่ายเงินหลายรายการย่อย เชื่อมโยงบัญชีบริษัทและบัญชีปลายทาง
  - **ระบบยกเลิกเอกสารแบบมีประวัติ (Soft Cancel):** ปรับสถานะเป็น "ยกเลิก" บันทึกเหตุผล ผู้ยกเลิก และเวลา โดยไม่ลบประวัติเดิม พร้อมระบบป้องกันการกดยกเลิกซ้ำ
  - **การประสานความปลอดภัย:** เชื่อมต่อกับ Atomic Sequence Engine, Idempotency Guard (ป้องกัน Double Submission), และ Immutable Audit Trail ทุกขั้นตอน
- **API Endpoints:**
  - `POST /api/v1/receipts` — ออกใบเสร็จรับเงินใหม่ (Idempotent)
  - `GET /api/v1/receipts` — ค้นหาและดูรายการใบเสร็จ (Pagination & Filters)
  - `GET /api/v1/receipts/:receiptNo` — ดูรายละเอียดใบเสร็จพร้อมรายการสินค้า
  - `POST /api/v1/receipts/:receiptNo/cancel` — ขอยกเลิกใบเสร็จรับเงิน
  - `POST /api/v1/vouchers` — ออกใบสำคัญจ่ายใหม่ (Idempotent)
  - `GET /api/v1/vouchers` — ค้นหาและดูรายการใบสำคัญจ่าย (Pagination & Filters)
  - `GET /api/v1/vouchers/:voucherNo` — ดูรายละเอียดใบสำคัญจ่าย
  - `POST /api/v1/vouchers/:voucherNo/cancel` — ขอยกเลิกใบสำคัญจ่าย
- **ผลการทดสอบ:** ผ่านการทดสอบ Unit Test ครบ 20/20 รายการ (`verifyDocuments.js`)

### 4.6 Google Sheets Background Sync Service (Phase 1.2 ✅ เสร็จสมบูรณ์)
- **ตำแหน่งไฟล์:** [`backend-staging/src/services/googleSheetsSyncService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/googleSheetsSyncService.js)
- **หลักการทำงาน:** ซิงค์ข้อมูลจาก Cloudflare Worker ไปยัง Google Sheets แบบ Asynchronous / Non-blocking ด้วย `ctx.waitUntil(...)`
  - **Sub-50ms Response Time:** ผู้ใช้งานได้รับผลการบันทึกเอกสารทันทีหลังจากเขียนลง D1 โดยไม่ต้องรอการเขียนลง Google Sheets (1-3 วินาที)
  - **Schema Mapping:** แปลงโครงสร้าง Normalized Header-Items ใน D1 เป็น 20 คอลัมน์สำหรับใบเสร็จรับเงิน และ 18 คอลัมน์สำหรับใบสำคัญจ่ายตามฟอร์แมตเดิมของ Google Sheets อย่างแม่นยำ
  - **Resilience & Timeout Guard:** ดักจับข้อผิดพลาดและมีระบบ AbortController Timeout ไม่ให้กระทบการทำงานหลักของระบบ
- **API Endpoints:**
  - `POST /api/v1/sync/receipts/:receiptNo` — สั่งซิงค์ใบเสร็จไปยัง Google Sheets ด้วยตนเอง
  - `POST /api/v1/sync/vouchers/:voucherNo` — สั่งซิงค์ใบสำคัญจ่ายไปยัง Google Sheets ด้วยตนเอง
- **ผลการทดสอบ:** ผ่านการทดสอบ Unit Test ครบ 16/16 รายการ (`verifyGoogleSheetsSync.js`)

### 4.7 Frontend Migration & Backend Engine Toggle (Phase 1.3 ✅ เสร็จสมบูรณ์)
- **ตำแหน่งไฟล์:**
  - [`src/services/stagingApiClient.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/services/stagingApiClient.js) — Staging API Client พร้อมฉีด `X-Idempotency-Key` (UUIDv4) อัตโนมัติ
  - [`src/services/storageService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/services/storageService.js) — สลับเส้นทางการบันทึก/ยกเลิกเอกสารอัตโนมัติตามโหมด `apiMode`
  - [`src/components/SettingsModal.jsx`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/components/SettingsModal.jsx) — ตัวสลับ Backend Engine (Production vs Staging 5.0) พร้อมปุ่มทดสอบ Health Check + วัด Latency
  - [`src/components/Sidebar.jsx`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/components/Sidebar.jsx) & [`src/components/Header.jsx`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/components/Header.jsx) — ป้ายสถานะ `⚡ Staging Mode 5.0`
  - [`backend-staging/demo/index.html`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/demo/index.html) — Interactive Staging Demo Studio
- **หลักการทำงาน:**
  - **Zero-Risk Preservation:** ค่าเริ่มต้นเป็น `'production'` เสมอ เพื่อให้ผู้ใช้งานเดิมไม่ได้รับผลกระทบใดๆ
  - **Seamless Switching:** เมื่อเปิดโหมด Staging หน้าบ้านจะส่งคำขอตรงเข้า Cloudflare Worker Edge D1 Backend พร้อมรับมือการคำนวณ DRC และบันทึกลง D1
  - **Interactive Health Test:** ผู้ดูแลระบบสามารถกดทดสอบการเชื่อมต่อ API เช็คความพร้อมของ D1 Database และวัดค่า Ping Latency ได้จากหน้าตั้งค่า
- **ผลการทดสอบ:** ผ่านการทดสอบ Unit Test ครบ 8/8 รายการ (`verifyStagingClient.js`) และ Vite Build ผ่านสมบูรณ์แบบ 100%

---

## 5. 🎨 มาตรฐาน UX/UI & การออกแบบระบบ

1. **แบ่งแยกธีมสีชัดเจน:** เขียวมรกต (`Emerald`) สำหรับรายรับ (ใบเสร็จ) และแดงกุหลาบ (`Rose`) สำหรับรายจ่าย (ใบสำคัญจ่าย)
2. **ไอคอนธนาคารไทยทางการครบวงจร:** ขนาด `w-8 h-8` (32x32px) พร้อม Fallback
3. **ฟอร์แมตเลขบัญชี 3-3-4 (`xxx-xxx-xxxx`):** แสดงผลสะอาดตา บันทึกลงฐานข้อมูลเป็นตัวเลขล้วน
4. **Full-height Workspace Layout:** หน้าจอตารางขยายเต็มความสูง ล็อคหัวตาราง `sticky top-0`
5. **ระบบ Filter Bar & Pagination:** กรองตามสถานะ, ช่วงเวลาด่วน, ปฏิทิน, ค้นหาเรียลไทม์ และเลือกขนาดหน้าได้ (10/20/50/100 แถว)
6. **Leading Zero Protection:** ป้องกันเลข 0 หายด้วยการใส่ `'` ในฝั่งชีต และล้างออกเพื่อแสดงผลตัวเลขสะอาดบนหน้าเว็บ
7. **Environment Badge:** ป้ายกำกับสถานะระบบ Staging ชัดเจน เพื่อความโปร่งใสและปลอดภัย
8. **🔒 Strict UX/UI Design Lock Policy (ล็อคการออกแบบ UX/UI 100%):** หน้าตา ดีไซน์ เลย์เอาต์ สี ฟอนต์ และการจัดวางของทุกหน้าจอในระบบ (`ReceiptForm`, `VoucherForm`, `HistoryModal`, `Print Templates`, `BankAccountManagement`, `Sidebar`) ถือเป็นข้อสรุปที่สมบูรณ์และพึงพอใจแล้ว **ห้ามแก้ไขหรือเปลี่ยนแปลงเด็ดขาด** การพัฒนาในเฟสต่อๆ ไป (รวมถึง Phase 2) จะดำเนินการเฉพาะฝั่ง Backend, Database Schema, Calculation Engine และ API โดยไม่แตะต้อง UX/UI เดิม

---

## 6. 📜 ประวัติการอัปเดตเวอร์ชัน (Release Version History)

| เวอร์ชัน | วันที่อัปเดต | รายละเอียดการเปลี่ยนแปลง |
|:---:|:---:|:---|
| **v1.0** | 2026-08-09 | ระบบออกใบเสร็จรับเงิน ฟอร์มกรอกข้อมูล และเชื่อมต่อ Google Sheets |
| **v2.0** | 2026-08-14 | ระบบพิมพ์ A4, ระบบ Login และระบุตัวตนพนักงาน (Cashier) |
| **v3.0** | 2026-08-28 | เพิ่มระบบใบสำคัญจ่าย, ระบบบัญชีธนาคาร `Master_Banks`, ไอคอนทางการ, แยกธีมสี Emerald/Rose |
| **v4.0** | 2026-08-30 | เพิ่มระบบ Filter Bar ครบวงจร, Dynamic Pagination, ลิงก์ดูรายละเอียด, Leading Zero Protection, SSOT |
| **v5.0** | 2026-09-11 | **ยกระดับสู่ Enterprise Edge Backend (Cloudflare Workers + D1 Database):**<br>1. ออกแบบสถาปัตยกรรมแยกสภาพแวดล้อม Staging แบบ Zero-Impact ต่อ Production 100%<br>2. สร้างและตรวจสอบตาราง Normalized D1 ทั้ง 9 ตารางบน Cloudflare D1 Studio (`receipt_db_staging`)<br>3. **Atomic Sequence Engine (Phase 0.2):** รันเลข `YYMMXXXX` + Manual Seed (13 Passed)<br>4. **Idempotency Guard (Phase 0.3):** ป้องกันการกดเบิ้ลด้วย UUID + SHA-256 (15 Passed)<br>5. **Immutable Audit Logging (Phase 0.4):** บันทึกแบบ Blockchain-like Hash Chaining (20 Passed)<br>6. **Authentication & RBAC (Phase 0.5):** แฮช PBKDF2/SHA-256 + Web Crypto JWT (23 Passed)<br>7. **Document CRUD Engine (Phase 1.1):** จัดการใบเสร็จและใบสำคัญจ่ายพร้อมคำนวณ DRC (20 Passed)<br>8. **Google Sheets Background Sync (Phase 1.2):** ซิงค์ข้อมูลลงชีตแบบ Non-blocking ผ่าน `ctx.waitUntil` (16 Passed)<br>9. **Frontend Migration / Toggle (Phase 1.3):** สวิตช์สลับ Production/Staging ในหน้าตั้งค่า, Staging API Client, Health Check พร้อมวัด Latency, และป้ายสถานะ Staging ใน Sidebar/Header (8 Passed)<br>🏆 **สรุปภาพรวม:** ผ่านการทดสอบครบ 115/115 รายการ (100% Pass Rate) และ Vite Build ผ่านสมบูรณ์ |

---

## 7. 🌿 แผนสถาปัตยกรรมและข้อกำหนด Phase 2: ระบบซื้อขาย Lot ยางพารา & สรุปกำไร-ขาดทุน

### 7.1 วัตถุประสงค์และภาพรวมกระบวนการธุรกิจ
เพื่อยกระดับการบริหารสต็อกยางพาราและการวิเคราะห์ผลกำไร-ขาดทุนจริงจากการส่งขายโรงงานอุตสาหกรรมแปรรูป (เช่น NER, บมจ. ไทยฮั้ว, บจก. ยางพาราไทย) ระบบจะติดตามยางพาราตั้งแต่ขั้นตอนรับซื้อหน้าลาน, การรวม Lot ยาง, การส่งขายโรงงาน, และการเปรียบเทียบผลตรวจแล็บเพื่อหารายได้และกำไรสุทธิแบบเรียลไทม์

### 7.2 แผนการแบ่ง 4 ข้อย่อย (Sub-phases 2.1 – 2.4)
1. **Phase 2.1: Inbound Weighing & Purchase Engine (ระบบรับซื้อและชั่งน้ำหนักยางพารา)**
   - บันทึกการชั่งซื้อยางจากชาวสวน/ลูกค้า (น้ำหนักรถเข้า Gross, รถออก Tare, สุทธิ Net)
   - บันทึกประเภทเนื้อยาง (`น้ำยางสด`, `ยางก้อนถ้วย`, `ขี้ยาง`, `ยางแผ่นรมควัน RSS`, `เศษยาง`)
   - คำนวณเนื้อยางแห้งตาม %DRC และคำนวณยอดเงินซื้อสุทธิ
   - ตาราง D1: `rubber_purchases`
2. **Phase 2.2: Lot Grouping & Aggregation Engine (ระบบรวมกลุ่มและจัดทำ Lot ยาง)**
   - เลือกรวมบิลชั่งซื้อหลายเที่ยวเข้าเป็น 1 Lot เพื่อเตรียมส่งโรงงาน
   - คำนวณน้ำหนักรวมของ Lot และต้นทุนรวม
   - คำนวณต้นทุนเฉลี่ยถ่วงน้ำหนัก (Weighted Average Cost / kg)
   - คำนวณค่า %DRC เฉลี่ยถ่วงน้ำหนักของทั้ง Lot
   - ตาราง D1: `rubber_lots`, `rubber_lot_items`
3. **Phase 2.3: Outbound Factory Sales & Reconciliation Engine (ระบบส่งขายโรงงานและเทียบผลตรวจ)**
   - บันทึกการส่งมอบให้โรงงานแปรรูปปลายทาง
   - บันทึกผลชั่งจริงหน้าโรงงาน (Factory Weight)
   - บันทึกผลแล็บ %DRC โรงงาน และราคาตกลงขายต่อ กก.
   - บันทึกค่าใช้จ่ายขนส่งและค่าธรรมเนียมโรงงาน
   - ตาราง D1: `rubber_sales`
4. **Phase 2.4: Real-time P&L Analytics & Dashboard (ระบบคำนวณกำไร-ขาดทุนและสรุปภาพรวม)**
   - วิเคราะห์ส่วนต่างน้ำหนักหดตัว (Weight Loss / Shrinkage = น้ำหนักต้นทาง - น้ำหนักโรงงาน)
   - วิเคราะห์เปอร์เซ็นต์เนื้อยางหาย (% DRC Drop = DRC ต้นทาง - DRC โรงงาน)
   - คำนวณกำไร-ขาดทุนสุทธิ (Net Profit / Loss): $\text{กำไรสุทธิ} = \text{รายได้จากการขาย} - \text{ต้นทุนซื้อรวม} - \text{ค่าขนส่งและค่าใช้จ่าย}$
   - วิเคราะห์อัตรากำไรต่อ กก. (Margin / kg) และ Margin %
   - หน้าสรุปรายงานเชิงวิเคราะห์ (P&L Dashboard)

### 7.3 โครงสร้างตาราง D1 Database สำหรับ Phase 2 (Normalized Extension)
```sql
-- 10. Rubber Purchases (บันทึกการชั่งซื้อยางหน้าลาน)
CREATE TABLE IF NOT EXISTS rubber_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_no TEXT NOT NULL UNIQUE,
    purchase_date TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    rubber_type TEXT NOT NULL,
    gross_weight REAL NOT NULL DEFAULT 0,
    tare_weight REAL NOT NULL DEFAULT 0,
    net_weight REAL NOT NULL DEFAULT 0,
    drc_percent REAL DEFAULT 0,
    dry_weight REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    lot_id INTEGER REFERENCES rubber_lots(id),
    status TEXT NOT NULL DEFAULT 'UNASSIGNED',
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours'))
);

-- 11. Rubber Lots (หัวตารางรวม Lot ยางพารา)
CREATE TABLE IF NOT EXISTS rubber_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_no TEXT NOT NULL UNIQUE,
    lot_name TEXT NOT NULL,
    rubber_type TEXT NOT NULL,
    total_purchase_weight REAL NOT NULL DEFAULT 0,
    total_purchase_cost REAL NOT NULL DEFAULT 0,
    avg_purchase_cost_kg REAL NOT NULL DEFAULT 0,
    avg_purchase_drc REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'LOCKED', 'SHIPPED', 'COMPLETED')),
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours'))
);

-- 12. Rubber Sales (บันทึกการส่งขายโรงงานและผลแล็บจริง)
CREATE TABLE IF NOT EXISTS rubber_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_no TEXT NOT NULL UNIQUE,
    lot_id INTEGER NOT NULL REFERENCES rubber_lots(id),
    factory_name TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    factory_weight REAL NOT NULL DEFAULT 0,
    factory_drc REAL NOT NULL DEFAULT 0,
    selling_price_kg REAL NOT NULL DEFAULT 0,
    gross_revenue REAL NOT NULL DEFAULT 0,
    transport_cost REAL NOT NULL DEFAULT 0,
    other_fees REAL NOT NULL DEFAULT 0,
    net_revenue REAL NOT NULL DEFAULT 0,
    net_profit REAL NOT NULL DEFAULT 0,
    profit_margin_kg REAL NOT NULL DEFAULT 0,
    weight_shrinkage_kg REAL NOT NULL DEFAULT 0,
    drc_drop_percent REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours'))
);
```

### 7.4 กลยุทธ์การทดสอบแบบ Zero-Risk & Zero-Impact ต่อระบบเดิม
1. **Isolated Test Scripts:** ทดสอบความถูกต้องของตรรกะคำนวณทั้งหมดผ่าน Unit Test Suites ใน `backend-staging/src/test/`
2. **Interactive Demo Studio:** ทำหน้าจอจำลอง HTML ทดลองเล่นได้ในเบราว์เซอร์ก่อน โดยไม่ต้องรันหรือแก้ไขเว็บจริง
3. **Feature Flag Control:** มีปุ่มสลับเปิด-ปิดระบบ Lot ในหน้าตั้งค่า โดยค่าเริ่มต้นเป็นปิด (Disabled) เมนูจะไม่แสดงผลจนกว่าผู้ใช้จะเปิดเพื่อทดลอง
4. **Strict UX/UI Lock:** ไม่แก้ไขหน้าจอ `ReceiptForm`, `VoucherForm`, `HistoryModal`, `PrintReceipt`, `PrintVoucher`, `BankAccountManagement` แม้แต่บรรทัดเดียว



