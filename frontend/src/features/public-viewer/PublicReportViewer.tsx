import React, { useEffect, useState, useRef } from 'react';
import { useDashboardStore } from '../dashboard-builder/DashboardStore';
import { WidgetContainer } from '../../components/canvas/WidgetContainer';
import {
  BarChart2,
  Download,
  RotateCcw,
  ShieldCheck,
  Eye,
  FileCode,
  Maximize2,
  Lock,
  Unlock,
  AlertCircle,
  X,
  Share2,
  Check,
  KeyRound
} from 'lucide-react';
import { downloadInteractiveHtml, downloadDatasetAsJson } from '../../services/htmlExportService';
import { buildShareUrl } from '../../services/snapshotService';
import { MotionThemeBar } from '../dashboard-builder/MotionThemeBar';

const ADMIN_PIN = '4444';

interface PublicReportViewerProps {
  isOwner?: boolean;
  onBackToApp?: () => void;
  notFound?: boolean;
  notFoundMessage?: string;
  isLoading?: boolean;
}

export const PublicReportViewer: React.FC<PublicReportViewerProps> = ({
  onBackToApp,
  notFound = false,
  notFoundMessage,
  isLoading = false
}) => {
  const {
    currentDashboard,
    currentDataSource,
    activeFilters,
    widgetFilters,
    drillDownStates,
    clearAllFilters,
    setEditMode,
    theme,
    currentProjectId,
    motionTheme
  } = useDashboardStore();

  // Admin PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinShake, setPinShake] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Force read-only mode while in viewer
  useEffect(() => {
    setEditMode(false);
  }, [setEditMode]);

  // Keyboard shortcut (Alt + A) to trigger admin PIN prompt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key.toLowerCase() === 'a') || (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'e')) {
        e.preventDefault();
        setShowPinModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus pin input when modal opens
  useEffect(() => {
    if (showPinModal) {
      setTimeout(() => pinInputRef.current?.focus(), 100);
    } else {
      setPin('');
      setPinError(false);
    }
  }, [showPinModal]);

  // Handle PIN submission
  const handlePinSubmit = () => {
    if (pin.trim() === ADMIN_PIN) {
      setShowPinModal(false);
      setEditMode(true);
      if (onBackToApp) {
        onBackToApp();
      } else {
        // Remove public view query params from URL and navigate to dashboard
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('view');
          url.searchParams.delete('r');
          url.searchParams.delete('snap');
          url.searchParams.delete('snapshot');
          url.searchParams.delete('shared');
          window.history.pushState({}, '', url.pathname || '/');
          window.location.reload();
        } catch {
          window.location.href = window.location.origin;
        }
      }
    } else {
      setPinError(true);
      setPinShake(true);
      setPin('');
      setTimeout(() => setPinShake(false), 500);
    }
  };

  // Copy complete resilient shareable link with project ID and snapshot payload
  const handleCopyShareLink = () => {
    try {
      const shareUrl = buildShareUrl(
        currentDashboard,
        currentDataSource,
        theme,
        drillDownStates,
        widgetFilters,
        activeFilters,
        currentProjectId
      );
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };


  const filterCount = Object.keys(activeFilters).filter((key) => {
    const val = activeFilters[key];
    if (Array.isArray(val)) return val.length > 0;
    return val !== null && val !== undefined && val !== '';
  }).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <div className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin mb-4" />
        <h3 className="text-sm font-bold text-slate-200">جاري تحميل بيانات التقرير من قاعدة البيانات...</h3>
        <p className="text-xs text-slate-500 mt-1">يتم جلب الرسوم البيانية والجداول الخاصة بهذا المشروع مباشرة</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-6 shadow-xl shadow-rose-500/10">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
          عذراً، هذا التقرير غير متوفر أو تم حذفه
        </h2>
        <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
          {notFoundMessage || 'لم يتم العثور على بيانات هذا المشروع في قاعدة البيانات. قد يكون المنشئ قام بحذف المشروع نهائياً أو أن رابط المشاركة غير صحيح.'}
        </p>
        {onBackToApp && (
          <button
            onClick={onBackToApp}
            className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-sky-500/20 cursor-pointer inline-flex items-center gap-2"
          >
            <span>العودة إلى منصة التحليلات</span>
          </button>
        )}
      </div>
    );
  }

  const getColSpanClass = (w?: number) => {
    switch (w) {
      case 3:  return 'col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3';
      case 4:  return 'col-span-12 sm:col-span-6 lg:col-span-4';
      case 6:  return 'col-span-12 lg:col-span-6';
      case 8:  return 'col-span-12 lg:col-span-8';
      case 12: return 'col-span-12';
      default: return 'col-span-12 lg:col-span-6';
    }
  };

  const getWidgetHeight = (widget: (typeof currentDashboard.widgets)[0]) => {
    const h = widget?.layout?.h || 4;
    if (widget?.type === 'kpi')    return Math.max(140, h * 75);
    if (widget?.type === 'slicer') return Math.max(180, h * 80);
    if (widget?.type === 'table' || widget?.type === 'pivot') return Math.max(400, h * 75);
    return Math.max(280, h * 85);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 select-none overflow-hidden" dir="rtl">

      {/* ── Admin PIN Modal (4444) ─────────────────────────────────────────── */}
      {showPinModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
          <div
            className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-black/80 w-full max-w-sm flex flex-col gap-5 relative"
            style={{ animation: pinShake ? 'shake 0.4s ease-in-out' : undefined }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>دخول الأدمن</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      محمي برمز
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">أدخل الرمز السري للرجوع إلى وضع التعديل</p>
                </div>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* PIN input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>رمز الأدمن السري (PIN)</span>
              </label>
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setPinError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePinSubmit();
                  if (e.key === 'Escape') setShowPinModal(false);
                }}
                placeholder="أدخل الرمز السري"
                maxLength={8}
                className={`w-full bg-slate-800/90 border ${
                  pinError ? 'border-rose-500 text-rose-300 ring-2 ring-rose-500/20' : 'border-slate-700 focus:border-amber-500'
                } text-slate-100 text-center text-xl font-mono rounded-xl px-4 py-3 focus:outline-none transition tracking-[0.5em] placeholder:tracking-normal placeholder:text-slate-500 placeholder:text-xs`}
              />
              {pinError && (
                <div className="flex items-center gap-1.5 text-rose-400 text-xs mt-1 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>رمز الأدمن غير صحيح! لا يمكن الدخول لوضع التعديل بدون الرمز السري.</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handlePinSubmit}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>فتح وضع التعديل</span>
              </button>
              <button
                onClick={() => setShowPinModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer border border-slate-700/60"
              >
                إلغاء
              </button>
            </div>
          </div>

          {/* Shake animation */}
          <style>{`
            @keyframes shake {
              0%,100%{transform:translateX(0)}
              15%{transform:translateX(-8px)}
              30%{transform:translateX(8px)}
              45%{transform:translateX(-6px)}
              60%{transform:translateX(6px)}
              75%{transform:translateX(-3px)}
              90%{transform:translateX(3px)}
            }
          `}</style>
        </div>
      )}

      {/* ── Top Bar 1: Brand & Title ─────────────────────────────────────────── */}
      <header className={`h-14 no-print ${theme === 'light' ? 'bg-[#e2e8f0] border-b border-[#cbd5e1] text-slate-900 shadow-xs' : 'bg-slate-900/95 border-b border-slate-800/90 text-slate-100'} px-4 sm:px-6 flex items-center justify-between z-20 backdrop-blur-md shrink-0`}>
        {/* Mobile View: Project Title alone takes the top bar */}
        <div className="flex sm:hidden items-center justify-between w-full min-w-0">
          <h1 className="text-sm font-extrabold truncate tracking-wide flex-1 text-center" title={currentDashboard.title}>
            {currentDashboard.title}
          </h1>
          <button
            onClick={() => setShowPinModal(true)}
            className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 text-xs shrink-0 ml-1"
            title="دخول الأدمن برمز PIN"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Desktop View (sm and above) */}
        <div className="hidden sm:flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/25 shrink-0">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-extrabold truncate max-w-[200px] sm:max-w-md" title={currentDashboard.title}>
                {currentDashboard.title}
              </h1>
              <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                LENS BI
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate hidden xs:block">
              تقرير تفاعلي تحليلي • معالجة فورية عبر المتصفح
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 text-[10.5px] px-2.5 py-1 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/70 font-medium">
            <Eye className="w-3 h-3 text-sky-400" />
            <span>عرض للقراءة فقط</span>
          </span>
          <span className="hidden sm:flex items-center gap-1.5 text-[10.5px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-medium">
            <ShieldCheck className="w-3 h-3" />
            <span>محمي ومؤمن</span>
          </span>

          {/* Admin Unlock Button */}
          <button
            onClick={() => setShowPinModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
            title="دخول الأدمن برمز PIN (4444) للعودة لوضع التعديل"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">دخول الأدمن</span>
          </button>
        </div>
      </header>

      {/* ── Top Bar 2: Filters & Actions ─────────────────────────────────────── */}
      <div className={`min-h-11 no-print ${theme === 'light' ? 'bg-[#f1f5f9] border-b border-[#cbd5e1] text-slate-900' : 'bg-slate-950/90 border-b border-slate-800/90'} px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 z-10 backdrop-blur-sm shrink-0`}>
        <div className="flex items-center gap-2 min-w-0">
          {filterCount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
                <span>{filterCount} فلاتر نشطة</span>
              </span>
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-sky-400" />
                <span>إعادة ضبط</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400/80"></span>
              <span>جميع البيانات معروضة (بدون تصفية)</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Animated Themes Selector for Charts and Tables */}
          <MotionThemeBar />

          {/* Copy Shareable URL button */}
          <button
            onClick={handleCopyShareLink}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
              copiedLink
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/20'
                : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white border-sky-500/35'
            }`}
            title="نسخ رابط هذه الصفحة لمشاركته وإرساله للمشاهدين"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Share2 className="w-3.5 h-3.5 text-sky-400" />}
            <span>{copiedLink ? 'تم نسخ الرابط!' : 'نسخ رابط الصفحة'}</span>
          </button>

          {/* Export HTML (Embedded JSON) */}
          <button
            onClick={() => downloadInteractiveHtml(currentDashboard, currentDataSource, theme, widgetFilters, activeFilters, drillDownStates, motionTheme)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-semibold transition cursor-pointer"
            title="تنزيل كملف HTML مستقل أوفلاين مدمج ببيانات JSON بالكامل"
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">HTML مدمج</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={() => downloadDatasetAsJson(currentDataSource, currentDashboard?.title)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-semibold transition cursor-pointer"
            title="تصدير السجلات والبيانات فقط كملف JSON مستقل"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-700/60"
            title="طباعة التقرير أو حفظه كـ PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-700/60"
            title="ملء الشاشة"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Canvas (Widgets only, no edit controls) ─────────────────────────── */}
      <main
        className={`flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar transition-colors duration-300 ${
          theme === 'dark' ? 'bg-slate-950' : 'bg-[#f1f5f9]'
        }`}
      >
        {/* Dedicated Landscape Print Paper Header (visible ONLY during print / PDF) */}
        <div className="print-paper-header">
          <div className="print-title-area">
            <h1>{currentDashboard?.title || 'تقرير تحليلي تنفيذي'}</h1>
            <p>{currentDataSource?.fileName ? `مصدر البيانات: ${currentDataSource.fileName}` : 'بيانات مساحة العمل المباشرة'}</p>
          </div>
          <div className="print-meta-area">
            <div>تاريخ الاستخراج: <b>{new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</b></div>
            <div>إجمالي السجلات: <b>{(currentDataSource?.rawRows?.length || 0).toLocaleString()} سجل</b></div>
          </div>
        </div>

        <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="grid grid-cols-12 gap-4 max-w-[1600px] mx-auto relative z-10">
          {(currentDashboard?.widgets || []).map((widget) => {
            if (!widget) return null;
            const colWidth = widget.layout?.w ?? (widget.type === 'slicer' || widget.type === 'table' ? 12 : 6);
            return (
              <div
                key={widget.id}
                className={getColSpanClass(colWidth)}
                style={{ minHeight: `${getWidgetHeight(widget)}px` }}
              >
                <WidgetContainer widget={widget} />
              </div>
            );
          })}
        </div>

        {currentDashboard.widgets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-slate-500">
            <BarChart2 className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm font-semibold text-slate-400">لا توجد عناصر في هذا التقرير</p>
          </div>
        )}

        {/* Dedicated Print Paper Footer (visible ONLY during print / PDF) */}
        <div className="print-paper-footer">
          <span>تم إنشاء واستخراج التقرير رسمياً</span>
          <span>نسخة معتمدة • صفحة غير قابلة للتجزئة</span>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className={`h-8 no-print ${theme === 'light' ? 'bg-[#e2e8f0] border-t border-[#cbd5e1] text-slate-700' : 'bg-slate-900/80 border-t border-slate-800/80 text-slate-500'} px-4 sm:px-5 flex items-center justify-between text-[10.5px] font-mono shrink-0`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>مؤمّن • وضع العرض والمشاهدة فقط</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">آخر تحديث: {new Date().toLocaleTimeString('ar-IQ')}</span>
          <button
            onClick={() => setShowPinModal(true)}
            className="flex items-center gap-1 text-slate-400 hover:text-amber-400 transition cursor-pointer px-1.5 py-0.5 rounded bg-slate-800/60 hover:bg-slate-800"
            title="دخول الأدمن برمز PIN (4444)"
          >
            <Lock className="w-3 h-3" />
            <span>لوحة الأدمن</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
