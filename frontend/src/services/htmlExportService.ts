import type { Dashboard } from '../types/dashboard';
import type { DataSource } from '../types/dataSource';

/**
 * Generates a self-contained, standalone interactive HTML document
 * that can be opened in any browser offline with full interactions
 * (hover tooltips, button clicks, slicers, cross-filtering, and modal zoom).
 *
 * @param widgetFilters  Per-widget drill-down filters from DashboardStore
 * @param activeFilters  Global slicer filters from DashboardStore
 */
export function generateInteractiveHtml(
  dashboard: Dashboard,
  dataSource: DataSource,
  theme: 'dark' | 'light' = 'dark',
  widgetFilters?: Record<string, Record<string, any>>,
  activeFilters?: Record<string, any>,
  drillDownStates?: Record<string, { path: Array<{ column: string; value: string }>; levelIndex: number }>
): string {
  const cleanTitle = (dashboard.title || 'تقرير تحليلي تفاعلي')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  const dashboardJson = JSON.stringify(dashboard);
  const rawRowsJson = JSON.stringify(dataSource.rawRows || []);
  const columnsJson = JSON.stringify(dataSource.columns || []);
  const drillDownStatesJson = JSON.stringify(drillDownStates || {});

  // Merge all widget drill-down filters + global slicer filters into one initial filter map
  const mergedInitialFilters: Record<string, any> = { ...(activeFilters || {}) };
  if (widgetFilters) {
    for (const wf of Object.values(widgetFilters)) {
      for (const [col, val] of Object.entries(wf || {})) {
        if (val !== undefined && val !== null && val !== '') {
          // Only overwrite if not already set by global activeFilters
          if (!mergedInitialFilters[col]) {
            mergedInitialFilters[col] = val;
          }
        }
      }
    }
  }
  const initialFiltersJson = JSON.stringify(mergedInitialFilters);

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
  <!-- Apache ECharts for interactive charts -->
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
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
      background-color: ${theme === 'dark' ? '#0f172ae6' : '#ffffffe6'};
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--surface-border);
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
      color: var(--text);
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 380px;
    }
    .title-box p {
      font-size: 11px;
      color: var(--text-muted);
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
      background-color: ${theme === 'dark' ? '#1e293b' : '#f1f5f9'};
      color: var(--text-muted);
      border: 1px solid var(--surface-border);
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
      background-color: ${theme === 'dark' ? '#0f172a' : '#ffffff'};
      color: #94a3b8;
      border: 1px solid var(--surface-border);
      font-family: monospace;
      font-size: 10px;
    }

    /* Bar 2: Filters & Actions Toolbar */
    .top-bar-2 {
      background-color: ${theme === 'dark' ? '#090d16f2' : '#f8fafcf2'};
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--surface-border);
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
      color: var(--text-muted);
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
      background-color: ${theme === 'dark' ? '#1e293b' : '#e2e8f0'};
      color: var(--text);
      border-color: var(--surface-border);
    }
    .btn-action:hover {
      background-color: ${theme === 'dark' ? '#334155' : '#cbd5e1'};
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

    /* Mobile Responsive Header */
    @media (max-width: 768px) {
      .top-bar-1 {
        padding: 8px 14px;
      }
      .title-box h1 {
        font-size: 13px;
        max-width: 200px;
      }
      .title-box p {
        display: none;
      }
      .badge-engine {
        display: none;
      }
      .badge-readonly {
        font-size: 10px;
        padding: 3px 8px;
      }
      .badge-live {
        font-size: 10px;
        padding: 3px 8px;
      }
      .top-bar-2 {
        padding: 6px 12px;
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
    /* Widget Cards */
    .widget-card {
      background-color: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .widget-card:hover {
      border-color: ${theme === 'dark' ? '#334155' : '#cbd5e1'};
    }
    .widget-header {
      padding: 10px 14px;
      border-bottom: 1px solid var(--surface-border);
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
      background-color: ${theme === 'dark' ? '#02061760' : '#f1f5f9'};
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
      border-bottom: 1px solid ${theme === 'dark' ? '#1e293b40' : '#f1f5f9'};
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
      background-color: ${theme === 'dark' ? '#1e293b40' : '#f8fafc'};
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
      background: ${theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : '#f1f5f9'};
      border-bottom: 1px solid ${theme === 'dark' ? 'rgba(56, 189, 248, 0.2)' : '#e2e8f0'};
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
      border-left: 1px solid ${theme === 'dark' ? '#334155' : '#cbd5e1'};
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
      border: 1px solid ${theme === 'dark' ? '#334155' : '#cbd5e1'};
      background: ${theme === 'dark' ? '#1e293b80' : '#ffffff'};
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
      background: ${theme === 'dark' ? '#1e293b' : '#fef3c7'};
      color: ${theme === 'dark' ? '#fcd34d' : '#d97706'};
      border: 1px solid rgba(251, 191, 36, 0.35);
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
      background: ${theme === 'dark' ? '#1e293b' : '#f1f5f9'};
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
      background: ${theme === 'dark' ? '#1e293b' : '#ffffff'};
      border: 1px solid ${theme === 'dark' ? '#475569' : '#cbd5e1'};
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
      height: 100%;
      min-height: 200px;
    }
    footer {
      border-top: 1px solid var(--surface-border);
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
      background: var(--surface);
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

  <!-- Canvas -->
  <main>
    <div class="grid" id="widgets-grid">
      <!-- Generated dynamically by script -->
    </div>
  </main>

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
    <div>تم الإنشاء: ${new Date().toLocaleDateString('ar-IQ')}</div>
  </footer>

  <!-- Embedded Dashboard & Data Engine -->
  <script>
    const DASHBOARD = ${dashboardJson};
    const RAW_ROWS = ${rawRowsJson};
    const COLUMNS = ${columnsJson};
    const THEME = '${theme}';

    // Pre-applied filters from the original dashboard state (drill-down hierarchy + slicer filters)
    let activeFilters = ${initialFiltersJson};
    let drillDownStates = ${drillDownStatesJson};
    const chartInstances = {};
    let modalChartInstance = null;

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

    function renderTableWidget(w, rows) {
      const tbody = document.getElementById('tbody-' + w.id);
      if (!tbody) return;
      const cols = w.config.tableColumns || COLUMNS.slice(0, 5).map(c => c.columnName);
      tbody.innerHTML = rows.slice(0, 50).map(r => {
        return '<tr>' + cols.map(c => {
          const val = r[c] ?? '-';
          const isNum = typeof val === 'number';
          return '<td class="' + (isNum ? 'num-cell' : '') + '" title="' + String(val) + '">' + (isNum ? val.toLocaleString() : val) + '</td>';
        }).join('') + '</tr>';
      }).join('');
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
      const palette = PALETTES[w.config.colorTheme || 'sky'] || PALETTES.sky;
      const isDark = THEME === 'dark';
      const textColor = isDark ? '#94a3b8' : '#475569';
      const splitLine = isDark ? '#1e293b' : '#e2e8f0';

      const base = {
        backgroundColor: 'transparent',
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
        const pieColors = [
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
        chart = echarts.init(dom, THEME);
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
      modalChartInstance = echarts.init(dom, THEME);
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
      grid.innerHTML = DASHBOARD.widgets.map(w => {
        const colClass = 'col-' + (w.layout.w || 6);

        if (w.type === 'kpi') {
          return \`
            <div class="widget-card \${colClass}" style="min-height:140px;">
              <div class="widget-header">
                <div class="widget-title">\${w.title}</div>
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
          const slicerCols = w.config.slicerColumns || ['المنطقة', 'الفئة', 'الفرع'];
          const activeCol = w.config.activeSlicerColumn || slicerCols[0];
          return \`
            <div class="widget-card \${colClass}" id="slicer-\${w.id}">
              <div class="widget-header">
                <div class="widget-title">🔍 \${w.title}</div>
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
          const cols = w.config.tableColumns || COLUMNS.slice(0, 5).map(c => c.columnName);
          return \`
            <div class="widget-card \${colClass}">
              <div class="widget-header">
                <div class="widget-title">📋 \${w.title}</div>
              </div>
              <div class="widget-body" style="padding:0;">
                <div class="table-container">
                  <table>
                    <thead>
                      <tr>\${cols.map(c => '<th>' + c + '</th>').join('')}</tr>
                    </thead>
                    <tbody id="tbody-\${w.id}"></tbody>
                  </table>
                </div>
              </div>
            </div>
          \`;
        }

        const isDrill = Boolean(w.config.drillDownEnabled && w.config.drillDownLevels && w.config.drillDownLevels.length > 0);
        const drill = drillDownStates[w.id] || { path: [], levelIndex: 0 };
        const totalLevels = isDrill ? w.config.drillDownLevels.length : 0;
        const currentLvl = (drill.path?.length || 0) + 1;

        return \`
          <div class="widget-card \${colClass}">
            <div class="widget-header">
              <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                <div class="widget-title">\${w.title}</div>
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

    // Startup
    window.addEventListener('DOMContentLoaded', () => {
      initDOM();
      renderAllWidgets();
      window.addEventListener('resize', () => {
        Object.values(chartInstances).forEach(c => {
          if (c && !c.isDisposed()) c.resize();
        });
        if (modalChartInstance && !modalChartInstance.isDisposed()) modalChartInstance.resize();
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Downloads the standalone interactive HTML file directly in the browser.
 * Optionally accepts drill-down and slicer filter states to pre-apply them in the exported file.
 */
export function downloadInteractiveHtml(
  dashboard: Dashboard,
  dataSource: DataSource,
  theme: 'dark' | 'light' = 'dark',
  widgetFilters?: Record<string, Record<string, any>>,
  activeFilters?: Record<string, any>,
  drillDownStates?: Record<string, { path: Array<{ column: string; value: string }>; levelIndex: number }>
): void {
  const htmlContent = generateInteractiveHtml(dashboard, dataSource, theme, widgetFilters, activeFilters, drillDownStates);
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
