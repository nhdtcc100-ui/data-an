import React, { useState, useMemo } from 'react';
import {
  Filter,
  Check,
  RotateCcw,
  Plus,
  X,
  Search,
  Layers,
  Building2,
  MapPin,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  CheckSquare,
  Square
} from 'lucide-react';
import { useDashboardStore } from '../../features/dashboard-builder/DashboardStore';
import { getUniqueValues } from '../../services/dataEngine';

interface SlicerWidgetProps {
  columnName?: string;
  options?: string[];
  widgetId?: string;
  slicerColumns?: string[];
  activeColumn?: string;
  availableColumns?: string[];
  rawRows?: Record<string, any>[];
  onUpdateColumns?: (columns: string[], activeColumn?: string) => void;
  onSelectActiveColumn?: (column: string) => void;
  selectionMode?: 'single' | 'multi';
  onChangeSelectionMode?: (mode: 'single' | 'multi') => void;
}

export const SlicerWidget: React.FC<SlicerWidgetProps> = ({
  widgetId,
  columnName = 'المنطقة',
  options: initialOptions,
  slicerColumns,
  activeColumn,
  availableColumns = [],
  rawRows = [],
  onUpdateColumns,
  onSelectActiveColumn,
  selectionMode = 'single',
  onChangeSelectionMode
}) => {
  const { activeFilters, setFilter, clearFilter } = useDashboardStore();

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Slicer columns list (fallback to [columnName] if not provided)
  const columnsList = useMemo(() => {
    if (slicerColumns && slicerColumns.length > 0) return slicerColumns;
    return [columnName];
  }, [slicerColumns, columnName]);

  // Current active column
  const currentCol = activeColumn && columnsList.includes(activeColumn)
    ? activeColumn
    : columnsList[0] || columnName;

  // Compute unique values for the currently active column
  const currentOptions = useMemo(() => {
    if (rawRows && rawRows.length > 0) {
      return getUniqueValues(rawRows, currentCol);
    }
    return initialOptions || [];
  }, [rawRows, currentCol, initialOptions]);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return currentOptions;
    return currentOptions.filter((opt) =>
      String(opt).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [currentOptions, searchQuery]);

  const rawFilterVal = activeFilters[currentCol];

  // Normalize current selection to array
  const currentSelected: string[] = useMemo(() => {
    if (rawFilterVal === null || rawFilterVal === undefined || rawFilterVal === '') return [];
    if (Array.isArray(rawFilterVal)) return rawFilterVal.map(String);
    return [String(rawFilterVal)];
  }, [rawFilterVal]);

  // Other columns available in dataset not yet in this slicer
  const unselectedAvailableCols = useMemo(() => {
    return availableColumns.filter((c) => !columnsList.includes(c));
  }, [availableColumns, columnsList]);

  // Active filters across any column in this slicer
  const activeSlicerFilters = useMemo(() => {
    const list: { column: string; value: any; isArray: boolean }[] = [];
    for (const col of columnsList) {
      const val = activeFilters[col];
      if (val !== undefined && val !== null && val !== '') {
        const isArr = Array.isArray(val);
        if (isArr && val.length > 0) {
          list.push({ column: col, value: val, isArray: true });
        } else if (!isArr) {
          list.push({ column: col, value: val, isArray: false });
        }
      }
    }
    return list;
  }, [columnsList, activeFilters]);

  // Handlers
  const handleSelectColumn = (col: string) => {
    if (onSelectActiveColumn) {
      onSelectActiveColumn(col);
    }
    setSearchQuery('');
  };

  const handleAddColumn = (col: string) => {
    const next = [...columnsList, col];
    if (onUpdateColumns) {
      onUpdateColumns(next, col);
    }
    setIsAddMenuOpen(false);
    setSearchQuery('');
  };

  const handleRemoveColumn = (colToRemove: string) => {
    if (columnsList.length <= 1) return;
    const next = columnsList.filter((c) => c !== colToRemove);
    const nextActive = currentCol === colToRemove ? next[0] : currentCol;
    if (onUpdateColumns) {
      onUpdateColumns(next, nextActive);
    }
    // Also clear filter on the removed column
    clearFilter(colToRemove, widgetId);
  };

  const handleToggleValue = (opt: string) => {
    if (selectionMode === 'single') {
      // Single mode: toggle single value
      const isSelected = currentSelected.includes(opt);
      setFilter(currentCol, isSelected ? null : opt, widgetId);
    } else {
      // Multi mode: toggle in array
      const isSelected = currentSelected.includes(opt);
      if (isSelected) {
        const next = currentSelected.filter((v) => v !== opt);
        setFilter(currentCol, next.length === 0 ? null : next, widgetId);
      } else {
        const next = [...currentSelected, opt];
        setFilter(currentCol, next, widgetId);
      }
    }
  };

  const handleSelectAll = () => {
    if (selectionMode === 'multi') {
      // If all filtered options are selected, deselect all; else select all
      const allSelected = filteredOptions.every((o) => currentSelected.includes(String(o)));
      if (allSelected) {
        clearFilter(currentCol, widgetId);
      } else {
        setFilter(currentCol, filteredOptions.map(String), widgetId);
      }
    } else {
      clearFilter(currentCol, widgetId);
    }
  };

  const allFilteredSelected = filteredOptions.length > 0 && filteredOptions.every((o) => currentSelected.includes(String(o)));

  return (
    <div className="flex flex-col h-full p-2.5 select-none relative">
      {/* 1. Header: Slicer Title + Mode Toggle + Quick Clear */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded bg-sky-500/10 text-sky-400 shrink-0">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-200 truncate">
            تصفية ({columnsList.length} أعمدة)
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Multi/Single Toggle */}
          <button
            onClick={() => {
              const next = selectionMode === 'single' ? 'multi' : 'single';
              if (onChangeSelectionMode) onChangeSelectionMode(next);
              // Clear existing filters when switching mode
              columnsList.forEach((col) => clearFilter(col, widgetId));
            }}
            title={selectionMode === 'multi' ? 'الوضع الحالي: تعدد الاختيار — انقر للتبديل لاختيار واحد' : 'الوضع الحالي: اختيار واحد — انقر للتبديل لتعدد الاختيار'}
            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              selectionMode === 'multi'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-white hover:bg-slate-700'
            }`}
          >
            {selectionMode === 'multi'
              ? <ToggleRight className="w-3 h-3" />
              : <ToggleLeft className="w-3 h-3" />
            }
            <span>{selectionMode === 'multi' ? 'متعدد' : 'فردي'}</span>
          </button>

          {/* Clear Filter Button */}
          {activeSlicerFilters.length > 0 && (
            <button
              onClick={() => {
                activeSlicerFilters.forEach((f) => clearFilter(f.column, widgetId));
              }}
              title="مسح كافة فلاتر هذا السلايسر"
              className="text-[10px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/20 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>مسح ({activeSlicerFilters.reduce((acc, f) => acc + (f.isArray ? (f.value as string[]).length : 1), 0)})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Column Selection Bar (Pills / Tabs & Add Button) */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 custom-scrollbar shrink-0">
        {/* Quick Dropdown for Narrow Viewports */}
        <div className="flex sm:hidden items-center gap-1 w-full mb-1">
          <span className="text-[10px] text-slate-400">العمود:</span>
          <select
            value={currentCol}
            onChange={(e) => handleSelectColumn(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 text-sky-400 font-bold text-xs rounded px-2 py-1 outline-none"
          >
            {columnsList.map((col) => (
              <option key={col} value={col}>
                {col} {activeFilters[col] ? `(مفلتر)` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Column Pills on larger view */}
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
          {columnsList.map((col) => {
            const isActive = currentCol === col;
            const filterVal = activeFilters[col];
            const hasFilter = Array.isArray(filterVal)
              ? filterVal.length > 0
              : (filterVal !== undefined && filterVal !== null && filterVal !== '');
            const filterCount = Array.isArray(filterVal) ? filterVal.length : (hasFilter ? 1 : 0);

            const getColIcon = () => {
              const iconClass = `w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : ''}`;
              if (col.includes('شركة')) return <Building2 className={`${iconClass} ${!isActive ? 'text-sky-400' : ''}`} />;
              if (col.includes('موقع') || col.includes('الموقع')) return <MapPin className={`${iconClass} ${!isActive ? 'text-emerald-400' : ''}`} />;
              if (col.includes('قسم') || col.includes('القسم')) return <Layers className={`${iconClass} ${!isActive ? 'text-purple-400' : ''}`} />;
              if (col.includes('حالة') || col.includes('الحالة')) return <CheckCircle2 className={`${iconClass} ${!isActive ? 'text-amber-400' : ''}`} />;
              return <Layers className={`${iconClass} opacity-70`} />;
            };

            return (
              <div
                key={col}
                className={`inline-flex items-center rounded-lg text-xs font-semibold transition-all border shadow-sm ${
                  isActive
                    ? 'bg-sky-500 text-white border-sky-400 font-bold shadow-md shadow-sky-500/20'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700/80 hover:bg-slate-750 hover:text-white'
                }`}
              >
                <button
                  onClick={() => handleSelectColumn(col)}
                  className="px-2.5 py-1 flex items-center gap-1.5 cursor-pointer"
                >
                  {getColIcon()}
                  <span>{col}</span>
                  {hasFilter && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                        isActive ? 'bg-white/25 text-white' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                      title={`مفلتر بـ ${filterCount} قيمة`}
                    >
                      {filterCount}
                    </span>
                  )}
                </button>

                {/* Remove column button (if more than 1 column) */}
                {columnsList.length > 1 && onUpdateColumns && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveColumn(col);
                    }}
                    title={`إزالة عمود ${col} من هذا الفلتر`}
                    className={`p-1 rounded-l-lg hover:text-rose-300 transition-colors cursor-pointer ${
                      isActive ? 'hover:bg-sky-600' : 'hover:bg-slate-700'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Column Button */}
          {unselectedAvailableCols.length > 0 && onUpdateColumns && (
            <div className="relative">
              <button
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                title="إضافة عمود آخر لهذا الفلتر"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-sky-500/20 text-sky-400 border border-slate-700/80 hover:border-sky-500/50 text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>إضافة عمود</span>
              </button>

              {/* Add Column Dropdown */}
              {isAddMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full right-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 animate-fadeIn"
                >
                  <div className="px-2 py-1 text-[10px] text-slate-400 font-bold border-b border-slate-800 mb-1">
                    اختر عموداً لإضافته:
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                    {unselectedAvailableCols.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleAddColumn(c)}
                        className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-sky-500/20 flex items-center justify-between transition cursor-pointer"
                      >
                        <span>{c}</span>
                        <Plus className="w-3 h-3 text-sky-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Search Input + Select All (if > 5 options) */}
      {currentOptions.length > 5 && (
        <div className="flex items-center gap-1.5 mb-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`بحث في قيم (${currentCol})...`}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pr-7 pl-6 py-1 focus:outline-none focus:border-sky-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Select All / Deselect All button (multi mode only) */}
          {selectionMode === 'multi' && filteredOptions.length > 0 && (
            <button
              onClick={handleSelectAll}
              title={allFilteredSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition cursor-pointer shrink-0 ${
                allFilteredSelected
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700/60 hover:text-white hover:bg-slate-700'
              }`}
            >
              {allFilteredSelected
                ? <CheckSquare className="w-3 h-3" />
                : <Square className="w-3 h-3" />
              }
              <span>{allFilteredSelected ? 'إلغاء الكل' : 'تحديد الكل'}</span>
            </button>
          )}
        </div>
      )}

      {/* Select All row (if <= 5 options and multi mode) */}
      {currentOptions.length <= 5 && selectionMode === 'multi' && currentOptions.length > 0 && (
        <div className="flex items-center justify-between mb-1.5 shrink-0">
          <button
            onClick={handleSelectAll}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition cursor-pointer ${
              allFilteredSelected
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700/60 hover:text-white'
            }`}
          >
            {allFilteredSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            <span>{allFilteredSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</span>
          </button>
          <span className="text-[10px] text-slate-500">
            {currentSelected.length > 0 ? `${currentSelected.length} مختار` : ''}
          </span>
        </div>
      )}

      {/* 4. Options Chips */}
      <div className="flex flex-wrap gap-1.5 overflow-y-auto flex-1 items-start content-start custom-scrollbar">
        {/* "All" button (Single mode only or when nothing is selected) */}
        {selectionMode === 'single' && (
          <button
            onClick={() => clearFilter(currentCol)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentSelected.length === 0
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 font-bold'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            الكل
          </button>
        )}

        {filteredOptions.map((opt) => {
          const isSelected = currentSelected.includes(String(opt));
          return (
            <button
              key={String(opt)}
              onClick={() => handleToggleValue(String(opt))}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 font-bold'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/60'
              }`}
            >
              {selectionMode === 'multi' ? (
                isSelected
                  ? <CheckSquare className="w-3 h-3 shrink-0" />
                  : <Square className="w-3 h-3 shrink-0 opacity-60" />
              ) : (
                isSelected && <Check className="w-3 h-3 stroke-[3]" />
              )}
              <span>{String(opt)}</span>
            </button>
          );
        })}

        {filteredOptions.length === 0 && (
          <div className="text-slate-500 text-xs py-2 w-full text-center">
            لا توجد قيم مطابقة للبحث
          </div>
        )}
      </div>

      {/* 5. Footer Breadcrumbs for Active Filters across other columns */}
      {activeSlicerFilters.length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-wrap items-start gap-1 text-[10px] shrink-0">
          <span className="text-slate-500 font-semibold mt-0.5">فلاتر نشطة:</span>
          {activeSlicerFilters.map((f) => (
            <span
              key={f.column}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800/80 text-sky-300 font-mono"
            >
              <span>{f.column}:</span>
              {f.isArray ? (
                <strong className="text-white">
                  {(f.value as string[]).length > 2
                    ? `${(f.value as string[]).slice(0, 2).join('، ')} +${(f.value as string[]).length - 2}`
                    : (f.value as string[]).join('، ')
                  }
                </strong>
              ) : (
                <strong className="text-white">{String(f.value)}</strong>
              )}
              <button
                onClick={() => clearFilter(f.column)}
                className="hover:text-rose-300 cursor-pointer"
                title={`مسح فلتر ${f.column}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
