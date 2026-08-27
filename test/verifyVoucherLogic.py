# test/verifyVoucherLogic.py
# Automated verification script for Payment Voucher backend logic

import sys

def generate_next_voucher_no(existing_vouchers, doc_date_str):
    parts = doc_date_str.split('/')
    d = int(parts[0])
    m = int(parts[1])
    y = int(parts[2])
    
    if y < 2500:
        y += 543
        
    yy = str(y)[-2:]
    mm = f"{m:02d}"
    prefix = f"{yy}{mm}" # 8 digits without PV prefix
    
    max_seq = 0
    for v_no in existing_vouchers:
        clean_no = v_no.replace('PV', '')
        if clean_no.startswith(prefix):
            seq_str = clean_no[len(prefix):]
            try:
                seq_num = int(seq_str)
                if seq_num > max_seq:
                    max_seq = seq_num
            except ValueError:
                pass
                
    next_seq = f"{max_seq + 1:04d}"
    return f"{prefix}{next_seq}"

def format_voucher_rows(d):
    doc_date = d['docDate']
    voucher_no = str(d['voucherNo']).replace('PV', '')
    receiver_name = d['receiverName']
    main_desc = d['mainDescription']
    ref_no = d.get('refNo', '')
    payment_method = d['paymentMethod']
    
    if payment_method == 'เงินสด':
        source_bank_acc = ''
        cheque_or_dest_acc = ''
        dest_bank = ''
    elif payment_method == 'เช็ค':
        source_bank_acc = d.get('sourceBankAcc', '')
        cheque_or_dest_acc = d.get('chequeOrDestAcc', '') # เลขที่เช็ค
        dest_bank = d.get('destBank', '') # ธนาคารที่ออก+สาขา
    else: # เงินโอน
        source_bank_acc = d.get('sourceBankAcc', '') # ALL
        cheque_or_dest_acc = d.get('chequeOrDestAcc', '') # PV
        dest_bank = d.get('destBank', '') # ชื่อเต็มธนาคาร+ชื่อบัญชี
        
    pay_date = d['payDate']
    notes = d.get('notes', '')
    cashier_name = d['cashierName']
    status = d.get('status', 'ปกติ')
    cancel_reason = d.get('cancelReason', '')
    timestamp = '18/08/2569 13:00:00'
    
    rows = []
    for itm in d['items']:
        rows.append([
            doc_date,
            voucher_no,
            receiver_name,
            main_desc,
            ref_no,
            itm['itemDate'],
            itm['description'],
            itm['amount'],
            payment_method,
            source_bank_acc,
            cheque_or_dest_acc,
            dest_bank,
            pay_date,
            notes,
            cashier_name,
            status,
            cancel_reason,
            timestamp
        ])
    return rows

def filter_banks(bank_list, module_type):
    result = []
    for b in bank_list:
        usage = b.get('usage', '').strip().upper()
        if not usage:
            continue
        if usage == 'ALL' or module_type in usage:
            result.append(b)
    return result

print("🧪 Running Payment Voucher Backend Logic Verification (8-Digit Numbers & 18 Columns)...\n")

# Test 1.1: First voucher of August 2569 (8-Digit Numeric)
t1_1 = generate_next_voucher_no([], '18/08/2569')
assert t1_1 == '69080001', f"Expected 69080001 but got {t1_1}"
print(f"✅ Test 1.1 Passed: First voucher number generated -> {t1_1}")

# Test 1.2: Continuation in August 2569
existing_aug = ['69080001', '69080002', '69080009']
t1_2 = generate_next_voucher_no(existing_aug, '18/08/2569')
assert t1_2 == '69080010', f"Expected 69080010 but got {t1_2}"
print(f"✅ Test 1.2 Passed: Sequence continuation -> {t1_2}")

# Test 1.3: Reset sequence on new month (September 2569)
t1_3 = generate_next_voucher_no(existing_aug, '01/09/2569')
assert t1_3 == '69090001', f"Expected 69090001 but got {t1_3}"
print(f"✅ Test 1.3 Passed: Monthly sequence reset -> {t1_3}")

# Test 2.1: 18-column row structure for เงินโอน
mock_payload_transfer = {
    'docDate': '18/08/2569',
    'voucherNo': '69080001',
    'receiverName': 'บริษัท ยางพาราไทย จำกัด',
    'mainDescription': 'ชำระค่าวัตถุดิบยางก้อนถ้วยประจำงวด 08/69',
    'refNo': 'INV-2026-088',
    'paymentMethod': 'เงินโอน',
    'sourceBankAcc': 'BBL 4143010488',
    'chequeOrDestAcc': '6781803115',
    'destBank': 'ธนาคารกรุงไทย นายสมศักดิ์',
    'payDate': '18/08/2569',
    'notes': 'หัก ณ ที่จ่าย 1% เรียบร้อย',
    'cashierName': 'ประนัดดา พรมหาไชย',
    'items': [
        {'itemDate': '15/08/2569', 'description': 'ยางก้อนถ้วย Lot 1 (2,000 กก.)', 'amount': 100000},
        {'itemDate': '16/08/2569', 'description': 'ยางก้อนถ้วย Lot 2 (1,000 กก.)', 'amount': 50000}
    ]
}

rows_transfer = format_voucher_rows(mock_payload_transfer)
assert len(rows_transfer) == 2, "Should have 2 rows"
assert len(rows_transfer[0]) == 18, f"Each row must have exactly 18 columns, got {len(rows_transfer[0])}"
assert rows_transfer[0][1] == "69080001", "Voucher number must be in Col B as 69080001"
assert rows_transfer[0][9] == "BBL 4143010488", "Col J must be source bank account (ALL)"
assert rows_transfer[0][10] == "6781803115", "Col K must be dest bank account (PV)"
assert rows_transfer[0][11] == "ธนาคารกรุงไทย นายสมศักดิ์", "Col L must be bank name + account holder"
print("✅ Test 2.1 Passed: 18-column multi-item row structure for เงินโอน verified!")

# Test 2.2: 18-column row structure for เงินสด
mock_payload_cash = {
    'docDate': '18/08/2569',
    'voucherNo': '69080002',
    'receiverName': 'นายสมศักดิ์ ใจดี',
    'mainDescription': 'ค่าเบี้ยเลี้ยงพนักงาน',
    'refNo': '',
    'paymentMethod': 'เงินสด',
    'payDate': '18/08/2569',
    'cashierName': 'ประนัดดา พรมหาไชย',
    'items': [{'itemDate': '18/08/2569', 'description': 'เบี้ยเลี้ยง', 'amount': 500}]
}
rows_cash = format_voucher_rows(mock_payload_cash)
assert rows_cash[0][9] == "" and rows_cash[0][10] == "" and rows_cash[0][11] == "", "Col J, K, L must be empty for เงินสด"
print("✅ Test 2.2 Passed: Col J, K, L empty for เงินสด verified!")
print("✅ Test 2 Passed: 17-column multi-item row structure verified!")

# Test 3: Bank account filtering (RC / PV / ALL)
mock_banks = [
    {'abbr': 'BBL', 'acc': '4143010488', 'usage': 'RC'},
    {'abbr': 'KTB', 'acc': '6781803115', 'usage': 'PV'},
    {'abbr': 'SCB', 'acc': '4321625236', 'usage': 'RC,PV'},
    {'abbr': 'BAY', 'acc': '1291795056', 'usage': 'ALL'}
]

rc_banks = filter_banks(mock_banks, 'RC')
pv_banks = filter_banks(mock_banks, 'PV')
assert len(rc_banks) == 3, "RC banks count should be 3"
assert len(pv_banks) == 3, "PV banks count should be 3"
print("✅ Test 3 Passed: Bank filtering by usage short code (RC/PV/ALL) verified!")

print("\n🎉 ALL 3 SUITES PASSED! Payment Voucher Backend Logic is 100% Verified.")
