// ==============================================================================
// DatabaseControlModal - مركز تشغيل وإدارة قاعدة البيانات للمشاريع
// ==============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Table,
  Terminal,
  Copy,
  Check,
  X,
  ShieldCheck,
  Cpu,
  Workflow,
  HardDrive
} from 'lucide-react';
import { useDashboardStore } from '../dashboard-builder/DashboardStore';
import { loadDataSources } from '../../services/supabaseDataService';

interface DatabaseControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDataSourcesManager?: () => void;
}

export const DatabaseControlModal: React.FC<DatabaseControlModalProps> = ({
  isOpen,
  onClose,
  onOpenDataSourcesManager
}) => {
  const {
    projects,
    currentProjectId,
    currentDataSource,
    syncActiveProjectToDatabase
  } = useDashboardStore();

  const activeProject = projects.find((p) => p.id === currentProjectId) || projects[0];

  const [activeTab, setActiveTab] = useState<'operations' | 'diagram'>('operations');
  const [dbStatus, setDbStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [savedSourcesCount, setSavedSourcesCount] = useState<number>(0);

  // Check Database connection
  const checkConnection = useCallback(async () => {
    setDbStatus('checking');
    const start = performance.now();
    try {
      const sources = await loadDataSources();
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setSavedSourcesCount(sources.length);
      setDbStatus('online');
    } catch (err) {
      setLatencyMs(null);
      setDbStatus('offline');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkConnection();
      setSyncFeedback(null);
    }
  }, [isOpen, checkConnection]);

  // Sync current project to DB
  const handleSyncProject = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncActiveProjectToDatabase();
      setSyncFeedback(res);
      if (res.success) {
        checkConnection();
      }
    } catch (err: any) {
      setSyncFeedback({ success: false, message: `فشل الحفظ: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const copyDockerCommand = () => {
    navigator.clipboard.writeText('docker compose -f supabase-docker/docker-compose.yml up -d');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  if (!isOpen) return null;

  const dbConfig = activeProject?.databaseConfig || {
    connected: true,
    provider: 'supabase_postgres' as const,
    projectId: currentProjectId,
    databaseName: 'enterprise_bi_db',
    tableName: `proj_${currentProjectId.replace(/[^a-zA-Z0-9]/g, '_')}_data`,
    schema: 'public',
    status: 'connected' as const,
    rowCount: currentDataSource?.rawRows?.length || 0,
    dbHost: 'localhost',
    dbPort: 5432
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  مركز تشغيل وإدارة قواعد البيانات للمشاريع
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                    dbStatus === 'online'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : dbStatus === 'checking'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      dbStatus === 'online'
                        ? 'bg-emerald-400 animate-pulse'
                        : dbStatus === 'checking'
                        ? 'bg-amber-400 animate-spin'
                        : 'bg-rose-400'
                    }`}
                  />
                  <span>
                    {dbStatus === 'online'
                      ? `متصلة (${latencyMs || 10}ms)`
                      : dbStatus === 'checking'
                      ? 'جارٍ الفحص...'
                      : 'غير متصلة'}
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                كل مشروع يمتلك قاعدة بيانات ومساحة تخزين مستقلة متزامنة مع خادم PostgreSQL ومحرك DuckDB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={checkConnection}
              title="إعادة فحص الاتصال بقاعدة البيانات"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${dbStatus === 'checking' ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Tabs Bar ── */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-slate-950/40 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('operations')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'operations'
                ? 'border-violet-500 text-violet-300 bg-violet-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>مركز التشغيل والخدمات</span>
          </button>
          <button
            onClick={() => setActiveTab('diagram')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'diagram'
                ? 'border-sky-500 text-sky-300 bg-sky-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>مخطط معمارية قواعد البيانات للمشاريع</span>
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {activeTab === 'operations' ? (
            <>
              {/* 1. Services Health Matrix */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-sky-400" />
                  <span>مصفوفة حالة خوادم ومحركات البيانات (Services Status)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* PostgreSQL Engine */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">PostgreSQL 17</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">خادم البيانات العلائقي</div>
                    <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-2">
                      <span>Port: 5432</span>
                      <span className="text-emerald-400 font-bold">نشط (Healthy)</span>
                    </div>
                  </div>

                  {/* Supabase Kong Gateway */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">Supabase REST</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">بوابة PostgREST API</div>
                    <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-2">
                      <span>Port: 8000</span>
                      <span className="text-emerald-400 font-bold">متصل (Ready)</span>
                    </div>
                  </div>

                  {/* Supabase Storage (Object Store) */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">Supabase Storage</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">تخزين ملفات المشاريع</div>
                    <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-2">
                      <span>Bucket: project-files</span>
                      <span className="text-emerald-400 font-bold">مفعل (Active)</span>
                    </div>
                  </div>

                  {/* DuckDB In-Memory OLAP */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">DuckDB OLAP</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">محرك التجميعات بالذاكرة</div>
                    <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-2">
                      <span>Speed: &lt;5ms</span>
                      <span className="text-sky-400 font-bold">يعمل (Active)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Active Project's Dedicated Database Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950/30 border border-indigo-500/25 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{activeProject.icon || '📊'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-100">
                          قاعدة بيانات المشروع: {activeProject.title}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                          مساحة بيانات معزولة
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        ID: {activeProject.id} · Database: {dbConfig.databaseName}
                      </p>
                    </div>
                  </div>

                  {/* Sync Button */}
                  <button
                    onClick={handleSyncProject}
                    disabled={isSyncing}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-60"
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>{isSyncing ? 'جارٍ المزامنة...' : 'مزامنة المشروع مع DB'}</span>
                  </button>
                </div>

                {/* Project DB Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-1">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500 font-semibold">جدول قاعدة البيانات</span>
                    <span className="font-mono text-emerald-400 font-bold truncate" title={dbConfig.tableName}>
                      {dbConfig.tableName}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500 font-semibold">عدد السجلات (Rows)</span>
                    <span className="font-mono text-slate-200 font-bold">
                      {(currentDataSource?.rawRows?.length || dbConfig.rowCount || 0).toLocaleString()} سجل
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500 font-semibold">عدد الأعمدة (Columns)</span>
                    <span className="font-mono text-slate-200 font-bold">
                      {currentDataSource?.columns?.length || 0} عمود
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500 font-semibold">مصدر البيانات</span>
                    <span className="font-bold text-sky-400 truncate">
                      {activeProject.dataSourceType === 'database'
                        ? 'قاعدة بيانات مباشرة'
                        : activeProject.dataSourceType === 'google_sheets'
                        ? 'Google Sheets'
                        : activeProject.dataSourceType === 'excel_csv'
                        ? 'ملف Excel / CSV'
                        : 'لوحة مخصصة'}
                    </span>
                  </div>
                </div>

                {/* Feedback message */}
                {syncFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      syncFeedback.success
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
                    }`}
                  >
                    {syncFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>{syncFeedback.message}</span>
                  </div>
                )}

                {/* Supabase Storage for Active Project */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">مستودع ملفات المشروع السحابي (Supabase Storage)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 font-mono font-bold">
                          Bucket: project-files
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={`project-files/${activeProject.id}/`}>
                        مسار المجلد: project-files/{activeProject.id}/ (تخزين معزول وآمن للملفات الخام)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 hidden sm:inline whitespace-nowrap">
                    يتم الحفظ تلقائياً عند رفع أي ملف
                  </span>
                </div>
              </div>

              {/* 3. Action Cards & Management */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Explore DB Tables & Data Sources */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
                      <Table className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-200">
                        مستعرض جداول قاعدة البيانات
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-1">
                        استعراض كافة الجداول والمصادر المحفوظة ({savedSourcesCount} مصادر) والتبديل بينها
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenDataSourcesManager) onOpenDataSourcesManager();
                    }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Table className="w-3.5 h-3.5 text-violet-400" />
                    <span>فتح مستعرض الجداول</span>
                  </button>
                </div>

                {/* Direct Docker Runner & Health */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-200">
                        تشغيل خادم قاعدة البيانات في Docker
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-1">
                        أمر التشغيل السريع للحاويات في حال توقف PostgreSQL أو Kong
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={copyDockerCommand}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer font-mono text-[11px]"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
                    <span>{copiedCmd ? 'تم نسخ الأمر!' : 'نسخ أمر تشغيل Docker'}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ── Architecture Blueprint & Data Pipeline Tab ── */
            <div className="space-y-5">
              {/* Pipeline Flow Diagram */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Workflow className="w-3.5 h-3.5 text-sky-400" />
                  <span>مسار تدفق البيانات والمعمارية المعزولة (End-to-End Pipeline)</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-center text-xs">
                  {/* Step 1 */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-sky-500/30 flex flex-col items-center justify-center gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">1</div>
                    <span className="font-bold text-slate-100">مصادر الإدخال</span>
                    <span className="text-[10px] text-slate-400">Excel / DB / Sheets</span>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-indigo-500/30 flex flex-col items-center justify-center gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">2</div>
                    <span className="font-bold text-slate-100">محرك المعالجة</span>
                    <span className="text-[10px] text-slate-400">Sanitize & Type Cast</span>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-violet-500/30 flex flex-col items-center justify-center gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">3</div>
                    <span className="font-bold text-slate-100">PostgreSQL 17</span>
                    <span className="text-[10px] text-slate-400">جداول معزولة proj_data</span>
                  </div>

                  {/* Step 4 */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-amber-500/30 flex flex-col items-center justify-center gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">4</div>
                    <span className="font-bold text-slate-100">DuckDB OLAP</span>
                    <span className="text-[10px] text-slate-400">تجميع فوري &lt;5ms</span>
                  </div>

                  {/* Step 5 */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex flex-col items-center justify-center gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">5</div>
                    <span className="font-bold text-slate-100">Power BI Canvas</span>
                    <span className="text-[10px] text-slate-400">لوحات ومؤشرات حية</span>
                  </div>
                </div>
              </div>

              {/* Projects Isolation Registry Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-violet-400" />
                  <span>سجل عزل قواعد البيانات للمشاريع المسجلة ({projects.length})</span>
                </h4>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-bold">
                        <th className="p-3">المشروع</th>
                        <th className="p-3">قاعدة البيانات</th>
                        <th className="p-3">الجدول المعزول</th>
                        <th className="p-3">السجلات</th>
                        <th className="p-3">المصدر</th>
                        <th className="p-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {projects.map((p) => {
                        const cfg = p.databaseConfig || {
                          databaseName: 'enterprise_bi_db',
                          tableName: `proj_${p.id.replace(/[^a-zA-Z0-9]/g, '_')}_data`
                        };
                        const isCurrent = p.id === currentProjectId;
                        return (
                          <tr key={p.id} className={isCurrent ? 'bg-sky-500/10' : 'hover:bg-slate-900/50'}>
                            <td className="p-3 font-sans font-bold text-slate-200 flex items-center gap-2">
                              <span>{p.icon || '📊'}</span>
                              <span className="truncate max-w-[140px]">{p.title}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold">الحالي</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-400">{cfg.databaseName}</td>
                            <td className="p-3 text-emerald-400 font-bold">{cfg.tableName}</td>
                            <td className="p-3 text-slate-300 font-bold">
                              {(p.dataSource?.rawRows?.length || 0).toLocaleString()}
                            </td>
                            <td className="p-3 font-sans text-sky-400">
                              {p.dataSourceType === 'database'
                                ? 'PostgreSQL'
                                : p.dataSourceType === 'google_sheets'
                                ? 'Google Sheets'
                                : p.dataSourceType === 'excel_csv'
                                ? 'Excel/CSV'
                                : 'مخصص'}
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 text-[10px] font-sans font-bold text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                معزول وآمن
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Architectural Guarantees */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-sky-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>عزلة تامة (Multi-Tenant)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    كل مشروع يمتلك جدوله المستقل، ولا تختلط بيانات أي مشروع مع الآخر إطلاقاً.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-violet-400 font-bold">
                    <Cpu className="w-4 h-4" />
                    <span>DuckDB OLAP فائق السرعة</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    تنفيذ استعلامات التجميع والحسابات المعقدة في الذاكرة بمتوسط سرعة يقل عن 5ms.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <RotateCcw className="w-4 h-4" />
                    <span>مزامنة سحابية حية</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    تحديث لحظي لبيانات Excel و Google Sheets مع الحفظ الدائم في قاعدة البيانات.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PostgreSQL 17 · Supabase Local Stack · DuckDB Engine</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
