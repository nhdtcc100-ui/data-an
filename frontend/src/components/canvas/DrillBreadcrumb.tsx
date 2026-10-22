import React from 'react';
import { Layers, CornerUpLeft, Home, ChevronLeft } from 'lucide-react';
import type { DrillPathEntry } from '../../services/dataEngine';

interface DrillBreadcrumbProps {
  drillPath: DrillPathEntry[];
  currentColumn?: string;
  totalLevels?: number;
  /** Called with the target level index — used only for one-step back navigation */
  onNavigate: (toLevelIndex: number) => void;
  onReset: () => void;
  className?: string;
}

export const DrillBreadcrumb: React.FC<DrillBreadcrumbProps> = ({
  drillPath,
  currentColumn,
  totalLevels,
  onNavigate,
  onReset,
  className = ''
}) => {
  const currentLevel = drillPath.length;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md border-b border-sky-500/20 text-xs text-slate-300 select-none overflow-x-auto ${className}`}
      dir="rtl"
    >
      {/* Breadcrumb Path items */}
      <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
        <span className="flex items-center gap-1 text-sky-400 font-medium pl-1 border-l border-slate-700/60 shrink-0">
          <Layers className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span className="text-[11px] font-semibold">مسار التفصيل:</span>
        </span>

        {/* Root Level (الكل) */}
        <button
          onClick={onReset}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium transition-all duration-150 shrink-0 ${
            currentLevel === 0
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:text-sky-300 hover:bg-slate-800/80'
          }`}
          title="العودة للمستوى الرئيسي (الكل)"
        >
          <Home className="w-3 h-3" />
          <span>الكل</span>
        </button>

        {/* Each drill step in the path — display only, no direct jump */}
        {drillPath.map((step, idx) => {
          const isLast = idx === drillPath.length - 1;
          return (
            <React.Fragment key={`${step.column}-${step.value}-${idx}`}>
              <ChevronLeft className="w-3 h-3 text-slate-500 shrink-0 rotate-0" />
              {/* Read-only indicator — clicking is disabled to enforce gradual drill-up */}
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0 max-w-[140px] truncate cursor-default select-none ${
                  isLast
                    ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40 font-semibold shadow-sm shadow-sky-950'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/50'
                }`}
                title={`${step.column}: ${step.value}`}
              >
                <span className="text-slate-400 text-[10px]">{step.column}:</span>
                <span className="truncate font-medium">{step.value}</span>
              </span>
            </React.Fragment>
          );
        })}

        {/* Current Active Group By Column (if still drilling) */}
        {currentColumn && currentLevel > 0 && (
          <>
            <ChevronLeft className="w-3 h-3 text-slate-600 shrink-0" />
            <span className="px-2 py-0.5 rounded-full bg-slate-800/90 text-amber-300 border border-amber-500/30 font-medium text-[11px] shrink-0">
              حسب: {currentColumn}
            </span>
          </>
        )}
      </div>

      {/* Right side: Level indicator + Quick back button */}
      <div className="flex items-center gap-2 shrink-0">
        {totalLevels && totalLevels > 1 && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
            مستوى {currentLevel + 1}/{totalLevels}
          </span>
        )}

        {currentLevel > 0 && (
          <button
            onClick={() => onNavigate(currentLevel - 1)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-medium transition-all active:scale-95"
            title="رجوع مستوى واحد للخلف"
          >
            <CornerUpLeft className="w-3 h-3" />
            <span>رجوع</span>
          </button>
        )}
      </div>
    </div>
  );
};
