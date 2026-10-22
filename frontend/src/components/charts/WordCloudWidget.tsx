import React, { useMemo } from 'react';
import { Cloud } from 'lucide-react';

interface WordCloudWidgetProps {
  categories: string[];
  values: number[];
  theme?: string;
  activeWord?: string | null;
  onWordClick: (word: string, value: number) => void;
  formatNumber?: (val: number) => string;
}

const THEME_PALETTES: Record<string, string[]> = {
  sky: ['#38bdf8', '#0284c7', '#0ea5e9', '#7dd3fc', '#bae6fd', '#0369a1'],
  emerald: ['#34d399', '#059669', '#10b981', '#6ee7b7', '#a7f3d0', '#047857'],
  violet: ['#a78bfa', '#7c3aed', '#8b5cf6', '#c4b5fd', '#ddd6fe', '#6d28d9'],
  amber: ['#fbbf24', '#d97706', '#f59e0b', '#fcd34d', '#fde68a', '#b45309'],
  rose: ['#fb7185', '#e11d48', '#f43f5e', '#fda4af', '#fecdd3', '#be123c'],
  cyan: ['#22d3ee', '#0891b2', '#06b6d4', '#67e8f9', '#a5f3fc', '#0e7490'],
  slate: ['#94a3b8', '#475569', '#64748b', '#cbd5e1', '#e2e8f0', '#334155']
};

export const WordCloudWidget: React.FC<WordCloudWidgetProps> = ({
  categories,
  values,
  theme = 'sky',
  activeWord = null,
  onWordClick,
  formatNumber = (v) => v.toLocaleString()
}) => {
  const palette = THEME_PALETTES[theme] || THEME_PALETTES.sky;

  const { minVal, maxVal, words } = useMemo(() => {
    if (!categories || categories.length === 0) {
      return { minVal: 0, maxVal: 0, words: [] };
    }

    let min = Infinity;
    let max = -Infinity;
    const items = categories.map((cat, idx) => {
      const val = values[idx] || 0;
      if (val < min) min = val;
      if (val > max) max = val;
      return { text: cat, value: val, originalIndex: idx };
    });

    if (min === Infinity) min = 0;
    if (max === -Infinity) max = 0;

    return { minVal: min, maxVal: max, words: items };
  }, [categories, values]);

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs gap-2">
        <Cloud className="w-8 h-8 opacity-40" />
        <span>لا توجد بيانات كافية لعرض سحابة الكلمات</span>
      </div>
    );
  }

  const range = maxVal - minVal || 1;

  return (
    <div
      className="flex flex-wrap items-center justify-center content-center gap-2.5 p-4 h-full overflow-y-auto select-none custom-scrollbar"
      dir="rtl"
    >
      {words.map((item, idx) => {
        // Calculate font size from 12px to 34px
        const ratio = (item.value - minVal) / range;
        const fontSize = Math.round(12 + ratio * 22);
        const color = palette[idx % palette.length];
        const isSelected = activeWord === item.text;
        const opacity = activeWord && !isSelected ? 0.35 : 1;

        return (
          <button
            key={`${item.text}-${idx}`}
            onClick={() => onWordClick(item.text, item.value)}
            style={{
              fontSize: `${fontSize}px`,
              color: isSelected ? '#ffffff' : color,
              opacity,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            title={`${item.text}: ${formatNumber(item.value)}`}
            className={`group relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 ${
              isSelected
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/40 ring-2 ring-white/60'
                : 'bg-slate-800/50 hover:bg-slate-800/90 border border-slate-700/40 hover:border-sky-500/50 hover:shadow-md'
            }`}
          >
            <span className="font-tajawal truncate max-w-[220px]">{item.text}</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-900/60 text-slate-400 group-hover:text-sky-300'
              }`}
            >
              {formatNumber(item.value)}
            </span>
          </button>
        );
      })}
    </div>
  );
};
