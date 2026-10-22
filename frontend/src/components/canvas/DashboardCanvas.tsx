import React, { useState } from 'react';
import { useDashboardStore } from '../../features/dashboard-builder/DashboardStore';
import { WidgetContainer } from './WidgetContainer';
import { Plus, LayoutGrid, ArrowUpToLine, ArrowDownToLine, Target, Move } from 'lucide-react';

export const DashboardCanvas: React.FC = () => {
  const {
    currentDashboard,
    isEditMode,
    addWidget,
    reorderWidget,
    moveWidgetToPosition
  } = useDashboardStore();

  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedWidgetId(id);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedWidgetId;
    if (sourceId) {
      const sourceIndex = currentDashboard.widgets.findIndex((w) => w.id === sourceId);
      if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
        reorderWidget(sourceIndex, targetIndex);
      }
    }
    setDraggedWidgetId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverIndex(null);
  };

  const getColSpanClass = (w: number) => {
    switch (w) {
      case 3:
        // KPIs / slicers: full width mobile → 2-cols sm → 4-cols lg
        return 'col-span-12 sm:col-span-6 lg:col-span-3';
      case 4:
        return 'col-span-12 sm:col-span-6 lg:col-span-4';
      case 6:
        return 'col-span-12 lg:col-span-6';
      case 8:
        return 'col-span-12 lg:col-span-8';
      case 12:
        return 'col-span-12';
      default:
        return 'col-span-12 lg:col-span-6';
    }
  };

  const getWidgetHeight = (widget: (typeof currentDashboard.widgets)[0]) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const h = widget?.layout?.h || 4;
    if (widget?.type === 'kpi') return isMobile ? 120 : Math.max(140, h * 75);
    if (widget?.type === 'slicer') return isMobile ? 160 : Math.max(150, h * 65);
    if (widget?.type === 'table' || widget?.type === 'pivot') return isMobile ? 380 : Math.max(400, h * 75);
    return isMobile ? 280 : Math.max(280, h * 85);
  };

  return (
    <main className="flex-1 overflow-y-auto p-5 bg-slate-950/60 custom-scrollbar relative">
      {/* Background Grid Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Quick Drop Zone Header when dragging a widget */}
      {draggedWidgetId && isEditMode && (
        <div className="sticky top-0 z-40 mb-4 p-3 bg-slate-900/95 border border-sky-500/50 shadow-2xl shadow-sky-500/10 rounded-2xl flex flex-wrap items-center justify-center gap-3 backdrop-blur-md animate-fadeIn">
          <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
            <Move className="w-4 h-4 text-sky-400 animate-pulse" />
            <span>نقل وإفلات سريع للموقع:</span>
          </span>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              moveWidgetToPosition(draggedWidgetId, 'start');
              handleDragEnd();
            }}
            className="px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500 hover:text-white border border-sky-400/40 text-sky-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowUpToLine className="w-4 h-4" />
            <span>أفلت هنا: بداية التقرير (أول عنصر)</span>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              moveWidgetToPosition(draggedWidgetId, 'middle');
              handleDragEnd();
            }}
            className="px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500 hover:text-white border border-indigo-400/40 text-indigo-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Target className="w-4 h-4" />
            <span>أفلت هنا: منتصف التقرير</span>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              moveWidgetToPosition(draggedWidgetId, 'end');
              handleDragEnd();
            }}
            className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500 hover:text-white border border-purple-400/40 text-purple-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>أفلت هنا: نهاية التقرير (آخر عنصر)</span>
          </div>
        </div>
      )}

      {/* Grid Container */}
      <div className="grid grid-cols-12 gap-4 max-w-[1600px] mx-auto relative z-10">
        {currentDashboard.widgets.map((widget, index) => (
          <div
            key={widget.id}
            onDragOver={(e) => isEditMode && handleDragOver(e, index)}
            onDrop={(e) => isEditMode && handleDrop(e, index)}
            style={{ minHeight: `${getWidgetHeight(widget)}px` }}
            className={`${getColSpanClass(widget?.layout?.w ?? 6)} transition-all duration-200 flex flex-col ${
              dragOverIndex === index && draggedWidgetId !== widget.id
                ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950 scale-[1.01] rounded-xl shadow-sky-500/20'
                : ''
            } ${draggedWidgetId === widget.id ? 'opacity-40 scale-95' : ''}`}
          >
            <WidgetContainer
              widget={widget}
              index={index}
              totalWidgets={currentDashboard.widgets.length}
              onDragStart={(e) => handleDragStart(e, widget.id)}
              onDragEnd={handleDragEnd}
            />
          </div>
        ))}

        {/* Add Widget Ghost Card (in edit mode) */}
        {isEditMode && (
          <button
            onClick={() => addWidget('bar')}
            className="col-span-12 lg:col-span-6 border-2 border-dashed border-slate-800 hover:border-sky-500/50 hover:bg-slate-900/40 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 hover:text-sky-400 transition-all duration-200 cursor-pointer min-h-[220px] group"
          >
            <div className="p-3 rounded-full bg-slate-900 border border-slate-800 group-hover:scale-110 group-hover:border-sky-500/50 transition-all mb-3 shadow-inner">
              <Plus className="w-5 h-5 text-sky-400" />
            </div>
            <span className="text-sm font-semibold text-slate-300 group-hover:text-white">
              إضافة عنصر تحليلي جديد (New Widget)
            </span>
            <span className="text-xs text-slate-500 mt-1">
              أو اسحب أي نوع من قائمة المخططات على اليسار
            </span>
          </button>
        )}
      </div>

      {currentDashboard.widgets.length === 0 && (
        <div className="text-center py-20 text-slate-500">
          <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-slate-300 mb-1">اللوحة فارغة حالياً</h3>
          <p className="text-xs">ابدأ بإضافة بطاقات مؤشرات الأداء والرسوم البيانية من لوحة التحكم</p>
        </div>
      )}
    </main>
  );
};

