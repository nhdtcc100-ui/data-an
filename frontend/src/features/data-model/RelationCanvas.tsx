import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Link2, Unlink, AlertCircle, CheckCircle2, ArrowRight,
  Zap, Database, FileSpreadsheet, X, RotateCcw, ChevronDown,
  Globe, Cpu, GitBranch, Eye, EyeOff, Layers
} from 'lucide-react';
import type { TableEntry, TableRelation, MultiTableDataSource } from '../../types/dataSource';
import { detectRelations, assignTableColors } from '../../services/relationDetectionService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RelationCanvasProps {
  model: MultiTableDataSource;
  onModelChange: (model: MultiTableDataSource) => void;
}

interface CardPosition {
  x: number;
  y: number;
}

const JOIN_TYPE_LABELS: Record<TableRelation['joinType'], string> = {
  inner: 'Inner Join',
  left:  'Left Join',
  right: 'Right Join'
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.8 ? '#34d399' : c >= 0.6 ? '#fbbf24' : '#fb923c';

const TABLE_COLORS = [
  '#38bdf8', '#818cf8', '#34d399', '#fb923c',
  '#f472b6', '#a3e635', '#fbbf24', '#c084fc',
  '#2dd4bf', '#f87171'
];

// ─────────────────────────────────────────────────────────────────────────────
// RelationCanvas Component
// ─────────────────────────────────────────────────────────────────────────────

export const RelationCanvas: React.FC<RelationCanvasProps> = ({ model, onModelChange }) => {
  const tables = model.tables || [];
  const relations = model.relations || [];

  // ── Card positions ─────────────────────────────────────────────────────────
  const [positions, setPositions] = useState<Record<string, CardPosition>>(() =>
    computeInitialPositions(tables)
  );

  // ── Dragging card ──────────────────────────────────────────────────────────
  const draggingRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const canvasRef   = useRef<HTMLDivElement>(null);

  // ── Drawing new relation (drag from column) ────────────────────────────────
  const [drawingRel, setDrawingRel] = useState<{
    fromTableId: string; fromCol: string;
    mouseX: number; mouseY: number;
  } | null>(null);

  // ── Selected relation for editing ─────────────────────────────────────────
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);

  // ── Column expand state ────────────────────────────────────────────────────
  const [expandedTables, setExpandedTables] = useState<Set<string>>(
    new Set(tables.slice(0, 4).map((t) => t.id))
  );

  // ── Auto-detect running state ──────────────────────────────────────────────
  const [isDetecting, setIsDetecting] = useState(false);

  // Update positions when tables change
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      tables.forEach((t, i) => {
        if (!next[t.id]) {
          const angle = (i / tables.length) * 2 * Math.PI;
          const r = Math.min(260, 80 + tables.length * 25);
          next[t.id] = {
            x: 420 + r * Math.cos(angle),
            y: 280 + r * Math.sin(angle)
          };
        }
      });
      return next;
    });
  }, [tables]);

  // ── Card drag ──────────────────────────────────────────────────────────────
  const onCardMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    const pos = positions[tableId] || { x: 0, y: 0 };
    draggingRef.current = { id: tableId, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
  }, [positions]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingRef.current) {
      const { id, ox, oy } = draggingRef.current;
      setPositions((prev) => ({ ...prev, [id]: { x: e.clientX - ox, y: e.clientY - oy } }));
    }
    if (drawingRel) {
      const rect = canvasRef.current?.getBoundingClientRect();
      setDrawingRel((prev) => prev
        ? { ...prev, mouseX: e.clientX - (rect?.left ?? 0), mouseY: e.clientY - (rect?.top ?? 0) }
        : null
      );
    }
  }, [drawingRel]);

  const onCanvasMouseUp = useCallback(() => {
    draggingRef.current = null;
    setDrawingRel(null);
  }, []);

  // ── Auto-detect relations ──────────────────────────────────────────────────
  const handleAutoDetect = () => {
    setIsDetecting(true);
    setTimeout(() => {
      const coloredTables = assignTableColors(tables);
      const detected = detectRelations(coloredTables);
      // Merge: keep manually created, add auto-detected that don't exist yet
      const existingKeys = new Set(relations.map((r) => `${r.leftTableId}-${r.rightTableId}`));
      const newRels = detected.filter(
        (r) => !existingKeys.has(`${r.leftTableId}-${r.rightTableId}`)
      );
      onModelChange({ ...model, relations: [...relations, ...newRels] });
      setIsDetecting(false);
    }, 600);
  };

  // ── Delete relation ────────────────────────────────────────────────────────
  const handleDeleteRelation = (relId: string) => {
    onModelChange({ ...model, relations: relations.filter((r) => r.id !== relId) });
    if (selectedRelId === relId) setSelectedRelId(null);
  };

  // ── Change join type ───────────────────────────────────────────────────────
  const handleChangeJoinType = (relId: string, joinType: TableRelation['joinType']) => {
    onModelChange({
      ...model,
      relations: relations.map((r) => r.id === relId ? { ...r, joinType } : r)
    });
  };

  // ── Column drop target: create relation ───────────────────────────────────
  const handleColumnDrop = (toTableId: string, toCol: string) => {
    if (!drawingRel || drawingRel.fromTableId === toTableId) { setDrawingRel(null); return; }
    const newRel: TableRelation = {
      id: `rel-manual-${Date.now()}`,
      leftTableId: drawingRel.fromTableId,
      rightTableId: toTableId,
      leftColumn: drawingRel.fromCol,
      rightColumn: toCol,
      joinType: 'left',
      confidence: 1.0,
      isAutoDetected: false
    };
    onModelChange({ ...model, relations: [...relations, newRel] });
    setDrawingRel(null);
  };

  // ── Toggle column expand ───────────────────────────────────────────────────
  const toggleExpand = (tableId: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      next.has(tableId) ? next.delete(tableId) : next.add(tableId);
      return next;
    });
  };

  // ── SVG lines for relations ────────────────────────────────────────────────
  const renderRelationLines = () => {
    return relations.map((rel) => {
      const leftPos  = positions[rel.leftTableId];
      const rightPos = positions[rel.rightTableId];
      if (!leftPos || !rightPos) return null;

      const CARD_W = 220;
      const CARD_H_BASE = 52;

      const x1 = leftPos.x  + CARD_W;
      const y1 = leftPos.y  + CARD_H_BASE;
      const x2 = rightPos.x;
      const y2 = rightPos.y + CARD_H_BASE;

      const mx = (x1 + x2) / 2;
      const color = CONFIDENCE_COLOR(rel.confidence);
      const isSelected = selectedRelId === rel.id;

      return (
        <g key={rel.id} onClick={() => setSelectedRelId(isSelected ? null : rel.id)}>
          {/* Invisible wider hit area */}
          <path
            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
            fill="none" stroke="transparent" strokeWidth={16} className="cursor-pointer"
          />
          {/* Visible line */}
          <path
            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={isSelected ? '#60a5fa' : color}
            strokeWidth={isSelected ? 2.5 : 1.5}
            strokeDasharray={rel.isAutoDetected ? '6,3' : 'none'}
            style={{ filter: isSelected ? 'drop-shadow(0 0 6px #60a5fa88)' : 'none', transition: 'stroke 0.2s' }}
          />
          {/* Endpoint dots */}
          <circle cx={x1} cy={y1} r={4} fill={color} />
          <circle cx={x2} cy={y2} r={4} fill={color} />
          {/* Mid label */}
          <rect x={mx - 26} y={(y1 + y2) / 2 - 10} width={52} height={20}
            rx={4} fill="#1e293b" stroke={color} strokeWidth={1} />
          <text x={mx} y={(y1 + y2) / 2 + 4} textAnchor="middle"
            fontSize={9} fill={color} className="font-mono select-none">
            {JOIN_TYPE_LABELS[rel.joinType]}
          </text>
        </g>
      );
    });
  };

  // ── Drawing line (live) ────────────────────────────────────────────────────
  const renderDrawingLine = () => {
    if (!drawingRel || !canvasRef.current) return null;
    const fromPos = positions[drawingRel.fromTableId];
    if (!fromPos) return null;
    const x1 = fromPos.x + 220;
    const y1 = fromPos.y + 52;
    return (
      <line x1={x1} y1={y1} x2={drawingRel.mouseX} y2={drawingRel.mouseY}
        stroke="#60a5fa" strokeWidth={2} strokeDasharray="6,3"
        style={{ pointerEvents: 'none' }} />
    );
  };

  // ── Render table cards ─────────────────────────────────────────────────────
  const renderTableCard = (table: TableEntry, idx: number) => {
    const pos = positions[table.id] || { x: 50 + idx * 250, y: 100 };
    const color = table.color || TABLE_COLORS[idx % TABLE_COLORS.length];
    const isExpanded = expandedTables.has(table.id);
    const relCount = relations.filter(
      (r) => r.leftTableId === table.id || r.rightTableId === table.id
    ).length;

    return (
      <div
        key={table.id}
        style={{
          position: 'absolute',
          left: pos.x,
          top:  pos.y,
          width: 220,
          zIndex: draggingRef.current?.id === table.id ? 50 : 10,
          transform: 'translateZ(0)'
        }}
        className="select-none"
      >
        {/* Card header */}
        <div
          onMouseDown={(e) => onCardMouseDown(e, table.id)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-t-xl cursor-grab active:cursor-grabbing"
          style={{
            background: `linear-gradient(135deg, ${color}22, ${color}11)`,
            borderTop: `2px solid ${color}`,
            borderLeft: `1px solid ${color}44`,
            borderRight: `1px solid ${color}44`,
            backdropFilter: 'blur(8px)'
          }}
        >
          <div className="p-1.5 rounded-lg" style={{ background: `${color}22` }}>
            {table.sourceType === 'sheet'
              ? <Globe className="w-3.5 h-3.5" style={{ color }} />
              : <FileSpreadsheet className="w-3.5 h-3.5" style={{ color }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-100 truncate">{table.name}</p>
            <p className="text-[10px] text-slate-400">
              {table.rowCount?.toLocaleString()} صف · {table.columns?.length} عمود
              {relCount > 0 && <span className="text-sky-400 mr-1">· {relCount} علاقة</span>}
            </p>
          </div>
          <button
            onClick={() => toggleExpand(table.id)}
            className="p-0.5 rounded text-slate-500 hover:text-slate-200 transition"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Columns list */}
        {isExpanded && (
          <div
            className="border-x border-b border-slate-700 rounded-b-xl overflow-hidden"
            style={{ background: '#0f172a', maxHeight: 200, overflowY: 'auto' }}
          >
            {(table.columns || []).slice(0, 15).map((col) => {
              const isRelated = relations.some(
                (r) =>
                  (r.leftTableId  === table.id && r.leftColumn  === col.columnName) ||
                  (r.rightTableId === table.id && r.rightColumn === col.columnName)
              );
              return (
                <div
                  key={col.id}
                  draggable
                  onDragStart={() =>
                    setDrawingRel({ fromTableId: table.id, fromCol: col.columnName, mouseX: 0, mouseY: 0 })
                  }
                  onDrop={() => handleColumnDrop(table.id, col.columnName)}
                  onDragOver={(e) => e.preventDefault()}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-grab hover:bg-slate-800 transition group border-b border-slate-800/50 last:border-0 ${
                    isRelated ? 'bg-sky-500/5' : ''
                  }`}
                >
                  <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                    col.dataType === 'numeric' ? 'bg-sky-500/20 text-sky-300'
                    : col.dataType === 'date' ? 'bg-amber-500/20 text-amber-300'
                    : col.dataType === 'boolean' ? 'bg-violet-500/20 text-violet-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {col.dataType === 'numeric' ? '123' : col.dataType === 'date' ? 'D' : col.dataType === 'boolean' ? 'B' : 'Aa'}
                  </span>
                  <span className={`text-[11px] flex-1 truncate ${
                    isRelated ? 'text-sky-300 font-semibold' : 'text-slate-300'
                  }`}>
                    {col.columnName}
                  </span>
                  {isRelated && <Link2 className="w-3 h-3 text-sky-400" />}
                </div>
              );
            })}
            {(table.columns?.length || 0) > 15 && (
              <div className="px-3 py-1 text-[10px] text-slate-500 text-center">
                + {(table.columns?.length || 0) - 15} أعمدة أخرى
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const selectedRel = relations.find((r) => r.id === selectedRelId);

  return (
    <div className="flex flex-col h-full bg-slate-950/80" dir="rtl">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 mr-auto">
          <GitBranch className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-bold text-slate-200">نموذج العلاقات</span>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
            {tables.length} جداول · {relations.length} علاقات
          </span>
        </div>

        {/* Mode selector: Join vs Append */}
        <div className="flex items-center bg-slate-800/90 p-0.5 rounded-lg border border-slate-700 text-xs">
          <button
            onClick={() => onModelChange({ ...model, mode: 'join' })}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${
              (model.mode || 'join') === 'join'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="دمج العلاقات بين الجداول حسب المفاتيح المشتركة (Power Pivot Relational Join)"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>دمج علاقات</span>
          </button>
          <button
            onClick={() => onModelChange({ ...model, mode: 'append' })}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${
              model.mode === 'append'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="تجميع صفوف الشيتات المتشابهة تحت نفس الأعمدة الحقيقية (Power Query Append)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>تجميع صفوف (Append)</span>
          </button>
        </div>

        {/* Auto detect */}
        <button
          onClick={handleAutoDetect}
          disabled={isDetecting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition"
        >
          {isDetecting
            ? <><Cpu className="w-3.5 h-3.5 animate-spin" /> جارٍ الكشف...</>
            : <><Zap className="w-3.5 h-3.5" /> كشف تلقائي</>}
        </button>

        {/* Expand/collapse all */}
        <button
          onClick={() => setExpandedTables(expandedTables.size === tables.length
            ? new Set() : new Set(tables.map((t) => t.id)))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold transition"
        >
          {expandedTables.size === tables.length
            ? <><EyeOff className="w-3.5 h-3.5" /> طيّ الكل</>
            : <><Eye className="w-3.5 h-3.5" /> توسيع الكل</>}
        </button>

        {/* Reset positions */}
        <button
          onClick={() => setPositions(computeInitialPositions(tables))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          إعادة ترتيب
        </button>
      </div>

      {/* Append Mode Information Banner */}
      {model.mode === 'append' && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-300 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>نمط تجميع وإلحاق الصفوف مفعّل:</strong> يتم تجميع جميع صفوف الجداول المختارة تحت نفس الأعمدة الحقيقية الموحدة، مع إضافة عمود (ورقة_المصدر) تلقائياً، دون أي أعمدة وهمية أو تكرار.
            </span>
          </div>
          <button
            onClick={() => onModelChange({ ...model, mode: 'join' })}
            className="text-[11px] underline text-emerald-300 hover:text-white shrink-0 mr-3 cursor-pointer"
          >
            التبديل إلى دمج العلاقات
          </button>
        </div>
      )}

      {/* ── Canvas area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* SVG + Cards */}
        <div
          ref={canvasRef}
          className="relative flex-1 overflow-auto"
          style={{ minHeight: 500, background: 'radial-gradient(ellipse at 50% 50%, #1e293b 0%, #0f172a 100%)' }}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
        >
          {/* Grid pattern */}
          <svg
            className="absolute inset-0"
            style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <defs>
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Relation lines SVG */}
          <svg
            className="absolute inset-0"
            style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
          >
            <g style={{ pointerEvents: 'all' }}>
              {renderRelationLines()}
              {renderDrawingLine()}
            </g>
          </svg>

          {/* Table cards */}
          {tables.map((table, idx) => renderTableCard(table, idx))}

          {/* Empty state */}
          {tables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <Database className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">لا توجد جداول محملة بعد</p>
              <p className="text-xs mt-1">أضف ملفات من قسم الاستيراد</p>
            </div>
          )}
        </div>

        {/* ── Relation detail panel ── */}
        {selectedRel && (
          <RelationDetailPanel
            relation={selectedRel}
            tables={tables}
            onChangeJoinType={(jt) => handleChangeJoinType(selectedRel.id, jt)}
            onDelete={() => handleDeleteRelation(selectedRel.id)}
            onClose={() => setSelectedRelId(null)}
          />
        )}
      </div>

      {/* ── Bottom legend ── */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-800 bg-slate-900/60 text-[10px] text-slate-500 shrink-0">
        <span className="flex items-center gap-1">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#34d399" strokeWidth="1.5" strokeDasharray="6,3" /></svg>
          كُشف تلقائياً
        </span>
        <span className="flex items-center gap-1">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#60a5fa" strokeWidth="2" /></svg>
          أُضيف يدوياً
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> ثقة عالية (≥80%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> ثقة متوسطة
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> ثقة منخفضة
        </span>
        <span className="mr-auto text-slate-600">اسحب من عمود إلى عمود لإنشاء علاقة يدوية</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RelationDetailPanel
// ─────────────────────────────────────────────────────────────────────────────

interface RelationDetailPanelProps {
  relation: TableRelation;
  tables: TableEntry[];
  onChangeJoinType: (jt: TableRelation['joinType']) => void;
  onDelete: () => void;
  onClose: () => void;
}

const RelationDetailPanel: React.FC<RelationDetailPanelProps> = ({
  relation, tables, onChangeJoinType, onDelete, onClose
}) => {
  const leftTable  = tables.find((t) => t.id === relation.leftTableId);
  const rightTable = tables.find((t) => t.id === relation.rightTableId);

  return (
    <div className="w-72 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0" dir="rtl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-sky-400" />
          تفاصيل العلاقة
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Relation path */}
        <div className="bg-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-sky-300 font-semibold">{leftTable?.name || '—'}</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="text-emerald-300 font-semibold">{rightTable?.name || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <code className="bg-slate-700 px-1.5 py-0.5 rounded text-sky-200">{relation.leftColumn}</code>
            <span className="text-slate-600">=</span>
            <code className="bg-slate-700 px-1.5 py-0.5 rounded text-emerald-200">{relation.rightColumn}</code>
          </div>
        </div>

        {/* Confidence */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400">نسبة الثقة</span>
            <span className="text-xs font-bold" style={{ color: CONFIDENCE_COLOR(relation.confidence) }}>
              {Math.round(relation.confidence * 100)}%
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${relation.confidence * 100}%`,
                background: CONFIDENCE_COLOR(relation.confidence)
              }}
            />
          </div>
        </div>

        {/* Join type selector */}
        <div>
          <p className="text-[11px] text-slate-400 mb-2">نوع الربط (Join Type)</p>
          <div className="space-y-2">
            {(['left', 'inner', 'right'] as const).map((jt) => (
              <button
                key={jt}
                onClick={() => onChangeJoinType(jt)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition border ${
                  relation.joinType === jt
                    ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <JoinDiagram type={jt} />
                <span className="font-semibold">{JOIN_TYPE_LABELS[jt]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
          relation.isAutoDetected
            ? 'bg-amber-500/10 text-amber-300'
            : 'bg-emerald-500/10 text-emerald-300'
        }`}>
          {relation.isAutoDetected
            ? <><AlertCircle className="w-3.5 h-3.5" /> كُشف تلقائياً</>
            : <><CheckCircle2 className="w-3.5 h-3.5" /> أُنشئ يدوياً</>}
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition"
        >
          <Unlink className="w-3.5 h-3.5" />
          حذف هذه العلاقة
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// JoinDiagram mini SVG
// ─────────────────────────────────────────────────────────────────────────────

const JoinDiagram: React.FC<{ type: TableRelation['joinType'] }> = ({ type }) => {
  const left  = type === 'left'  || type === 'inner';
  const right = type === 'right' || type === 'inner';
  return (
    <svg width="32" height="18" viewBox="0 0 32 18">
      <circle cx="11" cy="9" r="7" fill={left  ? '#38bdf855' : 'transparent'} stroke="#38bdf8" strokeWidth="1.2" />
      <circle cx="21" cy="9" r="7" fill={right ? '#34d39955' : 'transparent'} stroke="#34d399" strokeWidth="1.2" />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial positions (circular layout)
// ─────────────────────────────────────────────────────────────────────────────

function computeInitialPositions(tables: TableEntry[]): Record<string, CardPosition> {
  const pos: Record<string, CardPosition> = {};
  const n = tables.length;
  if (n === 0) return pos;

  if (n === 1) {
    pos[tables[0].id] = { x: 200, y: 150 };
    return pos;
  }

  const cx = 380, cy = 250;
  const r  = Math.min(240, 80 + n * 28);

  tables.forEach((t, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    pos[t.id] = {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    };
  });
  return pos;
}
