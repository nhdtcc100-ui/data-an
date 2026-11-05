import type { DataSource, Sheet, Column } from '../types/dataSource';
import initialSheetRows from './googleSheetInitialData.json';
import { parseGoogleSheetCsvSmart, inferColumnsFromRows, parseWorksheetSmartTables } from './smartTableDetection';
import * as XLSX from 'xlsx';

export const DEFAULT_GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/12Jay5TtiQxxVkaAWonIWYJ62_H6uuzgUlgHRRxgm6Q0/edit?gid=891723734#gid=891723734';

export const KNOWN_USER_SHEET_ID = '12Jay5TtiQxxVkaAWonIWYJ62_H6uuzgUlgHRRxgm6Q0';
export const KNOWN_USER_SHEET_GID = '891723734';

/**
 * Extracts Google Sheet ID and GID from a full Google Sheets URL
 */
export function parseGoogleSheetUrl(url: string): { sheetId: string; gid: string } | null {
  if (!url || typeof url !== 'string') return null;

  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch || !idMatch[1]) return null;
  const sheetId = idMatch[1];

  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  let gid = gidMatch && gidMatch[1] ? gidMatch[1] : '0';

  // If this is the user's known workbook and no gid was specified or gid is 0,
  // prefer the rich itemized sheet (891723734)
  if (sheetId === KNOWN_USER_SHEET_ID && (!gidMatch || gid === '0')) {
    gid = KNOWN_USER_SHEET_GID;
  }

  return { sheetId, gid };
}

/**
 * Build Column metadata for dataset (kept for backward compat)
 */
export function inferColumns(cleanedRows: Record<string, any>[]): Column[] {
  return inferColumnsFromRows(cleanedRows, 0);
}

/**
 * Fetches and parses a Google Sheet using SMART TABLE DETECTION.
 * - Anti-caching: sends cache-busting timestamp & no-store headers to always get live edits
 * - Dual endpoint: tries direct export first, then gviz API
 * - Smart parsing: detects actual table headers, skips filters and titles
 */
export async function fetchGoogleSheetData(
  url: string = DEFAULT_GOOGLE_SHEET_URL,
  forceLive = true
): Promise<DataSource> {
  const parsed = parseGoogleSheetUrl(url);
  if (!parsed) {
    throw new Error('رابط Google Sheet غير صالح. يرجى التأكد من نسخ الرابط كاملاً.');
  }

  const { sheetId, gid } = parsed;
  const timestamp = Date.now();

  // ── محاولة جلب مصنف العمل كاملاً كـ XLSX (يدعم جلب كافة الأوراق والشيتات مع Pivot Tables) ──
  try {
    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&_nocache=${timestamp}`;
    const xlsxRes = await fetch(xlsxUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (xlsxRes.ok) {
      const buffer = await xlsxRes.arrayBuffer();
      if (buffer.byteLength > 500) {
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
        if (workbook.SheetNames && workbook.SheetNames.length > 0) {
          const allSheets: Sheet[] = [];
          workbook.SheetNames.forEach((sName, sIdx) => {
            const ws = workbook.Sheets[sName];
            const parsed = parseWorksheetSmartTables(ws, sName, sIdx);
            if (parsed) {
              allSheets.push(...parsed);
            }
          });

          if (allSheets.length > 0) {
            // تفضيل الشيت المطابق للـ gid إن وجد أو أول شيت
            const activeSheet = allSheets.find((s) => s.id === `sheet-${gid}-0` || s.id === `sheet-${gid}-pivot`) || allSheets[0];
            return {
              id: `ds-gsheet-${sheetId.slice(0, 8)}`,
              workspaceId: 'ws-main',
              fileName: `Google Sheets (${workbook.SheetNames.length} أوراق).xlsx`,
              fileSizeBytes: buffer.byteLength,
              uploadedAt: new Date().toISOString(),
              activeSheetId: activeSheet.id,
              sheets: allSheets,
              columns: activeSheet.columns,
              rawRows: activeSheet.rawRows || [],
              isPivot: activeSheet.isPivot,
              pivotDetection: activeSheet.pivotDetection
            };
          }
        }
      }
    } else if (xlsxRes.status === 401 || xlsxRes.status === 403) {
      throw new Error(
        'الملف مقيد الصلاحيات (Private). يرجى فتح ملف Google Sheet والضغط على «مشاركة» وتغيير الوصول إلى: «أي شخص لديه الرابط يمكنه العرض».'
      );
    }
  } catch (xlsxErr: any) {
    if (xlsxErr.message?.includes('مقيد الصلاحيات')) {
      throw xlsxErr;
    }
    console.warn('Google Sheets XLSX multi-sheet fetch bypassed/failed, falling back to CSV:', xlsxErr);
  }

  // ── خطة بديلة: جلب ورقة واحدة بصيغة CSV ──
  // Try direct export first, then gviz endpoint
  const candidateUrls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&_nocache=${timestamp}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}&_nocache=${timestamp}`
  ];

  let csvText = '';
  let lastError: any = null;

  for (const fetchUrl of candidateUrls) {
    try {
      const response = await fetch(fetchUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const text = await response.text();
        // Check if response is valid CSV (not an HTML login redirect)
        if (text && !text.includes('<!DOCTYPE html>') && text.trim().length > 10) {
          csvText = text;
          break;
        }
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(
          'الملف مقيد الصلاحيات (Private). يرجى فتح ملف Google Sheet والضغط على «مشاركة» وتغيير الوصول إلى: «أي شخص لديه الرابط يمكنه العرض».'
        );
      }
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes('مقيد الصلاحيات')) {
        throw err;
      }
    }
  }

  // Fallback to cached initial snapshot ONLY if offline / network completely failed and forceLive is false
  if (!csvText || csvText.trim().length === 0) {
    if (!forceLive && sheetId === KNOWN_USER_SHEET_ID && initialSheetRows && initialSheetRows.length > 0) {
      console.warn('Network fetch failed, using pre-bundled Google Sheet data cache:', lastError);
      const rows = initialSheetRows as Record<string, any>[];
      const cols = inferColumnsFromRows(rows, 0);
      return {
        id: `ds-gsheet-${sheetId.slice(0, 8)}`,
        workspaceId: 'ws-main',
        fileName: 'عروض الشركات والأجهزة (Google Sheets Live).csv',
        fileSizeBytes: 287577,
        uploadedAt: new Date().toISOString(),
        activeSheetId: `sheet-${gid}`,
        sheets: [
          {
            id: `sheet-${gid}`,
            name: 'العروض_والمنتجات_التفصيلية',
            rowCount: rows.length,
            columns: cols,
            rawRows: rows
          }
        ],
        columns: cols,
        rawRows: rows
      };
    }

    if (lastError) {
      throw new Error(`تعذر جلب البيانات المحدثة من Google Sheet: ${lastError.message || 'فشل الاتصال'}`);
    }
    throw new Error('الملف فارغ أو لا يحتوي على أي صفوف بيانات.');
  }

  // ── Smart Table Detection: finds actual table headers ignoring filters/titles ──
  const { rows: cleanedRows, columns, tableTitle, isPivot, pivotDetection } = parseGoogleSheetCsvSmart(csvText, gid);

  if (cleanedRows.length === 0) {
    throw new Error('لم يتم العثور على أي جدول بيانات صالح في ورقة Google Sheet.');
  }

  const sheetName = tableTitle
    ? tableTitle.slice(0, 40)
    : (gid === KNOWN_USER_SHEET_GID ? 'العروض_والمنتجات_التفصيلية' : 'Google_Sheet_Live');

  const sheetObj: Sheet = {
    id: `sheet-${gid}`,
    name: sheetName,
    rowCount: cleanedRows.length,
    columns,
    rawRows: cleanedRows,
    tableTitle,
    isPivot,
    pivotDetection
  };

  return {
    id: `ds-gsheet-${sheetId.slice(0, 8)}`,
    workspaceId: 'ws-main',
    fileName: `${sheetName} (Google Sheets Live).csv`,
    fileSizeBytes: csvText.length,
    uploadedAt: new Date().toISOString(),
    activeSheetId: sheetObj.id,
    sheets: [sheetObj],
    columns,
    rawRows: cleanedRows,
    isPivot,
    pivotDetection
  };
}
