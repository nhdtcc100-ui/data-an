// ==============================================================================
// powerQueryExporter.ts
// مولّد Power Query M-Code من نموذج البيانات المتعدد المصادر
// يولّد كود جاهز للصق في Excel أو Power BI Desktop
// ==============================================================================

import type { MultiTableDataSource, TableEntry, TableRelation } from '../types/dataSource';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** ينظّف الاسم ليكون صالحاً كمعرّف في M-Code */
function sanitizeName(name: string): string {
  return name
    .replace(/[\s\-\.\/\\]/g, '_')
    .replace(/[^\w\u0600-\u06FF]/g, '')
    .replace(/^(\d)/, '_$1')
    .trim() || 'Table';
}

/** يحوّل نوع الربط إلى JoinKind في M-Code */
function joinKindM(joinType: TableRelation['joinType']): string {
  switch (joinType) {
    case 'inner': return 'JoinKind.Inner';
    case 'right': return 'JoinKind.RightOuter';
    default:      return 'JoinKind.LeftOuter';
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// الدالة الرئيسية: توليد M-Code
// ──────────────────────────────────────────────────────────────────────────────

export interface PowerQueryExportResult {
  mCode: string;
  summary: {
    tablesCount: number;
    relationsCount: number;
    estimatedRows: number;
  };
}

/**
 * يولّد M-Code كامل من نموذج البيانات المتعدد
 * يدعم:
 *  - Google Sheets (عبر Web.Contents)
 *  - ملفات محلية (Excel)
 *  - دمج الجداول بالعلاقات (NestedJoin)
 */
export function exportToPowerQuery(model: MultiTableDataSource): PowerQueryExportResult {
  const { tables, relations } = model;

  if (!tables || tables.length === 0) {
    return {
      mCode: '// لا توجد جداول في النموذج الحالي',
      summary: { tablesCount: 0, relationsCount: 0, estimatedRows: 0 }
    };
  }

  const tableVarNames = new Map<string, string>();
  tables.forEach((t) => {
    tableVarNames.set(t.id, sanitizeName(t.name));
  });

  const steps: string[] = [];

  // ─── خطوة 1: استيراد كل جدول ───────────────────────────────────────────────
  tables.forEach((table) => {
    const varName = tableVarNames.get(table.id)!;
    const tableSource = buildTableSource(table);
    steps.push(`    ${varName} = ${tableSource}`);
  });

  // ─── خطوة 2: تنظيف الأنواع لكل جدول ──────────────────────────────────────
  tables.forEach((table) => {
    const varName = tableVarNames.get(table.id)!;
    const typedVarName = `${varName}_Typed`;
    const typeExpr = buildTypeStep(table, varName);
    steps.push(`    ${typedVarName} = ${typeExpr}`);
    // استبدل اسم المتغير في الخرائط
    tableVarNames.set(table.id, typedVarName);
  });

  // ─── خطوة 3: الدمج حسب العلاقات ──────────────────────────────────────────
  let lastMergedVar = '';

  if (relations.length > 0) {
    // الجدول الرئيسي: أكثر الجداول علاقات
    const mainTable = findMainTable(tables, relations);
    lastMergedVar = tableVarNames.get(mainTable.id)!;

    relations.forEach((rel, idx) => {
      const leftVar  = tableVarNames.get(rel.leftTableId)  || lastMergedVar;
      const rightVar = tableVarNames.get(rel.rightTableId) || '';
      if (!rightVar || leftVar === rightVar) return;

      const mergedVar = `Merged_${idx + 1}`;
      const expandedVar = `Expanded_${idx + 1}`;
      const rightTable = tables.find((t) => t.id === rel.rightTableId);
      const expandCols = rightTable?.columns
        .filter((c) => c.columnName !== rel.rightColumn)
        .slice(0, 10)
        .map((c) => JSON.stringify(c.columnName))
        .join(', ')
        || '"Value"';

      steps.push(
        `    ${mergedVar} = Table.NestedJoin(` +
        `${leftVar}, {${JSON.stringify(rel.leftColumn)}}, ` +
        `${rightVar}, {${JSON.stringify(rel.rightColumn)}}, ` +
        `"${sanitizeName(rightTable?.name || 'Joined')}", ${joinKindM(rel.joinType)})`
      );
      steps.push(
        `    ${expandedVar} = Table.ExpandTableColumn(` +
        `${mergedVar}, "${sanitizeName(rightTable?.name || 'Joined')}", {${expandCols}})`
      );

      lastMergedVar = expandedVar;
    });
  } else {
    // لا علاقات: الناتج هو الجدول الأول
    lastMergedVar = tableVarNames.get(tables[0].id)!;
  }

  // ─── تجميع الكود ──────────────────────────────────────────────────────────
  const mCode = [
    '// ═══════════════════════════════════════════════════════════════════',
    '// Power Query M-Code — تم التوليد تلقائياً بواسطة Data Studio AI',
    `// التاريخ: ${new Date().toLocaleString('ar-SA')}`,
    `// الجداول: ${tables.length} | العلاقات: ${relations.length}`,
    '// ═══════════════════════════════════════════════════════════════════',
    '',
    'let',
    steps.join(',\n'),
    'in',
    `    ${lastMergedVar}`,
  ].join('\n');

  const estimatedRows = tables.reduce((sum, t) => sum + (t.rowCount || 0), 0);

  return {
    mCode,
    summary: {
      tablesCount: tables.length,
      relationsCount: relations.length,
      estimatedRows
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers داخلية
// ──────────────────────────────────────────────────────────────────────────────

/** يبني تعبير مصدر البيانات لجدول واحد */
function buildTableSource(table: TableEntry): string {
  if (table.sourceType === 'sheet') {
    // Google Sheets → CSV عام
    return (
      `let _src = Csv.Document(Web.Contents("https://docs.google.com/spreadsheets/d/YOUR_ID/export?format=csv"),` +
      `[Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.None]),` +
      ` _promoted = Table.PromoteHeaders(_src, [PromoteAllScalars=true]) in _promoted`
    );
  }

  // ملف Excel محلي
  const safeName = sanitizeName(table.name);
  return (
    `let _wb = Excel.Workbook(File.Contents("C:\\\\Data\\\\${table.fileName || table.name + '.xlsx'}"), null, true),` +
    ` _sheet = _wb{[Item="${table.name}",Kind="Sheet"]}[Data],` +
    ` _promoted = Table.PromoteHeaders(_sheet, [PromoteAllScalars=true]) in _promoted`
  );

  void safeName;
}

/** يبني خطوة تحديد أنواع الأعمدة */
function buildTypeStep(table: TableEntry, sourceVar: string): string {
  if (!table.columns || table.columns.length === 0) {
    return sourceVar;
  }

  const colTypes = table.columns
    .slice(0, 20) // حد أقصى 20 عمود في السطر
    .map((col) => {
      const mType = col.dataType === 'numeric' ? 'type number'
                  : col.dataType === 'date'    ? 'type date'
                  : col.dataType === 'boolean' ? 'type logical'
                  : 'type text';
      return `{${JSON.stringify(col.columnName)}, ${mType}}`;
    })
    .join(', ');

  return `Table.TransformColumnTypes(${sourceVar}, {${colTypes}})`;
}

/** يجد الجدول الرئيسي (الأكثر ارتباطاً كـ leftTable) */
function findMainTable(tables: TableEntry[], relations: TableRelation[]): TableEntry {
  const leftCounts: Record<string, number> = {};
  tables.forEach((t) => { leftCounts[t.id] = 0; });
  relations.forEach((r) => { leftCounts[r.leftTableId] = (leftCounts[r.leftTableId] || 0) + 1; });

  let maxCount = -1;
  let mainId = tables[0].id;
  for (const [id, count] of Object.entries(leftCounts)) {
    if (count > maxCount) { maxCount = count; mainId = id; }
  }
  return tables.find((t) => t.id === mainId) || tables[0];
}

// ──────────────────────────────────────────────────────────────────────────────
// توليد DAX Measures (لـ Power BI)
// ──────────────────────────────────────────────────────────────────────────────

export interface DaxMeasure {
  name: string;
  expression: string;
  description: string;
}

/**
 * يولّد مقاييس DAX تلقائية بناءً على الأعمدة الرقمية
 */
export function generateDaxMeasures(model: MultiTableDataSource): DaxMeasure[] {
  const measures: DaxMeasure[] = [];

  for (const table of model.tables) {
    const tableName = sanitizeName(table.name);
    const numCols = table.columns.filter((c) => c.dataType === 'numeric');

    for (const col of numCols.slice(0, 3)) {
      const colName = col.columnName;
      measures.push(
        {
          name: `إجمالي ${colName}`,
          expression: `SUM('${tableName}'[${colName}])`,
          description: `مجموع كل قيم عمود "${colName}" في جدول "${table.name}"`
        },
        {
          name: `متوسط ${colName}`,
          expression: `AVERAGE('${tableName}'[${colName}])`,
          description: `متوسط قيم عمود "${colName}"`
        }
      );
    }

    // مقياس COUNT عام
    measures.push({
      name: `عدد سجلات ${table.name}`,
      expression: `COUNTROWS('${tableName}')`,
      description: `إجمالي عدد الصفوف في جدول "${table.name}"`
    });
  }

  return measures;
}

/**
 * يصدر كود DAX كنص جاهز للنسخ
 */
export function exportDaxMeasuresAsText(model: MultiTableDataSource): string {
  const measures = generateDaxMeasures(model);
  const lines = [
    '-- ═══════════════════════════════════════════════',
    '-- DAX Measures — تم التوليد تلقائياً',
    `-- التاريخ: ${new Date().toLocaleString('ar-SA')}`,
    '-- ═══════════════════════════════════════════════',
    ''
  ];

  for (const m of measures) {
    lines.push(`-- ${m.description}`);
    lines.push(`${m.name} = ${m.expression}`);
    lines.push('');
  }

  return lines.join('\n');
}
