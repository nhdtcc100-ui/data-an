import type { Dashboard } from './dashboard';
import type { DataSource } from './dataSource';
import type { DrillPathEntry } from '../services/dataEngine';

// ─── نموذج مصدر بيانات المشروع ────────────────────────────────────────────────
export type DataSourceType = 'google_sheets' | 'excel_csv' | 'database' | 'empty';

// ─── إعدادات وحالة قاعدة البيانات المخصصة للمشروع ─────────────────────────────
export interface ProjectDatabaseConfig {
  connected: boolean;
  provider: 'supabase_postgres' | 'local_postgres' | 'duckdb';
  projectId: string;
  databaseName: string;
  tableName: string;
  schema: string;
  status: 'connected' | 'syncing' | 'offline' | 'error';
  lastSyncedAt?: string;
  rowCount?: number;
  dbHost?: string;
  dbPort?: number;
}

// ─── نموذج المشروع المستقل ────────────────────────────────────────────────────
export interface Project {
  id: string;                          // معرف فريد: 'proj-offers-2026'
  title: string;                       // اسم المشروع
  description?: string;                // وصف مختصر
  category?: string;                   // تصنيف: تسويق، مبيعات، أمن، إلخ
  icon?: string;                       // أيقونة emoji للمشروع
  colorAccent?: string;                // لون هوية المشروع (Tailwind color name)
  createdAt: string;
  updatedAt: string;

  // نوع مصدر البيانات
  dataSourceType: DataSourceType;
  googleSheetUrl?: string;             // رابط Google Sheet (إن وجد)

  // ربط وحالة قاعدة البيانات المخصصة لهذا المشروع
  databaseConfig?: ProjectDatabaseConfig;

  // البيانات الكاملة للمشروع
  dataSource: DataSource;
  dashboard: Dashboard;

  // حالة الفلاتر والتصفية الخاصة بهذا المشروع
  activeFilters: Record<string, any>;
  widgetFilters: Record<string, Record<string, any>>;
  drillDownStates: Record<string, { path: DrillPathEntry[]; levelIndex: number }>;

  // إعدادات العرض
  theme: 'dark' | 'light';
  motionTheme?: string;
  isPublic?: boolean;
}

// ─── نموذج إنشاء مشروع جديد ──────────────────────────────────────────────────
export interface CreateProjectOptions {
  title: string;
  description?: string;
  category?: string;
  icon?: string;
  colorAccent?: string;
  dataSourceType: DataSourceType;
  googleSheetUrl?: string;
  initialDataSource?: DataSource;
  databaseConfig?: Partial<ProjectDatabaseConfig>;
  theme?: 'dark' | 'light';
}

// ─── الألوان المتاحة للمشاريع ─────────────────────────────────────────────────
export const PROJECT_COLOR_ACCENTS = [
  { name: 'sky', label: 'سماوي', from: 'from-sky-500', to: 'to-indigo-600', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  { name: 'emerald', label: 'أخضر', from: 'from-emerald-500', to: 'to-teal-600', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  { name: 'violet', label: 'بنفسجي', from: 'from-violet-500', to: 'to-purple-600', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  { name: 'amber', label: 'ذهبي', from: 'from-amber-500', to: 'to-orange-600', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  { name: 'rose', label: 'وردي', from: 'from-rose-500', to: 'to-pink-600', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  { name: 'cyan', label: 'فيروزي', from: 'from-cyan-500', to: 'to-blue-600', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
] as const;

export type ProjectColorAccent = (typeof PROJECT_COLOR_ACCENTS)[number]['name'];

// ─── الفئات المتاحة ───────────────────────────────────────────────────────────
export const PROJECT_CATEGORIES = [
  { value: 'sales', label: 'مبيعات وعروض أسعار', icon: '💰' },
  { value: 'marketing', label: 'تسويق وإعلانات', icon: '📢' },
  { value: 'operations', label: 'عمليات ولوجستيات', icon: '⚙️' },
  { value: 'hr', label: 'موارد بشرية', icon: '👥' },
  { value: 'finance', label: 'مالية ومحاسبة', icon: '📊' },
  { value: 'security', label: 'أمن ومراقبة', icon: '🔒' },
  { value: 'other', label: 'أخرى', icon: '📁' },
] as const;
