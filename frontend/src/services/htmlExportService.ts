import type { Dashboard } from '../types/dashboard';
import type { DataSource } from '../types/dataSource';
import { formatDateAr } from './dateUtils';

/**
 * Generates a self-contained, standalone interactive HTML document
 * that can be opened in any browser offline with full interactions
 * (hover tooltips, button clicks, slicers, cross-filtering, and modal zoom).
 *
 * @param widgetFilters  Per-widget drill-down filters from DashboardStore
 * @param activeFilters  Global slicer filters from DashboardStore
 */
/**
 * Helper to safely extract all raw rows regardless of source structure (flat, multi-sheet, or multi-table)
 */
export function extractAllRows(dataSource?: DataSource): Record<string, any>[] {
  if (!dataSource) return [];
  if (Array.isArray(dataSource.rawRows) && dataSource.rawRows.length > 0) {
    return dataSource.rawRows;
  }
  if (Array.isArray(dataSource.sheets) && dataSource.sheets.length > 0) {
    const active = dataSource.sheets.find(s => s.id === dataSource.activeSheetId) || dataSource.sheets[0];
    if (Array.isArray(active.rawRows) && active.rawRows.length > 0) {
      return active.rawRows;
    }
  }
  const dsAny = dataSource as any;
  if (dsAny?.multiModel?.tables && Array.isArray(dsAny.multiModel.tables)) {
    for (const t of dsAny.multiModel.tables) {
      const rows = t.rawRows || t.rows;
      if (Array.isArray(rows) && rows.length > 0) {
        return rows;
      }
    }
  }
  return [];
}

/**
 * Helper to extract or infer column definitions
 */
export function extractAllColumns(dataSource?: DataSource, rows?: Record<string, any>[]): any[] {
  if (dataSource && Array.isArray(dataSource.columns) && dataSource.columns.length > 0) {
    return dataSource.columns;
  }
  if (dataSource && Array.isArray(dataSource.sheets) && dataSource.sheets.length > 0) {
    const active = dataSource.sheets.find(s => s.id === dataSource.activeSheetId) || dataSource.sheets[0];
    if (Array.isArray(active.columns) && active.columns.length > 0) {
      return active.columns;
    }
  }
  if (rows && rows.length > 0) {
    return Object.keys(rows[0]).map((colName, idx) => ({
      id: `col_${idx}`,
      columnName: colName,
      dataType: typeof rows[0][colName] === 'number' ? 'numeric' : 'string',
      sampleValues: rows.slice(0, 3).map(r => String(r[colName] ?? ''))
    }));
  }
  return [];
}

/**
 * OWASP-compliant safe JSON stringifier for embedding inside HTML script tags.
 * Escapes <, >, &, line separators, and </script> to prevent injection or breaking script tags.
 */
function safeJsonStringify(obj: any): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/<\/script>/gi, '<\\/script>'); // Extra guard: prevent breaking <script> tags
}

/**
 * Generates a self-contained, standalone interactive HTML document
 * that can be opened in any browser offline with full interactions.
 * 100% of all data rows are embedded as self-contained JSON directly inside the page,
 * ensuring complete independence from any external server, database, or network connection.
 */
export function generateInteractiveHtml(
  dashboard: Dashboard,
  dataSource: DataSource,
  theme: 'dark' | 'light' = 'dark',
  widgetFilters?: Record<string, Record<string, any>>,
  activeFilters?: Record<string, any>,
  drillDownStates?: Record<string, { path: Array<{ column: string; value: string }>; levelIndex: number }>,
  motionTheme: string = 'wps-professional'
): string {
  const rawTitle = (dashboard.title || 'تقرير تحليلي تفاعلي').trim();
  const cleanTitle = rawTitle
    .replace(/^[)\]\s;'"`,.-]+/, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  const allRows = extractAllRows(dataSource);
  const allColumns = extractAllColumns(dataSource, allRows);
  const initialMotionTheme = motionTheme || dashboard.motionTheme || 'wps-professional';

  // Merge all widget drill-down filters + global slicer filters into one initial filter map
  const mergedInitialFilters: Record<string, any> = { ...(activeFilters || {}) };
  if (widgetFilters) {
    for (const wf of Object.values(widgetFilters)) {
      for (const [col, val] of Object.entries(wf || {})) {
        if (val !== undefined && val !== null && val !== '') {
          if (!mergedInitialFilters[col]) {
            mergedInitialFilters[col] = val;
          }
        }
      }
    }
  }

  // 📦 Full standalone dataset package serialized into the page
  const embeddedDataPackage = {
    format: 'lens-bi-standalone-dataset',
    version: '2026.2',
    exportedAt: new Date().toISOString(),
    reportTitle: dashboard.title || 'تقرير تحليلي تفاعلي',
    sourceFileName: dataSource.fileName || 'Embedded_Dataset.json',
    totalRows: allRows.length,
    totalColumns: allColumns.length,
    columns: allColumns,
    rows: allRows,
    sheets: (dataSource.sheets || []).map(s => ({
      id: s.id,
      name: s.name,
      rowCount: s.rowCount || s.rawRows?.length || 0,
      columns: s.columns || [],
      rawRows: s.rawRows || [],
      isPivot: s.isPivot,
      pivotDetection: s.pivotDetection
    })),
    activeSheetId: dataSource.activeSheetId,
    isPivot: dataSource.isPivot,
    pivotDetection: dataSource.pivotDetection,
    dashboard: dashboard,
    theme: theme,
    motionTheme: initialMotionTheme,
    drillDownStates: drillDownStates || {},
    initialFilters: mergedInitialFilters,
    offlineCapabilities: {
      selfContained: true,
      requiresExternalServer: false,
      crossFiltering: true,
      dynamicSlicers: true,
      exportJsonAvailable: true
    }
  };

  const embeddedPackageJsonSafe = safeJsonStringify(embeddedDataPackage);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${cleanTitle} - LENS BI Interactive</title>
  <!-- Google Fonts: Cairo -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <!-- Apache ECharts for interactive charts (primary CDN + fallback) -->
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
  <script>
    // Fallback: if primary CDN fails, dynamically inject cdnjs
    if (typeof echarts === 'undefined') {
      var fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js';
      document.head.appendChild(fallbackScript);
    }
  </script>
  <style>
    :root {
      --bg: ${theme === 'dark' ? '#020617' : '#f8fafc'};
      --surface: ${theme === 'dark' ? '#0f172a' : '#ffffff'};
      --surface-border: ${theme === 'dark' ? '#1e293b' : '#e2e8f0'};
      --surface-header: ${theme === 'dark' ? '#1e293b80' : '#f1f5f9'};
      --text: ${theme === 'dark' ? '#f8fafc' : '#0f172a'};
      --text-muted: ${theme === 'dark' ? '#94a3b8' : '#64748b'};
      --accent: #0ea5e9;
      --accent-hover: #38bdf8;
      --primary-glow: rgba(14, 165, 233, 0.15);
      --chrome-bar-1: ${theme === 'dark' ? '#0f172ae6' : '#ffffffe6'};
      --chrome-bar-2: ${theme === 'dark' ? '#090d16f2' : '#f8fafcf2'};
      --chrome-border: ${theme === 'dark' ? '#1e293b' : '#cbd5e1'};
      --chrome-text: ${theme === 'dark' ? '#f8fafc' : '#0f172a'};
      --chrome-text-muted: ${theme === 'dark' ? '#94a3b8' : '#475569'};
      --chrome-btn-bg: ${theme === 'dark' ? '#1e293b' : '#ffffff'};
      --chrome-btn-hover: ${theme === 'dark' ? '#334155' : '#f1f5f9'};
      --chrome-footer-bg: ${theme === 'dark' ? '#0f172a' : '#f1f5f9'};
      --card-bg: ${theme === 'dark' ? '#0f172a' : '#ffffff'};
      --card-border: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'};
      --card-shadow: ${theme === 'dark' ? '0 20px 45px -8px rgba(0, 0, 0, 0.65)' : '0 10px 25px -4px rgba(100, 116, 139, 0.10)'};
    }

    body.dark {
      --bg: #020617;
      --surface: #0f172a;
      --surface-border: #1e293b;
      --surface-header: #1e293b80;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --chrome-bar-1: #0f172ae6;
      --chrome-bar-2: #090d16f2;
      --chrome-border: #1e293b;
      --chrome-text: #f8fafc;
      --chrome-text-muted: #94a3b8;
      --chrome-btn-bg: #1e293b;
      --chrome-btn-hover: #334155;
      --chrome-footer-bg: #0f172a;
      --card-bg: #0f172a;
      --card-border: rgba(255, 255, 255, 0.12);
      --card-shadow: 0 20px 45px -8px rgba(0, 0, 0, 0.65);
    }

    body.light {
      --bg: #f1f5f9;
      --surface: #ffffff;
      --surface-border: #cbd5e1;
      --surface-header: #f8fafc;
      --text: #0f172a;
      --text-muted: #64748b;
      --chrome-bar-1: #ffffff;
      --chrome-bar-2: #ffffff;
      --chrome-border: #e2e8f0;
      --chrome-text: #0f172a;
      --chrome-text-muted: #64748b;
      --chrome-btn-bg: #f8fafc;
      --chrome-btn-hover: #f1f5f9;
      --chrome-footer-bg: #ffffff;
      --card-bg: #ffffff;
      --card-border: #cbd5e1;
      --card-shadow: 0 4px 16px -2px rgba(100, 116, 139, 0.12);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      position: relative;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background-image: linear-gradient(to right, rgba(30, 41, 59, 0.05) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(30, 41, 59, 0.05) 1px, transparent 1px);
      background-size: 24px 24px;
    }
    body.dark::before {
      background-image: linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    }
    /* ─── Dual-Tier Header (بارين علويين) ─── */
    .header-wrapper {
      position: sticky;
      top: 0;
      z-index: 50;
      width: 100%;
      border-bottom-left-radius: 18px;
      border-bottom-right-radius: 18px;
    }
    body.dark .header-wrapper {
      box-shadow:
        0 18px 40px -6px rgba(0, 0, 0, 0.70),
        0 8px 18px -3px rgba(0, 0, 0, 0.50),
        inset 0 3px 6px rgba(255, 255, 255, 0.18),
        inset 0 -4px 10px rgba(0, 0, 0, 0.55);
    }
    body.light .header-wrapper {
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }
    /* Bar 1: Branding, Report Title & Status Badges */
    .top-bar-1 {
      background-color: var(--chrome-bar-1);
      backdrop-filter: blur(14px);
      border-bottom: 1.5px solid var(--chrome-border);
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .logo-badge {
      width: 34px;
      height: 34px;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 900;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
      flex-shrink: 0;
    }
    .title-box {
      min-width: 0;
    }
    .title-box-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .title-box h1 {
      font-size: 15px;
      font-weight: 800;
      color: var(--chrome-text);
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 380px;
    }
    .title-box p {
      font-size: 11px;
      color: var(--chrome-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .platform-tag {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 6px;
      background-color: rgba(14, 165, 233, 0.12);
      color: #38bdf8;
      border: 1px solid rgba(14, 165, 233, 0.25);
      font-weight: 700;
    }
    .bar-1-status {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .badge {
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge-readonly {
      background-color: var(--chrome-btn-bg);
      color: var(--chrome-text-muted);
      border: 1px solid var(--chrome-border);
    }
    .badge-secure {
      background-color: rgba(16, 185, 129, 0.1);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    body.light .badge-secure {
      background-color: #ecfdf5;
      color: #047857;
      border-color: #a7f3d0;
    }
    body.light .badge-readonly {
      background-color: #f8fafc;
      color: #475569;
      border-color: #e2e8f0;
    }

    /* Drill Transition Pulse (حركة انتقال هرمية انسيابية ناعمة مريحة للعين) */
    @keyframes drillTransitionPulse {
      0% { transform: scale(0.992); opacity: 0.88; }
      100% { transform: scale(1); opacity: 1; }
    }
    .widget-drill-pulse {
      animation: drillTransitionPulse 0.42s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    /* Mobile title bar - shown only on mobile */
    .mobile-title-bar {
      display: none;
    }
    .desktop-only-flex {
      display: flex;
    }
    @media (max-width: 640px) {
      .mobile-title-bar {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 8px;
      }
      .desktop-only-flex {
        display: none !important;
      }
    }

    /* Bar 2: Filters & Actions Toolbar */
    .top-bar-2 {
      background-color: var(--chrome-bar-2);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--chrome-border);
      padding: 6px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 42px;
    }
    .filter-status-area {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex-wrap: wrap;
    }
    .filter-indicator-text {
      font-size: 11.5px;
      color: var(--chrome-text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: #10b981;
      display: inline-block;
      flex-shrink: 0;
    }
    .status-dot.active {
      background-color: #38bdf8;
      box-shadow: 0 0 8px #38bdf8;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .btn {
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      border: 1px solid transparent;
      outline: none;
      white-space: nowrap;
    }
    .btn-action {
      background-color: var(--chrome-btn-bg);
      color: var(--chrome-text);
      border-color: var(--chrome-border);
    }
    .btn-action:hover {
      background-color: var(--chrome-btn-hover);
    }
    .btn-filter-reset {
      background-color: rgba(14, 165, 233, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(14, 165, 233, 0.35);
      font-size: 11px;
      padding: 3px 10px;
    }
    .btn-filter-reset:hover {
      background-color: rgba(14, 165, 233, 0.25);
      color: #ffffff;
    }
    .bar-2-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    /* Mobile Responsive Header: Title takes the top bar alone on mobile */
    @media (max-width: 768px) {
      .top-bar-1 {
        padding: 10px 14px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        width: 100% !important;
      }
      .brand-section {
        width: 100% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
      }
      /* Hide platform logo, platform tag, subtitle, and badges on mobile top bar */
      .logo-badge,
      .platform-tag,
      .title-box p,
      .bar-1-status {
        display: none !important;
      }
      .title-box {
        width: 100% !important;
        text-align: center !important;
      }
      .title-box-row {
        justify-content: center !important;
        width: 100% !important;
      }
      .title-box h1 {
        font-size: 15px !important;
        font-weight: 800 !important;
        max-width: 100% !important;
        text-align: center !important;
        white-space: normal !important;
        line-height: 1.35 !important;
        margin: 0 !important;
      }
      .top-bar-2 {
        padding: 6px 12px !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
      }
      .filter-indicator-text {
        font-size: 10.5px;
      }
      .btn {
        padding: 4px 8px;
        font-size: 10.5px;
      }
      .desktop-only {
        display: none;
      }
      /* Mobile card single column flow */
      .grid {
        grid-template-columns: 1fr !important;
        gap: 12px !important;
      }
      .col-1, .col-2, .col-3, .col-4, .col-5, .col-6,
      .col-7, .col-8, .col-9, .col-10, .col-11, .col-12 {
        grid-column: span 1 !important;
      }
    }

    /* Grid Container */
    main {
      flex: 1;
      padding: 20px;
      max-width: 1680px;
      margin: 0 auto;
      width: 100%;
      position: relative;
      z-index: 1;
    }
    body.light main {
      background: #f1f5f9;
    }
    body.dark main {
      background: #020617;
    }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 16px;
    }
    /* Motion Theme Selector in Bar 2 */
    .motion-picker-area {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
    }
    .motion-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--chrome-text-muted);
      font-weight: 700;
      font-size: 11px;
    }
    .motion-select {
      background: var(--chrome-btn-bg);
      color: var(--chrome-text);
      border: 1px solid var(--chrome-border);
      border-radius: 8px;
      padding: 3px 10px;
      font-size: 11px;
      font-family: inherit;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
    }
    .motion-select:hover, .motion-select:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
    }

    /* ══════════════════════════════════════════════════════════════════════════
       🎨 Motion UI Design Styles & Entrance Animations (الأنماط الحركية العشرة)
       ══════════════════════════════════════════════════════════════════════════ */
    @keyframes cardEntrance {
      0% {
        opacity: 0;
        transform: translateY(22px) scale(0.97);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Widget Cards Base */
    .widget-card {
      background-color: var(--card-bg);
      border: 1.5px solid var(--card-border);
      border-radius: 24px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: var(--card-shadow);
      animation: cardEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
      transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.25s ease !important;
      position: relative;
    }
    .widget-card:hover {
      border-color: rgba(255, 255, 255, 0.25);
      transform: translateY(-5px) scale(1.008) !important;
    }

    /* ─── Dark Mode Motion Themes (الأنماط للثيم الداكن) ─── */
    body.dark .theme-skeuomorphism {
      background: linear-gradient(145deg, #1e293b, #0f172a) !important;
      border: 2px solid #334155 !important;
      border-top-color: #475569 !important;
      border-bottom-color: #020617 !important;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.75), inset 0 1px 2px rgba(255, 255, 255, 0.22), inset 0 -2px 4px rgba(0, 0, 0, 0.6) !important;
    }
    body.dark .theme-skeuomorphism:hover {
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.85), 0 0 28px rgba(217, 119, 6, 0.28), inset 0 1px 3px rgba(255, 255, 255, 0.28), inset 0 -3px 6px rgba(0, 0, 0, 0.7) !important;
      transform: translateY(-4px) !important;
    }

    body.dark .theme-neumorphism {
      background: #0f172a !important;
      border: 1px solid rgba(255, 255, 255, 0.05) !important;
      box-shadow: 10px 10px 22px #060b14, -10px -10px 22px #182542 !important;
    }
    body.dark .theme-neumorphism:hover {
      box-shadow: 14px 14px 30px #040810, -14px -14px 30px #1e3050, 0 0 20px rgba(96, 165, 250, 0.2) !important;
      transform: translateY(-4px) !important;
    }

    body.dark .theme-glassmorphism {
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      background: rgba(15, 23, 42, 0.65) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      box-shadow: 0 10px 35px rgba(0, 0, 0, 0.45) !important;
    }
    body.dark .theme-glassmorphism:hover {
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.25) !important;
      transform: translateY(-4px) !important;
    }

    body.dark .theme-claymorphism {
      background: #181b34 !important;
      border-radius: 26px !important;
      border: 2px solid rgba(167, 139, 250, 0.35) !important;
      box-shadow: 0 22px 48px -6px rgba(0, 0, 0, 0.65), 0 12px 24px -4px rgba(0, 0, 0, 0.50), inset 4px 4px 10px rgba(255, 255, 255, 0.22), inset -6px -6px 16px rgba(0, 0, 0, 0.55) !important;
    }
    body.dark .theme-claymorphism:hover {
      box-shadow: 0 32px 64px -8px rgba(0, 0, 0, 0.75), 0 18px 32px -4px rgba(0, 0, 0, 0.55), inset 4px 4px 12px rgba(255, 255, 255, 0.28), inset -8px -8px 20px rgba(0, 0, 0, 0.65) !important;
      transform: translateY(-6px) scale(1.008) !important;
    }

    body.dark .theme-minimalism {
      background: #080d1a !important;
      border: 1px solid #1e293b !important;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25) !important;
    }
    body.dark .theme-minimalism:hover {
      border-color: #38bdf8 !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(56, 189, 248, 0.18) !important;
      transform: translateY(-3px) !important;
    }

    body.dark .theme-maximalism {
      background: #0a0515 !important;
      border: 2px solid #ec4899 !important;
      box-shadow: 0 0 25px rgba(236, 72, 153, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.18) !important;
    }
    body.dark .theme-maximalism:hover {
      box-shadow: 0 0 45px rgba(236, 72, 153, 0.65), 0 0 25px rgba(0, 229, 255, 0.35), inset 0 0 25px rgba(6, 182, 212, 0.28) !important;
      transform: translateY(-4px) !important;
    }

    body.dark .theme-brutalism {
      background: #09090b !important;
      border: 3px solid #38bdf8 !important;
      border-radius: 6px !important;
      box-shadow: 6px 6px 0px #38bdf8 !important;
    }
    body.dark .theme-brutalism:hover {
      box-shadow: 10px 10px 0px #38bdf8, 4px 4px 0px #facc15 !important;
      transform: translate(-3px, -3px) !important;
    }

    body.dark .theme-liquid-glass {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.14), rgba(59, 130, 246, 0.08), rgba(15, 23, 42, 0.85)) !important;
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(56, 189, 248, 0.38) !important;
      box-shadow: 0 16px 40px rgba(6, 182, 212, 0.22) !important;
    }
    body.dark .theme-liquid-glass:hover {
      box-shadow: 0 24px 60px rgba(6, 182, 212, 0.38), 0 0 40px rgba(59, 130, 246, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
      transform: translateY(-4px) !important;
    }

    body.dark .theme-bento-grid {
      background: rgba(15, 23, 42, 0.9) !important;
      border: 1.5px solid rgba(71, 85, 105, 0.6) !important;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38) !important;
    }
    body.dark .theme-bento-grid:hover {
      border-color: rgba(2, 132, 199, 0.5) !important;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.55), 0 0 22px rgba(2, 132, 199, 0.22) !important;
      transform: translateY(-3px) !important;
    }

    body.dark .theme-spatial-ui {
      background: rgba(30, 27, 75, 0.38) !important;
      backdrop-filter: blur(36px);
      -webkit-backdrop-filter: blur(36px);
      border: 1.5px solid rgba(167, 139, 250, 0.35) !important;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(129, 140, 248, 0.28) !important;
    }
    body.dark .theme-spatial-ui:hover {
      box-shadow: 0 35px 80px -15px rgba(0, 0, 0, 0.9), 0 0 50px rgba(129, 140, 248, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
      transform: translateY(-5px) !important;
    }

    body.dark .theme-cyber-neon {
      background: #050a14 !important;
      border: 1.5px solid #00f3ff !important;
      box-shadow: 0 0 20px rgba(0, 243, 255, 0.25) !important;
    }
    body.dark .theme-cyber-neon:hover {
      box-shadow: 0 0 40px rgba(0, 243, 255, 0.45), 0 0 20px rgba(255, 0, 127, 0.25) !important;
      transform: translateY(-3px) !important;
    }

    body.dark .theme-glass-capsule {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      background: rgba(15, 23, 42, 0.72) !important;
      border: 1.5px solid rgba(129, 140, 248, 0.3) !important;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4) !important;
    }
    body.dark .theme-glass-capsule:hover {
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), 0 0 28px rgba(129, 140, 248, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
      transform: translateY(-3px) !important;
    }

    body.dark .theme-wps-professional {
      background: #0f172a !important;
      border: 1.5px solid rgba(20, 184, 166, 0.35) !important;
      border-radius: 24px !important;
      box-shadow: 0 20px 45px -8px rgba(0, 0, 0, 0.65), 0 12px 24px -4px rgba(0, 0, 0, 0.50), inset 3px 3px 8px rgba(255, 255, 255, 0.16), inset -5px -5px 12px rgba(0, 0, 0, 0.45) !important;
    }
    body.dark .theme-wps-professional:hover {
      border-color: rgba(20, 184, 166, 0.6) !important;
      box-shadow: 0 30px 60px -8px rgba(0, 0, 0, 0.75), 0 16px 30px -4px rgba(0, 0, 0, 0.52), inset 3px 3px 10px rgba(255, 255, 255, 0.22), inset -6px -6px 15px rgba(0, 0, 0, 0.55) !important;
      transform: translateY(-5px) scale(1.008) !important;
    }

    /* ─── Light Mode Motion Themes (الأنماط للثيم الأبيض الهادئ والمريح للعينين 100% طبق الأصل) ─── */
    body.light .theme-skeuomorphism {
      background: linear-gradient(165deg, #ffffff 0%, #f8fafc 45%, #eef2f6 100%) !important;
      border: 2px solid #cbd5e1 !important;
      border-top-color: #ffffff !important;
      border-left-color: #e2e8f0 !important;
      border-right-color: #cbd5e1 !important;
      border-bottom-color: #94a3b8 !important;
      border-radius: 20px !important;
      box-shadow: 0 10px 24px -4px rgba(100, 116, 139, 0.18), 0 3px 6px -1px rgba(100, 116, 139, 0.10), inset 0 2px 2px #ffffff, inset 0 -2px 3px rgba(148, 163, 184, 0.25) !important;
      color: #1e293b !important;
    }
    body.light .theme-skeuomorphism:hover {
      box-shadow: 0 16px 32px -4px rgba(100, 116, 139, 0.24), 0 0 20px rgba(217, 119, 6, 0.18), inset 0 2px 3px #ffffff, inset 0 -3px 4px rgba(148, 163, 184, 0.35) !important;
      transform: translateY(-3px) !important;
    }
    body.light .theme-skeuomorphism > .widget-header {
      background: linear-gradient(180deg, #ffffff, #f1f5f9) !important;
      border-bottom: 1.5px solid #cbd5e1 !important;
      color: #0f172a !important;
    }
    body.light .theme-skeuomorphism .widget-title {
      color: #0f172a !important;
    }

    body.light .theme-neumorphism {
      background: #f8fafc !important;
      border: 1px solid rgba(255, 255, 255, 0.85) !important;
      border-radius: 26px !important;
      box-shadow: 9px 9px 20px rgba(166, 180, 200, 0.35), -9px -9px 20px rgba(255, 255, 255, 0.95) !important;
      color: #1e293b !important;
    }
    body.light .theme-neumorphism:hover {
      box-shadow: 13px 13px 26px rgba(166, 180, 200, 0.42), -11px -11px 24px #ffffff, 0 0 16px rgba(96, 165, 250, 0.15) !important;
      transform: translateY(-3px) !important;
    }
    body.light .theme-neumorphism > .widget-header {
      background: #f8fafc !important;
      border-bottom: 1.5px solid rgba(226, 232, 240, 0.7) !important;
      color: #0f172a !important;
    }
    body.light .theme-neumorphism .widget-title {
      color: #0f172a !important;
    }

    body.light .theme-glassmorphism {
      background: rgba(255, 255, 255, 0.75) !important;
      backdrop-filter: blur(24px) saturate(160%) !important;
      -webkit-backdrop-filter: blur(24px) saturate(160%) !important;
      border: 1.5px solid rgba(255, 255, 255, 0.9) !important;
      border-radius: 22px !important;
      box-shadow: 0 12px 30px -4px rgba(100, 116, 139, 0.12), 0 4px 10px -2px rgba(100, 116, 139, 0.06), inset 0 1px 2px rgba(255, 255, 255, 0.95), 0 0 20px rgba(56, 189, 248, 0.08) !important;
      color: #1e293b !important;
    }
    body.light .theme-glassmorphism:hover {
      box-shadow: 0 18px 40px -4px rgba(100, 116, 139, 0.18), 0 0 28px rgba(56, 189, 248, 0.16) !important;
      transform: translateY(-3px) !important;
    }
    body.light .theme-glassmorphism > .widget-header {
      background: rgba(255, 255, 255, 0.55) !important;
      border-bottom: 1.5px solid rgba(226, 232, 240, 0.8) !important;
      color: #0f172a !important;
    }
    body.light .theme-glassmorphism .widget-title {
      color: #0f172a !important;
    }

    body.light .theme-claymorphism {
      background: #ffffff !important;
      border-radius: 28px !important;
      border: 2.5px solid rgba(196, 181, 253, 0.45) !important;
      box-shadow: 0 16px 32px -4px rgba(168, 85, 247, 0.12), 0 6px 14px -2px rgba(100, 116, 139, 0.08), inset 4px 4px 10px rgba(255, 255, 255, 0.95), inset -5px -5px 14px rgba(196, 181, 253, 0.25) !important;
      color: #1e293b !important;
    }
    body.light .theme-claymorphism:hover {
      box-shadow: 0 24px 48px -6px rgba(168, 85, 247, 0.20), 0 0 25px rgba(236, 72, 153, 0.22), inset 4px 4px 12px rgba(255, 255, 255, 1), inset -7px -7px 18px rgba(196, 181, 253, 0.35) !important;
      transform: translateY(-5px) scale(1.008) !important;
    }
    body.light .theme-claymorphism > .widget-header {
      background: rgba(250, 245, 255, 0.85) !important;
      border-bottom: 1.5px solid rgba(233, 213, 255, 0.7) !important;
      color: #7c3aed !important;
    }
    body.light .theme-claymorphism .widget-title {
      color: #7c3aed !important;
    }

    body.light .theme-minimalism {
      background: #ffffff !important;
      border: 1.5px solid #e2e8f0 !important;
      border-radius: 16px !important;
      box-shadow: 0 2px 6px -1px rgba(100, 116, 139, 0.06), 0 1px 3px rgba(100, 116, 139, 0.04) !important;
      color: #0f172a !important;
    }
    body.light .theme-minimalism:hover {
      border-color: #0284c7 !important;
      box-shadow: 0 8px 20px -3px rgba(2, 132, 199, 0.12), 0 2px 6px rgba(100, 116, 139, 0.05) !important;
      transform: translateY(-2px) !important;
    }
    body.light .theme-minimalism > .widget-header {
      background: #ffffff !important;
      border-bottom: 1.5px solid #f1f5f9 !important;
      color: #0f172a !important;
    }
    body.light .theme-minimalism .widget-title {
      color: #0f172a !important;
    }

    body.light .theme-maximalism {
      background: linear-gradient(145deg, #ffffff 0%, #fff1f2 60%, #fdf2f8 100%) !important;
      border: 2.5px solid #ec4899 !important;
      border-radius: 22px !important;
      box-shadow: 0 10px 28px -2px rgba(236, 72, 153, 0.18), 0 4px 12px rgba(6, 182, 212, 0.12), inset 0 0 12px rgba(236, 72, 153, 0.05) !important;
      color: #1e293b !important;
    }
    body.light .theme-maximalism:hover {
      box-shadow: 0 18px 40px -4px rgba(236, 72, 153, 0.30), 0 0 25px rgba(6, 182, 212, 0.22), inset 0 0 18px rgba(236, 72, 153, 0.10) !important;
      transform: translateY(-3px) !important;
    }
    body.light .theme-maximalism > .widget-header {
      background: linear-gradient(90deg, rgba(254, 226, 226, 0.7), rgba(252, 231, 243, 0.7)) !important;
      border-bottom: 2px solid rgba(236, 72, 153, 0.35) !important;
      color: #be185d !important;
    }
    body.light .theme-maximalism .widget-title {
      color: #be185d !important;
    }

    body.light .theme-brutalism {
      background: #ffffff !important;
      border: 3px solid #0f172a !important;
      border-radius: 4px !important;
      box-shadow: 5px 5px 0px #0ea5e9, 2px 2px 0px #0f172a !important;
      color: #0f172a !important;
    }
    body.light .theme-brutalism:hover {
      box-shadow: 8px 8px 0px #0ea5e9, 4px 4px 0px #facc15 !important;
      transform: translate(-3px, -3px) !important;
    }
    body.light .theme-brutalism > .widget-header {
      background: #f8fafc !important;
      border-bottom: 3px solid #0f172a !important;
      border-radius: 0 !important;
      color: #0f172a !important;
    }
    body.light .theme-brutalism .widget-title {
      color: #0f172a !important;
      font-weight: 900 !important;
    }

    body.light .theme-liquid-glass {
      background: linear-gradient(135deg, rgba(240, 249, 255, 0.85) 0%, rgba(236, 254, 255, 0.75) 50%, rgba(245, 243, 255, 0.80) 100%) !important;
      backdrop-filter: blur(26px) saturate(170%) !important;
      -webkit-backdrop-filter: blur(26px) saturate(170%) !important;
      border: 1.5px solid rgba(56, 189, 248, 0.45) !important;
      border-radius: 22px !important;
      box-shadow: 0 12px 32px -4px rgba(6, 182, 212, 0.15), 0 4px 10px rgba(59, 130, 246, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.95) !important;
      color: #1e293b !important;
    }
    body.light .theme-liquid-glass:hover {
      box-shadow: 0 20px 48px -6px rgba(6, 182, 212, 0.28), 0 0 30px rgba(59, 130, 246, 0.18), inset 0 1px 2px rgba(255, 255, 255, 1) !important;
      transform: translateY(-3px) !important;
    }
    body.light .theme-liquid-glass > .widget-header {
      background: rgba(224, 242, 254, 0.55) !important;
      border-bottom: 1.5px solid rgba(56, 189, 248, 0.35) !important;
      color: #0369a1 !important;
    }
    body.light .theme-liquid-glass .widget-title {
      color: #0369a1 !important;
    }

    body.light .theme-bento-grid {
      background: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      border-radius: 24px !important;
      box-shadow: 0 6px 20px -3px rgba(100, 116, 139, 0.08), 0 2px 6px -1px rgba(100, 116, 139, 0.04) !important;
      color: #1e293b !important;
    }
    body.light .theme-bento-grid:hover {
      border-color: #0284c7 !important;
      box-shadow: 0 14px 30px -4px rgba(2, 132, 199, 0.16), 0 0 16px rgba(2, 132, 199, 0.12) !important;
      transform: translateY(-2px) !important;
    }
    body.light .theme-bento-grid > .widget-header {
      background: #f8fafc !important;
      border-bottom: 1.5px solid #e2e8f0 !important;
      color: #0f172a !important;
    }
    body.light .theme-bento-grid .widget-title {
      color: #0f172a !important;
    }

    body.light .theme-spatial-ui {
      background: rgba(255, 255, 255, 0.80) !important;
      backdrop-filter: blur(36px) !important;
      -webkit-backdrop-filter: blur(36px) !important;
      border: 1.5px solid rgba(167, 139, 250, 0.40) !important;
      border-radius: 28px !important;
      box-shadow: 0 20px 45px -10px rgba(129, 140, 248, 0.16), 0 8px 18px -4px rgba(100, 116, 139, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.95) !important;
      color: #1e293b !important;
    }
    body.light .theme-spatial-ui:hover {
      box-shadow: 0 28px 60px -10px rgba(129, 140, 248, 0.28), 0 0 35px rgba(129, 140, 248, 0.25), inset 0 1px 2px rgba(255, 255, 255, 1) !important;
      transform: translateY(-4px) !important;
    }
    body.light .theme-spatial-ui > .widget-header {
      background: rgba(238, 242, 255, 0.65) !important;
      border-bottom: 1.5px solid rgba(199, 210, 254, 0.6) !important;
      color: #4338ca !important;
    }
    body.light .theme-spatial-ui .widget-title {
      color: #4338ca !important;
    }

    body.light .theme-wps-professional {
      background: #ffffff !important;
      border: 1.5px solid rgba(13, 148, 136, 0.28) !important;
      border-radius: 20px !important;
      box-shadow: 0 8px 24px -4px rgba(13, 148, 136, 0.12), 0 2px 6px rgba(100, 116, 139, 0.06), inset 0 1px 2px #ffffff !important;
      color: #1e293b !important;
    }
    body.light .theme-wps-professional:hover {
      border-color: rgba(13, 148, 136, 0.55) !important;
      box-shadow: 0 16px 36px -4px rgba(13, 148, 136, 0.22), 0 0 20px rgba(20, 184, 166, 0.16) !important;
      transform: translateY(-3px) !important;
    }
    body.light .theme-wps-professional > .widget-header {
      background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%) !important;
      border-bottom: 1.5px solid rgba(20, 184, 166, 0.35) !important;
      color: #0f766e !important;
    }
    body.light .theme-wps-professional .widget-title {
      color: #0f766e !important;
    }

    body.light .theme-cyber-neon {
      background: #ffffff !important;
      border: 2px solid #06b6d4 !important;
      border-radius: 18px !important;
      box-shadow: 0 0 20px rgba(6, 182, 212, 0.18), 0 4px 12px rgba(236, 72, 153, 0.10) !important;
      color: #0f172a !important;
    }
    body.light .theme-cyber-neon:hover {
      box-shadow: 0 0 30px rgba(6, 182, 212, 0.32), 0 0 16px rgba(236, 72, 153, 0.18) !important;
      transform: translateY(-2px) !important;
    }
    body.light .theme-cyber-neon > .widget-header {
      background: #f0fdfa !important;
      border-bottom: 1.5px solid #06b6d4 !important;
      color: #0f766e !important;
    }
    body.light .theme-cyber-neon .widget-title {
      color: #0f766e !important;
    }

    body.light .theme-glass-capsule {
      background: rgba(255, 255, 255, 0.75) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      border: 1.5px solid rgba(255, 255, 255, 0.9) !important;
      border-radius: 24px !important;
      box-shadow: 0 10px 25px rgba(100, 116, 139, 0.12) !important;
      color: #1e293b !important;
    }
    body.light .theme-glass-capsule:hover {
      box-shadow: 0 18px 42px rgba(148, 163, 184, 0.3), 0 0 22px rgba(99, 102, 241, 0.2) !important;
      transform: translateY(-2px) !important;
    }
    body.light .theme-glass-capsule > .widget-header {
      background: rgba(238, 242, 255, 0.65) !important;
      border-bottom: 1.5px solid rgba(99, 102, 241, 0.3) !important;
      color: #4338ca !important;
    }
    body.light .theme-glass-capsule .widget-title {
      color: #4338ca !important;
    }

    body.light .theme-minimal-luxury {
      background: linear-gradient(165deg, #ffffff 0%, #fffdfa 50%, #fefce8 100%) !important;
      border: 1.5px solid rgba(217, 119, 6, 0.35) !important;
      border-radius: 20px !important;
      box-shadow: 0 10px 28px -4px rgba(217, 119, 6, 0.12), inset 0 1px 2px #ffffff !important;
      color: #1e293b !important;
    }
    body.light .theme-minimal-luxury:hover {
      box-shadow: 0 16px 36px -4px rgba(217, 119, 6, 0.20), 0 0 20px rgba(212, 175, 55, 0.25) !important;
      transform: translateY(-2px) !important;
    }
    body.light .theme-minimal-luxury > .widget-header {
      background: linear-gradient(135deg, #fffdfa 0%, #fefce8 100%) !important;
      border-bottom: 1.5px solid rgba(217, 119, 6, 0.3) !important;
      color: #b45309 !important;
    }
    body.light .theme-minimal-luxury .widget-title {
      color: #b45309 !important;
    }

    body.light .theme-liquid-floating {
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.88), rgba(240, 249, 255, 0.78)) !important;
      border: 1.5px solid rgba(6, 182, 212, 0.3) !important;
      border-radius: 20px !important;
      box-shadow: 0 12px 30px rgba(6, 182, 212, 0.12) !important;
      color: #1e293b !important;
    }
    body.light .theme-liquid-floating:hover {
      box-shadow: 0 20px 45px rgba(6, 182, 212, 0.25), 0 0 25px rgba(59, 130, 246, 0.18) !important;
      transform: translateY(-3px) !important;
    }
    body.light .theme-liquid-floating > .widget-header {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(240, 249, 255, 0.8)) !important;
      border-bottom: 1.5px solid rgba(6, 182, 212, 0.3) !important;
      color: #0891b2 !important;
    }
    body.light .theme-liquid-floating .widget-title {
      color: #0891b2 !important;
    }

    body.light .theme-orbit-cosmic {
      background: rgba(255, 255, 255, 0.85) !important;
      border: 1.5px solid rgba(139, 92, 246, 0.35) !important;
      border-radius: 22px !important;
      box-shadow: 0 12px 32px -4px rgba(139, 92, 246, 0.14) !important;
      color: #1e293b !important;
    }
    body.light .theme-orbit-cosmic:hover {
      box-shadow: 0 18px 40px -4px rgba(139, 92, 246, 0.25), 0 0 25px rgba(139, 92, 246, 0.2) !important;
      transform: translateY(-3px) !important;
    }
    body.light .theme-orbit-cosmic > .widget-header {
      background: rgba(245, 243, 255, 0.85) !important;
      border-bottom: 1.5px solid rgba(139, 92, 246, 0.35) !important;
      color: #7c3aed !important;
    }
    body.light .theme-orbit-cosmic .widget-title {
      color: #7c3aed !important;
    }

    /* ─── Dark Mode Motion Theme Headers & Titles (للوضع الداكن) ─── */
    body.dark .theme-wps-professional > .widget-header {
      background: linear-gradient(135deg, rgba(13, 79, 71, 0.7) 0%, rgba(15, 107, 97, 0.5) 50%, rgba(13, 148, 136, 0.3) 100%) !important;
      border-bottom: 1.5px solid rgba(20, 184, 166, 0.45) !important;
      color: #5eead4 !important;
    }
    body.dark .theme-wps-professional .widget-title { color: #5eead4 !important; }

    body.dark .theme-skeuomorphism > .widget-header {
      background: linear-gradient(180deg, rgba(51,65,85,0.7), rgba(15,23,42,0.85)) !important;
      border-bottom: 1.5px solid rgba(71,85,105,0.6) !important;
      color: #e2e8f0 !important;
    }
    body.dark .theme-skeuomorphism .widget-title { color: #e2e8f0 !important; }

    body.dark .theme-neumorphism > .widget-header {
      background: rgba(15, 23, 42, 0.9) !important;
      border-bottom: 1px solid rgba(30, 41, 59, 0.8) !important;
      color: #93c5fd !important;
    }
    body.dark .theme-neumorphism .widget-title { color: #93c5fd !important; }

    body.dark .theme-glassmorphism > .widget-header {
      background: rgba(255, 255, 255, 0.08) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
      color: #e2e8f0 !important;
    }
    body.dark .theme-glassmorphism .widget-title { color: #e2e8f0 !important; }

    body.dark .theme-claymorphism > .widget-header {
      background: rgba(139, 92, 246, 0.16) !important;
      border-bottom: 1px solid rgba(139, 92, 246, 0.3) !important;
      color: #d8b4fe !important;
    }
    body.dark .theme-claymorphism .widget-title { color: #d8b4fe !important; }

    body.dark .theme-minimalism > .widget-header {
      background: rgba(15, 23, 42, 0.6) !important;
      border-bottom: 1px solid rgba(51, 65, 85, 0.4) !important;
      color: #cbd5e1 !important;
    }
    body.dark .theme-minimalism .widget-title { color: #cbd5e1 !important; }

    body.dark .theme-maximalism > .widget-header {
      background: rgba(236, 72, 153, 0.15) !important;
      border-bottom: 2px solid rgba(236, 72, 153, 0.4) !important;
      color: #ff007f !important;
    }
    body.dark .theme-maximalism .widget-title { color: #ff007f !important; }

    body.dark .theme-brutalism > .widget-header {
      background: rgba(250, 204, 21, 0.2) !important;
      border-bottom: 3px solid #38bdf8 !important;
      color: #facc15 !important;
    }
    body.dark .theme-brutalism .widget-title { color: #facc15 !important; }

    body.dark .theme-liquid-glass > .widget-header {
      background: rgba(6, 182, 212, 0.12) !important;
      border-bottom: 1px solid rgba(6, 182, 212, 0.28) !important;
      color: #38bdf8 !important;
    }
    body.dark .theme-liquid-glass .widget-title { color: #38bdf8 !important; }

    body.dark .theme-bento-grid > .widget-header {
      background: rgba(30, 41, 59, 0.7) !important;
      border-bottom: 1px solid rgba(71, 85, 105, 0.5) !important;
      color: #e2e8f0 !important;
    }
    body.dark .theme-bento-grid .widget-title { color: #e2e8f0 !important; }

    body.dark .theme-spatial-ui > .widget-header {
      background: rgba(129, 140, 248, 0.14) !important;
      border-bottom: 1px solid rgba(167, 139, 250, 0.3) !important;
      color: #c7d2fe !important;
    }
    body.dark .theme-spatial-ui .widget-title { color: #c7d2fe !important; }

    body.dark .theme-cyber-neon > .widget-header {
      background: rgba(0, 243, 255, 0.1) !important;
      border-bottom: 1.5px solid rgba(0, 243, 255, 0.35) !important;
      color: #00f3ff !important;
    }
    body.dark .theme-cyber-neon .widget-title { color: #00f3ff !important; }

    body.dark .theme-glass-capsule > .widget-header {
      background: rgba(255, 255, 255, 0.06) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
      color: #e2e8f0 !important;
    }
    body.dark .theme-glass-capsule .widget-title { color: #e2e8f0 !important; }

    .widget-header {
      padding: 11px 16px;
      border-bottom: 1.5px solid var(--surface-border);
      background-color: var(--surface-header);
      border-top-left-radius: 22px;
      border-top-right-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .widget-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 7px;
    }
    body.dark .widget-title {
      text-shadow: 0 1px 3px rgba(0,0,0,0.6);
    }
    body.light .widget-title {
      text-shadow: none !important;
    }
    .widget-body {
      flex: 1;
      padding: 14px;
      position: relative;
      min-height: 220px;
    }
    /* Col Spans */
    .col-3  { grid-column: span 3; }
    .col-4  { grid-column: span 4; }
    .col-6  { grid-column: span 6; }
    .col-8  { grid-column: span 8; }
    .col-12 { grid-column: span 12; }
    @media (max-width: 1024px) {
      .col-3, .col-4 { grid-column: span 6; }
      .col-8 { grid-column: span 12; }
    }
    @media (max-width: 640px) {
      main { padding: 12px 8px; }
      .grid { gap: 10px; }
      .col-3, .col-4, .col-6, .col-8, .col-12 { grid-column: span 12; }
      .widget-body { padding: 10px; }
    }
    /* KPI Card Style */
    .kpi-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%;
      min-height: 100px;
    }
    .kpi-value {
      font-size: 28px;
      font-weight: 900;
      color: var(--text);
      letter-spacing: -0.5px;
    }
    .kpi-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
    }
    .kpi-delta {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
      background-color: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }
    .kpi-count {
      font-size: 11px;
      color: var(--text-muted);
    }
    /* Slicer Widget */
    .slicer-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .slicer-tab {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 6px;
      border: 1px solid var(--surface-border);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      font-weight: 600;
      transition: all 0.15s;
    }
    .slicer-tab.active {
      background: #0ea5e9;
      color: white;
      border-color: #0ea5e9;
    }
    .slicer-options {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 140px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .slicer-item {
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 8px;
      border: 1px solid var(--surface-border);
      background-color: #02061760;
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s;
    }
    .slicer-item:hover {
      border-color: #0ea5e9;
      color: #38bdf8;
    }
    .slicer-item.active {
      background-color: #0ea5e9;
      color: white;
      border-color: #0ea5e9;
    }
    /* ─── Table Widget: Responsive Fluid Typography specifically for tables ─── */
    .table-container {
      max-height: 340px;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 8px;
    }
    .table-container table {
      width: 100%;
      border-collapse: collapse;
      text-align: right;
      /* Dynamic fluid font size: automatically scales between 9px and 12.5px depending on viewport */
      font-size: clamp(9px, 2.4vw, 12.5px);
      line-height: 1.35;
    }
    .table-container th {
      background-color: var(--surface-header);
      /* Fluid padding: scales between 5px and 10px */
      padding: clamp(5px, 1.4vw, 9px) clamp(6px, 1.8vw, 12px);
      color: var(--text-muted);
      font-weight: 700;
      border-bottom: 1px solid var(--surface-border);
      position: sticky;
      top: 0;
      z-index: 2;
      white-space: nowrap;
      font-size: inherit; /* Scales dynamically with table font-size */
      letter-spacing: -0.2px;
    }
    .table-container td {
      /* Fluid padding for data cells */
      padding: clamp(4px, 1.2vw, 8px) clamp(6px, 1.8vw, 12px);
      border-bottom: 1px solid var(--surface-border);
      color: var(--text);
      font-size: inherit; /* Scales dynamically with table font-size */
      white-space: nowrap;
      text-overflow: ellipsis;
      max-width: 160px;
      overflow: hidden;
    }
    .table-container td.num-cell {
      font-family: monospace;
      font-weight: 600;
      text-align: left;
    }
    .table-container tr:hover td {
      background-color: var(--surface-header);
    }

    /* Targeted mobile responsive scaling: specifically for tables on small phone screens */
    @media (max-width: 640px) {
      .table-container table {
        font-size: clamp(8px, 2.7vw, 11px);
      }
      .table-container th {
        padding: 5px 6px;
        font-size: inherit;
      }
      .table-container td {
        padding: 4px 6px;
        font-size: inherit;
        max-width: 110px;
      }
    }
    @media (max-width: 380px) {
      .table-container table {
        font-size: clamp(7.5px, 2.5vw, 10px);
      }
      .table-container th, .table-container td {
        padding: 3px 4px;
      }
    }
    /* Hierarchical Drill-Down Breadcrumbs (شريط المسار الهرمي والتفرع) */
    .drill-breadcrumb {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(15, 23, 42, 0.8);
      border-bottom: 1px solid rgba(56, 189, 248, 0.2);
      font-size: 11px;
      color: var(--text-muted);
      overflow-x: auto;
      white-space: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      user-select: none;
    }
    .drill-breadcrumb::-webkit-scrollbar {
      height: 3px;
    }
    .drill-breadcrumb::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 4px;
    }
    .drill-crumbs-list {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }
    .drill-title-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #38bdf8;
      font-weight: 700;
      font-size: 10.5px;
      border-left: 1px solid #334155;
      padding-left: 8px;
      flex-shrink: 0;
    }
    .drill-btn-root {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2.5px 9px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 10px;
      cursor: pointer;
      border: 1px solid #334155;
      background: #1e293b80;
      color: var(--text);
      transition: all 0.15s ease;
      flex-shrink: 0;
    }
    .drill-btn-root:hover, .drill-btn-root.active {
      background: rgba(56, 189, 248, 0.18);
      color: #38bdf8;
      border-color: rgba(56, 189, 248, 0.4);
    }
    .drill-step-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2.5px 9px;
      border-radius: 9999px;
      font-size: 10px;
      background: ${theme === 'dark' ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe'};
      color: ${theme === 'dark' ? '#bae6fd' : '#0284c7'};
      border: 1px solid rgba(56, 189, 248, 0.4);
      font-weight: 600;
      flex-shrink: 0;
    }
    .drill-step-pill .col-label {
      color: var(--text-muted);
      font-weight: 400;
    }
    .drill-active-col-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2.5px 9px;
      border-radius: 9999px;
      font-size: 10px;
      background: #1e293b;
      color: #fcd34d;
      border: 1px solid var(--surface-border);
      font-weight: 600;
      flex-shrink: 0;
    }
    .drill-chevron {
      color: #64748b;
      font-size: 11px;
      flex-shrink: 0;
    }
    .drill-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .drill-level-badge {
      font-size: 9.5px;
      padding: 2px 7px;
      border-radius: 6px;
      background: #1e293b;
      color: var(--text-muted);
      border: 1px solid var(--surface-border);
      font-family: monospace;
      font-weight: 600;
      flex-shrink: 0;
    }
    .drill-btn-back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 9px;
      border-radius: 6px;
      background: #1e293b;
      border: 1px solid #475569;
      color: var(--text);
      font-size: 10.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }
    .drill-btn-back:hover {
      background: #0284c7;
      color: #ffffff;
      border-color: #38bdf8;
    }
    .drill-card-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9.5px;
      padding: 2px 7px;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: #38bdf8;
      font-weight: 600;
    }

    /* Mobile Responsive optimizations for Drill-down Breadcrumb */
    @media (max-width: 768px) {
      .drill-breadcrumb {
        padding: 4px 8px;
        gap: 6px;
      }
      .drill-title-tag {
        display: none;
      }
      .drill-btn-back {
        padding: 4px 10px;
        font-size: 11px;
      }
      .drill-crumbs-list {
        gap: 4px;
      }
    }

    /* Modal Fullscreen */
    #chart-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 100;
      padding: 24px;
      align-items: center;
      justify-content: center;
    }
    #chart-modal.open {
      display: flex;
    }
    .modal-content {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 20px;
      width: 90vw;
      height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--surface-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-body {
      flex: 1;
      padding: 20px;
    }
    .chart-container {
      width: 100%;
      height: 260px;
      min-height: 200px;
    }
    footer {
      border-top: 2px solid var(--chrome-border);
      border-top-left-radius: 18px;
      border-top-right-radius: 18px;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--chrome-text-muted);
      background: var(--chrome-footer-bg);
      box-shadow:
        0 -6px 20px -2px rgba(0, 0, 0, 0.12),
        inset 0 1px 3px rgba(255, 255, 255, 0.08);
    }

    /* ─── Table Widget: Pagination, Sorting & Live Search ─── */
    .table-widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .table-search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--surface-header);
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 3px 8px;
      color: var(--text-muted);
      max-width: 220px;
      flex: 1;
    }
    .table-search-input {
      background: transparent;
      border: none;
      outline: none;
      color: var(--text);
      font-size: 11px;
      font-family: inherit;
      width: 100%;
    }
    .table-search-input::placeholder {
      color: var(--text-muted);
      opacity: 0.7;
    }
    .th-content {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      user-select: none;
      transition: color 0.15s;
    }
    .th-content:hover {
      color: #38bdf8;
    }
    .sort-icon {
      font-size: 10px;
      opacity: 0.55;
    }
    .table-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 14px;
      border-top: 1px solid var(--surface-border);
      background-color: var(--surface-header);
      font-size: 11.5px;
      color: var(--text-muted);
      flex-wrap: wrap;
    }
    .pagination-info-side {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .pagination-count b {
      color: var(--text);
      font-weight: 700;
    }
    .pagination-size-selector {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
    }
    .page-size-select {
      background: var(--chrome-btn-bg);
      color: var(--text);
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 11px;
      font-family: inherit;
      cursor: pointer;
      outline: none;
    }
    .pagination-nav-side {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .pg-btn {
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid var(--surface-border);
      background: var(--chrome-btn-bg);
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
    }
    .pg-btn:hover:not(:disabled) {
      background: #0ea5e9;
      color: #ffffff;
      border-color: #0ea5e9;
    }
    .pg-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .pg-btn.active {
      background: #0ea5e9;
      color: #ffffff;
      border-color: #0ea5e9;
      font-weight: 800;
      box-shadow: 0 2px 6px rgba(14, 165, 233, 0.4);
    }
    .pg-dots {
      padding: 0 4px;
      color: var(--text-muted);
    }
    .pg-badge {
      font-size: 11px;
      color: var(--text-muted);
      padding: 2px 8px;
    }

    /* ─── PRINT RULES (الطباعة الورقية المنظمة بلاندسكيب وبدون أي قص للكروت وبدون بيانات المنصة) ─── */
    @page {
      size: landscape;
      margin: 10mm 12mm 10mm 12mm;
    }

    .print-paper-header,
    .print-paper-footer {
      display: none;
    }

    /* Contrast Contract: dark themes always use white text */
    body.dark [class*="bg-black"], body.dark [class*="bg-slate-950"], body.dark [class*="bg-slate-900"], body.dark [class*="bg-slate-800"],
    body.dark .theme-skeuomorphism, body.dark .theme-neumorphism, body.dark .theme-claymorphism, body.dark .theme-maximalism,
    body.dark .theme-brutalism, body.dark .theme-liquid-glass, body.dark .theme-bento-grid, body.dark .theme-spatial-ui,
    body.dark .theme-cyber-neon, body.dark .theme-glass-capsule, body.dark .theme-minimalism, body.dark .theme-wps-professional {
      color: #ffffff !important;
    }
    body.dark [class*="bg-black"] *, body.dark [class*="bg-slate-950"] *, body.dark [class*="bg-slate-900"] *, body.dark [class*="bg-slate-800"] *,
    body.dark .theme-skeuomorphism *, body.dark .theme-neumorphism *, body.dark .theme-claymorphism *, body.dark .theme-maximalism *,
    body.dark .theme-brutalism *, body.dark .theme-liquid-glass *, body.dark .theme-bento-grid *, body.dark .theme-spatial-ui *,
    body.dark .theme-cyber-neon *, body.dark .theme-glass-capsule *, body.dark .theme-minimalism *, body.dark .theme-wps-professional * {
      color: #ffffff !important;
    }
    /* Light theme: clean professional contrast matching Public View Mode */
    body.light .widget-card {
      color: var(--text);
    }
    body.light .kpi-value {
      color: #0f172a;
    }
    body.light .theme-wps-professional .kpi-value { color: #0f766e !important; }
    body.light .theme-claymorphism .kpi-value { color: #7c3aed !important; }
    body.light .theme-maximalism .kpi-value { color: #be185d !important; }
    body.light .theme-spatial-ui .kpi-value { color: #4338ca !important; }
    body.light .theme-liquid-glass .kpi-value { color: #0369a1 !important; }
    body.light .theme-cyber-neon .kpi-value { color: #0891b2 !important; }
    body.light .kpi-count { color: #64748b !important; }

    /* Light Mode: Slicer Component Styles */
    body.light .slicer-item {
      background-color: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      color: #334155 !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    body.light .slicer-item:hover {
      background-color: #f0f9ff !important;
      border-color: #38bdf8 !important;
      color: #0284c7 !important;
      transform: translateY(-1px);
    }
    body.light .slicer-item.active {
      background: linear-gradient(135deg, #0284c7, #0ea5e9) !important;
      color: #ffffff !important;
      border-color: #0284c7 !important;
      box-shadow: 0 3px 8px rgba(14, 165, 233, 0.35) !important;
    }
    body.light .slicer-tab {
      background-color: #f1f5f9 !important;
      border: 1px solid #cbd5e1 !important;
      color: #475569 !important;
    }
    body.light .slicer-tab:hover {
      background-color: #e2e8f0 !important;
      color: #0284c7 !important;
    }
    body.light .slicer-tab.active {
      background-color: #0284c7 !important;
      color: #ffffff !important;
      border-color: #0284c7 !important;
    }

    /* Light Mode: Table Widget Styles */
    body.light .table-container th {
      background-color: #f1f5f9 !important;
      color: #334155 !important;
      border-bottom: 1.5px solid #cbd5e1 !important;
    }
    body.light .table-container td {
      color: #1e293b !important;
      border-bottom: 1px solid #f1f5f9 !important;
    }
    body.light .table-container tr:hover td {
      background-color: rgba(14, 165, 233, 0.05) !important;
    }
    body.light .table-container td.num-cell {
      color: #0f766e !important;
    }
    body.light .table-search-box {
      background: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      color: #334155 !important;
    }
    body.light .table-search-input {
      color: #0f172a !important;
    }
    body.light .table-pagination {
      background-color: #f8fafc !important;
      border-top: 1px solid #e2e8f0 !important;
      color: #64748b !important;
    }
    body.light .pg-btn {
      background: #ffffff !important;
      border: 1px solid #cbd5e1 !important;
      color: #334155 !important;
    }
    body.light .pg-btn:hover:not(:disabled) {
      background: #0ea5e9 !important;
      color: #ffffff !important;
      border-color: #0ea5e9 !important;
    }
    body.light .page-size-select {
      background: #ffffff !important;
      border: 1px solid #cbd5e1 !important;
      color: #0f172a !important;
    }

    /* Light Mode: Hierarchical Breadcrumbs */
    body.light .drill-breadcrumb {
      background: #f8fafc !important;
      border-bottom: 1.5px solid #e2e8f0 !important;
      color: #64748b !important;
    }
    body.light .drill-title-tag {
      color: #0284c7 !important;
      border-left: 1px solid #cbd5e1 !important;
    }
    body.light .drill-btn-root {
      background: #ffffff !important;
      color: #334155 !important;
      border: 1px solid #cbd5e1 !important;
    }
    body.light .drill-btn-root:hover, body.light .drill-btn-root.active {
      background: #e0f2fe !important;
      color: #0284c7 !important;
      border-color: #7dd3fc !important;
    }
    body.light .drill-step-pill {
      background: #e0f2fe !important;
      color: #0369a1 !important;
      border: 1px solid #bae6fd !important;
    }
    body.light .drill-active-col-pill {
      background: #fef3c7 !important;
      color: #92400e !important;
      border: 1px solid #fde68a !important;
    }
    body.light .drill-level-badge {
      background: #ffffff !important;
      color: #475569 !important;
      border: 1px solid #cbd5e1 !important;
    }
    body.light .drill-btn-back {
      background: #ffffff !important;
      color: #334155 !important;
      border: 1px solid #cbd5e1 !important;
    }
    body.light .drill-btn-back:hover {
      background: #0284c7 !important;
      color: #ffffff !important;
      border-color: #0284c7 !important;
    }

    /* Light Mode: Pivot Table Rows */
    body.light .pivot-parent-row {
      background: #f8fafc !important;
      color: #0f172a !important;
    }
    body.light .pivot-parent-row:hover {
      background: #f1f5f9 !important;
    }
    body.light .pivot-sub-row {
      background: #ffffff !important;
      color: #334155 !important;
    }
    body.light .pivot-sub-row:hover {
      background: #f8fafc !important;
    }

    @media print {
      @page {
        size: landscape;
        margin: 10mm 12mm 10mm 12mm;
      }

      /* 1. Global Reset for Paper */
      html, body {
        background: #ffffff !important;
        color: #0f172a !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        font-family: 'Cairo', sans-serif !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* 2. HIDE ALL PLATFORM DATA & ONLINE CHROME (لا تظهر بيانات المنصة نهائياً) */
      .header-wrapper,
      .top-bar-1,
      .top-bar-2,
      .logo-badge,
      .platform-tag,
      .bar-1-status,
      .bar-2-actions,
      .filter-status-area,
      footer,
      #chart-modal,
      .btn,
      .drill-actions,
      .slicer-tabs,
      .drill-card-badge,
      .table-search-box,
      .table-pagination,
      .table-pagination-nav,
      .pagination-size-selector {
        display: none !important;
        visibility: hidden !important;
      }

      /* 3. SHOW CLEAN DEDICATED PAPER REPORT HEADER */
      .print-paper-header {
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 12px;
        margin-bottom: 16px;
        border-bottom: 2px solid #0f172a;
        width: 100%;
        page-break-after: avoid;
        break-after: avoid;
      }
      .print-title-area h1 {
        font-size: 18pt !important;
        font-weight: 900 !important;
        color: #0f172a !important;
        line-height: 1.2;
        margin: 0;
      }
      .print-title-area p {
        font-size: 9.5pt !important;
        color: #64748b !important;
        margin-top: 3px;
        font-weight: 600;
      }
      .print-meta-area {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        font-size: 9pt !important;
        color: #475569 !important;
      }
      .print-meta-area b {
        color: #0f172a !important;
      }

      /* 4. PAPER FOOTER */
      .print-paper-footer {
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        padding-top: 8px;
        margin-top: 16px;
        border-top: 1px solid #cbd5e1;
        font-size: 8pt !important;
        color: #64748b !important;
        width: 100%;
        page-break-before: avoid;
        break-before: avoid;
      }

      /* 5. MAIN CONTAINER & 2-COLUMN LANDSCAPE GRID */
      main {
        padding: 0 !important;
        max-width: 100% !important;
        margin: 0 !important;
        width: 100% !important;
      }
      .grid {
        display: grid !important;
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 16px !important;
        width: 100% !important;
        page-break-inside: auto;
      }

      /* 6. CRITICAL: WIDGET CARD PAGE-BREAK PROTECTION (بدون أي قص للكارد بالورقة التالية) */
      .widget-card {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid-page !important;
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 10px !important;
        box-shadow: none !important;
        margin-bottom: 0 !important;
        overflow: visible !important;
      }

      /* Full width widgets in landscape: table and 12-col cards */
      .widget-card.col-12,
      .widget-card.is-table-card {
        grid-column: span 2 !important;
        width: 100% !important;
      }
      .widget-card.col-6,
      .widget-card.col-4,
      .widget-card.col-3,
      .widget-card.col-8 {
        grid-column: span 1 !important;
      }

      .widget-header {
        background: #f8fafc !important;
        border-bottom: 1px solid #e2e8f0 !important;
        padding: 8px 12px !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .widget-title {
        font-size: 11pt !important;
        font-weight: 800 !important;
        color: #0f172a !important;
      }

      .widget-body {
        padding: 10px !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      /* Charts sizing for crisp print */
      .chart-container {
        height: 240px !important;
        min-height: 240px !important;
        width: 100% !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      /* KPIs */
      .kpi-container {
        padding: 16px !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .kpi-value {
        font-size: 26pt !important;
        color: #0284c7 !important;
      }
      .kpi-meta {
        font-size: 9pt !important;
        color: #64748b !important;
      }

      /* Tables in print: show clean neatly styled rows without scrollbars */
      .table-container {
        max-height: none !important;
        overflow: visible !important;
        border-radius: 0 !important;
      }
      .table-container table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 8.5pt !important;
      }
      .table-container th {
        background: #f1f5f9 !important;
        color: #0f172a !important;
        border-bottom: 1.5px solid #94a3b8 !important;
        padding: 5px 8px !important;
        font-size: 8.5pt !important;
      }
      .table-container td {
        border-bottom: 1px solid #e2e8f0 !important;
        color: #1e293b !important;
        padding: 4px 8px !important;
        font-size: 8pt !important;
        max-width: none !important;
        white-space: normal !important;
        word-break: break-word !important;
      }
      .table-container tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  </style>
</head>
<body class="${theme}">
  <!-- Dual-Tier Header (بارين علويين) -->
  <div class="header-wrapper">
    <!-- Bar 1: Brand, Report Title & Status Badges -->
    <div class="top-bar-1">
      <!-- Mobile: title centered -->
      <div class="mobile-title-bar">
        <h1 style="font-size:14px;font-weight:800;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cleanTitle}</h1>
      </div>
      <!-- Desktop brand section -->
      <div class="brand-section desktop-only-flex">
        <div class="logo-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <div class="title-box">
          <div class="title-box-row">
            <h1>${cleanTitle}</h1>
            <span class="platform-tag">LENS BI</span>
          </div>
          <p>تقرير تفاعلي تحليلي • معالجة فورية عبر المتصفح</p>
        </div>
      </div>
      <div class="bar-1-status">
        <span class="badge badge-readonly">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>عرض للقراءة فقط</span>
        </span>
        <span class="badge badge-secure">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span class="desktop-only">محمي ومؤمن</span>
        </span>
      </div>
    </div>

    <!-- Bar 2: Controls, Filters & Actions Toolbar -->
    <div class="top-bar-2">
      <div class="filter-status-area">
        <span id="filter-status-indicator" class="filter-indicator-text">
          <span class="status-dot"></span>
          <span>جميع البيانات معروضة (بدون تصفية)</span>
        </span>
        <button id="reset-filter-btn" class="btn btn-filter-reset" onclick="resetFilters()" style="display:none;" title="إعادة ضبط كل الفلاتر">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span>إعادة ضبط</span>
        </button>
      </div>
      <div class="bar-2-actions">
        <!-- Live Motion Theme Selector -->
        <div class="motion-picker-area">
          <label for="motion-theme-select" class="motion-label">
            <span>✨</span>
            <span class="desktop-only">نمط الحركة:</span>
          </label>
          <select id="motion-theme-select" class="motion-select" onchange="changeActiveMotionTheme(this.value)" title="تغيير النمط الحركي والتصميم">
            <option value="wps-professional">📊 احترافي WPS</option>
            <option value="skeuomorphism">📻 سكيومورفزم</option>
            <option value="neumorphism">🔘 نيومورفزم</option>
            <option value="glassmorphism">💎 جلاس مورفزم</option>
            <option value="claymorphism">🧸 كلاي مورفزم</option>
            <option value="minimalism">⚪ مينيماليزم</option>
            <option value="maximalism">🎨 ماكسيماليزم</option>
            <option value="brutalism">⚡ بروتاليزم</option>
            <option value="liquid-glass">🌊 زجاج سائل</option>
            <option value="bento-grid">🍱 بينتو جرايد</option>
            <option value="spatial-ui">🥽 سباتيشل ثلاثي الأبعاد</option>
            <option value="cyber-neon">⚡ نيون سيبراني</option>
            <option value="glass-capsule">💊 كبسولة زجاجية</option>
            <option value="minimal-luxury">👑 الفخامة الذهبية</option>
            <option value="liquid-floating">💧 عائم سائل</option>
            <option value="orbit-cosmic">🪐 مداري كوني</option>
          </select>
        </div>
        <button id="theme-toggle-btn" class="btn btn-action" onclick="toggleTheme()" title="تبديل بين الثيم الأبيض والداكن">
          <span id="theme-toggle-icon">${theme === 'dark' ? '☀️' : '🌙'}</span>
          <span id="theme-toggle-label" class="desktop-only">${theme === 'dark' ? 'الثيم الأبيض' : 'الثيم الداكن'}</span>
        </button>
        <button class="btn btn-action" onclick="window.print()" title="طباعة أو تصدير PDF">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
          <span class="desktop-only">PDF</span>
        </button>
        <button class="btn btn-action" onclick="toggleFullscreen()" title="ملء الشاشة">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          <span class="desktop-only">ملء الشاشة</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Dedicated Paper Print Header (يظهر فقط في الطباعة الورقية وبدون أي بيانات للمنصة) -->
  <div class="print-paper-header">
    <div class="print-title-area">
      <h1 class="print-report-title">${cleanTitle}</h1>
      <p class="print-report-subtitle">تقرير تحليلي مفصل للبيانات</p>
    </div>
    <div class="print-meta-area">
      <div class="print-meta-row"><span>تاريخ التقرير:</span> <b>${formatDateAr(new Date(), true)}</b></div>
      <div class="print-meta-row"><span>إجمالي السجلات:</span> <b>${allRows.length.toLocaleString()} سجل</b></div>
    </div>
  </div>

  <!-- Canvas -->
  <main>
    <div class="grid" id="widgets-grid">
      <!-- Generated dynamically by script -->
    </div>
  </main>

  <!-- Dedicated Paper Print Footer (يظهر فقط في الطباعة الورقية) -->
  <div class="print-paper-footer">
    <span>${cleanTitle}</span>
    <span>وثيقة عمل تحليلية معتمدة</span>
  </div>

  <!-- Modal for enlarged charts -->
  <div id="chart-modal" onclick="closeModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3 id="modal-title" style="font-size:14px; font-weight:700;"></h3>
        <button class="btn btn-secondary" onclick="closeModal()">إغلاق ✕</button>
      </div>
      <div class="modal-body">
        <div id="modal-chart" style="width:100%; height:100%;"></div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer>
    <div style="display:flex;align-items:center;gap:6px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span>مؤمّن • وضع العرض والمشاهدة فقط</span>
    </div>
    <div>آخر تحديث: ${formatDateAr(new Date(), true)}</div>
  </footer>

  <!-- ============================================================ -->
  <!-- 📦 EMBEDDED SELF-CONTAINED JSON DATASET                      -->
  <!-- Entire dataset is serialized as standalone JSON.             -->
  <!-- No connection to Supabase, Google Sheets, or server needed! -->
  <!-- ============================================================ -->
  <script id="lens-bi-embedded-data" type="application/json">
${embeddedPackageJsonSafe}
  </script>

  <!-- Embedded Dashboard & Data Engine -->
  <script>
    // ── Global error boundary: show visible message instead of blank page ──
    window.onerror = function(msg, src, line, col, err) {
      var errDiv = document.getElementById('__lens-error__');
      if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = '__lens-error__';
        errDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#7f1d1d;color:#fef2f2;padding:16px 24px;font-family:monospace;font-size:13px;z-index:9999;direction:ltr;';
        document.body.appendChild(errDiv);
      }
      errDiv.textContent = '❌ Script Error: ' + msg + ' (line ' + line + ')';
      return false;
    };

    // ── Parse embedded JSON dataset ──
    var EMBEDDED_PACKAGE, DASHBOARD, RAW_ROWS, ALL_SHEETS, COLUMNS, THEME;
    try {
      var embedEl = document.getElementById('lens-bi-embedded-data');
      if (!embedEl) throw new Error('Embedded data element not found in DOM');
      var rawText = embedEl.textContent || embedEl.innerText || '';
      if (!rawText.trim()) throw new Error('Embedded data is empty');
      EMBEDDED_PACKAGE = JSON.parse(rawText);
      DASHBOARD = EMBEDDED_PACKAGE.dashboard;
      RAW_ROWS = EMBEDDED_PACKAGE.rows || [];
      ALL_SHEETS = EMBEDDED_PACKAGE.sheets || [];
      COLUMNS = EMBEDDED_PACKAGE.columns || [];
      THEME = EMBEDDED_PACKAGE.theme || '${theme}';
      if (!DASHBOARD || !DASHBOARD.widgets) throw new Error('Dashboard data is missing or malformed');
    } catch (parseErr) {
      document.addEventListener('DOMContentLoaded', function() {
        var grid = document.getElementById('widgets-grid');
        if (grid) {
          grid.style.cssText = 'padding:32px;text-align:center;color:#f87171;font-family:sans-serif;font-size:14px;';
          grid.innerHTML = '<div style="background:#1c0a0a;border:1px solid #7f1d1d;border-radius:12px;padding:24px;max-width:600px;margin:0 auto;">'
            + '<div style="font-size:32px;margin-bottom:12px;">⚠️</div>'
            + '<h3 style="color:#fca5a5;margin-bottom:8px;">خطأ في تحميل بيانات التقرير</h3>'
            + '<p style="color:#fecaca;font-size:12px;direction:ltr;font-family:monospace;">' + parseErr.message + '</p>'
            + '</div>';
        }
      });
    }

    // Apply page theme class to body
    if (THEME === 'light') {
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
      document.body.classList.add('dark');
    }

    // Helper: get rows for a specific widget (using per-widget sheet binding if present)
    function getWidgetRows(w) {
      if (w.config && (w.config.sheetId || w.config.sheetName) && ALL_SHEETS.length > 0) {
        var sheet = ALL_SHEETS.find(function(s) {
          return s.id === w.config.sheetId || s.name === w.config.sheetName;
        });
        if (sheet && Array.isArray(sheet.rawRows) && sheet.rawRows.length > 0) {
          return sheet.rawRows;
        }
      }
      return RAW_ROWS;
    }

    // Pre-applied filters from the original dashboard state
    let activeFilters = (EMBEDDED_PACKAGE && EMBEDDED_PACKAGE.initialFilters) || {};
    let drillDownStates = (EMBEDDED_PACKAGE && EMBEDDED_PACKAGE.drillDownStates) || {};
    const chartInstances = {};
    let modalChartInstance = null;

    // Active Motion Theme State & Live Switcher
    var currentActiveMotionTheme = (EMBEDDED_PACKAGE && (EMBEDDED_PACKAGE.motionTheme || (EMBEDDED_PACKAGE.dashboard && EMBEDDED_PACKAGE.dashboard.motionTheme))) || 'wps-professional';

    function changeActiveMotionTheme(themeId) {
      if (!themeId) return;
      currentActiveMotionTheme = themeId;
      var validThemes = [
        'wps-professional', 'skeuomorphism', 'neumorphism', 'glassmorphism', 'claymorphism',
        'minimalism', 'maximalism', 'brutalism', 'liquid-glass',
        'bento-grid', 'spatial-ui', 'cyber-neon', 'glass-capsule',
        'minimal-luxury', 'liquid-floating', 'orbit-cosmic'
      ];
      var cards = document.querySelectorAll('.widget-card');
      cards.forEach(function(card) {
        validThemes.forEach(function(t) {
          card.classList.remove('theme-' + t);
        });
        card.classList.add('theme-' + themeId);
      });

      var sel = document.getElementById('motion-theme-select');
      if (sel && sel.value !== themeId) {
        sel.value = themeId;
      }

      // Re-render charts with new theme colors & fresh fluid animation
      renderAllWidgets();
    }


    // Filter Logic
    function filterRows(rows, filters) {
      if (!rows || rows.length === 0) return [];
      const entries = Object.entries(filters);
      if (entries.length === 0) return rows;

      return rows.filter(row => {
        for (const [col, val] of entries) {
          if (!val || val === 'الكل') continue;
          const rowVal = String(row[col] ?? '');
          if (Array.isArray(val)) {
            if (val.length > 0 && !val.includes(rowVal)) return false;
          } else {
            if (rowVal !== String(val)) return false;
          }
        }
        return true;
      });
    }

    // Aggregation Logic
    function aggregateGroupData(rows, xCol, yCol, agg = 'SUM', sortOrder = 'desc', topN) {
      if (!rows || rows.length === 0 || !xCol) {
        return { categories: [], values: [] };
      }
      const groups = {};
      for (const row of rows) {
        const cat = row[xCol] !== undefined && row[xCol] !== null ? String(row[xCol]) : '(غير محدد)';
        const rawV = row[yCol];
        let num = 0;
        if (typeof rawV === 'number') num = rawV;
        else if (typeof rawV === 'string') {
          const p = parseFloat(rawV.replace(/[^0-9.-]+/g, ''));
          num = isNaN(p) ? 0 : p;
        }
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(num);
      }
      const entries = [];
      for (const [cat, list] of Object.entries(groups)) {
        let v = 0;
        if (agg === 'SUM') v = list.reduce((a, b) => a + b, 0);
        else if (agg === 'AVG') v = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
        else if (agg === 'COUNT') v = list.length;
        else if (agg === 'MIN') v = Math.min(...list);
        else if (agg === 'MAX') v = Math.max(...list);
        entries.push({ category: cat, value: Math.round(v * 100) / 100 });
      }
      if (sortOrder === 'desc') entries.sort((a, b) => b.value - a.value);
      else if (sortOrder === 'asc') entries.sort((a, b) => a.value - b.value);

      const finalEntries = topN && topN > 0 ? entries.slice(0, topN) : entries;
      return {
        categories: finalEntries.map(e => e.category),
        values: finalEntries.map(e => e.value)
      };
    }

    function calculateKpi(rows, yCol, agg = 'SUM') {
      if (!rows || rows.length === 0) return { value: 0, count: 0 };
      if (!yCol) return { value: rows.length, count: rows.length };
      let sum = 0;
      let count = 0;
      for (const row of rows) {
        const raw = row[yCol];
        let num = 0;
        if (typeof raw === 'number') num = raw;
        else if (typeof raw === 'string') {
          const p = parseFloat(raw.replace(/[^0-9.-]+/g, ''));
          num = isNaN(p) ? 0 : p;
        }
        sum += num;
        count++;
      }
      if (agg === 'AVG') return { value: count ? sum / count : 0, count };
      return { value: sum, count };
    }

    function formatNumber(val, fmt) {
      if (fmt === 'currency') return '$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val);
      if (fmt === 'compact') {
        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
        return String(val);
      }
      if (fmt === 'percent') return val.toFixed(1) + '%';
      return typeof val === 'number' ? val.toLocaleString('ar-IQ') : String(val);
    }

    // Color Palettes
    const PALETTES = {
      sky: ['#38bdf8', '#0284c7'],
      emerald: ['#34d399', '#059669'],
      violet: ['#a78bfa', '#6d28d9'],
      amber: ['#fbbf24', '#d97706'],
      rose: ['#fb7185', '#e11d48'],
      cyan: ['#22d3ee', '#0891b2']
    };

    const MOTION_THEME_CONFIGS = {
      'wps-professional': {
        colors: ['#14b8a6', '#0d9488', '#10b981', '#06b6d4', '#0284c7', '#059669', '#f59e0b'],
        duration: 1800,
        easing: 'cubicOut',
        delayStep: 55,
        barRadius: [8, 8, 2, 2],
        pieRadius: 8
      },
      'skeuomorphism': {
        colors: ['#d97706', '#94a3b8', '#0284c7', '#10b981', '#b45309', '#475569', '#3b82f6'],
        duration: 2100,
        easing: 'bounceOut',
        delayStep: 75,
        barRadius: [6, 6, 0, 0],
        pieRadius: 6
      },
      'neumorphism': {
        colors: ['#60a5fa', '#818cf8', '#34d399', '#f472b6', '#a78bfa', '#38bdf8', '#fbbf24'],
        duration: 1900,
        easing: 'cubicOut',
        delayStep: 60,
        barRadius: [8, 8, 0, 0],
        pieRadius: 8
      },
      'glassmorphism': {
        colors: ['#38bdf8', '#818cf8', '#c084fc', '#34d399', '#f472b6', '#38bdf8', '#a78bfa'],
        duration: 2000,
        easing: 'quarticOut',
        delayStep: 70,
        barRadius: [8, 8, 2, 2],
        pieRadius: 8
      },
      'claymorphism': {
        colors: ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'],
        duration: 2200,
        easing: 'elasticOut',
        delayStep: 85,
        barRadius: [16, 16, 8, 8],
        pieRadius: 14
      },
      'minimalism': {
        colors: ['#38bdf8', '#94a3b8', '#e2e8f0', '#0ea5e9', '#64748b', '#cbd5e1'],
        duration: 1600,
        easing: 'cubicOut',
        delayStep: 40,
        barRadius: [4, 4, 0, 0],
        pieRadius: 4
      },
      'maximalism': {
        colors: ['#ff0055', '#00e5ff', '#ffe600', '#7928ca', '#00ff66', '#ff00aa', '#ffaa00'],
        duration: 1900,
        easing: 'bounceOut',
        delayStep: 60,
        barRadius: [8, 8, 0, 0],
        pieRadius: 8
      },
      'brutalism': {
        colors: ['#facc15', '#38bdf8', '#f43f5e', '#4ade80', '#a855f7', '#fb923c', '#e11d48'],
        duration: 1700,
        easing: 'quarticIn',
        delayStep: 50,
        barRadius: [0, 0, 0, 0],
        pieRadius: 0
      },
      'liquid-glass': {
        colors: ['#06b6d4', '#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9'],
        duration: 2200,
        easing: 'cubicInOut',
        delayStep: 80,
        barRadius: [10, 10, 0, 0],
        pieRadius: 8
      },
      'bento-grid': {
        colors: ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#14b8a6'],
        duration: 1900,
        easing: 'cubicOut',
        delayStep: 60,
        barRadius: [10, 10, 4, 4],
        pieRadius: 8
      },
      'spatial-ui': {
        colors: ['#818cf8', '#c084fc', '#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#60a5fa'],
        duration: 2400,
        easing: 'exponentialOut',
        delayStep: 90,
        barRadius: [10, 10, 4, 4],
        pieRadius: 10
      },
      'cyber-neon': {
        colors: ['#00f3ff', '#ff007f', '#ffe600', '#39ff14', '#b026ff', '#00e5ff'],
        duration: 1900,
        easing: 'cubicOut',
        delayStep: 60,
        barRadius: [6, 6, 0, 0],
        pieRadius: 6
      },
      'glass-capsule': {
        colors: ['#38bdf8', '#818cf8', '#c084fc', '#34d399', '#f472b6', '#38bdf8'],
        duration: 2000,
        easing: 'quarticOut',
        delayStep: 70,
        barRadius: [10, 10, 4, 4],
        pieRadius: 8
      },
      'minimal-luxury': {
        colors: ['#d4af37', '#f59e0b', '#fbbf24', '#b45309', '#fde68a', '#92400e'],
        duration: 2000,
        easing: 'quarticOut',
        delayStep: 70,
        barRadius: [8, 8, 2, 2],
        pieRadius: 8
      },
      'liquid-floating': {
        colors: ['#06b6d4', '#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ec4899'],
        duration: 2200,
        easing: 'cubicInOut',
        delayStep: 80,
        barRadius: [10, 10, 0, 0],
        pieRadius: 8
      },
      'orbit-cosmic': {
        colors: ['#8b5cf6', '#6366f1', '#ec4899', '#06b6d4', '#fbbf24', '#14b8a6'],
        duration: 2400,
        easing: 'circularOut',
        delayStep: 90,
        barRadius: [8, 8, 2, 2],
        pieRadius: 8
      }
    };
    const MOTION_PALETTES = Object.fromEntries(Object.entries(MOTION_THEME_CONFIGS).map(([k, v]) => [k, v.colors]));

    function updateActiveFilterBadge() {
      const statusText = document.getElementById('filter-status-indicator');
      const resetBtn = document.getElementById('reset-filter-btn');
      const activeFilterKeys = Object.keys(activeFilters).filter(k => {
        const v = activeFilters[k];
        return Array.isArray(v) ? v.length > 0 : (v && v !== 'الكل');
      });
      const activeDrillCount = Object.values(drillDownStates).filter(d => d && d.path && d.path.length > 0).length;
      const totalActiveCount = activeFilterKeys.length + activeDrillCount;

      if (totalActiveCount > 0) {
        if (statusText) {
          let label = '<span class="status-dot active"></span> <b style="color:#38bdf8;">' + totalActiveCount + ' تصفية نشطة:</b> ';
          const parts = [];
          if (activeFilterKeys.length > 0) parts.push('فلاتر: ' + activeFilterKeys.join('، '));
          if (activeDrillCount > 0) parts.push(activeDrillCount + ' تفريعات هرمية');
          label += '<span style="color:#94a3b8; font-size:11px;">(' + parts.join(' • ') + ')</span>';
          statusText.innerHTML = label;
        }
        if (resetBtn) resetBtn.style.display = 'inline-flex';
      } else {
        if (statusText) {
          statusText.innerHTML = '<span class="status-dot"></span> <span>جميع البيانات معروضة بالكامل (بدون تصفية)</span>';
        }
        if (resetBtn) resetBtn.style.display = 'none';
      }
    }

    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }

    function toggleTheme() {
      THEME = THEME === 'light' ? 'dark' : 'light';
      if (THEME === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.body.classList.remove('dark');
        document.body.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        document.body.classList.remove('light');
        document.body.classList.add('dark');
      }

      var iconEl = document.getElementById('theme-toggle-icon');
      var labelEl = document.getElementById('theme-toggle-label');
      if (iconEl) iconEl.textContent = THEME === 'dark' ? '☀️' : '🌙';
      if (labelEl) labelEl.textContent = THEME === 'dark' ? 'الثيم الأبيض' : 'الثيم الداكن';

      // Dispose existing chart instances so they cleanly re-render with the new theme
      Object.keys(chartInstances).forEach(function(id) {
        if (chartInstances[id] && !chartInstances[id].isDisposed()) {
          try { chartInstances[id].dispose(); } catch(e) {}
        }
        delete chartInstances[id];
      });

      renderAllWidgets();
    }

    function resetFilters() {
      activeFilters = {};
      Object.keys(drillDownStates).forEach(k => {
        drillDownStates[k] = { path: [], levelIndex: 0 };
      });
      renderAllWidgets();
      updateActiveFilterBadge();
    }

    function handleFilterChange(col, val, isMulti = false) {
      if (isMulti) {
        let current = Array.isArray(activeFilters[col]) ? [...activeFilters[col]] : [];
        if (current.includes(val)) {
          current = current.filter(x => x !== val);
        } else {
          current.push(val);
        }
        activeFilters[col] = current;
      } else {
        if (activeFilters[col] === val) {
          delete activeFilters[col];
        } else {
          activeFilters[col] = val;
        }
      }
      renderAllWidgets();
      updateActiveFilterBadge();
    }

    function renderAllWidgets() {
      const filtered = filterRows(RAW_ROWS, activeFilters);

      DASHBOARD.widgets.forEach(w => {
        // ── get per-widget rows (using sheet binding if available) ──
        const wRows = getWidgetRows(w);
        const wFiltered = filterRows(wRows, activeFilters);

        if (w.type === 'kpi') {
          renderKpiWidget(w, wFiltered);
        } else if (w.type === 'slicer') {
          renderSlicerWidget(w, wRows);
        } else if (w.type === 'table') {
          renderTableWidget(w, wFiltered);
        } else if (w.type === 'pivot') {
          renderPivotWidget(w, wFiltered);
        } else {
          renderChartWidget(w, wFiltered);
        }
      });
      renderAllBreadcrumbs();
    }

    function renderKpiWidget(w, rows) {
      const res = calculateKpi(rows, w.config.yAxisColumn, w.config.aggregation);
      const valEl = document.getElementById('val-' + w.id);
      const countEl = document.getElementById('count-' + w.id);
      if (valEl) valEl.textContent = formatNumber(res.value, w.config.numberFormat);
      if (countEl) countEl.textContent = res.count + ' سجلات مدرجة';
    }

    function renderSlicerWidget(w, allRows) {
      const container = document.getElementById('slicer-opts-' + w.id);
      if (!container) return;
      const activeCol = w.config.activeSlicerColumn || w.config.xAxisColumn || 'المنطقة';
      const values = Array.from(new Set(allRows.map(r => String(r[activeCol] ?? '')))).filter(Boolean).sort();
      const currentSelected = activeFilters[activeCol] || [];

      container.innerHTML = values.map(val => {
        const isSelected = Array.isArray(currentSelected)
          ? currentSelected.includes(val)
          : currentSelected === val;
        const safeVal = String(val).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
        const safeCol = String(activeCol).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
        return \`<button class="slicer-item \${isSelected ? 'active' : ''}" onclick="handleFilterChange('\${safeCol}', '\${safeVal}', true)">\${val}</button>\`;
      }).join('');
    }

    function switchSlicerTab(widgetId, column) {
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (!w) return;
      w.config.activeSlicerColumn = column;

      // Update tab buttons style in place
      const tabsContainer = document.getElementById('slicer-tabs-' + w.id);
      if (tabsContainer) {
        tabsContainer.querySelectorAll('.slicer-tab').forEach(b => {
          if (b.getAttribute('data-col') === column) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
      }

      // Re-render only this slicer's options without touching other DOM elements
      renderSlicerWidget(w, RAW_ROWS);
    }

    // Table states for client-side pagination, search & sorting
    const tableStates = {};

    function initTableState(widgetId) {
      if (!tableStates[widgetId]) {
        tableStates[widgetId] = {
          page: 1,
          pageSize: 30, // 30 rows default per user requirement
          searchQuery: '',
          sortCol: null,
          sortAsc: true
        };
      }
      return tableStates[widgetId];
    }

    function renderTableWidget(w, rows) {
      const state = initTableState(w.id);
      const cols = w.config.tableColumns || COLUMNS.slice(0, 7).map(c => c.columnName);

      // 1. Filter rows by local search query if present
      let processedRows = rows;
      if (state.searchQuery && state.searchQuery.trim()) {
        const q = state.searchQuery.trim().toLowerCase();
        processedRows = processedRows.filter(r => {
          return cols.some(c => {
            const val = r[c];
            return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
          });
        });
      }

      // 2. Sort rows if sortCol is set
      if (state.sortCol) {
        const sc = state.sortCol;
        const asc = state.sortAsc ? 1 : -1;
        processedRows = [...processedRows].sort((a, b) => {
          const valA = a[sc];
          const valB = b[sc];
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          if (typeof valA === 'number' && typeof valB === 'number') {
            return (valA - valB) * asc;
          }
          return String(valA).localeCompare(String(valB), 'ar') * asc;
        });
      }

      const totalRows = processedRows.length;
      const pageSize = state.pageSize === 'all' ? (totalRows || 1) : parseInt(state.pageSize, 10) || 30;
      const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

      // Ensure current page is within valid range
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;

      const startIdx = (state.page - 1) * pageSize;
      const endIdx = Math.min(startIdx + pageSize, totalRows);
      const pageRows = processedRows.slice(startIdx, endIdx);

      // Render table rows
      const tbody = document.getElementById('tbody-' + w.id);
      if (tbody) {
        if (pageRows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="' + cols.length + '" style="text-align:center; padding:28px 12px; color:var(--text-muted); font-size:12px;">لا توجد سجلات مطابقة للبحث أو التصفية الحالية</td></tr>';
        } else {
          tbody.innerHTML = pageRows.map(r => {
            return '<tr>' + cols.map(c => {
              const val = r[c] ?? '-';
              const isNum = typeof val === 'number';
              const displayVal = isNum ? val.toLocaleString() : String(val);
              return '<td class="' + (isNum ? 'num-cell' : '') + '" title="' + String(val).replace(/"/g, '&quot;') + '">' + displayVal + '</td>';
            }).join('') + '</tr>';
          }).join('');
        }
      }

      // Update header sort indicators
      cols.forEach(c => {
        const thEl = document.getElementById('th-' + w.id + '-' + encodeURIComponent(c));
        if (thEl) {
          const icon = thEl.querySelector('.sort-icon');
          if (state.sortCol === c) {
            thEl.style.color = '#38bdf8';
            if (icon) icon.textContent = state.sortAsc ? ' ▲' : ' ▼';
          } else {
            thEl.style.color = '';
            if (icon) icon.textContent = ' ⇅';
          }
        }
      });

      // Sync page size select element
      const sizeEl = document.getElementById('size-' + w.id);
      if (sizeEl && sizeEl.value !== String(state.pageSize)) {
        sizeEl.value = String(state.pageSize);
      }

      // Update pagination info text
      const countEl = document.getElementById('table-count-' + w.id);
      if (countEl) {
        if (totalRows === 0) {
          countEl.innerHTML = '<span>0 سجلات</span>';
        } else {
          countEl.innerHTML = 'عرض <b>' + (startIdx + 1).toLocaleString() + '</b> - <b>' + endIdx.toLocaleString() + '</b> من إجمالي <b>' + totalRows.toLocaleString() + '</b> سجل';
        }
      }

      // Render pagination buttons
      const navEl = document.getElementById('table-nav-' + w.id);
      if (navEl) {
        if (totalPages <= 1) {
          navEl.innerHTML = '<span class="pg-badge">صفحة 1 من 1</span>';
        } else {
          let navHtml = '';
          navHtml += '<button class="pg-btn" ' + (state.page <= 1 ? 'disabled' : '') + ' onclick="setTablePage(&quot;' + w.id + '&quot;, 1)" title="الصفحة الأولى">«</button>';
          navHtml += '<button class="pg-btn" ' + (state.page <= 1 ? 'disabled' : '') + ' onclick="setTablePage(&quot;' + w.id + '&quot;, ' + (state.page - 1) + ')" title="السابق">‹ السابق</button>';

          const windowSize = 2;
          let startP = Math.max(1, state.page - windowSize);
          let endP = Math.min(totalPages, state.page + windowSize);

          if (startP > 1) {
            navHtml += '<button class="pg-btn pg-num" onclick="setTablePage(&quot;' + w.id + '&quot;, 1)">1</button>';
            if (startP > 2) navHtml += '<span class="pg-dots">...</span>';
          }

          for (let p = startP; p <= endP; p++) {
            navHtml += '<button class="pg-btn pg-num ' + (p === state.page ? 'active' : '') + '" onclick="setTablePage(&quot;' + w.id + '&quot;, ' + p + ')">' + p + '</button>';
          }

          if (endP < totalPages) {
            if (endP < totalPages - 1) navHtml += '<span class="pg-dots">...</span>';
            navHtml += '<button class="pg-btn pg-num" onclick="setTablePage(&quot;' + w.id + '&quot;, ' + totalPages + ')">' + totalPages + '</button>';
          }

          navHtml += '<button class="pg-btn" ' + (state.page >= totalPages ? 'disabled' : '') + ' onclick="setTablePage(&quot;' + w.id + '&quot;, ' + (state.page + 1) + ')" title="التالي">التالي ›</button>';
          navHtml += '<button class="pg-btn" ' + (state.page >= totalPages ? 'disabled' : '') + ' onclick="setTablePage(&quot;' + w.id + '&quot;, ' + totalPages + ')" title="الصفحة الأخيرة">»</button>';

          navEl.innerHTML = navHtml;
        }
      }
    }

    function setTablePage(widgetId, page) {
      const state = initTableState(widgetId);
      state.page = page;
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) renderTableWidget(w, filterRows(getWidgetRows(w), activeFilters));
    }

    function changeTablePageSize(widgetId, size) {
      const state = initTableState(widgetId);
      state.pageSize = size;
      state.page = 1;
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) renderTableWidget(w, filterRows(getWidgetRows(w), activeFilters));
    }

    function sortTableByColumn(widgetId, colName) {
      const state = initTableState(widgetId);
      if (state.sortCol === colName) {
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortCol = colName;
        state.sortAsc = true;
      }
      state.page = 1;
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) renderTableWidget(w, filterRows(getWidgetRows(w), activeFilters));
    }

    function filterTableSearch(widgetId, query) {
      const state = initTableState(widgetId);
      state.searchQuery = query;
      state.page = 1;
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) renderTableWidget(w, filterRows(getWidgetRows(w), activeFilters));
    }

    // ─── Pivot Table Engine for Standalone Export ───
    const pivotStates = {};

    function initPivotState(widgetId) {
      if (!pivotStates[widgetId]) {
        pivotStates[widgetId] = {
          collapsedKeys: new Set(),
          drillPath: [],
          searchQuery: ''
        };
      }
      return pivotStates[widgetId];
    }

    function filterPivotSearch(widgetId, query) {
      const state = initPivotState(widgetId);
      state.searchQuery = query || '';
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) {
        const wRows = getWidgetRows(w);
        renderPivotWidget(w, filterRows(wRows, activeFilters));
      }
    }

    function togglePivotGroup(widgetId, groupKey) {
      const state = initPivotState(widgetId);
      if (state.collapsedKeys.has(groupKey)) {
        state.collapsedKeys.delete(groupKey);
      } else {
        state.collapsedKeys.add(groupKey);
      }
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) {
        const wRows = getWidgetRows(w);
        renderPivotWidget(w, filterRows(wRows, activeFilters));
      }
    }

    function togglePivotExpandAll(widgetId) {
      const state = initPivotState(widgetId);
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (!w) return;
      if (state.collapsedKeys.size === 0) {
        state._collapseAll = true;
      } else {
        state.collapsedKeys = new Set();
        state._collapseAll = false;
      }
      const wRows = getWidgetRows(w);
      renderPivotWidget(w, filterRows(wRows, activeFilters));
    }

    function drillIntoPivot(widgetId, colName, colVal) {
      const state = initPivotState(widgetId);
      state.drillPath.push({ col: colName, value: colVal });
      state.collapsedKeys = new Set();
      triggerWidgetDrillPulse(widgetId);
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) {
        const wRows = getWidgetRows(w);
        renderPivotWidget(w, filterRows(wRows, activeFilters));
      }
    }

    function drillUpPivot(widgetId) {
      const state = initPivotState(widgetId);
      if (state.drillPath.length > 0) {
        state.drillPath.pop();
        state.collapsedKeys = new Set();
        triggerWidgetDrillPulse(widgetId);
        const w = DASHBOARD.widgets.find(x => x.id === widgetId);
        if (w) {
          const wRows = getWidgetRows(w);
          renderPivotWidget(w, filterRows(wRows, activeFilters));
        }
      }
    }

    function drillToPivotStep(widgetId, stepIdx) {
      const state = initPivotState(widgetId);
      state.drillPath = state.drillPath.slice(0, stepIdx);
      state.collapsedKeys = new Set();
      triggerWidgetDrillPulse(widgetId);
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) {
        const wRows = getWidgetRows(w);
        renderPivotWidget(w, filterRows(wRows, activeFilters));
      }
    }

    function resetPivotDrill(widgetId) {
      const state = initPivotState(widgetId);
      state.drillPath = [];
      state.collapsedKeys = new Set();
      triggerWidgetDrillPulse(widgetId);
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) {
        const wRows = getWidgetRows(w);
        renderPivotWidget(w, filterRows(wRows, activeFilters));
      }
    }

    function renderPivotWidget(w, rows) {
      const container = document.getElementById('pivot-container-' + w.id);
      if (!container) return;

      const state = initPivotState(w.id);
      const cfg = w.config || {};
      const sheetCols = (w.config && (w.config.sheetId || w.config.sheetName) && ALL_SHEETS.length > 0)
        ? (ALL_SHEETS.find(s => s.id === w.config.sheetId || s.name === w.config.sheetName)?.columns || COLUMNS)
        : COLUMNS;

      // 1. Row dimensions
      let rowCols = cfg.pivotRowColumns || [];
      if (!rowCols.length && cfg.xAxisColumn) rowCols = [cfg.xAxisColumn];
      if (!rowCols.length && sheetCols.length > 0) {
        const firstCat = sheetCols.find(c => c.dataType === 'string' || c.dataType === 'date') || sheetCols[0];
        rowCols = [firstCat.columnName || firstCat];
      }

      // 2. Column dimensions
      const colCols = cfg.pivotColumnColumns || [];

      // 3. Values / Metrics
      let valMetrics = cfg.pivotValues || [];
      if (!valMetrics.length) {
        const metricCol = cfg.yAxisColumn || sheetCols.find(c => c.dataType === 'numeric')?.columnName;
        if (metricCol) {
          valMetrics = [{
            id: 'val_1',
            column: metricCol,
            aggregation: cfg.aggregation || 'SUM',
            customLabel: metricCol
          }];
        } else if (rowCols.length > 0) {
          valMetrics = [{
            id: 'val_1',
            column: rowCols[0],
            aggregation: 'COUNT',
            customLabel: 'العدد'
          }];
        }
      }

      // Filter by search query if present
      let processedRows = rows;
      if (state.searchQuery && state.searchQuery.trim()) {
        const q = state.searchQuery.trim().toLowerCase();
        processedRows = processedRows.filter(r => {
          return Object.values(r).some(v => v !== undefined && v !== null && String(v).toLowerCase().includes(q));
        });
      }

      // Filter by drillPath if present
      if (state.drillPath && state.drillPath.length > 0) {
        processedRows = processedRows.filter(r => {
          return state.drillPath.every(st => String(r[st.col] ?? '(فارغ)') === st.value);
        });
      }

      const effectiveRowCols = rowCols.slice(state.drillPath ? state.drillPath.length : 0);

      if (!processedRows.length) {
        container.innerHTML = '<div style="text-align:center; padding:32px; color:var(--text-muted); font-size:12px;">لا توجد بيانات مطابقة في الجدول المحوري</div>';
        return;
      }

      // Aggregation helper
      function calcVal(items, col, agg) {
        if (!items || !items.length) return 0;
        if (agg === 'COUNT') return items.length;
        const nums = items.map(it => {
          const v = it[col];
          if (typeof v === 'number') return v;
          const parsed = parseFloat(String(v ?? '').replace(/[,$\\sد\\.ع]/g, ''));
          return isNaN(parsed) ? null : parsed;
        }).filter(v => v !== null);
        if (!nums.length) return 0;
        if (agg === 'SUM') return nums.reduce((a, b) => a + b, 0);
        if (agg === 'AVG') return nums.reduce((a, b) => a + b, 0) / nums.length;
        if (agg === 'MAX') return Math.max(...nums);
        if (agg === 'MIN') return Math.min(...nums);
        return nums.reduce((a, b) => a + b, 0);
      }

      function formatVal(num, agg) {
        if (agg === 'COUNT') return num.toLocaleString();
        if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (agg === 'AVG') return num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
        return Number.isInteger(num) ? num.toLocaleString() : num.toFixed(2);
      }

      const colDimensionValues = (colCols.length > 0 && colCols[0])
        ? Array.from(new Set(processedRows.map(r => String(r[colCols[0]] ?? '')).filter(v => v.trim() !== ''))).sort()
        : [];

      // Recursive N-Level tree builder
      function buildPivotTree(items, colIdx, parentPrefix) {
        if (colIdx >= effectiveRowCols.length || !items.length) return [];
        const colName = effectiveRowCols[colIdx];
        const isLast = colIdx === effectiveRowCols.length - 1;

        const groupMap = {};
        items.forEach(r => {
          const v = String(r[colName] ?? '(فارغ)');
          if (!groupMap[v]) groupMap[v] = [];
          groupMap[v].push(r);
        });

        const list = [];
        Object.keys(groupMap).sort((a, b) => {
          const valA = calcVal(groupMap[a], valMetrics[0]?.column, valMetrics[0]?.aggregation || 'SUM');
          const valB = calcVal(groupMap[b], valMetrics[0]?.column, valMetrics[0]?.aggregation || 'SUM');
          return valB - valA;
        }).forEach(gVal => {
          const matching = groupMap[gVal];
          const key = parentPrefix ? parentPrefix + ':::' + gVal : gVal;
          const children = isLast ? [] : buildPivotTree(matching, colIdx + 1, key);
          list.push({
            key: key,
            level: colIdx,
            label: gVal,
            rows: matching,
            children: children
          });
        });
        return list;
      }

      const tree = buildPivotTree(processedRows, 0, '');

      // Handle collapse all if requested
      if (state._collapseAll) {
        const collect = (nodes) => {
          nodes.forEach(n => {
            if (n.children && n.children.length > 0) {
              state.collapsedKeys.add(n.key);
              collect(n.children);
            }
          });
        };
        state.collapsedKeys = new Set();
        collect(tree);
        state._collapseAll = false;
      }

      // Flatten tree
      const flatRows = [];
      function flattenPivot(nodes) {
        nodes.forEach(n => {
          flatRows.push(n);
          const isCollapsed = state.collapsedKeys.has(n.key);
          if (n.children && n.children.length > 0 && !isCollapsed) {
            flattenPivot(n.children);
          }
        });
      }
      flattenPivot(tree);

      let html = '';

      // Breadcrumb & Expand/Collapse toolbar if multi-row
      if (rowCols.length > 1) {
        html += '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px; margin-bottom:10px; border-radius:10px; background:rgba(14,165,233,0.07); border:1px solid rgba(14,165,233,0.18); font-size:11px; flex-wrap:wrap;">';
        html += '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">';
        html += '<span style="font-weight:800; color:var(--accent);">❖ المسار الهرمي:</span>';
        html += '<button data-wid="' + w.id + '" onclick="resetPivotDrill(this.dataset.wid)" style="padding:2px 8px; border-radius:6px; border:none; cursor:pointer; font-weight:700; font-family:Cairo; background:' + (state.drillPath.length === 0 ? 'var(--accent)' : 'transparent') + '; color:' + (state.drillPath.length === 0 ? '#fff' : 'var(--text)') + ';">⌂ الكل</button>';
        state.drillPath.forEach((st, idx) => {
          html += '<span style="opacity:0.4;">‹</span>';
          html += '<button data-wid="' + w.id + '" data-step="' + (idx + 1) + '" onclick="drillToPivotStep(this.dataset.wid, parseInt(this.dataset.step))" style="padding:2px 8px; border-radius:6px; border:none; cursor:pointer; font-weight:700; font-family:Cairo; background:' + (idx === state.drillPath.length - 1 ? 'var(--accent)' : 'transparent') + '; color:' + (idx === state.drillPath.length - 1 ? '#fff' : 'var(--text)') + ';">' + st.col + ': ' + st.value + '</button>';
        });
        if (state.drillPath.length > 0) {
          html += '<button data-wid="' + w.id + '" onclick="drillUpPivot(this.dataset.wid)" style="padding:3px 10px; border-radius:6px; border:1px solid var(--surface-border); background:var(--chrome-btn-bg); color:var(--text); cursor:pointer; font-weight:700; font-family:Cairo; margin-right:6px;">⮌ صعود للخلف</button>';
        }
        html += '</div>';

        html += '<button data-wid="' + w.id + '" onclick="togglePivotExpandAll(this.dataset.wid)" style="padding:3px 10px; border-radius:6px; border:1px solid var(--surface-border); background:var(--chrome-btn-bg); color:var(--text); cursor:pointer; font-weight:700; font-family:Cairo;" title="طي أو توسيع كافة الصفوف الهرمية">' + (state.collapsedKeys.size > 0 ? 'توسيع الكل' : 'طي الكل') + '</button>';
        html += '</div>';
      }

      html += '<table style="width:100%; border-collapse:collapse; text-align:right;"><thead><tr>';
      html += '<th style="min-width:180px;">' + (effectiveRowCols.length ? effectiveRowCols : rowCols).join(' ❯ ') + '</th>';

      if (colDimensionValues.length > 0) {
        colDimensionValues.forEach(cv => {
          valMetrics.forEach(m => {
            html += '<th style="text-align:center;">' + cv + ' (' + (m.customLabel || m.column) + ')</th>';
          });
        });
        valMetrics.forEach(m => {
          html += '<th style="text-align:center; font-weight:800; background:rgba(14,165,233,0.12);">إجمالي ' + (m.customLabel || m.column) + '</th>';
        });
      } else {
        valMetrics.forEach(m => {
          html += '<th style="text-align:center;">' + (m.customLabel || (m.aggregation + ' ' + m.column)) + '</th>';
        });
      }
      html += '</tr></thead><tbody>';

      flatRows.forEach(row => {
        const hasChildren = row.children && row.children.length > 0;
        const isCollapsed = state.collapsedKeys.has(row.key);
        const safeGKey = encodeURIComponent(row.key);
        const currentColName = effectiveRowCols[row.level] || '';
        const safeColName = encodeURIComponent(currentColName);
        const safeVal = encodeURIComponent(row.label);

        html += '<tr class="pivot-parent-row" style="font-weight:' + (row.level === 0 ? '700' : '500') + '; font-size:' + (row.level === 0 ? '12px' : '11px') + ';">';
        html += '<td>';
        html += '<div style="display:flex; align-items:center; gap:6px; padding-right:' + (row.level * 18 + 4) + 'px;">';

        if (hasChildren) {
          html += '<button data-wid="' + w.id + '" data-gkey="' + safeGKey + '" onclick="togglePivotGroup(this.dataset.wid, decodeURIComponent(this.dataset.gkey))" style="background:transparent; border:none; cursor:pointer; color:var(--accent); font-size:11px; padding:0 3px;" title="' + (isCollapsed ? 'توسيع الفئة' : 'طي الفئة') + '">' + (isCollapsed ? '▶' : '▼') + '</button>';
          html += '<button data-wid="' + w.id + '" data-col="' + safeColName + '" data-val="' + safeVal + '" onclick="drillIntoPivot(this.dataset.wid, decodeURIComponent(this.dataset.col), decodeURIComponent(this.dataset.val))" style="background:rgba(14,165,233,0.12); color:var(--accent); border:none; border-radius:4px; padding:1px 6px; font-size:9.5px; font-weight:700; cursor:pointer; font-family:Cairo;" title="دخول في تفاصيل هذا الصف (Drill Into)">دخول ‹</button>';
        } else if (row.level > 0) {
          html += '<span style="opacity:0.4; font-size:10px; width:12px; text-align:center;">↳</span>';
        }

        html += '<span data-wid="' + w.id + '" data-gkey="' + safeGKey + '" onclick="' + (hasChildren ? 'togglePivotGroup(this.dataset.wid, decodeURIComponent(this.dataset.gkey))' : '') + '" style="' + (hasChildren ? 'cursor:pointer;' : '') + '">' + row.label + '</span>';
        html += '<span style="font-size:10px; opacity:0.5; margin-right:4px;">(' + row.rows.length + ')</span>';
        html += '</div></td>';

        if (colDimensionValues.length > 0) {
          colDimensionValues.forEach(cv => {
            const subItems = row.rows.filter(r => String(r[colCols[0]] ?? '') === cv);
            valMetrics.forEach(m => {
              const val = calcVal(subItems, m.column, m.aggregation);
              html += '<td class="num-cell" style="text-align:center;">' + (val ? formatVal(val, m.aggregation) : '-') + '</td>';
            });
          });
          valMetrics.forEach(m => {
            const tot = calcVal(row.rows, m.column, m.aggregation);
            html += '<td class="num-cell" style="text-align:center; font-weight:700; color:var(--accent);">' + formatVal(tot, m.aggregation) + '</td>';
          });
        } else {
          valMetrics.forEach(m => {
            const val = calcVal(row.rows, m.column, m.aggregation);
            html += '<td class="num-cell" style="text-align:center;">' + formatVal(val, m.aggregation) + '</td>';
          });
        }
        html += '</tr>';
      });

      // Grand Total Row
      html += '<tr style="font-weight:900; background:rgba(14,165,233,0.15); border-top:2px solid var(--accent);">';
      html += '<td>المجموع الكلي (Grand Total)</td>';
      if (colDimensionValues.length > 0) {
        colDimensionValues.forEach(cv => {
          const colItems = processedRows.filter(r => String(r[colCols[0]] ?? '') === cv);
          valMetrics.forEach(m => {
            const val = calcVal(colItems, m.column, m.aggregation);
            html += '<td class="num-cell" style="text-align:center;">' + formatVal(val, m.aggregation) + '</td>';
          });
        });
        valMetrics.forEach(m => {
          const tot = calcVal(processedRows, m.column, m.aggregation);
          html += '<td class="num-cell" style="text-align:center; color:var(--accent);">' + formatVal(tot, m.aggregation) + '</td>';
        });
      } else {
        valMetrics.forEach(m => {
          const val = calcVal(processedRows, m.column, m.aggregation);
          html += '<td class="num-cell" style="text-align:center; color:var(--accent);">' + formatVal(val, m.aggregation) + '</td>';
        });
      }
      html += '</tr>';

      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function exportPivotToExcel(widgetId) {
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (!w) return;
      const rows = getWidgetRows(w);
      const filtered = filterRows(rows, activeFilters);

      const cfg = w.config || {};
      let rowCols = cfg.pivotRowColumns || (cfg.xAxisColumn ? [cfg.xAxisColumn] : ['التصنيف']);
      let valMetrics = cfg.pivotValues || [{ column: cfg.yAxisColumn || 'القيمة', aggregation: cfg.aggregation || 'SUM', customLabel: 'القيمة' }];

      let csv = rowCols.join(',') + ',' + valMetrics.map(m => m.customLabel || m.column).join(',') + String.fromCharCode(10);

      const groups = {};
      filtered.forEach(r => {
        const key = String(r[rowCols[0]] ?? '');
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      Object.keys(groups).sort().forEach(k => {
        const gRows = groups[k];
        const vals = valMetrics.map(m => {
          if (m.aggregation === 'COUNT') return gRows.length;
          return gRows.reduce((acc, r) => acc + (parseFloat(r[m.column]) || 0), 0);
        });
        csv += '"' + k.replace(/"/g, '""') + '",' + vals.join(',') + String.fromCharCode(10);
      });

      const blob = new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (w.title || 'Pivot_Table').replace(/[^a-zA-Z0-9_\u0600-\u06FF]+/g, '_') + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function getChartOption(w, rows) {
      const isDrill = Boolean(w.config.drillDownEnabled && w.config.drillDownLevels && w.config.drillDownLevels.length > 0);
      const drill = drillDownStates[w.id] || { path: [], levelIndex: 0 };
      const currentLevelIdx = Math.min(drill.levelIndex || 0, isDrill ? w.config.drillDownLevels.length - 1 : 0);
      const activeCol = isDrill
        ? (w.config.drillDownLevels[currentLevelIdx] || w.config.xAxisColumn || 'المنطقة')
        : (w.config.xAxisColumn || COLUMNS[0]?.columnName || 'المنطقة');
      const yCol = w.config.yAxisColumn || COLUMNS[1]?.columnName || 'المبيعات';

      // Filter rows by widget's drill-down path
      let chartRows = rows;
      if (isDrill && drill.path && drill.path.length > 0) {
        chartRows = chartRows.filter(r => {
          for (const step of drill.path) {
            if (String(r[step.column] ?? '') !== String(step.value)) return false;
          }
          return true;
        });
      }

      const agg = aggregateGroupData(chartRows, activeCol, yCol, w.config.aggregation, w.config.sortOrder, w.config.topN);
      const mCfg = MOTION_THEME_CONFIGS[currentActiveMotionTheme] || MOTION_THEME_CONFIGS['wps-professional'];
      const themeColors = mCfg.colors;
      const palette = [themeColors[0], themeColors[1] || themeColors[0]];

      // Use page theme for chart axis/grid/tooltip colors
      const isDark = THEME !== 'light';
      const textColor = isDark ? '#94a3b8' : '#334155';
      const splitLine = isDark ? '#1e293b' : '#e2e8f0';
      const axisLine = isDark ? '#334155' : '#cbd5e1';

      const base = {
        backgroundColor: 'transparent',
        animation: true,
        animationDuration: mCfg.duration,
        animationEasing: mCfg.easing,
        animationDelay: function(idx) { return idx * mCfg.delayStep; },
        animationDurationUpdate: 900,
        animationEasingUpdate: 'cubicOut',
        tooltip: {
          trigger: w.type === 'donut' || w.type === 'pie' ? 'item' : 'axis',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
          borderColor: isDark ? '#334155' : '#cbd5e1',
          borderWidth: 1.5,
          textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Cairo', fontWeight: 600, fontSize: 12 },
          extraCssText: isDark
            ? 'box-shadow: 0 12px 30px rgba(0,0,0,0.7); border-radius: 12px; padding: 10px 14px;'
            : 'box-shadow: 0 10px 25px -4px rgba(100, 116, 139, 0.25), 0 4px 10px -2px rgba(100, 116, 139, 0.15); border-radius: 12px; padding: 10px 14px;',
          formatter: w.type === 'donut' || w.type === 'pie'
            ? (p) => \`\${p.name}: <b>\${formatNumber(p.value, w.config.numberFormat)}</b> (\${p.percent}%)\`
            : undefined
        }
      };

      if (w.type === 'donut' || w.type === 'pie') {
        return {
          ...base,
          color: themeColors,
          series: [{
            id: 'series_' + w.id,
            type: 'pie',
            universalTransition: { enabled: true },
            radius: w.type === 'donut' ? ['45%', '72%'] : '70%',
            center: ['50%', '50%'],
            data: agg.categories.map((c, i) => ({ name: c, value: agg.values[i] })),
            itemStyle: {
              borderRadius: mCfg.pieRadius,
              borderColor: isDark ? '#0f172a' : '#ffffff',
              borderWidth: mCfg.pieRadius === 0 ? 0 : 2
            },
            label: { color: textColor, fontFamily: 'Cairo', fontSize: 11, formatter: '{b}: {d}%' }
          }]
        };
      }

      if (w.type === 'horizontal_bar') {
        const revCats = [...agg.categories].reverse();
        const revVals = [...agg.values].reverse();
        const barR = mCfg.barRadius || [6, 6, 0, 0];
        return {
          ...base,
          grid: { left: '4%', right: '8%', bottom: '4%', top: '6%', containLabel: true },
          xAxis: { type: 'value', axisLabel: { color: textColor, fontFamily: 'Cairo' }, splitLine: { lineStyle: { color: splitLine } } },
          yAxis: { type: 'category', data: revCats, axisLabel: { color: textColor, fontFamily: 'Cairo', fontSize: 10 }, axisLine: { lineStyle: { color: axisLine } } },
          series: [{
            id: 'series_' + w.id,
            type: 'bar',
            universalTransition: { enabled: true, divideShape: 'split' },
            data: revVals,
            itemStyle: {
              borderRadius: [0, barR[0] || 6, barR[1] || 6, 0],
              color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                { offset: 0, color: palette[0] },
                { offset: 1, color: palette[1] }
              ])
            }
          }]
        };
      }

      if (w.type === 'line' || w.type === 'area') {
        return {
          ...base,
          grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
          xAxis: { type: 'category', data: agg.categories, axisLabel: { color: textColor, fontFamily: 'Cairo', fontSize: 10 }, axisLine: { lineStyle: { color: axisLine } } },
          yAxis: { type: 'value', axisLabel: { color: textColor, fontFamily: 'Cairo' }, splitLine: { lineStyle: { color: splitLine } } },
          series: [{
            id: 'series_' + w.id,
            type: 'line',
            universalTransition: { enabled: true },
            data: agg.values,
            smooth: true,
            lineStyle: { width: 3.2, color: palette[0] },
            itemStyle: { color: palette[0], borderColor: isDark ? '#0f172a' : '#fff', borderWidth: 2 },
            areaStyle: w.type === 'area' ? {
              opacity: 0.35,
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: palette[0] },
                { offset: 1, color: 'rgba(255,255,255,0)' }
              ])
            } : undefined
          }]
        };
      }

      // Default: Bar
      return {
        ...base,
        grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
        xAxis: { type: 'category', data: agg.categories, axisLabel: { color: textColor, fontFamily: 'Cairo', fontSize: 10 }, axisLine: { lineStyle: { color: axisLine } } },
        yAxis: { type: 'value', axisLabel: { color: textColor, fontFamily: 'Cairo' }, splitLine: { lineStyle: { color: splitLine } } },
        series: [{
          id: 'series_' + w.id,
          type: 'bar',
          universalTransition: { enabled: true, divideShape: 'split' },
          data: agg.values,
          itemStyle: {
            borderRadius: mCfg.barRadius || [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: palette[0] },
              { offset: 1, color: palette[1] }
            ])
          }
        }]
      };
    }

    function triggerWidgetDrillPulse(widgetId) {
      const card = document.getElementById('widget-card-' + widgetId);
      if (card) {
        card.classList.remove('widget-drill-pulse');
        void card.offsetWidth;
        card.classList.add('widget-drill-pulse');
      }
    }

    function renderChartWidget(w, rows) {
      const dom = document.getElementById('chart-' + w.id);
      if (!dom) return;
      let chart = chartInstances[w.id];
      if (!chart || chart.isDisposed() || chart.getDom() !== dom) {
        if (chart && !chart.isDisposed()) {
          try { chart.dispose(); } catch(e) {}
        }
        const chartTheme = THEME === 'light' ? undefined : 'dark';
        chart = echarts.init(dom, chartTheme);
        chartInstances[w.id] = chart;
        chart.on('click', (params) => {
          const clickedName = params.name || params.value;
          if (!clickedName) return;

          const isDrill = Boolean(w.config.drillDownEnabled && w.config.drillDownLevels && w.config.drillDownLevels.length > 0);
          if (isDrill) {
            const drillLevels = w.config.drillDownLevels;
            const currentDrill = drillDownStates[w.id] || { path: [], levelIndex: 0 };
            const currentLevel = currentDrill.levelIndex || 0;

            if (currentLevel < drillLevels.length - 1) {
              const currentCol = drillLevels[currentLevel];
              const newPath = [...(currentDrill.path || []), { column: currentCol, value: String(clickedName) }];
              drillDownStates[w.id] = {
                path: newPath,
                levelIndex: currentLevel + 1
              };

              // Propagate drill filter to activeFilters if crossFilter is not disabled
              if (w.config.crossFilterMode !== 'none') {
                activeFilters[currentCol] = String(clickedName);
              }
              triggerWidgetDrillPulse(w.id);
              renderAllWidgets();
              updateActiveFilterBadge();
              return;
            }
          }

          // Default Cross-filtering at leaf level or for non-drill widgets
          const xCol = w.config.xAxisColumn || 'المنطقة';
          handleFilterChange(xCol, clickedName);
        });
      }
      chart.setOption(getChartOption(w, rows), {
        notMerge: false,
        replaceMerge: ['xAxis', 'yAxis', 'series'],
        lazyUpdate: false
      });
      chart.resize();
    }

    function renderAllBreadcrumbs() {
      DASHBOARD.widgets.forEach(w => {
        if (w.config.drillDownEnabled && w.config.drillDownLevels && w.config.drillDownLevels.length > 0) {
          renderDrillBreadcrumb(w);
        }
      });
    }

    function renderDrillBreadcrumb(w) {
      const bcContainer = document.getElementById('drill-bc-' + w.id);
      const badgeEl = document.getElementById('drill-badge-' + w.id);
      if (!bcContainer) return;

      const drillLevels = w.config.drillDownLevels || [];
      const currentDrill = drillDownStates[w.id] || { path: [], levelIndex: 0 };
      const path = currentDrill.path || [];
      const currentLevel = Math.min(currentDrill.levelIndex || 0, drillLevels.length - 1);
      const activeCol = drillLevels[currentLevel] || w.config.xAxisColumn || 'المنطقة';

      if (badgeEl) {
        badgeEl.textContent = 'هرمي (' + (path.length + 1) + '/' + drillLevels.length + ')';
      }

      let crumbsHtml = '<div class="drill-crumbs-list">';
      crumbsHtml += '<span class="drill-title-tag"><span>❖ مسار التفصيل:</span></span>';

      // Root button (الكل)
      const isRootActive = path.length === 0;
      crumbsHtml += '<button class="drill-btn-root ' + (isRootActive ? 'active' : '') + '" data-wid="' + w.id + '" onclick="resetWidgetDrill(this.dataset.wid)" title="العودة للمستوى الرئيسي (الكل)"><span>⌂ الكل</span></button>';

      // Breadcrumb steps
      path.forEach((step) => {
        crumbsHtml += '<span class="drill-chevron">‹</span>';
        crumbsHtml += '<span class="drill-step-pill" title="' + step.column + ': ' + step.value + '"><span class="col-label">' + step.column + ':</span> <span>' + step.value + '</span></span>';
      });

      // Current active column indicator
      if (path.length > 0) {
        crumbsHtml += '<span class="drill-chevron">‹</span>';
        crumbsHtml += '<span class="drill-active-col-pill">حسب: ' + activeCol + '</span>';
      }
      crumbsHtml += '</div>';

      // Actions (Level badge + Back button)
      crumbsHtml += '<div class="drill-actions">';
      crumbsHtml += '<span class="drill-level-badge">مستوى ' + (path.length + 1) + '/' + drillLevels.length + '</span>';
      if (path.length > 0) {
        crumbsHtml += '<button class="drill-btn-back" data-wid="' + w.id + '" onclick="drillUpWidget(this.dataset.wid)" title="رجوع مستوى واحد للخلف"><span>⮌ رجوع</span></button>';
      }
      crumbsHtml += '</div>';

      bcContainer.innerHTML = crumbsHtml;
    }

    function drillUpWidget(widgetId) {
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (!w) return;
      const currentDrill = drillDownStates[widgetId] || { path: [], levelIndex: 0 };
      const path = currentDrill.path || [];
      if (path.length > 0) {
        const popped = path[path.length - 1];
        const newPath = path.slice(0, -1);
        const newLevel = Math.max(0, (currentDrill.levelIndex || 1) - 1);
        drillDownStates[widgetId] = {
          path: newPath,
          levelIndex: newLevel
        };

        if (activeFilters[popped.column] === popped.value) {
          delete activeFilters[popped.column];
        }
      } else {
        drillDownStates[widgetId] = { path: [], levelIndex: 0 };
      }
      triggerWidgetDrillPulse(widgetId);
      renderAllWidgets();
      updateActiveFilterBadge();
    }

    function resetWidgetDrill(widgetId) {
      const currentDrill = drillDownStates[widgetId] || { path: [], levelIndex: 0 };
      (currentDrill.path || []).forEach(step => {
        if (activeFilters[step.column] === step.value) {
          delete activeFilters[step.column];
        }
      });
      drillDownStates[widgetId] = { path: [], levelIndex: 0 };
      triggerWidgetDrillPulse(widgetId);
      renderAllWidgets();
      updateActiveFilterBadge();
    }

    function openModal(widgetId) {
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (!w) return;
      const modal = document.getElementById('chart-modal');
      const title = document.getElementById('modal-title');
      const dom = document.getElementById('modal-chart');
      title.textContent = w.title;
      modal.classList.add('open');
      if (modalChartInstance) modalChartInstance.dispose();
      const modalChartTheme = THEME === 'light' ? undefined : 'dark';
      modalChartInstance = echarts.init(dom, modalChartTheme);
      const wRows = getWidgetRows(w);
      const filtered = filterRows(wRows, activeFilters);
      modalChartInstance.setOption(getChartOption(w, filtered));
    }

    function closeModal() {
      const modal = document.getElementById('chart-modal');
      modal.classList.remove('open');
      if (modalChartInstance) {
        modalChartInstance.dispose();
        modalChartInstance = null;
      }
    }

    // Build DOM structure initially
    function initDOM() {
      const grid = document.getElementById('widgets-grid');
      if (!grid) return;
      grid.innerHTML = (DASHBOARD.widgets || []).map((w, idx) => {
        if (!w) return '';
        const layout = w.layout || {};
        const config = w.config || {};
        const colClass = 'col-' + (layout.w || (w.type === 'slicer' || w.type === 'table' ? 12 : 6));
        const safeTitle = String(w.title || 'عنصر تحليلي').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const animDelay = 'animation-delay: ' + (idx * 0.05).toFixed(2) + 's;';
        const themeClass = 'theme-' + currentActiveMotionTheme;

        if (w.type === 'kpi') {
          return \`
            <div class="widget-card \${colClass} \${themeClass}" style="\${animDelay} min-height:140px;">
              <div class="widget-header">
                <div class="widget-title">\${safeTitle}</div>
              </div>
              <div class="widget-body kpi-container">
                <div class="kpi-value" id="val-\${w.id}">-</div>
                <div class="kpi-meta">
                  <span class="kpi-delta">+18.5% مقارنة</span>
                  <span class="kpi-count" id="count-\${w.id}">-</span>
                </div>
              </div>
            </div>
          \`;
        }

        if (w.type === 'slicer') {
          const slicerCols = (config.slicerColumns && config.slicerColumns.length > 0)
            ? config.slicerColumns
            : (config.xAxisColumn ? [config.xAxisColumn] : (COLUMNS && COLUMNS.length > 0 ? COLUMNS.slice(0, 3).map(c => c.columnName || c) : []));
          const activeCol = config.activeSlicerColumn || slicerCols[0] || '';
          return \`
            <div class="widget-card \${colClass} \${themeClass}" id="slicer-\${w.id}" style="\${animDelay}">
              <div class="widget-header">
                <div class="widget-title">🔍 \${safeTitle}</div>
              </div>
              <div class="widget-body">
                <div class="slicer-tabs" id="slicer-tabs-\${w.id}">
                  \${slicerCols.map(c => \`
                    <button class="slicer-tab \${c === activeCol ? 'active' : ''}" data-col="\${c}" onclick="switchSlicerTab('\${w.id}', '\${c}')">\${c}</button>
                  \`).join('')}
                </div>
                <div class="slicer-options" id="slicer-opts-\${w.id}"></div>
              </div>
            </div>
          \`;
        }

        if (w.type === 'table') {
          const cols = (config.tableColumns && config.tableColumns.length > 0)
            ? config.tableColumns
            : (COLUMNS && COLUMNS.length > 0 ? COLUMNS.slice(0, 7).map(c => c.columnName || c) : (RAW_ROWS[0] ? Object.keys(RAW_ROWS[0]).slice(0, 7) : []));
          return \`
            <div class="widget-card \${colClass} is-table-card \${themeClass}" style="\${animDelay}">
              <div class="widget-header table-widget-header">
                <div class="widget-title">📋 \${safeTitle}</div>
                <div class="table-search-box">
                  <span style="font-size:11px;opacity:0.7;">🔍</span>
                  <input type="text" class="table-search-input" placeholder="بحث سريع في السجلات..." oninput="filterTableSearch('\${w.id}', this.value)" />
                </div>
              </div>
              <div class="widget-body" style="padding:0;">
                <div class="table-container">
                  <table>
                    <thead>
                      <tr>
                        \${cols.map(c => {
                          const safeCol = String(c).replace(/["']/g, '');
                          const colId = 'th-' + w.id + '-' + encodeURIComponent(c);
                          return \`<th id="\${colId}" onclick="sortTableByColumn('\${w.id}', '\${safeCol}')" title="اضغط للترتيب">
                            <span class="th-content">
                              <span>\${safeCol}</span>
                              <span class="sort-icon">⇅</span>
                            </span>
                          </th>\`;
                        }).join('')}
                      </tr>
                    </thead>
                    <tbody id="tbody-\${w.id}"></tbody>
                  </table>
                </div>
                <div class="table-pagination" id="table-pagination-\${w.id}">
                  <div class="pagination-info-side">
                    <span class="pagination-count" id="table-count-\${w.id}">جاري التحميل...</span>
                    <div class="pagination-size-selector">
                      <span>عرض:</span>
                      <select class="page-size-select" id="size-\${w.id}" onchange="changeTablePageSize('\${w.id}', this.value)">
                        <option value="15">15 سطر</option>
                        <option value="30" selected>30 سطر</option>
                        <option value="50">50 سطر</option>
                        <option value="100">100 سطر</option>
                        <option value="all">الكل</option>
                      </select>
                    </div>
                  </div>
                  <div class="pagination-nav-side" id="table-nav-\${w.id}"></div>
                </div>
              </div>
            </div>
          \`;
        }

        if (w.type === 'pivot') {
          return \`
            <div class="widget-card \${colClass} is-table-card \${themeClass}" id="pivot-card-\${w.id}" style="\${animDelay}">
              <div class="widget-header table-widget-header">
                <div class="widget-title">🧩 \${safeTitle}</div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div class="table-search-box">
                    <span style="font-size:11px;opacity:0.7;">🔍</span>
                    <input type="text" class="table-search-input" placeholder="بحث في الجدول المحوري..." oninput="filterPivotSearch('\${w.id}', this.value)" />
                  </div>
                  <button class="btn btn-action" onclick="exportPivotToExcel('\${w.id}')" title="تصدير جدول الـ Pivot إلى Excel / CSV">
                    <span>📥 تصدير Excel</span>
                  </button>
                </div>
              </div>
              <div class="widget-body" style="padding:0;">
                <div class="table-container" id="pivot-container-\${w.id}" style="max-height: 480px;">
                  <div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">جاري تجهيز بيانات الجدول المحوري...</div>
                </div>
              </div>
            </div>
          \`;
        }

        const isDrill = Boolean(config.drillDownEnabled && config.drillDownLevels && config.drillDownLevels.length > 0);
        const drill = drillDownStates[w.id] || { path: [], levelIndex: 0 };
        const totalLevels = isDrill ? config.drillDownLevels.length : 0;
        const currentLvl = (drill.path?.length || 0) + 1;

        return \`
          <div class="widget-card \${colClass} \${themeClass}" style="\${animDelay}">
            <div class="widget-header">
              <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                <div class="widget-title">\${safeTitle}</div>
                \${isDrill ? \`<span class="drill-card-badge" id="drill-badge-\${w.id}">هرمي (\${currentLvl}/\${totalLevels})</span>\` : ''}
              </div>
              <button class="btn btn-secondary" style="padding:2px 8px; font-size:10px;" onclick="openModal('\${w.id}')">تكبير ⛶</button>
            </div>
            \${isDrill ? \`<div class="drill-breadcrumb" id="drill-bc-\${w.id}"></div>\` : ''}
            <div class="widget-body">
              <div id="chart-\${w.id}" class="chart-container"></div>
            </div>
          </div>
        \`;
      }).join('');
    }

    // ── Robust startup: works for file://, http://, and shared links ──
    function startApp() {
      // Guard: if data parsing failed earlier, don't try to render
      if (!DASHBOARD || !DASHBOARD.widgets) return;

      // Sync active motion theme selector dropdown
      const motionSel = document.getElementById('motion-theme-select');
      if (motionSel && currentActiveMotionTheme) {
        motionSel.value = currentActiveMotionTheme;
      }

      try {
        initDOM();
      } catch(e) {
        console.error('initDOM error:', e);
        return;
      }

      try {
        renderAllWidgets();
      } catch(e) {
        console.error('renderAllWidgets error:', e);
      }

      // Retry after 400ms to handle race conditions where ECharts
      // initializes before the DOM has rendered chart containers
      setTimeout(() => {
        DASHBOARD.widgets.forEach(w => {
          if (w.type !== 'kpi' && w.type !== 'slicer' && w.type !== 'table' && w.type !== 'pivot') {
            const dom = document.getElementById('chart-' + w.id);
            if (dom && (!chartInstances[w.id] || chartInstances[w.id].isDisposed())) {
              const wRows = getWidgetRows(w);
              renderChartWidget(w, filterRows(wRows, activeFilters));
            } else if (dom && chartInstances[w.id]) {
              chartInstances[w.id].resize();
            }
          }
        });
      }, 400);

      window.addEventListener('resize', () => {
        Object.values(chartInstances).forEach(c => {
          if (c && !c.isDisposed()) c.resize();
        });
        if (modalChartInstance && !modalChartInstance.isDisposed()) modalChartInstance.resize();
      });

      window.addEventListener('beforeprint', () => {
        Object.values(chartInstances).forEach(c => {
          if (c && !c.isDisposed()) c.resize({ width: 'auto', height: 240 });
        });
      });
      window.addEventListener('afterprint', () => {
        Object.values(chartInstances).forEach(c => {
          if (c && !c.isDisposed()) c.resize();
        });
      });
    }

    // Fire as soon as possible, works regardless of script placement
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startApp);
    } else {
      // DOM already ready (e.g. script deferred or file:// opened)
      startApp();
    }
  </script>
</body>
</html>`;
}

/**
 * Downloads the standalone interactive HTML file directly in the browser.
 * 100% of all data rows are embedded as self-contained JSON inside the HTML file.
 */
export function downloadInteractiveHtml(
  dashboard: Dashboard,
  dataSource: DataSource,
  theme: 'dark' | 'light' = 'dark',
  widgetFilters?: Record<string, Record<string, any>>,
  activeFilters?: Record<string, any>,
  drillDownStates?: Record<string, { path: Array<{ column: string; value: string }>; levelIndex: number }>,
  motionTheme?: string
): void {
  const htmlContent = generateInteractiveHtml(dashboard, dataSource, theme, widgetFilters, activeFilters, drillDownStates, motionTheme);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = (dashboard.title || 'report').replace(/[^a-zA-Z0-9_\u0600-\u06FF]+/g, '_');
  a.download = `${safeTitle}_interactive.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the raw dataset as a formatted standalone JSON file directly in the browser.
 */
export function downloadDatasetAsJson(
  dataSource: DataSource,
  dashboardTitle?: string
): void {
  const rows = extractAllRows(dataSource);
  const cols = extractAllColumns(dataSource, rows);
  const data = {
    format: 'lens-bi-standalone-dataset',
    version: '2026.2',
    exportedAt: new Date().toISOString(),
    reportTitle: dashboardTitle || 'مجموعة بيانات LENS BI',
    sourceFileName: dataSource.fileName || 'dataset.json',
    totalRecords: rows.length,
    columns: cols,
    records: rows
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = (dashboardTitle || dataSource.fileName || 'dataset').replace(/[^a-zA-Z0-9_\u0600-\u06FF]+/g, '_');
  a.download = `${safeTitle}_data.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
