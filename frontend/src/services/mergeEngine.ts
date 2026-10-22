// ==============================================================================
// mergeEngine.ts
// محرك دمج وتجميع الجداول الذكي في الذاكرة (Power Query / Power Pivot Engine)
// يدعم:
// 1. دمج العلاقات (Relational Join - Power Pivot) مع مطابقة مفاتيح فائقة الذونة
// 2. تجميع وإلحاق الصفوف (Append Queries - Power Query) للشيتات المتشابهة
// 3. الحفاظ على الأسماء الحقيقية النظيفة للأعمدة وتجنب تكرارها أو تشويهها
// ==============================================================================

import type {
  MultiTableDataSource,
  TableEntry,
  TableRelation,
  Column,
  ColumnDataType
} from '../types/dataSource';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface MergeResult {
  mergedRows: Record<string, any>[];
  mergedColumns: Column[];
  mergedAt: string;
  modeUsed: 'join' | 'append';
  stats: {
    inputTables: number;
    inputRows: number[];
    outputRows: number;
    relationsApplied: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Key Normalization (مطابقة ذكية مرنة للمفاتيح)
// ──────────────────────────────────────────────────────────────────────────────

export function normalizeJoinKey(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str === '') return '';

  // 1. تحويل الأرقام المشرقية (الهندية) إلى أرقام عربية قياسية
  str = str.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  str = str.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

  // 2. توحيد حروف الألف والهمزات والتاء المربوطة لتجنب مشاكل تطابق النصوص في Excel
  str = str.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

  // 3. إذا كانت القيمة رقماً صريحاً (مثل 100 أو 100.0)، نوحد تمثيلها
  const num = Number(str);
  if (!isNaN(num) && isFinite(num)) {
    return String(num);
  }

  // 4. النصوص بالإنجليزية تصبح غير حساسة لحالة الأحرف (Case-insensitive)
  return str.toLowerCase();
}

/**
 * حساب نسبة تطابق أسماء الأعمدة بين الجداول لتحديد ما إذا كانت الشيتات من نفس النوع
 */
export function calculateColumnOverlap(tables: TableEntry[]): number {
  if (!tables || tables.length < 2) return 0;
  const colSets = tables.map(
    (t) => new Set((t.columns || []).map((c) => c.columnName.trim().toLowerCase()))
  );

  let totalPairs = 0;
  let totalOverlapScore = 0;

  for (let i = 0; i < colSets.length; i++) {
    for (let j = i + 1; j < colSets.length; j++) {
      totalPairs++;
      const setA = colSets[i];
      const setB = colSets[j];
      if (setA.size === 0 || setB.size === 0) continue;

      let intersection = 0;
      setA.forEach((col) => {
        if (setB.has(col)) intersection++;
      });
      const unionSize = new Set([...setA, ...setB]).size;
      totalOverlapScore += unionSize > 0 ? intersection / unionSize : 0;
    }
  }

  return totalPairs > 0 ? totalOverlapScore / totalPairs : 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// الدالة الرئيسية: mergeTablesWithRelations
// ──────────────────────────────────────────────────────────────────────────────

export function mergeTablesWithRelations(model: MultiTableDataSource): MergeResult {
  const { tables, relations = [], mode = 'auto' } = model;

  if (!tables || tables.length === 0) {
    return emptyResult();
  }

  // جدول واحد فقط: لا حاجة لأي دمج
  if (tables.length === 1) {
    const single = tables[0];
    const cleanCols = sanitizeColumns(single.columns || []);
    return {
      mergedRows: single.rawRows || [],
      mergedColumns: cleanCols,
      mergedAt: new Date().toISOString(),
      modeUsed: 'join',
      stats: {
        inputTables: 1,
        inputRows: [single.rowCount || 0],
        outputRows: single.rawRows?.length || 0,
        relationsApplied: 0
      }
    };
  }

  // تحديد النمط المناسب:
  // إذا تم اختيار 'append' صراحة، أو كان 'auto' ولا توجد علاقات ولكن الشيتات تشترك بنسبة > 35% في أسماء الأعمدة
  const overlap = calculateColumnOverlap(tables);
  const shouldAppend =
    mode === 'append' ||
    (mode === 'auto' && relations.length === 0 && overlap >= 0.35);

  if (shouldAppend) {
    return executeAppendQueries(tables);
  }

  // خلاف ذلك، ننفذ الدمج بالعلاقات (Relational Join - Power Pivot style)
  return executeRelationalJoin(tables, relations);
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. تجميع وإلحاق الصفوف (Append Queries - Power Query)
// ──────────────────────────────────────────────────────────────────────────────

function executeAppendQueries(tables: TableEntry[]): MergeResult {
  // تجميع قائمة الأعمدة الحقيقية الموحدة لجميع الشيتات
  const columnMap = new Map<string, { col: Column; originTable: string }>();

  tables.forEach((t) => {
    (t.columns || []).forEach((c) => {
      const cleanName = c.columnName.trim();
      if (!cleanName || cleanName.startsWith('__EMPTY')) return;

      const lower = cleanName.toLowerCase();
      if (!columnMap.has(lower)) {
        columnMap.set(lower, {
          col: { ...c, columnName: cleanName },
          originTable: t.name
        });
      }
    });
  });

  // إضافة عمود حقيقي لمصدر البيانات (اسم الشيت أو الملف)
  const sourceColName = 'ورقة_المصدر';
  const mergedColumns: Column[] = [
    {
      id: 'col-source-sheet',
      columnName: sourceColName,
      dataType: 'string' as ColumnDataType,
      sampleValues: tables.map((t) => t.name).slice(0, 5)
    },
    ...Array.from(columnMap.values()).map(({ col }, idx) => ({
      ...col,
      id: `appended-col-${idx}`
    }))
  ];

  // تجميع الصفوف
  const mergedRows: Record<string, any>[] = [];

  tables.forEach((t) => {
    const rows = t.rawRows || [];
    rows.forEach((r) => {
      const unifiedRow: Record<string, any> = {
        [sourceColName]: t.name
      };

      // ملء قيم الأعمدة الحقيقية
      for (const [lowerKey, { col }] of columnMap.entries()) {
        const directVal = r[col.columnName];
        if (directVal !== undefined) {
          unifiedRow[col.columnName] = directVal;
        } else {
          // فحص بالـ lowerCase إن كان هناك اختلاف في الهمزات أو المسافات
          let found = false;
          for (const [rk, rv] of Object.entries(r)) {
            if (rk.trim().toLowerCase() === lowerKey) {
              unifiedRow[col.columnName] = rv;
              found = true;
              break;
            }
          }
          if (!found) {
            unifiedRow[col.columnName] = null;
          }
        }
      }

      mergedRows.push(unifiedRow);
    });
  });

  return {
    mergedRows,
    mergedColumns,
    mergedAt: new Date().toISOString(),
    modeUsed: 'append',
    stats: {
      inputTables: tables.length,
      inputRows: tables.map((t) => t.rowCount || 0),
      outputRows: mergedRows.length,
      relationsApplied: 0
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. دمج العلاقات الحقيقي (Relational Join - Power Pivot)
// ──────────────────────────────────────────────────────────────────────────────

function executeRelationalJoin(
  tables: TableEntry[],
  relations: TableRelation[]
): MergeResult {
  const tableMap = new Map<string, TableEntry>();
  tables.forEach((t) => tableMap.set(t.id, t));

  // إذا لم تكن هناك أي علاقات محددة، نعتبر أول جدول هو الأساس
  if (relations.length === 0) {
    const mainTable = tables[0];
    return {
      mergedRows: mainTable.rawRows || [],
      mergedColumns: sanitizeColumns(mainTable.columns || []),
      mergedAt: new Date().toISOString(),
      modeUsed: 'join',
      stats: {
        inputTables: tables.length,
        inputRows: tables.map((t) => t.rowCount || 0),
        outputRows: mainTable.rawRows?.length || 0,
        relationsApplied: 0
      }
    };
  }

  // ترتيب العلاقات حسب الثقة
  const orderedRelations = [...relations].sort((a, b) => b.confidence - a.confidence);

  // الجدول الأساسي (الطرف الأيسر من أول علاقة)
  const firstRel = orderedRelations[0];
  const mainTable = tableMap.get(firstRel.leftTableId) || tables[0];

  let currentRows: Record<string, any>[] = (mainTable.rawRows || []).map((r) => ({ ...r }));
  let currentColumns: Column[] = sanitizeColumns(mainTable.columns || []);
  const processedTableIds = new Set<string>([mainTable.id]);
  let relationsApplied = 0;

  for (const rel of orderedRelations) {
    const leftTable = tableMap.get(rel.leftTableId);
    const rightTable = tableMap.get(rel.rightTableId);
    if (!leftTable || !rightTable) continue;

    let targetRightTable: TableEntry;
    let leftKeyCol: string;
    let rightKeyCol: string;

    if (processedTableIds.has(rel.leftTableId) && !processedTableIds.has(rel.rightTableId)) {
      targetRightTable = rightTable;
      leftKeyCol = rel.leftColumn;
      rightKeyCol = rel.rightColumn;
    } else if (!processedTableIds.has(rel.leftTableId) && processedTableIds.has(rel.rightTableId)) {
      targetRightTable = leftTable;
      leftKeyCol = rel.rightColumn;
      rightKeyCol = rel.leftColumn;
    } else if (!processedTableIds.has(rel.leftTableId) && !processedTableIds.has(rel.rightTableId)) {
      // كلاهما لم يُعالَج بعد: ابدأ بالـ left ثم ادمج الـ right
      currentRows = (leftTable.rawRows || []).map((r) => ({ ...r }));
      currentColumns = sanitizeColumns(leftTable.columns || []);
      processedTableIds.add(leftTable.id);

      targetRightTable = rightTable;
      leftKeyCol = rel.leftColumn;
      rightKeyCol = rel.rightColumn;
    } else {
      // كلاهما مدمج مسبقاً
      continue;
    }

    // بناء خريطة بحث سريعة لليمين باستخدام normalizeJoinKey
    const rightMap = new Map<string, Record<string, any>[]>();
    const rightRows = targetRightTable.rawRows || [];

    for (const rRow of rightRows) {
      const normKey = normalizeJoinKey(rRow[rightKeyCol]);
      if (normKey !== '') {
        if (!rightMap.has(normKey)) rightMap.set(normKey, []);
        rightMap.get(normKey)!.push(rRow);
      }
    }

    // تحديد أعمدة الجدول الأيمن الجديدة لتجنب تكرار مفتاح الربط
    const existingColNames = new Set(currentColumns.map((c) => c.columnName));
    const rightColsToAdd: { originalName: string; cleanName: string; col: Column }[] = [];

    (targetRightTable.columns || []).forEach((rc) => {
      const origName = rc.columnName.trim();
      if (!origName || origName.startsWith('__EMPTY')) return;

      // إذا كان هو مفتاح الربط وتطابق اسمه، لا نكرره
      if (origName === rightKeyCol && existingColNames.has(leftKeyCol)) {
        return;
      }

      // إذا كان هناك عمود آخر غير المفتاح يحمل نفس الاسم، نميزه باسم الجدول
      let cleanName = origName;
      if (existingColNames.has(cleanName)) {
        cleanName = `${origName} (${targetRightTable.name})`;
      }

      rightColsToAdd.push({
        originalName: origName,
        cleanName,
        col: { ...rc, columnName: cleanName }
      });
    });

    // تنفيذ الدمج الفعلي (Left Join الافتراضي كما في Power Pivot)
    const newMergedRows: Record<string, any>[] = [];

    for (const lRow of currentRows) {
      const leftKeyVal = normalizeJoinKey(lRow[leftKeyCol]);
      const matchedRightRows = leftKeyVal !== '' ? rightMap.get(leftKeyVal) : null;

      if (matchedRightRows && matchedRightRows.length > 0) {
        for (const mRight of matchedRightRows) {
          const mergedRow: Record<string, any> = { ...lRow };

          // دمج الأعمدة الجديدة
          for (const { originalName, cleanName } of rightColsToAdd) {
            const val = mRight[originalName];
            mergedRow[cleanName] = val !== undefined ? val : null;
            // توفير وصول بديل ببادئة الجدول لدعم أي استعلامات قديمة
            mergedRow[`${targetRightTable.name}.${originalName}`] = val;
          }

          newMergedRows.push(mergedRow);
        }
      } else if (rel.joinType !== 'inner') {
        // Left Join: نحافظ على الصف الأيسر مع قيم null للأعمدة المضافة
        const mergedRow: Record<string, any> = { ...lRow };
        for (const { cleanName, originalName } of rightColsToAdd) {
          mergedRow[cleanName] = null;
          mergedRow[`${targetRightTable.name}.${originalName}`] = null;
        }
        newMergedRows.push(mergedRow);
      }
    }

    currentRows = newMergedRows;
    currentColumns = [...currentColumns, ...rightColsToAdd.map((item) => item.col)];
    processedTableIds.add(targetRightTable.id);
    relationsApplied++;
  }

  return {
    mergedRows: currentRows,
    mergedColumns: currentColumns,
    mergedAt: new Date().toISOString(),
    modeUsed: 'join',
    stats: {
      inputTables: tables.length,
      inputRows: tables.map((t) => t.rowCount || 0),
      outputRows: currentRows.length,
      relationsApplied
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function sanitizeColumns(cols: Column[]): Column[] {
  return cols
    .filter((c) => c.columnName && !c.columnName.startsWith('__EMPTY') && c.columnName.trim() !== '')
    .map((c) => ({
      ...c,
      columnName: c.columnName.trim()
    }));
}

function emptyResult(): MergeResult {
  return {
    mergedRows: [],
    mergedColumns: [],
    mergedAt: new Date().toISOString(),
    modeUsed: 'join',
    stats: { inputTables: 0, inputRows: [], outputRows: 0, relationsApplied: 0 }
  };
}

export function recomputeMerge(model: MultiTableDataSource): MultiTableDataSource {
  const result = mergeTablesWithRelations(model);
  return {
    ...model,
    mergedRows: result.mergedRows,
    mergedColumns: result.mergedColumns,
    lastMergedAt: result.mergedAt
  };
}

export function multiModelToDataSource(
  model: MultiTableDataSource,
  mergeResult?: MergeResult
) {
  const result = mergeResult || mergeTablesWithRelations(model);
  const cleanCols = sanitizeColumns(result.mergedColumns);

  return {
    id: `multi-ds-${Date.now()}`,
    workspaceId: 'ws-main',
    fileName: `نموذج مدمج (${model.tables.length} جداول)`,
    fileSizeBytes: 0,
    uploadedAt: new Date().toISOString(),
    sheets: model.tables.map((t) => ({
      id: t.id,
      name: t.name,
      rowCount: t.rowCount,
      columns: sanitizeColumns(t.columns || []),
      previewRows: t.rawRows?.slice(0, 50),
      rawRows: t.rawRows
    })),
    activeSheetId: model.tables[0]?.id || '',
    columns: cleanCols,
    rawRows: result.mergedRows
  };
}
