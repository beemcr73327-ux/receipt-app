/**
 * Staging API Client (Phase 1.3)
 * Connects React Frontend to Cloudflare Worker + D1 Staging Backend
 * Features: Idempotency Key Injection, Error Handling, Health Checks
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

export const DEFAULT_STAGING_API_URL = 'https://receipt-backend-staging.beemcr73327.workers.dev';
export const LOCAL_STAGING_API_URL = 'http://localhost:8787';

/**
 * Generates a standard UUIDv4 for Idempotency Key
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalizes URL string to ensure no trailing slash
 */
export function cleanApiUrl(url) {
  const target = url && url.trim().length > 0 ? url.trim() : DEFAULT_STAGING_API_URL;
  return target.replace(/\/+$/, '');
}

/**
 * 1. Health Check Endpoint
 */
export async function checkStagingHealth(baseUrl = DEFAULT_STAGING_API_URL) {
  const url = `${cleanApiUrl(baseUrl)}/health`;
  try {
    const response = await fetch(url, { method: 'GET' });
    const data = await response.json();
    return {
      online: response.ok && data.status === 'online',
      data,
      status: response.status
    };
  } catch (err) {
    return {
      online: false,
      error: err.message
    };
  }
}

/**
 * 2. Create Receipt (POST /api/v1/receipts)
 */
export async function createReceiptStaging(receiptData, baseUrl = DEFAULT_STAGING_API_URL, options = {}) {
  const url = `${cleanApiUrl(baseUrl)}/api/v1/receipts`;
  const idempotencyKey = options.idempotencyKey || generateUUID();

  // Normalize frontend fields into Staging API payload format
  const payload = {
    receiptNo: receiptData.receiptNo,
    docDate: receiptData.docDate || receiptData.dateIso || new Date().toISOString().split('T')[0],
    buyerName: receiptData.buyerName || '',
    buyerAddress: receiptData.buyerAddress || '',
    buyerTaxId: receiptData.buyerTaxId || receiptData.taxId || '',
    period: receiptData.period || '',
    paymentMethod: receiptData.paymentMethod || 'เงินโอน',
    payDate: receiptData.payDate || receiptData.paymentDateIso || receiptData.docDate,
    notes: receiptData.notes || '',
    cashierName: receiptData.cashierName || 'Cashier',
    items: (receiptData.items || []).map((item, idx) => ({
      itemTitle: item.itemTitle || item.title || item.name || '',
      quantity: Number(item.quantity || item.qty || 0),
      unitPrice: Number(item.unitPrice || item.price || 0),
      drcPercent: parseFloat(String(item.drc || item.drcPercent || 0).replace('%', '')) || 0,
      discountAmount: Number(item.discountAmount || 0),
      discountDetails: item.discountDetails || '',
      sortOrder: idx + 1
    }))
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();
  if (!response.ok || resJson.status === 'error') {
    throw new Error(resJson.message || `เกิดข้อผิดพลาดในการบันทึกใบเสร็จ (HTTP ${response.status})`);
  }

  return {
    ...resJson.data,
    _idempotencyKey: idempotencyKey,
    _cached: response.headers.get('X-Idempotency-Cached') === 'HIT'
  };
}

/**
 * 3. Cancel Receipt (POST /api/v1/receipts/:receiptNo/cancel)
 */
export async function cancelReceiptStaging(receiptNo, reason, baseUrl = DEFAULT_STAGING_API_URL, options = {}) {
  const cleanNo = encodeURIComponent(String(receiptNo).trim());
  const url = `${cleanApiUrl(baseUrl)}/api/v1/receipts/${cleanNo}/cancel`;
  const idempotencyKey = options.idempotencyKey || generateUUID();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: JSON.stringify({ reason: reason || 'ยกเลิกเอกสาร' })
  });

  const resJson = await response.json();
  if (!response.ok || resJson.status === 'error') {
    throw new Error(resJson.message || `เกิดข้อผิดพลาดในการยกเลิกใบเสร็จ (HTTP ${response.status})`);
  }

  return resJson.data;
}

/**
 * 4. Create Payment Voucher (POST /api/v1/vouchers)
 */
export async function createVoucherStaging(voucherData, baseUrl = DEFAULT_STAGING_API_URL, options = {}) {
  const url = `${cleanApiUrl(baseUrl)}/api/v1/vouchers`;
  const idempotencyKey = options.idempotencyKey || generateUUID();

  const payload = {
    voucherNo: voucherData.voucherNo,
    docDate: voucherData.docDate || voucherData.dateIso || new Date().toISOString().split('T')[0],
    receiverName: voucherData.receiverName || voucherData.receiver || '',
    overallDescription: voucherData.overallDescription || voucherData.description || voucherData.mainDescription || '',
    refDocNo: voucherData.refDocNo || voucherData.refNo || '',
    paymentMethod: voucherData.paymentMethod || 'เงินโอน',
    chequeNo: voucherData.chequeNo || voucherData.chequeOrDestAcc || '',
    bankAccount: voucherData.bankAccount || voucherData.sourceBankAcc || voucherData.destBankAcc || '',
    paymentDate: voucherData.paymentDate || voucherData.payDate || voucherData.docDate,
    notes: voucherData.notes || '',
    cashierName: voucherData.cashierName || 'Cashier',
    items: (voucherData.items || []).map((item, idx) => ({
      itemDate: item.itemDate || voucherData.docDate,
      description: item.description || item.title || '',
      amount: Number(item.amount || 0),
      sortOrder: idx + 1
    }))
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();
  if (!response.ok || resJson.status === 'error') {
    throw new Error(resJson.message || `เกิดข้อผิดพลาดในการบันทึกใบสำคัญจ่าย (HTTP ${response.status})`);
  }

  return {
    ...resJson.data,
    _idempotencyKey: idempotencyKey,
    _cached: response.headers.get('X-Idempotency-Cached') === 'HIT'
  };
}

/**
 * 5. Cancel Payment Voucher (POST /api/v1/vouchers/:voucherNo/cancel)
 */
export async function cancelVoucherStaging(voucherNo, reason, baseUrl = DEFAULT_STAGING_API_URL, options = {}) {
  const cleanNo = encodeURIComponent(String(voucherNo).trim());
  const url = `${cleanApiUrl(baseUrl)}/api/v1/vouchers/${cleanNo}/cancel`;
  const idempotencyKey = options.idempotencyKey || generateUUID();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: JSON.stringify({ reason: reason || 'ยกเลิกเอกสาร' })
  });

  const resJson = await response.json();
  if (!response.ok || resJson.status === 'error') {
    throw new Error(resJson.message || `เกิดข้อผิดพลาดในการยกเลิกใบสำคัญจ่าย (HTTP ${response.status})`);
  }

  return resJson.data;
}

/**
 * 6. Batch Import Receipts & Vouchers (POST /api/v1/documents/import-batch)
 */
export async function importBatchDocuments(batchPayload, baseUrl = DEFAULT_STAGING_API_URL, options = {}) {
  const url = `${cleanApiUrl(baseUrl)}/api/v1/documents/import-batch`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: JSON.stringify(batchPayload)
  });

  const resJson = await response.json();
  if (!response.ok || resJson.status === 'error') {
    throw new Error(resJson.message || `เกิดข้อผิดพลาดในการนำเข้าข้อมูล (HTTP ${response.status})`);
  }

  return resJson.data;
}

/**
 * 7. Seed Sequence (POST /api/v1/sequence/seed)
 */
export async function seedDocumentSequence(docType, prefix, seedValue, baseUrl = DEFAULT_STAGING_API_URL, options = {}) {
  const url = `${cleanApiUrl(baseUrl)}/api/v1/sequence/seed`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: JSON.stringify({ docType, prefix, seedValue: parseInt(seedValue, 10) })
  });

  const resJson = await response.json();
  if (!response.ok || resJson.status === 'error') {
    throw new Error(resJson.message || `เกิดข้อผิดพลาดในการตั้งค่าเลขเริ่มต้น (HTTP ${response.status})`);
  }

  return resJson.data;
}

/**
 * 8. Preview Next Sequence (GET /api/v1/sequence/preview)
 */
export async function previewDocumentSequence(docType, baseUrl = DEFAULT_STAGING_API_URL) {
  const url = `${cleanApiUrl(baseUrl)}/api/v1/sequence/preview?docType=${encodeURIComponent(docType)}`;
  const response = await fetch(url, { method: 'GET' });
  const resJson = await response.json();
  if (!response.ok || resJson.status === 'error') {
    throw new Error(resJson.message || `ไม่สามารถดึงตัวอย่างเลขที่เอกสารได้ (HTTP ${response.status})`);
  }
  return resJson.data;
}

