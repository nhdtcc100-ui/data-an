-- ============================================================
-- Analytics Platform Database Schema - Enterprise BI
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. جدول مساحات العمل
CREATE TABLE IF NOT EXISTS public.workspaces (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  description  TEXT,
  settings     JSONB DEFAULT '{"theme": "system", "locale": "ar", "currency": "USD"}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول المشاريع واللوحات المستقلة (المزامنة الدائمة)
CREATE TABLE IF NOT EXISTS public.projects (
  id                TEXT PRIMARY KEY,
  workspace_id      UUID REFERENCES public.workspaces(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  category          VARCHAR(50) DEFAULT 'sales',
  icon              VARCHAR(20) DEFAULT '📊',
  color_accent      VARCHAR(30) DEFAULT 'sky',
  data_source_type  VARCHAR(50) DEFAULT 'excel_csv',
  google_sheet_url  TEXT,
  database_config   JSONB DEFAULT '{}'::jsonb,
  dashboard         JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_source       JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_filters    JSONB DEFAULT '{}'::jsonb,
  widget_filters    JSONB DEFAULT '{}'::jsonb,
  drill_down_states JSONB DEFAULT '{}'::jsonb,
  theme             VARCHAR(20) DEFAULT 'dark',
  is_public         BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول مصادر البيانات
CREATE TABLE IF NOT EXISTS public.data_sources (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  name            VARCHAR(200) NOT NULL,
  file_type       VARCHAR(50) NOT NULL DEFAULT 'excel',
  file_path       VARCHAR(600) NOT NULL DEFAULT '/storage/dataset.xlsx',
  parquet_path    VARCHAR(600),
  schema_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count       BIGINT NOT NULL DEFAULT 0,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  last_synced_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول المنتجات وسجلات البيانات التفصيلية
CREATE TABLE IF NOT EXISTS public.products (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_source_id        UUID REFERENCES public.data_sources(id) ON DELETE CASCADE,
  company_name          TEXT,
  location              TEXT,
  phone                 TEXT,
  product_code          TEXT,
  product_name_full     TEXT,
  product_name          TEXT,
  quantity              NUMERIC DEFAULT 0,
  unit_price            NUMERIC DEFAULT 0,
  discount              NUMERIC DEFAULT 0,
  total_price           NUMERIC DEFAULT 0,
  offer_duration        TEXT,
  offer_terms           TEXT,
  warranty              TEXT,
  department            TEXT,
  status                TEXT,
  extra_data            JSONB,
  row_index             INTEGER,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 5. جدول اللوحات العامة والمشتركة
CREATE TABLE IF NOT EXISTS public.dashboards (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id         UUID REFERENCES public.workspaces(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  data_source_id       UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  title                VARCHAR(200) NOT NULL DEFAULT 'لوحة تحليلات',
  description          TEXT,
  layout_config        JSONB NOT NULL DEFAULT '{"columns": 12, "rowHeight": 80, "responsive": true}'::jsonb,
  theme_config         JSONB NOT NULL DEFAULT '{"mode": "dark", "palette": "modern-blue"}'::jsonb,
  is_published         BOOLEAN DEFAULT FALSE,
  refresh_interval_sec INT DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 6. جدول سجل الرفع
CREATE TABLE IF NOT EXISTS public.upload_history (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,
  file_size      BIGINT,
  row_count      INTEGER,
  status         TEXT DEFAULT 'success',
  error_message  TEXT,
  uploaded_at    TIMESTAMPTZ DEFAULT NOW()
);

-- الفهارس لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON public.projects(is_active);
CREATE INDEX IF NOT EXISTS idx_data_sources_workspace ON public.data_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_data_source_id ON public.products(data_source_id);
CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_name);
CREATE INDEX IF NOT EXISTS idx_products_department ON public.products(department);
CREATE INDEX IF NOT EXISTS idx_products_total_price ON public.products(total_price);
CREATE INDEX IF NOT EXISTS idx_dashboards_workspace ON public.dashboards(workspace_id);

-- تفعيل أمان الصفوف (Row Level Security)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;

-- السياسات للوصول العام للمستخدمين المصرح لهم والزوار
DROP POLICY IF EXISTS "allow_all_workspaces" ON public.workspaces;
CREATE POLICY "allow_all_workspaces" ON public.workspaces FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_projects" ON public.projects;
CREATE POLICY "allow_all_projects" ON public.projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_data_sources" ON public.data_sources;
CREATE POLICY "allow_all_data_sources" ON public.data_sources FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_products" ON public.products;
CREATE POLICY "allow_all_products" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_dashboards" ON public.dashboards;
CREATE POLICY "allow_all_dashboards" ON public.dashboards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_upload_history" ON public.upload_history;
CREATE POLICY "allow_all_upload_history" ON public.upload_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- الصلاحيات لجميع الأدوار
GRANT ALL ON TABLE public.workspaces TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.projects TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.data_sources TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.dashboards TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.upload_history TO anon, authenticated, service_role;

-- مساحة العمل الافتراضية
INSERT INTO public.workspaces (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'Main Workspace', 'مساحة العمل التحليلية الرئيسية')
ON CONFLICT (id) DO NOTHING;

-- الإطلالات التحليلية
CREATE OR REPLACE VIEW public.v_company_summary AS
SELECT data_source_id, company_name, COUNT(*) AS product_count, SUM(total_price) AS total_revenue, AVG(unit_price) AS avg_unit_price, SUM(quantity) AS total_quantity
FROM public.products GROUP BY data_source_id, company_name;

CREATE OR REPLACE VIEW public.v_department_summary AS
SELECT data_source_id, department, COUNT(*) AS product_count, SUM(total_price) AS total_revenue, SUM(quantity) AS total_quantity
FROM public.products GROUP BY data_source_id, department;
