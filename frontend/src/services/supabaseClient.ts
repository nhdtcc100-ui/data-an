// ============================================================
// Supabase Client - configurable via VITE_SUPABASE_URL env var
// Local default: http://localhost:8000
// Production: set VITE_SUPABASE_URL to Cloudflare Tunnel URL
// ============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8000';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyNjY0NzY1LCJleHAiOjE5NTAzNDQ3NjV9.7HBWC-YC_7L400M5lDIEEVod0BKyUNRKGyveE6_Zdzw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


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
