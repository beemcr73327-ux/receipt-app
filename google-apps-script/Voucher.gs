// ==========================================
// 💳 PAYMENT VOUCHER MODULE (ใบสำคัญจ่าย - 18 คอลัมน์)
// ==========================================

/**
 * 🔹 ดึงรายชื่อผู้รับเงิน / จ่ายให้ (Receivers)
 */
function getVoucherReceivers(configSs) {
  var sheet = configSs.getSheetByName("PV_Receivers") || 
              configSs.getSheetByName("Voucher_Receiver") || 
              configSs.getSheetByName("datasupplier");
  var receivers = [];
  
  if (sheet && sheet.getLastRow() >= 1) {
    var values = sheet.getRange(1, 1, sheet.getLastRow(), 3).getValues();
    var startIdx = (String(values[0][0]).includes("ชื่อ") || String(values[0][0]).includes("Name")) ? 1 : 0;
    
    for (var i = startIdx; i < values.length; i++) {
      var name = cleanLeadingQuote(values[i][0]);
      var addr = cleanLeadingQuote(values[i][1]);
      var taxId = cleanLeadingQuote(values[i][2]);
      if (name) {
        receivers.push({ name: name, address: addr, taxId: taxId });
      }
    }
  }
  return receivers;
}

/**
 * 🔹 บันทึกรายชื่อผู้รับเงินใหม่อัตโนมัติ (Auto-save Receiver)
 */
function autoSaveReceiver(configSs, receiverName, taxId) {
  var cleanName = cleanLeadingQuote(receiverName);
  if (!cleanName) return;

  var sheet = configSs.getSheetByName("PV_Receivers") || configSs.getSheetByName("Voucher_Receiver");
  if (!sheet) {
    sheet = configSs.insertSheet("PV_Receivers");
    sheet.appendRow(["ชื่อผู้รับเงิน / จ่ายให้", "ที่อยู่", "เลขประจำตัวผู้เสียภาษี"]);
  }

  var lastRow = sheet.getLastRow();
  var exists = false;
  if (lastRow >= 1) {
    var names = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (cleanLeadingQuote(names[i][0]).toLowerCase() === cleanName.toLowerCase()) {
        exists = true;
        break;
      }
    }
  }

  if (!exists) {
    sheet.appendRow([cleanName, "", toSheetText(taxId || "")]);
  }
}

/**
 * 🔹 บันทึกข้อมูลธนาคารปลายทางใหม่อัตโนมัติ (Auto-save Destination Bank -> Master_Banks)
 * Col A = "", Col B = ชื่อธนาคาร, Col C = "", Col D = เลขที่บัญชี, Col E = ชื่อบัญชี, Col F = "PV"
 */
function autoSaveDestBank(configSs, chequeOrDestAcc, destBankName, accountHolderName) {
  var cleanAcc = cleanLeadingQuote(chequeOrDestAcc);
  if (!cleanAcc) return;

  var bankSheet = configSs.getSheetByName("Master_Banks") || 
                  configSs.getSheetByName("Bankacc") || 
                  configSs.getSheetByName("Bank") || 
                  configSs.getSheetByName("Banks");

  if (!bankSheet) {
    bankSheet = configSs.insertSheet("Master_Banks");
    bankSheet.appendRow(["ตัวย่อธนาคาร", "ชื่อธนาคาร", "เลขท้าย 4 หลัก", "เลขที่บัญชี", "ชื่อบัญชี", "Short Code"]);
  }

  var lastRow = bankSheet.getLastRow();
  var exists = false;

  if (lastRow >= 1) {
    var numCols = Math.max(bankSheet.getLastColumn(), 6);
    var values = bankSheet.getRange(1, 1, lastRow, numCols).getValues();
    
    for (var i = 0; i < values.length; i++) {
      var colD = cleanLeadingQuote(values[i][3]);
      var colC = cleanLeadingQuote(values[i][2]);
      var accInRow = colD || colC;
      if (accInRow && accInRow.toLowerCase() === cleanAcc.toLowerCase()) {
        exists = true;
        break;
      }
    }
  }

  if (!exists) {
    var bName = String(destBankName || '').trim();
    var accHolder = String(accountHolderName || '').trim();
    
    if (!accHolder && bName) {
      var spaceIdx = bName.indexOf(' ');
      if (spaceIdx > 0) {
        accHolder = bName.substring(spaceIdx + 1).trim();
        bName = bName.substring(0, spaceIdx).trim();
      }
    }

    var last4 = cleanAcc.length >= 4 ? cleanAcc.slice(-4) : cleanAcc;
    bankSheet.appendRow(["", bName, toSheetText(last4), toSheetText(cleanAcc), accHolder, "PV"]);
  }
}

/**
 * 🔹 สร้างเลขที่ใบสำคัญจ่ายอัตโนมัติ (YYMMXXXX - ตัวเลขล้วน 8 หลัก เช่น 69080001) พร้อมรีเซ็ตทุกเดือน
 */
function generateNextVoucherNo(voucherSs, docDateInput) {
  var sheet = voucherSs.getSheetByName("database") || 
              voucherSs.getSheetByName("PaymentVouchers") || 
              voucherSs.getSheets()[0];

  // คำนวณปี พ.ศ. 2 หลัก และ เดือน 2 หลัก
  var now = new Date();
  var dateObj = docDateInput ? new Date(docDateInput) : now;
  if (isNaN(dateObj.getTime())) {
    var strDate = String(docDateInput || '');
    var parts = strDate.split('/');
    if (parts.length === 3) {
      var d = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10);
      var y = parseInt(parts[2], 10);
      if (y > 2500) y -= 543;
      dateObj = new Date(y, m - 1, d);
    } else {
      dateObj = now;
    }
  }

  var thaiYear = dateObj.getFullYear() + (dateObj.getFullYear() < 2500 ? 543 : 0);
  var yy = String(thaiYear).slice(-2);
  var mm = ("0" + (dateObj.getMonth() + 1)).slice(-2);
  var prefix = yy + mm; // เช่น 6908

  var maxSeq = 0;

  if (sheet && sheet.getLastRow() > 1) {
    var colBValues = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < colBValues.length; i++) {
      var rawNo = String(colBValues[i][0] || '').trim();
      var cleanNo = rawNo.replace(/^[^\d]+/, ''); // ล้างตัวอักษรนำหน้าถ้ามี
      if (cleanNo.indexOf(prefix) === 0) {
        var seqStr = cleanNo.substring(prefix.length);
        var seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    }
  }

  var nextSeqStr = ("0000" + (maxSeq + 1)).slice(-4);
  return prefix + nextSeqStr;
}

/**
 * 🔹 ดึงรายการใบสำคัญจ่ายทั้งหมด (Grouped by Voucher No. - 18 คอลัมน์)
 */
function getVouchers(voucherSheetId) {
  var vouchers = [];
  var ss = SpreadsheetApp.openById(voucherSheetId);
  var sheet = ss.getSheetByName("database") || 
              ss.getSheetByName("PaymentVouchers") || 
              ss.getSheetByName("Vouchers") || 
              ss.getSheetByName("Log") || 
              ss.getSheetByName("Sheet1") || 
              ss.getSheetByName("แผ่นงาน1") || 
              ss.getSheets()[0];
  
  if (sheet && sheet.getLastRow() > 1) {
    var maxCols = Math.max(sheet.getLastColumn(), 18);
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, maxCols).getValues();
    var vMap = {};
    var vOrder = [];

    for (var i = 0; i < vals.length; i++) {
      var row = vals[i];
      var vNo = cleanLeadingQuote(row[1]); // Col B (2): เลขที่เอกสาร (เช่น 69080001)
      if (!vNo) continue;

      var itemObj = {
        id: i + 1,
        itemDateThai: formatStandardDateGAS(cleanLeadingQuote(row[5])), // Col F (6): วันที่รายการ
        description: String(row[6] || '').trim(),  // Col G (7): รายการ
        amount: Number(row[7] || 0)                // Col H (8): จำนวนเงิน
      };

      if (!vMap[vNo]) {
        vMap[vNo] = {
          voucherNo: vNo,
          docDateThai: formatStandardDateGAS(cleanLeadingQuote(row[0])),        // Col A (1): วันที่เอกสาร
          receiverName: String(row[2] || '').trim(),       // Col C (3): จ่ายให้
          mainDescription: String(row[3] || '').trim(),    // Col D (4): คำอธิบาย
          refNo: cleanLeadingQuote(row[4]),              // Col E (5): เลขที่อ้างอิงเอกสาร
          paymentMethod: String(row[8] || '').trim(),      // Col I (9): ชำระโดย
          sourceBankAcc: cleanLeadingQuote(row[9]),      // Col J (10): บัญชีต้นทาง (ALL: ตัวย่อ+เลขเต็ม)
          chequeOrDestAcc: cleanLeadingQuote(row[10]),   // Col K (11): เลขที่เช็ค/เลขบัญชีปลายทาง (PV)
          destBank: String(row[11] || '').trim(),          // Col L (12): ธนาคาร (ชื่อเต็ม+ชื่อบัญชี/สาขา)
          payDateThai: formatStandardDateGAS(cleanLeadingQuote(row[12])),       // Col M (13): วันที่ชำระเงิน
          notes: String(row[13] || '').trim(),             // Col N (14): หมายเหตุ
          cashierName: String(row[14] || '').trim(),       // Col O (15): ผู้จัดทำ
          status: String(row[15] || 'ปกติ').trim(),        // Col P (16): สถานะ
          cancelReason: String(row[16] || '').trim(),      // Col Q (17): สาเหตุยกเลิก
          printedTimestamp: getFormattedThaiDateTime(row[17]), // Col R (18): วันที่บันทึก/พิมพ์
          items: [],
          totalAmount: 0
        };
        vOrder.push(vNo);
      }

      vMap[vNo].items.push(itemObj);
      vMap[vNo].totalAmount += itemObj.amount;
    }

    for (var idx = vOrder.length - 1; idx >= 0; idx--) {
      vouchers.push(vMap[vOrder[idx]]);
    }
  }
  return vouchers;
}

/**
 * 🔹 บันทึกใบสำคัญจ่าย (1 รายการย่อย = 1 แถว ใน 18 คอลัมน์)
 */
function handleSaveVoucher(d, voucherSheetId, configSheetId) {
  var ss = SpreadsheetApp.openById(voucherSheetId);
  var sheet = ss.getSheetByName("database") || 
              ss.getSheetByName("PaymentVouchers") || 
              ss.getSheetByName("Vouchers") || 
              ss.getSheetByName("Log") || 
              ss.getSheetByName("Sheet1") || 
              ss.getSheetByName("แผ่นงาน1") || 
              ss.getSheets()[0];
  
  // สร้างหัวตารางถ้าเป็นชีตใหม่ (18 คอลัมน์ Col A - Col R)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "วันที่เอกสาร", "เลขที่เอกสาร", "จ่ายให้", "คำอธิบาย", "เลขที่อ้างอิงเอกสาร",
      "วันที่รายการ", "รายการ", "จำนวนเงิน", "ชำระโดย", "บัญชีต้นทาง",
      "เลขที่เช็ค/เลขบัญชีปลายทาง", "ธนาคาร", "วันที่ชำระเงิน", "หมายเหตุ", "ผู้จัดทำ",
      "สถานะ", "สาเหตุยกเลิก", "วันที่บันทึก/พิมพ์"
    ]);
  }

  var configSs = SpreadsheetApp.openById(configSheetId);

  // Auto-save รายชื่อผู้รับเงิน
  var receiverName = String(d.receiverName || d.receiver || d.payTo || '').trim();
  if (receiverName) {
    autoSaveReceiver(configSs, receiverName);
  }

  // รันเลขที่เอกสารถ้าไม่มีส่งมา (ตัวเลขล้วน 8 หลัก เช่น 69080001)
  var voucherNo = String(d.voucherNo || d.docNo || '').trim();
  if (!voucherNo) {
    voucherNo = generateNextVoucherNo(ss, d.docDate || d.dateThai);
  } else {
    // ล้างตัวอักษร PV นำหน้าถ้าผู้ใช้ส่งมา เพื่อให้เก็บเฉพาะตัวเลข 8 หลัก
    voucherNo = voucherNo.replace(/^[^\d]+/, '');
  }

  var docDateVal = formatStandardDateGAS(d.docDate || d.dateThai || d.docDateThai || new Date());
  var payDateVal = formatStandardDateGAS(d.payDate || d.payDateThai || d.paymentDate || docDateVal);
  var currentTimestamp = getFormattedThaiDateTime(new Date());

  var paymentMethod = String(d.paymentMethod || 'เงินโอน').trim();
  var sourceBankAcc = "";
  var chequeOrDestAcc = "";
  var destBank = "";

  if (paymentMethod === "เงินสด") {
    // เงินสด: เว้นว่าง Col J, K, L
    sourceBankAcc = "";
    chequeOrDestAcc = "";
    destBank = "";
  } else if (paymentMethod === "เช็ค") {
    // เช็ค: Col J = บัญชีบริษัท (ALL), Col K = เลขที่เช็ค, Col L = ชื่อเต็มธนาคาร+สาขา
    sourceBankAcc = String(d.sourceBankAcc || d.bankDetails || '').trim();
    chequeOrDestAcc = String(d.chequeOrDestAcc || d.chequeNo || '').trim();
    destBank = String(d.destBank || d.bankName || '').trim();
  } else {
    // เงินโอน: Col J = บัญชีบริษัท (ALL: ตัวย่อ+เลขเต็ม), Col K = เลขบัญชีปลายทาง (PV), Col L = ชื่อเต็มธนาคาร+ชื่อบัญชี
    sourceBankAcc = String(d.sourceBankAcc || d.bankDetails || '').trim();
    chequeOrDestAcc = String(d.chequeOrDestAcc || d.destBankAcc || '').trim();
    destBank = String(d.destBank || d.bankName || '').trim();

    // Auto-save ธนาคารปลายทางใหม่ลงชีต Master_Banks (Col F = "PV")
    if (chequeOrDestAcc) {
      autoSaveDestBank(configSs, chequeOrDestAcc, destBank, d.accountHolder || d.destAccountHolder || "");
    }
  }

  var items = (d.items && d.items.length > 0) ? d.items : [{
    itemDate: d.itemDate || docDateVal,
    description: d.description || d.mainDescription || "",
    amount: Number(d.amount || d.totalAmount || 0)
  }];

  var rowsToInsert = [];
  for (var k = 0; k < items.length; k++) {
    var itm = items[k];
    var itemDateVal = formatStandardDateGAS(itm.itemDate || itm.date || docDateVal);
    var itemDesc = String(itm.description || itm.title || itm.name || "").trim();
    var itemAmt = Number(itm.amount || itm.totalAmount || 0);

    rowsToInsert.push([
      docDateVal,                                // Col A (1): วันที่เอกสาร
      toSheetText(voucherNo),                    // Col B (2): เลขที่เอกสาร (ตัวเลข 8 หลัก เช่น 69080001)
      receiverName,                              // Col C (3): จ่ายให้
      String(d.mainDescription || d.description || '').trim(), // Col D (4): คำอธิบาย
      toSheetText(d.refNo || d.invoiceNo || ''), // Col E (5): เลขที่อ้างอิงเอกสาร
      itemDateVal,                               // Col F (6): วันที่รายการ
      itemDesc,                                  // Col G (7): รายการ
      itemAmt,                                   // Col H (8): จำนวนเงิน
      paymentMethod,                             // Col I (9): ชำระโดย
      sourceBankAcc,                             // Col J (10): บัญชีต้นทาง (ALL: ตัวย่อ + เลขเต็ม)
      toSheetText(chequeOrDestAcc),              // Col K (11): เลขที่เช็ค/เลขบัญชีปลายทาง (PV)
      destBank,                                  // Col L (12): ธนาคาร (ชื่อเต็ม + ชื่อบัญชี/สาขา)
      payDateVal,                                // Col M (13): วันที่ชำระเงิน
      String(d.notes || '').trim(),              // Col N (14): หมายเหตุ
      String(d.cashierName || d.creator || '').trim(), // Col O (15): ผู้จัดทำ
      String(d.status || "ปกติ").trim(),          // Col P (16): สถานะ
      String(d.cancelReason || '').trim(),       // Col Q (17): สาเหตุยกเลิก
      String(d.printedTimestamp || currentTimestamp) // Col R (18): วันที่บันทึก/พิมพ์
    ]);
  }

  // ค้นหาแถวจริงล่าสุด เพื่อ append ต่อท้าย
  var lastDataRow = 1;
  var maxCheckRow = Math.max(sheet.getLastRow(), 1);
  var colBValues = sheet.getRange(1, 2, maxCheckRow, 1).getValues();
  for (var idx = colBValues.length - 1; idx >= 0; idx--) {
    if (String(colBValues[idx][0] || '').trim() !== '') {
      lastDataRow = idx + 1;
      break;
    }
  }

  for (var r = 0; r < rowsToInsert.length; r++) {
    var targetRow = lastDataRow + 1 + r;
    sheet.getRange(targetRow, 1, 1, rowsToInsert[r].length).setValues([rowsToInsert[r]]);
  }

  return ContentService.createTextOutput(JSON.stringify({ 
    status: "success", 
    action: "insertedVoucher", 
    voucherNo: voucherNo, 
    sheetUsed: sheet.getName(),
    rowsCount: rowsToInsert.length 
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 🔹 ยกเลิกใบสำคัญจ่าย (อัปเดต Col P, Q, R)
 */
function handleCancelVoucher(d, voucherSheetId) {
  var ss = SpreadsheetApp.openById(voucherSheetId);
  var sheet = ss.getSheetByName("database") || 
              ss.getSheetByName("PaymentVouchers") || 
              ss.getSheetByName("Vouchers") || 
              ss.getSheetByName("Log") || 
              ss.getSheetByName("Sheet1") || 
              ss.getSheetByName("แผ่นงาน1") || 
              ss.getSheets()[0];
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var rawTarget = String(d.voucherNo || d.docNo || '').trim();
  var targetVoucherNo = rawTarget.replace(/^[^\d]+/, ''); // รองรับการค้นหาทั้งแบบมี/ไม่มีตัวอักษร
  var updatedRows = 0;

  var currentTimestamp = getFormattedThaiDateTime(new Date());

  for (var i = 1; i < values.length; i++) {
    var currentNo = String(values[i][1]).trim().replace(/^[^\d]+/, '');
    if (currentNo === targetVoucherNo) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, 16).setValue(d.status || "ยกเลิก"); // Col P (16) = สถานะ
      sheet.getRange(rowNum, 17).setValue(d.cancelReason || ""); // Col Q (17) = สาเหตุยกเลิก
      sheet.getRange(rowNum, 18).setValue(currentTimestamp);   // Col R (18) = Timestamp
      updatedRows++;
    }
  }

  if (updatedRows > 0) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      action: "cancelledVoucher", 
      voucherNo: targetVoucherNo, 
      updatedRows: updatedRows 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ 
    status: "error", 
    message: "ไม่พบเลขที่เอกสารใบสำคัญจ่าย: " + targetVoucherNo 
  })).setMimeType(ContentService.MimeType.JSON);
}
