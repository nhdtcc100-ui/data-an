import React, { useState, useEffect, useRef } from 'react';
import { useDashboardStore } from './features/dashboard-builder/DashboardStore';
import { Header } from './components/layout/Header';
import { DataPanel } from './features/dashboard-builder/DataPanel';
import { VisualizationsPanel } from './features/dashboard-builder/VisualizationsPanel';
import { DashboardCanvas } from './components/canvas/DashboardCanvas';
import { ShareModal } from './features/share/ShareModal';
import { DropzoneModal } from './features/file-upload/Dropzone';
import { DataGridModal } from './features/data-table/DataGridModal';
import { WorkspaceList } from './features/workspace/WorkspaceList';
import { PublicReportViewer } from './features/public-viewer/PublicReportViewer';
import { DataSourcesManager } from './features/database/DataSourcesManager';
import { DatabaseControlModal } from './features/database/DatabaseControlModal';
import { decodeSnapshot, expandDashboard } from './services/snapshotService';
import { fetchGoogleSheetData, DEFAULT_GOOGLE_SHEET_URL } from './services/googleSheetsService';
import { saveAllProjectsToDb, loadProjectByIdFromDb } from './services/projectsDbService';
import { getDeletedProjectIds } from './services/deletedProjectsTracker';
import { MultiSourceModal } from './features/data-model/MultiSourceModal';
import { LiveSyncBanner } from './features/data-model/LiveSyncBanner';
import { liveWatcherService } from './services/localFileWatcherService';
import { multiModelToDataSource } from './services/mergeEngine';
import type { Column, MultiTableDataSource, DataSource } from './types/dataSource';
import {
  Database,
  BarChart2,
  LayoutGrid,
  Eye,
  X
} from 'lucide-react';

// ─── Public view detection ────────────────────────────────────────────────────
function detectPublicViewMode(): boolean {
  try {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.endsWith('/view') || pathname.endsWith('/view.html') || pathname.includes('/public')) {
      return true;
    }
    const sp = new URLSearchParams(window.location.search);
    const hp = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (sp.get('view') === 'public' || hp.get('view') === 'public') return true;
    if (sp.get('project') || hp.get('project') || sp.get('projectId') || hp.get('projectId') || sp.get('p') || hp.get('p')) return true;
    if (sp.get('r') || hp.get('r')) return true;
    if (sp.get('snap') || hp.get('snap') || sp.get('snapshot') || hp.get('snapshot')) return true;
    if (sp.get('shared') === '1' || hp.get('shared') === '1') return true;
  } catch { /* ignore */ }
  return false;
}

// ─── Mobile bottom tab types ──────────────────────────────────────────────────
type MobileTab = 'dashboard' | 'data' | 'visuals';

export const App: React.FC = () => {
  const {
    currentDataSource,
    currentDashboard,
    selectedWidgetId,
    updateWidgetConfig,
    addWidget,
    theme,
    isEditMode,
    setEditMode,
    sidebarsPlacement,
    loadDashboardSnapshot,
    isDbControlOpen,
    setDbControlOpen
  } = useDashboardStore();

  const [isPublicView] = useState<boolean>(() => detectPublicViewMode());
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspaces' | 'public'>(
    isPublicView ? 'public' : 'dashboard'
  );
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDbManagerOpen, setIsDbManagerOpen] = useState(false);
  const [isMultiSourceOpen, setIsMultiSourceOpen] = useState(false);

  // Dedicated project share loading & error states
  const [sharedProjectLoading, setSharedProjectLoading] = useState(false);
  const [sharedProjectNotFound, setSharedProjectNotFound] = useState(false);
  const [sharedProjectError, setSharedProjectError] = useState('');

  // ── Auto-save debounce timer ref ───────────────────────────────────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile: which panel is visible
  const [mobileTab, setMobileTab] = useState<MobileTab>('dashboard');
  // Mobile: is the data/visuals drawer open as an overlay?
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // ── Sync theme class to <html> and <body> elements ────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      document.body.classList.add('dark');
      document.body.classList.remove('light-mode');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      document.body.classList.remove('dark');
      document.body.classList.add('light-mode');
    }
  }, [theme]);

  // ── Open View Mode (clean URL: /?view=public) ──────────────────────────────
  const handleOpenPublicView = () => {
    try {
      const base = window.location.origin + window.location.pathname.replace(/\/view(\.html)?$/, '').replace(/\/index\.html$/, '').replace(/\/+$/, '');
      const cleanUrl = `${base}/?view=public`;
      window.history.pushState({}, '', cleanUrl);
    } catch {
      try {
        window.history.pushState({}, '', '?view=public');
      } catch { /* ignore */ }
    }
    setEditMode(false);
    setCurrentView('public');
  };

  // ── Admin unlock to return to edit dashboard (PIN 4444) ────────────────────
  const handleAdminUnlock = () => {
    setEditMode(true);
    setCurrentView('dashboard');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      url.searchParams.delete('r');
      url.searchParams.delete('snap');
      url.searchParams.delete('snapshot');
      url.searchParams.delete('shared');
      const cleanPath = url.pathname.replace(/\/view(\.html)?$/, '') || '/';
      window.history.pushState({}, '', cleanPath);
    } catch { /* ignore */ }
  };

  // ── Load snapshot from URL ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const hp = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      // 1. Dedicated Project View Mode (by Project ID)
      const projParam = sp.get('project') || hp.get('project') || sp.get('projectId') || hp.get('projectId') || sp.get('p') || hp.get('p');
      if (projParam) {
        const deletedIds = getDeletedProjectIds();
        if (deletedIds.has(projParam)) {
          setSharedProjectNotFound(true);
          setSharedProjectError('تم حذف هذا المشروع نهائياً من قاعدة البيانات ولا يمكن عرضه.');
          return;
        }

        const state = useDashboardStore.getState();
        const existing = (state.projects || []).find((p) => p.id === projParam);
        if (existing) {
          useDashboardStore.setState({
            currentProjectId: existing.id,
            currentDashboard: existing.dashboard,
            currentDataSource: existing.dataSource,
            activeFilters: existing.activeFilters || {},
            widgetFilters: existing.widgetFilters || {},
            drillDownStates: existing.drillDownStates || {},
            theme: existing.theme || 'dark'
          });
          return;
        }

        // Fetch from Supabase DB
        setSharedProjectLoading(true);
        loadProjectByIdFromDb(projParam).then((res) => {
          setSharedProjectLoading(false);
          if (res.success && res.project) {
            const p = res.project;
            useDashboardStore.setState({
              currentProjectId: p.id,
              currentDashboard: p.dashboard,
              currentDataSource: p.dataSource,
              activeFilters: p.activeFilters || {},
              widgetFilters: p.widgetFilters || {},
              drillDownStates: p.drillDownStates || {},
              theme: p.theme || 'dark'
            });
          } else {
            setSharedProjectNotFound(true);
            setSharedProjectError(res.error || 'عذراً، هذا المشروع غير متوفر أو تم حذفه من قاعدة البيانات.');
          }
        }).catch((err) => {
          setSharedProjectLoading(false);
          setSharedProjectNotFound(true);
          setSharedProjectError(err?.message || 'تعذر الاتصال بقاعدة البيانات.');
        });
        return;
      }

      const rParam = sp.get('r') || hp.get('r');
      if (rParam) {
        const decoded = decodeSnapshot(rParam);
        if (decoded?.w) {
          const expanded = expandDashboard(decoded);
          loadDashboardSnapshot({
            dashboard: expanded.dashboard,
            theme: expanded.theme,
            drillDownStates: expanded.drillDownStates,
            widgetFilters: expanded.widgetFilters,
            activeFilters: expanded.activeFilters,
            dataSource: expanded.dataSource
          });
          return;
        }
      }
      const snapParam = sp.get('snap') || hp.get('snap') || sp.get('snapshot') || hp.get('snapshot');
      if (snapParam) {
        const decoded = decodeSnapshot(snapParam);
        if (decoded?.dashboard) {
          loadDashboardSnapshot({
            dashboard: decoded.dashboard,
            theme: decoded.theme,
            dataSource: decoded.dataSourceSnippet?.rawRows ? {
              ...currentDataSource,
              fileName: decoded.dataSourceSnippet.fileName || currentDataSource.fileName,
              columns: decoded.dataSourceSnippet.columns || currentDataSource.columns,
              rawRows: decoded.dataSourceSnippet.rawRows
            } : undefined
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load snapshot from URL:', err);
    }
  }, []);

  // ── Live File Watcher / Power Query Auto-Refresh Effect ────────────────────
  useEffect(() => {
    const unsub = liveWatcherService.onDataUpdate((newTables) => {
      const state = useDashboardStore.getState();
      const currentMultiModel = state.multiTableModel;

      if (currentMultiModel && currentMultiModel.tables.length > 0) {
        // تحديث الجداول المتطابقة في نموذج العلاقات متعدد الجداول
        const updatedTables = currentMultiModel.tables.map((t) => {
          const match = newTables.find((nt) => nt.name === t.name || nt.id === t.id);
          return match
            ? { ...t, rawRows: match.rawRows, columns: match.columns, rowCount: match.rowCount }
            : t;
        });

        // إذا كان هناك جدول جديد في newTables غير موجود في النموذج الحالي، نضمه
        newTables.forEach((nt) => {
          if (!updatedTables.some((ut) => ut.name === nt.name || ut.id === nt.id)) {
            updatedTables.push(nt);
          }
        });

        const updatedModel: MultiTableDataSource = {
          ...currentMultiModel,
          tables: updatedTables,
        };

        const mergedDs = multiModelToDataSource(updatedModel);
        state.setDataSource(mergedDs as DataSource, false);
        state.setMultiTableModel(updatedModel);
      } else if (newTables.length > 0) {
        // تحديث جدول أحادي مباشر
        const primaryTable = newTables[0];
        const newDs: DataSource = {
          ...state.currentDataSource,
          fileName: primaryTable.fileName || state.currentDataSource.fileName,
          columns: primaryTable.columns || state.currentDataSource.columns,
          rawRows: primaryTable.rawRows || [],
          sheets: newTables.map((t, idx) => ({
            id: `sheet-${idx}`,
            name: t.name,
            rowCount: t.rowCount || 0,
            columns: t.columns || [],
            rawRows: t.rawRows || [],
          })),
        };
        state.setDataSource(newDs, false);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // ── Auto-sync Google Sheet on startup (ONLY for google_sheets projects without rows) ──
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const hp = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      if (sp.get('r') || hp.get('r') || sp.get('snap') || hp.get('snap') || sp.get('snapshot')) return;

      const state = useDashboardStore.getState();
      const activeProj = state.projects?.find((p) => p.id === state.currentProjectId);
      const isGSheet = activeProj ? activeProj.dataSourceType === 'google_sheets' : false;
      const hasRows = (state.currentDataSource?.rawRows?.length || 0) > 0;

      // Only fetch live Google Sheet if the project specifically has its own Google Sheet URL configured and has no data rows yet
      const projectSheetUrl = activeProj?.googleSheetUrl && activeProj.googleSheetUrl !== 'https://docs.google.com/spreadsheets/d/default'
        ? activeProj.googleSheetUrl
        : (activeProj?.id === 'proj-offers-2026' ? DEFAULT_GOOGLE_SHEET_URL : null);

      if (isGSheet && !hasRows && projectSheetUrl) {
        fetchGoogleSheetData(projectSheetUrl)
          .then((liveDs) => {
            if (liveDs?.rawRows?.length > 0) {
              useDashboardStore.getState().setDataSource(liveDs);
            }
          })
          .catch((err) => console.info('Auto-sync GSheet fallback:', err));
      }
    } catch { /* ignore */ }
  }, []);

  // ── Force public view when navigating via URL ───────────────────────────────
  useEffect(() => {
    if (isPublicView) { setEditMode(false); setCurrentView('public'); }
  }, [isPublicView, setEditMode]);

  // ── Auto-save active project to PostgreSQL on changes ─────────────────────
  useEffect(() => {
    // Debounce: wait 4s after last change before saving
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const state = useDashboardStore.getState();
      const { projects: allProjects, currentProjectId: activeId, currentDashboard: dash, currentDataSource: ds, activeFilters, widgetFilters, drillDownStates, theme: t } = state;
      if (!allProjects || allProjects.length === 0) return;

      const deletedIds = getDeletedProjectIds();
      if (deletedIds.has(activeId)) return;
      const validProjects = allProjects.filter((p) => p && p.id && !deletedIds.has(p.id));
      if (validProjects.length === 0) return;

      // Save current live state into projects list
      const updatedProjects = validProjects.map((p) => {
        if (p.id === activeId) {
          return { ...p, dashboard: dash, dataSource: ds, activeFilters, widgetFilters, drillDownStates, theme: t, updatedAt: new Date().toISOString() };
        }
        return p;
      });

      useDashboardStore.setState({ projects: updatedProjects });
      saveAllProjectsToDb(updatedProjects, activeId).catch(() => {});
    }, 4000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [currentDashboard, currentDataSource]);

  // ── Periodic save every 30 seconds ─────────────────────────────────────────
  useEffect(() => {
    const intervalId = setInterval(() => {
      const state = useDashboardStore.getState();
      const { projects: allProjects, currentProjectId: activeId, currentDashboard: dash, currentDataSource: ds, activeFilters, widgetFilters, drillDownStates, theme: t } = state;
      if (!allProjects || allProjects.length === 0) return;

      const deletedIds = getDeletedProjectIds();
      if (deletedIds.has(activeId)) return;
      const validProjects = allProjects.filter((p) => p && p.id && !deletedIds.has(p.id));
      if (validProjects.length === 0) return;

      const updatedProjects = validProjects.map((p) => {
        if (p.id === activeId) {
          return { ...p, dashboard: dash, dataSource: ds, activeFilters, widgetFilters, drillDownStates, theme: t, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      useDashboardStore.setState({ projects: updatedProjects });
      saveAllProjectsToDb(updatedProjects, activeId).catch(() => {});
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const onPop = () => { if (detectPublicViewMode()) { setEditMode(false); setCurrentView('public'); } };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setEditMode]);

  const selectedWidget = currentDashboard.widgets.find((w) => w.id === selectedWidgetId) || null;
  const handleDragStartColumn = (_col: Column) => { void _col; };

  const handleColumnSelect = (col: Column) => {
    if (!selectedWidgetId) return;
    const w = currentDashboard.widgets.find((w) => w.id === selectedWidgetId);
    if (w?.type === 'slicer') {
      const existing = w.config.slicerColumns || [w.config.xAxisColumn || col.columnName];
      if (!existing.includes(col.columnName)) {
        updateWidgetConfig(selectedWidgetId, { slicerColumns: [...existing, col.columnName], activeSlicerColumn: col.columnName, xAxisColumn: col.columnName });
      } else {
        updateWidgetConfig(selectedWidgetId, { activeSlicerColumn: col.columnName, xAxisColumn: col.columnName });
      }
      return;
    }
    if (col.dataType === 'numeric') updateWidgetConfig(selectedWidgetId, { yAxisColumn: col.columnName });
    else updateWidgetConfig(selectedWidgetId, { xAxisColumn: col.columnName });
  };

  const renderDataPanel = (isMobile = false) => isEditMode ? (
    <DataPanel
      dataSource={currentDataSource}
      onDragStartColumn={handleDragStartColumn}
      dockSide={sidebarsPlacement === 'powerbi-left' ? 'left' : 'right'}
      isMobile={isMobile}
      onSelectColumn={handleColumnSelect}
      onOpenUpload={() => setIsUploadModalOpen(true)}
    />
  ) : null;

  const renderVisualsPanel = (isMobile = false) => isEditMode ? (
    <VisualizationsPanel
      selectedWidget={selectedWidget}
      onUpdateWidgetConfig={updateWidgetConfig}
      onAddWidget={(type) => {
        addWidget(type);
        if (isMobile) {
          setMobileDrawerOpen(false);
        }
      }}
      dockSide={sidebarsPlacement === 'powerbi-right' ? 'right' : 'left'}
      isMobile={isMobile}
    />
  ) : null;

  const canvasEl = <DashboardCanvas />;

  // ── Desktop panel layout ────────────────────────────────────────────────────
  const renderDesktopPanels = () => {
    if (!isEditMode) return canvasEl;
    if (sidebarsPlacement === 'powerbi-right') return <>{renderDataPanel(false)}{renderVisualsPanel(false)}{canvasEl}</>;
    if (sidebarsPlacement === 'powerbi-left') return <>{canvasEl}{renderVisualsPanel(false)}{renderDataPanel(false)}</>;
    return <>{renderDataPanel(false)}{canvasEl}{renderVisualsPanel(false)}</>;
  };

  // ─── PUBLIC VIEW ────────────────────────────────────────────────────────────
  if (currentView === 'public') {
    return (
      <div dir="rtl" className={`font-sans transition-colors duration-300 ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
        <PublicReportViewer
          isOwner={!isPublicView}
          onBackToApp={handleAdminUnlock}
          notFound={sharedProjectNotFound}
          notFoundMessage={sharedProjectError}
          isLoading={sharedProjectLoading}
        />
      </div>
    );
  }

  // ─── MAIN APP ───────────────────────────────────────────────────────────────
  return (
    <div
      dir="rtl"
      className={`h-[100dvh] flex flex-col overflow-hidden font-sans transition-colors duration-300 ${
        theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'light-mode bg-slate-50 text-slate-800'
      }`}
    >
      {/* ── Unified Header (responsive) ── */}
      <Header
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onOpenWorkspaceView={() => setCurrentView(currentView === 'workspaces' ? 'dashboard' : 'workspaces')}
        onOpenDbManager={() => setDbControlOpen(true)}
        onOpenMultiSource={() => setIsMultiSourceOpen(true)}
        currentView={currentView}
        onOpenPublicView={handleOpenPublicView}
      />

      {/* ── Live Local File Watcher & Sync Banner (Power Query Automation) ── */}
      <LiveSyncBanner />

      {/* ── Main content ── */}
      {currentView === 'workspaces' ? (
        <WorkspaceList
          onSelectDashboard={() => setCurrentView('dashboard')}
          onOpenUpload={() => setIsUploadModalOpen(true)}
        />
      ) : (
        <>
          {/* ── DESKTOP layout (md+) ── */}
          <div className="hidden md:flex flex-1 overflow-hidden">
            {renderDesktopPanels()}
          </div>

          {/* ── MOBILE layout (< md) ── */}
          <div className="flex md:hidden flex-1 overflow-hidden relative">
            {/* Canvas always rendered in background */}
            <div className="absolute inset-0 overflow-y-auto">
              {canvasEl}
            </div>

            {/* Slide-up Drawer for Data/Visuals panels */}
            {isEditMode && mobileDrawerOpen && (
              <div className="absolute inset-0 z-30 flex flex-col">
                {/* Backdrop */}
                <div
                  className="flex-1 bg-black/60 backdrop-blur-sm"
                  onClick={() => setMobileDrawerOpen(false)}
                />
                {/* Panel sheet */}
                <div className="bg-slate-900 border-t border-slate-700 rounded-t-2xl h-[72vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp">
                  {/* Drawer handle + close */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMobileTab('data')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          mobileTab === 'data'
                            ? 'bg-sky-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>الأعمدة</span>
                      </button>
                      <button
                        onClick={() => setMobileTab('visuals')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          mobileTab === 'visuals'
                            ? 'bg-sky-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        <span>المخططات</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setMobileDrawerOpen(false)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Drawer panel content */}
                  <div className="flex-1 overflow-hidden">
                    {mobileTab === 'data' ? renderDataPanel(true) : renderVisualsPanel(true)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── MOBILE Bottom Navigation Bar ── */}
          <nav className="md:hidden shrink-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md safe-bottom">
            <div className="flex items-stretch h-14">
              {/* Dashboard tab */}
              <button
                onClick={() => { setMobileDrawerOpen(false); }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
                  !mobileDrawerOpen ? 'text-sky-400' : 'text-slate-500'
                }`}
              >
                <LayoutGrid className="w-5 h-5" />
                <span>اللوحة</span>
              </button>

              {/* Data columns tab (only in edit mode) */}
              {isEditMode && (
                <button
                  onClick={() => { setMobileTab('data'); setMobileDrawerOpen(true); }}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
                    mobileDrawerOpen && mobileTab === 'data' ? 'text-sky-400' : 'text-slate-500'
                  }`}
                >
                  <Database className="w-5 h-5" />
                  <span>الأعمدة</span>
                </button>
              )}

              {/* Visuals / Add widget tab (only in edit mode) */}
              {isEditMode && (
                <button
                  onClick={() => { setMobileTab('visuals'); setMobileDrawerOpen(true); }}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
                    mobileDrawerOpen && mobileTab === 'visuals' ? 'text-sky-400' : 'text-slate-500'
                  }`}
                >
                  <BarChart2 className="w-5 h-5" />
                  <span>إضافة</span>
                </button>
              )}

              {/* View Mode button */}
              <button
                onClick={handleOpenPublicView}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
              >
                <Eye className="w-5 h-5" />
                <span>وضع العرض</span>
              </button>
            </div>
          </nav>
        </>
      )}

      {/* ── Floating modals ── */}
      <ShareModal />
      <DropzoneModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
      <DataGridModal />
      <MultiSourceModal
        isOpen={isMultiSourceOpen}
        onClose={() => setIsMultiSourceOpen(false)}
        onApply={(mergedDs, multiModel) => {
          useDashboardStore.getState().setDataSource(mergedDs, true);
          useDashboardStore.getState().setMultiTableModel(multiModel);
          setIsMultiSourceOpen(false);
        }}
      />
      <DatabaseControlModal
        isOpen={isDbControlOpen}
        onClose={() => setDbControlOpen(false)}
        onOpenDataSourcesManager={() => {
          setDbControlOpen(false);
          setIsDbManagerOpen(true);
        }}
      />
      <DataSourcesManager isOpen={isDbManagerOpen} onClose={() => setIsDbManagerOpen(false)} />
    </div>
  );
};

export default App;
