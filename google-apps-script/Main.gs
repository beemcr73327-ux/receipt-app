// ==========================================
// CONFIGURATION & GLOBAL VARIABLES
// ==========================================
var CONFIG_SHEET_ID = "1FiWYtzhqsO_7TJ222INNWI8QsgXVJ7lWv83S3bfY7qM";
var LOG_SHEET_ID = "1YE4F8WjWT13R_aMOYVmR2NuhaA6FE8ua1cKsdMlttwk"; // ใบเสร็จรับเงิน
var VOUCHER_SHEET_ID = "1EjB8pdeRTlvu5q9YqltYPfHauy2CLxSWaowkz49zORk"; // ใบสำคัญจ่าย

function doGet(e) {
  try {
    var configSs = SpreadsheetApp.openById(CONFIG_SHEET_ID);
    
    // เรียกใช้ฟังก์ชันดึงค่าจาก Receipt.gs, Voucher.gs และ Auth.gs
    var result = {
      status: "success",
      suppliers: getSuppliers(configSs),
      receivers: getVoucherReceivers(configSs),
      tops: getTops(configSs),
      payments: getPayments(configSs),
      banks: getBanks(configSs),
      receiptBanks: getBanks(configSs, "RC"),
      voucherBanks: getBanks(configSs, "PV"),
      users: getUsers(configSs),
      receipts: getReceipts(LOG_SHEET_ID),
      vouchers: getVouchers(VOUCHER_SHEET_ID)
    };
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var rawContents = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = JSON.parse(rawContents);
    var action = payload.action;
    var d = payload.data || payload;

    // ระบบ Router แยกงานตาม action
    switch(action) {
      case "login":
        return handleLogin(d, CONFIG_SHEET_ID);

      case "registerUser":
        return handleRegisterUser(d, CONFIG_SHEET_ID);

      case "updateUserStatus":
        return handleUpdateUserStatus(d, CONFIG_SHEET_ID);

      case "saveVoucher":
        return handleSaveVoucher(d, VOUCHER_SHEET_ID, CONFIG_SHEET_ID);

      case "cancelVoucher":
        return handleCancelVoucher(d, VOUCHER_SHEET_ID);

      case "saveBank":
        return handleSaveBank(d, CONFIG_SHEET_ID);

      case "deleteBank":
        return handleDeleteBank(d, CONFIG_SHEET_ID);

      case "getVouchers":
        var vList = getVouchers(VOUCHER_SHEET_ID);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", vouchers: vList }))
          .setMimeType(ContentService.MimeType.JSON);

      case "saveReceipt":
      default:
        // ตรวจสอบว่าเป็นคำสั่งใบสำคัญจ่ายโดยสังเกตจาก voucherNo หรือ action
        if (action === "saveVoucher" || d.voucherNo) {
          return handleSaveVoucher(d, VOUCHER_SHEET_ID, CONFIG_SHEET_ID);
        }
        // ตรวจสอบว่าเป็นคำสั่งยกเลิกใบเสร็จ หรือเซฟใหม่
        var isCancelAction = d.status === 'ยกเลิก' || (d.cancelReason && d.cancelReason.trim().length > 0);
        if (isCancelAction && !d.voucherNo) {
          return handleCancelReceipt(d, LOG_SHEET_ID);
        } else {
          return handleSaveReceipt(d, LOG_SHEET_ID);
        }
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
