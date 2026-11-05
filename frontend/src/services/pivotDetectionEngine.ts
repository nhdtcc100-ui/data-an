/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * pivotDetectionEngine.ts
 * محرك كشف Pivot Tables تلقائياً من Excel / Google Sheets
 * يحلل البنية ويستنتج السؤال التحليلي الذي يجيب عليه الـ Pivot
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface ValueField {
  /** اسم حقل القيمة (رأس العمود في الـ Pivot) */
  name: string;
  /** نوع التجميع المستنتج */
  aggregation: 'SUM' | 'COUNT' | 'AVG' | 'MAX' | 'MIN';
  /** هل القيم أرقام؟ */
  isNumeric: boolean;
}

export interface PivotStructure {
  /** أعمدة الصفوف (Row Labels) — عادةً العمود الأول */
  rowDimensions: string[];
  /** أعمدة الأعمدة (Column Labels) — عادةً الصف الأول */
  columnDimensions: string[];
  /** أعمدة الفلاتر (Filter Labels) — التصفية */
  filterDimensions?: string[];
  /** حقول القيم (Values area) */
  valueFields: ValueField[];
  /** هل يوجد صف "الإجمالي الكلي" (Grand Total)؟ */
  hasGrandTotal: boolean;
  /** اسم الشيت */
  sheetName: string;
  /** إجمالي صفوف البيانات */
  dataRowCount: number;
  /** إجمالي الأعمدة */
  dataColCount: number;
}

export interface PivotDetectionResult {
  /** هل هذا الشيت Pivot Table؟ */
  isPivot: boolean;
  /** درجة الثقة (0 → 1) */
  confidence: number;
  /** إشارات الكشف التي اشتعلت */
  signals: string[];
  /** بنية الـ Pivot المستخرجة (إن وُجد) */
  pivotStructure?: PivotStructure;
  /** السؤال التحليلي الذي يجيب عليه هذا الـ Pivot */
  question?: string;
  /** ثلاثة أسئلة مقترحة */
  suggestedQuestions?: string[];
}

// ─────────────────────────────────────────────────────────────────
// Helpers داخلية
// ─────────────────────────────────────────────────────────────────

function norm(v: any): string {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function isNumericVal(v: any): boolean {
  if (typeof v === 'number') return true;
  const s = norm(v);
  if (!s) return false;
  // تقبل أرقام بفاصلة عربية أو لاتينية
  return !isNaN(Number(s.replace(/,/g, '')));
}

/** هل القيمة نص غير رقمي وغير فارغ؟ */
function isTextVal(v: any): boolean {
  if (!norm(v)) return false;
  return !isNumericVal(v);
}

/**
 * هل الصف يبدو "صف إجمالي كلي" (Grand Total)؟
 */
function isGrandTotalRow(row: any[]): boolean {
  const first = norm(row[0]);
  const keywords = [
    'Grand Total', 'grand total', 'الإجمالي', 'الإجمالي الكلي',
    'المجموع', 'المجموع الكلي', 'Total', 'total', 'إجمالي'
  ];
  return keywords.some((kw) => first.includes(kw));
}

/**
 * استنتج نوع التجميع من اسم الحقل
 */
function inferAggregation(name: string): 'SUM' | 'COUNT' | 'AVG' | 'MAX' | 'MIN' {
  const lower = name.toLowerCase();
  if (lower.includes('count') || lower.includes('عدد')) return 'COUNT';
  if (lower.includes('avg') || lower.includes('average') || lower.includes('متوسط')) return 'AVG';
  if (lower.includes('max') || lower.includes('أقصى') || lower.includes('أعلى')) return 'MAX';
  if (lower.includes('min') || lower.includes('أدنى') || lower.includes('أقل')) return 'MIN';
  return 'SUM';
}

function inferPivotQuestion(structure: PivotStructure): string {
  const { rowDimensions, columnDimensions, valueFields } = structure;

  const rowLabel = rowDimensions[0] || 'الفئة';
  const colLabel = columnDimensions[0];
  const valLabel = valueFields[0]?.name || 'القيمة';

  const agg = valueFields[0]?.aggregation;
  const aggLabel =
    agg === 'COUNT' ? 'عدد' :
    agg === 'AVG'   ? 'متوسط' :
    agg === 'MAX'   ? 'أقصى' :
    agg === 'MIN'   ? 'أدنى' :
                      'إجمالي';

  if (columnDimensions.length > 0 && colLabel) {
    if (valueFields.length > 1) {
      const valNames = valueFields.map((v) => v.name).join(' و ');
      return `ما هو ${aggLabel} ${valNames} لكل ${rowLabel} مقسّمًا حسب ${colLabel}؟`;
    }
    return `ما هو ${aggLabel} ${valLabel} لكل ${rowLabel} مقسّمًا حسب ${colLabel}؟`;
  }

  if (rowDimensions.length > 1) {
    const rowLabels = rowDimensions.join(' و ');
    return `ما هو ${aggLabel} ${valLabel} لكل ${rowLabels}؟`;
  }

  return `ما هو ${aggLabel} ${valLabel} لكل ${rowLabel}؟`;
}

/** أنشئ ثلاثة أسئلة مقترحة */
function buildSuggestedQuestions(structure: PivotStructure): string[] {
  const { rowDimensions, columnDimensions, valueFields, hasGrandTotal } = structure;
  const rowLabel = rowDimensions[0] || 'الفئة';
  const colLabel = columnDimensions[0];
  const valLabel = valueFields[0]?.name || 'القيمة';

  const questions: string[] = [];

  // السؤال الأول: الأعلى
  questions.push(`ما هو ${rowLabel} الذي يمتلك أعلى ${valLabel}؟`);

  // السؤال الثاني: المقارنة
  if (colLabel) {
    questions.push(`كيف يتباين ${valLabel} بين ${rowLabel} عبر مختلف ${colLabel}؟`);
  } else if (rowDimensions.length > 1) {
    questions.push(`ما هي العلاقة بين ${rowDimensions[0]} و ${rowDimensions[1]} من حيث ${valLabel}؟`);
  } else {
    questions.push(`ما هو التوزيع النسبي لـ ${valLabel} عبر ${rowLabel}؟`);
  }

  // السؤال الثالث: الاتجاه / التحليل
  if (hasGrandTotal) {
    questions.push(`ما نسبة مساهمة كل ${rowLabel} في إجمالي ${valLabel}؟`);
  } else if (valueFields.length > 1) {
    const v2 = valueFields[1]?.name || 'القيمة الثانية';
    questions.push(`ما العلاقة بين ${valLabel} و ${v2} لكل ${rowLabel}؟`);
  } else {
    questions.push(`ما هو الاتجاه العام لـ ${valLabel} بحسب ${rowLabel}؟`);
  }

  return questions;
}

// ─────────────────────────────────────────────────────────────────
// استخراج بنية الـ Pivot
// ─────────────────────────────────────────────────────────────────

function extractPivotStructure(raw2D: any[][], sheetName: string): PivotStructure {
  // حذف الصفوف الفارغة كلياً من الأعلى
  let startRow = 0;
  while (startRow < raw2D.length && raw2D[startRow].every((c) => !norm(c))) {
    startRow++;
  }
  const data = raw2D.slice(startRow);
  if (data.length === 0) {
    return {
      rowDimensions: [],
      columnDimensions: [],
      valueFields: [],
      hasGrandTotal: false,
      sheetName,
      dataRowCount: 0,
      dataColCount: 0
    };
  }

  // الصف الأول = رؤوس الأعمدة
  const headerRow = data[0];
  // العمود الأول (index 0) عادةً هو "Row Labels"
  const firstColName = norm(headerRow[0]);

  // أعمدة "الأعمدة" = كل شيء من العمود 1 فصاعداً (استثنِ Grand Total)
  const colHeaders = headerRow
    .slice(1)
    .map(norm)
    .filter((h) => h && !['Grand Total', 'الإجمالي', 'الإجمالي الكلي', 'المجموع', 'Total', 'إجمالي'].some((kw) => h.includes(kw)));

  // هل آخر عمود في headerRow هو Grand Total؟
  const lastHeader = norm(headerRow[headerRow.length - 1]);
  const hasGrandTotalCol = ['Grand Total', 'الإجمالي', 'الإجمالي الكلي', 'المجموع', 'Total', 'إجمالي'].some((kw) => lastHeader.includes(kw));

  // صفوف البيانات (بعد الرأس)
  const dataRows = data.slice(1).filter((row) => !row.every((c) => !norm(c)));

  // هل يوجد صف Grand Total في الأسفل أو عمود إجمالي؟
  const hasGrandTotal = dataRows.some(isGrandTotalRow) || hasGrandTotalCol;

  // صفوف البيانات الحقيقية (بدون Grand Total)
  const realDataRows = dataRows.filter((row) => !isGrandTotalRow(row));

  // هل أعمدة الـ header تبدو قيم (أرقام كسنوات، أشهر) أم نصوص (فئات)؟
  // إذا كانت أعمدة أرقام/تواريخ → columnDimensions
  // إذا كانت نصوص → valueFields (حقول قيم متعددة)
  const colHeadersAreNumericOrDates = colHeaders.every((h) => {
    return !isNaN(Number(h)) || /^\d{4}$/.test(h) || /Q\d|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(h) ||
           /يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر|ربع/.test(h);
  });

  let columnDimensions: string[] = [];
  let valueFields: ValueField[] = [];

  if (colHeadersAreNumericOrDates && colHeaders.length > 1) {
    // الأعمدة هي فئات (سنوات / أشهر) → dimension
    columnDimensions = colHeaders;
    // القيمة = ما يوجد في الخلايا
    valueFields = [{
      name: firstColName || 'القيمة',
      aggregation: inferAggregation(firstColName),
      isNumeric: true
    }];
  } else {
    // الأعمدة هي حقول قيم (Sum of Sales, Count of Orders, ...)
    valueFields = colHeaders.map((h) => ({
      name: h,
      aggregation: inferAggregation(h),
      isNumeric: realDataRows.some((row) => {
        const idx = headerRow.findIndex((v) => norm(v) === h);
        return idx >= 0 && isNumericVal(row[idx]);
      })
    }));
  }

  // العمود الأول يحتوي الأبعاد (rowDimensions)
  // إذا كان firstColName يبدو مختلطاً (مثلاً "Category / Year") نقسّمه
  const rowDimensions = firstColName
    ? firstColName.split(/\/|،|,/).map((s) => s.trim()).filter(Boolean)
    : ['الفئة'];

  return {
    rowDimensions,
    columnDimensions,
    valueFields,
    hasGrandTotal,
    sheetName,
    dataRowCount: realDataRows.length,
    dataColCount: colHeaders.length
  };
}

// ─────────────────────────────────────────────────────────────────
// الدالة الرئيسية: كشف الـ Pivot
// ─────────────────────────────────────────────────────────────────

/**
 * يحلل ورقة Excel الخام ويحدد إذا كانت Pivot Table
 * @param ws  - كائن XLSX.WorkSheet
 * @param sheetName - اسم الشيت
 * @returns  PivotDetectionResult
 */
export function detectPivotSheet(
  ws: XLSX.WorkSheet,
  sheetName: string
): PivotDetectionResult {
  const raw2D: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    blankrows: true
  }) as any[][];

  return detectPivotFrom2D(raw2D, sheetName, ws);
}

/**
 * نفس كشف الـ Pivot لكن من مصفوفة 2D مباشرة (للاستخدام الداخلي)
 */
export function detectPivotFrom2D(
  raw2D: any[][],
  sheetName: string,
  ws?: XLSX.WorkSheet
): PivotDetectionResult {
  const signals: string[] = [];
  let score = 0;
  const MAX_SCORE = 10;

  if (!raw2D || raw2D.length < 2) {
    return { isPivot: false, confidence: 0, signals: ['بيانات غير كافية'] };
  }

  // تجاهل الصفوف الفارغة في الأعلى
  let headerRowIdx = 0;
  while (headerRowIdx < raw2D.length && raw2D[headerRowIdx].every((c) => !norm(c))) {
    headerRowIdx++;
  }

  if (headerRowIdx >= raw2D.length) {
    return { isPivot: false, confidence: 0, signals: ['الشيت فارغ'] };
  }

  const headerRow = raw2D[headerRowIdx];
  const dataRows = raw2D.slice(headerRowIdx + 1).filter((r) => !r.every((c) => !norm(c)));

  if (dataRows.length < 2) {
    return { isPivot: false, confidence: 0, signals: ['صفوف بيانات غير كافية'] };
  }

  // ── إشارة 1: خلية (0,0) فارغة أو "Row Labels" (قوية جداً) ──────────────
  const cell00 = norm(headerRow[0]);
  const rowLabelsKeywords = ['Row Labels', 'row labels', 'تسميات الصفوف', ''];
  if (rowLabelsKeywords.includes(cell00) || !cell00) {
    score += 3;
    signals.push(`✓ خلية (0,0) فارغة أو "Row Labels" (+3)`);
  } else if (cell00.length < 25 && isTextVal(cell00)) {
    // اسم حقل قصير — محتمل
    score += 1;
    signals.push(`✓ خلية (0,0) اسم حقل قصير (+1)`);
  }

  // ── إشارة 2: أعمدة رأس العمود نصوص أو أرقام متسلسلة (سنوات / أشهر) ───
  const colHeaders = headerRow.slice(1).filter((c) => norm(c));
  if (colHeaders.length >= 2) {
    const allText = colHeaders.every(isTextVal);
    const allNumeric = colHeaders.every((c) => !isNaN(Number(norm(c))));
    const hasYears = colHeaders.every((c) => {
      const n = Number(norm(c));
      return n >= 1990 && n <= 2100;
    });
    const hasMonths = colHeaders.some((c) =>
      /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Q\d/i.test(norm(c)) ||
      /يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر|ربع/.test(norm(c))
    );

    if (hasYears || hasMonths) {
      score += 2;
      signals.push(`✓ أعمدة بيانات = سنوات/أشهر (+2)`);
    } else if (allText) {
      score += 1;
      signals.push(`✓ رؤوس أعمدة نصية (+1)`);
    } else if (allNumeric) {
      score += 1;
      signals.push(`✓ رؤوس أعمدة رقمية (+1)`);
    }
  }

  // ── إشارة 3: وجود صف "Grand Total" / "الإجمالي" ──────────────────────
  const hasGrandTotalRow = dataRows.some(isGrandTotalRow);
  if (hasGrandTotalRow) {
    score += 2;
    signals.push(`✓ يوجد صف إجمالي كلي "Grand Total" (+2)`);
  }

  // ── إشارة 4: آخر عمود يبدو "Grand Total" ──────────────────────────────
  const lastColHeader = norm(headerRow[headerRow.length - 1]);
  const grandTotalKeywords = ['Grand Total', 'الإجمالي', 'الإجمالي الكلي', 'المجموع', 'Total', 'إجمالي'];
  if (grandTotalKeywords.some((kw) => lastColHeader.includes(kw))) {
    score += 1;
    signals.push(`✓ آخر عمود هو إجمالي (+1)`);
  }

  // ── إشارة 5: العمود الأول = نصوص، بقية الأعمدة = أرقام ────────────────
  const dataColCount = headerRow.filter((c) => norm(c)).length - 1;
  if (dataColCount >= 2) {
    let rowsWithTextFirst = 0;
    let rowsWithNumericRest = 0;

    for (const row of dataRows.slice(0, Math.min(10, dataRows.length))) {
      if (isGrandTotalRow(row)) continue;
      if (isTextVal(row[0])) rowsWithTextFirst++;
      const restNums = row.slice(1, dataColCount + 1).filter((c) => norm(c)).filter(isNumericVal);
      const restAll = row.slice(1, dataColCount + 1).filter((c) => norm(c));
      if (restAll.length > 0 && restNums.length / restAll.length >= 0.6) rowsWithNumericRest++;
    }

    const checkRows = Math.min(10, dataRows.filter((r) => !isGrandTotalRow(r)).length);
    if (checkRows > 0 && rowsWithTextFirst / checkRows >= 0.6) {
      score += 1;
      signals.push(`✓ العمود الأول نصي (فئات) (+1)`);
    }
    if (checkRows > 0 && rowsWithNumericRest / checkRows >= 0.6) {
      score += 2;
      signals.push(`✓ باقي الأعمدة أرقام (قيم) (+2)`);
    }
  }

  // ── إشارة 6: الخلايا المدمجة (Merged Cells) — من WorkSheet مباشرة ────
  if (ws && ws['!merges'] && ws['!merges'].length > 0) {
    score += 1;
    signals.push(`✓ تحتوي خلايا مدمجة (Merged Cells) (+1)`);
  }

  // ── إشارة 7: أسماء أعمدة تحتوي "Sum of" / "Count of" / "مجموع" ────────
  const pivotColPatterns = [
    /^sum of /i, /^count of /i, /^avg of /i, /^max of /i, /^min of /i,
    /^مجموع /, /^عدد /, /^متوسط /, /^أقصى /, /^أدنى /
  ];
  const hasPivotColNames = colHeaders.some((h) =>
    pivotColPatterns.some((p) => p.test(norm(h)))
  );
  if (hasPivotColNames) {
    score += 2;
    signals.push(`✓ أعمدة بأسماء Pivot ("Sum of / Count of") (+2)`);
  }

  // ── احسب الثقة ────────────────────────────────────────────────────────
  const confidence = Math.min(score / MAX_SCORE, 1);
  const isPivot = confidence >= 0.5;

  if (!isPivot) {
    // ── محاولة ثانية ذكية: تحليل الشيت كجدول مجمع (Tabular Pivot) ────────
    // يستنتج المناطق: صف (Row) / عمود (Column) / فلتر (Filter) / فاليو (Value) (SUM أو COUNT)
    const headers = headerRow.map(norm).filter(Boolean);
    const rowsObj: Record<string, any>[] = [];
    for (const r of dataRows.slice(0, 100)) {
      if (isGrandTotalRow(r)) continue;
      const obj: Record<string, any> = {};
      headers.forEach((h, ci) => { obj[h] = r[ci] ?? ''; });
      rowsObj.push(obj);
    }
    const zoneResult = inferPivotZonesFromColumnsAndRows(headers, rowsObj, sheetName);
    if (zoneResult.isPivot) {
      return zoneResult;
    }
    return { isPivot: false, confidence, signals };
  }

  // ── استخرج البنية وأنشئ السؤال ────────────────────────────────────────
  const pivotStructure = extractPivotStructure(raw2D, sheetName);
  const question = inferPivotQuestion(pivotStructure);
  const suggestedQuestions = buildSuggestedQuestions(pivotStructure);

  return {
    isPivot: true,
    confidence,
    signals,
    pivotStructure,
    question,
    suggestedQuestions
  };
}

/**
 * يستنتج توزيع الحقول الذكي إلى 4 مناطق Pivot:
 * - الصف (Row)
 * - العمود (Column)
 * - الفلتر (Filter)
 * - القيمة (Value) مع تحديد ما إذا كانت SUM أم COUNT
 */
export function inferPivotZonesFromColumnsAndRows(
  columnNames: string[],
  rows: Record<string, any>[],
  sheetName = 'Google_Sheet'
): PivotDetectionResult {
  const cleanCols = columnNames.filter((c) => c && !c.startsWith('__EMPTY') && c.trim() !== '');
  if (cleanCols.length < 2 || rows.length === 0) {
    return { isPivot: false, confidence: 0, signals: ['أعمدة أو صفوف غير كافية'] };
  }

  const sampleRows = rows.slice(0, Math.min(100, rows.length));

  // 1. فحص حقول القيم (Values) ونوع التجميع (SUM أم COUNT)
  let bestValueCol: string | null = null;
  let bestAgg: 'SUM' | 'COUNT' = 'SUM';
  let isExplicitPivotVal = false;

  // فحص صريح لـ Count of أو Sum of أو مجموع أو عدد
  for (const col of cleanCols) {
    const lower = col.toLowerCase().trim();
    if (lower.startsWith('count of') || lower.startsWith('count_of') || lower.startsWith('عدد ') || lower.includes('عدد')) {
      bestValueCol = col;
      bestAgg = 'COUNT';
      isExplicitPivotVal = true;
      break;
    }
    if (lower.startsWith('sum of') || lower.startsWith('sum_of') || lower.startsWith('مجموع ') || lower.startsWith('إجمالي ') || lower.includes('مجموع')) {
      bestValueCol = col;
      bestAgg = 'SUM';
      isExplicitPivotVal = true;
      break;
    }
  }

  // إذا لم نجد اسماً صريحاً، نفحص كل عمود لمعرفة نسبة الأرقام
  if (!bestValueCol) {
    const numScores = cleanCols.map((col) => {
      let numCount = 0;
      let nonNull = 0;
      for (const r of sampleRows) {
        const v = r[col];
        if (v !== undefined && v !== null && v !== '') {
          nonNull++;
          if (isNumericVal(v)) numCount++;
        }
      }
      return { col, ratio: nonNull > 0 ? numCount / nonNull : 0 };
    });

    const numericCols = numScores.filter((s) => s.ratio >= 0.5).map((s) => s.col);
    if (numericCols.length > 0) {
      // تفضيل الكمية، المبيعات، السعر، المبلغ، الإيرادات
      const preferred = numericCols.find((c) =>
        /كمية|مبيعات|سعر|مبلغ|أرباح|إيرادات|إجمالي|amount|qty|quantity|sales|price|revenue|total/i.test(c)
      );
      bestValueCol = preferred || numericCols[0];
      if (/count|عدد|مرات|تكرار/i.test(bestValueCol)) {
        bestAgg = 'COUNT';
      } else {
        bestAgg = 'SUM';
      }
    } else {
      bestValueCol = cleanCols[cleanCols.length - 1];
      bestAgg = 'COUNT';
    }
  }

  // 2. فحص الأبعاد الفئوية (Categorical Dimensions) لتوزيعها: صف (Row) / عمود (Column) / فلتر (Filter)
  const candidateDims = cleanCols.filter((c) => c !== bestValueCol);

  // حساب عدد القيم الفريدة (Cardinality) لكل بعد
  const dimStats = candidateDims.map((col) => {
    const distinct = new Set<string>();
    for (const r of sampleRows) {
      const v = norm(r[col]);
      if (v) distinct.add(v);
    }
    const isDate = /تاريخ|date|time|year|سنة|شهر|أسبوع/i.test(col);
    const isFilterKeyword = /زبون|عميل|customer|مدينة|منطقة|فرع|موقع|location|حالة|status|ضمان/i.test(col);
    const isRowKeyword = /مركز|كلفة|شركة|مادة|منتج|صنف|فئة|item|product|category|center|اسم/i.test(col);
    const isColKeyword = /مجموعة|قسم|نوع|group|department|type|segment/i.test(col);

    return {
      col,
      distinctCount: distinct.size,
      isDate,
      isFilterKeyword,
      isRowKeyword,
      isColKeyword
    };
  });

  // تحديد بعد الصف (Row Labels):
  let rowCol = dimStats.find((d) => d.isRowKeyword && !d.isDate)?.col;
  if (!rowCol) {
    const sortedByCard = [...dimStats].filter((d) => !d.isDate).sort((a, b) => b.distinctCount - a.distinctCount);
    rowCol = sortedByCard[0]?.col || candidateDims[0] || 'الفئة';
  }

  // تحديد بعد العمود (Column Labels):
  const remainingForCol = dimStats.filter((d) => d.col !== rowCol);
  let colCol = remainingForCol.find((d) => d.isColKeyword && !d.isDate)?.col;
  if (!colCol) {
    const lowCard = remainingForCol.find((d) => d.distinctCount >= 2 && d.distinctCount <= 15 && !d.isDate);
    colCol = lowCard?.col;
  }

  // تحديد حقول الفلتر (Filter):
  const filterCols = candidateDims.filter((c) => c !== rowCol && c !== colCol);

  const valueFields: ValueField[] = [{
    name: bestValueCol,
    aggregation: bestAgg,
    isNumeric: bestAgg === 'SUM'
  }];

  const structure: PivotStructure = {
    rowDimensions: [rowCol],
    columnDimensions: colCol ? [colCol] : [],
    filterDimensions: filterCols,
    valueFields,
    hasGrandTotal: false,
    sheetName,
    dataRowCount: rows.length,
    dataColCount: cleanCols.length
  };

  const question = inferPivotQuestion(structure);
  const suggestedQuestions = buildSuggestedQuestions(structure);

  const confidence = isExplicitPivotVal ? 0.95 : 0.85;

  return {
    isPivot: true,
    confidence,
    signals: [
      isExplicitPivotVal ? `✓ تم اكتشاف حقل Pivot صريح: "${bestValueCol}" (${bestAgg})` : `✓ تم استنتاج حقل القيمة: "${bestValueCol}" (${bestAgg})`,
      `✓ تم تعيين الصف (Row): "${rowCol}"`,
      colCol ? `✓ تم تعيين العمود (Column): "${colCol}"` : `✓ بعد عمود أحادي`,
      filterCols.length > 0 ? `✓ تم تعيين الفلاتر (Filters): ${filterCols.slice(0, 3).join('، ')}` : ''
    ].filter(Boolean),
    pivotStructure: structure,
    question,
    suggestedQuestions
  };
}

