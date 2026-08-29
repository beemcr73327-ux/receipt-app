function getSuppliers(configSs) {
  var supplierSheet = configSs.getSheetByName("RC_Buyers") || configSs.getSheetByName("datasupplier");
  var suppliers = [];
  if (supplierSheet && supplierSheet.getLastRow() > 1) {
    var supVals = supplierSheet.getRange("A2:C" + supplierSheet.getLastRow()).getValues();
    suppliers = supVals.map(function(r) { 
      return { 
        name: cleanLeadingQuote(r[0]), 
        address: cleanLeadingQuote(r[1]), 
        taxId: cleanLeadingQuote(r[2]) 
      }; 
    }).filter(function(s) { return s.name; });
  }
  return suppliers;
}

function getTops(configSs) {
  var topSheet = configSs.getSheetByName("RC_Products") || configSs.getSheetByName("TOPS");
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
  return tops;
}

function getPayments(configSs) {
  var paymentSheet = configSs.getSheetByName("Master_Payments") || configSs.getSheetByName("Payment");
  var payments = [];
  if (paymentSheet && paymentSheet.getLastRow() >= 1) {
    var payVals = paymentSheet.getRange("A1:A" + paymentSheet.getLastRow()).getValues();
    payments = payVals.map(function(r) { return String(r[0] || '').trim(); }).filter(Boolean);
  }
  return payments;
}

function getBanks(configSs, targetModule) {
  var bankSheet = configSs.getSheetByName("Master_Banks") || 
                  configSs.getSheetByName("Bankacc") || 
                  configSs.getSheetByName("Bank") || 
                  configSs.getSheetByName("Banks");
  var banks = [];
  if (bankSheet && bankSheet.getLastRow() > 1) {
    var numCols = Math.max(bankSheet.getLastColumn(), 6);
    var bankVals = bankSheet.getRange(2, 1, bankSheet.getLastRow() - 1, numCols).getValues();
    
    for (var i = 0; i < bankVals.length; i++) {
      var r = bankVals[i];
      var colA = cleanLeadingQuote(r[0]); // Abbr or Name
      var colB = cleanLeadingQuote(r[1]); // Full Name or Last 4
      var colC = cleanLeadingQuote(r[2]); // Last 4 or Full Acc
      var colD = cleanLeadingQuote(r[3]); // Full Acc
      var colE = cleanLeadingQuote(r[4]); // Acc Holder Name
      var colF = cleanLeadingQuote(r[5]).toUpperCase(); // Usage Short Code (RC, PV, ALL)

      if (!colA && !colB) continue;
      if (colA.toLowerCase() === 'bank' || colB.toLowerCase() === 'number') continue;

      // กฎใหม่: ถ้าไม่มี Short Code (ว่างเปล่า) จะไม่แสดงในระบบใดๆ เลย
      if (!colF) continue;

      // กรองตามประเภทโมดูล (RC หรือ PV)
      if (targetModule) {
        var modUpper = String(targetModule).toUpperCase();
        if (colF !== 'ALL' && colF.indexOf(modUpper) === -1) {
          continue; // ข้ามถ้าระบบไม่ตรงกัน
        }
      }

      var bankAbbr = colA;
      var bankFullName = colB;
      var accountHolder = colE;
      var last4 = "";

      // ค้นหาเลขท้าย 4 หลัก: ถ้า colB เป็นเลข 4 หลัก ให้ใช้ colB ก่อน ถ้าไม่ใช่ให้ดึง 4 หลักท้ายจาก colC/colD
      if (colB && colB.length <= 5) {
        last4 = colB;
      } else if (colC && colC.length <= 5) {
        last4 = colC;
      } else if (colC && colC.length > 5) {
        last4 = colC.slice(-4);
      } else if (colD && colD.length > 5) {
        last4 = colD.slice(-4);
      }

      // สำหรับใบเสร็จรับเงิน (RC): แสดงเฉพาะ [ตัวย่อธนาคาร] + [เลขท้าย 4 หลัก] (เช่น BBL 0488)
      var formatted = "";
      if (targetModule === "RC") {
        formatted = (bankAbbr ? bankAbbr + " " : "") + (last4 || colB || colC);
      } else if (colF === "ALL") {
        // บัญชีต้นทาง (บริษัทเรา): ตัวย่อธนาคาร + เลขบัญชีเต็ม
        formatted = (bankAbbr ? bankAbbr + " " : "") + (colD || colC);
      } else {
        // บัญชีปลายทาง (PV): เลขบัญชีเต็ม
        formatted = (colD || colC);
      }

      var fullAccount = colD || colC;
      var sourceFormatted = (bankAbbr ? bankAbbr + " " : "") + fullAccount;
      var destNameFormatted = (bankFullName ? bankFullName + " " : "") + (accountHolder || "");

      banks.push({
        rowIndex: i + 2,
        bankAbbr: bankAbbr,
        bankFullName: bankFullName,
        last4: cleanLeadingQuote(last4),
        fullAccNum: cleanLeadingQuote(fullAccount),
        accountHolder: accountHolder,
        usage: colF,
        formatted: formatted.trim(),
        sourceBankFormatted: sourceFormatted.trim(),
        destBankFormatted: fullAccount.trim(),
        destBankName: destNameFormatted.trim(),
        toString: function() { return this.formatted; }
      });
    }
  }
  return banks;
}


function getReceipts(logSheetId) {
  var receipts = [];
  var logSs = SpreadsheetApp.openById(logSheetId);
  var logSheet = logSs.getSheetByName("database") || logSs.getSheetByName("Receipts") || logSs.getSheets()[0];
  
  if (logSheet && logSheet.getLastRow() > 1) {
    var logVals = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 20).getValues();
    var receiptMap = {};
    var receiptOrder = [];

    for (var i = 0; i < logVals.length; i++) {
      var row = logVals[i];
      var rNo = cleanLeadingQuote(row[1]);
      if (!rNo) continue;

      var itemObj = {
        id: i + 1,
        title: String(row[6] || '').trim(),
        period: formatPeriodGAS(row[5]),
        quantity: Number(row[7] || 0),
        unitPrice: Number(row[8] || 0),
        drc: String(row[9] || ''),
        discountAmount: Number(row[10] || 0),
        discountDetails: String(row[11] || ''),
        amount: Number(row[12] || 0)
      };

      if (!receiptMap[rNo]) {
        receiptMap[rNo] = {
          receiptNo: rNo,
          dateThai: formatStandardDateGAS(cleanLeadingQuote(row[0])),
          buyerName: String(row[2] || '').trim(),
          buyerAddress: String(row[3] || '').trim(),
          buyerTaxId: cleanLeadingQuote(row[4]),
          taxId: cleanLeadingQuote(row[4]),
          paymentMethod: String(row[13] || '').trim(),
          paymentDateThai: formatStandardDateGAS(cleanLeadingQuote(row[14])),
          notes: String(row[15] || '').trim(),
          cashierName: String(row[16] || '').trim(),
          status: String(row[17] || 'ปกติ').trim(),
          cancelReason: cleanLeadingQuote(row[18]),
          updatedAt: getFormattedThaiDateTime(row[19]),
          printedTimestamp: getFormattedThaiDateTime(row[19]),
          items: [],
          totalAmount: 0
        };
        receiptOrder.push(rNo);
      }

      receiptMap[rNo].items.push(itemObj);
      receiptMap[rNo].totalAmount += itemObj.amount;
    }

    for (var rIdx = receiptOrder.length - 1; rIdx >= 0; rIdx--) {
      receipts.push(receiptMap[receiptOrder[rIdx]]);
    }
  }
  return receipts;
}

function handleCancelReceipt(d, logSheetId) {
  var ss = SpreadsheetApp.openById(logSheetId);
  var sheet = ss.getSheetByName("database") || ss.getSheetByName("Receipts") || ss.getSheets()[0];
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var existingRowIndexes = [];

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).trim() === String(d.receiptNo).trim()) {
      existingRowIndexes.push(i + 1);
    }
  }

  var currentTimestamp = new Date().toLocaleString("th-TH");

  if (existingRowIndexes.length > 0) {
    for (var idx = 0; idx < existingRowIndexes.length; idx++) {
      var rowNum = existingRowIndexes[idx];
      sheet.getRange(rowNum, 18).setValue(d.status || "ยกเลิก"); // Col R = 18
      sheet.getRange(rowNum, 19).setValue(d.cancelReason || ""); // Col S = 19
      sheet.getRange(rowNum, 20).setValue(currentTimestamp); // Col T = 20
    }
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      action: "updated", 
      receiptNo: d.receiptNo, 
      updatedRows: existingRowIndexes.length 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบเลขที่เอกสาร" })).setMimeType(ContentService.MimeType.JSON);
}

function handleSaveReceipt(d, logSheetId) {
  var ss = SpreadsheetApp.openById(logSheetId);
  var sheet = ss.getSheetByName("database") || ss.getSheetByName("Receipts") || ss.getSheets()[0];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "วันที่", "เลขที่ใบเสร็จ", "นามผู้ซื้อ", "ที่อยู่", "เลขประจำตัวผู้เสียภาษี",
      "งวด", "รายการสินค้าหรือบริการ", "จำนวน", "ราคาต่อหน่วย", "DRC(%)",
      "เพิ่มลด", "รายละเอียด", "จำนวนเงิน", "ชำระโดย", "วันที่โอน/สั่งจ่าย",
      "หมายเหตุ", "ผู้รับเงิน", "สถานะ", "สาเหตุที่ยกเลิก", "วันที่พิมพ์/บันทึก"
    ]);
  }

  var currentTimestamp = getFormattedThaiDateTime(new Date());
  var paymentFull = d.bankDetails || d.chequeNo || d.paymentMethod || "";
  var items = d.items && d.items.length > 0 ? d.items : [];

  var rowsToInsert = [];
  for (var k = 0; k < items.length; k++) {
    var itm = items[k];
    var rawItemTitle = String(itm.itemTitle || itm.title || itm.name || d.itemTitle || "").trim();
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
    var discAmt = Number(itm.discountAmount || 0);
    
    var grossSubtotal = (qty > 0 && price > 0)
      ? (drcVal > 0 ? (qty * price * (drcVal / 100)) : (qty * price))
      : 0;

    var itemTotal = (itm.amount !== undefined && itm.amount !== null && Number(itm.amount) >= 0 && !isNaN(Number(itm.amount)) && Number(itm.amount) !== grossSubtotal)
      ? Number(itm.amount)
      : Math.max(0, grossSubtotal - discAmt);

    var rawPayDate = d.paymentDateThai || d.paymentDateIso || d.paymentDate || d.transferDate || "";
    var payDateVal = "";
    if (rawPayDate) {
      if (rawPayDate.includes('-')) {
        var pParts = rawPayDate.split('-');
        if (pParts.length === 3) {
          var y = parseInt(pParts[0], 10);
          if (y < 2500) y += 543;
          payDateVal = pParts[2] + "/" + pParts[1] + "/" + y;
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

    var discNoteVal = String(itm.discountDetails || itm.discountNote || "").trim();

    rowsToInsert.push([
      docDateVal || "",
      toSheetText(d.receiptNo),
      String(d.buyerName || '').trim(),
      String(d.buyerAddress || '').trim(),
      toSheetText(d.taxId || d.buyerTaxId || ''),
      toSheetText(itm.period || itm.term || d.period || d.term || ''),
      fullItemDescription,
      qty,
      price,
      drcRaw,
      discAmt,
      discNoteVal,
      itemTotal,
      paymentFull,
      payDateVal || "",
      d.notes || "",
      d.cashierName || "",
      d.status || "ปกติ",
      d.cancelReason || "",
      d.printedTimestamp || currentTimestamp
    ]);
  }

  // ค้นหาแถวจริงล่าสุด เพื่อเขียนต่อท้าย
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
    action: "inserted", 
    receiptNo: d.receiptNo, 
    sheetUsed: sheet.getName(),
    spreadsheetId: ss.getId(),
    rowsCount: rowsToInsert.length 
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 🧪 ฟังก์ชันสำหรับกดทดสอบรันใน Google Apps Script Editor โดยตรง
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
  var response = handleSaveReceipt(mockEvent.postData.contents, LOG_SHEET_ID);
  Logger.log("📌 ผลลัพธ์จาก doPost: " + response.getContent());
}

/**
 * 🧪 ทดสอบดึงข้อมูล Config — เลือกฟังก์ชัน "testFetchConfig" แล้วกด Run
 */
function testFetchConfig() {
  Logger.log("🚀 กำลังทดสอบดึงข้อมูล Config...");
  var configSs = SpreadsheetApp.openById(CONFIG_SHEET_ID);
  var result = {
    suppliers: getSuppliers(configSs),
    tops: getTops(configSs),
    payments: getPayments(configSs),
    banks: getBanks(configSs),
    users: getUsers(configSs),
    receipts: getReceipts(LOG_SHEET_ID)
  };
  
  Logger.log("📌 สถานะ: success");
  Logger.log("👤 Suppliers (" + (result.suppliers ? result.suppliers.length : 0) + " รายชื่อ):");
  Logger.log("📋 ผลลัพธ์ทั้งหมด:");
  Logger.log(JSON.stringify(result));
}
