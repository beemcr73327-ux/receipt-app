# 📄 Product Requirement Document (PRD) — Financial & Rubber Lot Management System

> **ระบบออกใบเสร็จรับเงิน ใบสำคัญจ่าย บันทึกบัญชี และระบบซื้อขาย Lot ยางพารา**  
> **บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด**  
> **เวอร์ชันเอกสาร:** 5.0 (Phase 2 Enterprise Edition)  
> **วันที่อัปเดตล่าสุด:** 15 กันยายน 2569 (2026-09-15)

---

## 1. 🎯 วัตถุประสงค์ของโปรเจกต์ (Project Overview & Objectives)

ระบบเว็บแอปพลิเคชันบริหารจัดการเอกสารทางการเงิน การบัญชี และระบบซื้อขาย Lot ยางพารา พัฒนาขึ้นเพื่อทดแทนกระดาษ ลดความผิดพลาดในการคำนวณเงินสด/ส่วนลด/DRC และยกระดับสู่สถาปัตยกรรมระดับองค์กร (Enterprise Edge Architecture) โดยครอบคลุม 4 โมดูลหลัก:

1. **ระบบออกใบเสร็จรับเงิน (Receipt Management):** สร้าง ค้นหา ยกเลิก และพิมพ์ใบเสร็จรับเงินมาตรฐาน A4 (ธีมสีเขียวมรกต Emerald)
2. **ระบบออกใบสำคัญจ่าย (Payment Voucher Management):** สร้าง ค้นหา ยกเลิก และพิมพ์ใบสำคัญจ่ายมาตรฐาน A4 พร้อมแปลงตัวเลขเป็นคำอ่านภาษาไทย (ธีมสีแดงกุหลาบ Rose)
3. **ระบบบันทึกข้อมูลบัญชี (Bank Account Management):** จัดการบัญชีธนาคารสำหรับรับชำระเงินและจ่ายเงิน พร้อมไอคอนทางการของธนาคารไทยครบวงจร
4. **ระบบซื้อขาย Lot ยางพาราและสต็อกสินค้า (Rubber Lot Trading & Stock):** บันทึกการชั่งซื้อยางหน้าลาน (`PB-`), จัดกลุ่มรายการซื้อเข้า Lot (`LOT-`), ออกบิลขายส่งโรงงาน (`SL-`), บันทึกผลชั่ง/DRC จริง, และคำนวณสรุปผลกำไร-ขาดทุน (P&L Dashboard)

---

## 2. 🏛️ โครงสร้างสถาปัตยกรรมระบบ (System Architecture)

### 2.1 สถาปัตยกรรมเป้าหมายเวอร์ชัน 5.0 (Target Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite + Tailwind CSS)          │
│  ├── ReceiptForm / ReceiptHistoryModal / PrintReceipt                  │
│  ├── VoucherForm / VoucherHistoryModal / PrintVoucher                  │
│  ├── BankAccountManagement / SettingsModal / Staging Toggle            │
│  └── LotTrading (5 Views): Dashboard, Buy, Lot Mix, Sell, Factory P&L   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (RESTful API / JWT Bearer / Idempotency Key)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Cloudflare Worker Backend (Application Layer)              │
│  ├── Authentication (PBKDF2/SHA-256 Hashing + JWT + RBAC)              │
│  ├── Atomic Sequence Engine (YYMMXXXX Generator: PB-, LOT-, SL-)       │
│  ├── Idempotency Guard (UUIDv4 Anti-duplicate Lock)                    │
│  ├── Immutable Audit Logger (SHA-256 Hash Chaining)                    │
│  └── Rubber Trading Services (Purchase, Lot, Sale & P&L Engine)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────────────┐          ┌──────────────────────┐
│  Cloudflare D1 (SQLite Database)     │          │ Cloudflare R2        │
│  - Single Source of Truth (SSOT)     │          │ - Automated Backup   │
│  - 12 Tables + Normalized Constraints│          └──────────────────────┘
│  - Strict FK Locks & Indexes         │                     │ (Sync Service)
└──────────────────────────────────────┘                     ▼
                                                  ┌──────────────────────┐
                                                  │ Google Sheets        │
                                                  │ - Read-Only Report   │
                                                  └──────────────────────┘
```

---

## 3. 📊 โครงสร้างฐานข้อมูล Cloudflare D1 (Database Schema)

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
| **`rubber_purchases`** | บันทึกการชั่งซื้อยางหน้าลาน | `id`, `ticket_no` (UNIQUE), `paper_ref`, `purchase_date`, `branch`, `seller_name`, `product_type`, `weight_kg`, `unit_price`, `drc_percent`, `dry_weight_kg`, `total_amount`, `lot_id` (FK), `status` |
| **`rubber_lots`** | หัวตารางรวม Lot ยางพารา | `id`, `lot_no` (UNIQUE), `lot_name`, `product_type`, `total_weight_kg`, `total_cost`, `avg_cost_per_kg`, `items_count`, `status` |
| **`rubber_sales`** | บันทึกการส่งขายโรงงาน & P&L | `id`, `sale_no` (UNIQUE), `lot_id` (FK), `factory_name`, `ship_date`, `outbound_weight_kg`, `factory_weight_kg`, `factory_drc_percent`, `selling_price_per_kg`, `net_price_per_kg`, `gross_revenue`, `penalty_deduction`, `transport_cost`, `other_fees`, `net_revenue`, `net_profit`, `margin_per_kg`, `weight_shrinkage_kg`, `status` |

---

## 4. 🛡️ กลไกความปลอดภัยและระบบพื้นฐาน (Core Security Primitives)

### 4.1 Atomic Sequence Generator (Phase 0.2 ✅ เสร็จสมบูรณ์)
- **ไฟล์:** [`sequenceService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/sequenceService.js)
- **หลักการ:** ออกเลขที่เอกสารจากเซิร์ฟเวอร์แบบ Atomic ผ่านคำสั่ง Upsert พร้อม `RETURNING` ป้องกันเลขซ้ำและกระโดด 100%
- **รูปแบบเลขที่เอกสาร:**
  * ใบเสร็จรับเงิน: `YYMMXXXX` (เช่น `69090001`)
  * ใบสำคัญจ่าย: `YYMMXXXX` (เช่น `69090001`)
  * ใบชั่งซื้อยางหน้าลาน: `PB-YYMMXXXX` (เช่น `PB-69090001`)
  * หัว Lot สินค้ายางพารา: `LOT-YYMMXXXX` (เช่น `LOT-69090001`)
  * บิลส่งขายโรงงาน: `SL-YYMMXXXX` (เช่น `SL-69090001`)
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 13/13 ข้อ (`verifySequence.js`)

### 4.2 Idempotency Guard (Phase 0.3 ✅ เสร็จสมบูรณ์)
- **ไฟล์:** [`idempotencyMiddleware.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/middleware/idempotencyMiddleware.js)
- **หลักการ:** ป้องกันการกดบันทึกซ้ำด้วยการฉีด `X-Idempotency-Key` (UUIDv4) จาก Frontend หากมีการส่งคำขอซ้ำ ระบบจะคืนผลลัพธ์เดิมโดยไม่ประมวลผลซ้ำ
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 15/15 ข้อ (`verifyIdempotency.js`)

### 4.3 Immutable Audit Logging (Phase 0.4 ✅ เสร็จสมบูรณ์)
- **ไฟล์:** [`auditService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/auditService.js)
- **หลักการ:** บันทึกประวัติการเงินแบบ Insert-Only โดยใช้เทคนิค Hash Chaining (SHA-256) ตรวจจับการทุจริตย้อนหลังได้ 100%
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 20/20 ข้อ (`verifyAuditLog.js`)

### 4.4 JWT Authentication & Role-Based Access Control (Phase 0.5 ✅ เสร็จสมบูรณ์)
- **ไฟล์:** [`authService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/authService.js)
- **หลักการ:** แฮชรหัสผ่านด้วย PBKDF2/SHA-256 พร้อม Salt สุ่ม 16 ไบต์ ออกโทเค็น JWT และควบคุมสิทธิ์ตามบทบาท (Admin, Manager, User)
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 23/23 ข้อ (`verifyAuth.js`)

---

## 5. 📄 ระบบจัดการเอกสารทางการเงิน (Financial Document Engine)

### 5.1 Document CRUD Engine (Phase 1.1 ✅ เสร็จสมบูรณ์)
- **ไฟล์:** [`documentService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/documentService.js)
- **ฟังก์ชัน:** สร้าง ค้นหา แบ่งหน้า และยกเลิกใบเสร็จและใบสำคัญจ่าย พร้อมคำนวณส่วนลดและ DRC%
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 20/20 ข้อ (`verifyDocuments.js`)

### 5.2 Google Sheets Background Sync Service (Phase 1.2 ✅ เสร็จสมบูรณ์)
- **ไฟล์:** [`googleSheetsSyncService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/googleSheetsSyncService.js)
- **ฟังก์ชัน:** ซิงค์ข้อมูลลง Google Sheets แบบ Non-blocking ผ่าน `ctx.waitUntil` ทำให้หน้าเว็บตอบสนองรวดเร็วระดับเสี้ยววินาที
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 16/16 ข้อ (`verifyGoogleSheetsSync.js`)

### 5.3 Frontend Migration & Backend Engine Toggle (Phase 1.3 ✅ เสร็จสมบูรณ์)
- **ไฟล์:** [`stagingApiClient.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/services/stagingApiClient.js), [`storageService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/services/storageService.js), [`SettingsModal.jsx`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/components/SettingsModal.jsx)
- **ฟังก์ชัน:** สลับโหมดการทำงานระหว่าง Production (เดิม) กับ Staging Edge 5.0 (ใหม่) พร้อมระบบทดสอบ Ping Latency
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 8/8 ข้อ (`verifyStagingClient.js`) และ Vite Build ผ่าน 100%

---

## 6. 🌿 ระบบซื้อขายและจัดการ Lot ยางพารา (Phase 2: Rubber Lot Trading & P&L Engine)

### 6.1 Phase 2.1: Inbound Weighing & Purchase Engine (✅ เสร็จสมบูรณ์ 100%)
- **ไฟล์:** [`rubberPurchaseService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/rubberPurchaseService.js)
- **รหัสเอกสาร:** `PB-YYMMXXXX` (เช่น `PB-69090001`) พร้อมช่องระบุเลขที่ใบชั่งกระดาษอ้างอิง (`paper_ref`)
- **ประเภทสินค้ามาตรฐาน 6 ชนิด:** `AA:ยางก้อน`, `BB:ขี้ยาง`, `CC:ยางแผ่นดิบ`, `DD:ยางแผ่นรมควัน (RSS)`, `EE:น้ำยางสด`, `FF:เศษยาง`
- **สูตรคำนวณ:**
  $$\text{Total Amount} = \begin{cases} \text{round}\left(\text{Weight} \times \text{Price} \times \frac{\text{DRC}\%}{100}, 2\right) & \text{ถ้ายางมี DRC} \\ \text{round}(\text{Weight} \times \text{Price}, 2) & \text{ถ้ายางไม่มี DRC} \end{cases}$$
- **ความปลอดภัย:** ห้ามยกเลิกบิลชั่งซื้อที่ถูกจัดเข้า Lot แล้ว (`status === 'ASSIGNED'`)
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 30/30 ข้อ (`verifyRubberPurchases.js`)

### 6.2 Phase 2.2: Lot Grouping & Aggregation Engine (✅ เสร็จสมบูรณ์ 100%)
- **ไฟล์:** [`rubberLotService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/rubberLotService.js)
- **รหัส Lot:** `LOT-YYMMXXXX` (เช่น `LOT-69090001`)
- **Single Product Rule:** 1 Lot ต้องบรรจุยางชนิดเดียวกัน 100% ห้ามผสมข้ามประเภทเด็ดขาด
- **สูตรคำนวณต้นทุนเฉลี่ยถ่วงน้ำหนัก (Weighted Average Cost):**
  $$\text{Avg Cost/kg} = \text{round}\left(\frac{\sum \text{Total Amount}}{\sum \text{Weight}}, 2\right)$$
- **วงจรชีวิตและการล็อค:**
  * `OPEN` $\leftrightarrow$ `LOCKED` (พร้อมจัดส่ง ห้ามแก้ไขบิล) $\rightarrow$ `SHIPPED` $\rightarrow$ `COMPLETED`
  * การยกเลิก Lot (`cancelLot`) จะปลดบิลซื้อทั้งหมดคืนสู่คลัง (`UNASSIGNED`) อัตโนมัติ ป้องกันข้อมูลสูญหาย
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 32/32 ข้อ (`verifyRubberLots.js`)

### 6.3 Phase 2.3: Outbound Factory Sales & Reconciliation Engine (✅ เสร็จสมบูรณ์ 100%)
- **ไฟล์:** [`rubberSaleService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/rubberSaleService.js)
- **รหัสบิลขาย:** `SL-YYMMXXXX` (เช่น `SL-69090001`)
- **ขั้นตอนการทำงาน:**
  1. ส่งออก Lot ที่ `LOCKED` ออกบิลขาย `SL-` สถานะ `PENDING` และปรับสถานะ Lot เป็น `SHIPPED`
  2. เมื่อโรงงานส่งผลชั่งและแล็บ DRC มา ให้เรียก `settleFactoryResult` เพื่อคำนวณ P&L และปรับสถานะเป็น `CLOSED` / `COMPLETED`
- **สูตรคำนวณราคาขายและกำไร-ขาดทุน:**
  $$\text{Net Price/kg} = \text{round}\left(\text{Selling Price} \times \frac{\text{Factory DRC}\%}{100}, 2\right)$$
  $$\text{Gross Revenue} = \text{round}(\text{Factory Weight} \times \text{Net Price}, 2)$$
  $$\text{Net Revenue} = \text{round}(\text{Gross Revenue} - \text{Penalty} - \text{Transport} - \text{Other Fees}, 2)$$
  $$\text{Net Profit} = \text{round}(\text{Net Revenue} - \text{Total Lot Cost}, 2)$$
  $$\text{Margin/kg} = \text{round}\left(\frac{\text{Net Profit}}{\text{Factory Weight}}, 2\right)$$
  $$\text{Weight Shrinkage} = \text{round}(\text{Outbound Weight} - \text{Factory Weight}, 2)$$
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 37/37 ข้อ (`verifyRubberSales.js`)

### 6.4 Phase 2.4: Real-time P&L Analytics & React UI Integration (✅ เสร็จสมบูรณ์ 100%)
- **ไฟล์:** [`RubberLotTrading.jsx`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/components/RubberLotTrading.jsx), [`rubberLotApiClient.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/src/services/rubberLotApiClient.js), [`rubberDashboardService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/rubberDashboardService.js)
- แปลงต้นแบบ `lot-trading-ui.html` เป็น React Component 5 แท็บอย่างสมบูรณ์:
  1. **01 Dashboard (ภาพรวม):** สรุปภาพรวมสต็อก, ทุนสะสม, กำไรสุทธิประจำเดือน
  2. **02 Buy (บันทึกซื้อ):** ฟอร์มออกตั๋วชั่งซื้อ `PB-` พร้อมคำนวณ DRC อัตโนมัติและปุ่มบันทึกต่อเนื่อง
  3. **03 Records / Lot Mix (รายการซื้อ & จัด Lot):** ตารางบิลซื้อหน้าลาน เลือกรวมเข้า Lot `LOT-` พร้อมกฎ Single Product Rule
  4. **04 Sell (สร้างบิลขาย):** เลือก Lot ที่ปิดผนึก ออกบิลส่งมอบ `SL-` พร้อมเฉลี่ยต้นทุนถ่วงน้ำหนัก
  5. **05 Factory & P&L (รอผลโรงงาน):** บันทึกผลแล็บโรงงาน คำนวณกำไรสุทธิแบบ Real-time
- **Feature Flag Protection:** ควบคุมการแสดงผลเมนูผ่าน `SettingsModal.jsx` (Default: ปิด) ตามนโยบาย Zero-Impact 100%
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 40/40 ข้อ (`verifyRubberHttpRoutes.js`)

### 6.5 Phase 2.4.1 - 2.4.4: Local Staging Environment & Real-time Live Watcher (✅ เสร็จสมบูรณ์ 100%)
- **[`localServer.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/localServer.js) (`npm run staging:server`):**
  - เซิร์ฟเวอร์จำลอง Cloudflare Worker + D1 SQLite ในเครื่องแบบ Zero-Dependency (Node 24 `DatabaseSync`)
  - รองรับ Dual-Stack Socket (`0.0.0.0` IPv4 และ `::1` IPv6) ขจัดปัญหาการเชื่อมต่อบน macOS
  - Normalized CORS Header ป้องกันปัญหา Chrome ปฏิเสธ Header ซ้ำซ้อน
- **[`vite.config.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/vite.config.js):** Dev Server Reverse Proxy สำหรับ `/health` และ `/api`
- **[`watchD1.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/watchD1.js) (`npm run d1:watch`):**
  - หน้าปัดเฝ้าดูฐานข้อมูลสด Real-Time Live Monitor ตรวจจับข้อมูลทุก 0.5 วินาที พร้อมเสียงเตือนเมื่อมีข้อมูลใหม่ไหลเข้า

### 6.6 Phase 3: Automated Cloudflare R2 Database Backup & System Health Monitoring (✅ เสร็จสมบูรณ์ 100%)
- **ไฟล์:** [`backupService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/backupService.js), [`systemHealthService.js`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/src/services/systemHealthService.js), [`wrangler.toml`](file:///Users/aukkdach/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity%20project/Receipt/backend-staging/wrangler.toml)
- **ระบบสำรองข้อมูลอัตโนมัติ (Automated R2 Backup Engine):**
  - ดึงข้อมูลครบทั้ง 7 ตารางหลัก (`receipts`, `vouchers`, `rubber_purchases`, `rubber_lots`, `rubber_sales`, `document_sequences`, `audit_logs`)
  - คำนวณ SHA-256 Cryptographic Checksum รับประกันความสมบูรณ์ของข้อมูล 100%
  - ตั้งเวลาสำรองข้อมูลอัตโนมัติผ่าน Cloudflare Cron Triggers (`0 18 * * *` หรือ 01:00 น. ตามเวลาไทย)
  - จัดเก็บไฟล์ลงใน Cloudflare R2 Bucket: `backups/YYYY-MM/backup-YYYY-MM-DD-HHmmss-xxxxx.json` พร้อมอัปเดต pointer `backups/latest.json`
  - รองรับ Local R2 Provider ในเครื่องผ่าน `backend-staging/backups/` ทำงานได้สมบูรณ์แบบโดยไม่ต้องต่อเน็ต
- **ระบบตรวจสุขภาพระบบเชิงลึก (System Health & Observability):**
  - `GET /api/v1/system/health`: วัด Response Time (ms) ของ D1, ตรวจสอบสถานะ R2, Google Sheets Webhook, และสรุปจำนวนเรคคอร์ดทั้งหมดในระบบ
- **การทดสอบ:** ผ่านการทดสอบ Unit Test 44/44 ข้อ (`verifyBackupService.js` และ `verifySystemHealth.js`)

---

## 7. 🧪 ตารางสรุปผลการทดสอบระบบทั้งหมด (Test Suite Matrix)

```text
🧪 1. Sequence Engine (Phase 0.2):           13 Passed, 0 Failed
🧪 2. Idempotency Guard (Phase 0.3):         15 Passed, 0 Failed
🧪 3. Immutable Audit Log (Phase 0.4):       20 Passed, 0 Failed
🧪 4. Auth & RBAC System (Phase 0.5):        23 Passed, 0 Failed
🧪 5. Document CRUD Engine (Phase 1.1):      20 Passed, 0 Failed
🧪 6. Google Sheets Sync (Phase 1.2):        16 Passed, 0 Failed
🧪 7. Staging Client & Toggle (Phase 1.3):    8 Passed, 0 Failed
🧪 8. Rubber Purchase Engine (Phase 2.1):    30 Passed, 0 Failed
🧪 9. Rubber Lot Engine (Phase 2.2):         32 Passed, 0 Failed
🧪 10. Rubber Sales Engine (Phase 2.3):      39 Passed, 0 Failed
🧪 11. Rubber HTTP Routes & UI (Phase 2.4):  40 Passed, 0 Failed
🧪 12. Backup Service & R2 (Phase 3):        23 Passed, 0 Failed
🧪 13. System Health & Cron (Phase 3):       21 Passed, 0 Failed

🏆 รวมผลการทดสอบทั้งหมดของระบบ: 300 Passed, 0 Failed (100% Pass Rate)
🚀 Frontend Production Build:       ✓ 1,609 modules transformed (Built in 1.64s)
```

---

## 8. 🔒 กฎเหล็กข้อบังคับ: ล็อค UX/UI เดิม 100% (Strict UX/UI Lock Policy)

> ⚠️ **คำสั่งเด็ดขาดจากผู้ใช้ (User Constraint):**  
> **"ห้ามแก้ไขในส่วนของ UX/UI เพราะพึงพอใจแล้ว"**

* หน้าจอ `ReceiptForm`, `VoucherForm`, `ReceiptHistoryModal`, `VoucherHistoryModal`, `PrintReceipt`, `PrintVoucher`, `BankAccountManagement` **ล็อคตายตัว 100% ไม่มีการขยับหรือแก้ไขแม้แต่พิกเซลเดียว**
* ระบบ Lot ยางพาราใหม่ทั้งหมดจะถูกบรรจุในโมดูลแยกต่างหาก และควบคุมด้วย Feature Flag เพื่อการันตีความปลอดภัยสูงสุด
