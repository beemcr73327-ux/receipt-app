import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { bahttext } from '../utils/bahttext';
import { formatThaiDateTime, formatPeriod, normalizeThaiDate } from '../utils/dateUtils';

/**
 * Trigger print dialog directly from the main page using a hidden iframe.
 * No new browser tabs will be opened; the native print dialog pops up directly.
 */
export function openPrintInNewTab(receiptData) {
  console.log('🖨️ [openPrintInNewTab] called with data:', receiptData);
  if (!receiptData) return;
  try {
    setTimeout(() => {
      console.log('🖨️ [openPrintInNewTab] triggering window.print()');
      window.print();
    }, 50);
  } catch (e) {
    console.error('Print error:', e);
  }
}

/**
 * Inner component that renders the receipt pages (Original & Copy)
 */
function PrintReceiptContent({ receiptData }) {
  if (!receiptData) return null;

  const receiptNo = receiptData?.receiptNo || receiptData?.receipt_no || receiptData?.no || '';
  const dateThai = normalizeThaiDate(receiptData?.dateThai || receiptData?.date || receiptData?.dateIso || receiptData?.createdDate);
  const buyerName = receiptData?.buyerName || receiptData?.buyer || receiptData?.customerName || receiptData?.name || '';
  const buyerAddress = receiptData?.buyerAddress || receiptData?.address || '';
  const buyerTaxId = receiptData?.buyerTaxId || receiptData?.taxId || receiptData?.tax_id || receiptData?.taxNo || '';

  // Normalize items array
  let items = [];
  if (Array.isArray(receiptData?.items) && receiptData.items.length > 0) {
    items = receiptData.items;
  } else if (receiptData?.itemTitle || receiptData?.title) {
    items = [{
      title: receiptData?.itemTitle || receiptData?.title || 'รายการสินค้า',
      details: receiptData?.itemDetails || receiptData?.details || '',
      quantity: receiptData?.quantity || 1,
      unitPrice: receiptData?.unitPrice || receiptData?.totalAmount || receiptData?.amount || 0,
      drc: receiptData?.drc || '-',
      amount: receiptData?.totalAmount || receiptData?.amount || 0
    }];
  }

  const totalAmount = Number(receiptData?.totalAmount || receiptData?.amount || 0);
  const bahtText = receiptData?.bahtText || (totalAmount > 0 ? bahttext(totalAmount) : '');
  const paymentMethod = receiptData?.paymentMethod || receiptData?.payment || 'เงินโอน';
  const bankDetails = receiptData?.bankDetails || receiptData?.bank || '';
  const chequeNo = receiptData?.chequeNo || receiptData?.cheque || '';
  const paymentDate = normalizeThaiDate(receiptData?.paymentDate || receiptData?.paymentDateThai || receiptData?.paymentDateIso);
  const notes = receiptData?.notes || receiptData?.remark || '';
  const cashierName = receiptData?.cashierName || receiptData?.cashier || receiptData?.receiverName || '';
  const isCancelled = receiptData?.status === 'ยกเลิก' || 
                      String(receiptData?.status || '').trim() === 'ยกเลิก' ||
                      Boolean(receiptData?.cancelReason && String(receiptData?.cancelReason).trim().length > 0);
  const rawTs = receiptData?.printedTimestamp || receiptData?.updatedAt || '';
  const printedTimestamp = rawTs ? formatThaiDateTime(rawTs) : formatThaiDateTime();
  const tsParts = printedTimestamp.includes(' ') ? printedTimestamp.split(' ') : [printedTimestamp, ''];
  const printDateVal = normalizeThaiDate(tsParts[0] || dateThai);
  const printTimeVal = tsParts[1] || '';

  // Style constants
  const LINE_COLOR = "#000000";
  const border1pt = { border: `1pt solid ${LINE_COLOR}` };
  const borderRight075 = { borderRight: `0.75pt solid ${LINE_COLOR}` };
  const borderBottom075 = { borderBottom: `0.75pt solid ${LINE_COLOR}` };
  const borderTop075 = { borderTop: `0.75pt solid ${LINE_COLOR}` };
  const titleBoxBorder = { border: `1pt solid ${LINE_COLOR}` };
  const fontFamilyStyle = { fontFamily: "'TH Sarabun New', 'THSarabunNew', 'Sarabun', 'Tahoma', sans-serif" };

  const getShortBankString = (str) => {
    if (!str) return '';
    const clean = String(str).replace(/^'/, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      const abbr = parts[0];
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        if (lastPart.length > 4) {
          return `${abbr} ${lastPart.slice(-4)}`;
        }
        return `${abbr} ${lastPart}`;
      }
    }
    return clean;
  };

  let paymentText = paymentMethod;
  const isTransfer = paymentMethod === 'เงินโอน' || 
                     (!['เงินสด', 'เช็ค'].includes(paymentMethod) && !paymentMethod.startsWith('เช็ค'));

  if (isTransfer) {
    const targetBank = (paymentMethod && paymentMethod !== 'เงินโอน') ? paymentMethod : bankDetails;
    paymentText = getShortBankString(targetBank);
  } else if (paymentMethod === 'เช็ค' && chequeNo) {
    paymentText += ` เลขที่เช็ค : ${chequeNo}`;
  }
  if (paymentDate) {
    paymentText += ` วันที่ ${paymentDate}`;
  }

  // Calculate dynamic line weight for each item based on text length and discount line presence
  const getItemHeightWeight = (item) => {
    if (!item) return 1.0;
    let weight = 1.0;
    const titleStr = String(item.title || item.itemTitle || '').trim();
    const detailsStr = String(item.details || item.itemDetails || '').trim();
    const fullStr = detailsStr ? `${titleStr} ${detailsStr}` : titleStr;
    if (fullStr.length > 35) {
      weight += 0.3 * Math.floor(fullStr.length / 35);
    }
    const discAmt = Number(item.discountAmount || 0);
    const discDetails = String(item.discountDetails || '').trim();
    if (discAmt > 0 || discDetails) {
      weight += 0.4;
    }
    return weight;
  };

  // Dynamic chunking algorithm based on item weight (MAX_PAGE_WEIGHT = 9.6: 9-10 normal items, 6-7 discount items)
  const MAX_PAGE_WEIGHT = 9.6;
  const itemChunks = [];
  if (!items || items.length === 0) {
    itemChunks.push([]);
  } else {
    let currentChunk = [];
    let currentWeight = 0;

    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      const w = getItemHeightWeight(itm);

      if (currentChunk.length > 0 && (currentWeight + w > MAX_PAGE_WEIGHT)) {
        itemChunks.push(currentChunk);
        currentChunk = [itm];
        currentWeight = w;
      } else {
        currentChunk.push(itm);
        currentWeight += w;
      }
    }
    if (currentChunk.length > 0) {
      itemChunks.push(currentChunk);
    }
  }
  const totalPages = itemChunks.length;

  const renderSinglePage = (chunk, pageIdx, isCopy = false) => {
    const isLastPage = pageIdx === totalPages - 1;
    const startSeq = itemChunks.slice(0, pageIdx).reduce((sum, chk) => sum + (chk ? chk.length : 0), 0);
    const chunkWeight = (chunk || []).reduce((sum, item) => sum + getItemHeightWeight(item), 0);
    const emptyRowsCount = Math.max(0, Math.floor((MAX_PAGE_WEIGHT - chunkWeight) / 1.0));

    return (
      <div
        key={`${isCopy ? 'copy' : 'original'}-page-${pageIdx}`}
        className="print-page"
        style={{
          ...fontFamilyStyle,
          background: 'white',
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
          {/* Watermark กล่องข้อความสีแดง "ยกเลิก" กลางหน้ากระดาษ (ตรง ไม่เอียง) */}
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

          {/* Upper Section */}
          <div style={{ flexShrink: 0 }}>
            {/* 1. Header (ชื่อบริษัท 14pt ตัวหนา, ข้อมูลติดต่อ 11pt ตัวปกติ) */}
            <div style={{ textAlign: 'left', marginBottom: '4px' }}>
              <h2 style={{ fontWeight: 'bold', fontSize: '14pt', lineHeight: '1.3', color: '#000000', letterSpacing: '0.02em', margin: 0 }}>
                บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
              </h2>
              <p style={{ fontSize: '11pt', fontWeight: 'normal', lineHeight: '1.35', color: '#000000', margin: '2px 0 0 0' }}>
                17 หมู่ที่ 14 ตำบลปราสาท อำเภอบ้านกรวด จังหวัดบุรีรัมย์ 31180
              </p>
              <p style={{ fontSize: '11pt', fontWeight: 'normal', lineHeight: '1.35', color: '#000000', margin: '1px 0 0 0' }}>
                โทร. 082-9828235
              </p>
              <p style={{ fontSize: '11pt', fontWeight: 'normal', lineHeight: '1.35', color: '#000000', margin: '1px 0 0 0' }}>
                เลขประจำตัวผู้เสียภาษีอากร 0315569002038
              </p>
            </div>

            {/* 2. Document Title Box */}
            <div style={{ textAlign: 'center', margin: '20px 0 0px 0' }}>
              <div style={{ display: 'inline-block', padding: '4px 28px', ...titleBoxBorder }}>
                <div style={{ fontWeight: 'bold', fontSize: '16pt', lineHeight: '1.2', letterSpacing: '0.03em', color: '#000000' }}>
                  {isCopy ? 'ใบเสร็จรับเงิน (สำเนา)' : 'ใบเสร็จรับเงิน (ต้นฉบับ)'}
                </div>
                <div style={{ fontSize: '15pt', fontWeight: 'bold', color: '#000000', lineHeight: '1.2', marginTop: '2px' }}>
                  {isCopy ? 'Receipt (Copy)' : 'Receipt (Original)'}
                </div>
              </div>
            </div>

            {/* 3. Receipt Running No. & Page Number (13pt normal) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2px', fontSize: '13pt', color: '#000000' }}>
              <div style={{ fontWeight: 'normal', color: '#333333', fontSize: '11pt' }}>
                {totalPages > 1 ? `หน้า ${pageIdx + 1} / ${totalPages}` : ''}
              </div>
              <div style={{ fontWeight: 'normal', fontSize: '13pt', textAlign: 'right', color: '#000000' }}>
                เลขที่.REV {receiptNo}
              </div>
            </div>

            {/* 4 & 5. Buyer Name & Address Box (Height 3.5cm / 35mm) */}
            <div style={{
              height: '35mm',
              padding: '10px 14px',
              fontSize: '11pt',
              color: '#000000',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between',
              ...border1pt
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flex: 1, paddingRight: '12px' }}>
                  <span style={{ fontWeight: 'bold', width: '65px', flexShrink: 0, color: '#000000' }}>นามผู้ซื้อ</span>
                  <span style={{ flex: 1, fontWeight: 'normal', color: '#000000' }}>{buyerName || ''}</span>
                </div>
                <div style={{ display: 'flex', flexShrink: 0, justifyContent: 'flex-end' }}>
                  <span style={{ fontWeight: 'bold', marginRight: '8px', color: '#000000' }}>วันที่</span>
                  <span style={{ fontWeight: 'normal', color: '#000000' }}>{dateThai || ''}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flex: 1, paddingRight: '12px' }}>
                  <span style={{ fontWeight: 'bold', width: '65px', flexShrink: 0, color: '#000000' }}>ที่อยู่</span>
                  <span style={{ flex: 1, fontWeight: 'normal', color: '#000000' }}>{buyerAddress || ''}</span>
                </div>
                <div style={{ display: 'flex', flexShrink: 0, justifyContent: 'flex-end' }}>
                  <span style={{ fontWeight: 'bold', marginRight: '8px', color: '#000000' }}>เลขประจำตัวผู้เสียภาษี</span>
                  <span style={{ fontWeight: 'normal', color: '#000000' }}>{buyerTaxId || ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table Container - Fill space down to bottom line */}
          <div style={{ ...border1pt, marginTop: '-1px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

            {/* ลายน้ำกึ่งกลางกรอบตาราง (Watermark Size 18pt, Opacity 0.15) */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', zIndex: 0
            }}>
              <div style={{ textAlign: 'center', padding: '8px 20px', opacity: 0.15 }}>
                <div style={{ fontSize: '18pt', fontWeight: 'bold', color: '#000000', letterSpacing: '0.04em' }}>
                  บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
                </div>
                <div style={{ fontSize: '16pt', fontWeight: 'bold', color: '#000000', marginTop: '4px', letterSpacing: 'normal' }}>
                  Print {printedTimestamp}
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt', flex: 1, position: 'relative', zIndex: 1, background: 'transparent' }}>
              <thead>
                <tr style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12pt', color: '#000000', ...borderBottom075 }}>
                  <th style={{ padding: '6px 4px', width: '40px', fontWeight: 'bold', fontSize: '12pt', color: '#000000', ...borderRight075 }}>ลำดับ</th>
                  <th style={{ padding: '6px 6px', width: '65px', fontWeight: 'bold', fontSize: '12pt', color: '#000000', ...borderRight075 }}>จำนวน</th>
                  <th style={{ padding: '6px 10px', fontWeight: 'bold', fontSize: '12pt', color: '#000000', ...borderRight075 }}>รายการสินค้าหรือบริการ</th>
                  <th style={{ padding: '6px 6px', width: '85px', fontWeight: 'bold', fontSize: '12pt', color: '#000000', ...borderRight075 }}>ราคาต่อหน่วย</th>
                  <th style={{ padding: '6px 6px', width: '55px', fontWeight: 'bold', fontSize: '12pt', color: '#000000', ...borderRight075 }}>DRC</th>
                  <th style={{ padding: '6px 10px', width: '115px', textAlign: 'right', fontWeight: 'bold', fontSize: '12pt', color: '#000000' }}>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {chunk && chunk.length > 0 ? (
                  chunk.map((item, idx) => {
                    const seqNo = startSeq + idx + 1;
                    const fullDesc = item.details ? `${item.title} ${item.details}` : item.title;
                    const drcText = (item.drc && item.drc !== '-') ? (item.drc.toString().includes('%') ? item.drc : `${item.drc}%`) : '';
                    
                    // Calculate subtotal (gross before discount)
                    const q = Number(item.quantity || 0);
                    const p = Number(item.unitPrice || 0);
                    let drcFactor = 1;
                    if (item.drc && item.drc !== '-') {
                      const cleanDrc = parseFloat(item.drc.toString().replace('%', ''));
                      if (!isNaN(cleanDrc)) drcFactor = cleanDrc / 100;
                    }
                    const itemSubtotal = item.subtotal || (q * p * drcFactor);
                    const discVal = Number(item.discountAmount || 0);
                    const discDetails = item.discountDetails || '';

                    return (
                      <tr key={idx} style={{ verticalAlign: 'top', height: '24px' }}>
                        <td style={{ padding: '3px 4px', textAlign: 'center', fontWeight: 'normal', width: '40px', color: '#000000', ...borderRight075 }}>
                          {seqNo}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 'normal', width: '65px', color: '#000000', ...borderRight075 }}>
                          {item.quantity ? Number(item.quantity).toLocaleString('th-TH') : '-'}
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: fullDesc ? 'left' : 'center', fontWeight: 'normal', color: '#000000', lineHeight: '1.35', ...borderRight075 }}>
                          <div>{fullDesc || ''}</div>
                          {discDetails ? (
                            <div style={{ fontStyle: 'italic', fontSize: '10pt', color: '#333333', marginTop: '1px' }}>
                              *{discDetails}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'center', width: '85px', fontWeight: 'normal', color: '#000000', ...borderRight075 }}>
                          {item.unitPrice ? Number(item.unitPrice).toLocaleString('th-TH', { minimumFractionDigits: 1 }) : ''}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 'normal', width: '55px', color: '#000000', ...borderRight075 }}>
                          {drcText}
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: 'right', fontWeight: 'normal', color: '#000000', width: '115px' }}>
                          <div>{itemSubtotal ? Number(itemSubtotal).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</div>
                          {discVal > 0 ? (
                            <div style={{ fontStyle: 'italic', fontSize: '10pt', color: '#333333', marginTop: '1px' }}>
                              ({Number(discVal).toLocaleString('th-TH')})
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr style={{ verticalAlign: 'top', height: '24px' }}>
                    <td style={{ padding: '3px 4px', textAlign: 'center', fontWeight: 'normal', width: '40px', color: '#000000', ...borderRight075 }}></td>
                    <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 'normal', width: '65px', color: '#000000', ...borderRight075 }}></td>
                    <td style={{ padding: '3px 10px', textAlign: 'center', fontWeight: 'normal', color: '#000000', lineHeight: '1.35', ...borderRight075 }}></td>
                    <td style={{ padding: '3px 6px', textAlign: 'center', width: '85px', fontWeight: 'normal', color: '#000000', ...borderRight075 }}></td>
                    <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 'normal', width: '55px', color: '#000000', ...borderRight075 }}></td>
                    <td style={{ padding: '3px 10px', textAlign: 'right', fontWeight: 'normal', color: '#000000', width: '115px' }}>0.00</td>
                  </tr>
                )}

                {/* Empty rows to fill remaining height nicely */}
                {Array.from({ length: emptyRowsCount }).map((_, emptyIdx) => (
                  <tr key={`empty-${emptyIdx}`} style={{ height: '24px' }}>
                    <td style={{ ...borderRight075 }}></td>
                    <td style={{ ...borderRight075 }}></td>
                    <td style={{ ...borderRight075 }}></td>
                    <td style={{ ...borderRight075 }}></td>
                    <td style={{ ...borderRight075 }}></td>
                    <td></td>
                  </tr>
                ))}

                {/* Filler Row to absorb leftover height in table box */}
                <tr style={{ height: 'auto' }}>
                  <td style={{ ...borderRight075 }}></td>
                  <td style={{ ...borderRight075 }}></td>
                  <td style={{ ...borderRight075 }}></td>
                  <td style={{ ...borderRight075 }}></td>
                  <td style={{ ...borderRight075 }}></td>
                  <td></td>
                </tr>

                {/* Grand Total Row (shows on last page) */}
                {isLastPage ? (
                  <>
                    <tr style={{ fontSize: '11pt', fontWeight: 'bold', color: '#000000', height: '28px', ...borderTop075 }}>
                      <td colSpan={5} style={{ padding: '3px 10px', height: '28px', verticalAlign: 'middle', textAlign: 'center', color: '#000000', ...borderRight075, ...borderBottom075 }}>
                        รวมทั้งสิ้น
                      </td>
                      <td style={{ padding: '3px 10px', height: '28px', verticalAlign: 'middle', textAlign: 'right', color: '#000000', ...borderBottom075 }}>
                        {Number(totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* BAHTTEXT Row */}
                    <tr style={{ fontSize: '11pt', fontWeight: 'bold', color: '#000000', height: '28px' }}>
                      <td colSpan={6} style={{ padding: '3px 10px', height: '28px', verticalAlign: 'middle', textAlign: 'center', color: '#000000' }}>
                        {bahtText}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr style={{ fontSize: '11pt', fontWeight: 'bold', fontStyle: 'italic', color: '#333333', height: '28px', ...borderTop075 }}>
                    <td colSpan={6} style={{ padding: '3px 10px', height: '28px', verticalAlign: 'middle', textAlign: 'right' }}>
                      (มีต่อหน้าถัดไป)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Lower Section */}
          <div style={{ flexShrink: 0 }}>
            {/* Payment Method & Notes */}
            <div style={{ padding: '10px 12px', fontSize: '11pt', lineHeight: '1.6', color: '#000000', marginTop: '-1px', display: 'flex', flexDirection: 'column', gap: '8px', ...border1pt }}>
              <div>
                <span style={{ fontWeight: 'bold', color: '#000000' }}>ชำระโดย : </span>
                <span style={{ fontWeight: 'normal', color: '#000000' }}>{paymentText}</span>
              </div>
              <div>
                <span style={{ fontWeight: 'bold', color: '#000000' }}>หมายเหตุ: </span>
                <span style={{ fontWeight: 'normal', color: '#000000' }}>{notes && notes !== '-' ? notes : ''}</span>
              </div>
            </div>

            {/* Cashier Signature Section (Height 3.5cm / 35mm with name flush near bottom border) */}
            <div style={{
              height: '35mm',
              boxSizing: 'border-box',
              position: 'relative',
              fontSize: '11pt',
              marginTop: '-1px',
              color: '#000000',
              ...border1pt
            }}>
              <div style={{
                position: 'absolute',
                bottom: '2px',
                left: 0,
                right: 0,
                textAlign: 'center'
              }}>
                {cashierName && (
                  <div style={{ fontWeight: 'normal', color: '#000000', marginBottom: '1px' }}>{cashierName}</div>
                )}
                <div style={{ fontWeight: 'bold', color: '#000000', lineHeight: '1.2' }}>ผู้รับเงิน</div>
              </div>
            </div>

            {/* Printed Timestamp Footer (Italic 2 lines) */}
            <div style={{ textAlign: 'right', fontSize: '10pt', fontWeight: 'normal', fontStyle: 'italic', color: '#000000', marginTop: '4px', marginBottom: '2px', lineHeight: '1.3' }}>
              <div>เอกสารฉบับนี้พิมพ์ ณ วันที่ {printDateVal}</div>
              <div>เวลา {printTimeVal}</div>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div style={{ background: 'white' }}>
      {/* 1. ชุดต้นฉบับ (Original Pages) */}
      {itemChunks.map((chunk, idx) => renderSinglePage(chunk, idx, false))}

      {/* 2. ชุดสำเนา (Copy Pages) */}
      {itemChunks.map((chunk, idx) => renderSinglePage(chunk, idx, true))}
    </div>
  );
}

export default function PrintReceipt({ receiptData }) {
  return <PrintReceiptContent receiptData={receiptData} />;
}



