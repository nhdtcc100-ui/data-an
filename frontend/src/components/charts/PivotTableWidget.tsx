import React, { useState, useMemo } from 'react';
import {
  Filter,
  Columns,
  Rows,
  Calculator,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Download,
  Search,
  SlidersHorizontal,
  X,
  Plus,
  ArrowUpDown,
  Table as TableIcon,
  Check,
  Layers,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { WidgetConfig, AggregationType, PivotValueMetric } from '../../types/dashboard';
import { useDashboardStore } from '../../features/dashboard-builder/DashboardStore';

export interface PivotRowLegacy {
  groupKey: string;
  count: number;
  revenue: number;
  profit: number;
}

export interface PivotTableWidgetProps {
  widgetId?: string;
  config?: WidgetConfig;
  rows?: Record<string, any>[];
  columns?: Array<{ id: string; columnName: string; dataType: string }>;
  onUpdateConfig?: (configUpdates: Partial<WidgetConfig>) => void;

  // Legacy fallback props
  data?: PivotRowLegacy[];
  groupByColumn?: string;
  drillEnabled?: boolean;
  hasMoreLevels?: boolean;
  onGroupClick?: (groupKey: string) => void;
}

const AGG_LABELS: Record<AggregationType, string> = {
  SUM: 'مجموع (SUM)',
  COUNT: 'عدد (COUNT)',
  AVG: 'متوسط (AVG)',
  MAX: 'أقصى (MAX)',
  MIN: 'أدنى (MIN)'
};

const AGG_SHORT_LABELS: Record<AggregationType, string> = {
  SUM: 'مجموع',
  COUNT: 'عدد',
  AVG: 'معدل',
  MAX: 'أقصى',
  MIN: 'أدنى'
};

export const PivotTableWidget: React.FC<PivotTableWidgetProps> = ({
  widgetId: _widgetId,
  config,
  rows = [],
  columns = [],
  onUpdateConfig,
  data: legacyData,
  groupByColumn: legacyGroupByCol,
  drillEnabled,
  hasMoreLevels,
  onGroupClick
}) => {
  const { theme } = useDashboardStore();
  const isDark = theme === 'dark';

  // Toggle for Excel-style Field List Pane
  const [showFieldList, setShowFieldList] = useState(false);
  // Search within pivot rows
  const [searchQuery, setSearchQuery] = useState('');
  // Expanded hierarchical row keys: Set<string>
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(() => new Set(['__all__']));
  // Internal filter selections state (for zone 1: الفلاتر)
  const [localFilters, setLocalFilters] = useState<Record<string, string>>(() => config?.pivotFilterValues || {});

  // Extract or fallback 4 zones
  const filterCols = useMemo(() => {
    return config?.pivotFilterColumns || [];
  }, [config?.pivotFilterColumns]);

  const rowCols = useMemo(() => {
    if (config?.pivotRowColumns && config.pivotRowColumns.length > 0) {
      return config.pivotRowColumns;
    }
    if (config?.xAxisColumn) {
      return [config.xAxisColumn];
    }
    if (legacyGroupByCol) {
      return [legacyGroupByCol];
    }
    const firstCat = columns.find((c) => c.dataType === 'string' || c.dataType === 'date');
    return firstCat ? [firstCat.columnName] : columns.length > 0 ? [columns[0].columnName] : [];
  }, [config?.pivotRowColumns, config?.xAxisColumn, legacyGroupByCol, columns]);

  const colCols = useMemo(() => {
    if (config?.pivotColumnColumns && config.pivotColumnColumns.length > 0) {
      return config.pivotColumnColumns;
    }
    if (config?.legendColumn) {
      return [config.legendColumn];
    }
    return [];
  }, [config?.pivotColumnColumns, config?.legendColumn]);

  const valMetrics = useMemo<PivotValueMetric[]>(() => {
    if (config?.pivotValues && config.pivotValues.length > 0) {
      return config.pivotValues;
    }
    const metricCol = config?.yAxisColumn || columns.find((c) => c.dataType === 'numeric')?.columnName;
    if (metricCol) {
      return [
        {
          id: 'val_1',
          column: metricCol,
          aggregation: config?.aggregation || 'SUM',
          customLabel: `${AGG_SHORT_LABELS[config?.aggregation || 'SUM']} ${metricCol}`
        }
      ];
    }
    if (columns.length > 0) {
      return [
        {
          id: 'val_1',
          column: columns[0].columnName,
          aggregation: 'COUNT',
          customLabel: `عدد ${columns[0].columnName}`
        }
      ];
    }
    return [];
  }, [config?.pivotValues, config?.yAxisColumn, config?.aggregation, columns]);

  // Available unique values for each filter column
  const filterOptionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterCols.forEach((col) => {
      const unique = Array.from(new Set(rows.map((r) => String(r[col] ?? '')).filter((v) => v.trim() !== ''))).sort();
      map[col] = unique;
    });
    return map;
  }, [filterCols, rows]);

  // Step 1: Filter raw rows by the active Pivot Filters (Zone 1)
  const filteredDataset = useMemo(() => {
    if (!filterCols.length || Object.keys(localFilters).length === 0) {
      return rows;
    }
    return rows.filter((row) => {
      for (const col of filterCols) {
        const selectedVal = localFilters[col];
        if (selectedVal && selectedVal !== '__ALL__') {
          if (String(row[col] ?? '') !== selectedVal) {
            return false;
          }
        }
      }
      return true;
    });
  }, [rows, filterCols, localFilters]);

  // Helper aggregation calculator
  const aggregateValues = (items: Record<string, any>[], col: string, agg: AggregationType): number => {
    if (!items.length) return 0;
    if (agg === 'COUNT') return items.length;

    const numVals = items
      .map((item) => {
        const val = item[col];
        if (typeof val === 'number') return val;
        const parsed = parseFloat(String(val ?? ''));
        return isNaN(parsed) ? null : parsed;
      })
      .filter((v): v is number => v !== null);

    if (!numVals.length) return 0;

    switch (agg) {
      case 'SUM':
        return numVals.reduce((acc, v) => acc + v, 0);
      case 'AVG':
        return numVals.reduce((acc, v) => acc + v, 0) / numVals.length;
      case 'MAX':
        return Math.max(...numVals);
      case 'MIN':
        return Math.min(...numVals);
      default:
        return numVals.reduce((acc, v) => acc + v, 0);
    }
  };

  // Format cell value
  const formatCellValue = (num: number, agg: AggregationType) => {
    if (agg === 'COUNT') {
      return num.toLocaleString();
    }
    if (Math.abs(num) >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (agg === 'AVG') {
      return num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }
    return Number.isInteger(num) ? num.toLocaleString() : num.toFixed(2);
  };

  // Step 2: Extract distinct Column Dimensions (Zone 3)
  // If multiple or single colCols are present, build column hierarchy
  const colDimensionValues = useMemo(() => {
    if (!colCols.length) return [];
    const firstCol = colCols[0];
    const uniqueVals = Array.from(
      new Set(filteredDataset.map((r) => String(r[firstCol] ?? '')).filter((v) => v.trim() !== ''))
    ).sort();
    return uniqueVals.length ? uniqueVals : ['(فارغ)'];
  }, [colCols, filteredDataset]);

  // Step 3: Extract distinct Row Dimensions (Zone 2)
  interface PivotRowItem {
    key: string;
    level: number;
    parentKey?: string;
    label: string;
    valuesByCol: Record<string, Record<string, number>>; // colVal -> metricId -> number
    rowTotals: Record<string, number>; // metricId -> number
    children?: PivotRowItem[];
    matchingRows: Record<string, any>[];
  }

  const { flatRows, grandTotalsByCol, grandRowTotals } = useMemo(() => {
    if (!rowCols.length || !filteredDataset.length) {
      return {
        rowTree: [],
        flatRows: [],
        grandTotalsByCol: {},
        grandRowTotals: {}
      };
    }

    const firstRowCol = rowCols[0];
    const hasSecondLevel = rowCols.length > 1;
    const secondRowCol = hasSecondLevel ? rowCols[1] : null;

    // Group rows by first level
    const l1Map = new Map<string, Record<string, any>[]>();
    filteredDataset.forEach((r) => {
      const k = String(r[firstRowCol] ?? '(فارغ)');
      if (!l1Map.has(k)) l1Map.set(k, []);
      l1Map.get(k)!.push(r);
    });

    const tree: PivotRowItem[] = [];
    const flat: PivotRowItem[] = [];

    // Grand totals structure
    const gTotalsByCol: Record<string, Record<string, number>> = {};
    const gRowTotals: Record<string, number> = {};

    valMetrics.forEach((m) => {
      gRowTotals[m.id] = aggregateValues(filteredDataset, m.column, m.aggregation);
      if (colDimensionValues.length > 0) {
        colDimensionValues.forEach((cVal) => {
          if (!gTotalsByCol[cVal]) gTotalsByCol[cVal] = {};
          const cRows = filteredDataset.filter((r) => String(r[colCols[0]] ?? '(فارغ)') === cVal);
          gTotalsByCol[cVal][m.id] = aggregateValues(cRows, m.column, m.aggregation);
        });
      } else {
        if (!gTotalsByCol['__DEFAULT__']) gTotalsByCol['__DEFAULT__'] = {};
        gTotalsByCol['__DEFAULT__'][m.id] = gRowTotals[m.id];
      }
    });

    // Build L1 & optional L2
    Array.from(l1Map.keys())
      .sort()
      .forEach((l1Key) => {
        const l1Matching = l1Map.get(l1Key)!;

        // Compute L1 values
        const valuesByCol: Record<string, Record<string, number>> = {};
        const rowTotals: Record<string, number> = {};

        valMetrics.forEach((m) => {
          rowTotals[m.id] = aggregateValues(l1Matching, m.column, m.aggregation);
          if (colDimensionValues.length > 0) {
            colDimensionValues.forEach((cVal) => {
              if (!valuesByCol[cVal]) valuesByCol[cVal] = {};
              const cRows = l1Matching.filter((r) => String(r[colCols[0]] ?? '(فارغ)') === cVal);
              valuesByCol[cVal][m.id] = aggregateValues(cRows, m.column, m.aggregation);
            });
          } else {
            if (!valuesByCol['__DEFAULT__']) valuesByCol['__DEFAULT__'] = {};
            valuesByCol['__DEFAULT__'][m.id] = rowTotals[m.id];
          }
        });

        const l1Item: PivotRowItem = {
          key: l1Key,
          level: 0,
          label: l1Key,
          valuesByCol,
          rowTotals,
          matchingRows: l1Matching,
          children: []
        };

        if (hasSecondLevel && secondRowCol) {
          const l2Map = new Map<string, Record<string, any>[]>();
          l1Matching.forEach((r) => {
            const k2 = String(r[secondRowCol] ?? '(فارغ)');
            if (!l2Map.has(k2)) l2Map.set(k2, []);
            l2Map.get(k2)!.push(r);
          });

          Array.from(l2Map.keys())
            .sort()
            .forEach((l2Key) => {
              const l2Matching = l2Map.get(l2Key)!;
              const l2ValuesByCol: Record<string, Record<string, number>> = {};
              const l2RowTotals: Record<string, number> = {};

              valMetrics.forEach((m) => {
                l2RowTotals[m.id] = aggregateValues(l2Matching, m.column, m.aggregation);
                if (colDimensionValues.length > 0) {
                  colDimensionValues.forEach((cVal) => {
                    if (!l2ValuesByCol[cVal]) l2ValuesByCol[cVal] = {};
                    const cRows = l2Matching.filter((r) => String(r[colCols[0]] ?? '(فارغ)') === cVal);
                    l2ValuesByCol[cVal][m.id] = aggregateValues(cRows, m.column, m.aggregation);
                  });
                } else {
                  if (!l2ValuesByCol['__DEFAULT__']) l2ValuesByCol['__DEFAULT__'] = {};
                  l2ValuesByCol['__DEFAULT__'][m.id] = l2RowTotals[m.id];
                }
              });

              const l2Item: PivotRowItem = {
                key: `${l1Key}:::${l2Key}`,
                parentKey: l1Key,
                level: 1,
                label: l2Key,
                valuesByCol: l2ValuesByCol,
                rowTotals: l2RowTotals,
                matchingRows: l2Matching
              };
              l1Item.children!.push(l2Item);
            });
        }

        tree.push(l1Item);
        flat.push(l1Item);
        if (l1Item.children && (expandedRowKeys.has('__all__') || expandedRowKeys.has(l1Key))) {
          l1Item.children.forEach((c) => flat.push(c));
        }
      });

    return {
      rowTree: tree,
      flatRows: flat,
      grandTotalsByCol: gTotalsByCol,
      grandRowTotals: gRowTotals
    };
  }, [rowCols, colCols, valMetrics, colDimensionValues, filteredDataset, expandedRowKeys]);

  // Filter flatRows by search query if any
  const displayedRows = useMemo(() => {
    if (!searchQuery.trim()) return flatRows;
    const q = searchQuery.trim().toLowerCase();
    return flatRows.filter((r) => r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
  }, [flatRows, searchQuery]);

  // Toggle row expand / collapse
  const toggleRowExpand = (rowKey: string) => {
    setExpandedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  // Toggle expand all
  const toggleExpandAll = () => {
    if (expandedRowKeys.has('__all__')) {
      setExpandedRowKeys(new Set());
    } else {
      setExpandedRowKeys(new Set(['__all__']));
    }
  };

  // Export matrix to Excel
  const handleExportToExcel = () => {
    try {
      const exportData: any[] = [];

      displayedRows.forEach((row) => {
        const rowObj: Record<string, any> = {};
        // Row header indent
        rowObj['الصف'] = (row.level > 0 ? '   ↳ ' : '') + row.label;

        if (colDimensionValues.length > 0) {
          colDimensionValues.forEach((cVal) => {
            valMetrics.forEach((m) => {
              const colTitle = `${cVal} - ${m.customLabel || m.column}`;
              rowObj[colTitle] = row.valuesByCol[cVal]?.[m.id] ?? 0;
            });
          });
        } else {
          valMetrics.forEach((m) => {
            const colTitle = m.customLabel || m.column;
            rowObj[colTitle] = row.rowTotals[m.id] ?? 0;
          });
        }

        valMetrics.forEach((m) => {
          rowObj[`إجمالي - ${m.customLabel || m.column}`] = row.rowTotals[m.id] ?? 0;
        });

        exportData.push(rowObj);
      });

      // Add Grand Totals row
      const totalObj: Record<string, any> = { الصف: 'المجموع الإجمالي الكلي' };
      if (colDimensionValues.length > 0) {
        colDimensionValues.forEach((cVal) => {
          valMetrics.forEach((m) => {
            const colTitle = `${cVal} - ${m.customLabel || m.column}`;
            totalObj[colTitle] = grandTotalsByCol[cVal]?.[m.id] ?? 0;
          });
        });
      } else {
        valMetrics.forEach((m) => {
          const colTitle = m.customLabel || m.column;
          totalObj[colTitle] = grandRowTotals[m.id] ?? 0;
        });
      }
      valMetrics.forEach((m) => {
        totalObj[`إجمالي - ${m.customLabel || m.column}`] = grandRowTotals[m.id] ?? 0;
      });
      exportData.push(totalObj);

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pivot Table');
      XLSX.writeFile(wb, `PivotTable_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Failed to export Pivot Table to Excel:', err);
      alert('حدث خطأ أثناء تصدير الجدول إلى ملف Excel.');
    }
  };

  // Helper updates for 4 zones
  const updatePivotZones = (updates: Partial<WidgetConfig>) => {
    onUpdateConfig?.(updates);
  };

  // If using legacy data fallback (when no rows/columns are passed)
  if (!rows || rows.length === 0) {
    if (legacyData && legacyData.length > 0) {
      const totalRevenue = legacyData.reduce((acc, row) => acc + row.revenue, 0);
      const totalProfit = legacyData.reduce((acc, row) => acc + row.profit, 0);
      const totalCount = legacyData.reduce((acc, row) => acc + row.count, 0);

      return (
        <div className="flex flex-col h-full overflow-hidden select-none">
          <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className={`border-b ${isDark ? 'border-slate-800 bg-slate-900/90 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-700 font-bold'} sticky top-0 font-semibold`}>
                  <th className="p-2 flex items-center gap-1.5">
                    <span>{legacyGroupByCol || 'التصنيف'}</span>
                    {drillEnabled && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono">
                        <Layers className="w-2.5 h-2.5" />
                        <span>هرمي</span>
                      </span>
                    )}
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </th>
                  <th className="p-2 text-center">العمليات</th>
                  <th className="p-2 text-left">الإيرادات المجمعة</th>
                  <th className="p-2 text-left">هامش الأرباح</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/60 text-slate-200' : 'divide-slate-200 text-slate-800'} font-mono`}>
                {legacyData.map((row) => (
                  <tr key={row.groupKey} className={`${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors group`}>
                    <td
                      onClick={drillEnabled && hasMoreLevels ? () => onGroupClick?.(row.groupKey) : undefined}
                      className={`p-2 font-sans font-medium ${
                        drillEnabled && hasMoreLevels ? 'cursor-pointer hover:text-sky-400 text-sky-300' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span>{row.groupKey}</span>
                        {drillEnabled && hasMoreLevels && <ChevronLeft className="w-3 h-3 text-sky-400 shrink-0" />}
                      </div>
                    </td>
                    <td className="p-2 text-center">{row.count.toLocaleString()}</td>
                    <td className="p-2 text-left text-sky-400 font-bold">${row.revenue.toLocaleString()}</td>
                    <td className="p-2 text-left text-emerald-400 font-bold">${row.profit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`border-t-2 ${isDark ? 'border-slate-700 bg-slate-900/90 text-slate-100' : 'border-slate-300 bg-slate-100 text-slate-900'} font-bold font-mono`}>
                  <td className="p-2 font-sans">المجموع الإجمالي</td>
                  <td className="p-2 text-center">{totalCount.toLocaleString()}</td>
                  <td className="p-2 text-left text-sky-400">${totalRevenue.toLocaleString()}</td>
                  <td className="p-2 text-left text-emerald-400">${totalProfit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center text-slate-500">
        <TableIcon className="w-10 h-10 mb-2 opacity-40 text-sky-500" />
        <span className="text-xs font-bold text-slate-400 mb-1">الجدول المحوري جاهز</span>
        <span className="text-[11px] max-w-[240px]">اسحب أو اختر الحقول في مناطق الصفوف والأعمدة والقيم للبدء.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden select-none relative font-sans">
      {/* ── Toolbar: Filters (Zone 1) + Actions + Field List Button ── */}
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 border-b shrink-0 text-xs transition-colors ${
          isDark ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-slate-50/90 border-slate-200 text-slate-800'
        }`}
      >
        {/* Left side: Interactive Report Filters (Zone 1: الفلاتر) */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar flex-1 py-0.5">
          <div className="flex items-center gap-1 shrink-0 text-[11px] font-bold text-sky-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">الفلاتر:</span>
          </div>

          {filterCols.length === 0 ? (
            <span className="text-[10px] text-slate-400 italic">لا توجد فلاتر تقرير (أضف من قائمة الحقول)</span>
          ) : (
            filterCols.map((col) => {
              const currentVal = localFilters[col] || '__ALL__';
              const opts = filterOptionsMap[col] || [];
              return (
                <div key={col} className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-0.5 shrink-0 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{col}:</span>
                  <select
                    value={currentVal}
                    onChange={(e) => {
                      const next = { ...localFilters, [col]: e.target.value };
                      setLocalFilters(next);
                      updatePivotZones({ pivotFilterValues: next });
                    }}
                    className="bg-transparent text-[11px] font-bold text-sky-600 dark:text-sky-400 outline-none cursor-pointer pr-1"
                  >
                    <option value="__ALL__">(الكل)</option>
                    {opts.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {currentVal !== '__ALL__' && (
                    <button
                      onClick={() => {
                        const next = { ...localFilters, [col]: '__ALL__' };
                        setLocalFilters(next);
                        updatePivotZones({ pivotFilterValues: next });
                      }}
                      className="text-slate-400 hover:text-rose-500 transition cursor-pointer p-0.5"
                      title="إلغاء التصفية"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right side: Search, Export, Toggle Fields Panel */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Search */}
          <div className="relative hidden md:block max-w-[130px]">
            <Search className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الصفوف..."
              className={`w-full text-[10px] pr-6 pl-2 py-1 rounded-lg border outline-none ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
              }`}
            />
          </div>

          {/* Expand/Collapse All (if hierarchical) */}
          {rowCols.length > 1 && (
            <button
              onClick={toggleExpandAll}
              className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="طي / توسيع كافة الصفوف الهرمية"
            >
              <Layers className="w-3 h-3 text-sky-500" />
              <span className="hidden sm:inline">{expandedRowKeys.has('__all__') ? 'طي الكل' : 'توسيع الكل'}</span>
            </button>
          )}

          {/* Export to Excel Button */}
          <button
            onClick={handleExportToExcel}
            className={`p-1 sm:px-2 sm:py-1 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${
              isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-emerald-400' : 'bg-white border-slate-200 hover:bg-emerald-50 text-emerald-600'
            }`}
            title="تصدير جدول Pivot Table إلى ملف Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          {/* Toggle Field List Button */}
          <button
            onClick={() => setShowFieldList(!showFieldList)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
              showFieldList
                ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                : isDark
                ? 'bg-slate-900 border-slate-800 text-sky-400 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-sky-600 hover:bg-sky-50 shadow-xs'
            }`}
            title="فتح/إغلاق قائمة حقول Pivot Table (الصفوف، الأعمدة، الفلاتر، القيم)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>حقول الجدول</span>
          </button>
        </div>
      </div>

      {/* ── Main Pivot Body with Cross-Tabulation Matrix ── */}
      <div className="flex-1 overflow-auto custom-scrollbar relative flex">
        <table className="w-full text-right border-collapse text-xs select-text">
          {/* ── Multi-Tier Headers (الأعمدة + القيم) ── */}
          <thead className="sticky top-0 z-20 shadow-xs">
            {/* Row 1: Column dimension group headers */}
            {colDimensionValues.length > 0 && (
              <tr className={`border-b text-[11px] ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>
                {/* Top-left corner for Row dimension title */}
                <th
                  rowSpan={valMetrics.length > 1 ? 1 : 2}
                  className={`p-2.5 font-bold border-l ${isDark ? 'border-slate-800' : 'border-slate-300'} sticky right-0 z-20 ${
                    isDark ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
                  }`}
                  style={{ minWidth: rowCols.length > 1 ? 180 : 140 }}
                >
                  <div className="flex items-center gap-1.5">
                    <Rows className="w-3.5 h-3.5 text-amber-500" />
                    <span>{rowCols.join(' ‹ ')}</span>
                  </div>
                </th>

                {/* Column dimensions */}
                {colDimensionValues.map((cVal) => (
                  <th
                    key={cVal}
                    colSpan={valMetrics.length}
                    className={`p-2 text-center font-extrabold border-l ${
                      isDark ? 'border-slate-800 text-sky-400' : 'border-slate-300 text-sky-700'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Columns className="w-3 h-3 opacity-60" />
                      <span>{cVal}</span>
                    </div>
                  </th>
                ))}

                {/* Row Totals Column Header */}
                <th
                  colSpan={valMetrics.length}
                  className={`p-2 text-center font-extrabold ${
                    isDark ? 'bg-slate-950 text-emerald-400 border-slate-800' : 'bg-slate-200 text-emerald-800 border-slate-300'
                  }`}
                >
                  إجمالي الصفوف
                </th>
              </tr>
            )}

            {/* Row 2: Value metric subheaders under columns (or primary header if no column dimension) */}
            <tr className={`border-b text-[11px] font-semibold ${isDark ? 'bg-slate-900/95 border-slate-800 text-slate-400' : 'bg-slate-100/95 border-slate-300 text-slate-600'}`}>
              {/* Corner cell if no column dimension */}
              {colDimensionValues.length === 0 && (
                <th
                  className={`p-2.5 font-bold border-l ${isDark ? 'border-slate-800' : 'border-slate-300'} sticky right-0 z-20 ${
                    isDark ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
                  }`}
                  style={{ minWidth: 160 }}
                >
                  <div className="flex items-center gap-1.5">
                    <Rows className="w-3.5 h-3.5 text-amber-500" />
                    <span>{rowCols.join(' ‹ ')}</span>
                  </div>
                </th>
              )}

              {/* Value metric headers under each column */}
              {colDimensionValues.length > 0 ? (
                <>
                  {colDimensionValues.map((cVal) =>
                    valMetrics.map((m) => (
                      <th
                        key={`${cVal}:::${m.id}`}
                        className={`p-1.5 text-left border-l font-mono text-[10px] ${
                          isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'
                        }`}
                        style={{ minWidth: 90 }}
                      >
                        {m.customLabel || `${AGG_SHORT_LABELS[m.aggregation]} ${m.column}`}
                      </th>
                    ))
                  )}
                  {/* Under Row Totals */}
                  {valMetrics.map((m) => (
                    <th
                      key={`total:::${m.id}`}
                      className={`p-1.5 text-left font-mono text-[10px] ${
                        isDark ? 'bg-slate-950 text-emerald-300' : 'bg-slate-200 text-emerald-900'
                      }`}
                      style={{ minWidth: 95 }}
                    >
                      {m.customLabel || `${AGG_SHORT_LABELS[m.aggregation]} ${m.column}`}
                    </th>
                  ))}
                </>
              ) : (
                <>
                  {valMetrics.map((m) => (
                    <th
                      key={m.id}
                      className={`p-2 text-left border-l font-mono ${
                        isDark ? 'border-slate-800 text-slate-300' : 'border-slate-300 text-slate-700'
                      }`}
                      style={{ minWidth: 110 }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>{m.customLabel || m.column}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/10 text-sky-500 font-sans">
                          {AGG_SHORT_LABELS[m.aggregation]}
                        </span>
                      </div>
                    </th>
                  ))}
                </>
              )}
            </tr>
          </thead>

          {/* ── Table Body Rows (الصفوف) ── */}
          <tbody className={`divide-y font-mono ${isDark ? 'divide-slate-800/60 text-slate-200' : 'divide-slate-100 text-slate-800'}`}>
            {displayedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={colDimensionValues.length * valMetrics.length + valMetrics.length + 1}
                  className="p-8 text-center text-slate-400 font-sans"
                >
                  لا توجد سجلات تطابق الفلاتر المحددة حالياً.
                </td>
              </tr>
            ) : (
              displayedRows.map((row) => {
                const isL1 = row.level === 0;
                const hasChildren = (row.children?.length || 0) > 0;
                const isExpanded = expandedRowKeys.has('__all__') || expandedRowKeys.has(row.key);

                return (
                  <tr
                    key={row.key}
                    className={`transition-colors group ${
                      isL1
                        ? isDark
                          ? 'bg-slate-900/40 hover:bg-slate-800/60 font-semibold'
                          : 'bg-white hover:bg-slate-50 font-semibold'
                        : isDark
                        ? 'bg-slate-950/40 hover:bg-slate-900/60 text-slate-300 text-[11px]'
                        : 'bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 text-[11px]'
                    }`}
                  >
                    {/* Row header label */}
                    <td
                      className={`p-2 border-l sticky right-0 z-10 transition-colors font-sans ${
                        isDark
                          ? isL1
                            ? 'bg-slate-900/90 text-slate-100 border-slate-800 group-hover:bg-slate-850'
                            : 'bg-slate-950/90 text-slate-300 border-slate-850 group-hover:bg-slate-900'
                          : isL1
                          ? 'bg-white text-slate-900 border-slate-200 group-hover:bg-slate-100'
                          : 'bg-slate-50 text-slate-700 border-slate-200 group-hover:bg-slate-150'
                      }`}
                    >
                      <div
                        className="flex items-center gap-1.5"
                        style={{ paddingRight: row.level > 0 ? `${row.level * 18}px` : 0 }}
                      >
                        {hasChildren ? (
                          <button
                            onClick={() => toggleRowExpand(row.key)}
                            className="p-0.5 rounded hover:bg-sky-500/20 text-sky-500 transition cursor-pointer shrink-0"
                            title={isExpanded ? 'طي الفئة' : 'توسيع الفئة'}
                          >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        ) : row.level > 0 ? (
                          <span className="w-3.5 text-center text-slate-400 text-[10px]">↳</span>
                        ) : (
                          <span className="w-3.5" />
                        )}
                        <span className="truncate">{row.label}</span>
                      </div>
                    </td>

                    {/* Matrix Cells by Column Dimension */}
                    {colDimensionValues.length > 0 ? (
                      <>
                        {colDimensionValues.map((cVal) =>
                          valMetrics.map((m) => {
                            const val = row.valuesByCol[cVal]?.[m.id] ?? 0;
                            return (
                              <td
                                key={`${cVal}:::${m.id}`}
                                className={`p-1.5 text-left border-l ${
                                  isDark ? 'border-slate-800/60' : 'border-slate-100'
                                }`}
                              >
                                {val !== 0 ? (
                                  <span className={val < 0 ? 'text-rose-500 font-bold' : ''}>
                                    {formatCellValue(val, m.aggregation)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400/50">-</span>
                                )}
                              </td>
                            );
                          })
                        )}

                        {/* Row Total Cells */}
                        {valMetrics.map((m) => {
                          const rTotal = row.rowTotals[m.id] ?? 0;
                          return (
                            <td
                              key={`rtotal:::${m.id}`}
                              className={`p-1.5 text-left font-bold ${
                                isDark ? 'bg-slate-900/60 text-sky-400' : 'bg-slate-100/70 text-sky-700'
                              }`}
                            >
                              {formatCellValue(rTotal, m.aggregation)}
                            </td>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        {valMetrics.map((m) => {
                          const val = row.rowTotals[m.id] ?? 0;
                          return (
                            <td
                              key={m.id}
                              className={`p-2 text-left border-l font-bold text-sky-500 dark:text-sky-400 ${
                                isDark ? 'border-slate-800/60' : 'border-slate-200'
                              }`}
                            >
                              {formatCellValue(val, m.aggregation)}
                            </td>
                          );
                        })}
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>

          {/* ── Table Footer: Grand Totals (المجموع الإجمالي الكلي) ── */}
          <tfoot className="sticky bottom-0 z-20 shadow-md">
            <tr
              className={`border-t-2 font-bold font-mono ${
                isDark ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-300 bg-slate-100 text-slate-900'
              }`}
            >
              {/* Grand Total Label */}
              <td
                className={`p-2.5 font-sans border-l sticky right-0 z-20 ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>المجموع الإجمالي</span>
                </div>
              </td>

              {/* Column Grand Totals */}
              {colDimensionValues.length > 0 ? (
                <>
                  {colDimensionValues.map((cVal) =>
                    valMetrics.map((m) => {
                      const totalVal = grandTotalsByCol[cVal]?.[m.id] ?? 0;
                      return (
                        <td
                          key={`gtotal:::${cVal}:::${m.id}`}
                          className={`p-2 text-left border-l text-sky-500 dark:text-sky-400 ${
                            isDark ? 'border-slate-800' : 'border-slate-300'
                          }`}
                        >
                          {formatCellValue(totalVal, m.aggregation)}
                        </td>
                      );
                    })
                  )}

                  {/* Absolute Grand Total (Total of Totals) */}
                  {valMetrics.map((m) => {
                    const grandTotal = grandRowTotals[m.id] ?? 0;
                    return (
                      <td
                        key={`grandtotal:::${m.id}`}
                        className={`p-2 text-left font-black text-emerald-600 dark:text-emerald-400 ${
                          isDark ? 'bg-slate-950' : 'bg-slate-200'
                        }`}
                      >
                        {formatCellValue(grandTotal, m.aggregation)}
                      </td>
                    );
                  })}
                </>
              ) : (
                <>
                  {valMetrics.map((m) => {
                    const grandTotal = grandRowTotals[m.id] ?? 0;
                    return (
                      <td
                        key={`grandtotal:::${m.id}`}
                        className="p-2 text-left border-l font-black text-emerald-600 dark:text-emerald-400"
                      >
                        {formatCellValue(grandTotal, m.aggregation)}
                      </td>
                    );
                  })}
                </>
              )}
            </tr>
          </tfoot>
        </table>

        {/* ── Floating Excel/Power BI Field List Pane (4 Zones) ── */}
        {showFieldList && (
          <div
            className={`absolute top-0 left-0 bottom-0 z-30 w-80 md:w-96 shadow-2xl border-r flex flex-col animate-in slide-in-from-left duration-200 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            {/* Header */}
            <div className={`p-3 border-b flex items-center justify-between ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-500" />
                <span className="font-extrabold text-sm">حقول الجدول المحوري (Pivot Fields)</span>
              </div>
              <button
                onClick={() => setShowFieldList(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
              {/* Top: Available Fields to Pick */}
              <div>
                <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
                  الحقول المتاحة من جدول البيانات (انقر للإضافة):
                </span>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  {columns.map((c) => {
                    const isUsed =
                      rowCols.includes(c.columnName) ||
                      colCols.includes(c.columnName) ||
                      filterCols.includes(c.columnName) ||
                      valMetrics.some((v) => v.column === c.columnName);

                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          // Quick add: numeric goes to Values, categorical goes to Rows
                          if (c.dataType === 'numeric') {
                            const nextVals = [
                              ...valMetrics,
                              {
                                id: `val_${Date.now()}`,
                                column: c.columnName,
                                aggregation: 'SUM' as AggregationType,
                                customLabel: `مجموع ${c.columnName}`
                              }
                            ];
                            updatePivotZones({ pivotValues: nextVals });
                          } else {
                            if (!rowCols.includes(c.columnName)) {
                              updatePivotZones({ pivotRowColumns: [...rowCols, c.columnName] });
                            }
                          }
                        }}
                        className={`flex items-center justify-between p-1.5 rounded border text-[10px] cursor-pointer transition ${
                          isUsed
                            ? 'bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-300 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-400'
                        }`}
                      >
                        <span className="truncate">{c.columnName}</span>
                        {isUsed ? (
                          <Check className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : (
                          <Plus className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── THE 4 EXCEL & POWER BI ZONES (2x2 Grid) ── */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                {/* 1. الفلاتر (Filters Zone) */}
                <div className="p-2.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[11px] text-sky-600 dark:text-sky-400 flex items-center gap-1">
                      <Filter className="w-3 h-3" />
                      <span>الفلاتر (Filters)</span>
                    </span>
                    <span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400">
                      {filterCols.length}
                    </span>
                  </div>
                  <div className="space-y-1 flex-1 min-h-[50px]">
                    {filterCols.map((c) => (
                      <div
                        key={c}
                        className="flex items-center justify-between px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px]"
                      >
                        <span className="truncate font-medium">{c}</span>
                        <button
                          onClick={() => updatePivotZones({ pivotFilterColumns: filterCols.filter((x) => x !== c) })}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Add to filters dropdown */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        updatePivotZones({ pivotFilterColumns: [...filterCols, e.target.value] });
                      }
                    }}
                    className="mt-1.5 w-full text-[10px] p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer outline-none"
                  >
                    <option value="">+ إضافة فلتر</option>
                    {columns
                      .filter((c) => !filterCols.includes(c.columnName))
                      .map((c) => (
                        <option key={c.id} value={c.columnName}>
                          {c.columnName}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 2. الأعمدة (Columns Zone) */}
                <div className="p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Columns className="w-3 h-3" />
                      <span>الأعمدة (Columns)</span>
                    </span>
                    <span className="text-[9px] px-1 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                      {colCols.length}
                    </span>
                  </div>
                  <div className="space-y-1 flex-1 min-h-[50px]">
                    {colCols.map((c) => (
                      <div
                        key={c}
                        className="flex items-center justify-between px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px]"
                      >
                        <span className="truncate font-medium">{c}</span>
                        <button
                          onClick={() => updatePivotZones({ pivotColumnColumns: colCols.filter((x) => x !== c) })}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Add to columns dropdown */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        updatePivotZones({ pivotColumnColumns: [...colCols, e.target.value] });
                      }
                    }}
                    className="mt-1.5 w-full text-[10px] p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer outline-none"
                  >
                    <option value="">+ إضافة عمود</option>
                    {columns
                      .filter((c) => !colCols.includes(c.columnName))
                      .map((c) => (
                        <option key={c.id} value={c.columnName}>
                          {c.columnName}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 3. الصفوف (Rows Zone) */}
                <div className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Rows className="w-3 h-3" />
                      <span>الصفوف (Rows)</span>
                    </span>
                    <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      {rowCols.length}
                    </span>
                  </div>
                  <div className="space-y-1 flex-1 min-h-[50px]">
                    {rowCols.map((c, idx) => (
                      <div
                        key={c}
                        className="flex items-center justify-between px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px]"
                      >
                        <span className="truncate font-medium">
                          {idx + 1}. {c}
                        </span>
                        <button
                          onClick={() => updatePivotZones({ pivotRowColumns: rowCols.filter((x) => x !== c) })}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Add to rows dropdown */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        updatePivotZones({ pivotRowColumns: [...rowCols, e.target.value] });
                      }
                    }}
                    className="mt-1.5 w-full text-[10px] p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer outline-none"
                  >
                    <option value="">+ إضافة صف</option>
                    {columns
                      .filter((c) => !rowCols.includes(c.columnName))
                      .map((c) => (
                        <option key={c.id} value={c.columnName}>
                          {c.columnName}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 4. القيم (Values Zone) */}
                <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Calculator className="w-3 h-3" />
                      <span>القيم (Values)</span>
                    </span>
                    <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      {valMetrics.length}
                    </span>
                  </div>
                  <div className="space-y-1.5 flex-1 min-h-[50px]">
                    {valMetrics.map((m) => (
                      <div
                        key={m.id}
                        className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate font-bold text-emerald-600 dark:text-emerald-400">{m.column}</span>
                          <button
                            onClick={() => updatePivotZones({ pivotValues: valMetrics.filter((x) => x.id !== m.id) })}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <select
                          value={m.aggregation}
                          onChange={(e) => {
                            const next = valMetrics.map((x) =>
                              x.id === m.id ? { ...x, aggregation: e.target.value as AggregationType } : x
                            );
                            updatePivotZones({ pivotValues: next });
                          }}
                          className="w-full text-[9px] p-0.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer font-bold"
                        >
                          {Object.entries(AGG_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  {/* Add to values dropdown */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const next = [
                          ...valMetrics,
                          {
                            id: `val_${Date.now()}`,
                            column: e.target.value,
                            aggregation: 'SUM' as AggregationType,
                            customLabel: `مجموع ${e.target.value}`
                          }
                        ];
                        updatePivotZones({ pivotValues: next });
                      }
                    }}
                    className="mt-1.5 w-full text-[10px] p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer outline-none"
                  >
                    <option value="">+ إضافة قيمة حسابية</option>
                    {columns.map((c) => (
                      <option key={c.id} value={c.columnName}>
                        {c.columnName} ({c.dataType === 'numeric' ? 'رقم' : 'نص'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
