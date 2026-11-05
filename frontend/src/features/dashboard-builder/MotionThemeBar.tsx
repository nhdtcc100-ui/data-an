// ==============================================================================
// MotionThemeBar.tsx - شريط واجهة اختيار أنماط التصميم العشرة (UI Design Styles)
// يعرض الأنماط العشرة في نافذة منبثقة أمام كل المكونات عبر React Portal (z-[999999])
// ==============================================================================

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Check,
  Palette,
  X,
  ChevronDown
} from 'lucide-react';
import {
  MOTION_THEMES,
  type ThemeCategory,
  getMotionTheme
} from '../../services/motionThemes';
import { useDashboardStore } from './DashboardStore';

interface MotionThemeBarProps {
  compact?: boolean;
  className?: string;
}

export const MotionThemeBar: React.FC<MotionThemeBarProps> = ({
  compact = false,
  className = ''
}) => {
  const { motionTheme, setMotionTheme, theme } = useDashboardStore();
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ThemeCategory>('all');

  const currentTheme = getMotionTheme(motionTheme);

  const filteredThemes = selectedCategory === 'all'
    ? MOTION_THEMES
    : selectedCategory === 'ui-styles'
    ? MOTION_THEMES.slice(0, 10) // The 10 primary UI Design Styles
    : MOTION_THEMES.filter((t) => t.category === selectedCategory);

  return (
    <div className={`relative inline-flex items-center shrink-0 ${className}`} dir="rtl">
      {/* ── Trigger Button (Independent, Clear Island in Header) ────────────────── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer group shrink-0 shadow-md ${
          isOpen
            ? 'bg-sky-500/20 border-sky-400 text-sky-500 shadow-sky-500/20'
            : isDark
            ? 'bg-slate-900/90 hover:bg-slate-850 border-slate-700/80 hover:border-sky-500/50 text-slate-200 shadow-black/40'
            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-sky-400 text-slate-700 shadow-xs'
        }`}
        title="تغيير نمط تصميم الواجهات (10 UI Design Styles) للرسوم البيانية والجداول"
      >
        <span className="text-sm shrink-0 leading-none">{currentTheme.icon}</span>

        {!compact && (
          <span className={`text-[11px] sm:text-xs font-semibold flex items-center gap-1 ${
            isDark ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'
          }`}>
            <span className={`hidden lg:inline text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>النمط:</span>
            <strong className="text-sky-500 font-bold truncate max-w-[90px] sm:max-w-[130px]">
              {currentTheme.nameAr}
            </strong>
          </span>
        )}

        {/* Color preview dots */}
        <div className="hidden xs:flex items-center gap-0.5 ml-0.5">
          {currentTheme.previewColors.slice(0, 3).map((c, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full border shrink-0 ${isDark ? 'border-black/50' : 'border-slate-300'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isDark ? 'text-slate-400 group-hover:text-sky-400' : 'text-slate-500 group-hover:text-sky-600'
          } ${isOpen ? 'rotate-180 text-sky-500' : ''}`}
        />
      </button>

      {/* ── Modal Overlay via React Portal (Always In Front of Everything, z-[9999999]) ── */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          dir="rtl"
          onClick={() => setIsOpen(false)}
          className={`fixed inset-0 z-[9999999] backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn overflow-y-auto ${
            isDark ? 'bg-black/80' : 'bg-slate-900/40'
          }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl p-4 sm:p-6 flex flex-col gap-4 text-right overflow-hidden relative my-auto animate-scaleUp border ${
              isDark
                ? 'bg-slate-950 border-slate-700/80 shadow-black text-slate-100'
                : 'bg-white border-slate-200 shadow-xl shadow-slate-300/40 text-slate-800'
            }`}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b pb-3 shrink-0 ${
              isDark ? 'border-slate-800/90' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className={`text-sm sm:text-base font-black ${
                      isDark ? 'text-slate-100' : 'text-slate-800'
                    }`}>
                      أنماط تصميم واجهات المستخدم (10 UI Design Styles)
                    </h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-500 border border-sky-500/30 font-bold">
                      للجداول والرسوم
                    </span>
                  </div>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    اختر نمط الواجهة لتطبيقه فورياً على الجداول والمخططات البيانية بالكامل
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-[11px] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 font-bold'
                    : isDark
                    ? 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                الكل ({MOTION_THEMES.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('ui-styles')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                  selectedCategory === 'ui-styles'
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md font-bold'
                    : isDark
                    ? 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                }`}
              >
                ⭐ أنماط UI الأساسية (10)
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('3d')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                  selectedCategory === '3d'
                    ? 'bg-indigo-500 text-white shadow-md font-bold'
                    : isDark
                    ? 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                📻 مجسم و 3D
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('glass')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                  selectedCategory === 'glass'
                    ? 'bg-cyan-500 text-white shadow-md font-bold'
                    : isDark
                    ? 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                💎 زجاج وسوائل
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('clean')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                  selectedCategory === 'clean'
                    ? 'bg-emerald-500 text-white shadow-md font-bold'
                    : isDark
                    ? 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                🍱 بساطة وبينتو
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('bold')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                  selectedCategory === 'bold'
                    ? 'bg-rose-500 text-white shadow-md font-bold'
                    : isDark
                    ? 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                ⚡ جريء وصاخب
              </button>
            </div>

            {/* Themes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto custom-scrollbar max-h-[54vh] pr-1">
              {filteredThemes.map((theme) => {
                const isSelected = theme.id === motionTheme;

                return (
                  <div
                    key={theme.id}
                    onClick={() => {
                      setMotionTheme(theme.id);
                      setIsOpen(false);
                    }}
                    className={`relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 group ${
                      isSelected
                        ? isDark
                          ? 'bg-slate-900 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.25)] ring-2 ring-sky-400/40'
                          : 'bg-sky-50/90 border-sky-500 shadow-md ring-2 ring-sky-400/30'
                        : isDark
                        ? 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-50/80 hover:bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    {/* Top Row: Icon, Title, Check */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`text-xl shrink-0 p-1 rounded-xl leading-none border ${
                          isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-200 shadow-xs'
                        }`}>
                          {theme.icon}
                        </span>
                        <div className="min-w-0">
                          <div className={`text-xs font-bold transition-colors truncate ${
                            isDark
                              ? 'text-slate-100 group-hover:text-sky-300'
                              : 'text-slate-800 group-hover:text-sky-600'
                          }`}>
                            {theme.nameAr}
                          </div>
                          <div className={`text-[10px] font-mono truncate ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            {theme.nameEn}
                          </div>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/50">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      ) : (
                        <span className={`text-[9.5px] px-2 py-0.5 rounded-md border shrink-0 ${
                          isDark ? 'bg-slate-800 text-slate-400 border-slate-700/60' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {theme.categoryAr}
                        </span>
                      )}
                    </div>

                    {/* Tagline Description */}
                    <p className={`text-[10.5px] leading-relaxed line-clamp-2 ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {theme.tagline}
                    </p>

                    {/* Footer: Palette Swatches */}
                    <div className={`flex items-center justify-between pt-1.5 border-t mt-0.5 ${
                      isDark ? 'border-slate-800/60' : 'border-slate-200'
                    }`}>
                      <span className={`text-[9.5px] font-mono ${
                        isDark ? 'text-slate-500' : 'text-slate-500'
                      }`}>
                        {theme.animation.easing} • {theme.animation.duration}ms
                      </span>

                      <div className="flex items-center gap-1">
                        {theme.previewColors.map((c, idx) => (
                          <span
                            key={idx}
                            className={`w-3 h-3 rounded-full border shadow-xs ${
                              isDark ? 'border-black/50' : 'border-slate-300'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Notice */}
            <div className={`pt-2.5 border-t flex items-center justify-between text-[11px] shrink-0 ${
              isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
            }`}>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>حفظ دائم ومزامنة فورية مع قاعدة البيانات</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
