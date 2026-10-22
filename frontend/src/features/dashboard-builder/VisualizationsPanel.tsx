import React, { useState } from 'react';
import type { WidgetType, AggregationType, Widget } from '../../types/dashboard';
import { useDashboardStore } from './DashboardStore';
import {
  BarChart3,
  BarChart2,
  LineChart,
  PieChart,
  Table,
  Filter,
  Activity,
  Layers,
  Sparkles,
  Gauge,
  Compass,
  Dot,
  Copy,
  Trash2,
  Palette,
  Sliders,
  Paintbrush,
  ChevronRight,
  ChevronLeft,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Grid,
  FileSpreadsheet,
  CheckSquare,
  Square,
  X,
  Plus,
  ChevronUp,
  ChevronDown,
  Link2,
  Unlink,
  Shield,
  LayoutGrid,
  Sun,
  Flame,
  Cloud
} from 'lucide-react';

interface VisualizationsPanelProps {
  selectedWidget: Widget | null;
  onUpdateWidgetConfig: (widgetId: string, updates: Partial<Widget['config']>) => void;
  onAddWidget: (type: WidgetType) => void;
  dockSide?: 'left' | 'right';
  isMobile?: boolean;
}

const WIDGET_TYPES: { type: WidgetType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'kpi', label: 'مؤشر أداء (KPI)', icon: <Activity className="w-4 h-4 text-emerald-400" />, desc: 'رقم مجمع ونسبة تغير' },
  { type: 'bar', label: 'شريطي عمودي (Bar)', icon: <BarChart3 className="w-4 h-4 text-sky-400" />, desc: 'مقارنة الفئات والقيم' },
  { type: 'horizontal_bar', label: 'شريطي أفقي (H-Bar)', icon: <BarChart2 className="w-4 h-4 text-emerald-400" />, desc: 'ترتيب وتصنيف الفئات' },
  { type: 'treemap', label: 'خريطة الشجرة (Treemap)', icon: <LayoutGrid className="w-4 h-4 text-amber-400" />, desc: 'مساحات مستطيلة للأحجام الكبيرة' },
  { type: 'sunburst', label: 'أشعة الشمس (Sunburst)', icon: <Sun className="w-4 h-4 text-orange-400" />, desc: 'حلقات دائرية متعددة الفئات' },
  { type: 'heatmap', label: 'خريطة حرارية (Heatmap)', icon: <Flame className="w-4 h-4 text-red-400" />, desc: 'مصفوفة حرارية لتقاطع بعدين' },
  { type: 'wordcloud', label: 'سحابة كلمات (Word Cloud)', icon: <Cloud className="w-4 h-4 text-sky-400" />, desc: 'حجم الكلمات حسب الأهمية' },
  { type: 'line', label: 'خطي سلس (Line)', icon: <LineChart className="w-4 h-4 text-indigo-400" />, desc: 'تتبع الاتجاهات الزمنية' },
  { type: 'area', label: 'مساحي (Area)', icon: <Layers className="w-4 h-4 text-purple-400" />, desc: 'حجم التراكم الزمني' },
  { type: 'donut', label: 'دائري مجوف (Donut)', icon: <PieChart className="w-4 h-4 text-rose-400" />, desc: 'توزيع الحصص والنسب' },
  { type: 'pie', label: 'دائري كامل (Pie)', icon: <PieChart className="w-4 h-4 text-amber-400" />, desc: 'تقسيم النسب المئوية' },
  { type: 'funnel', label: 'قمعي (Funnel)', icon: <Layers className="w-4 h-4 text-orange-400" />, desc: 'مراحل ومسارات التحويل' },
  { type: 'gauge', label: 'عداد إنجاز (Gauge)', icon: <Gauge className="w-4 h-4 text-teal-400" />, desc: 'مقياس تحقيق الأهداف' },
  { type: 'radar', label: 'راداري (Radar)', icon: <Compass className="w-4 h-4 text-pink-400" />, desc: 'مقارنة مؤشرات متعددة' },
  { type: 'scatter', label: 'انتشار (Scatter)', icon: <Dot className="w-4 h-4 text-blue-400" />, desc: 'العلاقة بين متغيرين' },
  { type: 'pivot', label: 'جدول محوري', icon: <Table className="w-4 h-4 text-amber-500" />, desc: 'عرض جدولي مجمع' },
  { type: 'table', label: 'جدول بيانات عادي', icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />, desc: 'عرض تفصيلي لأي أعمدة' },
  { type: 'slicer', label: 'فلتر تفاعلي', icon: <Filter className="w-4 h-4 text-cyan-400" />, desc: 'أزرار تصفية متقاطعة' }
];

const COLOR_THEMES = [
  { id: 'sky', label: 'أزرق سماوي', class: 'bg-sky-500' },
  { id: 'emerald', label: 'أخضر زمردي', class: 'bg-emerald-500' },
  { id: 'violet', label: 'بنفسجي ملكي', class: 'bg-violet-500' },
  { id: 'amber', label: 'كهرماني ذهبي', class: 'bg-amber-500' },
  { id: 'rose', label: 'وردي ياقوتي', class: 'bg-rose-500' },
  { id: 'cyan', label: 'سماوي بحري', class: 'bg-cyan-500' }
];

export const VisualizationsPanel: React.FC<VisualizationsPanelProps> = ({
  selectedWidget,
  onUpdateWidgetConfig,
  onAddWidget,
  dockSide = 'right',
  isMobile = false
}) => {
  const {
    currentDashboard,
    currentDataSource,
    updateWidgetTitle,
    changeWidgetType,
    duplicateWidget,
    removeWidget,
    setWidgetLinks,
    toggleWidgetLink,
    setWidgetIgnoreIncoming,
    visualizationsPanelWidth,
    setVisualizationsPanelWidth,
    isVisualizationsPanelCollapsed,
    toggleVisualizationsPanel,
    sidebarsPlacement,
    setSidebarsPlacement
  } = useDashboardStore();

  const [activeTab, setActiveTab] = useState<'setup' | 'format' | 'interactions'>('setup');
  const [isResizing, setIsResizing] = useState(false);

  // Clean columns
  const columns = (currentDataSource.columns || []).filter(
    (c) => c.columnName && !c.columnName.startsWith('__EMPTY') && c.columnName.trim() !== ''
  );
  const numericColumns = columns.filter((c) => c.dataType === 'numeric');
  const stringColumns = columns.filter((c) => c.dataType === 'string' || c.dataType === 'date');
  const activeTableCols = selectedWidget?.config?.tableColumns !== undefined
    ? selectedWidget.config.tableColumns
    : columns.slice(0, 5).map((c) => c.columnName);

  const activeSlicerCols =
    selectedWidget?.config?.slicerColumns && selectedWidget.config.slicerColumns.length > 0
      ? selectedWidget.config.slicerColumns
      : [selectedWidget?.config?.xAxisColumn || columns[0]?.columnName || 'المنطقة'];

  const currentActiveSlicerCol =
    selectedWidget?.config?.activeSlicerColumn && activeSlicerCols.includes(selectedWidget.config.activeSlicerColumn)
      ? selectedWidget.config.activeSlicerColumn
      : activeSlicerCols[0] || selectedWidget?.config?.xAxisColumn || 'المنطقة';

  // Resize Drag Handler
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = visualizationsPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      if (dockSide === 'left') {
        setVisualizationsPanelWidth(startWidth + delta);
      } else {
        setVisualizationsPanelWidth(startWidth - delta);
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (isVisualizationsPanelCollapsed && !isMobile) {
    return (
      <div
        onClick={toggleVisualizationsPanel}
        className={`w-12 bg-slate-900/95 flex flex-col items-center py-4 cursor-pointer hover:bg-slate-850 transition select-none group ${
          dockSide === 'left' ? 'border-r border-slate-800' : 'border-l border-slate-800'
        }`}
        title="توسيع لوحة المخططات والخصائص (Power BI Visualizations)"
      >
        <Sparkles className="w-5 h-5 text-sky-400 mb-4 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold text-slate-400 [writing-mode:vertical-lr] tracking-widest uppercase">
          المخططات والتنسيق
        </span>
        <div className="mt-auto p-1.5 rounded-lg text-slate-500 group-hover:text-slate-200">
          {dockSide === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>
    );
  }

  return (
    <aside
      style={isMobile ? { width: '100%' } : { width: `${visualizationsPanelWidth}px` }}
      className={`relative bg-slate-900/95 p-3.5 text-slate-200 flex flex-col h-full select-none backdrop-blur-sm overflow-y-auto custom-scrollbar transition-[width] duration-75 ${
        isMobile ? 'w-full border-none' : dockSide === 'left' ? 'border-r border-slate-800' : 'border-l border-slate-800'
      } ${isResizing ? 'select-none pointer-events-none' : ''}`}
    >
      {/* Visualizations Catalog */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              المخططات والعناصر (Visuals)
            </h3>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick Dock Mode Switcher */}
            <div className="hidden sm:flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[9px]">
              <button
                onClick={() => setSidebarsPlacement('powerbi-right')}
                title="نمط Power BI: الألواح متجاورة على اليمين"
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  sidebarsPlacement === 'powerbi-right' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                PBI
              </button>
              <button
                onClick={() => setSidebarsPlacement('split')}
                title="نمط منفصل: لوحة على اليمين وأخرى على اليسار"
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  sidebarsPlacement === 'split' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                فصل
              </button>
              <button
                onClick={() => setSidebarsPlacement('powerbi-left')}
                title="الألواح متجاورة على اليسار"
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  sidebarsPlacement === 'powerbi-left' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                يسار
              </button>
            </div>

            <button
              onClick={toggleVisualizationsPanel}
              title="طي اللوحة"
              className="p-1 text-slate-500 hover:text-slate-200 rounded hover:bg-slate-800 transition cursor-pointer"
            >
              {dockSide === 'left' ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 13 Widget Catalog Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {WIDGET_TYPES.map((item) => (
            <button
              key={item.type}
              onClick={() => onAddWidget(item.type)}
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/50 hover:border-sky-500/60 transition-all text-center group cursor-pointer"
            >
              <div className="p-1.5 rounded-lg bg-slate-900 group-hover:scale-110 transition-transform mb-1 shadow-inner">
                {item.icon}
              </div>
              <span className="text-[11px] font-semibold text-slate-200">{item.label}</span>
              <span className="text-[9px] text-slate-500 line-clamp-1">{item.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Widget Properties (If a widget is currently selected) */}
      {selectedWidget ? (
        <div className="border-t border-slate-800 pt-3 flex-1 flex flex-col space-y-3">
          {/* Header with Power BI Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('setup')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'setup'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>إعداد البيانات</span>
              </button>
              <button
                onClick={() => setActiveTab('format')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'format'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>تنسيق النمط</span>
              </button>
              <button
                onClick={() => setActiveTab('interactions')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'interactions'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>ربط التفاعل</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => duplicateWidget(selectedWidget.id)}
                title="استنساخ العنصر"
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => removeWidget(selectedWidget.id)}
                title="حذف العنصر"
                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* TAB 1: SETUP (Build Visual) */}
          {activeTab === 'setup' && (
            <div className="space-y-3 text-xs">
              {/* Widget Title */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">عنوان العنصر (Title)</label>
                <input
                  type="text"
                  value={selectedWidget.title}
                  onChange={(e) => updateWidgetTitle(selectedWidget.id, e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-sky-500 outline-none text-xs"
                />
              </div>

              {/* Chart Type Switcher */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">تغيير نوع الرسم البياني فورياً</label>
                <select
                  value={selectedWidget.type}
                  onChange={(e) => changeWidgetType(selectedWidget.id, e.target.value as WidgetType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-sky-500 outline-none text-xs"
                >
                  {WIDGET_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Render Table Column Selection if widget is table, else render standard chart controls */}
              {selectedWidget.type === 'table' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>أعمدة الجدول المعروضة ({activeTableCols.length})</span>
                    </label>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        onClick={() =>
                          onUpdateWidgetConfig(selectedWidget.id, {
                            tableColumns: columns.map((c) => c.columnName)
                          })
                        }
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-sky-400 border border-slate-700/60 transition cursor-pointer"
                      >
                        تحديد الكل
                      </button>
                      <button
                        onClick={() =>
                          onUpdateWidgetConfig(selectedWidget.id, { tableColumns: [] })
                        }
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-rose-400 border border-slate-700/60 transition cursor-pointer"
                      >
                        مسح
                      </button>
                    </div>
                  </div>

                  {/* Selected columns badge list */}
                  {activeTableCols.length > 0 && (
                    <div className="flex flex-wrap gap-1 p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                      {activeTableCols.map((colName) => (
                        <span
                          key={colName}
                          className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700/80 shadow-sm"
                        >
                          <span>{colName}</span>
                          <button
                            onClick={() => {
                              const nextCols = activeTableCols.filter((c) => c !== colName);
                              onUpdateWidgetConfig(selectedWidget.id, { tableColumns: nextCols });
                            }}
                            className="text-slate-400 hover:text-rose-400 transition cursor-pointer"
                            title="إزالة العمود"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* All available columns checkbox list */}
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1.5 font-medium">
                      اختر الحقول التي تود إضافتها للجدول:
                    </span>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar p-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      {columns.map((col) => {
                        const isSelected = activeTableCols.includes(col.columnName);
                        return (
                          <div
                            key={col.id}
                            onClick={() => {
                              let nextCols = [...activeTableCols];
                              if (isSelected) {
                                nextCols = nextCols.filter((c) => c !== col.columnName);
                              } else {
                                nextCols.push(col.columnName);
                              }
                              onUpdateWidgetConfig(selectedWidget.id, { tableColumns: nextCols });
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border text-xs ${
                              isSelected
                                ? 'bg-sky-950/40 border-sky-600/50 text-sky-200 shadow-sm'
                                : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-sky-400 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 shrink-0" />
                              )}
                              <span className="font-medium truncate">{col.columnName}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-500 font-mono shrink-0">
                              {col.dataType === 'numeric' ? 'رقم' : col.dataType === 'date' ? 'تاريخ' : 'نص'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Page Size Selector */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-slate-400 mb-1 font-semibold">
                      عدد الأسطر في الصفحة (Page Size)
                    </label>
                    <select
                      value={selectedWidget.config.tablePageSize || 8}
                      onChange={(e) =>
                        onUpdateWidgetConfig(selectedWidget.id, {
                          tablePageSize: Number(e.target.value)
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-sky-500 outline-none text-xs"
                    >
                      <option value={5}>5 أسطر لكل صفحة</option>
                      <option value={8}>8 أسطر لكل صفحة</option>
                      <option value={15}>15 سطر لكل صفحة</option>
                      <option value={30}>30 سطر لكل صفحة</option>
                    </select>
                  </div>
                </div>
              ) : selectedWidget.type === 'slicer' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                      <Filter className="w-3.5 h-3.5 text-cyan-400" />
                      <span>قنوات وأعمدة التصفية ({activeSlicerCols.length})</span>
                    </label>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        onClick={() => {
                          const allColNames = columns.map((c) => c.columnName);
                          onUpdateWidgetConfig(selectedWidget.id, {
                            slicerColumns: allColNames,
                            activeSlicerColumn: currentActiveSlicerCol,
                            xAxisColumn: currentActiveSlicerCol
                          });
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-sky-400 border border-slate-700/60 transition cursor-pointer"
                      >
                        تحديد الكل
                      </button>
                      <button
                        onClick={() => {
                          const fallbackCol = columns[0]?.columnName || 'المنطقة';
                          onUpdateWidgetConfig(selectedWidget.id, {
                            slicerColumns: [fallbackCol],
                            activeSlicerColumn: fallbackCol,
                            xAxisColumn: fallbackCol
                          });
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 border border-slate-700/60 transition cursor-pointer"
                      >
                        إعادة ضبط
                      </button>
                    </div>
                  </div>

                  {/* Active columns badges */}
                  <div className="flex flex-wrap gap-1 p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                    {activeSlicerCols.map((colName) => {
                      const isDefault = colName === currentActiveSlicerCol;
                      return (
                        <span
                          key={colName}
                          onClick={() =>
                            onUpdateWidgetConfig(selectedWidget.id, {
                              activeSlicerColumn: colName,
                              xAxisColumn: colName
                            })
                          }
                          className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-lg border shadow-sm cursor-pointer transition ${
                            isDefault
                              ? 'bg-sky-500 text-white border-sky-400 font-bold'
                              : 'bg-slate-800/90 text-slate-300 border-slate-700/80 hover:text-white'
                          }`}
                          title={isDefault ? 'العمود النشط حالياً' : 'انقر لتعيينه كعمود نشط'}
                        >
                          <span>{colName}</span>
                          {activeSlicerCols.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextCols = activeSlicerCols.filter((c) => c !== colName);
                                const nextActive =
                                  currentActiveSlicerCol === colName ? nextCols[0] : currentActiveSlicerCol;
                                onUpdateWidgetConfig(selectedWidget.id, {
                                  slicerColumns: nextCols,
                                  activeSlicerColumn: nextActive,
                                  xAxisColumn: nextActive
                                });
                              }}
                              className="text-slate-400 hover:text-rose-400 transition cursor-pointer p-0.5"
                              title="إزالة العمود"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* Column Picker Checkbox list */}
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1.5 font-medium">
                      اختر الحقول لتضمينها في هذا الفلتر (تصفية متعددة الأعمدة):
                    </span>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar p-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      {columns.map((col) => {
                        const isIncluded = activeSlicerCols.includes(col.columnName);
                        return (
                          <div
                            key={col.id}
                            onClick={() => {
                              let nextCols = [...activeSlicerCols];
                              if (isIncluded) {
                                if (nextCols.length > 1) {
                                  nextCols = nextCols.filter((c) => c !== col.columnName);
                                }
                              } else {
                                nextCols.push(col.columnName);
                              }
                              const nextActive = nextCols.includes(currentActiveSlicerCol)
                                ? currentActiveSlicerCol
                                : nextCols[0];
                              onUpdateWidgetConfig(selectedWidget.id, {
                                slicerColumns: nextCols,
                                activeSlicerColumn: nextActive,
                                xAxisColumn: nextActive
                              });
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border text-xs ${
                              isIncluded
                                ? 'bg-sky-950/40 border-sky-600/50 text-sky-200 shadow-sm'
                                : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                              {isIncluded ? (
                                <CheckSquare className="w-4 h-4 text-sky-400 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 shrink-0" />
                              )}
                              <span className="font-medium truncate">{col.columnName}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-500 font-mono shrink-0">
                              {col.dataType === 'numeric' ? 'رقم' : col.dataType === 'date' ? 'تاريخ' : 'فئة'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Column Dropdown */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-slate-400 mb-1 font-semibold">
                      العمود الافتراضي للعرض (Active Column)
                    </label>
                    <select
                      value={currentActiveSlicerCol}
                      onChange={(e) =>
                        onUpdateWidgetConfig(selectedWidget.id, {
                          activeSlicerColumn: e.target.value,
                          xAxisColumn: e.target.value
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sky-300 font-bold focus:border-sky-500 outline-none text-xs"
                    >
                      {activeSlicerCols.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selection Mode Toggle */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-slate-400 mb-1.5 font-semibold">
                      وضع الاختيار (Selection Mode)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          onUpdateWidgetConfig(selectedWidget.id, { slicerSelectionMode: 'single' })
                        }
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          (selectedWidget.config.slicerSelectionMode || 'single') === 'single'
                            ? 'bg-sky-500 text-white border-sky-400'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-750'
                        }`}
                      >
                        اختيار واحد فردي
                      </button>
                      <button
                        onClick={() =>
                          onUpdateWidgetConfig(selectedWidget.id, { slicerSelectionMode: 'multi' })
                        }
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          selectedWidget.config.slicerSelectionMode === 'multi'
                            ? 'bg-emerald-500 text-white border-emerald-400'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-750'
                        }`}
                      >
                        تعدد الاختيارات
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {selectedWidget.config.slicerSelectionMode === 'multi'
                        ? 'وضع متعدد: يمكن تحديد أكثر من قيمة لتصفية البيانات في آن واحد'
                        : 'وضع فردي: يُحدد قيمة واحدة فقط في كل مرة'
                      }
                    </p>
                  </div>
                </div>

              ) : (
                <>
                  {/* Categorical Dimension: X-Axis / Slices */}
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between text-xs">
                      <span>
                        {selectedWidget.type === 'pie' || selectedWidget.type === 'donut'
                          ? 'فئات وتصنيف الشرائح (الوصفي X)'
                          : 'المحور الأفقي / البُعد الوصفي (X-Axis)'}
                      </span>
                      <span className="text-[10px] text-sky-400 font-normal">تصنيف / فئات</span>
                    </label>
                    <select
                      value={selectedWidget.config.xAxisColumn || ''}
                      onChange={(e) =>
                        onUpdateWidgetConfig(selectedWidget.id, { xAxisColumn: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-sky-500 outline-none text-xs"
                    >
                      <option value="">-- اختر الحقل الوصفي / الفئات --</option>
                      {stringColumns.map((col) => (
                        <option key={col.id} value={col.columnName}>
                          {col.columnName} ({col.dataType === 'date' ? 'تاريخ' : 'نص'})
                        </option>
                      ))}
                      {numericColumns.map((col) => (
                        <option key={col.id} value={col.columnName}>
                          {col.columnName} (رقم كفئة)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantitative Metric: Y-Axis / Values */}
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between text-xs">
                      <span>
                        {selectedWidget.type === 'pie' || selectedWidget.type === 'donut'
                          ? 'قيم وأحجام الشرائح (الحسابي Y)'
                          : 'المحور الرأسي / القياس الحسابي (Y-Axis)'}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-normal">قيم وأرقام</span>
                    </label>
                    <select
                      value={selectedWidget.config.yAxisColumn || ''}
                      onChange={(e) =>
                        onUpdateWidgetConfig(selectedWidget.id, { yAxisColumn: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-sky-500 outline-none text-xs font-mono"
                    >
                      <option value="">-- اختر حقل الحساب --</option>
                      <optgroup label="الحقول الرقمية (تصلح للجمع والمتوسط)">
                        {numericColumns.map((col) => (
                          <option key={col.id} value={col.columnName}>
                            {col.columnName} (رقمي)
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="كافة الحقول (تصلح للعد COUNT وحساب التكرار)">
                        {stringColumns.map((col) => (
                          <option key={col.id} value={col.columnName}>
                            {col.columnName} ({col.dataType === 'date' ? 'تاريخ' : 'نص'})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Aggregation Function */}
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between text-xs">
                      <span>
                        {selectedWidget.type === 'pie' || selectedWidget.type === 'donut'
                          ? 'نوع العملية الحسابية للشرائح'
                          : 'دالة التجميع والعملية الحسابية (Aggregation)'}
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono">
                        {selectedWidget.config.aggregation || 'SUM'}
                      </span>
                    </label>
                    <select
                      value={selectedWidget.config.aggregation || 'SUM'}
                      onChange={(e) =>
                        onUpdateWidgetConfig(selectedWidget.id, {
                          aggregation: e.target.value as AggregationType
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-sky-500 outline-none text-xs"
                    >
                      <option value="SUM">جمع الأرقام الإجمالية (SUM) - مجموع المبيعات/الأرباح</option>
                      <option value="COUNT">عد السجلات والتكرارات (COUNT) - عدد العمليات أو الطلبات</option>
                      <option value="AVG">حساب المتوسط الحسابي (AVG) - معدل السعر/الكمية</option>
                      <option value="MAX">أعلى قيمة مسجلة (MAX) - الحد الأقصى</option>
                      <option value="MIN">أدنى قيمة مسجلة (MIN) - الحد الأدنى</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {selectedWidget.config.aggregation === 'COUNT'
                        ? '🔢 دالة العد (COUNT) تحسب عدد مرات تكرار كل فئة وتعمل مع أي حقل حتى الحقول النصية.'
                        : '➕ تجمع الأرقام بحسب كل فئة من فئات المحور الأفقي أو شرائح الدائري.'}
                    </p>
                  </div>

                  {/* Secondary Metric (For dual axes / scatter / pivot) */}
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">
                      مقياس إضافي ثاني (Secondary Metric) - اختياري
                    </label>
                    <select
                      value={selectedWidget.config.secondaryMetric || ''}
                      onChange={(e) =>
                        onUpdateWidgetConfig(selectedWidget.id, { secondaryMetric: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-sky-500 outline-none text-xs font-mono"
                    >
                      <option value="">-- بدون مقياس إضافي --</option>
                      {numericColumns.map((col) => (
                        <option key={col.id} value={col.columnName}>
                          {col.columnName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sorting & Top N */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">ترتيب النتائج</label>
                      <select
                        value={selectedWidget.config.sortOrder || 'desc'}
                        onChange={(e) =>
                          onUpdateWidgetConfig(selectedWidget.id, { sortOrder: e.target.value as any })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-slate-200 focus:border-sky-500 outline-none text-xs"
                      >
                        <option value="desc">تنازلي (الأعلى أولاً)</option>
                        <option value="asc">تصاعدي (الأقل أولاً)</option>
                        <option value="none">ترتيب المصدر الطبيعي</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">تحديد أعلى N فئة</label>
                      <select
                        value={selectedWidget.config.topN || 0}
                        onChange={(e) =>
                          onUpdateWidgetConfig(selectedWidget.id, { topN: parseInt(e.target.value) || undefined })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-slate-200 focus:border-sky-500 outline-none text-xs"
                      >
                        <option value={0}>عرض جميع الفئات</option>
                        <option value={5}>أعلى 5 فقط (Top 5)</option>
                        <option value={8}>أعلى 8 فقط (Top 8)</option>
                        <option value={10}>أعلى 10 فقط (Top 10)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* SECTION: Hierarchical Drill-Down Navigation (التنقل الهرمي للطبقات) */}
              {selectedWidget.type !== 'kpi' && selectedWidget.type !== 'slicer' && selectedWidget.type !== 'table' && (
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-200 text-xs block">
                          التنقل الهرمي للبيانات (Drill-Down)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          التعمق من طبقة لأخرى عند النقر
                        </span>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => {
                        const isCurrentlyEnabled = Boolean(selectedWidget.config.drillDownEnabled);
                        let nextLevels = selectedWidget.config.drillDownLevels;
                        if (!isCurrentlyEnabled && (!nextLevels || nextLevels.length === 0)) {
                          const defaultFirst = selectedWidget.config.xAxisColumn || stringColumns[0]?.columnName || columns[0]?.columnName || 'المنطقة';
                          const remaining = columns.filter((c) => c.columnName !== defaultFirst).map((c) => c.columnName);
                          nextLevels = [defaultFirst, remaining[0] || 'القسم', remaining[1] || 'المنتج'].filter(Boolean);
                        }
                        onUpdateWidgetConfig(selectedWidget.id, {
                          drillDownEnabled: !isCurrentlyEnabled,
                          drillDownLevels: nextLevels
                        });
                      }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        selectedWidget.config.drillDownEnabled ? 'bg-sky-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          selectedWidget.config.drillDownEnabled ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {selectedWidget.config.drillDownEnabled && (
                    <div className="space-y-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-sky-500/30">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                        <span>ترتيب المستويات الهرمية (بالتسلسل):</span>
                        <span className="text-[10px] text-sky-400 font-mono">
                          {(selectedWidget.config.drillDownLevels || []).length} مستويات
                        </span>
                      </div>

                      {/* Levels List */}
                      <div className="space-y-2">
                        {(selectedWidget.config.drillDownLevels || []).map((lvlCol, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-900 border border-slate-800"
                          >
                            <span className="w-5 h-5 rounded-md bg-sky-500/20 text-sky-300 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>

                            {/* Column Selector for this level */}
                            <select
                              value={lvlCol}
                              onChange={(e) => {
                                const newLevels = [...(selectedWidget.config.drillDownLevels || [])];
                                newLevels[idx] = e.target.value;
                                onUpdateWidgetConfig(selectedWidget.id, { drillDownLevels: newLevels });
                              }}
                              className="flex-1 bg-slate-950 border border-slate-700 rounded p-1 text-slate-200 text-[11px] outline-none font-medium"
                            >
                              {columns.map((c) => (
                                <option key={c.id} value={c.columnName}>
                                  {c.columnName}
                                </option>
                              ))}
                            </select>

                            {/* Move Up */}
                            <button
                              disabled={idx === 0}
                              onClick={() => {
                                const newLevels = [...(selectedWidget.config.drillDownLevels || [])];
                                const tmp = newLevels[idx - 1];
                                newLevels[idx - 1] = newLevels[idx];
                                newLevels[idx] = tmp;
                                onUpdateWidgetConfig(selectedWidget.id, { drillDownLevels: newLevels });
                              }}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-800 transition cursor-pointer"
                              title="تحريك لأعلى"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Move Down */}
                            <button
                              disabled={idx === (selectedWidget.config.drillDownLevels || []).length - 1}
                              onClick={() => {
                                const newLevels = [...(selectedWidget.config.drillDownLevels || [])];
                                const tmp = newLevels[idx + 1];
                                newLevels[idx + 1] = newLevels[idx];
                                newLevels[idx] = tmp;
                                onUpdateWidgetConfig(selectedWidget.id, { drillDownLevels: newLevels });
                              }}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-800 transition cursor-pointer"
                              title="تحريك لأسفل"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Level */}
                            {(selectedWidget.config.drillDownLevels || []).length > 1 && (
                              <button
                                onClick={() => {
                                  const newLevels = (selectedWidget.config.drillDownLevels || []).filter((_, i) => i !== idx);
                                  onUpdateWidgetConfig(selectedWidget.id, { drillDownLevels: newLevels });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition cursor-pointer"
                                title="حذف هذا المستوى"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add Level Button */}
                      <button
                        onClick={() => {
                          const currentLevels = selectedWidget.config.drillDownLevels || [];
                          const unusedCol = columns.find((c) => !currentLevels.includes(c.columnName))?.columnName || columns[0]?.columnName || 'عمود جديد';
                          const newLevels = [...currentLevels, unusedCol];
                          onUpdateWidgetConfig(selectedWidget.id, { drillDownLevels: newLevels });
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-sky-500/40 text-sky-400 hover:bg-sky-500/10 text-xs font-semibold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة مستوى هرمي جديد</span>
                      </button>

                      {/* Helpful explanation */}
                      <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-500/20 text-[10px] text-sky-300 leading-relaxed">
                        💡 <b>طريقة العمل:</b> عند النقر على أي فئة بالرسم (مثلاً الشركة)، سيتم الدخول تلقائياً للطبقة التالية (الأقسام) ثم (المنتجات) مع إمكانية الرجوع للأعلى عبر شريط التتبع (Breadcrumb).
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FORMAT & STYLE (Looker & Power BI Styling) */}
          {activeTab === 'format' && (
            <div className="space-y-4 text-xs">
              {/* SECTION 1: Card & Frame Styling (تنسيق البطاقة والإطار) */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-3">
                <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                  <Square className="w-3.5 h-3.5" />
                  <span>تنسيق البطاقة والإطار (Card Container)</span>
                </span>

                {/* Card Background Presets */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">لون خلفية البطاقة</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: '#0f172a', label: 'داكن Slate' },
                      { id: '#090d16', label: 'كحلي Deep' },
                      { id: '#020617', label: 'أسود Black' },
                      { id: '#1e293b', label: 'رمادي Gray' }
                    ].map((bg) => (
                      <button
                        key={bg.id}
                        onClick={() => onUpdateWidgetConfig(selectedWidget.id, { cardBgColor: bg.id })}
                        className={`py-1 px-1.5 rounded-lg border text-[10px] font-mono transition cursor-pointer ${
                          selectedWidget.config.cardBgColor === bg.id
                            ? 'border-sky-400 bg-sky-500/20 text-white font-bold'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Border Radius */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">استدارة حواف البطاقة</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { val: 0, label: 'حادة (0px)' },
                      { val: 8, label: 'خفيفة (8px)' },
                      { val: 16, label: 'قياسية (16px)' },
                      { val: 24, label: 'دائرية (24px)' }
                    ].map((r) => (
                      <button
                        key={r.val}
                        onClick={() => onUpdateWidgetConfig(selectedWidget.id, { cardBorderRadius: r.val })}
                        className={`py-1 rounded-lg border text-[10px] transition cursor-pointer ${
                          (selectedWidget.config.cardBorderRadius ?? 16) === r.val
                            ? 'border-sky-400 bg-sky-500/20 text-sky-300 font-bold'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Shadow */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-300 text-[11px]">تأثير الظل والبروز (Card Shadow)</span>
                  <input
                    type="checkbox"
                    checked={selectedWidget.config.cardShadow ?? true}
                    onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { cardShadow: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* SECTION 2: Header & Typography Styling (العنوان والنصوص) */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-3">
                <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                  <AlignRight className="w-3.5 h-3.5" />
                  <span>تنسيق العنوان والخطوط (Title & Typography)</span>
                </span>

                {/* Title Font Size */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>حجم خط العنوان</span>
                    <span className="font-mono text-sky-400">{selectedWidget.config.titleFontSize || 12}px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="18"
                    step="1"
                    value={selectedWidget.config.titleFontSize || 12}
                    onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { titleFontSize: Number(e.target.value) })}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>

                {/* Title Alignment */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">محاذاة العنوان</label>
                  <div className="flex gap-1.5">
                    {[
                      { id: 'right', icon: <AlignRight className="w-3.5 h-3.5" />, label: 'يمين' },
                      { id: 'center', icon: <AlignCenter className="w-3.5 h-3.5" />, label: 'وسط' },
                      { id: 'left', icon: <AlignLeft className="w-3.5 h-3.5" />, label: 'يسار' }
                    ].map((align) => (
                      <button
                        key={align.id}
                        onClick={() => onUpdateWidgetConfig(selectedWidget.id, { titleAlign: align.id as any })}
                        className={`flex-1 flex items-center justify-center gap-1 p-1 rounded-lg border text-xs cursor-pointer transition ${
                          (selectedWidget.config.titleAlign || 'right') === align.id
                            ? 'bg-sky-500 text-white border-sky-500 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {align.icon}
                        <span>{align.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title Text Color */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">لون خط العنوان</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: '#f8fafc', label: 'أبيض' },
                      { id: '#38bdf8', label: 'سماوي' },
                      { id: '#34d399', label: 'زمردي' },
                      { id: '#fbbf24', label: 'ذهبي' },
                      { id: '#a78bfa', label: 'بنفسجي' }
                    ].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onUpdateWidgetConfig(selectedWidget.id, { titleColor: c.id })}
                        className={`py-0.5 rounded border text-[10px] transition cursor-pointer ${
                          selectedWidget.config.titleColor === c.id
                            ? 'border-white font-bold ring-1 ring-sky-400'
                            : 'border-slate-800 text-slate-300'
                        }`}
                        style={{ backgroundColor: c.id + '25', color: c.id }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION 3: Colors & Palettes (الألوان والتدرجات) */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-3">
                <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                  <Palette className="w-3.5 h-3.5" />
                  <span>الألوان والتدرجات (Colors & Palette)</span>
                </span>

                {/* Preset Palettes */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">النمط اللوني المنسق</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {COLOR_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        title={theme.label}
                        onClick={() =>
                          onUpdateWidgetConfig(selectedWidget.id, { colorTheme: theme.id as any, primaryColor: undefined })
                        }
                        className={`h-6 rounded-md ${theme.class} transition-transform cursor-pointer ${
                          selectedWidget.config.colorTheme === theme.id && !selectedWidget.config.primaryColor
                            ? 'ring-2 ring-white scale-110'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Custom Primary Color Picker */}
                <div className="pt-1.5 border-t border-slate-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] text-slate-300 font-medium">لون مخصص حر (Custom Color)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedWidget.config.primaryColor || '#0ea5e9'}
                        onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { primaryColor: e.target.value })}
                        className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer p-0"
                      />
                      <input
                        type="text"
                        value={selectedWidget.config.primaryColor || ''}
                        placeholder="#0ea5e9"
                        onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { primaryColor: e.target.value })}
                        className="w-18 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 font-mono text-[10px] text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Gradient Toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-slate-300 text-[11px]">تدرج لوني انسيابي (Color Gradient)</span>
                  <input
                    type="checkbox"
                    checked={selectedWidget.config.isGradient ?? true}
                    onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { isGradient: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* SECTION 4: Chart-Specific Visual Styling (حسب نوع المخطط) */}
              {(selectedWidget.type === 'bar' || selectedWidget.type === 'horizontal_bar') && (
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-3">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>خصائص الأعمدة (Bar Styling)</span>
                  </span>

                  {/* Bar Corner Radius */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>استدارة حواف الأعمدة</span>
                      <span className="font-mono text-sky-400">{selectedWidget.config.barBorderRadius ?? 6}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="16"
                      step="2"
                      value={selectedWidget.config.barBorderRadius ?? 6}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { barBorderRadius: Number(e.target.value) })}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Data Labels */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-[11px]">إظهار قيم الأرقام على الأعمدة (Data Labels)</span>
                    <input
                      type="checkbox"
                      checked={selectedWidget.config.showDataLabels ?? true}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { showDataLabels: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {(selectedWidget.type === 'pie' || selectedWidget.type === 'donut') && (
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-3">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                    <PieChart className="w-3.5 h-3.5" />
                    <span>خصائص الدائري والمجوف (Pie/Donut Options)</span>
                  </span>

                  {/* Donut Hole Ratio */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>نسبة التجويف الداخلي</span>
                      <span className="font-mono text-sky-400">{selectedWidget.config.donutHoleRatio ?? (selectedWidget.type === 'donut' ? 42 : 0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="75"
                      step="5"
                      value={selectedWidget.config.donutHoleRatio ?? (selectedWidget.type === 'donut' ? 42 : 0)}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { donutHoleRatio: Number(e.target.value) })}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Nightingale Rose Type */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-[11px]">نمط الورود القطبي (Rose Chart)</span>
                    <input
                      type="checkbox"
                      checked={selectedWidget.config.pieRoseType ?? false}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { pieRoseType: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Pie Labels Type */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">نوع التسميات على الشرائح</label>
                    <select
                      value={selectedWidget.config.pieLabelType || 'percent'}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { pieLabelType: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200 outline-none text-xs"
                    >
                      <option value="percent">نسبة مئوية (%)</option>
                      <option value="value">القيمة المالية / الرقمية ($)</option>
                      <option value="name">اسم الفئة</option>
                    </select>
                  </div>
                </div>
              )}

              {(selectedWidget.type === 'line' || selectedWidget.type === 'area') && (
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-3">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                    <LineChart className="w-3.5 h-3.5" />
                    <span>خصائص الخط والمساحة (Line/Area Options)</span>
                  </span>

                  {/* Smooth Line */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-[11px]">انحناء مسار سلس (Smooth Curve)</span>
                    <input
                      type="checkbox"
                      checked={selectedWidget.config.smoothLine ?? true}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { smoothLine: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Line Width */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>سماكة خط المسار</span>
                      <span className="font-mono text-sky-400">{selectedWidget.config.lineWidth ?? 3}px</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      step="1"
                      value={selectedWidget.config.lineWidth ?? 3}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { lineWidth: Number(e.target.value) })}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Show Symbols / Dots */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-[11px]">إظهار نقاط البيانات (Data Dots)</span>
                    <input
                      type="checkbox"
                      checked={selectedWidget.config.showSymbols ?? true}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { showSymbols: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* SECTION 5: Table Specific Styling (عندما يكون العنصر جدولاً) */}
              {(selectedWidget.type === 'table' || selectedWidget.type === 'pivot') && (
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-3">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                    <Table className="w-3.5 h-3.5" />
                    <span>تنسيق مظهر الجدول (Table Styling)</span>
                  </span>

                  {/* Table Header Background */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">لون ترويسة الجدول (Header)</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'slate', label: 'داكن Slate', class: 'bg-slate-900 text-slate-200' },
                        { id: 'navy', label: 'كحلي Navy', class: 'bg-slate-950 text-sky-300' },
                        { id: 'sky', label: 'سماوي Sky', class: 'bg-sky-950 text-sky-200' },
                        { id: 'emerald', label: 'زمردي Emerald', class: 'bg-emerald-950 text-emerald-200' }
                      ].map((h) => (
                        <button
                          key={h.id}
                          onClick={() => onUpdateWidgetConfig(selectedWidget.id, { tableHeaderBg: h.id })}
                          className={`py-1 rounded border text-[10px] font-medium transition cursor-pointer ${h.class} ${
                            (selectedWidget.config.tableHeaderBg || 'slate') === h.id
                              ? 'border-white ring-1 ring-white font-bold'
                              : 'border-slate-800 opacity-80 hover:opacity-100'
                          }`}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Zebra Striping */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-[11px]">تظليل الصفوف المتبادلة (Zebra Striping)</span>
                    <input
                      type="checkbox"
                      checked={selectedWidget.config.tableZebra ?? true}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { tableZebra: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Table Row Density */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">كثافة وتباعد الأسطر</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'compact', label: 'مضغوط (Compact)' },
                        { id: 'comfortable', label: 'مريح (Normal)' },
                        { id: 'spacious', label: 'واسع (Spacious)' }
                      ].map((d) => (
                        <button
                          key={d.id}
                          onClick={() => onUpdateWidgetConfig(selectedWidget.id, { tableDensity: d.id as any })}
                          className={`py-1 rounded-lg border text-[10px] transition cursor-pointer ${
                            (selectedWidget.config.tableDensity || 'comfortable') === d.id
                              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold'
                              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Highlight Max Values */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-[11px]">تمييز أعلى قيمة بالأعمدة (Highlight Max)</span>
                    <input
                      type="checkbox"
                      checked={selectedWidget.config.tableHighlightMax ?? true}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { tableHighlightMax: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* General Grid & Legend Settings */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-3">
                <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                  <Grid className="w-3.5 h-3.5" />
                  <span>الشبكة ودليل الرسم (Grid & Legend)</span>
                </span>

                {/* Gridlines */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-[11px]">خطوط الشبكة الخلفية (Gridlines)</span>
                  <input
                    type="checkbox"
                    checked={selectedWidget.config.showGridlines ?? true}
                    onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { showGridlines: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                  />
                </div>

                {/* Legend */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-[11px]">دليل الرسم (Legend)</span>
                    <input
                      type="checkbox"
                      checked={selectedWidget.config.showLegend ?? true}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { showLegend: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                    />
                  </div>
                  {selectedWidget.config.showLegend !== false && (
                    <select
                      value={selectedWidget.config.legendPosition || 'bottom'}
                      onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { legendPosition: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200 outline-none text-xs"
                    >
                      <option value="top">أعلى المخطط (Top)</option>
                      <option value="bottom">أسفل المخطط (Bottom)</option>
                      <option value="left">يسار (Left)</option>
                      <option value="right">يمين (Right)</option>
                    </select>
                  )}
                </div>

                {/* Number Format */}
                <div className="pt-1 border-t border-slate-800/80">
                  <label className="block text-slate-400 mb-1 font-semibold text-[11px]">تنسيق عرض الأرقام والعملات</label>
                  <select
                    value={selectedWidget.config.numberFormat || 'currency'}
                    onChange={(e) => onUpdateWidgetConfig(selectedWidget.id, { numberFormat: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200 outline-none text-xs font-medium"
                  >
                    <option value="currency">عملة مالية ($ / د.ع)</option>
                    <option value="compact">مختصر رقمي (K / M / B)</option>
                    <option value="percent">نسبة مئوية (%)</option>
                    <option value="standard">أرقام قياسية مفصولة بفاصلة (1,000)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INTERACTIONS (Cross-Filtering Linking & Isolation) */}
          {activeTab === 'interactions' && (
            <div className="space-y-4 text-xs">
              {/* Mode Selector */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">
                  نمط تفاعل وتصفية هذا العنصر مع اللوحة
                </label>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setWidgetLinks(selectedWidget.id, undefined, 'all', true)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-right transition cursor-pointer ${
                      (selectedWidget.config?.crossFilterMode || 'all') === 'all'
                        ? 'bg-sky-500/15 border-sky-500 text-sky-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-sky-400" />
                      <span className="font-bold text-xs">ربط مع الكل (افتراضي)</span>
                    </div>
                    {(selectedWidget.config?.crossFilterMode || 'all') === 'all' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">مفعل</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const defaultLinks = selectedWidget.config?.linkedWidgetIds !== undefined
                        ? selectedWidget.config.linkedWidgetIds
                        : currentDashboard.widgets.filter((w) => w.id !== selectedWidget.id).map((w) => w.id);
                      setWidgetLinks(selectedWidget.id, defaultLinks, 'custom', true);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-right transition cursor-pointer ${
                      selectedWidget.config?.crossFilterMode === 'custom'
                        ? 'bg-purple-500/15 border-purple-500 text-purple-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="font-bold text-xs">تخصيص الربط (عناصر محددة)</span>
                    </div>
                    {selectedWidget.config?.crossFilterMode === 'custom' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">مفعل</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setWidgetLinks(selectedWidget.id, [], 'none', true)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-right transition cursor-pointer ${
                      selectedWidget.config?.crossFilterMode === 'none'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Unlink className="w-4 h-4 text-rose-400" />
                      <span className="font-bold text-xs">فصل تام (مستقل)</span>
                    </div>
                    {selectedWidget.config?.crossFilterMode === 'none' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">مفعل</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Incoming Filter Toggle */}
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5 text-xs">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>استقبال التصفية من الجارتات</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setWidgetIgnoreIncoming(
                        selectedWidget.id,
                        !selectedWidget.config?.ignoreIncomingFilters
                      )
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      selectedWidget.config?.ignoreIncomingFilters
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {selectedWidget.config?.ignoreIncomingFilters ? 'معزول 🛡️' : 'يستقبل ✅'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {selectedWidget.config?.ignoreIncomingFilters
                    ? 'هذا العنصر معزول ولن يتأثر بنقرات أو فلاتر أي جارت آخر ويعرض كامل البيانات دائماً.'
                    : 'يتأثر هذا العنصر بالنقرات والتصفية القادمة من الجارتات المرتبطة به.'}
                </p>
              </div>

              {/* Target Visuals List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5 text-xs">
                    <Link2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>العناصر المرتبطة والمفصولة</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = currentDashboard.widgets.filter((w) => w.id !== selectedWidget.id).map((w) => w.id);
                        setWidgetLinks(selectedWidget.id, allIds, 'custom', true);
                      }}
                      className="text-[10px] text-sky-400 hover:text-sky-300 px-1 py-0.5 rounded hover:bg-slate-800 cursor-pointer"
                    >
                      ربط الكل
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setWidgetLinks(selectedWidget.id, [], 'custom', true)}
                      className="text-[10px] text-rose-400 hover:text-rose-300 px-1 py-0.5 rounded hover:bg-slate-800 cursor-pointer"
                    >
                      فصل الكل
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {currentDashboard.widgets
                    .filter((w) => w.id !== selectedWidget.id)
                    .map((other) => {
                      const isCustom = selectedWidget.config?.crossFilterMode === 'custom';
                      const isNone = selectedWidget.config?.crossFilterMode === 'none';
                      const isLinked = isNone
                        ? false
                        : isCustom
                        ? (selectedWidget.config?.linkedWidgetIds || []).includes(other.id)
                        : (selectedWidget.config?.linkedWidgetIds ? selectedWidget.config.linkedWidgetIds.includes(other.id) : true);

                      return (
                        <div
                          key={other.id}
                          onClick={() => toggleWidgetLink(selectedWidget.id, other.id, true)}
                          className={`flex items-center justify-between p-2 rounded-lg border transition cursor-pointer text-xs ${
                            isLinked
                              ? 'bg-slate-900/90 border-sky-500/30 hover:border-sky-400'
                              : 'bg-slate-950/40 border-slate-800/80 opacity-60 hover:opacity-100 hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0 pr-1">
                            <div className="font-semibold text-slate-200 truncate">{other.title}</div>
                            <span className="text-[10px] text-slate-500">{other.type}</span>
                          </div>
                          <div className="shrink-0">
                            {isLinked ? (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                                مرتبط 🔗
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                مفصول 🚫
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-slate-800 pt-6 text-center text-slate-500 text-xs flex-1 flex flex-col items-center justify-center">
          <Sparkles className="w-8 h-8 text-slate-700 mb-2" />
          <span>انقر على أي مخطط في اللوحة لتعديل إعدادات البيانات (Setup) ومظهره (Format) مثل Power BI</span>
        </div>
      )}

      {/* Resize Handle Splitter */}
      {!isMobile && (
        <div
          onMouseDown={startResizing}
          className={`absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-sky-500/50 transition-colors z-20 ${
            dockSide === 'left' ? 'right-0' : 'left-0'
          }`}
          title="اسحب لتغيير عرض لوحة المخططات والخصائص"
        />
      )}
    </aside>
  );
};
