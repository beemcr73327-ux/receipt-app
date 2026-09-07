# 📄 Product Requirement Document (PRD) — Financial & Rubber Lot Management System

> **ระบบออกใบเสร็จรับเงิน ใบสำคัญจ่าย บันทึกบัญชี และระบบซื้อขาย Lot ยางพารา**  
> **บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด**  
> **เวอร์ชันเอกสาร:** 5.0  
> **วันที่อัปเดตล่าสุด:** 6 กันยายน 2569 (2026-09-06)

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

### 4.3 Immutable Audit Trail (Phase 0.4 ⏳ เป้าหมายถัดไป)
- บันทึกประวัติการเงินลงตาราง `audit_logs` แบบ Insert-Only
- คำนวณ SHA-256 Hash Chaining (`record_hash = SHA256(prev_hash + data)`) สร้างสายใยข้อมูลบล็อกเชน ป้องกันการแอบแก้ไขหรือลบประวัติย้อนหลัง

### 4.4 Authentication & RBAC System (Phase 0.5 ⏳ เป้าหมายถัดไป)
- แฮชรหัสผ่านด้วย PBKDF2/SHA-256 + Unique Salt
- การยืนยันตัวตนด้วย JSON Web Token (JWT) กำหนดอายุสั้น และตรวจสอบสิทธิ์ผู้ใช้ตามบทบาท (Role-Based Access Control)

---

## 5. 🎨 มาตรฐาน UX/UI & การออกแบบระบบ

1. **แบ่งแยกธีมสีชัดเจน:** เขียวมรกต (`Emerald`) สำหรับรายรับ (ใบเสร็จ) และแดงกุหลาบ (`Rose`) สำหรับรายจ่าย (ใบสำคัญจ่าย)
2. **ไอคอนธนาคารไทยทางการครบวงจร:** ขนาด `w-8 h-8` (32x32px) พร้อม Fallback
3. **ฟอร์แมตเลขบัญชี 3-3-4 (`xxx-xxx-xxxx`):** แสดงผลสะอาดตา บันทึกลงฐานข้อมูลเป็นตัวเลขล้วน
4. **Full-height Workspace Layout:** หน้าจอตารางขยายเต็มความสูง ล็อคหัวตาราง `sticky top-0`
5. **ระบบ Filter Bar & Pagination:** กรองตามสถานะ, ช่วงเวลาด่วน, ปฏิทิน, ค้นหาเรียลไทม์ และเลือกขนาดหน้าได้ (10/20/50/100 แถว)
6. **Leading Zero Protection:** ป้องกันเลข 0 หายด้วยการใส่ `'` ในฝั่งชีต และล้างออกเพื่อแสดงผลตัวเลขสะอาดบนหน้าเว็บ

---

## 6. 📜 ประวัติการอัปเดตเวอร์ชัน (Release Version History)

| เวอร์ชัน | วันที่อัปเดต | รายละเอียดการเปลี่ยนแปลง |
|:---:|:---:|:---|
| **v1.0** | 2026-08-09 | ระบบออกใบเสร็จรับเงิน ฟอร์มกรอกข้อมูล และเชื่อมต่อ Google Sheets |
| **v2.0** | 2026-08-14 | ระบบพิมพ์ A4, ระบบ Login และระบุตัวตนพนักงาน (Cashier) |
| **v3.0** | 2026-08-28 | เพิ่มระบบใบสำคัญจ่าย, ระบบบัญชีธนาคาร `Master_Banks`, ไอคอนทางการ, แยกธีมสี Emerald/Rose |
| **v4.0** | 2026-08-30 | เพิ่มระบบ Filter Bar ครบวงจร, Dynamic Pagination, ลิงก์ดูรายละเอียด, Leading Zero Protection, SSOT |
| **v5.0** | 2026-09-07 | **ยกระดับสู่ Enterprise Edge Backend (Cloudflare Workers + D1 Database):**<br>1. ออกแบบสถาปัตยกรรมใหม่แยกสภาพแวดล้อม Staging เพื่อ Zero-Impact ต่อ Production<br>2. ออกแบบและสร้างโครงสร้างตาราง D1 ทั้ง 9 ตารางบน Cloudflare D1 Studio (`receipt_db_staging`)<br>3. พัฒนาระบบ **Atomic Sequence Engine (Phase 0.2)** รันเลข `YYMMXXXX` + Manual Seed (Unit test ผ่าน 13/13)<br>4. พัฒนาระบบ **Idempotency Guard (Phase 0.3)** ป้องกันการกดเบิ้ล/ส่งซ้ำ ด้วย UUID + SHA-256 (Unit test ผ่าน 15/15)<br>5. ติดตั้ง Node.js v24 LTS บน macOS พร้อมระบบทดสอบอัตโนมัติ |

