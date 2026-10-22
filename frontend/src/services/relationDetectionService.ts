// ==============================================================================
// relationDetectionService.ts
// كشف العلاقات التلقائي بين الجداول (مثل Power BI Auto-Detect)
// الخوارزمية: مطابقة الاسم + تشابه القيم (Set Intersection)
// ==============================================================================

import type { TableEntry, TableRelation } from '../types/dataSource';

const TABLE_COLORS = [
  '#38bdf8', '#818cf8', '#34d399', '#fb923c',
  '#f472b6', '#a3e635', '#fbbf24', '#c084fc'
];

export function assignTableColors(tables: TableEntry[]): TableEntry[] {
  return tables.map((t, i) => ({
    ...t,
    color: t.color || TABLE_COLORS[i % TABLE_COLORS.length]
  }));
}

/**
 * حساب نسبة التشابه بين اسمَي عمودين (fuzzy string match)
 */
function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[\s_\-\.]/g, '')
      .replace(/id$/i, '')
      .replace(/^id/i, '');
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  // Levenshtein distance approximation
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  if (longer.length === 0) return 1.0;
  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * حساب نسبة تقاطع القيم بين عمودين (Value Overlap)
 */
function valueOverlap(
  leftRows: Record<string, any>[],
  leftCol: string,
  rightRows: Record<string, any>[],
  rightCol: string
): number {
  const sampleSize = 50;
  const leftSample = leftRows.slice(0, sampleSize);
  const rightSample = rightRows.slice(0, sampleSize);

  const leftSet = new Set(leftSample.map((r) => String(r[leftCol] ?? '')).filter(Boolean));
  const rightSet = new Set(rightSample.map((r) => String(r[rightCol] ?? '')).filter(Boolean));

  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let overlap = 0;
  leftSet.forEach((v) => { if (rightSet.has(v)) overlap++; });

  return overlap / Math.max(leftSet.size, rightSet.size);
}

/**
 * الدالة الرئيسية: كشف العلاقات بين مجموعة جداول
 */
export function detectRelations(tables: TableEntry[]): TableRelation[] {
  const relations: TableRelation[] = [];

  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const leftTable = tables[i];
      const rightTable = tables[j];

      let bestRelation: TableRelation | null = null;
      let bestScore = 0;

      for (const leftCol of leftTable.columns) {
        for (const rightCol of rightTable.columns) {
          const nameSim = nameSimilarity(leftCol.columnName, rightCol.columnName);
          if (nameSim < 0.6) continue;

          const valOverlap = valueOverlap(
            leftTable.rawRows,
            leftCol.columnName,
            rightTable.rawRows,
            rightCol.columnName
          );

          // الثقة النهائية: 60% من تشابه الاسم + 40% من تطابق القيم
          const confidence = nameSim * 0.6 + valOverlap * 0.4;
          if (confidence > bestScore && confidence > 0.35) {
            bestScore = confidence;
            bestRelation = {
              id: `rel-${leftTable.id}-${rightTable.id}-${Date.now()}`,
              leftTableId: leftTable.id,
              rightTableId: rightTable.id,
              leftColumn: leftCol.columnName,
              rightColumn: rightCol.columnName,
              joinType: 'left',
              confidence: Math.round(confidence * 100) / 100,
              isAutoDetected: true
            };
          }
        }
      }

      if (bestRelation) {
        relations.push(bestRelation);
      }
    }
  }

  // ترتيب حسب الثقة تنازلياً
  return relations.sort((a, b) => b.confidence - a.confidence);
}

/**
 * تحويل DataSource الحالي إلى TableEntry
 */
export function dataSourceToTableEntry(
  ds: { id: string; fileName?: string; columns: any[]; rawRows: any[] },
  name?: string
): TableEntry {
  return {
    id: ds.id || `table-${Date.now()}`,
    name: name || ds.fileName || 'جدول رئيسي',
    sourceType: 'file',
    fileName: ds.fileName,
    columns: ds.columns || [],
    rawRows: ds.rawRows || [],
    rowCount: ds.rawRows?.length || 0,
    uploadedAt: new Date().toISOString()
  };
}
