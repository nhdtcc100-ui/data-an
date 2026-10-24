// ============================================================
// Supabase Client - dynamic runtime configuration
// Supports local Docker (http://127.0.0.1:8000), Cloudflare Tunnel,
// URL parameter (?tunnel=https://...), localStorage, and supabase-config.json
// ============================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'LENS_SUPABASE_CUSTOM_URL';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyNjY0NzY1LCJleHAiOjE5NTAzNDQ3NjV9.7HBWC-YC_7L400M5lDIEEVod0BKyUNRKGyveE6_Zdzw';

function getInitialUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      // 1. Check URL query parameters (?tunnel=... or ?supabase_url=...)
      const sp = new URLSearchParams(window.location.search);
      const hp = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const fromParam = sp.get('tunnel') || hp.get('tunnel') || sp.get('supabase_url') || hp.get('supabase_url');
      if (fromParam && fromParam.startsWith('http')) {
        const clean = fromParam.trim().replace(/\/+$/, '');
        localStorage.setItem(STORAGE_KEY, clean);
        return clean;
      }

      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      // 2. On localhost, always prioritize direct local Docker unless explicitly overridden by ?tunnel=
      if (isLocal && !fromParam) {
        return 'http://127.0.0.1:8000';
      }

      // 3. Check localStorage (ignore dead/stale quick tunnels)
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.startsWith('http')) {
        if (saved.includes('ministries-bill-palestinian-combinations')) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          return saved.trim().replace(/\/+$/, '');
        }
      }

      if (isLocal) {
        return 'http://127.0.0.1:8000';
      }
    }
  } catch { /* ignore */ }

  return import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:8000';
}

function createSupabaseClientOptions() {
  return {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `sb-lens-bi-anon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      }
    }
  };
}

let activeUrl = getInitialUrl();
let activeClient: SupabaseClient = createClient(activeUrl, SUPABASE_ANON_KEY, createSupabaseClientOptions());

export function getActiveSupabaseUrl(): string {
  return activeUrl;
}

export function setSupabaseUrl(newUrl: string): SupabaseClient {
  const clean = newUrl.trim().replace(/\/+$/, '');
  if (clean === activeUrl && activeClient) {
    return activeClient;
  }
  activeUrl = clean;
  try {
    localStorage.setItem(STORAGE_KEY, clean);
  } catch { /* ignore */ }
  activeClient = createClient(clean, SUPABASE_ANON_KEY, createSupabaseClientOptions());
  return activeClient;
}

/**
 * Auto-detect and fetch runtime config from /supabase-config.json
 * If running on GitHub Pages (HTTPS) and no valid HTTPS tunnel is set,
 * this fetches the active tunnel URL automatically without requiring rebuild.
 */
let initPromise: Promise<string> | null = null;

export function initSupabaseFromConfig(): Promise<string> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof window === 'undefined') return activeUrl;

      // 1. Check if URL param explicitly provided
      const sp = new URLSearchParams(window.location.search);
      const hp = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const explicit = sp.get('tunnel') || hp.get('tunnel') || sp.get('supabase_url') || hp.get('supabase_url');
      if (explicit && explicit.startsWith('http')) {
        setSupabaseUrl(explicit);
        return activeUrl;
      }

      // 2. Fetch supabase-config.json from relative base URL
      const baseUrl = import.meta.env.BASE_URL || '/';
      const configUrl = `${baseUrl.replace(/\/+$/, '')}/supabase-config.json?_t=${Date.now()}`;
      const res = await fetch(configUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.supabaseUrl && data.supabaseUrl.startsWith('http')) {
          const isHttps = window.location.protocol === 'https:';
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          // On HTTPS (GitHub Pages), only accept HTTPS tunnel URLs to avoid Mixed Content block
          if (isHttps) {
            if (data.supabaseUrl.startsWith('https://')) {
              setSupabaseUrl(data.supabaseUrl);
              return data.supabaseUrl;
            }
          } else if (!isLocal) {
            // On non-local HTTP
            if (data.supabaseUrl) {
              setSupabaseUrl(data.supabaseUrl);
              return data.supabaseUrl;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[supabaseClient] Could not fetch runtime config:', err);
    }
    return activeUrl;
  })();

  return initPromise;
}

// Transparent Proxy so all existing `supabase.from(...)`, `supabase.storage`, etc. route to activeClient
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const val = (activeClient as any)[prop];
    if (typeof val === 'function') {
      return val.bind(activeClient);
    }
    return val;
  }
});

export const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

export type DataSourceRecord = {
  id: string;
  workspace_id: string;
  name: string;
  source_type: string;
  file_name: string | null;
  file_size: number | null;
  row_count: number;
  columns_meta: any;
  created_at: string;
  updated_at: string;
};

export type ProductRecord = {
  id: string;
  data_source_id: string;
  company_name: string | null;
  location: string | null;
  phone: string | null;
  product_code: string | null;
  product_name_full: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  offer_duration: string | null;
  offer_terms: string | null;
  warranty: string | null;
  department: string | null;
  status: string | null;
  extra_data: any;
  row_index: number;
};

export type UploadHistoryRecord = {
  id: string;
  data_source_id: string;
  file_name: string;
  file_size: number | null;
  row_count: number | null;
  status: string;
  error_message: string | null;
  uploaded_at: string;
};
