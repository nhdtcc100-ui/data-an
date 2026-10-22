# دليل المنصة التحليلية الشامل (Analytics Platform - Complete Documentation)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Apache ECharts](https://img.shields.io/badge/Apache_ECharts-5.5-e43961.svg)](https://echarts.apache.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-e0234e.svg)](https://nestjs.com/)
[![DuckDB](https://img.shields.io/badge/DuckDB-OLAP_Engine-fff000.svg)](https://duckdb.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](https://www.docker.com/)

---

## 📌 نبذة عن المشروع

منصة تحليلات بيانات تفاعلية سحابية تجمع بين **قوة التحكم واستعلامات المقاييس الخاصة بـ Power BI** و**سلاسة المشاركة والتضمين الخاصة بـ Looker Studio**. تم تصميم المنصة بمعمارية فائقة الأداء تعتمد على المعالجة العمودية في الذاكرة (In-Memory Columnar Processing) عبر **DuckDB** لتوفير استجابة شبه لحظية (< 50ms) للرسوم البيانية واللوحات التفاعلية الكبيرة.

---

## 🏗️ المعمارية التقنية (Tech Stack)

| الطبقة | التقنية المستخدمة | الدور الوظيفي |
|---|---|---|
| **الواجهة الأمامية (Frontend)** | React 19, TypeScript, Tailwind CSS, Apache ECharts, react-grid-layout | واجهة سحب وإفلات، رسوم بيانية تفاعلية، تصفية متقاطعة (Cross-filtering)، وتصميم متجاوب بالكامل (RTL). |
| **الخلفية (Backend)** | Node.js (NestJS), TypeScript | بنية معمارية معيارية (Modular Clean Architecture) تدعم Dependency Injection والتحقق الصارم من المدخلات. |
| **محرك التحليلات (Analytics Engine)** | DuckDB (Embedded OLAP) | معالجة عمودية فائقة السرعة لملفات Parquet و Excel في أجزاء من الثانية دون إجهاد قاعدة البيانات التشغيلية. |
| **قواعد البيانات (Database)** | PostgreSQL 16 | إدارة الكيانات العلائقية، المستخدمين، مساحات العمل، بيانات تكوين اللوحات والودجات، وروابط المشاركة. |
| **التخزين (Storage)** | AWS S3 / MinIO | تخزين الملفات الأصلية (Excel/CSV) ومخزن الـ Parquet المعالج عمودياً. |
| **الحاويات والنشر (Deployment)** | Docker, Docker Compose, Nginx | نشر متعدد الخدمات مع Proxy عكسي، ضغط Gzip، وإدارة أحجام البيانات المشتركة. |

---

## 📂 هيكل المشروع (Directory Structure)

```text
analytics-platform/
├── frontend/                     # تطبيقات الواجهة الأمامية (React + Vite + ECharts)
│   ├── src/
│   │   ├── components/           # المكونات الأساسية (Canvas, Charts, Filters, Layout)
│   │   │   ├── canvas/           # DashboardCanvas, WidgetContainer
│   │   │   ├── charts/           # EChartWrapper, KpiWidget, PivotTableWidget
│   │   │   ├── filters/          # SlicerWidget (Interactive Filters)
│   │   │   └── layout/           # Header, Navigation
│   │   ├── features/             # وحدات المنطق والوظائف
│   │   │   ├── dashboard-builder/# DataPanel, VisualizationsPanel, DashboardStore
│   │   │   ├── file-upload/      # Dropzone (Excel Ingestion)
│   │   │   ├── public-viewer/    # PublicReportViewer (Looker-style Viewer)
│   │   │   ├── share/            # ShareModal (Token generation & iframe embed)
│   │   │   └── workspace/        # WorkspaceList (Workspaces & Dashboards)
│   │   ├── services/             # بوابات الاتصال بالخلفية (apiGateway)
│   │   ├── types/                # تعريفات TypeScript (dashboard, dataSource)
│   │   ├── App.tsx               # المكون الجذري الجامع لجميع الشاشات
│   │   └── main.tsx              # نقطة الانطلاق
│   ├── nginx.conf                # إعدادات Nginx للإنتاج والـ Reverse Proxy
│   └── Dockerfile                # بناء متعدد المراحل (Multi-stage build)
├── backend/                      # خدمات الخلفية ومحرك الاستعلامات (NestJS + DuckDB)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/             # المصادقة وعزل الصلاحيات (MultiTenantWorkspaceGuard)
│   │   │   ├── data-ingestion/   # معالجة الملفات وتحويلها لـ Parquet واستخراج المخطط
│   │   │   ├── query-engine/     # بناء وتنفيذ استعلامات DuckDB (Dynamic SQL Builder)
│   │   │   └── share/            # توليد وفحص الروابط العامة المشفرة
│   │   ├── app.module.ts         # الموديول الرئيسي
│   │   └── main.ts               # تشغيل خادم NestJS وضبط حدود الحزم
│   └── Dockerfile                # صورة Docker الإنتاجية مع دعم DuckDB Native C++
├── docker/                       # نصوص إعداد قواعد البيانات والتهيئة
│   └── init-db.sql               # مخطط الجداول، الفهارس، والبيانات التجريبية الواقعية
├── tests/                        # اختبارات التكامل والتحقق الآلي
│   └── system-integration-test.mjs # سكريبت الفحص الشامل لجميع المكونات
├── docker-compose.yml            # ملف التنسيق الشامل لجميع الحاويات
├── .env.example                  # نموذج متغيرات البيئة الشامل
└── ui_ux_specification.html      # العرض التقديمي التفاعلي الشامل لمواصفات وتجربة المستخدم
```

---

## 🚀 دليل التثبيت والتشغيل المحلي (Getting Started)

### 1. متطلبات التشغيل
* **Node.js**: v18+ (موصى به v20+)
* **PostgreSQL**: v14+ (أو استخدام حاوية Docker)
* **Docker & Docker Compose** (اختياري لتشغيل البيئة السحابية كاملة بضغطة زر)

---

### 2. إعداد قاعدة البيانات ومتغيرات البيئة
قم بنسخ ملف `.env.example` إلى `.env`:
```bash
cp .env.example .env
```

محتوى الإعدادات الأساسية:
```env
PORT=3000
DATABASE_URL=postgresql://bi_admin:SecureMasterPassword2026!@localhost:5432/enterprise_bi_db
JWT_SECRET=super_secret_enterprise_jwt_key_2026_modern_bi_platform_key!
DUCKDB_MEMORY_LIMIT=4GB
STORAGE_BASE_PATH=./storage
```

---

### 3. تشغيل الواجهة الأمامية (Frontend):
```bash
cd frontend
npm install
npm run dev
```
> يعمل التطبيق افتراضياً على: **`http://localhost:5173`**

---

### 4. تشغيل الخلفية ومحرك الاستعلامات (Backend):
```bash
cd backend
npm install
npm run start:dev
```
> يعمل خادم الـ API على: **`http://localhost:3000/api/v1`**  
> فحص الجاهزية والاتصال: **`http://localhost:3000/api/health`**

---

### 5. التشغيل الفوري بالحاويات (Docker Compose):
لتشغيل المنظومة بالكامل (PostgreSQL + MinIO + Backend + Frontend + Nginx) بأمر واحد:
```bash
docker-compose up -d --build
```
* **رابط المنصة:** `http://localhost:8080`
* **لوحة تخزين MinIO:** `http://localhost:9001`

---

## 🔌 مواصفات الواجهات البرمجية الرئيسية (API Endpoints)

### أولاً: المصادقة ومساحات العمل (Auth & Workspaces)
* `POST /api/v1/auth/register` — تسجيل حساب جديد وإصدار رمز JWT.
* `POST /api/v1/auth/login` — تسجيل الدخول والتحقق من الهوية.
* `GET /api/v1/workspaces` — جلب مساحات العمل الخاصة بالمستخدم.
* `POST /api/v1/workspaces` — إنشاء مساحة عمل جديدة تطبق عزل المستأجر (Tenant Boundary Isolation).

### ثانياً: إدارة واستعلام البيانات (Data Ingestion & OLAP)
* `POST /api/v1/workspaces/:id/data-sources/upload` — رفع ملف Excel/CSV حتى 50MB وتحويله فورياً لصيغة Parquet عمودية.
* `PUT /api/v1/workspaces/:id/data-sources/:sourceId/overwrite` — استبدال وتحديث الملف المصدري دون كسر اللوحات المرتبطة.
* `POST /api/v1/workspaces/:id/query` — تنفيذ استعلام تحليلي مجمع (SUM, AVG, Group By, Filters) عبر محرك DuckDB في زمن < 50ms.

### ثالثاً: المشاركة العامة والتضمين (Looker-Style Public Sharing)
* `POST /api/v1/dashboards/:id/share` — توليد رابط مشاركة عام محمي بكلمة مرور وتاريخ انتهاء صلاحية.
* `GET /api/v1/public/reports/:token` — عرض التقرير العام للقراءة فقط دون مصادقة مسبقة.
* `POST /api/v1/public/reports/:token/query` — استعلامات تفاعلية مسورة باللوحة المحددة فقط وتدعم التضمين `<iframe>`.

---

## 🏆 مراحل تطوير المشروع المكتملة

- [x] **المرحلة 1: توثيق المتطلبات وحالات الاستخدام (PRD):** تحديد نطاق المنصة، مؤشرات الأداء، واحتياجات التحليلات المتقدمة.
- [x] **المرحلة 2: التصميم المعماري ومخطط البيانات (ERD):** بناء مخطط PostgreSQL من 7 جداول مع فهارس الأداء وتوثيق واجهات الـ REST API.
- [x] **المرحلة 3: مواصفات الواجهات وتجربة الاستخدام (UI/UX):** إنتاج العرض التقديمي التفاعلي المكون من 12 شريحة (`ui_ux_specification.html`).
- [x] **المرحلة 4: تطوير الواجهة الأمامية (Frontend Implementation):** بناء محرر الكانفاس المتجاوب، تأطير Apache ECharts، دعم التصفية المتقاطعة، وإدارة الحالة عبر Zustand.
- [x] **المرحلة 5: معمارية الخلفية ومحرك DuckDB (Backend & OLAP Engine):** بناء منشئ الاستعلامات الديناميكي، معالج تحويل Parquet، وحماية عزل المساحات (RLS).
- [x] **المرحلة 6: إعداد النشر والاختبارات الشاملة (Testing & Deployment):** تجهيز ملفات Docker و Nginx، سكريبت قاعدة البيانات والبيانات التجريبية، واجتياز 100% من اختبارات التكامل.
- [x] **المرحلة 7: معمارية وتجربة Power BI & Looker المتقدمة (Power BI Layout & Styling Architecture):**
  - **تغيير حجم الجارتات التفاعلي:** التحكم في عرض الودجات (من 3 إلى 12 عموداً) وارتفاعها مع استجابة بصرية رسبونسف كاملة.
  - **الألواح الجانبية المرنة (Resizable & Dockable Panes):** سحب حواف السايدبار لتغيير عرضه بالماوس، وإمكانية نقل وتبديل موضع الألواح (نمط Power BI المتجاور أو النمط المنفصل أو النقل لليمين/اليسار).
  - **تبويبا الإعداد والتنسيق (Setup & Format Tabs):** فصل منطق ربط البيانات (Setup) عن تصميم المظهر (Format/Style) مع التحكم في Data Labels، موضع Legend، خطوط الشبكة، استدارة الحواف، وألوان البطاقة.
  - **تطهير أعمدة Excel واستبعاد الأعمدة الفارغة (`__EMPTY` Sanitization):** تنظيف شامل يمنع ظهور أي عمود فارغ أو غير معنون من ملفات Excel، مع زر فوري لإضافة أي عمود كسلايسر (Add Slicer) بنقرة واحدة.

---

## 🎨 مخطط معمارية تجربة Power BI & Looker (Power BI Architecture Schema)

```text
+------------------------------------------------------------------------------------------------------------+
|                                              HEADER & TOOLBAR                                              |
|  [Brand] [Workspace Switcher] [Active Filters]  |  [Layout: Power BI / Split] [Data Grid] [Upload] [Share] |
+------------------------------------------------------------------------------------------------------------+
|                                   |  VISUALIZATIONS PANE (Resizable)   |  DATA FIELDS PANE (Resizable)     |
|         DASHBOARD CANVAS          |  <Drag Border to Resize Width>     |  <Drag Border to Resize Width>    |
|                                   +------------------------------------+-----------------------------------+
|  +-----------------------------+  | [Build Visual] | [Format Style]    |  📁 Sales_2026.xlsx               |
|  | Bar Chart (Resize: [3|6|12])|  | ---------------------------------- |  -------------------------------- |
|  | - Direct Column Resizing    |  | * Chart Type (13 Types)            |  [T] المنطقة     [+ Add Slicer]   |
|  | - Bottom-Right Drag Handle  |  | * X-Axis (Categories Dropdown)     |  [T] الفرع       [+ Add Slicer]   |
|  +-----------------------------+  | * Y-Axis (Measures Dropdown)       |  [#] المبيعات    [+ Add Slicer]   |
|  +-----------------------------+  | * Aggregation (SUM, AVG, COUNT...) |  [#] الأرباح     [+ Add Slicer]   |
|  | KPI Card / Slicer Widget    |  | * Format Tab:                      |  (No '__EMPTY' columns allowed!)  |
|  | - Interactive Cross-Filter  |  |   - Show Data Labels (ON/OFF)      |                                   |
|  +-----------------------------+  |   - Legend Position (Top/Bottom...) |                                   |
|                                   |   - Gridlines, Border Radius, Card |                                   |
+------------------------------------------------------------------------------------------------------------+
```

---

## 🧪 التحقق والاختبارات المؤتمتة (Automated Test Suite)

لتشغيل فحص التكامل والتحقق الشامل للمنصة:
```bash
node tests/system-integration-test.mjs
```
**النتيجة:** ✅ `11/11` اختبار ناجح بنسبة 100% تغطي توليد الاستعلامات، مقاومة SQL Injection، قيود PostgreSQL، عزل المساحات، وتكامل الحاويات.
