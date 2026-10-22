// ==============================================================================
// In-Memory OLAP Analytics Calculation Engine
// Provides dynamic aggregation (SUM, AVG, COUNT, MIN, MAX), Filtering, Grouping & Sorting
// ==============================================================================

import type { AggregationType, Widget } from '../types/dashboard';

export interface AggregationResult {
  categories: string[];
  values: number[];
  counts: number[];
  percentages: number[];
  totalValue: number;
}

/**
 * Filters the raw dataset according to all active slicer/cross-filter conditions
 */
export function filterRows(
  rows: Record<string, any>[],
  activeFilters: Record<string, any>
): Record<string, any>[] {
  if (!rows || rows.length === 0) return [];
  const filterEntries = Object.entries(activeFilters);
  if (filterEntries.length === 0) return rows;

  return rows.filter((row) => {
    for (const [column, filterVal] of filterEntries) {
      if (filterVal === null || filterVal === undefined || filterVal === 'الكل' || filterVal === '') {
        continue;
      }
      const rowVal = String(row[column] ?? '');
      if (Array.isArray(filterVal)) {
        if (!filterVal.includes(rowVal)) return false;
      } else {
        if (rowVal !== String(filterVal)) return false;
      }
    }
    return true;
  });
}

/**
 * Extracts unique distinct values for a given column (used for Slicers & Filters)
 */
export function getUniqueValues(rows: Record<string, any>[], column: string): string[] {
  if (!rows || rows.length === 0 || !column) return [];
  const set = new Set<string>();
  for (const row of rows) {
    if (row[column] !== undefined && row[column] !== null) {
      set.add(String(row[column]));
    }
  }
  return Array.from(set).sort();
}

/**
 * Computes grouped aggregation (Group By xAxisColumn, Aggregate yAxisColumn)
 */
export function aggregateGroupData(
  rows: Record<string, any>[],
  xAxisColumn: string,
  yAxisColumn: string,
  aggregation: AggregationType = 'SUM',
  sortOrder: 'asc' | 'desc' | 'none' = 'desc',
  topN?: number
): AggregationResult {
  if (!rows || rows.length === 0 || !xAxisColumn) {
    return { categories: [], values: [], counts: [], percentages: [], totalValue: 0 };
  }

  const groups: Record<string, number[]> = {};

  for (const row of rows) {
    const rawCategory = row[xAxisColumn];
    const category = rawCategory !== undefined && rawCategory !== null ? String(rawCategory) : '(غير محدد)';

    const rawVal = row[yAxisColumn];
    let numVal = 0;
    if (typeof rawVal === 'number') {
      numVal = rawVal;
    } else if (typeof rawVal === 'string') {
      const parsed = parseFloat(rawVal.replace(/[^0-9.-]+/g, ''));
      numVal = isNaN(parsed) ? 0 : parsed;
    }

    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(numVal);
  }

  // Calculate aggregated value for each category
  const entries: { category: string; value: number; count: number }[] = [];

  for (const [category, valuesList] of Object.entries(groups)) {
    const count = valuesList.length;
    let val = 0;

    switch (aggregation) {
      case 'SUM':
        val = valuesList.reduce((acc, v) => acc + v, 0);
        break;
      case 'AVG':
        val = count > 0 ? valuesList.reduce((acc, v) => acc + v, 0) / count : 0;
        break;
      case 'COUNT':
        val = count;
        break;
      case 'MIN':
        val = Math.min(...valuesList);
        break;
      case 'MAX':
        val = Math.max(...valuesList);
        break;
    }

    entries.push({
      category,
      value: Math.round(val * 100) / 100,
      count
    });
  }

  // Sorting
  if (sortOrder === 'desc') {
    entries.sort((a, b) => b.value - a.value);
  } else if (sortOrder === 'asc') {
    entries.sort((a, b) => a.value - b.value);
  }

  // Top N limit
  const finalEntries = topN && topN > 0 ? entries.slice(0, topN) : entries;

  const totalValue = finalEntries.reduce((acc, e) => acc + e.value, 0);
  const categories = finalEntries.map((e) => e.category);
  const values = finalEntries.map((e) => e.value);
  const counts = finalEntries.map((e) => e.count);
  const percentages = finalEntries.map((e) =>
    totalValue > 0 ? Math.round((e.value / totalValue) * 1000) / 10 : 0
  );

  return { categories, values, counts, percentages, totalValue };
}

/**
 * Calculates a single KPI metric over the filtered dataset
 */
export function calculateKpi(
  rows: Record<string, any>[],
  yAxisColumn?: string,
  aggregation: AggregationType = 'SUM'
): { value: number; count: number } {
  if (!rows || rows.length === 0) return { value: 0, count: 0 };
  if (!yAxisColumn) return { value: rows.length, count: rows.length };

  const valuesList: number[] = [];
  for (const row of rows) {
    const rawVal = row[yAxisColumn];
    let numVal = 0;
    if (typeof rawVal === 'number') {
      numVal = rawVal;
    } else if (typeof rawVal === 'string') {
      const parsed = parseFloat(rawVal.replace(/[^0-9.-]+/g, ''));
      numVal = isNaN(parsed) ? 0 : parsed;
    }
    valuesList.push(numVal);
  }

  let value = 0;
  switch (aggregation) {
    case 'SUM':
      value = valuesList.reduce((a, b) => a + b, 0);
      break;
    case 'AVG':
      value = valuesList.length > 0 ? valuesList.reduce((a, b) => a + b, 0) / valuesList.length : 0;
      break;
    case 'COUNT':
      value = valuesList.length;
      break;
    case 'MIN':
      value = Math.min(...valuesList);
      break;
    case 'MAX':
      value = Math.max(...valuesList);
      break;
  }

  return { value: Math.round(value * 100) / 100, count: rows.length };
}

/**
 * Computes 2D numerical points for Scatter Plots (Correlation between two numeric columns)
 */
export function calculateScatter(
  rows: Record<string, any>[],
  xColumn: string,
  yColumn: string
): { data: [number, number][]; labels: string[] } {
  if (!rows || rows.length === 0) return { data: [], labels: [] };
  const data: [number, number][] = [];
  const labels: string[] = [];

  for (const row of rows) {
    const x = typeof row[xColumn] === 'number' ? row[xColumn] : parseFloat(row[xColumn]);
    const y = typeof row[yColumn] === 'number' ? row[yColumn] : parseFloat(row[yColumn]);
    if (!isNaN(x) && !isNaN(y)) {
      data.push([x, y]);
      labels.push(String(row['المنتج'] || row['الفرع'] || row['المنطقة'] || ''));
    }
  }
  return { data, labels };
}

/**
 * Computes Radar data comparing multiple metrics for top categories
 */
export function calculateRadar(
  rows: Record<string, any>[],
  categoryCol: string,
  metrics: string[]
): { indicators: { name: string; max: number }[]; series: { name: string; value: number[] }[] } {
  if (!rows || rows.length === 0 || !categoryCol || metrics.length === 0) {
    return { indicators: [], series: [] };
  }

  const topCats = getUniqueValues(rows, categoryCol).slice(0, 3);
  const maxValues: Record<string, number> = {};

  for (const m of metrics) {
    let max = 100;
    for (const row of rows) {
      const val = typeof row[m] === 'number' ? row[m] : parseFloat(row[m]) || 0;
      if (val > max) max = val;
    }
    maxValues[m] = Math.ceil(max * 1.15);
  }

  const indicators = metrics.map((m) => ({ name: m, max: maxValues[m] || 100 }));

  const series = topCats.map((cat) => {
    const catRows = rows.filter((r) => String(r[categoryCol]) === cat);
    const value = metrics.map((m) => {
      const sum = catRows.reduce((acc, r) => acc + (typeof r[m] === 'number' ? r[m] : parseFloat(r[m]) || 0), 0);
      return catRows.length > 0 ? Math.round(sum / catRows.length) : 0;
    });
    return { name: cat, value };
  });

  return { indicators, series };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drill-Down Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface DrillPathEntry {
  column: string;
  value: string;
}

/**
 * Filters rows through a drill-down path then aggregates by the current level column.
 * This is the core engine for hierarchical chart navigation.
 *
 * @param rows        - Full (already cross-filter-applied) row set
 * @param drillPath   - Array of {column, value} pairs representing the navigation trail
 * @param currentCol  - The column to Group By at the current drill level
 * @param yCol        - The numeric column to aggregate
 * @param aggregation - SUM | AVG | COUNT | MIN | MAX
 * @param sortOrder   - 'desc' | 'asc' | 'none'
 * @param topN        - Optional limit on number of groups
 */
export function computeDrillLevel(
  rows: Record<string, any>[],
  drillPath: DrillPathEntry[],
  currentCol: string,
  yCol: string,
  aggregation: AggregationType = 'SUM',
  sortOrder: 'asc' | 'desc' | 'none' = 'desc',
  topN?: number
): AggregationResult {
  // Apply the drill-down path filters first
  let drillRows = rows;
  for (const step of drillPath) {
    drillRows = drillRows.filter(
      (r) => String(r[step.column] ?? '') === step.value
    );
  }
  // Now aggregate by the current level column
  return aggregateGroupData(drillRows, currentCol, yCol, aggregation, sortOrder, topN);
}

/**
 * Returns raw rows filtered by a full drill-down path (used at leaf level for detail table)
 */
export function getDrillLeafRows(
  rows: Record<string, any>[],
  drillPath: DrillPathEntry[]
): Record<string, any>[] {
  let drillRows = rows;
  for (const step of drillPath) {
    drillRows = drillRows.filter(
      (r) => String(r[step.column] ?? '') === step.value
    );
  }
  return drillRows;
}

/**
 * Checks whether a source widget is configured to send cross-filtering to a target widget.
 */
export function isWidgetLinkedToTarget(sourceWidget: Widget, targetWidgetId: string): boolean {
  if (sourceWidget.id === targetWidgetId) return true;
  const mode = sourceWidget.config?.crossFilterMode || 'all';
  if (mode === 'none') return false;
  if (mode === 'custom') {
    return (sourceWidget.config?.linkedWidgetIds || []).includes(targetWidgetId);
  }
  // mode is 'all'
  if (sourceWidget.config?.linkedWidgetIds !== undefined) {
    return sourceWidget.config.linkedWidgetIds.includes(targetWidgetId);
  }
  return true;
}

/**
 * Checks whether a target widget accepts incoming filters from a source widget.
 */
export function isWidgetListeningToSource(targetWidget: Widget, sourceWidgetId: string): boolean {
  if (targetWidget.id === sourceWidgetId) return true;
  if (targetWidget.config?.ignoreIncomingFilters) return false;
  if (targetWidget.config?.allowedIncomingWidgetIds !== undefined) {
    return targetWidget.config.allowedIncomingWidgetIds.includes(sourceWidgetId);
  }
  return true;
}

/**
 * Calculates the effective active filters for a specific target widget based on all widget cross-filtering links.
 *
 * @param options.excludeSelf  When true, skips applying the target widget's own widgetFilters slot.
 *   Use this when you want only the cross-filters coming FROM linked charts, not the widget's own drill-down filters.
 *   The widget's drill-down path is applied separately via computeDrillLevel.
 */
export function getEffectiveFiltersForWidget(
  targetWidget: Widget,
  allWidgets: Widget[],
  widgetFilters: Record<string, Record<string, any>> = {},
  fallbackActiveFilters: Record<string, any> = {},
  options: { excludeSelf?: boolean } = {}
): Record<string, any> {
  // If target explicitly ignores all incoming filters (isolated visual)
  if (targetWidget.config?.ignoreIncomingFilters) {
    return {};
  }

  const effective: Record<string, any> = {};

  // 1. Process filters originated from specific widgets
  const sourceIds = Object.keys(widgetFilters);
  if (sourceIds.length > 0) {
    for (const sourceId of sourceIds) {
      const filters = widgetFilters[sourceId];
      if (!filters || Object.keys(filters).length === 0) continue;

      if (sourceId === targetWidget.id) {
        // When excludeSelf is set, skip applying the widget's own drill-down filters here.
        // They will be applied separately via computeDrillLevel / drillPath.
        if (options.excludeSelf) continue;
        if (targetWidget.type === 'slicer') {
          Object.assign(effective, filters);
        }
        continue;
      }

      const sourceWidget = allWidgets.find((w) => w.id === sourceId);
      if (!sourceWidget) {
        Object.assign(effective, filters);
        continue;
      }

      const isSourceLinked = isWidgetLinkedToTarget(sourceWidget, targetWidget.id);
      const isTargetListening = isWidgetListeningToSource(targetWidget, sourceId);

      if (isSourceLinked && isTargetListening) {
        Object.assign(effective, filters);
      }
    }
  }

  // 2. Also merge any fallback activeFilters for columns not already handled
  for (const [col, val] of Object.entries(fallbackActiveFilters)) {
    if (val !== undefined && val !== null && val !== '' && val !== 'الكل') {
      if (effective[col] === undefined) {
        effective[col] = val;
      }
    }
  }

  return effective;
}

/**
 * Computes 2D matrix data for Heatmap (xCategory x yCategory -> aggregated value)
 */
export function calculateHeatmap(
  rows: Record<string, any>[],
  xCol: string,
  yCol: string,
  valCol: string,
  agg: AggregationType = 'SUM'
): { xCategories: string[]; yCategories: string[]; data: [number, number, number][]; minVal: number; maxVal: number } {
  if (!rows || rows.length === 0 || !xCol || !yCol) {
    return { xCategories: [], yCategories: [], data: [], minVal: 0, maxVal: 0 };
  }

  const xCats = getUniqueValues(rows, xCol);
  const yCats = getUniqueValues(rows, yCol);

  const matrix: Record<string, Record<string, number[]>> = {};
  for (const r of rows) {
    const xKey = String(r[xCol] ?? '');
    const yKey = String(r[yCol] ?? '');
    const v = typeof r[valCol] === 'number' ? r[valCol] : parseFloat(r[valCol]) || 0;
    if (!matrix[xKey]) matrix[xKey] = {};
    if (!matrix[xKey][yKey]) matrix[xKey][yKey] = [];
    matrix[xKey][yKey].push(v);
  }

  const data: [number, number, number][] = [];
  let minVal = Infinity;
  let maxVal = -Infinity;

  xCats.forEach((x, xIdx) => {
    yCats.forEach((y, yIdx) => {
      const vals = matrix[x]?.[y] || [];
      let val = 0;
      if (vals.length > 0) {
        if (agg === 'SUM') val = vals.reduce((a, b) => a + b, 0);
        else if (agg === 'AVG') val = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        else if (agg === 'COUNT') val = vals.length;
        else if (agg === 'MIN') val = Math.min(...vals);
        else if (agg === 'MAX') val = Math.max(...vals);
      }
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
      data.push([xIdx, yIdx, val]);
    });
  });

  if (minVal === Infinity) minVal = 0;
  if (maxVal === -Infinity) maxVal = 0;

  return { xCategories: xCats, yCategories: yCats, data, minVal, maxVal };
}

