/**
 * Google Apps Script for Receipt Management System
 * Configured with User's Exact Sheet IDs:
 *  1. Config File Sheet ID: 1FiWYtzhqsO_7TJ222INNWI8QsgXVJ7lWv83S3bfY7qM
 *     (Sheets: datasupplier, TOPS, Payment)
 *  2. Receipt Log File Sheet ID: 1YE4F8WjWT13R_aMOYVmR2NuhaA6FE8ua1cKsdMlttwk
 *     (Sheet: Receipts)
 */

var CONFIG_SHEET_ID = "1FiWYtzhqsO_7TJ222INNWI8QsgXVJ7lWv83S3bfY7qM";
var LOG_SHEET_ID = "1YE4F8WjWT13R_aMOYVmR2NuhaA6FE8ua1cKsdMlttwk";

function doPost(e) {
  try {
    var rawContents = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = {};
    try {
      payload = JSON.parse(rawContents);
    } catch(parseErr) {
      payload = {};
    }
    var action = payload.action;
    var d = payload.data || payload;

    // Handle User Management endpoints
    if (action === "login") {
      var configSs = SpreadsheetApp.openById(CONFIG_SHEET_ID);
      var gmailSheet = configSs.getSheetByName("gmail") || configSs.getSheetByName("Gmail");
      var targetEmail = String(d.email || "").trim().toLowerCase();
      var inputPassword = String(d.password || "").trim();

      if (gmailSheet && gmailSheet.getLastRow() >= 1) {
        var gmailVals = gmailSheet.getRange("A1:F" + gmailSheet.getLastRow()).getValues();
        var startIdx = (String(gmailVals[0][0]).includes("ชื่อ") || String(gmailVals[0][3]).includes("Gmail")) ? 1 : 0;
        for (var u = startIdx; u < gmailVals.length; u++) {
          var r = gmailVals[u];
          if (r[3]) {
            var rawEmailCell = String(r[3] || '').trim();
            var cleanEmail = rawEmailCell.split(/\s+/)[0].toLowerCase();
            if (cleanEmail === targetEmail) {
              var status = String(r[4] || 'Approved').trim();
              var password = String(r[5] || '').trim();
              
              if (status === 'Blocked') {
                return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "บัญชีของคุณถูกระงับการใช้งาน" })).setMimeType(ContentService.MimeType.JSON);
              }
              if (status === 'Pending') {
                return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "บัญชีอยู่ระหว่างรอการอนุมัติจาก Admin" })).setMimeType(ContentService.MimeType.JSON);
              }
              
              if (password === inputPassword) {
                var safeUser = {
                  firstName: String(r[0] || '').trim(),
                  lastName: String(r[1] || '').trim(),
                  fullName: (String(r[0] || '').trim() + " " + String(r[1] || '').trim()).trim(),
                  role: String(r[2] || 'User').trim(),
                  email: cleanEmail,
                  status: status
                };
                return ContentService.createTextOutput(JSON.stringify({ status: "success", user: safeUser })).setMimeType(ContentService.MimeType.JSON);
              } else {
                return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" })).setMimeType(ContentService.MimeType.JSON);
              }
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบอีเมลนี้ในระบบ" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "registerUser") {
      var configSs = SpreadsheetApp.openById(CONFIG_SHEET_ID);
      var gmailSheet = configSs.getSheetByName("gmail") || configSs.getSheetByName("Gmail");
      var existing = false;
      var cleanTargetEmail = String(d.email || "").trim().toLowerCase();
      if (gmailSheet.getLastRow() > 0) {
        var values = gmailSheet.getRange(1, 4, gmailSheet.getLastRow(), 1).getValues();
        for (var i = 0; i < values.length; i++) {
          var cellVal = String(values[i][0] || "").trim().toLowerCase();
          var cleanCellEmail = cellVal.split(/\s+/)[0];
          if (cleanCellEmail === cleanTargetEmail) {
            existing = true;
            break;
          }
        }
      }
      if (!existing) {
        // Ensure header in Row 1 Col E if missing
        if (gmailSheet.getLastRow() === 0) {
          gmailSheet.appendRow(["ชื่อ", "นามสกุล", "สิทธิ์", "Gmail", "สถานะ"]);
        }
        // [A, B, C, D, E] = [ชื่อ, นามสกุล, สิทธิ์, Gmail, สถานะ]
        gmailSheet.appendRow([d.firstName || "", d.lastName || "", "User", cleanTargetEmail, "Pending"]);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "registerUser" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "updateUserStatus") {
      var configSs = SpreadsheetApp.openById(CONFIG_SHEET_ID);
      var gmailSheet = configSs.getSheetByName("gmail") || configSs.getSheetByName("Gmail");
      var dataRange = gmailSheet.getDataRange();
      var values = dataRange.getValues();
      var updated = false;
      var targetEmail = String(d.email || "").trim().toLowerCase();

      for (var i = 0; i < values.length; i++) {
        var rowCell = String(values[i][3] || "").trim().toLowerCase();
        var rowEmail = rowCell.split(/\s+/)[0];
        if (rowEmail === targetEmail) {
          // Clean Col D (Col 4) to ONLY contain the email address without trailing status text
          gmailSheet.getRange(i + 1, 4).setValue(targetEmail);
          // Update Role (Col C = 3) and Status (Col E = 5)
          gmailSheet.getRange(i + 1, 3).setValue(d.role || values[i][2] || "User");
          gmailSheet.getRange(i + 1, 5).setValue(d.status || values[i][4] || "Approved");
          updated = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "updateUserStatus", updated: updated })).setMimeType(ContentService.MimeType.JSON);
    }

    var targetLogId = payload.logSheetId || LOG_SHEET_ID;
    var ss;
    var targetSheetName = "database";
    
    // Try opening by target log ID first
    try {
      ss = SpreadsheetApp.openById(targetLogId);
    } catch(err) {
      // Fallback to active spreadsheet if openById fails
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    var sheet = ss.getSheetByName("database") || ss.getSheetByName("Receipts") || ss.getSheets()[0];
    
    // Create header row if sheet is brand new according to updated user columns
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "วันที่", "เลขที่ใบเสร็จ", "นามผู้ซื้อ", "ที่อยู่", "เลขประจำตัวผู้เสียภาษี",
        "งวด", "รายการสินค้าหรือบริการ", "จำนวน", "ราคาต่อหน่วย", "DRC(%)",
        "จำนวนเงิน", "ชำระโดย", "วันที่โอน/สั่งจ่าย",
        "หมายเหตุ", "ผู้รับเงิน", "สถานะ", "สาเหตุที่ยกเลิก", "วันที่พิมพ์/บันทึก"
      ]);
    }

    var currentTimestamp = new Date().toLocaleString("th-TH");

    // Build payment string (Show only account/bank name directly, e.g. "SCB SA 1234")
    var paymentFull = d.bankDetails || d.chequeNo || d.paymentMethod || "";

    // Extract items array if available, otherwise single item fallback
    var items = d.items && d.items.length > 0 ? d.items : [{
      itemTitle: d.itemTitle || "",
      itemDetails: d.itemDetails || "",
      period: d.period || d.term || "",
      quantity: d.quantity || 0,
      unitPrice: d.unitPrice || 0,
      drc: d.drc || "",
      totalAmount: d.totalAmount || 0
    }];

    // Check if updating existing receipt status (cancellation)
    var isCancelAction = d.status === 'ยกเลิก' || (d.cancelReason && d.cancelReason.trim().length > 0);
    
    if (isCancelAction) {
      var dataRange = sheet.getDataRange();
      var values = dataRange.getValues();
      var existingRowIndexes = [];

      for (var i = 1; i < values.length; i++) {
        if (String(values[i][1]).trim() === String(d.receiptNo).trim()) {
          existingRowIndexes.push(i + 1); // 1-indexed row number
        }
      }

      var currentTimestamp = new Date().toLocaleString("th-TH");

      if (existingRowIndexes.length > 0) {
        for (var idx = 0; idx < existingRowIndexes.length; idx++) {
          var rowNum = existingRowIndexes[idx];
          // Col P (16) = สถานะ, Col Q (17) = สาเหตุที่ยกเลิก, Col R (18) = วันที่พิมพ์/บันทึก (เวลาที่ยกเลิก)
          sheet.getRange(rowNum, 16).setValue(d.status || "ยกเลิก");
          sheet.getRange(rowNum, 17).setValue(d.cancelReason || "");
          sheet.getRange(rowNum, 18).setValue(currentTimestamp);
        }
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "success", 
          action: "updated", 
          receiptNo: d.receiptNo, 
          updatedRows: existingRowIndexes.length 
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Otherwise insert new rows for new receipt
    var rowsToInsert = [];
    for (var k = 0; k < items.length; k++) {
      var itm = items[k];
      
      var rawItemTitle = String(itm.itemTitle || itm.title || itm.name || d.itemTitle || "").trim();
      // Clean short code prefix if present (e.g., "FF:ตักยาง" -> "ตักยาง")
      if (rawItemTitle.indexOf(':') !== -1) {
        var parts = rawItemTitle.split(':');
        if (parts.length > 1 && parts[0].length <= 5) {
          rawItemTitle = parts.slice(1).join(':').trim();
        }
      }
      var itemDetailsVal = String(itm.itemDetails || itm.details || d.itemDetails || "").trim();
      var fullItemDescription = rawItemTitle + (itemDetailsVal ? " (" + itemDetailsVal + ")" : "");
      
      var qty = Number(itm.quantity || itm.qty || 0);
      var price = Number(itm.unitPrice || itm.price || 0);
      var drcRaw = String(itm.drc || "");
      var drcVal = parseFloat(drcRaw.replace('%', '')) || 0;

      var itemTotal = 0;
      if (itm.totalAmount !== undefined && itm.totalAmount !== null && Number(itm.totalAmount) > 0) {
        itemTotal = Number(itm.totalAmount);
      } else if (qty > 0 && price > 0) {
        if (drcVal > 0) {
          itemTotal = qty * price * (drcVal / 100);
        } else {
          itemTotal = qty * price;
        }
      }

      // Extract payment date with flexible field names from frontend
      var rawPayDate = d.paymentDateThai || d.paymentDateIso || d.paymentDate || d.transferDate || "";
      var payDateVal = "";
      if (rawPayDate) {
        if (rawPayDate.includes('-')) {
          // Convert YYYY-MM-DD to DD/MM/YYYY (Thai Year)
          var pParts = rawPayDate.split('-');
          if (pParts.length === 3) {
            var y = parseInt(pParts[0], 10);
            if (y < 2500) y += 543;
            payDateVal = pParts[2] + "/" + pParts[1] + "/" + y;
          } else {
            payDateVal = String(rawPayDate);
          }
        } else {
          payDateVal = String(rawPayDate);
        }
      }

      var docDateVal = d.dateThai || d.dateIso || "";
      if (docDateVal && docDateVal.includes('-')) {
        var dParts = docDateVal.split('-');
        if (dParts.length === 3) {
          var dy = parseInt(dParts[0], 10);
          if (dy < 2500) dy += 543;
          docDateVal = dParts[2] + "/" + dParts[1] + "/" + dy;
        }
      }

      rowsToInsert.push([
        "'" + (docDateVal || ""),
        "'" + (d.receiptNo || ""),
        d.buyerName || "",
        d.buyerAddress || "",
        "'" + (d.taxId || d.buyerTaxId || ""),
        itm.period || itm.term || d.period || d.term || "",
        fullItemDescription,
        qty,
        price,
        drcRaw,
        itemTotal,
        paymentFull,
        "'" + (payDateVal || ""),
        d.notes || "",
        d.cashierName || "",
        d.status || "ปกติ",
        d.cancelReason || "",
        d.printedTimestamp || currentTimestamp
      ]);
    }

    // Find the last row with actual data in Column B (Receipt No)
    var lastDataRow = 1;
    var maxCheckRow = Math.max(sheet.getLastRow(), 1);
    var colBValues = sheet.getRange(1, 2, maxCheckRow, 1).getValues();
    for (var idx = colBValues.length - 1; idx >= 0; idx--) {
      if (String(colBValues[idx][0] || '').trim() !== '') {
        lastDataRow = idx + 1;
        break;
      }
    }

    // Write starting right after the last real data row
    for (var r = 0; r < rowsToInsert.length; r++) {
      var targetRow = lastDataRow + 1 + r;
      sheet.getRange(targetRow, 1, 1, rowsToInsert[r].length).setValues([rowsToInsert[r]]);
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      action: "inserted", 
      receiptNo: d.receiptNo, 
      sheetUsed: sheet.getName(),
      spreadsheetId: ss.getId(),
      rowsCount: rowsToInsert.length 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var configSs;
    try {
      configSs = SpreadsheetApp.openById(CONFIG_SHEET_ID);
    } catch(err) {
      configSs = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    // 1. Fetch datasupplier (Col A=ชื่อ, Col B=ที่อยู่, Col C=เลขที่ผู้เสียภาษี)
    var supplierSheet = configSs.getSheetByName("datasupplier");
    var suppliers = [];
    if (supplierSheet && supplierSheet.getLastRow() > 1) {
      var supVals = supplierSheet.getRange("A2:C" + supplierSheet.getLastRow()).getValues();
      suppliers = supVals.map(function(r) { 
        return { name: r[0], address: r[1], taxId: String(r[2] || '') }; 
      }).filter(function(s) { return s.name; });
    }

    // 2. Fetch TOPS (Col A=ประเภทสินค้า, Col B=Short Code)
    var topSheet = configSs.getSheetByName("TOPS");
    var tops = [];
    if (topSheet && topSheet.getLastRow() > 1) {
      var topVals = topSheet.getRange("A2:B" + topSheet.getLastRow()).getValues();
      tops = topVals.map(function(r) { 
        var name = String(r[0] || '').trim();
        var code = String(r[1] || '').trim();
        var formatted = code ? (code + ":" + name) : name;
        return { name: name, code: code, formatted: formatted }; 
      }).filter(function(t) { return t.name || t.code; });
    }

    // 3. Fetch Payment (Col A=ประเภทการชำระ)
    var paymentSheet = configSs.getSheetByName("Payment");
    var payments = [];
    if (paymentSheet && paymentSheet.getLastRow() >= 1) {
      var payVals = paymentSheet.getRange("A1:A" + paymentSheet.getLastRow()).getValues();
      payments = payVals.map(function(r) { return r[0]; }).filter(Boolean);
    }

    // 4. Fetch Bankacc (Col A2:A=ธนาคาร/ชื่อบัญชี, Col B2:B=เลขที่บัญชี)
    var bankSheet = configSs.getSheetByName("Bankacc") || configSs.getSheetByName("Bank") || configSs.getSheetByName("Banks");
    var banks = [];
    if (bankSheet && bankSheet.getLastRow() > 1) {
      var bankVals = bankSheet.getRange("A2:B" + bankSheet.getLastRow()).getValues();
      banks = bankVals.map(function(r) { 
        var name = String(r[0] || '').trim();
        var num = String(r[1] || '').trim();
        if (name.toLowerCase() === 'bank number' || num.toLowerCase() === 'bank number') return '';
        if (name && num) return name + " " + num;
        return name || num || '';
      }).filter(Boolean);
    }

    // 5. Fetch gmail users (Col A=ชื่อ, Col B=นามสกุล, Col C=สิทธิ์, Col D=Gmail, Col E=สถานะ, Col F=รหัสผ่าน)
    var gmailSheet = configSs.getSheetByName("gmail") || configSs.getSheetByName("Gmail");
    var users = [];
    if (gmailSheet && gmailSheet.getLastRow() >= 1) {
      var gmailVals = gmailSheet.getRange("A1:F" + gmailSheet.getLastRow()).getValues();
      // Skip header if row 1 has "Gmail" or "ชื่อ"
      var startIdx = (String(gmailVals[0][0]).includes("ชื่อ") || String(gmailVals[0][3]).includes("Gmail")) ? 1 : 0;
      for (var u = startIdx; u < gmailVals.length; u++) {
        var r = gmailVals[u];
        if (r[3]) {
          var rawEmailCell = String(r[3] || '').trim();
          var emailParts = rawEmailCell.split(/\s+/);
          var cleanEmail = emailParts[0].toLowerCase();
          var extractedStatus = String(r[4] || '').trim();

          // If status was typed inside Column D by accident (e.g. "aukkdach.beem@gmail.com Approved")
          if ((!extractedStatus || extractedStatus === 'Approved') && emailParts.length > 1) {
             extractedStatus = emailParts[1].trim();
          }
          if (!extractedStatus) extractedStatus = 'Approved';
          
          var password = String(r[5] || '').trim();

          users.push({
            firstName: String(r[0] || '').trim(),
            lastName: String(r[1] || '').trim(),
            role: String(r[2] || 'User').trim(),
            email: cleanEmail,
            status: extractedStatus,
            rawPassword: password
          });
        }
      }
    }

    var result = {
      status: "success",
      suppliers: suppliers,
      tops: tops,
      payments: payments,
      banks: banks,
      users: users
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🧪 ฟังก์ชันสำหรับกดทดสอบรันใน Google Apps Script Editor โดยตรง
 * สามารถเลือกชื่อฟังก์ชัน "testSaveReceipt" แล้วกดปุ่ม Run (▶️) ได้ทันที
 */
function testSaveReceipt() {
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        action: "saveReceipt",
        logSheetId: LOG_SHEET_ID,
        data: {
          receiptNo: "TEST-69080001",
          dateThai: "08/08/2569",
          buyerName: "ทดสอบกด Run ใน Apps Script Editor",
          buyerAddress: "99/99 ตำบลทดสอบ อำเภอเมือง จ.บุรีรัมย์",
          taxId: "1234567890123",
          items: [{
            itemTitle: "ยางก้อน",
            itemDetails: "ทดสอบกด Run ลื่นไหล",
            period: "1/69",
            quantity: 10,
            unitPrice: 50,
            drc: "100%",
            totalAmount: 500
          }],
          totalAmount: 500,
          paymentMethod: "เงินสด",
          cashierName: "ผู้ทดสอบระบบ",
          status: "ปกติ"
        }
      })
    }
  };

  Logger.log("🚀 กำลังเริ่มทดสอบบันทึกข้อมูล...");
  var response = doPost(mockEvent);
  Logger.log("📌 ผลลัพธ์จาก doPost: " + response.getContent());
}

/**
 * 🧪 ทดสอบดึงข้อมูล Config (doGet) — เลือกฟังก์ชัน "testFetchConfig" แล้วกด Run (▶️)
 * จะเห็นรายชื่อ Suppliers, TOPS, Payments, Banks ทั้งหมดที่ระบบจะส่งให้เว็บแอพ
 */
function testFetchConfig() {
  Logger.log("🚀 กำลังทดสอบดึงข้อมูล Config...");
  var response = doGet({});
  var result = JSON.parse(response.getContent());
  
  Logger.log("📌 สถานะ: " + result.status);
  Logger.log("👤 Suppliers (" + (result.suppliers ? result.suppliers.length : 0) + " รายชื่อ):");
  if (result.suppliers) {
    result.suppliers.forEach(function(s, i) {
      Logger.log("   " + (i+1) + ". " + s.name + " | " + s.address + " | " + s.taxId);
    });
  }
  Logger.log("📦 TOPS (" + (result.tops ? result.tops.length : 0) + " รายการ):");
  if (result.tops) {
    result.tops.forEach(function(t, i) {
      Logger.log("   " + (i+1) + ". " + t.formatted);
    });
  }
  Logger.log("💳 Payments (" + (result.payments ? result.payments.length : 0) + " รายการ):");
  Logger.log("🏦 Banks (" + (result.banks ? result.banks.length : 0) + " รายการ):");
  Logger.log("📧 Users (" + (result.users ? result.users.length : 0) + " รายการ):");
  
  Logger.log("📋 JSON ทั้งหมด:");
  Logger.log(response.getContent());
}
