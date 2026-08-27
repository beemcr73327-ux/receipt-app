import React from 'react';
import { bahttext } from '../utils/bahttext';
import { formatThaiDateTime, normalizeThaiDate } from '../utils/dateUtils';
import { storageService } from '../services/storageService';

/**
 * Trigger print dialog for Payment Voucher directly using browser print.
 */
export function openVoucherPrintDialog(voucherData) {
  if (!voucherData) return;
  try {
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 150);
    });
  } catch (e) {
    console.error('Print Voucher Error:', e);
  }
}

/**
 * Helper to mask account number into xxx-x-xxXXXX format
 */
function maskAccountNumber(accStr) {
  if (!accStr) return '';
  const str = String(accStr).trim();
  const digitsOnly = str.replace(/\D/g, '');
  if (digitsOnly.length < 4) return str;
  const last4 = digitsOnly.slice(-4);
  return `xxx-x-xx${last4}`;
}

/**
 * Helper to format source bank into BBL xxx-x-xx0488 (ชื่อบัญชีใน Master_Banks Col E) format
 */
function formatSourceBank(sourceStr) {
  const detail = storageService.getSourceBankDetails(sourceStr);
  if (detail && typeof detail === 'object') {
    const bankPrefix = detail.bankAbbr || 'BBL';
    const last4 = detail.last4 || (detail.fullAccNum ? String(detail.fullAccNum).replace(/\D/g, '').slice(-4) : '0488');
    const accHolder = detail.accountHolder ? ` (${detail.accountHolder})` : '';
    return `${bankPrefix} xxx-x-xx${last4}${accHolder}`;
  }

  if (!sourceStr) return 'BBL xxx-x-xx0488 (บจก. ศรีสุข พูนทรัพย์ ยางพารา จำกัด)';
  const str = String(sourceStr).trim();
  let bankPrefix = 'BBL';
  if (str.toUpperCase().includes('KBANK') || str.includes('กสิกร')) bankPrefix = 'KBANK';
  else if (str.toUpperCase().includes('SCB') || str.includes('ไทยพาณิชย์')) bankPrefix = 'SCB';
  else if (str.toUpperCase().includes('KTB') || str.includes('กรุงไทย')) bankPrefix = 'KTB';
  else if (str.toUpperCase().includes('BAY') || str.includes('กรุงศรี')) bankPrefix = 'BAY';
  else if (str.toUpperCase().includes('TTB') || str.includes('ทหารไทยธนชาต')) bankPrefix = 'TTB';
  
  const digitsOnly = str.replace(/\D/g, '');
  const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : '0488';
  return `${bankPrefix} xxx-x-xx${last4} (บจก. ศรีสุข พูนทรัพย์ ยางพารา จำกัด)`;
}

/**
 * Helper to split text across available print lines smoothly
 */
function splitTextIntoLines(text, maxCharsPerLine = 46, maxLines = 3) {
  if (!text) return Array(maxLines).fill('');
  const str = String(text).trim();
  const words = str.split(' ');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  
  if (lines.length === 1 && lines[0].length > maxCharsPerLine) {
    const raw = lines[0];
    const forcedLines = [];
    for (let c = 0; c < raw.length && forcedLines.length < maxLines; c += maxCharsPerLine) {
      forcedLines.push(raw.slice(c, c + maxCharsPerLine));
    }
    while (forcedLines.length < maxLines) forcedLines.push('');
    return forcedLines;
  }

  while (lines.length < maxLines) {
    lines.push('');
  }
  return lines.slice(0, maxLines);
}

/**
 * Single A4 Printable Page for Payment Voucher (Original or Copy)
 * Exactly matching user specification and Receipt layout 100%.
 */
function SingleVoucherPage({ voucherData, isCopy = false }) {
  if (!voucherData) return null;

  const cleanStr = (val) => String(val || '').replace(/^'/, '').trim();

  const voucherNo = cleanStr(voucherData.voucherNo || voucherData.docNo);
  const docDateThai = normalizeThaiDate(voucherData.docDateThai || voucherData.docDate || voucherData.dateThai);
  const receiverName = cleanStr(voucherData.receiverName || voucherData.receiver);
  const mainDescription = cleanStr(voucherData.mainDescription || voucherData.description);
  const refNo = cleanStr(voucherData.refNo || voucherData.invoiceNo);

  const receiverLines = splitTextIntoLines(receiverName, 46, 2);
  const descLines = splitTextIntoLines(mainDescription, 46, 3);

  const items = (voucherData.items && voucherData.items.length > 0) ? voucherData.items : [{
    itemDateThai: docDateThai,
    description: mainDescription || '',
    amount: Number(voucherData.totalAmount || voucherData.amount || 0)
  }];

  const totalAmount = Number(voucherData.totalAmount || items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0));
  const bahtTextString = voucherData.bahtText || (totalAmount > 0 ? bahttext(totalAmount) : 'ศูนย์บาทถ้วน');

  const paymentMethod = cleanStr(voucherData.paymentMethod || 'เงินโอน');
  const sourceBankAcc = cleanStr(voucherData.sourceBankAcc || voucherData.bankDetails);
  const chequeOrDestAcc = cleanStr(voucherData.chequeOrDestAcc || voucherData.chequeNo || voucherData.destBankAcc);
  const destBank = cleanStr(voucherData.destBank || voucherData.bankName);
  const payDateThai = normalizeThaiDate(voucherData.payDateThai || voucherData.paymentDate || docDateThai);
  const notes = cleanStr(voucherData.notes);

  const isCancelled = voucherData.status === 'ยกเลิก' || 
                      cleanStr(voucherData.status) === 'ยกเลิก' || 
                      Boolean(voucherData.cancelReason && cleanStr(voucherData.cancelReason).length > 0);

  const printedTimestamp = (voucherData?.forceTimestamp && String(voucherData.forceTimestamp).trim())
    ? formatThaiDateTime(voucherData.forceTimestamp)
    : formatThaiDateTime();
  const tsParts = printedTimestamp.includes(' ') ? printedTimestamp.split(' ') : [printedTimestamp, ''];
  const printDateVal = normalizeThaiDate(tsParts[0] || docDateThai);
  const printTimeVal = tsParts[1] || '';

  const LINE_COLOR = "#000000";
  // กรอบจ่ายให้ และ กรอบชำระโดย เป็น 1pt
  const border1pt = { border: `1pt solid ${LINE_COLOR}` };
  const borderRight1pt = { borderRight: `1pt solid ${LINE_COLOR}` };
  
  // เส้นตารางและกรอบอื่นๆ เป็น 0.75pt
  const border075 = { border: `0.75pt solid ${LINE_COLOR}` };
  const borderRight075 = { borderRight: `0.75pt solid ${LINE_COLOR}` };
  const borderBottom075 = { borderBottom: `0.75pt solid ${LINE_COLOR}` };
  const borderTop075 = { borderTop: `0.75pt solid ${LINE_COLOR}` };
  const fontFamilyStyle = { fontFamily: "'TH Sarabun New', 'THSarabunNew', 'Sarabun', 'Tahoma', sans-serif" };

  const totalAmountFormatted = Number(totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // สีชื่อเอกสาร: หน้าต้นฉบับสีฟ้า (#0070C0), หน้าสำเนาสีเหลืองทอง (#D97706 / #CA8A04)
  const titleColor = isCopy ? '#CA8A04' : '#0070C0';
  const titleText = isCopy ? 'ใบสำคัญจ่ายสำเนา' : 'ใบสำคัญจ่าย';

  return (
    <div
      className="print-page"
      style={{
        ...fontFamilyStyle,
        background: '#ffffff',
        color: '#000000',
        width: '194mm',
        height: '272mm',
        maxHeight: '272mm',
        boxSizing: 'border-box',
        position: 'relative',
        display: 'block',
        pageBreakAfter: 'always',
        breakAfter: 'page',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        margin: '0 auto',
        padding: '2mm',
        overflow: 'hidden'
      }}
    >
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
        
        {/* ลายน้ำ "ยกเลิก" กรณีเอกสารถูกยกเลิก */}
        {isCancelled && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              pointerEvents: 'none',
              border: '6px solid #ef4444',
              color: '#ef4444',
              fontSize: '60pt',
              fontWeight: 'bold',
              padding: '12px 56px',
              borderRadius: '16px',
              letterSpacing: '0.08em',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3)',
              textAlign: 'center',
              lineHeight: '1.2',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            ยกเลิก
          </div>
        )}

        {/* 1. UPPER SECTION: Header + Metadata Box */}
        <div style={{ flexShrink: 0 }}>
          {/* Header Block with Top-Right PV */}
          <div style={{ position: 'relative', textAlign: 'center', marginBottom: '4px' }}>
            {/* Top-Right PV Badge */}
            <div style={{
              position: 'absolute',
              right: '2px',
              top: '0px',
              fontSize: '16pt',
              fontWeight: 'bold',
              color: '#000000',
              lineHeight: '1'
            }}>
              PV
            </div>

            {/* Company Info (Centered) */}
            <div style={{ fontSize: '14pt', fontWeight: 'bold', color: '#000000', lineHeight: '1.3', margin: 0 }}>
              บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
            </div>
            <div style={{ fontSize: '11pt', fontWeight: 'bold', color: '#000000', lineHeight: '1.35', marginTop: '2px' }}>
              17 หมู่ที่ 14 ตำบลปราสาท อำเภอบ้านกรวด จังหวัดบุรีรัมย์ 31180
            </div>

            {/* Document Title: Blue for Original, Yellow for Copy */}
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '16pt', fontWeight: 'bold', color: titleColor, lineHeight: '1.2' }}>
                {titleText}
              </div>
              <div style={{
                fontSize: '11pt',
                fontWeight: 'bold',
                color: titleColor,
                textDecoration: 'underline',
                letterSpacing: '0.5px'
              }}>
                PAYMENT VOUCHER
              </div>
            </div>
          </div>

          {/* Doc Metadata Box (Border 1pt with 2 Columns, Height 35mm matching Receipt spec) */}
          <div style={{
            display: 'flex',
            ...border1pt,
            height: '35mm',
            boxSizing: 'border-box',
            fontSize: '11pt',
            marginTop: '6px'
          }}>
            {/* Left Column (Receiver 2 lines & Description 3 lines - All 5 lines perfectly aligned) */}
            <div style={{
              flex: '1',
              padding: '6px 8px',
              ...borderRight1pt,
              display: 'flex',
              gap: '6px',
              height: '100%',
              boxSizing: 'border-box'
            }}>
              {/* Left Sub-column: Fixed Width Labels */}
              <div style={{
                width: '125px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: '#000000',
                fontWeight: 'bold',
                height: '100%'
              }}>
                <div style={{ height: '24px', display: 'flex', alignItems: 'flex-end', paddingBottom: '0px', lineHeight: '1.1' }}>จ่ายให้/Receiver :</div>
                <div style={{ height: '24px' }}></div>
                <div style={{ height: '24px', display: 'flex', alignItems: 'flex-end', paddingBottom: '0px', lineHeight: '1.1' }}>คำอธิบายรายการ/ :</div>
                <div style={{ height: '24px', display: 'flex', alignItems: 'flex-end', paddingBottom: '0px', lineHeight: '1.1' }}>Description</div>
                <div style={{ height: '24px' }}></div>
              </div>

              {/* Right Sub-column: 5 Equal Width Underlines */}
              <div style={{
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%'
              }}>
                {/* Line 1 (Receiver Line 1) */}
                <div style={{
                  borderBottom: '1px solid #777',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  paddingLeft: '4px',
                  paddingBottom: '0px',
                  lineHeight: '1.1',
                  color: '#000000',
                  fontWeight: 'normal',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}>
                  {receiverLines[0]}
                </div>

                {/* Line 2 (Receiver Line 2) */}
                <div style={{
                  borderBottom: '1px solid #777',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  paddingLeft: '4px',
                  paddingBottom: '0px',
                  lineHeight: '1.1',
                  color: '#000000',
                  fontWeight: 'normal',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}>
                  {receiverLines[1]}
                </div>

                {/* Line 3 (Description Line 1) */}
                <div style={{
                  borderBottom: '1px solid #777',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  paddingLeft: '4px',
                  paddingBottom: '0px',
                  lineHeight: '1.1',
                  color: '#000000',
                  fontWeight: 'normal',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}>
                  {descLines[0]}
                </div>

                {/* Line 4 (Description Line 2) */}
                <div style={{
                  borderBottom: '1px solid #777',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  paddingLeft: '4px',
                  paddingBottom: '0px',
                  lineHeight: '1.1',
                  color: '#000000',
                  fontWeight: 'normal',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}>
                  {descLines[1]}
                </div>

                {/* Line 5 (Description Line 3) */}
                <div style={{
                  borderBottom: '1px solid #777',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  paddingLeft: '4px',
                  paddingBottom: '0px',
                  lineHeight: '1.1',
                  color: '#000000',
                  fontWeight: 'normal',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}>
                  {descLines[2]}
                </div>
              </div>
            </div>

            {/* Right Column (Doc code, Doc date, Ref no. - space-between Right-Aligned) */}
            <div style={{
              width: '265px',
              padding: '10px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              boxSizing: 'border-box',
              color: '#000000'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 'bold' }}>เลขที่เอกสาร/Doc code : </span>
                <span style={{ fontWeight: 'normal', textAlign: 'right' }}>{voucherNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 'bold' }}>วันที่เอกสาร/Doc date : </span>
                <span style={{ fontWeight: 'normal', textAlign: 'right' }}>{docDateThai}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 'bold' }}>เลขที่เอกสารอ้างอิง/Ref no. : </span>
                <span style={{ fontWeight: 'normal', textAlign: 'right' }}>{refNo}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. MIDDLE SECTION: Items Table with Border 0.75pt & Flex-1 */}
        <div style={{ ...border075, marginTop: '6px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt', flex: 1, background: 'transparent' }}>
            <thead>
              <tr style={{ height: '28px', textAlign: 'center', fontWeight: 'bold', fontSize: '12pt', color: '#000000', ...borderBottom075 }}>
                <th style={{ width: '110px', padding: '4px', fontWeight: 'bold', fontSize: '12pt', color: '#000000', ...borderRight075 }}>วันที่เอกสาร</th>
                <th style={{ padding: '4px 10px', fontWeight: 'bold', fontSize: '12pt', color: '#000000', ...borderRight075 }}>รายการ / Description</th>
                <th style={{ width: '130px', padding: '4px 10px', fontWeight: 'bold', fontSize: '12pt', color: '#000000' }}>จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {items && items.length > 0 ? (
                items.map((itm, idx) => (
                  <tr key={idx} style={{ height: '24px', verticalAlign: 'top' }}>
                    <td style={{ textAlign: 'center', padding: '3px 4px', color: '#000000', ...borderRight075 }}>
                      {itm.itemDateThai || docDateThai}
                    </td>
                    <td style={{ padding: '3px 10px', color: '#000000', lineHeight: '1.35', ...borderRight075 }}>
                      {itm.description || '-'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '3px 10px', color: '#000000' }}>
                      {itm.amount !== null && itm.amount !== undefined ? Number(itm.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr style={{ height: '24px', verticalAlign: 'top' }}>
                  <td style={{ textAlign: 'center', padding: '3px 4px', color: '#000000', ...borderRight075 }}>{docDateThai}</td>
                  <td style={{ padding: '3px 10px', color: '#000000', ...borderRight075 }}>-</td>
                  <td style={{ textAlign: 'right', padding: '3px 10px', color: '#000000' }}>0.00</td>
                </tr>
              )}

              {/* Dynamic Filler Row to absorb leftover space and stretch down */}
              <tr style={{ height: 'auto' }}>
                <td style={{ ...borderRight075 }}></td>
                <td style={{ ...borderRight075 }}></td>
                <td></td>
              </tr>

              {/* Grand Total Row */}
              <tr style={{ fontSize: '11pt', fontWeight: 'bold', color: '#000000', height: '28px', ...borderTop075 }}>
                <td colSpan={2} style={{ padding: '3px 10px', height: '28px', verticalAlign: 'middle', textAlign: 'center', color: '#000000', ...borderRight075, ...borderBottom075 }}>
                  รวมทั้งสิ้น
                </td>
                <td style={{ padding: '3px 10px', height: '28px', verticalAlign: 'middle', textAlign: 'right', color: '#000000', ...borderBottom075 }}>
                  {totalAmountFormatted}
                </td>
              </tr>

              {/* BahtText Row */}
              <tr style={{ fontSize: '11pt', fontWeight: 'bold', color: '#000000', height: '28px' }}>
                <td colSpan={3} style={{ padding: '3px 10px', height: '28px', verticalAlign: 'middle', textAlign: 'center', color: '#000000' }}>
                  {bahtTextString}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. LOWER SECTION: Notes (0.75pt) + Payment Box (1pt, Connected) + Signatures (0.75pt) */}
        <div style={{ flexShrink: 0 }}>
          {/* Notes Bar (Border 0.75pt, bottom connected) */}
          <div style={{
            borderLeft: `0.75pt solid ${LINE_COLOR}`,
            borderRight: `0.75pt solid ${LINE_COLOR}`,
            borderBottom: `0.75pt solid ${LINE_COLOR}`,
            padding: '4px 10px',
            fontSize: '11pt',
            color: '#000000'
          }}>
            <span style={{ fontWeight: 'bold' }}>หมายเหตุ : </span>
            <span style={{ fontWeight: 'normal' }}>{notes || ''}</span>
          </div>

          {/* Payment Details Box (Border 1pt, Connected seamlessly with Notes via marginTop -1px) */}
          <div style={{
            ...border1pt,
            marginTop: '-1px',
            padding: '6px 12px',
            fontSize: '11pt',
            lineHeight: '1.65',
            color: '#000000'
          }}>
            {paymentMethod === 'เงินสด' ? (
              /* Case 1: เงินสด (Cash) */
              <>
                <div>
                  <span style={{ fontWeight: 'bold' }}>ชำระโดย/Pid by : </span>
                  <span style={{ fontWeight: 'normal' }}>เงินสด</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>วันที่/Date : </span>
                  <span style={{ fontWeight: 'normal' }}>{payDateThai || docDateThai}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>จำนวนเงิน/Amount : </span>
                  <span style={{ fontWeight: 'normal' }}>{totalAmountFormatted}</span>
                </div>
              </>
            ) : paymentMethod === 'เช็ค' ? (
              /* Case 2: เช็ค (Cheque) */
              <>
                <div>
                  <span style={{ fontWeight: 'bold' }}>ชำระโดย/Pid by : </span>
                  <span style={{ fontWeight: 'normal' }}>เช็ค</span>
                </div>
                <div style={{ display: 'flex', gap: '30px' }}>
                  <div style={{ minWidth: '220px' }}>
                    <span style={{ fontWeight: 'bold' }}>เลขที่เช็ค/Cheque no : </span>
                    <span style={{ fontWeight: 'normal' }}>{chequeOrDestAcc || ''}</span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>วันที่/Date : </span>
                    <span style={{ fontWeight: 'normal' }}>{payDateThai || docDateThai}</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>ธนาคาร/Bank : </span>
                  <span style={{ fontWeight: 'normal' }}>{destBank || ''}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>จำนวนเงิน/Amount : </span>
                  <span style={{ fontWeight: 'normal' }}>{totalAmountFormatted}</span>
                </div>
              </>
            ) : (
              /* Case 3: เงินโอน (Transfer) */
              <>
                <div>
                  <span style={{ fontWeight: 'bold' }}>ชำระโดย/Pid by : </span>
                  <span style={{ fontWeight: 'normal' }}>เงินโอน</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>บัญชีต้นทาง : </span>
                  <span style={{ fontWeight: 'normal' }}>{formatSourceBank(sourceBankAcc)}</span>
                </div>
                <div style={{ display: 'flex', gap: '30px' }}>
                  <div style={{ minWidth: '220px' }}>
                    <span style={{ fontWeight: 'bold' }}>เลขที่บัญชี/Account no : </span>
                    <span style={{ fontWeight: 'normal' }}>{maskAccountNumber(chequeOrDestAcc)}</span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>วันที่/Date : </span>
                    <span style={{ fontWeight: 'normal' }}>{payDateThai || docDateThai}</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>ธนาคาร/Bank : </span>
                  <span style={{ fontWeight: 'normal' }}>{destBank || ''}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>จำนวนเงิน/Amount : </span>
                  <span style={{ fontWeight: 'normal' }}>{totalAmountFormatted}</span>
                </div>
              </>
            )}
          </div>

          {/* Signatures Box (Border 0.75pt with 4 Columns & Solid Underlines for Date) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0px',
            ...border075,
            marginTop: '6px',
            padding: '10px 4px 10px 4px',
            color: '#000000'
          }}>
            {/* Box 1: ผู้จัดทำ/Creater */}
            <div style={{ textAlign: 'center', fontSize: '11pt' }}>
              <div style={{ fontWeight: 'bold' }}>ผู้จัดทำ/Creater</div>
              <div style={{ height: '36px' }}></div>
              <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
              <div style={{ marginTop: '6px', fontSize: '10pt', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '22px', borderBottom: '1px solid #000' }}></span>
                <span>/</span>
                <span style={{ display: 'inline-block', width: '22px', borderBottom: '1px solid #000' }}></span>
                <span>/</span>
                <span style={{ display: 'inline-block', width: '32px', borderBottom: '1px solid #000' }}></span>
              </div>
            </div>

            {/* Box 2: ผู้ตรวจสอบ/Inspecter */}
            <div style={{ textAlign: 'center', fontSize: '11pt' }}>
              <div style={{ fontWeight: 'bold' }}>ผู้ตรวจสอบ/Inspecter</div>
              <div style={{ height: '36px' }}></div>
              <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
              <div style={{ marginTop: '6px', fontSize: '10pt', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '22px', borderBottom: '1px solid #000' }}></span>
                <span>/</span>
                <span style={{ display: 'inline-block', width: '22px', borderBottom: '1px solid #000' }}></span>
                <span>/</span>
                <span style={{ display: 'inline-block', width: '32px', borderBottom: '1px solid #000' }}></span>
              </div>
            </div>

            {/* Box 3: ผู้อนุมัติ/Approve */}
            <div style={{ textAlign: 'center', fontSize: '11pt' }}>
              <div style={{ fontWeight: 'bold' }}>ผู้อนุมัติ/Approve</div>
              <div style={{ height: '36px' }}></div>
              <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
              <div style={{ marginTop: '6px', fontSize: '10pt', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '22px', borderBottom: '1px solid #000' }}></span>
                <span>/</span>
                <span style={{ display: 'inline-block', width: '22px', borderBottom: '1px solid #000' }}></span>
                <span>/</span>
                <span style={{ display: 'inline-block', width: '32px', borderBottom: '1px solid #000' }}></span>
              </div>
            </div>

            {/* Box 4: ผู้รับเงิน/Receiver */}
            <div style={{ textAlign: 'center', fontSize: '11pt' }}>
              <div style={{ fontWeight: 'bold' }}>ผู้รับเงิน/Receiver</div>
              <div style={{ height: '36px' }}></div>
              <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
              <div style={{ marginTop: '6px', fontSize: '10pt', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '22px', borderBottom: '1px solid #000' }}></span>
                <span>/</span>
                <span style={{ display: 'inline-block', width: '22px', borderBottom: '1px solid #000' }}></span>
                <span>/</span>
                <span style={{ display: 'inline-block', width: '32px', borderBottom: '1px solid #000' }}></span>
              </div>
            </div>
          </div>

          {/* Printed Timestamp Footer */}
          <div style={{
            textAlign: 'right',
            fontSize: '10pt',
            fontWeight: 'normal',
            fontStyle: 'italic',
            color: '#000000',
            marginTop: '10px',
            marginBottom: '2px',
            lineHeight: '1.3'
          }}>
            วันที่พิมพ์/date print: {printDateVal} {printTimeVal}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function PrintVoucher({ voucherData }) {
  if (!voucherData) return null;
  return (
    <div style={{ background: '#ffffff' }}>
      {/* 1. ชุดต้นฉบับ (Original) */}
      <SingleVoucherPage voucherData={voucherData} isCopy={false} />
      {/* 2. ชุดสำเนา (Copy) */}
      <SingleVoucherPage voucherData={voucherData} isCopy={true} />
    </div>
  );
}
