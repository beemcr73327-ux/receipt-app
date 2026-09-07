/**
 * Verification Test for Atomic Sequence Logic
 * Run locally to verify prefix calculations, seed transitions, and padding formats
 */

import { getThaiDocPrefix, formatThaiDateTime, parseDate } from '../utils/dateUtils.js';

function runTests() {
  console.log('🧪 Starting Atomic Sequence Engine Logic Tests...\n');
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, testName) {
    if (actual === expected) {
      console.log(`✅ PASS: ${testName} (Actual: ${actual})`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} (Expected: ${expected}, Got: ${actual})`);
      failed++;
    }
  }

  // 1. Test Thai Year Prefix for September 2026 (2569)
  const sep2026 = new Date('2026-09-07T10:00:00Z');
  assertEqual(getThaiDocPrefix(sep2026), '6909', 'September 2026 should produce prefix 6909');

  // 2. Test Thai Year Prefix for January 2027 (2570)
  const jan2027 = new Date('2027-01-15T10:00:00Z');
  assertEqual(getThaiDocPrefix(jan2027), '7001', 'January 2027 should produce prefix 7001');

  // 3. Test Thai Year Prefix for December 2026 (2569)
  const dec2026 = new Date('2026-12-31T10:00:00Z');
  assertEqual(getThaiDocPrefix(dec2026), '6912', 'December 2026 should produce prefix 6912');

  // 4. Test Formatted Number Padding (4 digits)
  const prefix = '6909';
  const seq1 = 1;
  const seq99 = 99;
  const seq1000 = 1000;
  assertEqual(`${prefix}${String(seq1).padStart(4, '0')}`, '69090001', 'Sequence 1 should format as 69090001');
  assertEqual(`${prefix}${String(seq99).padStart(4, '0')}`, '69090099', 'Sequence 99 should format as 69090099');
  assertEqual(`${prefix}${String(seq1000).padStart(4, '0')}`, '69091000', 'Sequence 1000 should format as 69091000');

  // 5. Test Mock Database In-Memory Sequence Logic
  const mockTable = {}; // mock D1 document_sequences

  function mockUpsertSequence(docType, pfx, manualSeed = null) {
    const key = `${docType}_${pfx}`;
    if (!mockTable[key]) {
      mockTable[key] = { current_seq: 1, manual_seed: manualSeed };
      return 1;
    }
    const row = mockTable[key];
    if (row.manual_seed !== null && row.current_seq < row.manual_seed) {
      row.current_seq = row.manual_seed;
    } else {
      row.current_seq += 1;
    }
    return row.current_seq;
  }

  function mockSetSeed(docType, pfx, seed) {
    const key = `${docType}_${pfx}`;
    if (!mockTable[key]) {
      mockTable[key] = { current_seq: seed - 1, manual_seed: seed };
    } else {
      mockTable[key].manual_seed = seed;
      mockTable[key].current_seq = Math.max(mockTable[key].current_seq, seed - 1);
    }
  }

  // First run without seed
  assertEqual(mockUpsertSequence('receipt', '6909'), 1, 'First receipt sequence should be 1');
  assertEqual(mockUpsertSequence('receipt', '6909'), 2, 'Second receipt sequence should be 2');
  assertEqual(mockUpsertSequence('receipt', '6909'), 3, 'Third receipt sequence should be 3');

  // Admin sets seed to 50
  mockSetSeed('receipt', '6909', 50);
  assertEqual(mockUpsertSequence('receipt', '6909'), 50, 'Receipt sequence after seed 50 should jump to 50');
  assertEqual(mockUpsertSequence('receipt', '6909'), 51, 'Subsequent receipt sequence should be 51');

  // Voucher is independent from Receipt
  assertEqual(mockUpsertSequence('voucher', '6909'), 1, 'Voucher should have independent sequence starting at 1');
  assertEqual(mockUpsertSequence('voucher', '6909'), 2, 'Second voucher sequence should be 2');

  console.log(`\n📊 Test Results: ${passed} Passed, ${failed} Failed`);
}

runTests();
