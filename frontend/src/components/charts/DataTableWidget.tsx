import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Columns,
  Building2,
  Package,
  ShieldCheck,
  Percent,
  Clock,
  Tag
} from 'lucide-react';
import type { WidgetConfig } from '../../types/dashboard';
import { getMotionTheme, type MotionThemeId } from '../../services/motionThemes';
import { useDashboardStore, sanitizeMojibakeString } from '../../features/dashboard-builder/DashboardStore';

/** Generate a stable composite row key across all table widgets */
export const getTableRowKey = (row: Record<string, any>, fallbackIndex?: number): string => {
  if (!row) return String(fallbackIndex ?? Math.random());
  if (row.id !== undefined && row.id !== null && String(row.id).trim() !== '') return String(row.id);
  if (row._id !== undefined && row._id !== null && String(row._id).trim() !== '') return String(row._id);
  const company = String(row['اسم الشركة'] || '').trim();
  const code = String(row['كود المنتج / الموديل'] || '').trim();
  const name = String(row['اسم المنتج'] || row['اسم المنتج والوصف'] || row['الوصف'] || '').trim();
  const price = String(row['السعر المفرد'] || row['سعر المفرد'] || '').trim();
  const composite = [company, code, name, price].filter(Boolean).join(':::');
  if (composite) {
    return fallbackIndex !== undefined ? `${composite}:::${fallbackIndex}` : composite;
  }
  // Generic fallback for any arbitrary dataset (HR, sales, custom sheets)
  const firstVals = Object.values(row).slice(0, 3).map((v) => String(v ?? '')).filter(Boolean).join(':::');
  if (firstVals) {
    return fallbackIndex !== undefined ? `${firstVals}:::${fallbackIndex}` : firstVals;
  }
  return fallbackIndex !== undefined ? `row-${fallbackIndex}` : Math.random().toString(36).substring(2, 9);
};

interface DataTableWidgetProps {
  rows: Record<string, any>[];
  columns: string[];
  config?: WidgetConfig;
  activeFilters?: Record<string, any>;
  onFilterRemove?: (column: string) => void;
  onCellClick?: (column: string, value: string) => void;
  selectedRowKey?: string | null;
  onRowClick?: (rowKey: string, rowData: Record<string, any>) => void;
  motionTheme?: MotionThemeId | string;
}

export const DataTableWidget: React.FC<DataTableWidgetProps> = ({
  rows,
  columns,
  config,
  activeFilters,
  onFilterRemove: _onFilterRemove,
  onCellClick,
  selectedRowKey,
  onRowClick,
  motionTheme
}) => {
  const { theme } = useDashboardStore();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(config?.tablePageSize || 8);

  // Helper to extract value considering common Arabic naming variations
  const getCellData = (row: Record<string, any>, col: string) => {
    if (!row) return '';
    if (row[col] !== undefined && row[col] !== null) return row[col];
    if (col === 'الوصف') return row['اسم المنتج والوصف'] ?? row['اسم المنتج'] ?? '';
    if (col === 'السعر المفرد') return row['سعر المفرد'] ?? row['السعر الإجمالي'] ?? '';
    if (col === 'سعر المفرد') return row['السعر المفرد'] ?? row['السعر الإجمالي'] ?? '';
    if (col === 'اسم المنتج') return row['اسم المنتج والوصف'] ?? '';
    if (col === 'اسم المنتج والوصف') {
      return row['اسم المنتج والوصف'] || row['اسم المنتج'] || row['الوصف'] || '';
    }
    if (col === 'الخصم') return row['الخصم'] ?? 0;
    if (col === 'الضمان' || col === 'الظمان') return row['الضمان'] ?? row['الظمان'] ?? '';
    if (col === 'مدة العرض') return row['مدة العرض'] ?? '';
    if (col === 'العرض') return row['العرض'] ?? '';
    return '';
  };

  // Filter rows based on search query across all active columns
  const searchedRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const query = searchQuery.toLowerCase().trim();
    return rows.filter((row) =>
      columns.some((col) => {
        const val = getCellData(row, col);
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      })
    );
  }, [rows, columns, searchQuery]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortColumn) return searchedRows;
    return [...searchedRows].sort((a, b) => {
      const valA = getCellData(a, sortColumn);
      const valB = getCellData(b, sortColumn);

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const numA = typeof valA === 'number' ? valA : parseFloat(String(valA));
      const numB = typeof valB === 'number' ? valB : parseFloat(String(valB));

      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (sortDirection === 'asc') {
        return strA.localeCompare(strB, 'ar');
      } else {
        return strB.localeCompare(strA, 'ar');
      }
    });
  }, [searchedRows, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, validPage, pageSize]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  // Check if a column is numeric to align and calculate sum
  const isNumericColumn = (col: string) => {
    const nonNullValues = rows.map((r) => getCellData(r, col)).filter((v) => v !== null && v !== undefined && v !== '');
    if (nonNullValues.length === 0) return false;
    return nonNullValues.slice(0, 20).every((v) => typeof v === 'number' || !isNaN(parseFloat(String(v))));
  };

  // Render combined product name and description (Dual-line rich cell)
  const renderProductAndDescCell = (row: Record<string, any>) => {
    const pName = String(row['اسم المنتج'] || '').trim();
    const pDesc = String(row['الوصف'] || '').trim();
    const combined = String(row['اسم المنتج والوصف'] || '').trim();

    let title = pName;
    let subtitle = pDesc;

    if (!title && combined) {
      if (combined.includes(' - ')) {
        const parts = combined.split(' - ');
        title = parts[0].trim();
        subtitle = parts.slice(1).join(' - ').trim();
      } else {
        title = combined;
      }
    } else if (title && !subtitle && combined && combined !== title) {
      subtitle = combined;
    }

    if (!title && !subtitle) {
      title = '-';
    }

    return (
      <div className="flex flex-col py-1 text-right max-w-[240px] sm:max-w-[340px]">
        <div className={`flex items-center gap-1.5 font-bold text-[11px] sm:text-xs leading-tight ${isDark ? 'text-slate-100' : 'text-slate-950 font-black'}`}>
          <Package className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate" title={sanitizeMojibakeString(title)}>{sanitizeMojibakeString(title)}</span>
        </div>
        {subtitle && subtitle !== title && (
          <span
            className={`text-[10px] truncate leading-tight mt-0.5 pr-5 ${isDark ? 'text-slate-400' : 'text-slate-700 font-semibold'}`}
            title={sanitizeMojibakeString(subtitle)}
          >
            {sanitizeMojibakeString(subtitle)}
          </span>
        )}
      </div>
    );
  };

  // Format cell value with rich UI badges
  const formatCell = (val: any, col: string, row: Record<string, any>) => {
    if (col === 'اسم المنتج والوصف') {
      return renderProductAndDescCell(row);
    }

    if (col === 'اسم الشركة') {
      return (
        <div className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
          <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate max-w-[150px]" title={String(val)}>{String(val || '-')}</span>
        </div>
      );
    }

    if (col === 'الخصم') {
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (!isNaN(num) && num > 0) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Percent className="w-2.5 h-2.5" />
            <span>%{num}</span>
          </span>
        );
      }
      return <span className="text-slate-500 text-[10px]">بدون خصم</span>;
    }

    if (col === 'الضمان' || col === 'الظمان') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{String(val || 'بدون ضمان')}</span>
        </span>
      );
    }

    if (col === 'العرض') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
          <Tag className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
          <span>{String(val || 'عادي')}</span>
        </span>
      );
    }

    if (col === 'مدة العرض') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 font-medium">
          <Clock className="w-3 h-3 text-amber-400 shrink-0" />
          <span>{String(val || '-')}</span>
        </span>
      );
    }

    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-600">-</span>;
    }

    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (!isNaN(num)) {
      if (col.includes('سعر') || col.includes('السعر') || col.includes('إيراد') || col.includes('أرباح')) {
        return `${num.toLocaleString()} د.ع`;
      }
      if (typeof val === 'number') {
        return num.toLocaleString();
      }
    }
    return String(val);
  };

  // Compute totals for numeric columns
  const columnSums = useMemo(() => {
    const sums: Record<string, number | null> = {};
    columns.forEach((col) => {
      if (isNumericColumn(col)) {
        const sum = rows.reduce((acc, row) => {
          const val = getCellData(row, col);
          const n = typeof val === 'number' ? val : parseFloat(String(val));
          return acc + (!isNaN(n) ? n : 0);
        }, 0);
        sums[col] = Math.round(sum * 100) / 100;
      } else {
        sums[col] = null;
      }
    });
    return sums;
  }, [rows, columns]);

  // ─── Styling derived from config & Motion Theme ────────────────────────────
  const activeMotionTheme = getMotionTheme(motionTheme);
  const tTheme = activeMotionTheme.tableTheme;
  const DARK_MOTION_THEMES = [
    'skeuomorphism',
    'neumorphism',
    'glassmorphism',
    'claymorphism',
    'minimalism',
    'maximalism',
    'brutalism',
    'liquid-glass',
    'bento-grid',
    'spatial-ui',
    'cyber-neon',
    'matrix-holo'
  ];
  const isDarkCard = isDark || DARK_MOTION_THEMES.includes(activeMotionTheme.id);

  const density = config?.tableDensity || 'comfortable';
  const cellPadding = density === 'compact' ? 'p-1' : density === 'spacious' ? 'p-3 sm:p-4' : 'p-1.5 sm:p-2';
  const headerBg = config?.tableHeaderBg || undefined;
  const headerColor = config?.tableHeaderColor || undefined;
  const zebraOn = config?.tableZebra !== false; // default ON
  const highlightMax = config?.tableHighlightMax === true;
  const borderStyle = config?.tableBorderStyle || 'horizontal';
  const borderClass = borderStyle === 'grid'
    ? 'border border-slate-800/60'
    : borderStyle === 'none'
    ? ''
    : 'border-b border-slate-800/50';

  // Compute column max values for highlight
  const columnMaxes = useMemo(() => {
    const maxes: Record<string, number> = {};
    if (!highlightMax) return maxes;
    columns.forEach((col) => {
      if (isNumericColumn(col)) {
        const vals = rows.map((r) => {
          const v = r[col];
          return typeof v === 'number' ? v : parseFloat(String(v));
        }).filter((v) => !isNaN(v));
        maxes[col] = vals.length > 0 ? Math.max(...vals) : NaN;
      }
    });
    return maxes;
  }, [rows, columns, highlightMax]);

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-500">
        <Columns className="w-10 h-10 text-slate-600 mb-2 opacity-50" />
        <h4 className="text-xs font-bold text-slate-300 mb-1">لم يتم تحديد أي عمود للعرض</h4>
        <p className="text-[11px] max-w-[280px]">
          اختر الأعمدة المراد عرضها من تبويب إعداد البيانات (Setup) في القائمة الجانبية.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden select-none text-xs">
      {/* Table Toolbar */}
      <div className={`flex items-center justify-between gap-2 px-2 py-1.5 border-b text-[11px] ${
        isDarkCard ? 'border-slate-800/80 bg-slate-950/40 text-white' : 'border-slate-200 bg-slate-100/70 text-slate-900'
      }`}>
        <div className="relative flex-1 max-w-[220px]">
          <Search className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="بحث في الجدول..."
            className={`w-full text-[10px] rounded-lg pr-7 pl-2 py-1 focus:outline-none focus:border-sky-500 transition-colors ${
              isDarkCard ? 'bg-slate-900 border border-slate-800 text-white placeholder:text-slate-400' : 'bg-white border border-slate-300 text-slate-950 font-bold placeholder:text-slate-400 shadow-xs'
            }`}
          />
        </div>

        <div className={`flex items-center gap-2 text-[10px] ${isDarkCard ? 'text-white font-medium' : 'text-slate-900 font-bold'}`}>
          <span>
            {sortedRows.length.toLocaleString()} سجل
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className={`rounded px-1.5 py-0.5 outline-none focus:border-sky-500 cursor-pointer ${
              isDarkCard ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-950 font-bold shadow-xs'
            }`}
          >
            <option value={5}>5 أسطر</option>
            <option value={8}>8 أسطر</option>
            <option value={15}>15 سطر</option>
            <option value={30}>30 سطر</option>
          </select>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
        <table className="w-full text-right border-collapse" style={{ fontSize: 'clamp(8.5px, 2.2vw, 12px)' }}>
          <thead>
            <tr
              className="border-b sticky top-0 font-semibold z-10 backdrop-blur-md transition-colors"
              style={{
                backgroundColor: headerBg || (isDarkCard ? tTheme.headerBg : '#f1f5f9'),
                color: headerColor || (isDarkCard ? '#ffffff' : '#090d16'),
                borderColor: isDarkCard ? tTheme.headerBorderColor : '#cbd5e1'
              }}
            >
              <th className={`${cellPadding} w-8 sm:w-10 text-center font-mono text-[9px] sm:text-[10px] ${isDarkCard ? 'text-slate-300 font-semibold' : 'text-slate-900 font-bold'}`}>#</th>
              {columns.map((col) => {
                const isNum = isNumericColumn(col);
                const isSorted = sortColumn === col;
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`${cellPadding} transition-colors cursor-pointer hover:opacity-80 select-none whitespace-nowrap ${
                      isNum ? 'text-left' : 'text-right'
                    } ${isSorted ? 'text-sky-400 font-bold' : isDarkCard ? 'text-white font-bold' : 'text-slate-950 font-black'}`}
                    style={{ color: headerColor || (isSorted ? tTheme.selectedBorder : isDarkCard ? '#ffffff' : '#090d16') }}
                  >
                    <div className={`inline-flex items-center gap-1 ${isNum ? 'flex-row-reverse' : ''}`}>
                      <span className={isDarkCard ? 'text-white font-bold' : 'text-slate-950 font-black'}>{sanitizeMojibakeString(col)}</span>
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3 shrink-0" style={{ color: tTheme.selectedBorder }} />
                        ) : (
                          <ArrowDown className="w-3 h-3 shrink-0" style={{ color: tTheme.selectedBorder }} />
                        )
                      ) : (
                        <ArrowUpDown className={`w-2.5 h-2.5 shrink-0 opacity-50 ${isDark ? 'text-slate-600' : 'text-slate-800'}`} />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className={isDark ? 'text-slate-200' : 'text-slate-950 font-medium'}>
            {paginatedRows.map((row, idx) => {
              const rowIndex = (validPage - 1) * pageSize + idx + 1;
              const isEvenRow = idx % 2 === 0;
              const rowKey = getTableRowKey(row, rowIndex);
              const isSelected = Boolean(selectedRowKey && selectedRowKey === rowKey);

              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick?.(rowKey, row)}
                  className={`transition-all duration-200 cursor-pointer group ${borderClass} ${
                    isSelected
                      ? 'border-r-4 font-medium shadow-md'
                      : zebraOn && !isEvenRow
                      ? 'bg-slate-900/40 hover:bg-white/5'
                      : 'hover:bg-white/5'
                  }`}
                  style={
                    isSelected
                      ? {
                          background: tTheme.selectedRowBg,
                          borderRightColor: tTheme.selectedBorder,
                          boxShadow: `0 0 16px ${tTheme.selectedBorder}22`
                        }
                      : undefined
                  }
                >
                  <td className={`${cellPadding} text-center font-mono text-[9px] sm:text-[10px]`}>
                    {isSelected ? (
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white font-bold text-[9px] animate-pulse"
                        style={{
                          backgroundColor: tTheme.selectedBorder,
                          boxShadow: `0 0 10px ${tTheme.selectedBorder}`
                        }}
                      >
                        ✓
                      </span>
                    ) : (
                      <span className="text-slate-600 group-hover:text-slate-400 transition-colors">
                        {rowIndex}
                      </span>
                    )}
                  </td>
                  {columns.map((col) => {
                    const isNum = isNumericColumn(col);
                    const cellVal = getCellData(row, col);
                    const numVal = typeof cellVal === 'number' ? cellVal : parseFloat(String(cellVal));
                    const isMax = highlightMax && isNum && !isNaN(numVal) && columnMaxes[col] === numVal;
                    const isFilterActive = Boolean(
                      activeFilters &&
                      String(activeFilters[col] ?? '') === String(cellVal ?? '')
                    );

                    return (
                      <td
                        key={col}
                        onClick={(e) => {
                          if (onCellClick) {
                            e.stopPropagation();
                            onCellClick(col, String(cellVal ?? ''));
                          }
                        }}
                        className={`${cellPadding} ${
                          col === 'اسم المنتج والوصف' ? 'min-w-[180px]' : 'truncate max-w-[140px] sm:max-w-[220px]'
                        } font-sans transition-colors ${
                          isNum
                            ? isDark
                              ? 'text-left font-mono text-slate-100 font-medium'
                              : 'text-left font-mono text-slate-950 font-bold'
                            : isDark
                            ? 'text-slate-300'
                            : 'text-slate-950 font-semibold'
                        } ${
                          isFilterActive
                            ? 'bg-sky-500/20 text-sky-300 font-semibold'
                            : onCellClick
                            ? isDark ? 'cursor-pointer hover:text-sky-300 hover:bg-sky-500/10' : 'cursor-pointer hover:text-sky-700 hover:bg-sky-100'
                            : ''
                        } ${isSelected ? (isDark ? 'text-white' : 'text-slate-950 font-black') : ''}`}
                        title={onCellClick ? `انقر لتصفية اللوحة بالكامل حسب: ${cellVal}` : undefined}
                      >
                        {isMax ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-emerald-300 font-bold">{formatCell(cellVal, col, row)}</span>
                          </span>
                        ) : (
                          formatCell(cellVal, col, row)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {paginatedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-8 text-center text-slate-500">
                  لا توجد نتائج مطابقة للبحث أو الفلتر النشط
                </td>
              </tr>
            )}
          </tbody>

          {/* Totals Summary Footer */}
          {rows.length > 0 && Object.values(columnSums).some((v) => v !== null) && (
            <tfoot>
              <tr
                className={`border-t-2 sticky bottom-0 z-10 backdrop-blur-md ${
                  isDarkCard ? 'font-bold text-white' : 'font-black text-slate-950'
                }`}
                style={{
                  backgroundColor: isDarkCard ? tTheme.headerBg : '#f1f5f9',
                  borderColor: isDarkCard ? tTheme.headerBorderColor : '#cbd5e1'
                }}
              >
                <td className={`p-2 text-center text-[10px] font-mono ${isDarkCard ? 'text-slate-400' : 'text-slate-900 font-bold'}`}>Σ</td>
                {columns.map((col, idx) => {
                  const sum = columnSums[col];
                  if (idx === 0 && sum === null) {
                    return (
                      <td key={col} className={`p-2 font-sans ${isDarkCard ? 'text-white font-bold' : 'text-slate-950 font-bold'}`}>
                        الإجمالي العام
                      </td>
                    );
                  }
                  return (
                    <td
                      key={col}
                      className={`p-2 font-mono ${
                        sum !== null
                          ? isDarkCard ? 'text-left font-bold text-white' : 'text-left font-black text-slate-950'
                          : isDarkCard ? 'text-right text-slate-400' : 'text-right text-slate-700 font-semibold'
                      }`}
                      style={{ color: sum !== null ? (isDarkCard ? (tTheme.numHighlightColor || '#38bdf8') : '#090d16') : undefined }}
                    >
                      {sum !== null ? (
                        config?.numberFormat === 'currency' ? (
                          `${sum.toLocaleString()} د.ع`
                        ) : (
                          sum.toLocaleString()
                        )
                      ) : (
                        ''
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-between px-2.5 py-1.5 border-t text-[10px] ${
          isDarkCard
            ? 'border-slate-800 bg-slate-950/70 text-white'
            : 'border-slate-200 bg-slate-100/90 text-slate-800 font-semibold'
        }`}>
          <span className={isDarkCard ? 'text-white' : 'text-slate-900 font-bold'}>
            صفحة {validPage} من {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validPage === 1}
              className={`p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed transition ${
                isDarkCard
                  ? 'hover:bg-slate-800 text-white hover:text-sky-300'
                  : 'hover:bg-slate-200 text-slate-800 hover:text-slate-950'
              }`}
              title="الصفحة السابقة"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validPage === totalPages}
              className={`p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed transition ${
                isDarkCard
                  ? 'hover:bg-slate-800 text-white hover:text-sky-300'
                  : 'hover:bg-slate-200 text-slate-800 hover:text-slate-950'
              }`}
              title="الصفحة التالية"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
