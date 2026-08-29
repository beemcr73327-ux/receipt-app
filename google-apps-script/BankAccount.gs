function handleSaveBank(d, configSheetId) {
  try {
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch(e) {}
    }
    if (d && d.data) { d = d.data; }
    if (!d) d = {};

    var targetSheetId = configSheetId || CONFIG_SHEET_ID || "1FiWYtzhqsO_7TJ222INNWI8QsgXVJ7lWv83S3bfY7qM";
    var ss = SpreadsheetApp.openById(targetSheetId);
    var sheet = ss.getSheetByName("Master_Banks") || 
                ss.getSheetByName("Bankacc") || 
                ss.getSheetByName("Bank") || 
                ss.getSheetByName("Banks");
                
    if (!sheet) {
      sheet = ss.insertSheet("Master_Banks");
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ตัวย่อ", "ชื่อธนาคาร", "เลขท้าย4หลัก", "เลขที่บัญชีเต็ม", "ชื่อบัญชี", "Short Code"]);
    }

    var originalAccNum = cleanLeadingQuote(d.originalFullAccNum || d.originalAccountNumber || '');
    var fullAccNum = cleanLeadingQuote(d.fullAccNum || d.accountNumber || '');
    var searchAccNum = originalAccNum || fullAccNum;

    var bankAbbr = cleanLeadingQuote(d.bankAbbr || '');
    var bankFullName = String(d.bankFullName || d.bankName || '').trim();
    var accountHolder = String(d.accountHolder || d.accountName || '').trim();
    var usage = String(d.usage || 'ALL').trim().toUpperCase();

    var values = sheet.getDataRange().getValues();
    var existingRowIndex = -1;

    if (d.rowIndex && Number(d.rowIndex) > 1 && Number(d.rowIndex) <= values.length) {
      existingRowIndex = Number(d.rowIndex);
    } else if (searchAccNum) {
      for (var i = 1; i < values.length; i++) {
        var colDVal = cleanLeadingQuote(values[i][3]);
        var colCVal = cleanLeadingQuote(values[i][2]);
        if (colDVal === searchAccNum || colCVal === searchAccNum) {
          existingRowIndex = i + 1;
          break;
        }
      }
    }

    var last4 = fullAccNum.length >= 4 ? fullAccNum.slice(-4) : fullAccNum;
    var rowData = [bankAbbr, bankFullName, toSheetText(last4), toSheetText(fullAccNum), accountHolder, usage];

    if (existingRowIndex > 1) {
      sheet.getRange(existingRowIndex, 1, 1, 6).setValues([rowData]);
      Logger.log("✅ อัปเดตข้อมูลบัญชีเดิมสำเร็จ ที่แถว " + existingRowIndex + " (เลขท้าย 4 หลัก: " + last4 + ")");
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        action: "updated", 
        rowIndex: existingRowIndex,
        bank: { rowIndex: existingRowIndex, bankAbbr: bankAbbr, bankFullName: bankFullName, last4: last4, fullAccNum: fullAccNum, accountHolder: accountHolder, usage: usage }
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      sheet.appendRow(rowData);
      var newRowIdx = sheet.getLastRow();
      Logger.log("✅ เพิ่มข้อมูลบัญชีใหม่สำเร็จ ที่แถว " + newRowIdx + " (เลขท้าย 4 หลัก: " + last4 + ")");
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        action: "inserted", 
        rowIndex: newRowIdx,
        bank: { rowIndex: newRowIdx, bankAbbr: bankAbbr, bankFullName: bankFullName, last4: last4, fullAccNum: fullAccNum, accountHolder: accountHolder, usage: usage }
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    Logger.log("❌ Error in handleSaveBank: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleDeleteBank(d, configSheetId) {
  try {
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch(e) {}
    }
    if (d && d.data) { d = d.data; }
    if (!d) d = {};

    var targetSheetId = configSheetId || CONFIG_SHEET_ID || "1FiWYtzhqsO_7TJ222INNWI8QsgXVJ7lWv83S3bfY7qM";
    var ss = SpreadsheetApp.openById(targetSheetId);
    var sheet = ss.getSheetByName("Master_Banks") || 
                ss.getSheetByName("Bankacc") || 
                ss.getSheetByName("Bank") || 
                ss.getSheetByName("Banks");

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบชีต Master_Banks" })).setMimeType(ContentService.MimeType.JSON);
    }

    var targetAccNum = String(d.fullAccNum || d.accountNumber || '').trim();
    var targetRowIndex = Number(d.rowIndex || 0);

    var values = sheet.getDataRange().getValues();
    var rowToDelete = -1;

    if (targetRowIndex > 1 && targetRowIndex <= values.length) {
      rowToDelete = targetRowIndex;
    } else if (targetAccNum) {
      for (var i = 1; i < values.length; i++) {
        var colDVal = String(values[i][3] || '').trim();
        var colCVal = String(values[i][2] || '').trim();
        if (colDVal === targetAccNum || colCVal === targetAccNum) {
          rowToDelete = i + 1;
          break;
        }
      }
    }

    if (rowToDelete > 1) {
      sheet.deleteRow(rowToDelete);
      Logger.log("✅ ลบแถวที่ " + rowToDelete + " สำเร็จ");
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "deleted", deletedRow: rowToDelete })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบบัญชีที่ต้องการลบ" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("❌ Error in handleDeleteBank: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🧪 ฟังก์ชันสำหรับกดทดสอบรันใน Google Apps Script Editor โดยตรง
 * เลือกฟังก์ชัน "testSaveBank" ใน Apps Script Editor แล้วกด Run
 */
function testSaveBank() {
  Logger.log("🚀 กำลังเริ่มทดสอบบันทึกข้อมูลบัญชีธนาคาร...");
  var mockData = {
    bankAbbr: "KBANK",
    bankName: "ธนาคารกสิกรไทย (ทดสอบ)",
    fullAccNum: "9998887776",
    accountHolder: "บจก. ศรีสุข พูนทรัพย์ ยางพารา (ทดสอบ)",
    usage: "ALL"
  };
  var response = handleSaveBank(mockData, CONFIG_SHEET_ID);
  Logger.log("📌 ผลลัพธ์: " + response.getContent());
}
