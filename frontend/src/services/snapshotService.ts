import type { Dashboard } from '../types/dashboard';
import type { DataSource } from '../types/dataSource';
import { getActiveSupabaseUrl } from './supabaseClient';

export interface CompactDashboardPayload {
  v: 2;
  t: string;            // title
  th: 'dark' | 'light'; // theme
  w: {
    i: string;          // widget id
    y: string;          // widget type
    t: string;          // widget title
    l: [number, number, number, number]; // [x, y, w, h]
    c: Record<string, any>; // clean widget config
  }[];
  // Runtime state — serialized so share/export preserves drill-down hierarchy
  dd?: Record<string, { path: { column: string; value: string }[]; levelIndex: number }>; // drillDownStates
  af?: Record<string, Record<string, any>>; // widgetFilters (per-widget drill filters)
  gf?: Record<string, any>;                 // global activeFilters (slicer filters)
  // Portable Dataset Payload (dense column-oriented table to carry data to other devices)
  d?: {
    f?: string; // fileName
    c: { n: string; t?: string }[]; // columns
    r: any[][]; // row values array
  };
}

/**
 * Minifies the dashboard into a high-density, ultra-compact payload (~300-500 chars)
 * Preserves all customized widget configurations (charts, slicers, tables, KPIs).
 * Optionally encodes drill-down hierarchy, active filters, and the uploaded dataset.
 */
export function compactDashboard(
  dashboard: Dashboard,
  theme: 'dark' | 'light',
  drillDownStates?: Record<string, { path: { column: string; value: string }[]; levelIndex: number }>,
  widgetFilters?: Record<string, Record<string, any>>,
  activeFilters?: Record<string, any>,
  dataSource?: DataSource
): CompactDashboardPayload {
  const payload: CompactDashboardPayload = {
    v: 2,
    t: dashboard.title || 'لوحة تحكم تفاعلية',
    th: theme || 'dark',
    w: (dashboard.widgets || []).map((w) => {
      const cleanConfig: Record<string, any> = {};
      for (const [k, val] of Object.entries(w.config || {})) {
        if (val !== undefined && val !== null && val !== '') {
          cleanConfig[k] = val;
        }
      }
      return {
        i: w.id,
        y: w.type,
        t: w.title,
        l: [w.layout?.x ?? 0, w.layout?.y ?? 0, w.layout?.w ?? 6, w.layout?.h ?? 4],
        c: cleanConfig
      };
    })
  };
  // Append drill-down state only when present to keep URL compact
  if (drillDownStates && Object.keys(drillDownStates).length > 0) {
    payload.dd = drillDownStates;
  }
  if (widgetFilters && Object.keys(widgetFilters).length > 0) {
    payload.af = widgetFilters;
  }
  if (activeFilters && Object.keys(activeFilters).length > 0) {
    payload.gf = activeFilters;
  }
  // Pack dataset in dense column-oriented format if available
  if (
    dataSource &&
    dataSource.columns &&
    dataSource.columns.length > 0 &&
    dataSource.rawRows &&
    dataSource.rawRows.length > 0
  ) {
    const cols = dataSource.columns.map((c) => ({
      n: c.columnName,
      t: c.dataType
    }));
    // Dense column-based encoding of row values (cap at 400 rows for URL safety)
    const maxRows = Math.min(dataSource.rawRows.length, 400);
    const rows: any[][] = [];
    for (let i = 0; i < maxRows; i++) {
      const row = dataSource.rawRows[i];
      rows.push(cols.map((c) => row[c.n] ?? null));
    }
    payload.d = {
      f: dataSource.fileName || 'Custom_Dataset.xlsx',
      c: cols,
      r: rows
    };
  }
  return payload;
}

/**
 * Expands the minified payload back into a complete Dashboard object.
 * Also returns drill-down hierarchy, filter state, and dataset if they were encoded.
 */
export function expandDashboard(compact: CompactDashboardPayload): {
  dashboard: Dashboard;
  theme: 'dark' | 'light';
  drillDownStates: Record<string, { path: { column: string; value: string }[]; levelIndex: number }>;
  widgetFilters: Record<string, Record<string, any>>;
  activeFilters: Record<string, any>;
  dataSource?: DataSource;
} {
  let restoredDataSource: DataSource | undefined = undefined;
  if (compact.d && compact.d.c && compact.d.c.length > 0 && Array.isArray(compact.d.r)) {
    const cols = compact.d.c.map((c, idx) => ({
      id: `c_${idx}`,
      columnName: c.n,
      dataType: (c.t as any) || 'string',
      sampleValues: []
    }));
    const rawRows = compact.d.r.map((rowVals) => {
      const rowObj: Record<string, any> = {};
      cols.forEach((col, i) => {
        rowObj[col.columnName] = rowVals[i] ?? null;
      });
      return rowObj;
    });
    restoredDataSource = {
      id: 'ds-portable-shared',
      workspaceId: 'ws-main',
      fileName: compact.d.f || 'Custom_Dataset.xlsx',
      fileSizeBytes: rawRows.length * 128,
      uploadedAt: new Date().toISOString(),
      activeSheetId: 'sheet-1',
      sheets: [
        {
          id: 'sheet-1',
          name: 'البيانات_المشتركة',
          rowCount: rawRows.length,
          columns: cols,
          rawRows
        }
      ],
      columns: cols,
      rawRows
    };
  }

  return {
    dashboard: {
      id: 'dash-custom-shared',
      workspaceId: 'ws-main',
      title: compact.t || 'لوحة تحكم تفاعلية مخصصة',
      description: 'تقرير تفاعلي مخصص مع تصفية متقاطعة فورية',
      widgets: (compact.w || []).map((w) => ({
        id: w.i,
        dashboardId: 'dash-custom-shared',
        dataSourceId: 'ds-portable-shared',
        type: (w.y as any) || 'bar',
        title: w.t,
        layout: {
          x: w.l?.[0] ?? 0,
          y: w.l?.[1] ?? 0,
          w: w.l?.[2] ?? 6,
          h: w.l?.[3] ?? 4,
          i: w.i
        },
        config: {
          aggregation: 'SUM',
          numberFormat: 'currency',
          colorTheme: 'sky',
          ...(w.c || {})
        }
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: true
    },
    theme: compact.th || 'dark',
    // Restore drill-down hierarchy and filters from snapshot
    drillDownStates: compact.dd || {},
    widgetFilters: compact.af || {},
    activeFilters: compact.gf || {},
    dataSource: restoredDataSource
  };
}

/**
 * Encodes an object into a URL-safe Base64 string (UTF-8 safe)
 */
export function encodeSnapshot(obj: any): string {
  try {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    console.error('Failed to encode snapshot:', err);
    return '';
  }
}

/**
 * Decodes a URL-safe Base64 string back into a JS object (UTF-8 safe)
 */
export function decodeSnapshot<T = any>(encoded: string): T | null {
  try {
    if (!encoded || typeof encoded !== 'string') return null;
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch (err) {
    console.warn('Failed to decode snapshot:', err);
    return null;
  }
}

/**
 * Builds a portable public share URL that carries the exact customized report
 * while staying compact, fast, and completely safe for WhatsApp and email.
 * Optionally encodes current drill-down hierarchy and filters for full state preservation.
 */
export function buildShareUrl(
  dashboard: Dashboard,
  dataSource: DataSource,
  theme: 'dark' | 'light',
  drillDownStates?: Record<string, { path: { column: string; value: string }[]; levelIndex: number }>,
  widgetFilters?: Record<string, Record<string, any>>,
  activeFilters?: Record<string, any>,
  projectId?: string
): string {
  const origin = window.location.origin;
  // Strip trailing slashes, /view, /view.html, /index.html to ensure clean root URL on GitHub Pages
  const cleanPath = window.location.pathname
    .replace(/\/view(\.html)?\/?$/i, '')
    .replace(/\/index\.html$/i, '')
    .replace(/\/+$/, '');
  const basePath = `${origin}${cleanPath}`;

  // Preferred modern BI mode: direct project URL by unique ID with instant portable snapshot fallback
  const compact = compactDashboard(dashboard, theme, drillDownStates, widgetFilters, activeFilters, dataSource);
  const encoded = encodeSnapshot(compact);

  if (projectId) {
    let tunnelParam = '';
    try {
      const activeUrl = getActiveSupabaseUrl();
      if (activeUrl && activeUrl.startsWith('https://')) {
        tunnelParam = `&tunnel=${encodeURIComponent(activeUrl)}`;
      }
    } catch { /* ignore */ }
    return `${basePath}/?view=public&project=${encodeURIComponent(projectId)}${tunnelParam}&r=${encoded}`;
  }

  // Fallback portable snapshot URL
  return `${basePath}/?view=public&r=${encoded}`;
}

/**
 * Downloads a complete portable LENS BI package (.lensbi / .json)
 * containing 100% of dashboard layout, customized widgets, theme, AND raw data rows
 * so it can be imported seamlessly on any computer or deployed anywhere.
 */
export function downloadFullReportPackage(
  dashboard: Dashboard,
  dataSource: DataSource,
  theme: 'dark' | 'light',
  drillDownStates?: Record<string, { path: { column: string; value: string }[]; levelIndex: number }>,
  widgetFilters?: Record<string, Record<string, any>>,
  activeFilters?: Record<string, any>
): void {
  const data = {
    format: 'lens-bi-package',
    version: '2026.2',
    exportedAt: new Date().toISOString(),
    theme,
    dashboard,
    dataSource,
    drillDownStates: drillDownStates || {},
    widgetFilters: widgetFilters || {},
    activeFilters: activeFilters || {}
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = (dashboard.title || 'report').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  a.download = `lens_bi_${safeTitle}_complete_package.lensbi`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a JSON configuration file for deployment seeding
 */
export function downloadDeploymentConfig(
  dashboard: Dashboard,
  dataSource: DataSource,
  theme: 'dark' | 'light'
): void {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '2026.2',
    description: 'ملف التكوين الافتراضي للتقرير - يتم استخدامه عند رفع المشروع على الاستضافة',
    theme,
    dashboard,
    dataSource: {
      id: dataSource.id,
      fileName: dataSource.fileName,
      columns: dataSource.columns,
      rawRows: dataSource.rawRows || []
    },
    dataSourceSummary: {
      fileName: dataSource.fileName,
      rowCount: dataSource.rawRows?.length || 0,
      columns: dataSource.columns
    }
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lens_bi_${dashboard.id}_deployment_config.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
