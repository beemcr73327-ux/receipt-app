function handleLogin(d, configSheetId) {
  var configSs = SpreadsheetApp.openById(configSheetId);
  var gmailSheet = configSs.getSheetByName("Master_Users") || configSs.getSheetByName("gmail") || configSs.getSheetByName("Gmail");
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

function handleRegisterUser(d, configSheetId) {
  var configSs = SpreadsheetApp.openById(configSheetId);
  var gmailSheet = configSs.getSheetByName("Master_Users") || configSs.getSheetByName("gmail") || configSs.getSheetByName("Gmail");
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
    if (gmailSheet.getLastRow() === 0) {
      gmailSheet.appendRow(["ชื่อ", "นามสกุล", "สิทธิ์", "Gmail", "สถานะ", "รหัสผ่าน"]);
    }
    gmailSheet.appendRow([d.firstName || "", d.lastName || "", "User", cleanTargetEmail, "Pending", ""]);
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "registerUser" })).setMimeType(ContentService.MimeType.JSON);
}

function handleUpdateUserStatus(d, configSheetId) {
  var configSs = SpreadsheetApp.openById(configSheetId);
  var gmailSheet = configSs.getSheetByName("Master_Users") || configSs.getSheetByName("gmail") || configSs.getSheetByName("Gmail");
  var dataRange = gmailSheet.getDataRange();
  var values = dataRange.getValues();
  var updated = false;
  var targetEmail = String(d.email || "").trim().toLowerCase();

  for (var i = 0; i < values.length; i++) {
    var rowCell = String(values[i][3] || "").trim().toLowerCase();
    var rowEmail = rowCell.split(/\s+/)[0];
    if (rowEmail === targetEmail) {
      gmailSheet.getRange(i + 1, 4).setValue(targetEmail);
      gmailSheet.getRange(i + 1, 3).setValue(d.role || values[i][2] || "User");
      gmailSheet.getRange(i + 1, 5).setValue(d.status || values[i][4] || "Approved");
      updated = true;
      break;
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "updateUserStatus", updated: updated })).setMimeType(ContentService.MimeType.JSON);
}

function getUsers(configSs) {
  var gmailSheet = configSs.getSheetByName("Master_Users") || configSs.getSheetByName("gmail") || configSs.getSheetByName("Gmail");
  var users = [];
  if (gmailSheet && gmailSheet.getLastRow() >= 1) {
    var gmailVals = gmailSheet.getRange("A1:F" + gmailSheet.getLastRow()).getValues();
    var startIdx = (String(gmailVals[0][0]).includes("ชื่อ") || String(gmailVals[0][3]).includes("Gmail")) ? 1 : 0;
    for (var u = startIdx; u < gmailVals.length; u++) {
      var r = gmailVals[u];
      if (r[3]) {
        var rawEmailCell = String(r[3] || '').trim();
        var emailParts = rawEmailCell.split(/\s+/);
        var cleanEmail = emailParts[0].toLowerCase();
        var extractedStatus = String(r[4] || '').trim();

        if ((!extractedStatus || extractedStatus === 'Approved') && emailParts.length > 1) {
           extractedStatus = emailParts[1].trim();
        }
        if (!extractedStatus) extractedStatus = 'Approved';
        
        var password = String(r[5] || '').trim();
        var fName = String(r[0] || '').trim();
        var lName = String(r[1] || '').trim();
        var fullName = (fName + " " + lName).trim();

        users.push({
          firstName: fName,
          lastName: lName,
          fullName: fullName,
          role: String(r[2] || 'User').trim(),
          email: cleanEmail,
          status: extractedStatus,
          rawPassword: password
        });
      }
    }
  }
  return users;
}
