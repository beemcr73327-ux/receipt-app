/**
 * Excel Export Utility (XLSX)
 * Generates .xlsx spreadsheet matching Google Sheets format exactly:
 * - Receipts (ใบเสร็จรับเงิน): 20 Columns
 * - Payment Vouchers (ใบสำคัญจ่าย): 18 Columns
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 */

import * as XLSX from 'xlsx';
import { formatThaiDate, normalizeThaiDate } from './dateUtils.js';

// Helper to format date safely into Thai format (DD/MM/YYYY)
function safeThaiDate(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (str.includes('/')) return normalizeThaiDate(str);
  return formatThaiDate(str);
}

// Helper to clean quotes
function clean(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^'+/, '').trim();
}

/**
 * 1. Export Receipts to Excel (.xlsx)
 * Matches Google Sheets 20 columns:
 * 1. วันที่
 * 2. เลขที่ใบเสร็จ
 * 3. นามผู้ซื้อ
 * 4. ที่อยู่
 * 5. เลขประจำตัวผู้เสียภาษี
 * 6. งวด
 * 7. รายการสินค้าหรือบริการ
 * 8. จำนวน
 * 9. ราคาต่อหน่วย
 * 10. DRC(%)
 * 11. เพิ่มลด
 * 12. รายละเอียด
 * 13. จำนวนเงิน
 * 14. ชำระโดย
 * 15. วันที่โอน/สั่งจ่าย
 * 16. หมายเหตุ
 * 17. ผู้รับเงิน
 * 18. สถานะ
 * 19. สาเหตุที่ยกเลิก
 * 20. วันที่พิมพ์/บันทึก
 */
export function exportReceiptsToExcel(receipts = [], customFilename = '') {
  const headers = [
    'วันที่',
    'เลขที่ใบเสร็จ',
    'นามผู้ซื้อ',
    'ที่อยู่',
    'เลขประจำตัวผู้เสียภาษี',
    'งวด',
    'รายการสินค้าหรือบริการ',
    'จำนวน',
    'ราคาต่อหน่วย',
    'DRC(%)',
    'เพิ่มลด',
    'รายละเอียด',
    'จำนวนเงิน',
    'ชำระโดย',
    'วันที่โอน/สั่งจ่าย',
    'หมายเหตุ',
    'ผู้รับเงิน',
    'สถานะ',
    'สาเหตุที่ยกเลิก',
    'วันที่พิมพ์/บันทึก'
  ];

  const rows = [];

  receipts.forEach((r) => {
    const dateVal = safeThaiDate(r.dateThai || r.docDate || r.doc_date);
    const receiptNo = clean(r.receiptNo || r.receipt_no);
    const buyerName = clean(r.buyerName || r.buyer_name);
    const buyerAddress = clean(r.buyerAddress || r.buyer_address);
    const buyerTaxId = clean(r.buyerTaxId || r.taxId || r.buyer_tax_id);
    const period = clean(r.period);
    const paymentMethod = clean(r.paymentMethod || r.payment_method || 'เงินโอน');
    const payDateVal = safeThaiDate(r.paymentDateThai || r.payDate || r.pay_date || dateVal);
    const notes = clean(r.notes);
    const cashierName = clean(r.cashierName || r.cashier_name);
    const status = clean(r.status || 'ปกติ');
    const cancelReason = clean(r.cancelReason || r.cancel_reason);
    const printTimestamp = clean(r.printedTimestamp || r.printed_timestamp || r.updatedAt || r.updated_at || '');

    const items = r.items && r.items.length > 0 ? r.items : [];

    if (items.length > 0) {
      items.forEach((item) => {
        const itemTitle = clean(item.itemTitle || item.title || item.name || '');
        const qty = item.quantity !== undefined ? Number(item.quantity) : 0;
        const price = item.unitPrice !== undefined ? Number(item.unitPrice) : (Number(item.price) || 0);
        const drc = item.drc || (item.drcPercent !== undefined && item.drcPercent !== null ? `${item.drcPercent}%` : '');
        const discountAmount = item.discountAmount !== undefined ? Number(item.discountAmount) : 0;
        const discountDetails = clean(item.discountDetails || '');
        const amount = item.amount !== undefined ? Number(item.amount) : (Number(item.netAmount) || 0);
        const itemPeriod = clean(item.period || period);

        rows.push([
          dateVal,
          receiptNo,
          buyerName,
          buyerAddress,
          buyerTaxId,
          itemPeriod,
          itemTitle,
          qty,
          price,
          drc,
          discountAmount,
          discountDetails,
          amount,
          paymentMethod,
          payDateVal,
          notes,
          cashierName,
          status,
          cancelReason,
          printTimestamp
        ]);
      });
    } else {
      // Single summary row when items array is empty
      rows.push([
        dateVal,
        receiptNo,
        buyerName,
        buyerAddress,
        buyerTaxId,
        period,
        clean(r.itemTitle || r.title || 'รายการทั่วไป'),
        1,
        Number(r.totalAmount || r.total_amount || 0),
        '',
        0,
        '',
        Number(r.totalAmount || r.total_amount || 0),
        paymentMethod,
        payDateVal,
        notes,
        cashierName,
        status,
        cancelReason,
        printTimestamp
      ]);
    }
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 12 }, // วันที่
    { wch: 14 }, // เลขที่ใบเสร็จ
    { wch: 30 }, // นามผู้ซื้อ
    { wch: 35 }, // ที่อยู่
    { wch: 18 }, // เลขประจำตัวผู้เสียภาษี
    { wch: 10 }, // งวด
    { wch: 25 }, // รายการสินค้าหรือบริการ
    { wch: 10 }, // จำนวน
    { wch: 12 }, // ราคาต่อหน่วย
    { wch: 10 }, // DRC(%)
    { wch: 12 }, // เพิ่มลด
    { wch: 15 }, // รายละเอียด
    { wch: 15 }, // จำนวนเงิน
    { wch: 12 }, // ชำระโดย
    { wch: 14 }, // วันที่โอน/สั่งจ่าย
    { wch: 20 }, // หมายเหตุ
    { wch: 18 }, // ผู้รับเงิน
    { wch: 10 }, // สถานะ
    { wch: 20 }, // สาเหตุที่ยกเลิก
    { wch: 20 }  // วันที่พิมพ์/บันทึก
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ใบเสร็จรับเงิน');

  const defaultName = `ประวัติใบเสร็จรับเงิน_${new Date().toISOString().split('T')[0]}.xlsx`;
  const filename = (customFilename || defaultName).endsWith('.xlsx') ? (customFilename || defaultName) : `${customFilename}.xlsx`;

  XLSX.writeFile(workbook, filename);
  return { success: true, count: rows.length, filename };
}

/**
 * 2. Export Payment Vouchers to Excel (.xlsx)
 * Matches Google Sheets 18 columns:
 * 1. วันที่เอกสาร
 * 2. เลขที่เอกสาร
 * 3. จ่ายให้
 * 4. คำอธิบาย
 * 5. เลขที่อ้างอิงเอกสาร
 * 6. วันที่รายการ
 * 7. รายการ
 * 8. จำนวนเงิน
 * 9. ชำระโดย
 * 10. บัญชีต้นทาง
 * 11. เลขที่เช็ค/เลขบัญชีปลายทาง
 * 12. ธนาคาร
 * 13. วันที่ชำระเงิน
 * 14. หมายเหตุ
 * 15. ผู้จัดทำ
 * 16. สถานะ
 * 17. สาเหตุยกเลิก
 * 18. วันที่บันทึก/พิมพ์
 */
export function exportVouchersToExcel(vouchers = [], customFilename = '') {
  const headers = [
    'วันที่เอกสาร',
    'เลขที่เอกสาร',
    'จ่ายให้',
    'คำอธิบาย',
    'เลขที่อ้างอิงเอกสาร',
    'วันที่รายการ',
    'รายการ',
    'จำนวนเงิน',
    'ชำระโดย',
    'บัญชีต้นทาง',
    'เลขที่เช็ค/เลขบัญชีปลายทาง',
    'ธนาคาร',
    'วันที่ชำระเงิน',
    'หมายเหตุ',
    'ผู้จัดทำ',
    'สถานะ',
    'สาเหตุยกเลิก',
    'วันที่บันทึก/พิมพ์'
  ];

  const rows = [];

  vouchers.forEach((v) => {
    const docDateVal = safeThaiDate(v.docDateThai || v.docDate || v.doc_date || v.dateThai);
    const voucherNo = clean(v.voucherNo || v.voucher_no);
    const receiverName = clean(v.receiverName || v.receiver || v.receiver_name);
    const mainDesc = clean(v.mainDescription || v.overallDescription || v.description || v.overall_description);
    const refNo = clean(v.refNo || v.refDocNo || v.ref_doc_no);
    const paymentMethod = clean(v.paymentMethod || v.payment_method || 'เงินโอน');
    const sourceBankAcc = clean(v.sourceBankAcc || v.bankAccount || v.bank_account);
    const chequeOrDestAcc = clean(v.chequeOrDestAcc || v.chequeNo || v.cheque_no);
    const destBank = clean(v.destBank || v.dest_bank);
    const payDateVal = safeThaiDate(v.payDateThai || v.paymentDate || v.pay_date || docDateVal);
    const notes = clean(v.notes);
    const cashierName = clean(v.cashierName || v.cashier_name);
    const status = clean(v.status || 'ปกติ');
    const cancelReason = clean(v.cancelReason || v.cancel_reason);
    const printTimestamp = clean(v.printedTimestamp || v.printed_timestamp || v.updatedAt || v.updated_at || '');

    const items = v.items && v.items.length > 0 ? v.items : [];

    if (items.length > 0) {
      items.forEach((item) => {
        const itemDateVal = safeThaiDate(item.itemDateThai || item.itemDate || item.item_date || docDateVal);
        const description = clean(item.description || item.title || '');
        const amount = item.amount !== undefined ? Number(item.amount) : 0;

        rows.push([
          docDateVal,
          voucherNo,
          receiverName,
          mainDesc,
          refNo,
          itemDateVal,
          description,
          amount,
          paymentMethod,
          sourceBankAcc,
          chequeOrDestAcc,
          destBank,
          payDateVal,
          notes,
          cashierName,
          status,
          cancelReason,
          printTimestamp
        ]);
      });
    } else {
      // Single summary row when items array is empty
      rows.push([
        docDateVal,
        voucherNo,
        receiverName,
        mainDesc,
        refNo,
        docDateVal,
        mainDesc || 'รายการทั่วไป',
        Number(v.totalAmount || v.total_amount || 0),
        paymentMethod,
        sourceBankAcc,
        chequeOrDestAcc,
        destBank,
        payDateVal,
        notes,
        cashierName,
        status,
        cancelReason,
        printTimestamp
      ]);
    }
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 12 }, // วันที่เอกสาร
    { wch: 14 }, // เลขที่เอกสาร
    { wch: 28 }, // จ่ายให้
    { wch: 30 }, // คำอธิบาย
    { wch: 18 }, // เลขที่อ้างอิงเอกสาร
    { wch: 12 }, // วันที่รายการ
    { wch: 30 }, // รายการ
    { wch: 15 }, // จำนวนเงิน
    { wch: 12 }, // ชำระโดย
    { wch: 22 }, // บัญชีต้นทาง
    { wch: 22 }, // เลขที่เช็ค/เลขบัญชีปลายทาง
    { wch: 25 }, // ธนาคาร
    { wch: 14 }, // วันที่ชำระเงิน
    { wch: 20 }, // หมายเหตุ
    { wch: 18 }, // ผู้จัดทำ
    { wch: 10 }, // สถานะ
    { wch: 20 }, // สาเหตุยกเลิก
    { wch: 20 }  // วันที่บันทึก/พิมพ์
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ใบสำคัญจ่าย');

  const defaultName = `ประวัติใบสำคัญจ่าย_${new Date().toISOString().split('T')[0]}.xlsx`;
  const filename = (customFilename || defaultName).endsWith('.xlsx') ? (customFilename || defaultName) : `${customFilename}.xlsx`;

  XLSX.writeFile(workbook, filename);
  return { success: true, count: rows.length, filename };
}
