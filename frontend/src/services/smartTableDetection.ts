/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * smartTableDetection.ts
 * كشف ذكي عن الجداول الحقيقية داخل أوراق Excel / Google Sheets
 * يتجاوز صفوف الفلتر والعناوين والمساحات الفارغة
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import * as XLSX from 'xlsx';
import type { Column, ColumnDataType } from '../types/dataSource';

export interface DetectedTable {
  headerRowIndex: number;         // رقم الصف الذي يحتوي رؤوس الأعمدة (0-indexed)
  headers: string[];              // أسماء الأعمدة المكتشفة
  rows: Record<string, any>[];    // صفوف البيانات فقط (بعد الرأس)
  columns: Column[];              // أعمدة مع نوع البيانات المستنتج
  tableTitle?: string;            // عنوان الجدول (إن وجد فوقه)
}

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function normalizeVal(v: any): string {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function isEmptyRow(row: any[]): boolean {
  return row.every((c) => normalizeVal(c) === '');
}

/** Scores a row as a potential header: more non-empty short text cells = higher score */
function headerScore(row: any[]): number {
  let score = 0;
  let nonEmpty = 0;
  for (const cell of row) {
    const v = normalizeVal(cell);
    if (!v) continue;
    nonEmpty++;
    // String cells of reasonable length suggest headers
    if (typeof cell === 'string' && v.length <= 60) score += 2;
    // Numbers rarely appear in headers
    if (typeof cell === 'number') score -= 1;
  }
  // Penalize if too few cells
  if (nonEmpty < 2) score -= 10;
  return score;
}

/** How much data (non-empty) does the following window of rows have? */
function dataScore(rows: any[][], startIdx: number, windowSize = 5): number {
  let filled = 0, total = 0;
  for (let i = startIdx; i < Math.min(startIdx + windowSize, rows.length); i++) {
    for (const cell of rows[i]) {
      total++;
      if (normalizeVal(cell) !== '') filled++;
    }
  }
  return total > 0 ? filled / total : 0;
}

/**
 * Infer column types from rows
 */
export function inferColumnsFromRows(
  rows: Record<string, any>[],
  sheetIndex = 0
): Column[] {
  if (rows.length === 0) return [];
  const sampleSlice = rows.slice(0, Math.min(100, rows.length));
  const columnKeys = Object.keys(rows[0]).filter(
    (k) => k && !k.startsWith('__EMPTY') && k.trim() !== ''
  );

  return columnKeys.map((colKey, colIdx) => {
    let numCount = 0, dateCount = 0, totalChecked = 0;
    const samples: (string | number)[] = [];

    for (const row of sampleSlice) {
      const val = row[colKey];
      if (val !== undefined && val !== null && val !== '') {
        totalChecked++;
        if (samples.length < 5 && !samples.includes(val)) {
          samples.push(typeof val === 'number' ? val : String(val));
        }
        if (typeof val === 'number') {
          numCount++;
        } else if (
          val instanceof Date ||
          (!isNaN(Date.parse(String(val))) && /\d{4}[-\/]\d{2}/.test(String(val)))
        ) {
          dateCount++;
        }
      }
    }

    let dataType: ColumnDataType = 'string';
    if (totalChecked > 0 && numCount / totalChecked > 0.6) dataType = 'numeric';
    else if (totalChecked > 0 && dateCount / totalChecked > 0.6) dataType = 'date';

    return {
      id: `c-s${sheetIndex}-${colIdx}`,
      columnName: colKey,
      dataType,
      sampleValues: samples
    };
  });
}

// ─────────────────────────────────────────────────────
// Main: detectTablesInWorksheet
// ─────────────────────────────────────────────────────

/**
 * Analyzes a raw 2D array (from XLSX.utils.sheet_to_json with header:1)
 * to find all distinct tables inside a single worksheet.
 *
 * Strategy:
 *  1. Scan for rows that look like headers (string-heavy, multi-cell)
 *  2. Validate that the header is followed by ≥3 rows of data
 *  3. Determine where each table ends (empty row or another header)
 *  4. Extract title from the row(s) above the header if any
 */
export function detectTablesInWorksheet(
  raw2D: any[][],
  sheetIndex = 0
): DetectedTable[] {
  const tables: DetectedTable[] = [];
  if (!raw2D || raw2D.length === 0) return tables;

  // Filter out completely empty rows at top and track real line numbers
  let i = 0;
  const n = raw2D.length;

  while (i < n) {
    const row = raw2D[i];

    // Skip empty rows
    if (isEmptyRow(row)) { i++; continue; }

    const hScore = headerScore(row);
    const dScore = dataScore(raw2D, i + 1, 6);

    // A good header row: score ≥ 4 AND meaningful data follows
    if (hScore >= 4 && dScore > 0.15) {
      const headerRowIndex = i;
      // Clean headers (skip pure __EMPTY columns)
      const rawHeaders = row.map((v) => normalizeVal(v));
      const usedCols: number[] = [];
      const headers: string[] = [];

      rawHeaders.forEach((h, ci) => {
        if (h && !h.startsWith('__EMPTY')) {
          headers.push(h);
          usedCols.push(ci);
        }
      });

      if (headers.length < 2) { i++; continue; }

      // Try to find a title in the row(s) before this header
      let tableTitle: string | undefined;
      if (headerRowIndex > 0) {
        for (let ti = headerRowIndex - 1; ti >= Math.max(0, headerRowIndex - 3); ti--) {
          const trow = raw2D[ti];
          if (!isEmptyRow(trow)) {
            const candidate = trow.map(normalizeVal).filter(Boolean).join(' ').trim();
            if (candidate.length > 1 && candidate.length < 120) {
              tableTitle = candidate;
              break;
            }
          }
        }
      }

      // Collect data rows
      const dataRows: Record<string, any>[] = [];
      let j = headerRowIndex + 1;

      while (j < n) {
        const dataRow = raw2D[j];

        // Blank row = potential table end; look ahead to see if another table starts
        if (isEmptyRow(dataRow)) {
          // Check if next non-empty row looks like another header
          let lookahead = j + 1;
          while (lookahead < n && isEmptyRow(raw2D[lookahead])) lookahead++;
          if (lookahead < n && headerScore(raw2D[lookahead]) >= 4) break;
          j++;
          continue;
        }

        // Build a clean object for this data row
        const obj: Record<string, any> = {};
        let nonEmpty = 0;
        usedCols.forEach((ci, hi) => {
          const v = dataRow[ci] !== undefined ? dataRow[ci] : '';
          obj[headers[hi]] = v;
          if (normalizeVal(v) !== '') nonEmpty++;
        });

        // Skip rows that are almost entirely empty
        if (nonEmpty === 0) { j++; continue; }
        // Skip rows that look like summary/total rows
        const firstVal = normalizeVal(obj[headers[0]]);
        if (
          firstVal.includes('Grand Total') ||
          firstVal.includes('الإجمالي') ||
          firstVal.includes('المجموع') ||
          firstVal.includes('Total')
        ) { j++; continue; }

        dataRows.push(obj);
        j++;
      }

      if (dataRows.length >= 2) {
        tables.push({
          headerRowIndex,
          headers,
          rows: dataRows,
          columns: inferColumnsFromRows(dataRows, sheetIndex * 100 + tables.length),
          tableTitle
        });
      }

      i = j; // continue scanning after this table
    } else {
      i++;
    }
  }

  return tables;
}

/**
 * Parse an XLSX worksheet and return detected tables as Sheet[] compatible objects
 */
export function parseWorksheetSmartTables(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  sheetIndex: number
) {
  // Read as raw 2D array (no automatic header extraction)
  const raw2D: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: true
  }) as any[][];

  const detected = detectTablesInWorksheet(raw2D, sheetIndex);

  if (detected.length === 0) {
    // Fallback: standard parse from first row
    const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    if (rawJson.length === 0) return null;
    const columns = inferColumnsFromRows(rawJson, sheetIndex);
    return [{
      id: `sheet-${sheetIndex}-0`,
      name: sheetName,
      rowCount: rawJson.length,
      columns,
      previewRows: rawJson.slice(0, 50),
      rawRows: rawJson,
      tableTitle: undefined
    }];
  }

  // Return one "sheet" per detected table (or merge if only one found)
  return detected.map((tbl, ti) => ({
    id: `sheet-${sheetIndex}-${ti}`,
    name: detected.length === 1
      ? sheetName
      : (tbl.tableTitle || `${sheetName} – جدول ${ti + 1}`),
    rowCount: tbl.rows.length,
    columns: tbl.columns,
    previewRows: tbl.rows.slice(0, 50),
    rawRows: tbl.rows,
    tableTitle: tbl.tableTitle
  }));
}

/**
 * Parse a CSV text (from Google Sheets export) and detect real table region.
 * Returns { rows, columns } with the best-quality table found.
 */
export function parseGoogleSheetCsvSmart(
  csvText: string,
  _gid?: string
): { rows: Record<string, any>[]; columns: Column[]; tableTitle?: string } {
  // Use XLSX to parse CSV into 2D
  const workbook = XLSX.read(csvText, { type: 'string', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const raw2D: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: true
  }) as any[][];

  const detected = detectTablesInWorksheet(raw2D, 0);

  if (detected.length > 0) {
    // Pick the table with the most rows (most data-rich)
    const best = detected.reduce((a, b) => b.rows.length > a.rows.length ? b : a);
    return {
      rows: best.rows,
      columns: best.columns,
      tableTitle: best.tableTitle
    };
  }

  // Fallback: standard parse
  const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  return {
    rows: rawJson,
    columns: inferColumnsFromRows(rawJson, 0)
  };
}
