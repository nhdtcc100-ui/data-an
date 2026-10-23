import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Dashboard, Widget, WidgetType, WidgetConfig, WidgetLayout } from '../../types/dashboard';
import type { DataSource, MultiTableDataSource } from '../../types/dataSource';
import type { Project, CreateProjectOptions, ProjectDatabaseConfig } from '../../types/project';
import {
  INITIAL_DATA_SOURCE,
  REGIONAL_SALES_DATA_SOURCE,
  TECH_COMPANIES_DATA_SOURCE
} from '../../services/sampleDatasets';
import { syncDataSourceToSupabase } from '../../services/supabaseDataService';
import { saveAllProjectsToDb, saveProjectToDb, loadProjectsFromDb, deleteProjectFromDb } from '../../services/projectsDbService';
import { markProjectAsDeleted, getDeletedProjectIds, unmarkProjectAsDeleted } from '../../services/deletedProjectsTracker';
import {
  type DrillPathEntry,
  isWidgetLinkedToTarget,
  isWidgetListeningToSource
} from '../../services/dataEngine';
import type { MotionThemeId } from '../../services/motionThemes';

// ─── Default Project ID ───────────────────────────────────────────────────────
const DEFAULT_PROJECT_ID = 'proj-offers-2026';

const INITIAL_WIDGETS: Widget[] = [
  // 1. الفلتر الرئيسي الشامل (اسم الشركة، الموقع، القسم، الحالة)
  {
    id: 'w-slicer-company',
    dashboardId: 'dash-main',
    dataSourceId: 'ds-gsheet-live-main',
    type: 'slicer',
    title: 'تصفية البيانات: اسم الشركة | الموقع | القسم | الحالة',
    config: {
      xAxisColumn: 'اسم الشركة',
      activeSlicerColumn: 'اسم الشركة',
      slicerColumns: ['اسم الشركة', 'الموقع', 'القسم', 'الحالة'],
      slicerSelectionMode: 'multi'
    },
    layout: { x: 0, y: 0, w: 12, h: 2, i: 'w-slicer-company' }
  },

  // 2. دائري مجوف (Donut Chart) بنسبة 50%
  {
    id: 'w-donut-company',
    dashboardId: 'dash-main',
    dataSourceId: 'ds-gsheet-live-main',
    type: 'donut',
    title: 'توزيع كمية المنتجات حسب اسم الشركة (دائري مجوف)',
    config: {
      xAxisColumn: 'اسم الشركة',
      yAxisColumn: 'سعر المفرد',
      aggregation: 'COUNT',
      numberFormat: 'compact',
      donutHoleRatio: 45,
      pieLabelType: 'percent',
      showLegend: true,
      legendPosition: 'bottom',
      drillDownEnabled: true,
      drillDownLevels: ['اسم الشركة', 'القسم'],
      colorTheme: 'violet'
    },
    layout: { x: 0, y: 2, w: 6, h: 4, i: 'w-donut-company' }
  },

  // 3. كولم/بار جارت 50% بجانبه (اسم الشركة وكمية المنتجات مع دخول هرمي للقسم)
  {
    id: 'w-bar-company',
    dashboardId: 'dash-main',
    dataSourceId: 'ds-gsheet-live-main',
    type: 'bar',
    title: 'كمية المنتجات لكل شركة',
    config: {
      xAxisColumn: 'اسم الشركة',
      yAxisColumn: 'سعر المفرد',
      aggregation: 'COUNT',
      numberFormat: 'compact',
      sortOrder: 'desc',
      showDataLabels: true,
      drillDownEnabled: true,
      drillDownLevels: ['اسم الشركة', 'القسم'],
      colorTheme: 'sky'
    },
    layout: { x: 6, y: 2, w: 6, h: 4, i: 'w-bar-company' }
  },

  // 4. الجدول الأول: تفاصيل المنتجات والأسعار (3 أعمدة فقط: اسم الشركة، اسم المنتج والوصف، السعر المفرد)
  {
    id: 'w-table-products',
    dashboardId: 'dash-main',
    dataSourceId: 'ds-gsheet-live-main',
    type: 'table',
    title: 'جدول تفاصيل المنتجات والأسعار',
    config: {
      tableColumns: [
        'اسم الشركة',
        'اسم المنتج والوصف',
        'السعر المفرد'
      ],
      tablePageSize: 8,
      tableDensity: 'comfortable'
    },
    layout: { x: 0, y: 6, w: 12, h: 5, i: 'w-table-products' }
  },

  // 5. الجدول الثاني: العروض والخصومات وفترة الضمان (5 أعمدة)
  {
    id: 'w-table-offers',
    dashboardId: 'dash-main',
    dataSourceId: 'ds-gsheet-live-main',
    type: 'table',
    title: 'جدول العروض والخصومات وفترة الضمان',
    config: {
      tableColumns: [
        'اسم الشركة',
        'الخصم',
        'العرض',
        'مدة العرض',
        'الضمان'
      ],
      tablePageSize: 8,
      tableDensity: 'comfortable'
    },
    layout: { x: 0, y: 11, w: 12, h: 5, i: 'w-table-offers' }
  }
];

interface DashboardState {
  // ─── Current single-project state (backward compatible) ───────────────────
  currentDashboard: Dashboard;
  currentDataSource: DataSource;
  // ─── Multi-Table Data Model (Power Query style) ────────────────────────────
  multiTableModel: MultiTableDataSource | null;
  setMultiTableModel: (model: MultiTableDataSource | null) => void;
  selectedWidgetId: string | null;
  activeFilters: Record<string, any>;
  widgetFilters: Record<string, Record<string, any>>;
  isEditMode: boolean;
  isShareModalOpen: boolean;
  isDataGridOpen: boolean;
  theme: 'dark' | 'light';
  motionTheme: MotionThemeId;

  // ─── Multi-Project Architecture ───────────────────────────────────────────
  projects: Project[];
  currentProjectId: string;

  // Sidebars & Layout Mode (Power BI Style & Resizability)
  sidebarsPlacement: 'powerbi-right' | 'split' | 'powerbi-left';
  dataPanelWidth: number;
  visualizationsPanelWidth: number;
  isDataPanelCollapsed: boolean;
  isVisualizationsPanelCollapsed: boolean;

  // ─── Widget Actions ────────────────────────────────────────────────────────
  setSelectedWidgetId: (id: string | null) => void;
  addWidget: (type: WidgetType) => void;
  duplicateWidget: (id: string) => void;
  changeWidgetType: (id: string, type: WidgetType) => void;
  removeWidget: (id: string) => void;
  updateWidgetConfig: (id: string, updates: Partial<WidgetConfig>) => void;
  updateWidgetLayout: (id: string, layout: Partial<WidgetLayout>) => void;
  updateWidgetTitle: (id: string, title: string) => void;
  setWidgetWidth: (id: string, w: number) => void;
  setWidgetHeight: (id: string, h: number) => void;
  addSlicerForColumn: (columnName: string) => void;
  setFilter: (column: string, value: any, sourceWidgetId?: string) => void;
  clearFilter: (column: string, sourceWidgetId?: string) => void;
  clearAllFilters: () => void;
  clearWidgetFilters: (widgetId: string) => void;
  setWidgetLinks: (
    widgetId: string,
    linkedWidgetIds: string[] | undefined,
    crossFilterMode?: 'all' | 'custom' | 'none',
    bidirectional?: boolean
  ) => void;
  toggleWidgetLink: (sourceWidgetId: string, targetWidgetId: string, bidirectional?: boolean) => void;
  setWidgetIgnoreIncoming: (widgetId: string, ignore: boolean) => void;
  setEditMode: (edit: boolean) => void;
  setShareModalOpen: (open: boolean) => void;
  setDataGridOpen: (open: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setMotionTheme: (motionTheme: MotionThemeId) => void;
  setDataSource: (dataSource: DataSource, autoGenerateDashboard?: boolean) => void;
  generateSmartDashboardForDataSource: (dataSource?: DataSource) => void;

  // Sidebar Layout Actions
  setSidebarsPlacement: (placement: 'powerbi-right' | 'split' | 'powerbi-left') => void;
  setDataPanelWidth: (width: number) => void;
  setVisualizationsPanelWidth: (width: number) => void;
  toggleDataPanel: () => void;
  toggleVisualizationsPanel: () => void;

  lastSavedAt: string | null;
  resetToDefaults: () => void;

  // Widget Reordering & Placement Actions
  reorderWidget: (sourceIndex: number, targetIndex: number) => void;
  moveWidgetToPosition: (widgetId: string, position: 'start' | 'middle' | 'end' | 'up' | 'down') => void;
  moveWidgetToIndex: (widgetId: string, targetIndex: number) => void;

  // Real Data Row Editing
  updateRawRows: (rows: Record<string, any>[]) => void;
  addRawRow: (row: Record<string, any>) => void;
  deleteRawRow: (index: number) => void;
  updateRawCell: (rowIndex: number, column: string, value: any) => void;

  // ─── Cross-Table Active Row Selection ──────────────────────────────────────
  activeTableRowKey: string | null;
  setActiveTableRowKey: (key: string | null) => void;

  // Drill-Down Navigation State & Actions
  drillDownStates: Record<string, { path: DrillPathEntry[]; levelIndex: number }>;
  drillDown: (widgetId: string, column: string, value: string) => void;
  drillUp: (widgetId: string, toLevelIndex?: number) => void;
  resetDrillDown: (widgetId: string) => void;

  loadDashboardSnapshot: (snapshot: {
    dashboard?: Partial<Dashboard>;
    dataSource?: Partial<DataSource>;
    theme?: 'dark' | 'light';
    drillDownStates?: Record<string, { path: DrillPathEntry[]; levelIndex: number }>;
    widgetFilters?: Record<string, Record<string, any>>;
    activeFilters?: Record<string, any>;
  }) => void;

  // ─── Multi-Project Actions ────────────────────────────────────────────────
  /** Switch the active project and save current state back into its slot */
  switchProject: (projectId: string) => void;
  /** Create a new independent project */
  createProject: (options: CreateProjectOptions) => string;
  /** Duplicate an existing project with all its data and widgets */
  duplicateProject: (projectId: string) => string;
  /** Delete a project permanently from DB and state (no project is excluded) */
  deleteProject: (projectId: string) => Promise<boolean>;
  /** Update project metadata only */
  updateProjectMeta: (projectId: string, meta: Partial<Pick<Project, 'title' | 'description' | 'category' | 'icon' | 'colorAccent'>>) => void;
  /** Sync live Google Sheet URL to a specific project */
  setProjectGoogleSheetUrl: (projectId: string, url: string) => void;

  // ─── Database Control & Dedicated Project DB Actions ────────────────────────
  isDbControlOpen: boolean;
  setDbControlOpen: (open: boolean) => void;
  syncActiveProjectToDatabase: () => Promise<{ success: boolean; message: string }>;
  updateProjectDatabaseConfig: (projectId: string, config: Partial<ProjectDatabaseConfig>) => void;
}

const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Clear legacy storage keys if quota was exceeded
      try {
        for (let i = 1; i <= 5; i++) {
          localStorage.removeItem(`lens-bi-dashboard-store-v${i}`);
        }
        localStorage.setItem(name, value);
      } catch {
        // Fallback: in-memory state is preserved seamlessly
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  }
};

/**
 * Finds all widgets that are directly or indirectly linked to the given widget
 * via bidirectional or unidirectional cross-filtering links.
 */
function getConnectedWidgetIds(startWidgetId: string, allWidgets: Widget[]): string[] {
  if (!allWidgets || allWidgets.length === 0) return [];
  const visited = new Set<string>([startWidgetId]);
  const queue = [startWidgetId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currWidget = allWidgets.find((w) => w.id === currId);
    if (!currWidget) continue;

    for (const w of allWidgets) {
      if (visited.has(w.id)) continue;
      // Slicers are filter controls, not charts with drill-down state
      if (w.type === 'slicer') continue;
      const linked =
        (isWidgetLinkedToTarget(currWidget, w.id) && isWidgetListeningToSource(w, currId)) ||
        (isWidgetLinkedToTarget(w, currId) && isWidgetListeningToSource(currWidget, w.id));
      if (linked) {
        visited.add(w.id);
        queue.push(w.id);
      }
    }
  }

  visited.delete(startWidgetId);
  return Array.from(visited);
}

/**
 * Intelligently generates tailored Power-BI style widgets for any uploaded Excel or CSV data source
 */
export function createSmartDashboardWidgets(dataSource: DataSource, dashboardId: string): Widget[] {
  const cols = (dataSource.columns || [])
    .filter((c) => c.columnName && !c.columnName.startsWith('__EMPTY') && c.columnName.trim() !== '')
    .map((c) => ({ ...c, columnName: sanitizeMojibakeString(c.columnName) }));
  if (cols.length === 0) return [];

  const strCols = cols.filter((c) => c.dataType === 'string').map((c) => c.columnName);
  const numCols = cols.filter((c) => c.dataType === 'numeric').map((c) => c.columnName);
  const dateCols = cols.filter((c) => c.dataType === 'date').map((c) => c.columnName);
  const allColNames = cols.map((c) => c.columnName);

  const primaryStr = strCols[0] || allColNames[0];
  const secondaryStr = strCols[1] || strCols[0] || allColNames[1] || allColNames[0];
  const primaryNum = numCols[0] || allColNames.find((c) => c !== primaryStr) || allColNames[0];
  const secondaryNum = numCols[1] || numCols[0] || primaryNum;
  const dateCol = dateCols[0];

  const now = Date.now();
  const widgets: Widget[] = [];

  // 1. Slicer Widget (Top Bar filter)
  if (strCols.length > 0) {
    widgets.push({
      id: `w-slicer-${now}-1`,
      dashboardId,
      dataSourceId: dataSource.id,
      type: 'slicer',
      title: `تصفية البيانات: ${strCols.slice(0, 3).join(' | ')}`,
      config: {
        xAxisColumn: primaryStr,
        activeSlicerColumn: primaryStr,
        slicerColumns: strCols.slice(0, 4),
        slicerSelectionMode: 'multi'
      },
      layout: { x: 0, y: 0, w: 12, h: 2, i: `w-slicer-${now}-1` }
    });
  }

  // 2. KPI 1 (Primary metric)
  widgets.push({
    id: `w-kpi-${now}-1`,
    dashboardId,
    dataSourceId: dataSource.id,
    type: 'kpi',
    title: numCols.length > 0 ? `إجمالي: ${primaryNum}` : 'عدد السجلات الكلي',
    config: {
      xAxisColumn: primaryStr,
      yAxisColumn: primaryNum,
      aggregation: numCols.length > 0 ? 'SUM' : 'COUNT',
      numberFormat: 'compact',
      colorTheme: 'sky'
    },
    layout: { x: 0, y: 2, w: 4, h: 2, i: `w-kpi-${now}-1` }
  });

  // 3. KPI 2 (Secondary metric or average)
  widgets.push({
    id: `w-kpi-${now}-2`,
    dashboardId,
    dataSourceId: dataSource.id,
    type: 'kpi',
    title: numCols.length > 1 ? `إجمالي: ${secondaryNum}` : `متوسط: ${primaryNum}`,
    config: {
      xAxisColumn: primaryStr,
      yAxisColumn: numCols.length > 1 ? secondaryNum : primaryNum,
      aggregation: numCols.length > 1 ? 'SUM' : 'AVG',
      numberFormat: 'compact',
      colorTheme: 'emerald'
    },
    layout: { x: 4, y: 2, w: 4, h: 2, i: `w-kpi-${now}-2` }
  });

  // 4. KPI 3 (Distinct count / Category metric)
  widgets.push({
    id: `w-kpi-${now}-3`,
    dashboardId,
    dataSourceId: dataSource.id,
    type: 'kpi',
    title: `عدد العناصر: ${secondaryStr}`,
    config: {
      xAxisColumn: secondaryStr,
      yAxisColumn: primaryNum,
      aggregation: 'COUNT',
      numberFormat: 'compact',
      colorTheme: 'violet'
    },
    layout: { x: 8, y: 2, w: 4, h: 2, i: `w-kpi-${now}-3` }
  });

  // 5. Chart 1 (Bar Chart - Primary Category vs Metric)
  widgets.push({
    id: `w-bar-${now}-1`,
    dashboardId,
    dataSourceId: dataSource.id,
    type: 'bar',
    title: `${primaryNum} حسب ${primaryStr}`,
    config: {
      xAxisColumn: primaryStr,
      yAxisColumn: primaryNum,
      aggregation: numCols.length > 0 ? 'SUM' : 'COUNT',
      numberFormat: 'compact',
      sortOrder: 'desc',
      showDataLabels: true,
      colorTheme: 'sky'
    },
    layout: { x: 0, y: 4, w: 6, h: 4, i: `w-bar-${now}-1` }
  });

  // 6. Chart 2 (Donut or Area Chart)
  if (dateCol) {
    widgets.push({
      id: `w-area-${now}-1`,
      dashboardId,
      dataSourceId: dataSource.id,
      type: 'area',
      title: `مسار ${primaryNum} عبر الزمن (${dateCol})`,
      config: {
        xAxisColumn: dateCol,
        yAxisColumn: primaryNum,
        aggregation: 'SUM',
        smoothLine: true,
        colorTheme: 'emerald'
      },
      layout: { x: 6, y: 4, w: 6, h: 4, i: `w-area-${now}-1` }
    });
  } else {
    widgets.push({
      id: `w-donut-${now}-1`,
      dashboardId,
      dataSourceId: dataSource.id,
      type: 'donut',
      title: `توزيع ${primaryNum} حسب ${secondaryStr}`,
      config: {
        xAxisColumn: secondaryStr,
        yAxisColumn: primaryNum,
        aggregation: numCols.length > 0 ? 'SUM' : 'COUNT',
        pieLabelType: 'percent',
        showLegend: true,
        legendPosition: 'bottom',
        colorTheme: 'violet'
      },
      layout: { x: 6, y: 4, w: 6, h: 4, i: `w-donut-${now}-1` }
    });
  }

  // 7. Data Table (Full interactive table)
  widgets.push({
    id: `w-table-${now}-1`,
    dashboardId,
    dataSourceId: dataSource.id,
    type: 'table',
    title: `جدول تفاصيل سجلات ${dataSource.fileName.replace(/\.[^/.]+$/, '')}`,
    config: {
      tableColumns: allColNames.slice(0, 6),
      tablePageSize: 8,
      tableDensity: 'comfortable'
    },
    layout: { x: 0, y: 8, w: 12, h: 5, i: `w-table-${now}-1` }
  });

  return widgets;
}



// ─── Universal Mojibake Sanitation Engine (Windows-1252 / ISO-8859-1 -> UTF-8) ────────
const WIN1252_MAP: Record<number, number> = {
  0x20AC: 0x80, // €
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8A, // Š
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  0x017D: 0x8E, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201C: 0x93, // “
  0x201D: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02DC: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9A, // š
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  0x017E: 0x9E, // ž
  0x0178: 0x9F  // Ÿ
};

const MOJIBAKE_REPLACEMENTS: [RegExp, string][] = [
  [/Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ©/g, 'اسم الشركة'],
  [/Ø§Ù„Ù…ÙˆÙ‚Ø¹/g, 'الموقع'],
  [/Ø§Ù„Ù‚Ø³Ù…/g, 'القسم'],
  [/Ø§Ù„Ø­Ø§Ù„Ø©/g, 'الحالة'],
  [/Ø§Ù„Ø®ØµÙ…/g, 'الخصم'],
  [/Ø§Ù„Ø¹Ø±Ø¶/g, 'العرض'],
  [/Ù…Ø¯Ø© Ø§Ù„Ø¹Ø±Ø¶/g, 'مدة العرض'],
  [/Ø§Ù„Ø¶Ù…Ø§Ù†/g, 'الضمان'],
  [/Ø³Ø¹Ø± Ø§Ù„Ù…Ù Ø±Ø¯/g, 'سعر المفرد'],
  [/Ø§Ù„Ø³Ø¹Ø± Ø§Ù„Ù…Ù Ø±Ø¯/g, 'السعر المفرد'],
  [/Ø§Ù„Ø³Ø¹Ø± Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ/g, 'السعر الإجمالي'],
  [/Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬ ÙˆØ§Ù„ÙˆØµÙ /g, 'اسم المنتج والوصف'],
  [/Ø§Ù„ÙˆØµÙ /g, 'الوصف'],
  [/Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬/g, 'اسم المنتج'],
  [/Ø§Ù„ÙƒÙ…ÙŠØ©/g, 'الكمية'],
  [/Ø§Ù„Ù‡Ø§ØªÙ  \/ Ø§Ù„Ø§ØªØµØ§Ù„/g, 'الهاتف / الاتصال'],
  [/ÙƒÙˆØ¯ Ø§Ù„Ù…Ù†ØªØ¬ \/ Ø§Ù„Ù…ÙˆØ¯ÙŠÙ„/g, 'كود المنتج / الموديل'],
  [/ØªØµÙ ÙŠØ© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª/g, 'تصفية البيانات'],
  [/ØªÙˆØ²ÙŠØ¹ ÙƒÙ…ÙŠØ© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª/g, 'توزيع كمية المنتجات'],
  [/Ø­Ø³Ø¨/g, 'حسب'],
  [/Ø¯Ø§Ø¦Ø±ÙŠ Ù…Ø¬ÙˆÙ /g, 'دائري مجوف'],
  [/ÙƒÙ…ÙŠØ© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ù„ÙƒÙ„ Ø´Ø±ÙƒØ©/g, 'كمية المنتجات لكل شركة'],
  [/Ø¬Ø¯ÙˆÙ„ ØªÙ Ø§ØµÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙˆØ§Ù„Ø£Ø³Ø¹Ø§Ø±/g, 'جدول تفاصيل المنتجات والأسعار'],
  [/Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø¹Ø±ÙˆØ¶ ÙˆØ§Ù„Ø®ØµÙˆÙ…Ø§Øª ÙˆÙ ØªØ±Ø© Ø§Ù„Ø¶Ù…Ø§Ù†/g, 'جدول العروض والخصومات وفترة الضمان'],
  [/Ù„ÙˆØ­Ø© ØªØ­Ù„ÙŠÙ„ ÙˆÙ…Ù‚Ø§Ø±Ù†Ø© Ø¹Ø±ÙˆØ¶ Ø§Ù„Ø´Ø±ÙƒØ§Øª ÙˆØ§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† 2026/g, 'لوحة تحليل ومقارنة عروض الشركات والموردين 2026'],
  [/Ù…Ø²Ø§Ù…Ù†Ø© Ø­ÙŠØ© ÙˆÙ…Ø¨Ø§Ø´Ø±Ø© Ù…Ø¹ Google Sheets - ØªØ­Ù„ÙŠÙ„ ØªÙ Ø§Ø¹Ù„ÙŠ Ù„Ù„Ø£Ø³Ø¹Ø§Ø±ØŒ Ø§Ù„Ø£Ù‚Ø³Ø§Ù…ØŒ ÙˆØ´Ø±ÙˆØ· Ø§Ù„Ø¶Ù…Ø§Ù†/g, 'مزامنة حية ومباشرة مع Google Sheets - تحليل تفاعلي للأسعار، الأقسام، وشروط الضمان'],
  [/Ø¥Ø¬Ù…Ø§Ù„ÙŠ/g, 'إجمالي'],
  [/Ø¹Ø¯Ø¯ Ø§Ù„Ø³Ø¬Ù„Ø§Øª Ø§Ù„ÙƒÙ„ÙŠ/g, 'عدد السجلات الكلي'],
  [/Ù…ØªÙˆØ³Ø·/g, 'متوسط'],
  [/Ø¹Ø¯Ø¯ Ø§Ù„Ø¹Ù†Ø§ØµØ±/g, 'عدد العناصر'],
  [/Ù…Ø³Ø§Ø±/g, 'مسار'],
  [/Ø¹Ø¨Ø± Ø§Ù„Ø²Ù…Ù†/g, 'عبر الزمن'],
  [/ØªÙˆØ²ÙŠØ¹/g, 'توزيع'],
  [/Ø¬Ø¯ÙˆÙ„ ØªÙ Ø§ØµÙŠÙ„ Ø³Ø¬Ù„Ø§Øª/g, 'جدول تفاصيل سجلات'],
  [/Ù„ÙˆØ­Ø© ØªØ­Ù„ÙŠÙ„Ø§Øª/g, 'لوحة تحليلات'],
  [/Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª/g, 'المبيعات'],
  [/Ø§Ù„Ù…Ù†Ø·Ù‚Ø©/g, 'المنطقة'],
  [/Ù…Ø¤Ø´Ø± Ø£Ø¯Ø§Ø¡/g, 'مؤشر أداء'],
  [/Ù…Ø®Ø·Ø· Ø´Ø±ÙŠØ·ÙŠ/g, 'مخطط شريطي'],
  [/Ù…Ø®Ø·Ø· Ø£Ù Ù‚ÙŠ/g, 'مخطط أفقي'],
  [/Ù…Ø³Ø§Ø± Ø®Ø·ÙŠ/g, 'مسار خطي'],
  [/Ù…Ø®Ø·Ø· Ù…Ø³Ø§Ø­ÙŠ/g, 'مخطط مساحي'],
  [/ØªÙˆØ²ÙŠØ¹ Ø¯Ø§Ø¦Ø±ÙŠ/g, 'توزيع دائري'],
  [/Ù…Ø®Ø·Ø· Ø±Ø§Ø¯Ø§Ø±ÙŠ Ù…Ù‚Ø§Ø±Ù†/g, 'مخطط راداري مقارن'],
  [/Ù‚Ù…Ø¹ Ø§Ù„ØªØ­ÙˆÙŠÙ„/g, 'قمع التحويل'],
  [/Ø¹Ø¯Ø§Ø¯ Ø§Ù„Ø¥Ù†Ø¬Ø§Ø²/g, 'عداد الإنجاز'],
  [/Ù…Ø®Ø·Ø· Ø§Ù†ØªØ´Ø§Ø± Ø§Ù„Ø¹Ù„Ø§Ù‚Ø©/g, 'مخطط انتشار العلاقة'],
  [/Ø®Ø±ÙŠØ·Ø© Ø§Ù„Ø´Ø¬Ø±Ø©/g, 'خريطة الشجرة'],
  [/Ù…Ø®Ø·Ø· Ø£Ø´Ø¹Ø© Ø§Ù„Ø´Ù…Ø³/g, 'مخطط أشعة الشمس'],
  [/Ø®Ø±ÙŠØ·Ø© Ø­Ø±Ø§Ø±ÙŠØ©/g, 'خريطة حرارية'],
  [/Ø³Ø­Ø§Ø¨Ø© Ø§Ù„ÙƒÙ„Ù…Ø§Øª/g, 'سحابة الكلمات'],
  [/Ø¬Ø¯ÙˆÙ„ Ù…Ø­ÙˆØ±ÙŠ Ù…Ø¬Ù…Ø¹/g, 'جدول محوري مجمع'],
  [/Ø¬Ø¯ÙˆÙ„ Ø¨ÙŠØ§Ù†Ø§Øª ØªÙ ØµÙŠÙ„ÙŠ/g, 'جدول بيانات تفصيلي'],
  [/ØªØµÙ ÙŠØ© Ø­Ø³Ø¨/g, 'تصفية حسب'],
  [/Ø¹Ù†ØµØ± Ø¬Ø¯ÙŠØ¯/g, 'عنصر جديد'],
  [/Ù†Ø³Ø®Ø©/g, 'نسخة'],
  [/Ø§Ù„ÙƒÙ„/g, 'الكل'],
  [/Ù‚Ø§Ø¹Ø¯Ø© Ø¨ÙŠØ§Ù†Ø§Øª/g, 'قاعدة بيانات'],
  [/Ø´ÙŠØª Ø¬ÙˆØ¬Ù„/g, 'شيت جوجل'],
  [/Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø®ØµØµØ©/g, 'بيانات مخصصة'],
  [/Ù…Ø´Ø±ÙˆØ¹ ØªØ­Ù„ÙŠÙ„ÙŠ ÙˆÙ‚Ø§Ø¹Ø¯Ø© Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø®ØµØµØ© Ù„Ù€/g, 'مشروع تحليلي وقاعدة بيانات مخصصة لـ']
];

export function sanitizeMojibakeString(val: string): string {
  if (!val || typeof val !== 'string') return val;

  // Quick check: only proceed if string contains mojibake indicators
  if (!/[ØÙÚÛÃÅ\u0080-\u009F]/.test(val)) {
    return val;
  }

  // 1. Try Universal Windows-1252 / ISO-8859-1 to UTF-8 reconstruction
  try {
    const bytes: number[] = [];
    const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

    for (let i = 0; i < val.length; i++) {
      const code = val.charCodeAt(i);
      if (WIN1252_MAP[code] !== undefined) {
        bytes.push(WIN1252_MAP[code]);
      } else if (code <= 0xFF) {
        bytes.push(code);
      } else if (encoder) {
        const encBytes = encoder.encode(val[i]);
        for (let b = 0; b < encBytes.length; b++) {
          bytes.push(encBytes[b]);
        }
      }
    }

    if (bytes.length > 0 && typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const decoded = decoder.decode(new Uint8Array(bytes));
      // If we recovered Arabic characters and reduced corrupted markers, adopt decoded
      if (/[\u0600-\u06FF]/.test(decoded) && !decoded.includes('')) {
        let clean = decoded;
        for (const [pattern, replacement] of MOJIBAKE_REPLACEMENTS) {
          pattern.lastIndex = 0;
          clean = clean.replace(pattern, replacement);
        }
        return clean;
      }
    }
  } catch {
    // Fall back to pattern matching
  }

  // 2. Pattern-based fallback
  let res = val;
  for (const [pattern, replacement] of MOJIBAKE_REPLACEMENTS) {
    pattern.lastIndex = 0;
    res = res.replace(pattern, replacement);
  }
  return res;
}

export function sanitizeMojibakeDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return sanitizeMojibakeString(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMojibakeDeep(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeMojibakeString(key);
      result[sanitizedKey] = sanitizeMojibakeDeep(value);
    }
    return result as T;
  }
  return obj;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
  currentDashboard: {
    id: 'dash-main',
    workspaceId: 'ws-main',
    title: 'لوحة تحليل ومقارنة عروض الشركات والموردين 2026',
    description: 'مزامنة حية ومباشرة مع Google Sheets - تحليل تفاعلي للأسعار، الأقسام، وشروط الضمان',
    widgets: INITIAL_WIDGETS,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: true
  },
  currentDataSource: INITIAL_DATA_SOURCE,
  multiTableModel: null,
  setMultiTableModel: (model) => set({ multiTableModel: model }),
  selectedWidgetId: null,
  activeFilters: {},
  widgetFilters: {},
  isEditMode: false,
  isShareModalOpen: false,
  isDataGridOpen: false,
  theme: 'dark',
  motionTheme: 'glass-capsule',
  lastSavedAt: null,
  drillDownStates: {},
  activeTableRowKey: null,
  setActiveTableRowKey: (key) =>
    set((state) => ({
      activeTableRowKey: state.activeTableRowKey === key ? null : key
    })),

  // ─── Multi-Project Initial State ─────────────────────────────────────────
  currentProjectId: DEFAULT_PROJECT_ID,
  projects: [],   // will be auto-populated on first render via migration

  resetToDefaults: () =>
    set({
      currentDashboard: {
        id: 'dash-main',
        workspaceId: 'ws-main',
        title: 'لوحة تحليل ومقارنة عروض الشركات والموردين 2026',
        description: 'مزامنة حية ومباشرة مع Google Sheets - تحليل تفاعلي للأسعار، الأقسام، وشروط الضمان',
        widgets: INITIAL_WIDGETS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: true
      },
      currentDataSource: INITIAL_DATA_SOURCE,
      selectedWidgetId: 'w-bar-1',
      activeFilters: {},
      widgetFilters: {},
      isEditMode: false,
      theme: 'dark',
      sidebarsPlacement: 'powerbi-right',
      activeTableRowKey: null,
      lastSavedAt: new Date().toISOString()
    }),

  // Sidebars & Layout Defaults (Power BI Side-by-Side Style)
  sidebarsPlacement: 'powerbi-right',
  dataPanelWidth: 260,
  visualizationsPanelWidth: 320,
  isDataPanelCollapsed: false,
  isVisualizationsPanelCollapsed: false,

  setSelectedWidgetId: (id) => set({ selectedWidgetId: id }),

  // Widget Reordering & Placement Actions
  reorderWidget: (sourceIndex: number, targetIndex: number) =>
    set((state) => {
      if (sourceIndex === targetIndex) return state;
      const widgets = [...state.currentDashboard.widgets];
      if (
        sourceIndex < 0 ||
        sourceIndex >= widgets.length ||
        targetIndex < 0 ||
        targetIndex >= widgets.length
      ) {
        return state;
      }
      const [moved] = widgets.splice(sourceIndex, 1);
      widgets.splice(targetIndex, 0, moved);
      return {
        currentDashboard: {
          ...state.currentDashboard,
          widgets,
          updatedAt: new Date().toISOString()
        },
        lastSavedAt: new Date().toISOString()
      };
    }),

  moveWidgetToPosition: (widgetId: string, position: 'start' | 'middle' | 'end' | 'up' | 'down') =>
    set((state) => {
      const widgets = [...state.currentDashboard.widgets];
      const currentIndex = widgets.findIndex((w) => w.id === widgetId);
      if (currentIndex === -1) return state;

      let targetIndex = currentIndex;
      if (position === 'start') {
        targetIndex = 0;
      } else if (position === 'end') {
        targetIndex = widgets.length - 1;
      } else if (position === 'middle') {
        targetIndex = Math.floor(widgets.length / 2);
      } else if (position === 'up') {
        targetIndex = Math.max(0, currentIndex - 1);
      } else if (position === 'down') {
        targetIndex = Math.min(widgets.length - 1, currentIndex + 1);
      }

      if (targetIndex === currentIndex) return state;

      const [moved] = widgets.splice(currentIndex, 1);
      widgets.splice(targetIndex, 0, moved);

      return {
        currentDashboard: {
          ...state.currentDashboard,
          widgets,
          updatedAt: new Date().toISOString()
        },
        lastSavedAt: new Date().toISOString()
      };
    }),

  moveWidgetToIndex: (widgetId: string, targetIndex: number) =>
    set((state) => {
      const widgets = [...state.currentDashboard.widgets];
      const currentIndex = widgets.findIndex((w) => w.id === widgetId);
      if (currentIndex === -1) return state;

      const clampedTarget = Math.max(0, Math.min(widgets.length - 1, targetIndex));
      if (clampedTarget === currentIndex) return state;

      const [moved] = widgets.splice(currentIndex, 1);
      widgets.splice(clampedTarget, 0, moved);

      return {
        currentDashboard: {
          ...state.currentDashboard,
          widgets,
          updatedAt: new Date().toISOString()
        },
        lastSavedAt: new Date().toISOString()
      };
    }),

  addWidget: (type) =>
    set((state) => {
      const newId = `w-${type}-${Date.now()}`;
      const cols = state.currentDataSource.columns;
      const strCols = cols.filter((c) => c.dataType === 'string');
      const numCols = cols.filter((c) => c.dataType === 'numeric');

      const xCol = strCols[0]?.columnName || cols[0]?.columnName || 'المنطقة';
      const yCol = numCols[0]?.columnName || cols[1]?.columnName || 'المبيعات';
      const cleanCols = cols
        .filter((c) => c.columnName && !c.columnName.startsWith('__EMPTY') && c.columnName.trim() !== '')
        .map((c) => c.columnName);

      const typeTitles: Record<WidgetType, string> = {
        kpi: `مؤشر أداء: ${yCol}`,
        bar: `مخطط شريطي: ${yCol} حسب ${xCol}`,
        horizontal_bar: `مخطط أفقي: ${yCol} حسب ${xCol}`,
        line: `مسار خطي: ${yCol} حسب ${xCol}`,
        area: `مخطط مساحي: ${yCol} حسب ${xCol}`,
        pie: `توزيع دائري: ${yCol} حسب ${xCol}`,
        donut: `دائري مجوف: ${yCol} حسب ${xCol}`,
        radar: `مخطط راداري مقارن`,
        funnel: `قمع التحويل: ${yCol} حسب ${xCol}`,
        gauge: `عداد الإنجاز: ${yCol}`,
        scatter: `مخطط انتشار العلاقة`,
        treemap: `خريطة الشجرة: ${yCol} حسب ${xCol}`,
        sunburst: `مخطط أشعة الشمس: ${yCol} حسب ${xCol}`,
        heatmap: `خريطة حرارية: ${yCol}`,
        wordcloud: `سحابة الكلمات: ${xCol}`,
        pivot: `جدول محوري مجمع`,
        table: 'جدول بيانات تفصيلي',
        slicer: `تصفية حسب: ${xCol}`
      };

      const isCompact = type === 'kpi' || type === 'slicer' || type === 'gauge';
      const isFullWidth = type === 'table' || type === 'pivot';
      const newWidget: Widget = {
        id: newId,
        dashboardId: state.currentDashboard.id,
        dataSourceId: state.currentDataSource.id,
        type,
        title: typeTitles[type] || 'عنصر جديد',
        config: {
          xAxisColumn: xCol,
          yAxisColumn: yCol,
          secondaryMetric: numCols[1]?.columnName || numCols[0]?.columnName,
          tableColumns: type === 'table' ? cleanCols.slice(0, 5) : undefined,
          tablePageSize: 8,
          slicerColumns:
            type === 'slicer'
              ? strCols.length > 0
                ? strCols.slice(0, 4).map((c) => c.columnName)
                : [xCol]
              : undefined,
          activeSlicerColumn: type === 'slicer' ? xCol : undefined,
          aggregation: 'SUM',
          numberFormat: type === 'donut' || type === 'pie' ? 'percent' : 'currency',
          sortOrder: 'desc',
          colorTheme: 'sky'
        },
        layout: {
          x: (state.currentDashboard.widgets.length * 3) % 12,
          y: Infinity,
          w: isFullWidth ? 12 : isCompact ? 3 : 6,
          h: isCompact ? 2 : 4,
          i: newId
        }
      };

      return {
        currentDashboard: {
          ...state.currentDashboard,
          widgets: [...state.currentDashboard.widgets, newWidget]
        },
        selectedWidgetId: newId
      };
    }),

  duplicateWidget: (id) =>
    set((state) => {
      const source = state.currentDashboard.widgets.find((w) => w.id === id);
      if (!source) return state;

      const newId = `w-${source.type}-${Date.now()}`;
      const clonedWidget: Widget = {
        ...source,
        id: newId,
        title: `${source.title} (نسخة)`,
        layout: {
          ...source.layout,
          x: (source.layout.x + 2) % 12,
          y: source.layout.y + 1,
          i: newId
        }
      };

      return {
        currentDashboard: {
          ...state.currentDashboard,
          widgets: [...state.currentDashboard.widgets, clonedWidget]
        },
        selectedWidgetId: newId
      };
    }),

  changeWidgetType: (id, newType) =>
    set((state) => ({
      currentDashboard: {
        ...state.currentDashboard,
        widgets: state.currentDashboard.widgets.map((w) =>
          w.id === id ? { ...w, type: newType } : w
        )
      }
    })),

  removeWidget: (id) =>
    set((state) => {
      const nextWidgetFilters = { ...state.widgetFilters };
      delete nextWidgetFilters[id];

      const widgets = state.currentDashboard.widgets
        .filter((w) => w.id !== id)
        .map((w) => {
          if (w.config?.linkedWidgetIds?.includes(id)) {
            return {
              ...w,
              config: {
                ...w.config,
                linkedWidgetIds: w.config.linkedWidgetIds.filter((tid) => tid !== id)
              }
            };
          }
          return w;
        });

      return {
        currentDashboard: {
          ...state.currentDashboard,
          widgets
        },
        widgetFilters: nextWidgetFilters,
        selectedWidgetId: state.selectedWidgetId === id ? null : state.selectedWidgetId
      };
    }),

  updateWidgetConfig: (id, updates) =>
    set((state) => ({
      currentDashboard: {
        ...state.currentDashboard,
        widgets: state.currentDashboard.widgets.map((w) =>
          w.id === id ? { ...w, config: { ...w.config, ...updates } } : w
        )
      }
    })),

  updateWidgetLayout: (id, layoutUpdates) =>
    set((state) => ({
      currentDashboard: {
        ...state.currentDashboard,
        widgets: state.currentDashboard.widgets.map((w) =>
          w.id === id ? { ...w, layout: { ...w.layout, ...layoutUpdates } } : w
        )
      }
    })),

  updateWidgetTitle: (id, title) =>
    set((state) => ({
      currentDashboard: {
        ...state.currentDashboard,
        widgets: state.currentDashboard.widgets.map((w) =>
          w.id === id ? { ...w, title } : w
        )
      }
    })),

  setWidgetWidth: (id, w) =>
    set((state) => ({
      currentDashboard: {
        ...state.currentDashboard,
        widgets: state.currentDashboard.widgets.map((widget) =>
          widget.id === id
            ? { ...widget, layout: { ...widget.layout, w: Math.min(12, Math.max(3, w)) } }
            : widget
        )
      }
    })),

  setWidgetHeight: (id, h) =>
    set((state) => ({
      currentDashboard: {
        ...state.currentDashboard,
        widgets: state.currentDashboard.widgets.map((widget) =>
          widget.id === id
            ? { ...widget, layout: { ...widget.layout, h: Math.min(8, Math.max(2, h)) } }
            : widget
        )
      }
    })),

  addSlicerForColumn: (columnName) =>
    set((state) => {
      const newId = `w-slicer-${Date.now()}`;
      const newSlicerWidget: Widget = {
        id: newId,
        dashboardId: state.currentDashboard.id,
        dataSourceId: state.currentDataSource.id,
        type: 'slicer',
        title: `تصفية حسب: ${columnName}`,
        config: {
          xAxisColumn: columnName,
          slicerColumns: [columnName],
          activeSlicerColumn: columnName
        },
        layout: {
          x: (state.currentDashboard.widgets.length * 3) % 12,
          y: 0,
          w: 3,
          h: 2,
          i: newId
        }
      };

      return {
        currentDashboard: {
          ...state.currentDashboard,
          widgets: [newSlicerWidget, ...state.currentDashboard.widgets]
        },
        selectedWidgetId: newId
      };
    }),

  setFilter: (column, value, sourceWidgetId) =>
    set((state) => {
      const nextFilters = { ...state.activeFilters };
      const nextWidgetFilters = { ...state.widgetFilters };

      const isClear = value === null || value === undefined || value === '' || value === 'الكل';

      if (isClear) {
        delete nextFilters[column];
        if (sourceWidgetId && nextWidgetFilters[sourceWidgetId]) {
          const sub = { ...nextWidgetFilters[sourceWidgetId] };
          delete sub[column];
          if (Object.keys(sub).length === 0) {
            delete nextWidgetFilters[sourceWidgetId];
          } else {
            nextWidgetFilters[sourceWidgetId] = sub;
          }
        }
      } else {
        nextFilters[column] = value;
        if (sourceWidgetId) {
          nextWidgetFilters[sourceWidgetId] = {
            ...(nextWidgetFilters[sourceWidgetId] || {}),
            [column]: value
          };
        }
      }
      return { activeFilters: nextFilters, widgetFilters: nextWidgetFilters };
    }),

  clearFilter: (column, sourceWidgetId) =>
    set((state) => {
      const nextFilters = { ...state.activeFilters };
      delete nextFilters[column];

      const nextWidgetFilters = { ...state.widgetFilters };
      if (sourceWidgetId && nextWidgetFilters[sourceWidgetId]) {
        const sub = { ...nextWidgetFilters[sourceWidgetId] };
        delete sub[column];
        if (Object.keys(sub).length === 0) {
          delete nextWidgetFilters[sourceWidgetId];
        } else {
          nextWidgetFilters[sourceWidgetId] = sub;
        }
      } else if (!sourceWidgetId) {
        for (const wid of Object.keys(nextWidgetFilters)) {
          if (nextWidgetFilters[wid][column]) {
            const sub = { ...nextWidgetFilters[wid] };
            delete sub[column];
            if (Object.keys(sub).length === 0) {
              delete nextWidgetFilters[wid];
            } else {
              nextWidgetFilters[wid] = sub;
            }
          }
        }
      }
      return { activeFilters: nextFilters, widgetFilters: nextWidgetFilters };
    }),

  clearAllFilters: () => set({ activeFilters: {}, widgetFilters: {} }),

  clearWidgetFilters: (widgetId) =>
    set((state) => {
      const nextWidgetFilters = { ...state.widgetFilters };
      const targetFilters = nextWidgetFilters[widgetId] || {};
      delete nextWidgetFilters[widgetId];

      const nextActive = { ...state.activeFilters };
      for (const col of Object.keys(targetFilters)) {
        delete nextActive[col];
      }
      return { activeFilters: nextActive, widgetFilters: nextWidgetFilters };
    }),

  setWidgetLinks: (widgetId, linkedWidgetIds, crossFilterMode = 'custom', bidirectional = true) =>
    set((state) => {
      const allWidgets = state.currentDashboard.widgets;
      const widgets: Widget[] = allWidgets.map((w): Widget => {
        if (w.id === widgetId) {
          return {
            ...w,
            config: {
              ...w.config,
              crossFilterMode,
              linkedWidgetIds
            }
          };
        }
        if (bidirectional) {
          const isCurrentlyLinked = (linkedWidgetIds || []).includes(w.id);
          if (crossFilterMode === 'all') {
            if (w.config?.crossFilterMode === 'custom') {
              const currentLinks = w.config.linkedWidgetIds || [];
              if (!currentLinks.includes(widgetId)) {
                return {
                  ...w,
                  config: { ...w.config, linkedWidgetIds: [...currentLinks, widgetId] }
                };
              }
            }
          } else if (crossFilterMode === 'none') {
            if (w.config?.linkedWidgetIds?.includes(widgetId)) {
              return {
                ...w,
                config: {
                  ...w.config,
                  linkedWidgetIds: w.config.linkedWidgetIds.filter((id) => id !== widgetId)
                }
              };
            }
          } else if (crossFilterMode === 'custom') {
            const currentLinks = w.config?.linkedWidgetIds || allWidgets.filter((x) => x.id !== w.id).map((x) => x.id);
            if (isCurrentlyLinked && !currentLinks.includes(widgetId)) {
              return {
                ...w,
                config: { ...w.config, crossFilterMode: 'custom' as const, linkedWidgetIds: [...currentLinks, widgetId] }
              };
            } else if (!isCurrentlyLinked && currentLinks.includes(widgetId)) {
              return {
                ...w,
                config: { ...w.config, crossFilterMode: 'custom' as const, linkedWidgetIds: currentLinks.filter((id) => id !== widgetId) }
              };
            }
          }
        }
        return w;
      });

      return {
        currentDashboard: {
          ...state.currentDashboard,
          widgets,
          updatedAt: new Date().toISOString()
        },
        lastSavedAt: new Date().toISOString()
      };
    }),

  toggleWidgetLink: (sourceWidgetId, targetWidgetId, bidirectional = true) =>
    set((state) => {
      const allWidgets = state.currentDashboard.widgets;
      const sourceWidget = allWidgets.find((w) => w.id === sourceWidgetId);
      if (!sourceWidget) return state;

      const currentLinks: string[] = sourceWidget.config?.linkedWidgetIds !== undefined
        ? (sourceWidget.config.linkedWidgetIds || [])
        : (sourceWidget.config?.crossFilterMode === 'none' ? [] : allWidgets.filter((w) => w.id !== sourceWidgetId).map((w) => w.id));

      const isLinked = currentLinks.includes(targetWidgetId);
      const nextSourceLinks = isLinked
        ? currentLinks.filter((id) => id !== targetWidgetId)
        : [...currentLinks, targetWidgetId];

      const widgets: Widget[] = allWidgets.map((w): Widget => {
        if (w.id === sourceWidgetId) {
          return {
            ...w,
            config: {
              ...w.config,
              crossFilterMode: 'custom' as const,
              linkedWidgetIds: nextSourceLinks
            }
          };
        }
        if (bidirectional && w.id === targetWidgetId) {
          const targetCurrentLinks: string[] = w.config?.linkedWidgetIds !== undefined
            ? (w.config.linkedWidgetIds || [])
            : (w.config?.crossFilterMode === 'none' ? [] : allWidgets.filter((x) => x.id !== targetWidgetId).map((x) => x.id));
          const nextTargetLinks = isLinked
            ? targetCurrentLinks.filter((id) => id !== sourceWidgetId)
            : [...targetCurrentLinks, sourceWidgetId];
          return {
            ...w,
            config: {
              ...w.config,
              crossFilterMode: 'custom' as const,
              linkedWidgetIds: nextTargetLinks
            }
          };
        }
        return w;
      });

      return {
        currentDashboard: {
          ...state.currentDashboard,
          widgets,
          updatedAt: new Date().toISOString()
        },
        lastSavedAt: new Date().toISOString()
      };
    }),

  setWidgetIgnoreIncoming: (widgetId, ignore) =>
    set((state) => ({
      currentDashboard: {
        ...state.currentDashboard,
        widgets: state.currentDashboard.widgets.map((w) =>
          w.id === widgetId
            ? { ...w, config: { ...w.config, ignoreIncomingFilters: ignore } }
            : w
        ),
        updatedAt: new Date().toISOString()
      },
      lastSavedAt: new Date().toISOString()
    })),

  setEditMode: (isEditMode) => set({ isEditMode }),

  setShareModalOpen: (isShareModalOpen) => set({ isShareModalOpen }),

  setDataGridOpen: (isDataGridOpen) => set({ isDataGridOpen }),

  setTheme: (theme) => set({ theme }),

  setMotionTheme: (motionTheme) =>
    set((state) => {
      const now = new Date().toISOString();
      const updatedProjects = (state.projects || []).map((p) =>
        p.id === state.currentProjectId
          ? { ...p, motionTheme, dashboard: { ...p.dashboard, motionTheme }, updatedAt: now }
          : p
      );
      const activeProj = updatedProjects.find((p) => p.id === state.currentProjectId);
      if (activeProj) {
        saveProjectToDb(activeProj, true).catch(() => {});
      }
      return {
        motionTheme,
        projects: updatedProjects,
        currentDashboard: {
          ...state.currentDashboard,
          motionTheme,
          updatedAt: now
        }
      };
    }),

  setDataSource: (incomingDataSource, autoGenerateDashboard = false) => {
    // Sanitize columns: filter out '__EMPTY' or blank columns and fix mojibake
    const cleanColumns = (incomingDataSource.columns || [])
      .filter((c) => c.columnName && !c.columnName.startsWith('__EMPTY') && c.columnName.trim() !== '')
      .map((c) => ({ ...c, columnName: sanitizeMojibakeString(c.columnName) }));

    // Sanitize rawRows keys and string values so charts and tables receive clean Arabic text
    const sanitizedRows = (incomingDataSource.rawRows || []).map((row) => {
      if (!row || typeof row !== 'object') return row;
      const cleanRow: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        cleanRow[sanitizeMojibakeString(k)] = typeof v === 'string' ? sanitizeMojibakeString(v) : v;
      }
      return cleanRow;
    });

    const currentDataSource: DataSource = {
      ...incomingDataSource,
      fileName: sanitizeMojibakeString(incomingDataSource.fileName || ''),
      columns: cleanColumns,
      rawRows: sanitizedRows
    };

    set((state) => {
      const now = new Date().toISOString();
      let updatedDashboard: Dashboard;

      // If user requested smart auto-generation, or current dashboard has no widgets
      if (autoGenerateDashboard || state.currentDashboard.widgets.length === 0) {
        const smartWidgets = createSmartDashboardWidgets(currentDataSource, state.currentDashboard.id);
        updatedDashboard = {
          ...state.currentDashboard,
          title: currentDataSource.fileName ? `لوحة تحليلات: ${currentDataSource.fileName.replace(/\.[^/.]+$/, '')}` : state.currentDashboard.title,
          widgets: smartWidgets,
          updatedAt: now
        };
      } else {
        const strCols = currentDataSource.columns.filter((c) => c.dataType === 'string' || c.dataType === 'date').map((c) => c.columnName);
        const numCols = currentDataSource.columns.filter((c) => c.dataType === 'numeric').map((c) => c.columnName);
        const allCols = currentDataSource.columns.map((c) => c.columnName);

        const firstStrCol = strCols[0] || allCols[0] || 'القسم';
        const firstNumCol = numCols[0] || allCols[1] || allCols[0] || 'القيمة';
        const secondNumCol = numCols[1] || numCols[0] || firstNumCol;

        const adaptedWidgets = state.currentDashboard.widgets.map((w) => {
          const xExists = currentDataSource.columns.some((c) => c.columnName === w.config.xAxisColumn);
          const yExists = currentDataSource.columns.some((c) => c.columnName === w.config.yAxisColumn);

          // Adapt table columns:
          let tableColumns = w.config.tableColumns;
          if (w.type === 'table') {
            const valid = (w.config.tableColumns || []).filter((c) => allCols.includes(c));
            tableColumns = valid.length > 0 ? valid : allCols.slice(0, 6);
          }

          // Adapt slicer columns:
          let slicerColumns = w.config.slicerColumns;
          let activeSlicerColumn = w.config.activeSlicerColumn;
          if (w.type === 'slicer') {
            const valid = (w.config.slicerColumns || []).filter((c) => allCols.includes(c));
            slicerColumns = valid.length > 0 ? valid : (strCols.length > 0 ? strCols.slice(0, 4) : [firstStrCol]);
            activeSlicerColumn = activeSlicerColumn && slicerColumns.includes(activeSlicerColumn)
              ? activeSlicerColumn
              : slicerColumns[0];
          }

          // Adapt drillDownLevels:
          const drillDownLevels = (w.config.drillDownLevels || []).filter((c) => allCols.includes(c));

          return {
            ...w,
            config: {
              ...w.config,
              xAxisColumn: xExists ? w.config.xAxisColumn : firstStrCol,
              yAxisColumn: yExists ? w.config.yAxisColumn : firstNumCol,
              secondaryMetric: (w.config.secondaryMetric && allCols.includes(w.config.secondaryMetric))
                ? w.config.secondaryMetric
                : secondNumCol,
              tableColumns,
              slicerColumns,
              activeSlicerColumn,
              drillDownLevels: drillDownLevels.length > 0 ? drillDownLevels : undefined
            }
          };
        });

        updatedDashboard = {
          ...state.currentDashboard,
          widgets: adaptedWidgets,
          updatedAt: now
        };
      }

      // Keep projects array strictly in sync with the new dataset
      const updatedProjects = (state.projects || []).map((p) => {
        if (p.id === state.currentProjectId) {
          return {
            ...p,
            dashboard: updatedDashboard,
            dataSource: currentDataSource,
            updatedAt: now
          };
        }
        return p;
      });

      // Save updated project to PostgreSQL immediately
      const activeProj = updatedProjects.find((p) => p.id === state.currentProjectId);
      if (activeProj) {
        saveProjectToDb(activeProj, true).catch(() => {});
      }

      return {
        currentDataSource,
        currentDashboard: updatedDashboard,
        projects: updatedProjects,
        activeFilters: {},
        widgetFilters: {},
        drillDownStates: {},
        lastSavedAt: now
      };
    });
  },

  generateSmartDashboardForDataSource: (targetDataSource) => {
    const state = get();
    const ds = targetDataSource || state.currentDataSource;
    const smartWidgets = createSmartDashboardWidgets(ds, state.currentDashboard.id);
    set({
      currentDashboard: {
        ...state.currentDashboard,
        title: ds.fileName ? `لوحة تحليلات: ${ds.fileName.replace(/\.[^/.]+$/, '')}` : state.currentDashboard.title,
        widgets: smartWidgets,
        updatedAt: new Date().toISOString()
      },
      activeFilters: {},
      widgetFilters: {},
      drillDownStates: {},
      lastSavedAt: new Date().toISOString()
    });
  },

  setSidebarsPlacement: (sidebarsPlacement) => set({ sidebarsPlacement }),

  setDataPanelWidth: (width) =>
    set({ dataPanelWidth: Math.min(500, Math.max(180, width)) }),

  setVisualizationsPanelWidth: (width) =>
    set({ visualizationsPanelWidth: Math.min(600, Math.max(240, width)) }),

  toggleDataPanel: () =>
    set((state) => ({ isDataPanelCollapsed: !state.isDataPanelCollapsed })),

  toggleVisualizationsPanel: () =>
    set((state) => ({ isVisualizationsPanelCollapsed: !state.isVisualizationsPanelCollapsed })),

  // Real Data Row Editing
  updateRawRows: (rows) =>
    set((state) => ({
      currentDataSource: {
        ...state.currentDataSource,
        rawRows: rows
      }
    })),

  addRawRow: (row) =>
    set((state) => {
      const updatedRows = [row, ...state.currentDataSource.rawRows];
      return {
        currentDataSource: {
          ...state.currentDataSource,
          rawRows: updatedRows
        }
      };
    }),

  deleteRawRow: (index) =>
    set((state) => {
      const updatedRows = state.currentDataSource.rawRows.filter((_, idx) => idx !== index);
      return {
        currentDataSource: {
          ...state.currentDataSource,
          rawRows: updatedRows
        }
      };
    }),

  updateRawCell: (rowIndex, column, value) =>
    set((state) => {
      const updatedRows = [...state.currentDataSource.rawRows];
      if (updatedRows[rowIndex]) {
        updatedRows[rowIndex] = {
          ...updatedRows[rowIndex],
          [column]: value
        };
      }
      return {
        currentDataSource: {
          ...state.currentDataSource,
          rawRows: updatedRows
        }
      };
    }),

  loadDashboardSnapshot: (snapshot) =>
    set((state) => {
      const snapWidgets = snapshot.dashboard?.widgets;
      const sanitizedWidgets = snapWidgets
        ? snapWidgets.map((w: any) => ({
            ...w,
            layout: {
              x: w.layout?.x ?? 0,
              y: w.layout?.y ?? 0,
              w: w.layout?.w ?? (w.type === 'slicer' || w.type === 'table' ? 12 : 6),
              h: w.layout?.h ?? (w.type === 'kpi' ? 2 : w.type === 'table' ? 5 : 4),
              i: w.layout?.i || w.id,
              ...(w.layout || {})
            }
          }))
        : undefined;

      return {
        currentDashboard: snapshot.dashboard
          ? ({
              ...state.currentDashboard,
              ...snapshot.dashboard,
              ...(sanitizedWidgets ? { widgets: sanitizedWidgets } : {})
            } as any)
          : state.currentDashboard,
        currentDataSource: snapshot.dataSource
          ? ({ ...state.currentDataSource, ...snapshot.dataSource } as any)
          : state.currentDataSource,
        theme: snapshot.theme || state.theme,
        selectedWidgetId: snapshot.dashboard?.widgets?.[0]?.id || state.selectedWidgetId,
        // Restore drill-down hierarchy and filters if provided; otherwise reset to clean state
        drillDownStates: snapshot.drillDownStates ?? {},
        widgetFilters: snapshot.widgetFilters ?? {},
        activeFilters: snapshot.activeFilters ?? {},
      };
    }),

  drillDown: (widgetId, column, value) =>
    set((state) => {
      const current = state.drillDownStates[widgetId] || { path: [], levelIndex: 0 };
      const newPath = [...current.path, { column, value }];
      // Drill-down filters are stored ONLY in widgetFilters[widgetId].
      // activeFilters is reserved for slicer-based global filters.
      const nextWidgetFilters = {
        ...state.widgetFilters,
        [widgetId]: {
          ...(state.widgetFilters[widgetId] || {}),
          [column]: value
        }
      };
      return {
        drillDownStates: {
          ...state.drillDownStates,
          [widgetId]: { path: newPath, levelIndex: newPath.length }
        },
        widgetFilters: nextWidgetFilters
      };
    }),

  drillUp: (widgetId, toLevelIndex) =>
    set((state) => {
      const current = state.drillDownStates[widgetId];
      if (!current || current.path.length === 0) return state;

      const allWidgets = state.currentDashboard?.widgets || [];
      const connectedIds = getConnectedWidgetIds(widgetId, allWidgets);

      const targetLevel = toLevelIndex !== undefined ? toLevelIndex : current.levelIndex - 1;
      const clampedLevel = Math.max(0, Math.min(targetLevel, current.path.length));

      // Check if any connected widget also has active drill-down
      const hasConnectedActiveDrill = connectedIds.some(
        (id) => (state.drillDownStates[id]?.path?.length || 0) > 0
      );

      // If returning to root (clampedLevel === 0) OR if connected widgets also have active drill-down,
      // reset both/all connected charts back to base without hierarchy filters.
      // NOTE: activeFilters is NOT touched here  -  slicer/global filters are strictly preserved!
      if (clampedLevel === 0 || hasConnectedActiveDrill) {
        const targetIds = [widgetId, ...connectedIds];
        const nextDrillDownStates = { ...state.drillDownStates };
        const nextWidgetFilters = { ...state.widgetFilters };

        for (const id of targetIds) {
          nextDrillDownStates[id] = { path: [], levelIndex: 0 };
          delete nextWidgetFilters[id];
        }

        return {
          drillDownStates: nextDrillDownStates,
          widgetFilters: nextWidgetFilters
        };
      }

      // Single-widget gradual drill-up (when no other connected chart is drilled)
      const removedSteps = current.path.slice(clampedLevel);
      const newPath = current.path.slice(0, clampedLevel);

      const nextWidgetFilters = { ...state.widgetFilters };
      const sub = { ...(nextWidgetFilters[widgetId] || {}) };
      for (const step of removedSteps) {
        delete sub[step.column];
      }
      if (Object.keys(sub).length === 0) {
        delete nextWidgetFilters[widgetId];
      } else {
        nextWidgetFilters[widgetId] = sub;
      }

      return {
        drillDownStates: {
          ...state.drillDownStates,
          [widgetId]: { path: newPath, levelIndex: newPath.length }
        },
        widgetFilters: nextWidgetFilters
      };
    }),

  resetDrillDown: (widgetId) =>
    set((state) => {
      // Fully clears this widget's own drill state and all connected widgets' drill states back to base.
      // NOTE: activeFilters is NOT touched here  -  slicer/global filters are strictly preserved!
      const allWidgets = state.currentDashboard?.widgets || [];
      const connectedIds = getConnectedWidgetIds(widgetId, allWidgets);
      const targetIds = [widgetId, ...connectedIds];

      const nextDrillDownStates = { ...state.drillDownStates };
      const nextWidgetFilters = { ...state.widgetFilters };

      for (const id of targetIds) {
        nextDrillDownStates[id] = { path: [], levelIndex: 0 };
        delete nextWidgetFilters[id];
      }

      return {
        drillDownStates: nextDrillDownStates,
        widgetFilters: nextWidgetFilters
      };
    }),

  // ─── Multi-Project Actions ────────────────────────────────────────────────

  switchProject: (projectId) =>
    set((state) => {
      const target = state.projects.find((p) => p.id === projectId);
      if (!target || projectId === state.currentProjectId) return state;

      // Save current live state back into the current project slot
      const updatedProjects = state.projects.map((p) => {
        if (p.id === state.currentProjectId) {
          return {
            ...p,
            dashboard: state.currentDashboard,
            dataSource: state.currentDataSource,
            activeFilters: state.activeFilters,
            widgetFilters: state.widgetFilters,
            drillDownStates: state.drillDownStates,
            theme: state.theme,
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });

      // Persist all projects to PostgreSQL in background
      saveAllProjectsToDb(updatedProjects, projectId).catch(() => {});

      return {
        projects: updatedProjects,
        currentProjectId: projectId,
        currentDashboard: target.dashboard,
        currentDataSource: target.dataSource,
        activeFilters: target.activeFilters,
        widgetFilters: target.widgetFilters,
        drillDownStates: target.drillDownStates,
        theme: target.theme,
        motionTheme: (target.motionTheme as MotionThemeId) || (target.dashboard?.motionTheme as MotionThemeId) || state.motionTheme || 'glass-capsule',
        selectedWidgetId: null,
        lastSavedAt: new Date().toISOString()
      };
    }),

  createProject: (options) => {
    const newId = `proj-${Date.now()}`;
    unmarkProjectAsDeleted(newId);
    const now = new Date().toISOString();
    const newDashId = `dash-${newId}`;

    // Select or construct initial data source for this project
    const rawDataSource = options.initialDataSource || (
      options.dataSourceType === 'database'
        ? REGIONAL_SALES_DATA_SOURCE
        : options.dataSourceType === 'excel_csv'
        ? TECH_COMPANIES_DATA_SOURCE
        : INITIAL_DATA_SOURCE
    );

    const dataSource: DataSource = {
      ...rawDataSource,
      id: `ds-${newId}`,
      workspaceId: newId,
      fileName: options.initialDataSource?.fileName || (
        options.dataSourceType === 'database'
          ? `قاعدة بيانات: ${options.title}.db`
          : options.dataSourceType === 'google_sheets'
          ? `شيت جوجل: ${options.title}`
          : options.dataSourceType === 'excel_csv'
          ? `${options.title}.xlsx`
          : `${options.title} - بيانات مخصصة`
      )
    };

    // Auto-generate smart tailored Power BI widgets for non-empty templates
    const smartWidgets = (options.dataSourceType === 'empty')
      ? []
      : createSmartDashboardWidgets(dataSource, newDashId);

    const newDashboard: Dashboard = {
      id: newDashId,
      workspaceId: newId,
      title: options.title,
      description: options.description || `مشروع تحليلي وقاعدة بيانات مخصصة لـ ${options.title}`,
      widgets: smartWidgets,
      createdAt: now,
      updatedAt: now,
      isPublic: false
    };

    // Each new project has its own dedicated database space
    const projectDbConfig: ProjectDatabaseConfig = {
      connected: true,
      provider: 'supabase_postgres',
      projectId: newId,
      databaseName: 'enterprise_bi_db',
      tableName: `proj_${newId.replace(/[^a-zA-Z0-9]/g, '_')}_data`,
      schema: 'public',
      status: 'connected',
      lastSyncedAt: now,
      rowCount: dataSource.rawRows?.length || 0,
      dbHost: 'localhost',
      dbPort: 5432,
      ...options.databaseConfig
    };

    const newProject: Project = {
      id: newId,
      title: options.title,
      description: options.description,
      category: options.category || 'sales',
      icon: options.icon || '📊',
      colorAccent: options.colorAccent || 'sky',
      createdAt: now,
      updatedAt: now,
      dataSourceType: options.dataSourceType,
      googleSheetUrl: options.googleSheetUrl,
      databaseConfig: projectDbConfig,
      dataSource,
      dashboard: newDashboard,
      activeFilters: {},
      widgetFilters: {},
      drillDownStates: {},
      theme: options.theme || get().theme,
      isPublic: false
    };

    // Save current project state then switch to new one
    const state = get();
    const updatedProjects = state.projects.map((p) => {
      if (p.id === state.currentProjectId) {
        return { ...p, dashboard: state.currentDashboard, dataSource: state.currentDataSource, updatedAt: now };
      }
      return p;
    });

    const allProjects = [...updatedProjects, newProject];
    useDashboardStore.setState({
      projects: allProjects,
      currentProjectId: newId,
      currentDashboard: newDashboard,
      currentDataSource: dataSource,
      activeFilters: {},
      widgetFilters: {},
      drillDownStates: {},
      selectedWidgetId: null,
      lastSavedAt: now
    });

    // Persist new project to PostgreSQL + sync data source rows in background
    saveAllProjectsToDb(allProjects, newId).catch(() => {});
    syncDataSourceToSupabase(dataSource, { sourceName: `[${options.title}] ${dataSource.fileName}` }).catch(() => {});

    return newId;
  },

  isDbControlOpen: false,
  setDbControlOpen: (isDbControlOpen) => set({ isDbControlOpen }),

  updateProjectDatabaseConfig: (projectId, config) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              databaseConfig: {
                ...(p.databaseConfig || {
                  connected: true,
                  provider: 'supabase_postgres',
                  projectId,
                  databaseName: 'enterprise_bi_db',
                  tableName: `proj_${projectId.replace(/[^a-zA-Z0-9]/g, '_')}_data`,
                  schema: 'public',
                  status: 'connected',
                  dbHost: 'localhost',
                  dbPort: 5432
                }),
                ...config
              }
            }
          : p
      )
    })),

  syncActiveProjectToDatabase: async () => {
    const state = get();
    const activeProject = state.projects.find((p) => p.id === state.currentProjectId);
    const ds = state.currentDataSource;
    try {
      const res = await syncDataSourceToSupabase(ds, {
        sourceName: `[${activeProject?.title || 'مشروع'}] ${ds.fileName}`
      });
      if (res.success) {
        const now = new Date().toISOString();
        const updatedProjects = state.projects.map((p) =>
          p.id === state.currentProjectId
            ? {
                ...p,
                dashboard: state.currentDashboard,
                dataSource: ds,
                updatedAt: now,
                databaseConfig: {
                  ...(p.databaseConfig || {
                    connected: true,
                    provider: 'supabase_postgres',
                    projectId: state.currentProjectId,
                    databaseName: 'enterprise_bi_db',
                    tableName: `proj_${state.currentProjectId.replace(/[^a-zA-Z0-9]/g, '_')}_data`,
                    schema: 'public',
                    dbHost: 'localhost',
                    dbPort: 5432
                  }),
                  connected: true,
                  status: 'connected' as const,
                  lastSyncedAt: now,
                  rowCount: res.rowsInserted || ds.rawRows.length
                }
              }
            : p
        );

        set({ projects: updatedProjects });

        const projToSave = updatedProjects.find((p) => p.id === state.currentProjectId);
        if (projToSave) {
          await saveProjectToDb(projToSave, true);
        }

        return {
          success: true,
          message: `✅ تمت مزامنة قاعدة البيانات وحفظ المشروع بنجاح (${(res.rowsInserted || ds.rawRows.length).toLocaleString()} سجل)`
        };
      }
      return { success: false, message: `⚠️ خطأ في المزامنة: ${res.error}` };
    } catch (err: any) {
      return { success: false, message: `فشل الاتصال بقاعدة البيانات: ${err.message}` };
    }
  },

  duplicateProject: (projectId) => {
    const state = get();
    const source = state.projects.find((p) => p.id === projectId);
    if (!source) return '';
    const newId = `proj-${Date.now()}`;
    unmarkProjectAsDeleted(newId);
    const now = new Date().toISOString();
    const newDashId = `dash-${newId}`;

    // If duplicating the currently active project, use live state
    const sourceDashboard = projectId === state.currentProjectId ? state.currentDashboard : source.dashboard;
    const sourceDataSource = projectId === state.currentProjectId ? state.currentDataSource : source.dataSource;

    const newDashboard: Dashboard = {
      ...sourceDashboard,
      id: newDashId,
      title: `${sourceDashboard.title} (نسخة)`,
      createdAt: now,
      updatedAt: now,
      widgets: sourceDashboard.widgets.map((w) => ({ ...w, dashboardId: newDashId }))
    };
    const duplicate: Project = {
      ...source,
      id: newId,
      title: `${source.title} (نسخة)`,
      createdAt: now,
      updatedAt: now,
      dashboard: newDashboard,
      dataSource: { ...sourceDataSource },
      activeFilters: {},
      widgetFilters: {},
      drillDownStates: {}
    };

    useDashboardStore.setState((s) => {
      const updated = [...s.projects, duplicate];
      saveAllProjectsToDb(updated, s.currentProjectId).catch(() => {});
      return { projects: updated };
    });
    return newId;
  },

  deleteProject: async (projectId: string) => {
    if (!projectId) return false;

    // ── 1. Immediately mark in persistent deleted tracker so it can NEVER resurrect ──
    markProjectAsDeleted(projectId);

    // ── 2. Update local state immediately ──────────────────────────────────────────
    const prev = useDashboardStore.getState();
    const remaining = prev.projects.filter((p) => p.id !== projectId);
    const wasActive = prev.currentProjectId === projectId;

    if (remaining.length === 0) {
      set({
        projects: [],
        currentProjectId: '',
        currentDashboard: {
          id: '',
          workspaceId: '',
          title: '',
          description: '',
          widgets: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: false
        },
        currentDataSource: { ...prev.currentDataSource, rawRows: [], columns: [], fileName: '' },
        activeFilters: {},
        widgetFilters: {},
        drillDownStates: {},
        selectedWidgetId: null,
        lastSavedAt: new Date().toISOString()
      });
    } else {
      const next = wasActive ? remaining[0] : (remaining.find((p) => p.id === prev.currentProjectId) || remaining[0]);
      set({
        projects: remaining,
        currentProjectId: next.id,
        currentDashboard: next.dashboard,
        currentDataSource: next.dataSource,
        activeFilters: next.activeFilters || {},
        widgetFilters: next.widgetFilters || {},
        drillDownStates: next.drillDownStates || {},
        theme: next.theme || prev.theme,
        selectedWidgetId: null,
        lastSavedAt: new Date().toISOString()
      });
    }

    // ── 3. Delete permanently from Supabase PostgreSQL ─────────────────────────────
    try {
      const res = await deleteProjectFromDb(projectId);
      if (!res.success) {
        console.warn('[deleteProject] DB deletion reported failure:', res.error);
      }
    } catch (err) {
      console.warn('[deleteProject] DB deletion exception:', err);
    }

    // ── 4. Sync active project marker to DB if remaining projects exist ────────────
    if (remaining.length > 0) {
      const nextActiveId = useDashboardStore.getState().currentProjectId;
      saveAllProjectsToDb(remaining, nextActiveId).catch(() => {});
    }

    return true;
  },



  updateProjectMeta: (projectId, meta) =>
    set((state) => {
      const updated = state.projects.map((p) =>
        p.id === projectId ? { ...p, ...meta, updatedAt: new Date().toISOString() } : p
      );
      const proj = updated.find((p) => p.id === projectId);
      if (proj) saveProjectToDb(proj, proj.id === state.currentProjectId).catch(() => {});
      return { projects: updated };
    }),

  setProjectGoogleSheetUrl: (projectId, url) =>
    set((state) => {
      const updated = state.projects.map((p) =>
        p.id === projectId ? { ...p, googleSheetUrl: url, dataSourceType: 'google_sheets' as const, updatedAt: new Date().toISOString() } : p
      );
      const proj = updated.find((p) => p.id === projectId);
      if (proj) saveProjectToDb(proj, proj.id === state.currentProjectId).catch(() => {});
      return { projects: updated };
    }),

  }),
  {
      name: 'lens-bi-dashboard-store-v7',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        currentDashboard: state.currentDashboard,
        currentDataSource: {
          ...state.currentDataSource,
          rawRows: state.currentDataSource.rawRows?.slice(0, 300) || []
        },
        selectedWidgetId: state.selectedWidgetId,
        activeFilters: state.activeFilters,
        isEditMode: state.isEditMode,
        theme: state.theme,
        motionTheme: state.motionTheme,
        sidebarsPlacement: state.sidebarsPlacement,
        dataPanelWidth: state.dataPanelWidth,
        visualizationsPanelWidth: state.visualizationsPanelWidth,
        isDataPanelCollapsed: state.isDataPanelCollapsed,
        isVisualizationsPanelCollapsed: state.isVisualizationsPanelCollapsed,
        lastSavedAt: new Date().toISOString(),
        // Persist multi-project state with slimmed cached rows
        projects: (state.projects || []).map((p) => ({
          ...p,
          dataSource: {
            ...p.dataSource,
            rawRows: p.dataSource.rawRows?.slice(0, 150) || []
          }
        })),
        currentProjectId: state.currentProjectId
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const deletedIds = getDeletedProjectIds();

        // Auto-sanitize rehydrated state and purge any deleted projects
        if (state.projects) {
          state.projects = sanitizeMojibakeDeep(state.projects).filter(
            (p) => !deletedIds.has(p.id)
          );
        }
        if (state.currentDashboard) {
          state.currentDashboard = sanitizeMojibakeDeep(state.currentDashboard);
        }

        // If the active project was deleted, reset to first remaining
        if (state.currentProjectId && deletedIds.has(state.currentProjectId)) {
          state.currentProjectId = state.projects?.[0]?.id || '';
        }

        // Load from PostgreSQL (PostgreSQL is the source of truth)
        loadProjectsFromDb().then((result) => {
          const freshDeletedIds = getDeletedProjectIds();

          if (result.success && result.projects) {
            // Permanently prune any projects from DB that are tracked as deleted
            for (const p of result.projects) {
              if (freshDeletedIds.has(p.id)) {
                deleteProjectFromDb(p.id).catch(() => {});
              }
            }

            const validDbProjects = sanitizeMojibakeDeep(result.projects).filter(
              (p) => !freshDeletedIds.has(p.id)
            );

            const currentState = useDashboardStore.getState();

            if (validDbProjects.length > 0) {
              const localActiveId = currentState.currentProjectId;
              const activeExists = validDbProjects.some((p) => p.id === localActiveId);
              const activeId = activeExists
                ? localActiveId
                : (result.activeProjectId && validDbProjects.some((p) => p.id === result.activeProjectId) ? result.activeProjectId : validDbProjects[0].id);

              const activeProject = validDbProjects.find((p) => p.id === activeId) || validDbProjects[0];

              useDashboardStore.setState({
                projects: validDbProjects,
                currentProjectId: activeProject.id,
                currentDashboard: activeProject.dashboard,
                currentDataSource: activeProject.dataSource,
                activeFilters: activeProject.activeFilters || {},
                widgetFilters: activeProject.widgetFilters || {},
                drillDownStates: activeProject.drillDownStates || {},
                theme: activeProject.theme || currentState.theme,
                selectedWidgetId: null,
                lastSavedAt: new Date().toISOString()
              });
            } else {
              // DB has 0 valid projects (all deleted)
              // Keep only local projects that have not been marked deleted
              const nonDeleted = (currentState.projects || []).filter(
                (p) => !freshDeletedIds.has(p.id)
              );
              useDashboardStore.setState({
                projects: nonDeleted,
                currentProjectId: nonDeleted[0]?.id || '',
                selectedWidgetId: null
              });
            }
          }
        }).catch((err) => {
          console.warn('[DashboardStore] Could not load projects from DB:', err?.message);
        });
      }
      }
  )
);

