-- ==============================================================================
-- Enterprise BI & Data Analytics Platform - Supabase PostgreSQL Schema
-- منصة ذكاء الأعمال وتحليل البيانات المتقدمة
-- ==============================================================================

-- 1. تفعيل الإضافات الأساسية
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- تنظيف الجداول إن وجدت مسبقاً
DROP VIEW IF EXISTS v_category_distribution CASCADE;
DROP VIEW IF EXISTS v_regional_performance CASCADE;
DROP VIEW IF EXISTS v_monthly_sales_trend CASCADE;
DROP TABLE IF EXISTS analytics_kpis CASCADE;
DROP TABLE IF EXISTS analytics_sales_records CASCADE;
DROP TABLE IF EXISTS report_share_links CASCADE;
DROP TABLE IF EXISTS widgets CASCADE;
DROP TABLE IF EXISTS dashboards CASCADE;
DROP TABLE IF EXISTS data_sources CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- دالة تلقائية لتحديث توقيت التعديل (updated_at)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. جداول الهيكل الأساسي لمنصة ذكاء الأعمال (Core Platform Architecture)
-- ==============================================================================

-- جدول مساحات العمل (Workspaces)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{"theme": "system", "locale": "ar", "currency": "USD"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_workspaces_updated
BEFORE UPDATE ON workspaces
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- جدول أعضاء مساحات العمل والصلاحيات (Workspace Members & RBAC)
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, user_id)
);

-- جدول المشاريع المستقلة ولوحات ذكاء الأعمال (Projects)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'sales',
    icon VARCHAR(20) DEFAULT '📊',
    color_accent VARCHAR(30) DEFAULT 'sky',
    data_source_type VARCHAR(50) DEFAULT 'excel_csv',
    google_sheet_url TEXT,
    database_config JSONB DEFAULT '{}'::jsonb,
    dashboard JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_source JSONB NOT NULL DEFAULT '{}'::jsonb,
    active_filters JSONB DEFAULT '{}'::jsonb,
    widget_filters JSONB DEFAULT '{}'::jsonb,
    drill_down_states JSONB DEFAULT '{}'::jsonb,
    theme VARCHAR(20) DEFAULT 'dark',
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_projects" ON projects;
CREATE POLICY "allow_all_projects" ON projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE projects TO anon, authenticated, service_role;

CREATE TRIGGER trg_projects_updated
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- جدول مصادر البيانات وملفات الرفع (Data Sources)
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('excel', 'csv', 'parquet', 'database', 'api')),
    file_path VARCHAR(600) NOT NULL,
    parquet_path VARCHAR(600),
    schema_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    row_count BIGINT NOT NULL DEFAULT 0,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_data_sources_updated
BEFORE UPDATE ON data_sources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- جدول لوحات المعلومات والتقارير (Dashboards)
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    layout_config JSONB NOT NULL DEFAULT '{"columns": 12, "rowHeight": 80, "responsive": true}'::jsonb,
    theme_config JSONB NOT NULL DEFAULT '{"mode": "dark", "palette": "modern-blue"}'::jsonb,
    is_published BOOLEAN DEFAULT FALSE,
    refresh_interval_sec INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_dashboards_updated
BEFORE UPDATE ON dashboards
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- جدول عناصر الرسوم البيانية والتحليلات (Dashboard Widgets)
CREATE TABLE widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    widget_type VARCHAR(50) NOT NULL CHECK (
        widget_type IN ('bar', 'line', 'area', 'pie', 'doughnut', 'kpi', 'pivot', 'slicer', 'table', 'scatter', 'funnel', 'gauge')
    ),
    config JSONB NOT NULL,
    layout JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 6, "h": 4}'::jsonb,
    query_definition JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_widgets_updated
BEFORE UPDATE ON widgets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- جدول مشاركة التقارير بروابط عامة مشفرة (Public & Protected Share Links)
CREATE TABLE report_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    public_token VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    views_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 3. جداول بيانات التحليلات الفعلية (Analytical Fact & Dimension Tables)
-- ==============================================================================

-- جدول سجلات المبيعات والعمليات التفصيلية (Analytics Sales Records)
CREATE TABLE analytics_sales_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    region VARCHAR(100) NOT NULL,
    branch_name VARCHAR(150) NOT NULL,
    product_category VARCHAR(100) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    customer_segment VARCHAR(80) NOT NULL CHECK (customer_segment IN ('Corporate', 'Enterprise', 'SMB', 'Individual')),
    sales_channel VARCHAR(80) NOT NULL CHECK (sales_channel IN ('Direct Sales', 'Online Store', 'Partners', 'Distributors')),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    total_sales NUMERIC(14, 2) NOT NULL CHECK (total_sales >= 0),
    cost_amount NUMERIC(14, 2) NOT NULL CHECK (cost_amount >= 0),
    net_profit NUMERIC(14, 2) GENERATED ALWAYS AS (total_sales - cost_amount) STORED,
    profit_margin_pct NUMERIC(6, 2) GENERATED ALWAYS AS (
        CASE WHEN total_sales > 0 THEN ROUND(((total_sales - cost_amount) / total_sales) * 100, 2) ELSE 0 END
    ) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- جدول أهداف ومؤشرات الأداء المستهدفة (KPI Targets & Performance)
CREATE TABLE analytics_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    kpi_name VARCHAR(150) NOT NULL,
    fiscal_year INT NOT NULL,
    fiscal_quarter VARCHAR(10) NOT NULL,
    target_value NUMERIC(16, 2) NOT NULL,
    actual_value NUMERIC(16, 2) NOT NULL DEFAULT 0,
    unit VARCHAR(30) DEFAULT '$',
    status VARCHAR(30) DEFAULT 'On Track',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. إطلالات الفرز والتجميع التحليلي السريع (Analytical Materialized Views)
-- ==============================================================================

-- مسار المبيعات والأرباح الشهرية
CREATE OR REPLACE VIEW v_monthly_sales_trend AS
SELECT 
    workspace_id,
    TO_CHAR(transaction_date, 'YYYY-MM') AS month_key,
    DATE_TRUNC('month', transaction_date)::DATE AS month_date,
    COUNT(id) AS total_orders,
    SUM(quantity) AS total_units_sold,
    SUM(total_sales) AS total_revenue,
    SUM(cost_amount) AS total_cost,
    SUM(net_profit) AS total_net_profit,
    ROUND(AVG(profit_margin_pct), 2) AS avg_profit_margin_pct
FROM analytics_sales_records
GROUP BY workspace_id, TO_CHAR(transaction_date, 'YYYY-MM'), DATE_TRUNC('month', transaction_date);

-- ملخص الأداء والمقارنة حسب المناطق
CREATE OR REPLACE VIEW v_regional_performance AS
SELECT 
    workspace_id,
    region,
    COUNT(DISTINCT branch_name) AS branch_count,
    COUNT(id) AS transactions_count,
    SUM(total_sales) AS region_revenue,
    SUM(net_profit) AS region_profit,
    ROUND((SUM(net_profit) / NULLIF(SUM(total_sales), 0)) * 100, 2) AS region_profit_margin_pct
FROM analytics_sales_records
GROUP BY workspace_id, region;

-- أداء فئات المنتجات ونسبتها
CREATE OR REPLACE VIEW v_category_distribution AS
SELECT 
    workspace_id,
    product_category,
    COUNT(id) AS orders_count,
    SUM(quantity) AS units_sold,
    SUM(total_sales) AS category_revenue,
    SUM(net_profit) AS category_profit
FROM analytics_sales_records
GROUP BY workspace_id, product_category;

-- ==============================================================================
-- 5. فهارس تسريع الاستعلامات والأداء (High Performance Indexes)
-- ==============================================================================
CREATE INDEX idx_sales_workspace_date ON analytics_sales_records(workspace_id, transaction_date DESC);
CREATE INDEX idx_sales_region ON analytics_sales_records(region);
CREATE INDEX idx_sales_category ON analytics_sales_records(product_category);
CREATE INDEX idx_sales_channel ON analytics_sales_records(sales_channel);
CREATE INDEX idx_dashboards_ws ON dashboards(workspace_id);
CREATE INDEX idx_widgets_dash ON widgets(dashboard_id);
CREATE INDEX idx_share_token ON report_share_links(public_token);

-- ==============================================================================
-- 6. تفعيل خاصية التحديث المباشر لسوبابيس (Supabase Realtime)
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE dashboards;
ALTER PUBLICATION supabase_realtime ADD TABLE widgets;
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_sales_records;
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_kpis;

-- تفعيل التكرار الكامل لدعم تحديثات Realtime
ALTER TABLE dashboards REPLICA IDENTITY FULL;
ALTER TABLE widgets REPLICA IDENTITY FULL;
ALTER TABLE analytics_sales_records REPLICA IDENTITY FULL;
ALTER TABLE analytics_kpis REPLICA IDENTITY FULL;

-- ==============================================================================
-- 7. إنشاء حاويات التخزين السحابي لسوبابيس (Supabase Storage Buckets)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('datasets', 'datasets', true, 104857600, ARRAY['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream', 'application/json']),
    ('exports', 'exports', true, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'text/csv'])
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 8. إدراج بيانات تجريبية واقعية وضخمة للتحليلات (Realistic Analytics Seed Data)
-- ==============================================================================

-- مساحة العمل النموذجية
INSERT INTO workspaces (id, name, description)
VALUES (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'القطاع الإقليمي للتحليلات والعمليات الذكية 2026',
    'منصة التحليلات التنفيذية الموحدة لمراقبة المبيعات، التدفقات النقدية وهوامش الربحية التشغيلية'
);

-- ربط المدير بمساحة العمل
INSERT INTO workspace_members (workspace_id, user_id, user_email, role)
VALUES (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin@enterprise-bi.internal',
    'owner'
);

-- مصدر البيانات النموذجي
INSERT INTO data_sources (id, workspace_id, name, file_type, file_path, parquet_path, schema_metadata, row_count, file_size_bytes)
VALUES (
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'سجلات مبيعات الفروع الإقليمية 2026.xlsx',
    'excel',
    '/storage/workspaces/b1eebc99/raw/regional_sales_2026.xlsx',
    '/storage/workspaces/b1eebc99/parquet/regional_sales_2026.parquet',
    '{"sheets": [{"name": "المبيعات", "rowCount": 150000}]}'::jsonb,
    150000,
    18500000
);

-- لوحة التحكم التنفيذية الأولى
INSERT INTO dashboards (id, workspace_id, title, description, is_published)
VALUES (
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'لوحة المؤشرات التنفيذية للربع السنوي (Executive BI Dashboard)',
    'تحليل شمولي لمؤشرات الأداء، توزيع الإيرادات حسب المناطق، وهوامش الربح الفصلية',
    TRUE
);

-- مؤشرات الأداء المستهدفة (KPIs)
INSERT INTO analytics_kpis (workspace_id, kpi_name, fiscal_year, fiscal_quarter, target_value, actual_value, unit, status)
VALUES
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'إجمالي الإيرادات السنوية', 2026, 'Q3', 15000000.00, 16840500.00, '$', 'Exceeded'),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'صافي الأرباح التشغيلية', 2026, 'Q3', 4500000.00, 5120300.00, '$', 'Exceeded'),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'متوسط هامش الربح', 2026, 'Q3', 28.00, 30.40, '%', 'On Track'),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'معدل رضا العملاء (CSAT)', 2026, 'Q3', 90.00, 94.50, '%', 'Exceeded');

-- بيانات المعاملات التحليلية الواقعية (سجلات المبيعات والعمليات)
INSERT INTO analytics_sales_records 
    (workspace_id, transaction_date, region, branch_name, product_category, product_name, customer_segment, sales_channel, quantity, unit_price, discount_pct, total_sales, cost_amount)
VALUES
    -- منطقة الرياض
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-01-15', 'منطقة الرياض', 'فرع العليا المركزي', 'أجهزة إلكترونية', 'حاسوب محمول فائق الأداء Pro X', 'Enterprise', 'Direct Sales', 25, 2400.00, 5.00, 57000.00, 42000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-01-22', 'منطقة الرياض', 'فرع النخيل الرقمي', 'حلول برمجية وسحابية', 'اشتراك المنصة السنوية Enterprise Cloud', 'Corporate', 'Direct Sales', 12, 5000.00, 10.00, 54000.00, 16000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-02-10', 'منطقة الرياض', 'فرع العليا المركزي', 'شاشات وأنظمة عرض', 'شاشات ذكية تفاعلية 75 بوصة', 'SMB', 'Partners', 18, 1800.00, 0.00, 32400.00, 22000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-03-05', 'منطقة الرياض', 'فرع الملقا المتطور', 'حلول أمن المعلومات', 'أنظمة الحماية السيبرانية المتكاملة', 'Enterprise', 'Direct Sales', 8, 12500.00, 8.00, 92000.00, 45000.00),

    -- منطقة مكة المكرمة وجدة
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-01-18', 'منطقة الغربية (جدة)', 'فرع التحلية الرئيسي', 'أجهزة إلكترونية', 'محطات عمل البيانات الذكية Workstation Z', 'Corporate', 'Online Store', 30, 2100.00, 5.00, 59850.00, 41000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-02-14', 'منطقة الغربية (جدة)', 'فرع الروضة التقني', 'حلول برمجية وسحابية', 'باقة تحليلات الأعمال التنبؤية AI BI', 'SMB', 'Online Store', 45, 1200.00, 10.00, 48600.00, 15000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-03-12', 'منطقة الغربية (جدة)', 'فرع التحلية الرئيسي', 'خوادم وشبكات', 'خوادم التخزين السحابي عالي السرعة', 'Enterprise', 'Direct Sales', 6, 18000.00, 5.00, 102600.00, 71000.00),

    -- المنطقة الشرقية (الدمام والخبر)
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-01-28', 'المنطقة الشرقية (الخبر)', 'فرع الكورنيش للأعمال', 'حلول أمن المعلومات', 'بوابة التشفير المؤسسية', 'Corporate', 'Partners', 15, 4500.00, 5.00, 64125.00, 31000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-02-20', 'المنطقة الشرقية (الدمام)', 'فرع الشاطئ التقني', 'أجهزة إلكترونية', 'حاسوب محمول فائق الأداء Pro X', 'Enterprise', 'Direct Sales', 40, 2400.00, 10.00, 86400.00, 62000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-03-25', 'المنطقة الشرقية (الخبر)', 'فرع الكورنيش للأعمال', 'حلول برمجية وسحابية', 'اشتراك المنصة السنوية Enterprise Cloud', 'Enterprise', 'Distributors', 20, 5000.00, 12.00, 88000.00, 28000.00),

    -- منطقة الخليج (دبي والدوحة)
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-02-05', 'دبي والعمليات الدولية', 'مركز دبي المالي العالمي (DIFC)', 'حلول برمجية وسحابية', 'حزمة التحليلات المالية المتقدمة FinTech', 'Enterprise', 'Direct Sales', 10, 15000.00, 0.00, 150000.00, 48000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-03-18', 'دبي والعمليات الدولية', 'فرع تيك بارك دبي', 'خوادم وشبكات', 'نظم البيانات الضخمة BigData Clusters', 'Corporate', 'Partners', 4, 32000.00, 5.00, 121600.00, 78000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-04-10', 'منطقة الرياض', 'فرع النخيل الرقمي', 'حلول برمجية وسحابية', 'تراخيص الذكاء الاصطناعي التوليدي BI-GenAI', 'Enterprise', 'Direct Sales', 15, 8000.00, 5.00, 114000.00, 32000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-04-20', 'منطقة الغربية (جدة)', 'فرع التحلية الرئيسي', 'أجهزة إلكترونية', 'أجهزة لوحية ميدانية لفرق المبيعات', 'SMB', 'Online Store', 60, 850.00, 0.00, 51000.00, 36000.00),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2026-05-15', 'المنطقة الشرقية (الخبر)', 'فرع الكورنيش للأعمال', 'شاشات وأنظمة عرض', 'مصفوفة جدران الفيديو Video Walls 4K', 'Corporate', 'Partners', 8, 11000.00, 10.00, 79200.00, 52000.00);

-- ربط الرسوم البيانية النموذجية في اللوحة (Widgets)
INSERT INTO widgets (id, dashboard_id, data_source_id, title, widget_type, config, layout)
VALUES
(
    'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e61',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'إجمالي الإيرادات المحققة',
    'kpi',
    '{"metric": "total_sales", "aggregation": "SUM", "format": "currency", "prefix": "$", "comparison": "+18.4% نمو إيجابي"}'::jsonb,
    '{"x": 0, "y": 0, "w": 4, "h": 2}'::jsonb
),
(
    'e2eebc99-9c0b-4ef8-bb6d-6bb9bd380e62',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'صافي الأرباح التشغيلية',
    'kpi',
    '{"metric": "net_profit", "aggregation": "SUM", "format": "currency", "prefix": "$", "comparison": "+30.4% هامش ربح"}'::jsonb,
    '{"x": 4, "y": 0, "w": 4, "h": 2}'::jsonb
),
(
    'e3eebc99-9c0b-4ef8-bb6d-6bb9bd380e63',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'تصفية حسب المنطقة الجغرافية',
    'slicer',
    '{"dimension": "region", "multiSelect": true, "defaultValue": "الكل"}'::jsonb,
    '{"x": 8, "y": 0, "w": 4, "h": 2}'::jsonb
),
(
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380e64',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'مقارنة الإيرادات والأرباح عبر المناطق',
    'bar',
    '{"xAxis": "region", "metrics": ["total_sales", "net_profit"], "aggregation": "SUM"}'::jsonb,
    '{"x": 0, "y": 2, "w": 7, "h": 5}'::jsonb
),
(
    'e5eebc99-9c0b-4ef8-bb6d-6bb9bd380e65',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'توزيع المبيعات حسب فئات المنتجات',
    'pie',
    '{"dimension": "product_category", "metric": "total_sales", "aggregation": "SUM"}'::jsonb,
    '{"x": 7, "y": 2, "w": 5, "h": 5}'::jsonb
),
(
    'e6eebc99-9c0b-4ef8-bb6d-6bb9bd380e66',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'مسار الإيرادات الشهرية والتدفق المالي',
    'area',
    '{"xAxis": "month_key", "metric": "total_revenue", "view": "v_monthly_sales_trend", "smooth": true}'::jsonb,
    '{"x": 0, "y": 7, "w": 12, "h": 4}'::jsonb
);

-- رابط مشاركة عام متاح
INSERT INTO report_share_links (dashboard_id, public_token, is_active)
VALUES ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55', 'bi-analytics-q3-2026-executive', true);

-- -----------------------------------------------------------------------------
-- Supabase Storage: سلة تخزين ملفات المشاريع الخام (Excel, CSV, Google Sheets Snapshots)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'project-files',
    'project-files',
    true,
    52428800, -- 50MB
    ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/json',
        'text/plain'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- جدول سجل ملفات المشاريع المخزنة
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    mime_type TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_project_files_proj ON project_files(project_id);

-- سياسة الأمان RLS لسلة التخزين (قراءة ورفع متاح لبيئة التطوير والمنصة)
CREATE POLICY "Public Read project-files" ON storage.objects
    FOR SELECT USING (bucket_id = 'project-files');

CREATE POLICY "Public Insert project-files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "Public Delete project-files" ON storage.objects
    FOR DELETE USING (bucket_id = 'project-files');

