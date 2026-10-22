-- ==============================================================================
-- Enterprise BI Platform - PostgreSQL Database Schema & Realistic Seed Data
-- Architecture: Multi-tenant Workspace Isolation with RBAC & Parquet Ingestion
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean existing tables if needed
DROP TABLE IF EXISTS report_share_links CASCADE;
DROP TABLE IF EXISTS widgets CASCADE;
DROP TABLE IF EXISTS dashboards CASCADE;
DROP TABLE IF EXISTS data_sources CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- 1. جدول مساحات العمل (Workspaces)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول المستخدمين (Users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول أعضاء مساحات العمل والأدوار (Workspace Members & RBAC)
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, user_id)
);

-- 4. جدول مصادر البيانات وملفات الـ Parquet (Data Sources)
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('excel', 'csv')),
    file_path VARCHAR(500) NOT NULL,
    parquet_path VARCHAR(500) NOT NULL,
    schema_metadata JSONB NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. جدول لوحات التحكم والتقارير (Dashboards)
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    layout_config JSONB NOT NULL DEFAULT '{"columns": 12, "rowHeight": 80}',
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. جدول عناصر اللوحة والمخططات البيانية (Widgets)
CREATE TABLE widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
    title VARCHAR(150) NOT NULL,
    widget_type VARCHAR(50) NOT NULL CHECK (widget_type IN ('bar', 'line', 'area', 'pie', 'kpi', 'pivot', 'slicer')),
    config JSONB NOT NULL,
    layout JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. جدول روابط المشاركة المشفرة (Report Share Links)
CREATE TABLE report_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    public_token VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. فهارس تحسين أداء الاستعلامات وسرعة الفرز (Performance Indexes)
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_data_sources_workspace ON data_sources(workspace_id);
CREATE INDEX idx_dashboards_workspace ON dashboards(workspace_id);
CREATE INDEX idx_widgets_dashboard ON widgets(dashboard_id);
CREATE INDEX idx_share_links_token ON report_share_links(public_token);

-- ==============================================================================
-- Realistic Seed Data (بيانات تجريبية واقعية للمنصة)
-- ==============================================================================

-- مستخدم رئيسي افتراضي (Password: Pass123! hashed with bcrypt)
INSERT INTO users (id, email, password_hash, full_name)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin@enterprise-bi.internal',
    '$2b$10$wKz0b0rU2YyZt1l1i5R4qOGg4ZzHkJN1uI8Y9p.V1gXv7B6g3C4Z.',
    'مصطفى كاظم'
);

-- مساحات عمل قيادية
INSERT INTO workspaces (id, name, description)
VALUES 
(
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'قطاع المبيعات والعمليات الإقليمية',
    'مساحة عمل مخصصة لمتابعة المبيعات الإقليمية، أداء الفروع، وهوامش الربح الفصلية 2026'
),
(
    'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b33',
    'الإدارة المالية والاستثمار',
    'لوحات مراقبة السيولة النقدية، المصروفات التشغيلية، ومؤشرات العائد على الاستثمار'
);

-- تعيين العضوية والصلاحيات (Owner)
INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES 
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'owner'),
('b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'owner');

-- مصدر بيانات مبيعات الربع السنوي
INSERT INTO data_sources (id, workspace_id, name, file_type, file_path, parquet_path, schema_metadata, row_count, file_size_bytes)
VALUES (
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'سجلات المبيعات والعمليات 2026.xlsx',
    'excel',
    '/storage/workspaces/b1eebc99/raw/sales_data_2026.xlsx',
    '/storage/workspaces/b1eebc99/parquet/sales_data_2026.parquet',
    '{
      "sheets": [
        {
          "name": "المبيعات الإقليمية",
          "rowCount": 125400,
          "columns": [
            {"name": "المنطقة", "type": "string"},
            {"name": "الفرع", "type": "string"},
            {"name": "الشهر", "type": "string"},
            {"name": "إجمالي_المبيعات", "type": "number"},
            {"name": "صافي_الربح", "type": "number"},
            {"name": "الكمية_المباعة", "type": "number"},
            {"name": "نسبة_الخصم", "type": "number"},
            {"name": "تاريخ_المعاملة", "type": "date"}
          ]
        }
      ]
    }'::jsonb,
    125400,
    14820000
);

-- لوحة تحكم تنفيذية معتمدة
INSERT INTO dashboards (id, workspace_id, title, description, layout_config, is_published)
VALUES (
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'لوحة المؤشرات التنفيذية للربع السنوي',
    'تحليل المبيعات الإقليمية، تدفق الإيرادات، وهوامش الربحية التشغيلية عبر الفروع',
    '{"columns": 12, "rowHeight": 85}'::jsonb,
    TRUE
);

-- عناصر اللوحة المعتمدة (Widgets)
INSERT INTO widgets (id, dashboard_id, data_source_id, title, widget_type, config, layout)
VALUES 
-- 1. KPI 1: إجمالي الإيرادات
(
    'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e61',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'إجمالي الإيرادات المحققة',
    'kpi',
    '{"metric": "إجمالي_المبيعات", "aggregation": "SUM", "format": "currency", "prefix": "$", "comparison": "+18.4% مقارنة بالهدف"}'::jsonb,
    '{"x": 0, "y": 0, "w": 4, "h": 2}'::jsonb
),
-- 2. KPI 2: صافي الأرباح
(
    'e2eebc99-9c0b-4ef8-bb6d-6bb9bd380e62',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'صافي الأرباح التشغيلية',
    'kpi',
    '{"metric": "صافي_الربح", "aggregation": "SUM", "format": "currency", "prefix": "$", "comparison": "+12.1% نمو سنوي"}'::jsonb,
    '{"x": 4, "y": 0, "w": 4, "h": 2}'::jsonb
),
-- 3. Slicer: فلتر المناطق
(
    'e3eebc99-9c0b-4ef8-bb6d-6bb9bd380e63',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'تصفية حسب المنطقة',
    'slicer',
    '{"dimension": "المنطقة", "multiSelect": true, "defaultValue": "الكل"}'::jsonb,
    '{"x": 8, "y": 0, "w": 4, "h": 2}'::jsonb
),
-- 4. Bar Chart: توزيع المبيعات حسب المناطق
(
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380e64',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'حجم المبيعات حسب المناطق الإقليمية',
    'bar',
    '{"xAxis": "المنطقة", "yAxis": "إجمالي_المبيعات", "aggregation": "SUM", "color": "#0ea5e9"}'::jsonb,
    '{"x": 0, "y": 2, "w": 6, "h": 4}'::jsonb
),
-- 5. Line/Area Chart: اتجاه الأرباح الشهرية
(
    'e5eebc99-9c0b-4ef8-bb6d-6bb9bd380e65',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c44',
    'مسار الإيرادات الشهرية',
    'area',
    '{"xAxis": "الشهر", "yAxis": "صافي_الربح", "aggregation": "SUM", "color": "#10b981", "smooth": true}'::jsonb,
    '{"x": 6, "y": 2, "w": 6, "h": 4}'::jsonb
);

-- رابط مشاركة عام مشفر جاهز للتجربة
INSERT INTO report_share_links (id, dashboard_id, public_token, is_active, expires_at)
VALUES (
    'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380f77',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d55',
    'bi-exec-q3-2026-public-demo',
    TRUE,
    CURRENT_TIMESTAMP + INTERVAL '30 days'
);
