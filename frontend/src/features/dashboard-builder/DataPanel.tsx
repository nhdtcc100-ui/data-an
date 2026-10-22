import React, { useState } from 'react';
import type { DataSource, Column } from '../../types/dataSource';
import { useDashboardStore } from './DashboardStore';
import {
  Database,
  Search,
  Hash,
  Calendar,
  Type,
  CheckSquare,
  GripVertical,
  Filter,
  ChevronRight,
  ChevronLeft,
  Columns,
  UploadCloud
} from 'lucide-react';

interface DataPanelProps {
  dataSource: DataSource;
  onDragStartColumn: (column: Column) => void;
  onSelectColumn?: (column: Column) => void;
  onOpenUpload?: () => void;
  dockSide?: 'left' | 'right';
  isMobile?: boolean;
}

export const DataPanel: React.FC<DataPanelProps> = ({
  dataSource,
  onDragStartColumn,
  onSelectColumn,
  onOpenUpload,
  dockSide = 'right',
  isMobile = false
}) => {
  const {
    dataPanelWidth,
    setDataPanelWidth,
    isDataPanelCollapsed,
    toggleDataPanel,
    addSlicerForColumn,
    sidebarsPlacement,
    setSidebarsPlacement
  } = useDashboardStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isResizing, setIsResizing] = useState(false);

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'numeric':
        return <Hash className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'boolean':
        return <CheckSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      default:
        return <Type className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
  };

  // Clean columns: eliminate any '__EMPTY' or unnamed column from Excel
  const cleanColumns = (dataSource.columns || []).filter(
    (col) => col.columnName && !col.columnName.startsWith('__EMPTY') && col.columnName.trim() !== ''
  );

  const filteredColumns = cleanColumns.filter((col) =>
    col.columnName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Resize Drag Handler
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = dataPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      // If docked on the right side of the canvas, dragging left increases width
      // If docked on the left side of the canvas, dragging right increases width
      if (dockSide === 'left') {
        setDataPanelWidth(startWidth + delta);
      } else {
        setDataPanelWidth(startWidth - delta);
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

  if (isDataPanelCollapsed) {
    return (
      <div
        onClick={toggleDataPanel}
        className={`w-12 bg-slate-900/95 flex flex-col items-center py-4 cursor-pointer hover:bg-slate-850 transition select-none group ${
          dockSide === 'left' ? 'border-r border-slate-800' : 'border-l border-slate-800'
        }`}
        title="توسيع لوحة البيانات والحقول (Power BI Fields)"
      >
        <Database className="w-5 h-5 text-sky-400 mb-4 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold text-slate-400 [writing-mode:vertical-lr] tracking-widest uppercase">
          الحقول ({cleanColumns.length})
        </span>
        <div className="mt-auto p-1.5 rounded-lg text-slate-500 group-hover:text-slate-200">
          {dockSide === 'left' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </div>
      </div>
    );
  }

  return (
    <aside
      style={isMobile ? { width: '100%' } : { width: `${dataPanelWidth}px` }}
      className={`relative bg-slate-900/95 p-3.5 text-slate-200 flex flex-col h-full select-none backdrop-blur-sm transition-[width] duration-75 sidebar-3d ${
        isMobile ? 'w-full border-none' : dockSide === 'left' ? 'border-r border-slate-800/60' : 'border-l border-slate-800/60'
      } ${isResizing ? 'select-none pointer-events-none' : ''}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            حقول البيانات (Data Fields)
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60 font-mono">
            {cleanColumns.length}
          </span>

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
            onClick={toggleDataPanel}
            title="طي اللوحة"
            className="p-1 text-slate-500 hover:text-slate-200 rounded hover:bg-slate-800 transition cursor-pointer"
          >
            {dockSide === 'left' ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Dataset Name Badge with Quick Change Button */}
      <div className="text-[11px] font-medium text-slate-400 mb-2.5 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Columns className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate font-semibold text-slate-300" title={dataSource.fileName}>{dataSource.fileName}</span>
        </div>
        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 shrink-0 font-bold cursor-pointer bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 rounded border border-sky-500/30 transition"
            title="تغيير ملف البيانات أو رفع ملف Excel آخر"
          >
            <UploadCloud className="w-3 h-3" />
            <span>تغيير</span>
          </button>
        )}
      </div>

      {/* Search Field Input */}
      <div className="relative mb-2.5">
        <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن حقل في الملف..."
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pr-8 pl-2.5 py-1.5 focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>

      {/* Columns List */}
      <div className="space-y-1.5 overflow-y-auto flex-1 pr-0.5 custom-scrollbar">
        {filteredColumns.map((col) => (
          <div
            key={col.id}
            draggable
            onDragStart={() => onDragStartColumn(col)}
            onClick={() => onSelectColumn && onSelectColumn(col)}
            className="group flex items-center justify-between p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 hover:border-sky-500/50 cursor-pointer transition-all shadow-sm"
          >
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <GripVertical className="w-3 h-3 text-slate-600 group-hover:text-slate-400 shrink-0 cursor-grab" />
              {getDataTypeIcon(col.dataType)}
              <span className="text-xs font-medium text-slate-200 truncate" title={col.columnName}>
                {col.columnName}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-700 font-mono">
                {col.dataType === 'numeric' ? 'num' : col.dataType === 'date' ? 'date' : 'str'}
              </span>

              {/* Instant 1-Click Slicer Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addSlicerForColumn(col.columnName);
                }}
                title={`إضافة ${col.columnName} كفلتر سلايسر تفاعلي`}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 transition cursor-pointer flex items-center gap-0.5 text-[10px]"
              >
                <Filter className="w-3 h-3 text-sky-400" />
              </button>
            </div>
          </div>
        ))}

        {filteredColumns.length === 0 && (
          <div className="text-center py-6 text-xs text-slate-500">
            لا توجد حقول مطابقة
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center flex items-center justify-between">
        <span>انقر للربط بالمخطط</span>
        <span>أيقونة 🔍 لإضافة سلايسر</span>
      </div>

      {/* Resize Handle Splitter */}
      {!isMobile && (
        <div
          onMouseDown={startResizing}
          className={`absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-sky-500/50 transition-colors z-20 ${
            dockSide === 'left' ? 'right-0' : 'left-0'
          }`}
          title="اسحب لتغيير عرض لوحة البيانات"
        />
      )}
    </aside>
  );
};
