import React, { useState } from 'react';
import { useDashboardStore } from '../../features/dashboard-builder/DashboardStore';
import { PROJECT_COLOR_ACCENTS } from '../../types/project';
import {
  BarChart2,
  Eye,
  Moon,
  Sun,
  ChevronDown,
  RotateCcw,
  FileSpreadsheet,
  Table,
  Layout,
  Columns,
  Maximize,
  Minimize,
  FileCode,
  Upload,
  RefreshCw,
  FolderKanban,
  Plus,
  Check,
  Layers,
  Trash2,
  Database,
  GitMerge,
  Link2,
  X
} from 'lucide-react';
import { downloadInteractiveHtml } from '../../services/htmlExportService';
import { fetchGoogleSheetData, DEFAULT_GOOGLE_SHEET_URL } from '../../services/googleSheetsService';
import { MotionThemeBar } from '../../features/dashboard-builder/MotionThemeBar';

interface HeaderProps {
  onOpenUploadModal: () => void;
  onOpenWorkspaceView: () => void;
  onOpenDbManager?: () => void;
  onOpenMultiSource?: () => void;
  currentView: 'dashboard' | 'workspaces' | 'public';
  onOpenPublicView?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenUploadModal,
  onOpenWorkspaceView,
  onOpenDbManager,
  onOpenMultiSource,
  onOpenPublicView
}) => {
  const {
    currentDashboard,
    currentDataSource,
    isEditMode,
    theme,
    setTheme,
    activeFilters,
    widgetFilters,
    drillDownStates,
    clearAllFilters,
    sidebarsPlacement,
    setSidebarsPlacement,
    resetToDefaults,
    loadDashboardSnapshot,
    projects,
    currentProjectId,
    switchProject,
    createProject,
    deleteProject
  } = useDashboardStore();

  const filterCount = Object.keys(activeFilters).length;
  const activeProject = projects.find((p) => p.id === currentProjectId);
  const activeAccent = PROJECT_COLOR_ACCENTS.find((a) => a.name === (activeProject?.colorAccent || 'sky')) || PROJECT_COLOR_ACCENTS[0];

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isSyncingGSheet, setIsSyncingGSheet] = React.useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = React.useState<string | null>(null);
  const [isProjectSwitcherOpen, setIsProjectSwitcherOpen] = React.useState(false);
  const [isGSheetModalOpen, setIsGSheetModalOpen] = React.useState(false);
  const [modalSheetUrl, setModalSheetUrl] = React.useState(activeProject?.googleSheetUrl || '');
  const [modalError, setModalError] = React.useState<string | null>(null);
  const fileImportInputRef = React.useRef<HTMLInputElement>(null);
  const switcherRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setModalSheetUrl(activeProject?.googleSheetUrl || '');
  }, [currentProjectId, activeProject?.googleSheetUrl]);

  // Close project switcher on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setIsProjectSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [dbSyncMsg, setDbSyncMsg] = useState<string | null>(null);

  const handleSyncDatabase = async () => {
    setIsSyncingDb(true);
    setDbSyncMsg(null);
    try {
      const res = await useDashboardStore.getState().syncActiveProjectToDatabase();
      if (res.success) {
        setDbSyncMsg(res.message);
        setTimeout(() => setDbSyncMsg(null), 4000);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(`فشل الاتصال بقاعدة البيانات: ${err.message}`);
    } finally {
      setIsSyncingDb(false);
    }
  };

  const handleSyncGoogleSheet = async () => {
    const activeProj = useDashboardStore.getState().projects.find(
      (p) => p.id === useDashboardStore.getState().currentProjectId
    );
    const targetUrl = activeProj?.googleSheetUrl?.trim();

    // If active project has no Google Sheet URL yet (or placeholder), prompt specifically for THIS project's link!
    if (!targetUrl || targetUrl === 'https://docs.google.com/spreadsheets/d/default') {
      setModalSheetUrl(activeProj?.id === 'proj-offers-2026' ? DEFAULT_GOOGLE_SHEET_URL : '');
      setModalError(null);
      setIsGSheetModalOpen(true);
      return;
    }

    setIsSyncingGSheet(true);
    setSyncSuccessMsg(null);
    try {
      const liveDs = await fetchGoogleSheetData(targetUrl);
      useDashboardStore.getState().setDataSource(liveDs);
      useDashboardStore.getState().syncActiveProjectToDatabase().catch((err) => {
        console.warn('Auto DB sync notice:', err);
      });
      const rowCount = liveDs.rawRows?.length || 0;
      setSyncSuccessMsg(rowCount > 0 ? `تمت المزامنة (${rowCount} سجل)` : 'تمت المزامنة بنجاح!');
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to sync Google Sheets:', err);
      alert(err?.message || 'تعذر المزامنة مع Google Sheets حالياً.');
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  const handleSaveAndSyncModal = async () => {
    const trimmed = modalSheetUrl.trim();
    if (!trimmed) {
      setModalError('يرجى إدخال رابط Google Sheet.');
      return;
    }
    setModalError(null);
    setIsSyncingGSheet(true);
    try {
      const liveDs = await fetchGoogleSheetData(trimmed);
      useDashboardStore.getState().setProjectGoogleSheetUrl(currentProjectId, trimmed);
      useDashboardStore.getState().setDataSource(liveDs);
      useDashboardStore.getState().syncActiveProjectToDatabase().catch((err) => {
        console.warn('Auto DB sync notice:', err);
      });
      const rowCount = liveDs.rawRows?.length || 0;
      setSyncSuccessMsg(rowCount > 0 ? `تمت المزامنة (${rowCount} سجل)` : 'تمت المزامنة بنجاح!');
      setIsGSheetModalOpen(false);
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err: any) {
      setModalError(err?.message || 'تعذر جلب البيانات من Google Sheet. تأكد من صحة الرابط وصلاحية المشاركة.');
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  const handleImportPackageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.dashboard) {
          loadDashboardSnapshot({
            dashboard: parsed.dashboard,
            dataSource: parsed.dataSource,
            theme: parsed.theme,
            drillDownStates: parsed.drillDownStates,
            widgetFilters: parsed.widgetFilters,
            activeFilters: parsed.activeFilters
          });
          alert('✅ تم استيراد التقرير والبيانات بنجاح!');
        } else {
          alert('❌ الملف غير صالح أو لا يحتوي على بنية لوحة تحكم صالحة.');
        }
      } catch (err) {
        console.error('Failed to parse package:', err);
        alert('❌ تعذر قراءة ملف الحزمة.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header className="flex flex-col select-none z-30 shrink-0 header-3d">
      {/* ── Top Bar 1 — always visible ── */}
      <div className="h-13 px-4 sm:px-6 flex items-center justify-between">
        {/* Right side (RTL): Brand + Workspace + Save Status */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div
            onClick={onOpenWorkspaceView}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white badge-3d group-hover:scale-105 transition-transform shrink-0">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white tracking-wide block">
                  LENS <span className="text-sky-400 font-normal">BI</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono hidden xs:inline shadow-3d-xs">
                  Enterprise
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-mono block truncate">DuckDB OLAP Engine</span>
            </div>
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          {/* ── Project Switcher Dropdown ── */}
          <div ref={switcherRef} className="relative">
            <button
              onClick={() => setIsProjectSwitcherOpen(!isProjectSwitcherOpen)}
              className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border transition cursor-pointer shrink-0 ${
                isProjectSwitcherOpen ? 'border-sky-500/60 bg-slate-800' : 'border-slate-700/60'
              }`}
            >
              <span className="text-base leading-none">{activeProject?.icon || '📊'}</span>
              <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px] sm:max-w-[180px]">
                {activeProject?.title || currentDashboard.title}
              </span>
              <div className="flex items-center gap-1 mr-1">
                {projects.length > 1 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activeAccent.bg} ${activeAccent.text} border ${activeAccent.border}`}>
                    {projects.length}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isProjectSwitcherOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Dropdown Panel */}
            {isProjectSwitcherOpen && (
              <div className="absolute top-full mt-2 right-0 z-50 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-bold text-slate-200">مشاريعي ({projects.length})</span>
                  </div>
                  <button
                    onClick={() => { onOpenWorkspaceView(); setIsProjectSwitcherOpen(false); }}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold transition"
                  >
                    إدارة الكل
                  </button>
                </div>

                {/* Projects list */}
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  {projects.map((proj) => {
                    const accent = PROJECT_COLOR_ACCENTS.find((a) => a.name === proj.colorAccent) || PROJECT_COLOR_ACCENTS[0];
                    const isActive = proj.id === currentProjectId;
                    return (
                      <div
                        key={proj.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => { switchProject(proj.id); setIsProjectSwitcherOpen(false); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { switchProject(proj.id); setIsProjectSwitcherOpen(false); } }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition hover:bg-slate-800 cursor-pointer ${
                          isActive ? 'bg-slate-800/70' : ''
                        }`}
                      >
                        <span className="text-lg leading-none shrink-0">{proj.icon || '📁'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-200 truncate">{proj.title}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {proj.dashboard.widgets.length} عناصر • {proj.dataSourceType === 'google_sheets' ? '🟢 Google Sheets' : '📑 ملف'}
                          </div>
                        </div>
                        {isActive ? (
                          <Check className={`w-4 h-4 shrink-0 ${accent.text}`} />
                        ) : (
                          projects.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); if (window.confirm(`حذف مشروع "${proj.title}"؟`)) deleteProject(proj.id); }}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
                              title="حذف المشروع"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer actions */}
                <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
                  <button
                    onClick={() => {
                      const title = window.prompt('اسم المشروع الجديد:');
                      if (title?.trim()) {
                        createProject({ title: title.trim(), dataSourceType: 'empty', icon: '📊', colorAccent: 'emerald' });
                        setIsProjectSwitcherOpen(false);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>مشروع جديد</span>
                  </button>
                  <button
                    onClick={() => { onOpenWorkspaceView(); setIsProjectSwitcherOpen(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>معرض المشاريع</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live Google Sheets Cloud Sync Group (Per-Project) */}
          <div className="flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 p-0.5 shrink-0 shadow-sm">
            <button
              onClick={handleSyncGoogleSheet}
              disabled={isSyncingGSheet}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 ${
                syncSuccessMsg
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'hover:bg-emerald-500/20 text-emerald-300'
              }`}
              title={
                activeProject?.googleSheetUrl
                  ? `مزامنة حية من Google Sheet المخصص لمشروع "${activeProject?.title}"`
                  : `ربط Google Sheet خاص بمشروع "${activeProject?.title || currentDashboard.title}"`
              }
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingGSheet ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isSyncingGSheet
                  ? 'جارٍ المزامنة...'
                  : syncSuccessMsg
                  ? syncSuccessMsg
                  : 'Google Sheets مزامنة'}
              </span>
            </button>

            <button
              onClick={() => {
                setModalSheetUrl(activeProject?.googleSheetUrl || '');
                setModalError(null);
                setIsGSheetModalOpen(true);
              }}
              className="p-1 px-1.5 rounded-full hover:bg-emerald-500/25 text-emerald-300/80 hover:text-emerald-200 transition cursor-pointer"
              title="تعديل أو استعراض رابط Google Sheet المخصص لهذا المشروع"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Direct Database Sync Button */}
          <button
            onClick={handleSyncDatabase}
            disabled={isSyncingDb}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 ${
              dbSyncMsg
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                : 'bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-200'
            }`}
            title="مزامنة بيانات وسجلات المشروع الحالي مع قاعدة بيانات PostgreSQL و Supabase"
          >
            <span className={`w-2 h-2 rounded-full ${dbSyncMsg ? 'bg-white' : 'bg-indigo-400'} animate-pulse`} />
            <Database className={`w-3.5 h-3.5 text-indigo-300 ${isSyncingDb ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isSyncingDb
                ? 'جارٍ المزامنة مع DB...'
                : dbSyncMsg
                ? 'تمت مزامنة DB!'
                : 'مزامنة مع قاعدة البيانات'}
            </span>
          </button>

          {/* Auto-save Status Badge */}
          <div
            title="أي تعديل تجريه يتم حفظه تلقائياً كآخر نسخة في المتصفح"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700/60 text-slate-400 text-xs font-medium shrink-0"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>حفظ تلقائي</span>
          </div>
        </div>

        {/* Left side (RTL): Primary Controls — hidden on mobile (handled by bottom nav) */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          {/* Dedicated UI Design Styles & Motion Theme Island */}
          <div className="flex items-center pl-2.5 ml-1 border-l border-slate-800/90 shrink-0">
            <MotionThemeBar />
          </div>

          {/* View Mode (وضع العرض) Button */}
          {onOpenPublicView && (
            <button
              onClick={onOpenPublicView}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-sky-500/25 transition cursor-pointer"
              title="فتح وضع العرض كصفحة مستقلة للمشاهدة بدون تعديل وقابلة للإرسال بالرابط (محمية برمز الأدمن 4444)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>وضع العرض</span>
            </button>
          )}

          {/* Fullscreen Presentation Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
            title={isFullscreen ? 'تصغير الشاشة' : 'عرض بملء الشاشة التقديمي'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
            title="تبديل النمط الداكن/الفاتح"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />}
          </button>
        </div>

        {/* Mobile: Theme toggle only (compact) */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
            title="تبديل النمط الداكن/الفاتح"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />}
          </button>
        </div>
      </div>

      {/* ── Top Bar 2 — hidden on mobile, visible on md+ ── */}
      <div className="min-h-10 glass-3d border-b border-slate-800/60 px-4 sm:px-6 py-1 hidden md:flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar">
        {/* Right side (RTL): Filter status + Data actions */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          {/* Active Filters Pill */}
          {filterCount > 0 ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-xs text-sky-300">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="font-semibold">{filterCount} فلاتر نشطة</span>
              <button
                onClick={clearAllFilters}
                title="مسح كل الفلاتر"
                className="hover:text-white transition cursor-pointer mr-1 flex items-center gap-1 text-[11px] bg-slate-800 px-1.5 py-0.5 rounded"
              >
                <RotateCcw className="w-3 h-3" />
                <span>مسح</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 px-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
              <span>جميع البيانات معروضة</span>
            </div>
          )}

          {/* Separator */}
          <div className="h-4 w-px bg-slate-800" />

          {/* Data Grid Viewer & Editor Button - Only in Edit Mode */}
          {isEditMode && (
            <button
              onClick={() => useDashboardStore.getState().setDataGridOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-sky-300 border border-slate-700/80 text-xs font-semibold transition cursor-pointer"
              title="عرض السجلات وتعديل البيانات"
            >
              <Table className="w-3.5 h-3.5 text-sky-400" />
              <span>مستعرض البيانات</span>
            </button>
          )}

          {/* Upload / Change Excel Button - Only in Edit Mode */}
          {isEditMode && (
            <button
              onClick={onOpenUploadModal}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-xs font-semibold transition cursor-pointer shadow-sm shadow-emerald-500/10"
              title="رفع ملف Excel أو CSV وتوليد لوحة مؤشرات وتحليلات ذكية تلقائياً"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>رفع / تغيير ملف Excel</span>
            </button>
          )}

          {/* Multi-Source Linker Button */}
          {isEditMode && onOpenMultiSource && (
            <button
              onClick={onOpenMultiSource}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-xs font-semibold transition cursor-pointer shadow-sm shadow-sky-500/10"
              title="ربط أكثر من ملف أو جدول وكشف العلاقات تلقائياً — Power Query Engine"
            >
              <GitMerge className="w-3.5 h-3.5 text-sky-400" />
              <span>ربط مصادر متعددة</span>
              <span className="text-[9px] bg-sky-500/20 text-sky-200 px-1 py-0.5 rounded">NEW</span>
            </button>
          )}

          {/* Database Control & Operations Center Button - Always accessible */}
          {onOpenDbManager && (
            <button
              onClick={onOpenDbManager}
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-violet-900/60 to-indigo-900/60 hover:from-violet-800/80 hover:to-indigo-800/80 text-violet-200 border border-violet-500/40 text-xs font-bold transition cursor-pointer shadow-sm shadow-violet-900/30 group"
              title="مركز تشغيل وفحص وإدارة قاعدة بيانات المشاريع (PostgreSQL 17 / Supabase / DuckDB)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <Database className="w-3.5 h-3.5 text-violet-300 group-hover:rotate-12 transition-transform shrink-0" />
              <span>تشغيل / إدارة قاعدة البيانات</span>
            </button>
          )}

          {/* Import Complete Report Package (.lensbi / .json) */}
          <button
            onClick={() => fileImportInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 text-xs font-medium transition cursor-pointer"
            title="استيراد لوحة تحكم وبيانات كاملة من ملف .lensbi أو .json تم تصديره"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">استيراد تقرير (.lensbi)</span>
          </button>
          <input
            ref={fileImportInputRef}
            type="file"
            accept=".lensbi,.json"
            className="hidden"
            onChange={handleImportPackageFile}
          />
        </div>

        {/* Left side (RTL): Secondary tools (Layout, Public Preview, Export HTML, Reset) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Layout Mode (Power BI Side-by-Side vs Split vs Left) - Only in Edit Mode */}
          {isEditMode && (
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80 text-xs">
              <button
                onClick={() => setSidebarsPlacement('powerbi-right')}
                title="نمط باور بي آي: الألواح متجاورة معاً على اليمين"
                className={`flex items-center gap-1 px-2 py-0.5 rounded transition cursor-pointer text-[11px] ${
                  sidebarsPlacement === 'powerbi-right'
                    ? 'bg-sky-500 text-white font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layout className="w-3 h-3" />
                <span className="hidden md:inline">Power BI</span>
              </button>
              <button
                onClick={() => setSidebarsPlacement('split')}
                title="نمط منفصل: لوحة على اليمين وأخرى على اليسار"
                className={`flex items-center gap-1 px-2 py-0.5 rounded transition cursor-pointer text-[11px] ${
                  sidebarsPlacement === 'split'
                    ? 'bg-sky-500 text-white font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Columns className="w-3 h-3" />
                <span className="hidden md:inline">منفصل</span>
              </button>
              <button
                onClick={() => setSidebarsPlacement('powerbi-left')}
                title="نمط يسار: الألواح متجاورة معاً على اليسار"
                className={`flex items-center gap-1 px-2 py-0.5 rounded transition cursor-pointer text-[11px] ${
                  sidebarsPlacement === 'powerbi-left'
                    ? 'bg-sky-500 text-white font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layout className="w-3 h-3 rotate-180" />
                <span className="hidden md:inline">يسار</span>
              </button>
            </div>
          )}


          {/* Export Interactive HTML Button */}
          <button
            onClick={() => downloadInteractiveHtml(currentDashboard, currentDataSource, theme, widgetFilters, activeFilters, drillDownStates)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-755 text-sky-300 hover:text-white border border-slate-700/80 text-xs font-medium transition cursor-pointer"
            title="تصدير التقرير كملف HTML تفاعلي مستقل يعمل أوفلاين بالكامل"
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">تصدير HTML</span>
          </button>

          {/* Reset to Default Button - Only in Edit Mode */}
          {isEditMode && (
            <button
              onClick={() => {
                if (window.confirm('هل تريد إعادة تعيين اللوحة والبيانات إلى الوضع الافتراضي؟')) {
                  resetToDefaults();
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700/80 text-xs font-medium transition cursor-pointer"
              title="إعادة ضبط اللوحة إلى البيانات الافتراضية"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden xl:inline">استعادة الافتراضي</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Per-Project Google Sheet URL Settings Modal ── */}
      {isGSheetModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsGSheetModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">رابط Google Sheet الخاص بهذا المشروع</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    مشروع: <span className="text-emerald-400 font-semibold">{activeProject?.title || currentDashboard.title}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGSheetModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 leading-relaxed">
                ✨ <strong>استقلالية تامة:</strong> كل مشروع يرتبط برابط Google Sheet خاص به ومستقل عن باقي المشاريع. تحديث هذا الرابط سيؤثر حصرياً على هذا المشروع دون التداخل مع المشاريع السابقة.
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">رابط ملف Google Sheet لهذا المشروع</label>
                <input
                  type="url"
                  value={modalSheetUrl}
                  onChange={(e) => {
                    setModalSheetUrl(e.target.value);
                    if (modalError) setModalError(null);
                  }}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500/60 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition font-mono"
                />
              </div>

              {modalError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {modalError}
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                💡 تأكد من فتح ملف Google Sheet ثم الضغط على <strong>«مشاركة / Share»</strong> وتغيير الوصول إلى: <strong>«أي شخص لديه الرابط يمكنه العرض»</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsGSheetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveAndSyncModal}
                disabled={isSyncingGSheet || !modalSheetUrl.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGSheet ? 'animate-spin' : ''}`} />
                <span>{isSyncingGSheet ? 'جارٍ المزامنة...' : 'حفظ ومزامنة فورية'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
