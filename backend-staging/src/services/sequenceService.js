/**
 * Atomic Sequence Engine (Cloudflare D1)
 * Project: Receipt & Payment Voucher Management System
 * Organization: บริษัท ศรีสุข พูนทรัพย์ ยางพารา จำกัด
 * Version: 5.0 (Phase 0.2)
 * 
 * Features:
 * - Server-side atomic sequence generation with zero race conditions
 * - Thai Buddhist Era monthly prefix: YYMM (e.g. 6909)
 * - Running number format: YYMMXXXX (e.g. 69090001)
 * - Admin manual seed configuration with safeguard against backwards jumping
 */

import { getThaiDocPrefix } from '../utils/dateUtils.js';

export const VALID_DOC_TYPES = ['receipt', 'voucher', 'weigh_ticket', 'lot'];

/**
 * ดึงเลขที่เอกสารถัดไปแบบ Atomic (รับประกันเลขไม่ซ้ำและไม่กระโดด 100%)
 * @param {D1Database} db 
 * @param {string} docType - 'receipt' | 'voucher' | 'weigh_ticket' | 'lot'
 * @param {Date|string} [dateInput] - วันที่ออกเอกสาร (Default คือเวลาปัจจุบัน)
 * @returns {Promise<{ docType: string, prefix: string, sequenceNumber: number, formattedNumber: string }>}
 */
export async function getNextDocumentNumber(db, docType, dateInput = new Date()) {
  const cleanDocType = validateDocType(docType);
  const prefix = getThaiDocPrefix(dateInput);

  // คำสั่ง SQL แบบ Atomic Upsert พร้อม RETURNING
  // จัดการกรณี: (1) ขึ้นเดือนใหม่ (2) มีการตั้ง Manual Seed (3) รันปกติ
  const query = `
    INSERT INTO document_sequences (doc_type, prefix, current_seq, updated_at)
    VALUES (?, ?, 1, DATETIME('now', '+7 hours'))
    ON CONFLICT(doc_type, prefix) DO UPDATE SET
      current_seq = CASE
        WHEN manual_seed IS NOT NULL AND current_seq < manual_seed THEN manual_seed
        ELSE current_seq + 1
      END,
      updated_at = DATETIME('now', '+7 hours')
    RETURNING current_seq;
  `;

  const result = await db.prepare(query).bind(cleanDocType, prefix).first();
  const nextSeq = result ? result.current_seq : 1;
  const formattedNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;

  return {
    docType: cleanDocType,
    prefix,
    sequenceNumber: nextSeq,
    formattedNumber
  };
}

/**
 * ดูตัวอย่างเลขที่เอกสารถัดไป (Preview) โดยไม่เพิ่มตัวนับในฐานข้อมูล
 * @param {D1Database} db 
 * @param {string} docType 
 * @param {Date|string} [dateInput] 
 * @returns {Promise<{ docType: string, prefix: string, nextSequenceNumber: number, nextFormattedNumber: string }>}
 */
export async function previewNextDocumentNumber(db, docType, dateInput = new Date()) {
  const cleanDocType = validateDocType(docType);
  const prefix = getThaiDocPrefix(dateInput);

  const query = `
    SELECT current_seq, manual_seed 
    FROM document_sequences 
    WHERE doc_type = ? AND prefix = ?
  `;

  const row = await db.prepare(query).bind(cleanDocType, prefix).first();

  let nextSeq = 1;
  if (row) {
    if (row.manual_seed !== null && row.current_seq < row.manual_seed) {
      nextSeq = row.manual_seed;
    } else {
      nextSeq = row.current_seq + 1;
    }
  }

  const nextFormattedNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;

  return {
    docType: cleanDocType,
    prefix,
    nextSequenceNumber: nextSeq,
    nextFormattedNumber
  };
}

/**
 * กำหนดเลขเริ่มต้นของประเภทเอกสารและเดือนที่ต้องการ (Manual Seed Config)
 * มีระบบป้องกัน: จะไม่ยอมให้ลดค่าต่ำกว่าเลขเอกสารที่เคยออกไปแล้ว
 * @param {D1Database} db 
 * @param {string} docType 
 * @param {string} prefix - เช่น '6909'
 * @param {number} seedValue - ตัวเลขเริ่มต้น เช่น 50
 * @returns {Promise<{ docType: string, prefix: string, manualSeed: number, nextFormattedNumber: string }>}
 */
export async function setManualSeed(db, docType, prefix, seedValue) {
  const cleanDocType = validateDocType(docType);
  const cleanPrefix = String(prefix || '').trim() || getThaiDocPrefix();
  const cleanSeed = parseInt(seedValue, 10);

  if (isNaN(cleanSeed) || cleanSeed < 1) {
    throw new Error('ค่าเลขเริ่มต้น (seedValue) ต้องเป็นจำนวนเต็มบวกตั้งแต่ 1 ขึ้นไป');
  }

  // ถ้า current_seq ยังน้อยกว่า seed ให้ตั้ง current_seq = seed - 1 เพื่อให้ใบถัดไปออกเป็นค่า seed พอดี
  const query = `
    INSERT INTO document_sequences (doc_type, prefix, current_seq, manual_seed, updated_at)
    VALUES (?, ?, ? - 1, ?, DATETIME('now', '+7 hours'))
    ON CONFLICT(doc_type, prefix) DO UPDATE SET
      manual_seed = excluded.manual_seed,
      current_seq = MAX(current_seq, excluded.manual_seed - 1),
      updated_at = DATETIME('now', '+7 hours')
    RETURNING current_seq, manual_seed;
  `;

  const result = await db.prepare(query).bind(cleanDocType, cleanPrefix, cleanSeed, cleanSeed).first();
  const nextFormattedNumber = `${cleanPrefix}${String(cleanSeed).padStart(4, '0')}`;

  return {
    docType: cleanDocType,
    prefix: cleanPrefix,
    manualSeed: cleanSeed,
    currentSeq: result ? result.current_seq : cleanSeed - 1,
    nextFormattedNumber
  };
}

/**
 * ตรวจสอบสถานะตัวนับปัจจุบันของเอกสาร
 * @param {D1Database} db 
 * @param {string} docType 
 * @param {string} [prefix] 
 */
export async function getSequenceStatus(db, docType, prefix = null) {
  const cleanDocType = validateDocType(docType);
  const targetPrefix = prefix ? String(prefix).trim() : getThaiDocPrefix();

  const query = `
    SELECT doc_type, prefix, current_seq, manual_seed, updated_at
    FROM document_sequences
    WHERE doc_type = ? AND prefix = ?
  `;

  const row = await db.prepare(query).bind(cleanDocType, targetPrefix).first();

  return {
    docType: cleanDocType,
    prefix: targetPrefix,
    currentSeq: row ? row.current_seq : 0,
    manualSeed: row ? row.manual_seed : null,
    formattedCurrent: row && row.current_seq > 0 ? `${targetPrefix}${String(row.current_seq).padStart(4, '0')}` : 'ยังไม่มีการออกเอกสาร',
    updatedAt: row ? row.updated_at : null
  };
}

/**
 * ตรวจสอบความถูกต้องของประเภทเอกสาร
 * @param {string} docType 
 * @returns {string}
 */
function validateDocType(docType) {
  const clean = String(docType || '').toLowerCase().trim();
  if (!VALID_DOC_TYPES.includes(clean)) {
    throw new Error(`ประเภทเอกสาร '${docType}' ไม่ถูกต้อง (ต้องเป็น: ${VALID_DOC_TYPES.join(', ')})`);
  }
  return clean;
}
