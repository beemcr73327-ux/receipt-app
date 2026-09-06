# 🛡️ Backend Staging Environment (Phase 0)

สภาพแวดล้อมหลังบ้านจำลอง (**Staging Backend**) สำหรับ **บจก. ศรีสุข พูนทรัพย์ ยางพารา จำกัด**  
พัฒนาขึ้นด้วยสถาปัตยกรรม **Cloudflare Workers + Cloudflare D1 (SQLite Database)** เพื่อแยกการพัฒนาออกจากระบบ Production 100% (Zero Downtime / Zero Impact)

---

## 📁 โครงสร้างไฟล์ในโฟลเดอร์นี้

```
backend-staging/
├── wrangler.toml         # การตั้งค่า Cloudflare Worker & D1 Binding สำหรับ Staging
├── schema.sql            # โครงสร้างฐานข้อมูล D1 (Users, Banks, Receipts, Vouchers, Sequences, AuditLogs)
├── README.md             # คู่มือการใช้งานและการรัน Migration
└── src/
    ├── index.js          # Entry Point ของ Staging Worker
    ├── services/         # Services ย่อย (Auth, Sequence, Audit, Idempotency)
    └── utils/            # Helper functions
```

---

## 🚀 ขั้นตอนการตั้งค่า Cloudflare D1 สำหรับ Staging

### 1. สร้าง D1 Database บน Cloudflare
คุณสามารถสร้างได้ผ่าน 2 วิธี:
* **วิธีที่ 1 (ผ่าน Cloudflare Dashboard):**
  1. เข้า Cloudflare Dashboard $\rightarrow$ ไปที่ **Storage & Databases** $\rightarrow$ **D1 SQL Database**
  2. กดปุ่ม **Create Database** $\rightarrow$ ตั้งชื่อ `receipt_db_staging`
  3. คัดลอก **Database ID** มาใส่ในไฟล์ `backend-staging/wrangler.toml` ในช่อง `database_id`
* **วิธีที่ 2 (ผ่าน Wrangler CLI):**
  ```bash
  npx wrangler d1 create receipt_db_staging
  ```

### 2. รันคำสั่งสร้างตาราง (Execute Schema Migration)
นำไฟล์ `schema.sql` ไป Execute บน Cloudflare D1:
* **ผ่าน Cloudflare Dashboard:**
  - เข้าสู่ฐานข้อมูล `receipt_db_staging` $\rightarrow$ ไปที่แท็บ **Console**
  - นำเนื้อหาในไฟล์ `schema.sql` วางแล้วกด **Execute**
* **หรือผ่าน Wrangler CLI:**
  ```bash
  npx wrangler d1 execute receipt_db_staging --file=./schema.sql --remote
  ```

---

## 🔒 การันตีความปลอดภัย (Zero Impact Guarantee)
โฟลเดอร์นี้ทำงานแยกขาดจากโฟลเดอร์หลักของโปรเจกต์อย่างสิ้นเชิง ผู้ใช้งานจริงในระบบ Production ที่กำลังออกใบเสร็จและใบสำคัญจ่ายจะไม่ได้รับผลกระทบใดๆ ทั้งสิ้น
