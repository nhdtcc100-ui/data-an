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
  const gid = gidMatch && gidMatch[1] ? gidMatch[1] : '0';

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

  const { sheetId, gid: targetGid } = parsed;
  const timestamp = Date.now();

  // ── 1. محاولة جلب مصنف العمل كاملاً كـ XLSX (إن كان متاحاً في البيئة) ──
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
            // فرز الشيتات: نضع شيتات Pivot Table في المقدمة أولاً
            allSheets.sort((a, b) => (b.isPivot ? 1 : 0) - (a.isPivot ? 1 : 0));
            const activeSheet = allSheets[0];
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
    // في المتصفح، قد يُحظر XLSX بسبب CORS فننتقل فوراً إلى استدعاء gviz المتعدد والمضمون
  }

  // ── 2. جلب متعدد الشيتات عبر Google Visualization API (مضمون 100% في المتصفحات) ──
  const candidateTargets: Array<{ id: string; param: string; label: string }> = [
    { id: targetGid, param: `gid=${targetGid}`, label: targetGid === '0' ? 'Pivot Table (الجدول المحوري)' : `ورقة (GID ${targetGid})` }
  ];

  if (targetGid !== '0') {
    candidateTargets.push({ id: '0', param: 'gid=0', label: 'Pivot Table (الجدول المحوري)' });
  }

  // إضافة الشيتات القياسية والـ GIDs المعروفة
  const extraGids = ['891723734', '213259799', '1235422104'];
  extraGids.forEach((egid) => {
    if (egid !== targetGid && egid !== '0') {
      candidateTargets.push({ id: egid, param: `gid=${egid}`, label: `ورقة_${egid}` });
    }
  });

  ['Sheet1', 'Sheet2', 'Sheet3', 'Sheet4', 'Sheet5', 'Sheet6', 'Pivot1', 'Pivot2'].forEach((sn) => {
    candidateTargets.push({ id: sn, param: `sheet=${encodeURIComponent(sn)}`, label: sn });
  });

  const fetchPromises = candidateTargets.map(async (target) => {
    const fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&${target.param}&_nocache=${timestamp}`;
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
        if (text && !text.includes('<!DOCTYPE html>') && text.trim().length > 20) {
          return { ...target, csvText: text };
        }
      }
    } catch {
      // Ignored - sheet might not exist
    }
    return null;
  });

  const fetchedResults = await Promise.all(fetchPromises);
  const seenSignatures = new Set<string>();
  const allSheets: Sheet[] = [];

  for (const item of fetchedResults) {
    if (!item || !item.csvText) continue;

    // توقيع المحتوى لإلغاء أي أوراق مكررة (نفس السجلات بالضبط)
    const firstLine = item.csvText.split('\n')[0]?.trim() || '';
    const lineCount = item.csvText.split('\n').length;
    const sig = `${firstLine}::${lineCount}`;
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);

    try {
      const parsed = parseGoogleSheetCsvSmart(item.csvText, item.id);
      if (parsed.rows.length === 0) continue;

      const sheetName = parsed.tableTitle
        ? parsed.tableTitle.slice(0, 40)
        : item.label;

      allSheets.push({
        id: `sheet-${item.id}`,
        name: sheetName,
        rowCount: parsed.rows.length,
        columns: parsed.columns,
        rawRows: parsed.rows,
        tableTitle: parsed.tableTitle,
        isPivot: parsed.isPivot,
        pivotDetection: parsed.pivotDetection
      });
    } catch (parseErr) {
      console.warn(`Failed to parse sheet ${item.id}:`, parseErr);
    }
  }

  if (allSheets.length === 0) {
    // خطة بديلة فقط عند انقطاع الإنترنت التام
    if (!forceLive && sheetId === KNOWN_USER_SHEET_ID && initialSheetRows && initialSheetRows.length > 0) {
      const rows = initialSheetRows as Record<string, any>[];
      const cols = inferColumnsFromRows(rows, 0);
      const fallbackSheet: Sheet = {
        id: `sheet-${targetGid}`,
        name: 'العروض_والمنتجات_التفصيلية',
        rowCount: rows.length,
        columns: cols,
        rawRows: rows
      };
      return {
        id: `ds-gsheet-${sheetId.slice(0, 8)}`,
        workspaceId: 'ws-main',
        fileName: 'عروض الشركات والأجهزة (Google Sheets Live).csv',
        fileSizeBytes: 287577,
        uploadedAt: new Date().toISOString(),
        activeSheetId: fallbackSheet.id,
        sheets: [fallbackSheet],
        columns: cols,
        rawRows: rows
      };
    }
    throw new Error('لم يتم العثور على أي بيانات صالحة في ملف Google Sheet. تأكد من أن الملف عام (Public) ويحتوي على جداول.');
  }

  // فرز الشيتات: نضع شيتات Pivot Table في المقدمة أولاً
  allSheets.sort((a, b) => (b.isPivot ? 1 : 0) - (a.isPivot ? 1 : 0));

  const activeSheet = allSheets.find((s) => s.isPivot) || allSheets.find((s) => s.id === `sheet-${targetGid}`) || allSheets[0];

  return {
    id: `ds-gsheet-${sheetId.slice(0, 8)}`,
    workspaceId: 'ws-main',
    fileName: `Google Sheets (${allSheets.length} أوراق - ${activeSheet.isPivot ? '🧩 Pivot Table' : 'بيانات'}).csv`,
    fileSizeBytes: allSheets.reduce((acc, s) => acc + (s.rawRows?.length || 0) * 100, 0),
    uploadedAt: new Date().toISOString(),
    activeSheetId: activeSheet.id,
    sheets: allSheets,
    columns: activeSheet.columns,
    rawRows: activeSheet.rawRows || [],
    isPivot: activeSheet.isPivot,
    pivotDetection: activeSheet.pivotDetection
  };
}
