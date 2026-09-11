/**
 * Google Sheets Background Sync Service (Phase 1.2)
 * Asynchronous, non-blocking replication of Receipts and Vouchers to Google Sheets
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

export const DEFAULT_GAS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbyg4uurkB24tvAUP33Xaxgb5JXyPZK06yPCTKnQUDIGSj2lidTmi-T8qx3MJ7ob938d/exec';

/**
 * Resolves the Google Apps Script Webhook URL from environment or default
 */
export function getGasWebhookUrl(env) {
  if (env && env.GOOGLE_SHEETS_WEBHOOK && env.GOOGLE_SHEETS_WEBHOOK.trim().length > 0) {
    return env.GOOGLE_SHEETS_WEBHOOK.trim();
  }
  return DEFAULT_GAS_WEBHOOK_URL;
}

/**
 * Formats standard Thai Date string DD/MM/YYYY
 */
export function formatThaiDateString(dateInput) {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      let y = parseInt(parts[0], 10);
      if (y < 2500) y += 543;
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
  }
  return str;
}

// ==========================================
// 1. PAYLOAD BUILDERS (MAPPING D1 TO GAS)
// ==========================================

/**
 * Builds Google Sheets sync payload for Receipt creation/update (20 columns in Sheets)
 */
export function buildReceiptSyncPayload(receipt) {
  const items = (receipt.items || []).map((item) => ({
    itemTitle: item.item_title || item.itemTitle || item.title || '',
    quantity: item.quantity !== undefined ? Number(item.quantity) : 0,
    unitPrice: item.unit_price !== undefined ? Number(item.unit_price) : (Number(item.unitPrice) || 0),
    drc: item.drc_percent ? `${item.drc_percent}%` : (item.drc || ''),
    discountAmount: item.discount_amount !== undefined ? Number(item.discount_amount) : (Number(item.discountAmount) || 0),
    discountDetails: item.discount_details || item.discountDetails || '',
    amount: item.net_amount !== undefined ? Number(item.net_amount) : (Number(item.amount) || 0),
    period: item.period || receipt.period || ''
  }));

  return {
    action: 'saveReceipt',
    receiptNo: receipt.receipt_no || receipt.receiptNo,
    dateThai: formatThaiDateString(receipt.doc_date || receipt.docDate),
    docDate: receipt.doc_date || receipt.docDate,
    buyerName: receipt.buyer_name || receipt.buyerName || '',
    buyerAddress: receipt.buyer_address || receipt.buyerAddress || '',
    buyerTaxId: receipt.buyer_tax_id || receipt.buyerTaxId || receipt.taxId || '',
    taxId: receipt.buyer_tax_id || receipt.buyerTaxId || receipt.taxId || '',
    period: receipt.period || '',
    paymentMethod: receipt.payment_method || receipt.paymentMethod || 'เงินโอน',
    paymentDateThai: formatThaiDateString(receipt.pay_date || receipt.payDate || receipt.doc_date || receipt.docDate),
    paymentDate: receipt.pay_date || receipt.payDate || '',
    bankDetails: receipt.bank_details || receipt.bankDetails || receipt.payment_method || '',
    notes: receipt.notes || '',
    cashierName: receipt.cashier_name || receipt.cashierName || '',
    status: receipt.status || 'ปกติ',
    cancelReason: receipt.cancel_reason || receipt.cancelReason || '',
    printedTimestamp: receipt.printed_timestamp || receipt.printedTimestamp || '',
    items
  };
}

/**
 * Builds Google Sheets payload for Receipt cancellation
 */
export function buildReceiptCancelPayload(receiptNo, reason = '') {
  return {
    action: 'saveReceipt',
    receiptNo: String(receiptNo).trim(),
    status: 'ยกเลิก',
    cancelReason: String(reason).trim()
  };
}

/**
 * Builds Google Sheets sync payload for Payment Voucher (18 columns in Sheets)
 */
export function buildVoucherSyncPayload(voucher) {
  const items = (voucher.items || []).map((item) => ({
    itemDate: formatThaiDateString(item.item_date || item.itemDate || voucher.doc_date || voucher.docDate),
    description: item.description || item.title || '',
    amount: item.amount !== undefined ? Number(item.amount) : 0
  }));

  return {
    action: 'saveVoucher',
    voucherNo: voucher.voucher_no || voucher.voucherNo,
    docDate: voucher.doc_date || voucher.docDate,
    dateThai: formatThaiDateString(voucher.doc_date || voucher.docDate),
    docDateThai: formatThaiDateString(voucher.doc_date || voucher.docDate),
    receiverName: voucher.receiver_name || voucher.receiverName || '',
    receiver: voucher.receiver_name || voucher.receiverName || '',
    mainDescription: voucher.main_description || voucher.mainDescription || '',
    description: voucher.main_description || voucher.mainDescription || '',
    refNo: voucher.ref_no || voucher.refNo || '',
    paymentMethod: voucher.payment_method || voucher.paymentMethod || 'เงินโอน',
    sourceBankAcc: voucher.source_bank_acc || voucher.sourceBankAcc || '',
    chequeOrDestAcc: voucher.cheque_or_dest_acc || voucher.chequeOrDestAcc || '',
    destBank: voucher.dest_bank || voucher.destBank || '',
    destBankAcc: voucher.dest_bank_acc || voucher.cheque_or_dest_acc || voucher.chequeOrDestAcc || '',
    accountHolder: voucher.account_holder || voucher.accountHolder || '',
    payDate: voucher.pay_date || voucher.payDate || voucher.doc_date || voucher.docDate,
    payDateThai: formatThaiDateString(voucher.pay_date || voucher.payDate || voucher.doc_date || voucher.docDate),
    notes: voucher.notes || '',
    cashierName: voucher.cashier_name || voucher.cashierName || '',
    status: voucher.status || 'ปกติ',
    cancelReason: voucher.cancel_reason || voucher.cancelReason || '',
    items
  };
}

/**
 * Builds Google Sheets payload for Payment Voucher cancellation
 */
export function buildVoucherCancelPayload(voucherNo, reason = '') {
  return {
    action: 'cancelVoucher',
    voucherNo: String(voucherNo).trim(),
    status: 'ยกเลิก',
    cancelReason: String(reason).trim()
  };
}

// ==========================================
// 2. HTTP DISPATCHER & RESILIENCE ENGINE
// ==========================================

/**
 * Posts JSON payload to Google Apps Script Webhook with timeout protection
 */
export async function sendPayloadToGas(payload, webhookUrl, options = {}) {
  const timeoutMs = options.timeoutMs || 8000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    };

    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    const response = await fetch(webhookUrl, fetchOptions);
    const rawText = await response.text();

    let responseData = null;
    try {
      responseData = JSON.parse(rawText);
    } catch {
      responseData = { raw: rawText };
    }

    return {
      success: response.ok,
      status: response.status,
      data: responseData
    };
  } catch (error) {
    const isAbort = error.name === 'AbortError';
    return {
      success: false,
      status: isAbort ? 408 : 500,
      error: isAbort ? `GAS webhook timed out after ${timeoutMs}ms` : error.message
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// ==========================================
// 3. BACKGROUND SYNC WRAPPERS (FOR ctx.waitUntil)
// ==========================================

/**
 * Syncs newly created/updated Receipt to Google Sheets asynchronously
 */
export async function syncReceiptToGoogleSheets(receipt, env, options = {}) {
  const webhookUrl = getGasWebhookUrl(env);
  const payload = buildReceiptSyncPayload(receipt);
  const result = await sendPayloadToGas(payload, webhookUrl, options);
  return result;
}

/**
 * Syncs Receipt cancellation to Google Sheets asynchronously
 */
export async function syncCancelReceiptToGoogleSheets(receiptNo, reason, env, options = {}) {
  const webhookUrl = getGasWebhookUrl(env);
  const payload = buildReceiptCancelPayload(receiptNo, reason);
  const result = await sendPayloadToGas(payload, webhookUrl, options);
  return result;
}

/**
 * Syncs newly created/updated Voucher to Google Sheets asynchronously
 */
export async function syncVoucherToGoogleSheets(voucher, env, options = {}) {
  const webhookUrl = getGasWebhookUrl(env);
  const payload = buildVoucherSyncPayload(voucher);
  const result = await sendPayloadToGas(payload, webhookUrl, options);
  return result;
}

/**
 * Syncs Voucher cancellation to Google Sheets asynchronously
 */
export async function syncCancelVoucherToGoogleSheets(voucherNo, reason, env, options = {}) {
  const webhookUrl = getGasWebhookUrl(env);
  const payload = buildVoucherCancelPayload(voucherNo, reason);
  const result = await sendPayloadToGas(payload, webhookUrl, options);
  return result;
}
