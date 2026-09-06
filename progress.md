# 📈 Progress Report & Backend Roadmap — สรุปการพัฒนาและแผนงานเวอร์ชัน 5.0

> **โปรเจกต์:** Receipt & Payment Voucher & Rubber Lot Trading Web Application  
> **องค์กร:** บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด  
> **เวอร์ชันปัจจุบัน:** 5.0 (Backend Restructuring & Architecture Roadmap Phase)  
> **วันที่อัปเดตล่าสุด:** 31 สิงหาคม 2569 (2026-08-31)

---

## 📌 สรุปภาพรวมการก้าวสู่เวอร์ชัน 5.0 (v5.0 Transition Overview)

ในเวอร์ชัน 4.0 ระบบฝั่ง Frontend (ใบเสร็จรับเงิน, ใบสำคัญจ่าย, บัญชีธนาคาร, ตัวกรองขั้นสูง, Pagination, และการแสดงผล) ทำงานได้อย่างสมบูรณ์ 100% ร่วมกับ Google Apps Script (GAS) 

เพื่อยกระดับระบบสู่มาตรฐานองค์กรขนาดใหญ่ และเตรียมความพร้อมสำหรับ **ระบบซื้อขาย Lot ยางพารา (Rubber Lot Trading)** ในเวอร์ชัน 5.0 นี้ เราจะทำการ **ปรับโครงสร้างส่วนหลังบ้าน (Backend Restructuring)** โดยเปลี่ยนฐานข้อมูลหลักจาก Google Sheets มาเป็น **Cloudflare Edge Engine (Cloudflare Workers + D1 Database)** และเปลี่ยน Google Sheets ให้ทำหน้าที่เป็น **Read-Only Reporting Layer** สำหรับดูรายงานเท่านั้น

---

## 🗺️ แผนผัง Roadmap การพัฒนาส่วนหลังบ้าน (Backend Development Roadmap)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend Application (React)                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (REST API / JWT)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Cloudflare Worker Backend Services (Node.js/TS)            │
│  ├── Auth & RBAC                  ├── Atomic Sequence Engine           │
│  ├── Idempotency Guard            ├── Immutable Audit Logger           │
│  └── Lot & Voucher Business Logic └── Sync Service to Sheets           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────────────┐          ┌──────────────────────┐
│  Cloudflare D1 (SQLite Database)     │          │ Cloudflare R2        │
│  - Primary Database (SSOT)           │          │ - Automated Backup   │
│  - Transactions & Locking Constraints│          └──────────────────────┘
└──────────────────────────────────────┘                     │ (Sync Reports)
                                                             ▼
                                                  ┌──────────────────────┐
                                                  │ Google Sheets        │
                                                  │ - Read-Only Report   │
                                                  └──────────────────────┘
```

---

## 🛠️ แผนงานพัฒนาตามลำดับเฟส (Detailed Phase Breakdown)

### 🔹 Phase 0: รากฐานสถาปัตยกรรมหลังบ้านและ 3 กลไกหลัก (Core Backend Primitives)
*เน้นความถูกต้อง ปลอดภัย และป้องกันความผิดพลาดของข้อมูลการเงิน*

- [ ] **0.1 ออกแบบโครงสร้างฐานข้อมูล D1 (Database Schema Design):**
  - ตาราง `receipts` (ใบเสร็จรับเงิน) และ `vouchers` (ใบสำคัญจ่าย)
  - ตาราง `master_banks` (บัญชีธนาคาร) และ `master_users` (สิทธิ์ผู้ใช้งาน)
  - ตาราง `sequences` (ตัวนับเลขที่เอกสาร Atomic)
  - ตาราง `audit_logs` (ประวัติการเงินแบบ Insert-only)
- [ ] **0.2 สร้างเครื่องมือออกเลขเอกสารแบบ Atomic (Atomic Sequence Engine):**
  - พัฒนา API ฝั่ง Cloudflare Worker สำหรับรันเลขที่ใบเสร็จ, ใบสำคัญจ่าย, ใบชั่ง และ Lot จาก Server ป้องกันเลขซ้ำ/ข้าม 100%
- [ ] **0.3 ระบบป้องกันการทำรายการซ้ำและล็อกข้อมูล (Concurrency & Locking):**
  - เพิ่ม Idempotency Key ใน API Header ป้องกันการกดส่งฟอร์มซ้ำ
  - กำหนด Database Level Constraints ป้องกันการดึงรายการซื้อชุดเดียวกันไปใส่ใน 2 Lot ซ้ำซ้อน
- [ ] **0.4 ระบบบันทึกประวัติที่แก้ไขไม่ได้ (Immutable Audit Logging):**
  - สร้างระบบ Insert-only Audit Log พร้อม SHA-256 Hash Chaining พิสูจน์การไม่ถูกแก้ไขย้อนหลัง
- [ ] **0.5 ระบบยืนยันตัวตนและสิทธิ์การใช้งาน (JWT Authentication & RBAC):**
  - ระบบ JWT Short-lived Token + Refresh Token
  - กำหนดสิทธิ์ผู้ใช้งาน (Admin / Manager / Staff) และ Rate Limiting บน Endpoint สำคัญ

---

### 🔹 Phase 1: เชื่อมต่อ API และการย้ายฐานข้อมูล (API & Data Migration)
*เปลี่ยนการเชื่อมต่อจาก GAS ไปหา Cloudflare Worker Backend*

- [ ] **1.1 พัฒนา RESTful APIs บน Cloudflare Worker:**
  - `POST /api/v1/auth/login` และ `POST /api/v1/auth/refresh`
  - `GET/POST/PUT/DELETE /api/v1/receipts`
  - `GET/POST/PUT/DELETE /api/v1/vouchers`
  - `GET/POST/PUT/DELETE /api/v1/banks`
- [ ] **1.2 สคริปต์ย้ายข้อมูลเดิม (Data Migration Script):**
  - ดึงข้อมูลเดิมจาก Google Sheets เข้าสู่ Cloudflare D1 Database พร้อมตรวจสอบความถูกต้อง
- [ ] **1.3 ระบบ Sync ข้อมูลลง Google Sheets (Read-Only Reporting Layer):**
  - สร้าง Background Worker สำหรับ Push ข้อมูลจาก D1 ไปยัง Google Sheets เพื่อให้ฝ่ายบัญชีดูรายงานได้ตามปกติ
- [ ] **1.4 ปรับปรุง Frontend Service Layer:**
  - ปรับปรุง `src/services/storageService.js` ให้เรียกใช้ Cloudflare Worker API ใหม่แทน GAS

---

### 🔹 Phase 2: ระบบซื้อขาย Lot ยางพารา และสต็อกสินค้า (Rubber Lot Trading Module)
*ต่อยอดฟีเจอร์ธุรกิจยางพาราบนกลไกหลังบ้านใหม่*

- [ ] **2.1 โมดูลบันทึกการซื้อยาง (Buy Management):**
  - บันทึกรายการชั่งซื้อน้ำยาง/ยางก้อน (น้ำหนัก, DRC %, ราคา, คู่ค้า)
- [ ] **2.2 โมดูลจัดกลุ่มรายการซื้อมารวมเป็น Lot (Lot Grouping):**
  - ดึงรายการซื้อข้ามวัน/ข้ามสาขามาจัดรวมเป็น 1 Lot พร้อมระบบ Lock ป้องกันการเลือกซ้ำ
- [ ] **2.3 โมดูลออกบิลขายและกรอกผลโรงงาน (Sell & Factory Closing):**
  - สร้างบิลขายส่งโรงงาน (เข้าคิวรอผล)
  - กรอกผลชั่งจริง/DRC จริง/ราคาจริงจากโรงงาน
- [ ] **2.4 สรุปผลกำไร-ขาดทุน (P&L & Lot Analytics Dashboard):**
  - คำนวณส่วนต่างน้ำหนัก (Shrinkage), ส่วนต่าง DRC, กำไร/ขาดทุนสุทธิต่อ Lot แบบเรียลไทม์

---

### 🔹 Phase 3: การเพิ่มความปลอดภัยระดับสูงและการสำรองข้อมูล (Production Hardening)

- [ ] **3.1 ระบบสำรองข้อมูลอัตโนมัติ (Automated R2 Point-in-Time Backup):**
  - ตั้งเวลา Backup D1 Database ไปยัง Cloudflare R2 ทุกวัน พร้อมทดสอบกระบวนการ Restore
- [ ] **3.2 ระบบติดตามข้อผิดพลาดและ Log (Sentry & Cloudflare Logpush):**
  - เชื่อมต่อ Error Tracking (Sentry) และดู System Logs แบบเรียลไทม์
- [ ] **3.3 ตรวจสอบมาตรฐาน e-Tax Invoice และข้อกำหนดสรรพากร:**
  - ปรึกษาผู้ทำบัญชีเพื่อเตรียมความพร้อมสำหรับ e-Tax Invoice และ VAT

---

## 📊 ตารางติดตามสถานะการพัฒนา (Progress Tracker)

| โมดูล / งาน | สถานะปัจจุบัน | เวอร์ชันที่รองรับ | เป้าหมายถัดไป |
|:---|:---:|:---:|:---|
| **ระบบใบเสร็จรับเงิน (Receipt)** | ✅ เสร็จสมบูรณ์ (GAS) | v4.0 | ย้ายขึ้น Cloudflare Worker + D1 (Phase 1) |
| **ระบบใบสำคัญจ่าย (Voucher)** | ✅ เสร็จสมบูรณ์ (GAS) | v4.0 | ย้ายขึ้น Cloudflare Worker + D1 (Phase 1) |
| **ระบบบัญชีธนาคาร (Master_Banks)** | ✅ เสร็จสมบูรณ์ (GAS) | v4.0 | ย้ายขึ้น Cloudflare Worker + D1 (Phase 1) |
| **D1 Database Schema Design** | ⏳ กำลังเตรียมงาน | v5.0 | เริ่มเขียน SQL Migration (Phase 0.1) |
| **Atomic Sequence Engine** | ⏳ กำลังเตรียมงาน | v5.0 | พัฒนาบน Cloudflare Worker (Phase 0.2) |
| **JWT Auth & RBAC** | ⏳ กำลังเตรียมงาน | v5.0 | พัฒนาบน Cloudflare Worker (Phase 0.5) |
| **ระบบซื้อขาย Lot ยางพารา** | ⏳ รอเฟส 0 และ 1 | v5.0 | พัฒนาโมดูล Buy/Lot/Sell (Phase 2) |

---
*จัดทำและบันทึกแผนพัฒนาหลังบ้านเวอร์ชัน 5.0 ณ วันที่ 31 สิงหาคม 2569 (2026-08-31)*
