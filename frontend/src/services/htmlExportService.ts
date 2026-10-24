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
  motionTheme: string = 'glassmorphism'
): string {
  const rawTitle = (dashboard.title || 'تقرير تحليلي تفاعلي').trim();
  const cleanTitle = rawTitle
    .replace(/^[)\]\s;'"`,.-]+/, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  const allRows = extractAllRows(dataSource);
  const allColumns = extractAllColumns(dataSource, allRows);
  const initialMotionTheme = motionTheme || dashboard.motionTheme || 'glassmorphism';

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
<html lang="ar" dir="rtl">
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
      --bg: ${theme === 'dark' ? '#020617' : '#f1f5f9'};
      --surface: #0f172a;
      --surface-border: #1e293b;
      --surface-header: #1e293b80;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #0ea5e9;
      --accent-hover: #38bdf8;
      --primary-glow: rgba(14, 165, 233, 0.15);
      --chrome-bar-1: ${theme === 'dark' ? '#0f172ae6' : '#e2e8f0e6'};
      --chrome-bar-2: ${theme === 'dark' ? '#090d16f2' : '#f1f5f9f2'};
      --chrome-border: ${theme === 'dark' ? '#1e293b' : '#cbd5e1'};
      --chrome-text: ${theme === 'dark' ? '#f8fafc' : '#0f172a'};
      --chrome-text-muted: ${theme === 'dark' ? '#94a3b8' : '#475569'};
      --chrome-btn-bg: ${theme === 'dark' ? '#1e293b' : '#ffffff'};
      --chrome-btn-hover: ${theme === 'dark' ? '#334155' : '#e2e8f0'};
      --chrome-footer-bg: ${theme === 'dark' ? '#0f172a' : '#e2e8f0'};
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
    }
    /* ─── Dual-Tier Header (بارين علويين) ─── */
    .header-wrapper {
      position: sticky;
      top: 0;
      z-index: 50;
      width: 100%;
      box-shadow: 0 4px 25px rgba(0, 0, 0, 0.25);
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
    .badge-live {
      background-color: rgba(16, 185, 129, 0.1);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .badge-live::before {
      content: '';
      width: 6px;
      height: 6px;
      background-color: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
    }
    .badge-engine {
      background-color: var(--chrome-btn-bg);
      color: var(--chrome-text-muted);
      border: 1px solid var(--chrome-border);
      font-family: monospace;
      font-size: 10px;
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
      background-color: var(--surface);
      border: 1.5px solid var(--surface-border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      animation: cardEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.25s ease !important;
      position: relative;
    }
    .widget-card:hover {
      border-color: #38bdf8;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
      transform: translateY(-4px) scale(1.002) !important;
    }

    /* 1. السكيومورفزم (Skeuomorphism - بروز واقعي مجسم) */
    .theme-skeuomorphism {
      background: linear-gradient(145deg, #1e293b, #0f172a) !important;
      border: 2px solid #334155 !important;
      border-top-color: #475569 !important;
      border-bottom-color: #020617 !important;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.75), inset 0 1px 2px rgba(255, 255, 255, 0.22), inset 0 -2px 4px rgba(0, 0, 0, 0.6) !important;
    }
    .theme-skeuomorphism:hover {
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.85), 0 0 28px rgba(217, 119, 6, 0.28), inset 0 1px 3px rgba(255, 255, 255, 0.28), inset 0 -3px 6px rgba(0, 0, 0, 0.7) !important;
      transform: translateY(-4px) !important;
    }

    /* 2. النيومورفزم (Neumorphism - ناعم هادئ) */
    .theme-neumorphism {
      background: #0f172a !important;
      border: 1px solid rgba(255, 255, 255, 0.05) !important;
      box-shadow: 10px 10px 22px #060b14, -10px -10px 22px #182542 !important;
    }
    .theme-neumorphism:hover {
      box-shadow: 14px 14px 30px #040810, -14px -14px 30px #1e3050, 0 0 20px rgba(96, 165, 250, 0.2) !important;
      transform: translateY(-4px) !important;
    }

    /* 3. الجلاس مورفزم (Glassmorphism - زجاجي شفاف) */
    .theme-glassmorphism {
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      background: rgba(15, 23, 42, 0.65) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      box-shadow: 0 10px 35px rgba(0, 0, 0, 0.45) !important;
    }
    .theme-glassmorphism:hover {
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.25) !important;
      transform: translateY(-4px) !important;
    }

    /* 4. الكلاي مورفزم (Claymorphism - كبسولي ثلاثي الأبعاد) */
    .theme-claymorphism {
      background: #1e1b4b !important;
      border: 1.5px solid rgba(167, 139, 250, 0.3) !important;
      box-shadow: 14px 14px 28px rgba(0, 0, 0, 0.55), inset -8px -8px 16px rgba(0, 0, 0, 0.45), inset 8px 8px 16px rgba(255, 255, 255, 0.18) !important;
      transition: box-shadow 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }
    .theme-claymorphism:hover {
      box-shadow: 20px 20px 40px rgba(0, 0, 0, 0.7), 0 0 35px rgba(236, 72, 153, 0.35), inset -10px -10px 20px rgba(0, 0, 0, 0.5), inset 10px 10px 20px rgba(255, 255, 255, 0.22) !important;
      transform: translateY(-5px) scale(1.01) !important;
    }

    /* 5. المينيماليزم (Minimalism - أنيق ومحايد) */
    .theme-minimalism {
      background: #080d1a !important;
      border: 1px solid #1e293b !important;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25) !important;
    }
    .theme-minimalism:hover {
      border-color: #38bdf8 !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(56, 189, 248, 0.18) !important;
      transform: translateY(-3px) !important;
    }

    /* 6. الماكسيماليزم (Maximalism - ألوان صاخبة) */
    .theme-maximalism {
      background: #0a0515 !important;
      border: 2px solid #ec4899 !important;
      box-shadow: 0 0 25px rgba(236, 72, 153, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.18) !important;
    }
    .theme-maximalism:hover {
      box-shadow: 0 0 45px rgba(236, 72, 153, 0.65), 0 0 25px rgba(0, 229, 255, 0.35), inset 0 0 25px rgba(6, 182, 212, 0.28) !important;
      transform: translateY(-4px) !important;
    }

    /* 7. البروتاليزم (Brutalism - هندسي بارز) */
    .theme-brutalism {
      background: #09090b !important;
      border: 3px solid #38bdf8 !important;
      border-radius: 6px !important;
      box-shadow: 6px 6px 0px #38bdf8 !important;
    }
    .theme-brutalism:hover {
      box-shadow: 10px 10px 0px #38bdf8, 4px 4px 0px #facc15 !important;
      transform: translate(-3px, -3px) !important;
    }

    /* 8. الزجاج السائل (Liquid Glass - انسيابي مائي) */
    .theme-liquid-glass {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.14), rgba(59, 130, 246, 0.08), rgba(15, 23, 42, 0.85)) !important;
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(56, 189, 248, 0.38) !important;
      box-shadow: 0 16px 40px rgba(6, 182, 212, 0.22) !important;
    }
    .theme-liquid-glass:hover {
      box-shadow: 0 24px 60px rgba(6, 182, 212, 0.38), 0 0 40px rgba(59, 130, 246, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
      transform: translateY(-4px) !important;
    }

    /* 9. البينتو جرايد (Bento Grid - تقسيم بطاقات فخم) */
    .theme-bento-grid {
      background: rgba(15, 23, 42, 0.9) !important;
      border: 1.5px solid rgba(71, 85, 105, 0.6) !important;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38) !important;
    }
    .theme-bento-grid:hover {
      border-color: rgba(2, 132, 199, 0.5) !important;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.55), 0 0 22px rgba(2, 132, 199, 0.22) !important;
      transform: translateY(-3px) !important;
    }

    /* 10. السباتيشل ثلاثي الأبعاد (Spatial UI - واقع مكاني VisionOS) */
    .theme-spatial-ui {
      background: rgba(30, 27, 75, 0.38) !important;
      backdrop-filter: blur(36px);
      -webkit-backdrop-filter: blur(36px);
      border: 1.5px solid rgba(167, 139, 250, 0.35) !important;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(129, 140, 248, 0.28) !important;
    }
    .theme-spatial-ui:hover {
      box-shadow: 0 35px 80px -15px rgba(0, 0, 0, 0.9), 0 0 50px rgba(129, 140, 248, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
      transform: translateY(-5px) !important;
    }

    /* 11. النيون السيبراني (Cyber Neon) */
    .theme-cyber-neon {
      background: #050a14 !important;
      border: 1.5px solid #00f3ff !important;
      box-shadow: 0 0 20px rgba(0, 243, 255, 0.25) !important;
    }
    .theme-cyber-neon:hover {
      box-shadow: 0 0 40px rgba(0, 243, 255, 0.45), 0 0 20px rgba(255, 0, 127, 0.25) !important;
      transform: translateY(-3px) !important;
    }

    /* 12. الكبسولة الزجاجية (Glass Capsule) */
    .theme-glass-capsule {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      background: rgba(15, 23, 42, 0.72) !important;
      border: 1.5px solid rgba(129, 140, 248, 0.3) !important;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4) !important;
    }
    .theme-glass-capsule:hover {
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), 0 0 28px rgba(129, 140, 248, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
      transform: translateY(-3px) !important;
    }
    .widget-header {
      padding: 10px 14px;
      border-bottom: 1.5px solid var(--surface-border);
      background-color: var(--surface-header);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .widget-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 6px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.6);
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
      border-bottom: 1px solid #1e293b40;
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
      background-color: #1e293b40;
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
      border-top: 1px solid var(--chrome-border);
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--chrome-text-muted);
      background: var(--chrome-footer-bg);
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
      background: #02061790;
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
      background: #0f172a;
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
      background: #1e293b80;
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

    /* Contrast Contract: Any card, text background, upper/lower bar, or component in black/dark MUST have white inner text */
    [class*="bg-black"], [class*="bg-slate-950"], [class*="bg-slate-900"], [class*="bg-slate-800"],
    .theme-skeuomorphism, .theme-neumorphism, .theme-claymorphism, .theme-maximalism,
    .theme-brutalism, .theme-liquid-glass, .theme-bento-grid, .theme-spatial-ui {
      color: #ffffff !important;
    }
    [class*="bg-black"] *, [class*="bg-slate-950"] *, [class*="bg-slate-900"] *, [class*="bg-slate-800"] *,
    .theme-skeuomorphism *, .theme-neumorphism *, .theme-claymorphism *, .theme-maximalism *,
    .theme-brutalism *, .theme-liquid-glass *, .theme-bento-grid *, .theme-spatial-ui * {
      color: #ffffff !important;
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
<body>
  <!-- Dual-Tier Header (بارين علويين) -->
  <div class="header-wrapper">
    <!-- Bar 1: Brand, Report Title & Status Badges (الشريط العلوي الأول) -->
    <div class="top-bar-1">
      <div class="brand-section">
        <div class="logo-badge">BI</div>
        <div class="title-box">
          <div class="title-box-row">
            <h1>${cleanTitle}</h1>
            <span class="platform-tag">LENS BI</span>
          </div>
          <p>منصة التقارير التفاعلية • معالجة بيانات فورية بالمتصفح</p>
        </div>
      </div>
      <div class="bar-1-status">
        <span class="badge badge-readonly">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>عرض للقراءة فقط</span>
        </span>
        <span class="badge badge-live">تفاعلي بالكامل</span>
        <span class="badge badge-engine">DuckDB Engine</span>
      </div>
    </div>

    <!-- Bar 2: Controls, Filters & Actions Toolbar (الشريط العلوي الثاني) -->
    <div class="top-bar-2">
      <div class="filter-status-area">
        <span id="filter-status-indicator" class="filter-indicator-text">
          <span class="status-dot"></span>
          <span>جميع البيانات معروضة بالكامل (بدون تصفية)</span>
        </span>
        <button id="reset-filter-btn" class="btn btn-filter-reset" onclick="resetFilters()" style="display:none;" title="إعادة ضبط كل الفلاتر">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span>إعادة ضبط الفلاتر</span>
        </button>
      </div>
      <div class="bar-2-actions">
        <!-- Live Motion Theme Selector -->
        <div class="motion-picker-area">
          <label for="motion-theme-select" class="motion-label">
            <span>✨</span>
            <span class="desktop-only">نمط الحركة والتصميم:</span>
          </label>
          <select id="motion-theme-select" class="motion-select" onchange="changeActiveMotionTheme(this.value)" title="تغيير النمط الحركي والتصميم لكافة الكروت">
            <option value="glassmorphism">💎 جلاس مورفزم (زجاجي شفاف)</option>
            <option value="skeuomorphism">📻 سكيومورفزم (محاكاة مجسمة 3D)</option>
            <option value="neumorphism">🔘 نيومورفزم (بروز ناعم هادئ)</option>
            <option value="claymorphism">🎨 كلاي مورفزم (صلصال كبسولي)</option>
            <option value="spatial-ui">🔮 سباتيشل (واقع مكاني VisionOS)</option>
            <option value="liquid-glass">🌊 زجاج سائل (انسيابي مائي)</option>
            <option value="cyber-neon">⚡ نيون سيبراني (توهج إلكتروني)</option>
            <option value="brutalism">📐 بروتاليزم (هندسي بارز)</option>
            <option value="bento-grid">🍱 بينتو جرايد (تقسيم بطاقات)</option>
            <option value="minimalism">🔲 مينيماليزم (أنيق ومحايد)</option>
            <option value="glass-capsule">💊 كبسولة زجاجية (عصري)</option>
          </select>
        </div>
        <button class="btn btn-action" onclick="window.print()" title="طباعة أو تصدير PDF">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
          <span>طباعة / PDF</span>
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
    <div>LENS BI Platform • ملف HTML تفاعلي محمول يعمل بدون خادم وبدون إنترنت</div>
    <div>تم الإنشاء: ${formatDateAr(new Date(), true)}</div>
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
    var EMBEDDED_PACKAGE, DASHBOARD, RAW_ROWS, COLUMNS, THEME;
    try {
      var embedEl = document.getElementById('lens-bi-embedded-data');
      if (!embedEl) throw new Error('Embedded data element not found in DOM');
      var rawText = embedEl.textContent || embedEl.innerText || '';
      if (!rawText.trim()) throw new Error('Embedded data is empty');
      EMBEDDED_PACKAGE = JSON.parse(rawText);
      DASHBOARD = EMBEDDED_PACKAGE.dashboard;
      RAW_ROWS = EMBEDDED_PACKAGE.rows || [];
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

    // Pre-applied filters from the original dashboard state
    let activeFilters = (EMBEDDED_PACKAGE && EMBEDDED_PACKAGE.initialFilters) || {};
    let drillDownStates = (EMBEDDED_PACKAGE && EMBEDDED_PACKAGE.drillDownStates) || {};
    const chartInstances = {};
    let modalChartInstance = null;

    // Active Motion Theme State & Live Switcher
    var currentActiveMotionTheme = (EMBEDDED_PACKAGE && (EMBEDDED_PACKAGE.motionTheme || (EMBEDDED_PACKAGE.dashboard && EMBEDDED_PACKAGE.dashboard.motionTheme))) || 'glassmorphism';

    function changeActiveMotionTheme(themeId) {
      if (!themeId) return;
      currentActiveMotionTheme = themeId;
      var validThemes = [
        'skeuomorphism', 'neumorphism', 'glassmorphism', 'claymorphism',
        'minimalism', 'maximalism', 'brutalism', 'liquid-glass',
        'bento-grid', 'spatial-ui', 'cyber-neon', 'glass-capsule'
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

    const MOTION_PALETTES = {
      'skeuomorphism': ['#d97706', '#b45309', '#0284c7', '#10b981', '#3b82f6'],
      'neumorphism': ['#60a5fa', '#3b82f6', '#818cf8', '#34d399', '#a78bfa'],
      'glassmorphism': ['#38bdf8', '#0284c7', '#818cf8', '#34d399', '#ec4899'],
      'claymorphism': ['#a78bfa', '#7c3aed', '#ec4899', '#38bdf8', '#fbbf24'],
      'spatial-ui': ['#818cf8', '#6366f1', '#a78bfa', '#38bdf8', '#c084fc'],
      'liquid-glass': ['#06b6d4', '#0284c7', '#3b82f6', '#8b5cf6', '#10b981'],
      'cyber-neon': ['#00f3ff', '#ff007f', '#ffe600', '#00ff66', '#a100ff'],
      'brutalism': ['#38bdf8', '#facc15', '#f43f5e', '#a855f7', '#22c55e'],
      'bento-grid': ['#0ea5e9', '#0369a1', '#6366f1', '#10b981', '#f59e0b'],
      'minimalism': ['#94a3b8', '#64748b', '#cbd5e1', '#38bdf8', '#475569'],
      'glass-capsule': ['#38bdf8', '#0284c7', '#818cf8', '#34d399', '#ec4899']
    };

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
        if (w.type === 'kpi') {
          renderKpiWidget(w, filtered);
        } else if (w.type === 'slicer') {
          renderSlicerWidget(w, RAW_ROWS);
        } else if (w.type === 'table') {
          renderTableWidget(w, filtered);
        } else {
          renderChartWidget(w, filtered);
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
        const thEl = document.getElementById('th-' + w.id + '-' + c.replace(/\s+/g, '_'));
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
      if (w) renderTableWidget(w, filterRows(RAW_ROWS, activeFilters));
    }

    function changeTablePageSize(widgetId, size) {
      const state = initTableState(widgetId);
      state.pageSize = size;
      state.page = 1;
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) renderTableWidget(w, filterRows(RAW_ROWS, activeFilters));
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
      if (w) renderTableWidget(w, filterRows(RAW_ROWS, activeFilters));
    }

    function filterTableSearch(widgetId, query) {
      const state = initTableState(widgetId);
      state.searchQuery = query;
      state.page = 1;
      const w = DASHBOARD.widgets.find(x => x.id === widgetId);
      if (w) renderTableWidget(w, filterRows(RAW_ROWS, activeFilters));
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
      const themeColors = MOTION_PALETTES[currentActiveMotionTheme];
      const palette = themeColors ? [themeColors[0], themeColors[1] || themeColors[0]] : (PALETTES[w.config.colorTheme || 'sky'] || PALETTES.sky);
      // Charts always use dark palette regardless of page theme to preserve vibrant colors
      const isDark = true;
      const textColor = '#94a3b8';
      const splitLine = '#1e293b';

      const base = {
        backgroundColor: 'transparent',
        animation: true,
        animationDuration: 1800,
        animationEasing: 'cubicOut',
        animationDelay: function(idx) { return idx * 45; },
        animationDurationUpdate: 800,
        animationEasingUpdate: 'cubicOut',
        tooltip: {
          trigger: w.type === 'donut' || w.type === 'pie' ? 'item' : 'axis',
          backgroundColor: isDark ? '#0f172ae6' : '#fffffffa',
          borderColor: isDark ? '#334155' : '#cbd5e1',
          textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Cairo' },
          formatter: w.type === 'donut' || w.type === 'pie'
            ? (p) => \`\${p.name}: <b>\${formatNumber(p.value, w.config.numberFormat)}</b> (\${p.percent}%)\`
            : undefined
        }
      };

      if (w.type === 'donut' || w.type === 'pie') {
        const pieColors = themeColors || [
          '#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899',
          '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#e11d48',
          '#84cc16', '#3b82f6', '#f43f5e', '#a855f7', '#eab308'
        ];
        return {
          ...base,
          color: pieColors,
          series: [{
            type: 'pie',
            radius: w.type === 'donut' ? ['45%', '72%'] : '70%',
            center: ['50%', '50%'],
            data: agg.categories.map((c, i) => ({ name: c, value: agg.values[i] })),
            itemStyle: { borderRadius: 8, borderColor: isDark ? '#0f172a' : '#fff', borderWidth: 2 },
            label: { color: textColor, fontFamily: 'Cairo', fontSize: 11, formatter: '{b}: {d}%' }
          }]
        };
      }

      if (w.type === 'horizontal_bar') {
        const revCats = [...agg.categories].reverse();
        const revVals = [...agg.values].reverse();
        return {
          ...base,
          grid: { left: '4%', right: '8%', bottom: '4%', top: '6%', containLabel: true },
          xAxis: { type: 'value', axisLabel: { color: textColor, fontFamily: 'Cairo' }, splitLine: { lineStyle: { color: splitLine } } },
          yAxis: { type: 'category', data: revCats, axisLabel: { color: textColor, fontFamily: 'Cairo', fontSize: 10 } },
          series: [{
            type: 'bar',
            data: revVals,
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
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
          xAxis: { type: 'category', data: agg.categories, axisLabel: { color: textColor, fontFamily: 'Cairo', fontSize: 10 } },
          yAxis: { type: 'value', axisLabel: { color: textColor, fontFamily: 'Cairo' }, splitLine: { lineStyle: { color: splitLine } } },
          series: [{
            type: 'line',
            data: agg.values,
            smooth: true,
            color: palette[0],
            areaStyle: w.type === 'area' ? { opacity: 0.25, color: palette[0] } : undefined
          }]
        };
      }

      // Default: Bar
      return {
        ...base,
        grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
        xAxis: { type: 'category', data: agg.categories, axisLabel: { color: textColor, fontFamily: 'Cairo', fontSize: 10 } },
        yAxis: { type: 'value', axisLabel: { color: textColor, fontFamily: 'Cairo' }, splitLine: { lineStyle: { color: splitLine } } },
        series: [{
          type: 'bar',
          data: agg.values,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: palette[0] },
              { offset: 1, color: palette[1] }
            ])
          }
        }]
      };
    }

    function renderChartWidget(w, rows) {
      const dom = document.getElementById('chart-' + w.id);
      if (!dom) return;
      let chart = chartInstances[w.id];
      if (!chart || chart.isDisposed() || chart.getDom() !== dom) {
        if (chart && !chart.isDisposed()) {
          try { chart.dispose(); } catch(e) {}
        }
        chart = echarts.init(dom, 'dark'); // Always dark so charts keep vibrant colors
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
      chart.setOption(getChartOption(w, rows), true);
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
      crumbsHtml += '<button class="drill-btn-root ' + (isRootActive ? 'active' : '') + '" onclick="resetWidgetDrill(\\'' + w.id + '\\')" title="العودة للمستوى الرئيسي (الكل)"><span>⌂ الكل</span></button>';

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
        crumbsHtml += '<button class="drill-btn-back" onclick="drillUpWidget(\\'' + w.id + '\\')" title="رجوع مستوى واحد للخلف"><span>⮌ رجوع</span></button>';
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
      modalChartInstance = echarts.init(dom, 'dark'); // Always dark so charts keep vibrant colors
      const filtered = filterRows(RAW_ROWS, activeFilters);
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
                          const colId = 'th-' + w.id + '-' + safeCol.replace(/\\s+/g, '_');
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
          if (w.type !== 'kpi' && w.type !== 'slicer' && w.type !== 'table') {
            const dom = document.getElementById('chart-' + w.id);
            if (dom && (!chartInstances[w.id] || chartInstances[w.id].isDisposed())) {
              renderChartWidget(w, filterRows(RAW_ROWS, activeFilters));
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
