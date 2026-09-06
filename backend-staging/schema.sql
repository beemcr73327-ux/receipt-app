-- Cloudflare D1 Database Schema - Staging Environment
-- Project: Receipt & Payment Voucher Management System
-- Version: 5.0 (Phase 0.1)

PRAGMA foreign_keys = ON;

-- 1. Users and Roles
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'User' CHECK(role IN ('Admin', 'Manager', 'User')),
    status TEXT NOT NULL DEFAULT 'Approved' CHECK(status IN ('Approved', 'Pending', 'Suspended')),
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 2. Master Banks
CREATE TABLE IF NOT EXISTS master_banks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_no TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    branch TEXT,
    usage TEXT NOT NULL DEFAULT 'ALL' CHECK(usage IN ('ALL', 'PV')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours'))
);

CREATE INDEX IF NOT EXISTS idx_banks_account_no ON master_banks(account_no);
CREATE INDEX IF NOT EXISTS idx_banks_usage ON master_banks(usage);

-- 3. Receipts (Header Table)
CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no TEXT NOT NULL UNIQUE,
    doc_date TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_address TEXT,
    buyer_tax_id TEXT,
    period TEXT,
    payment_method TEXT NOT NULL DEFAULT 'เงินโอน',
    pay_date TEXT,
    notes TEXT,
    cashier_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ปกติ' CHECK(status IN ('ปกติ', 'ยกเลิก')),
    cancel_reason TEXT,
    printed_timestamp TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours'))
);

CREATE INDEX IF NOT EXISTS idx_receipts_receipt_no ON receipts(receipt_no);
CREATE INDEX IF NOT EXISTS idx_receipts_doc_date ON receipts(doc_date);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_buyer_name ON receipts(buyer_name);

-- 4. Receipt Items (Items Table)
CREATE TABLE IF NOT EXISTS receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    item_title TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    drc_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    discount_details TEXT,
    net_amount REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);

-- 5. Payment Vouchers (Header Table)
CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL UNIQUE,
    doc_date TEXT NOT NULL,
    transaction_timestamp TEXT NOT NULL,
    receiver_name TEXT NOT NULL,
    overall_description TEXT,
    ref_doc_no TEXT,
    payment_method TEXT NOT NULL DEFAULT 'เงินโอน',
    cheque_no TEXT,
    bank_account TEXT,
    payment_date TEXT,
    notes TEXT,
    cashier_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ปกติ' CHECK(status IN ('ปกติ', 'ยกเลิก')),
    cancel_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours'))
);

CREATE INDEX IF NOT EXISTS idx_vouchers_voucher_no ON vouchers(voucher_no);
CREATE INDEX IF NOT EXISTS idx_vouchers_doc_date ON vouchers(doc_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_receiver_name ON vouchers(receiver_name);

-- 6. Voucher Items (Items Table)
CREATE TABLE IF NOT EXISTS voucher_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    item_date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_voucher_items_voucher_id ON voucher_items(voucher_id);

-- 7. Atomic Document Sequences
CREATE TABLE IF NOT EXISTS document_sequences (
    doc_type TEXT NOT NULL,
    prefix TEXT NOT NULL,
    current_seq INTEGER NOT NULL DEFAULT 0,
    manual_seed INTEGER DEFAULT NULL,
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours')),
    PRIMARY KEY (doc_type, prefix)
);

-- 8. Idempotency Keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_body TEXT NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 200,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours'))
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys(created_at);

-- 9. Immutable Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prev_hash TEXT NOT NULL DEFAULT '0',
    record_hash TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    details_json TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', '+7 hours'))
);

CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
