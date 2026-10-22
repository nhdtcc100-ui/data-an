// ============================================================
// DataSourcesManager - Manage saved Excel/Sheet data sources
// Allows viewing, switching, and deleting data sources from DB
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  Database, FileSpreadsheet, Trash2, RefreshCw, CheckCircle2,
  Clock, AlertCircle, ChevronRight, X, BarChart2, Table2,
  HardDrive
} from "lucide-react";
import { loadDataSources, loadProducts, deleteDataSource, productsToDataSource } from "../../services/supabaseDataService";
import { useDashboardStore } from "../dashboard-builder/DashboardStore";

interface DataSourcesManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(iso));
  } catch { return iso; }
}

export const DataSourcesManager: React.FC<DataSourcesManagerProps> = ({ isOpen, onClose }) => {
  const { setDataSource, currentDataSource } = useDashboardStore();
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sources = await loadDataSources();
      setDataSources(sources);
    } catch (err: any) {
      setError("تعذر الاتصال بقاعدة البيانات — تأكد أن Supabase يعمل على المنفذ 8000");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchSources();
  }, [isOpen, fetchSources]);

  const handleActivate = async (ds: any) => {
    setLoadingId(ds.id);
    try {
      const products = await loadProducts(ds.id);
      const dataSource = productsToDataSource(products, ds);
      setDataSource(dataSource);
      setActiveId(ds.id);
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setError(`فشل تحميل البيانات: ${err.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (ds: any) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${ds.name}"؟ سيتم حذف جميع البيانات المرتبطة.`)) return;
    setDeletingId(ds.id);
    try {
      await deleteDataSource(ds.id);
      setDataSources(prev => prev.filter(s => s.id !== ds.id));
      if (activeId === ds.id) setActiveId(null);
    } catch (err: any) {
      setError(`فشل الحذف: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">مصادر البيانات المحفوظة</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {dataSources.length} مصدر محفوظ في Supabase — اختر لتحميل البيانات على اللوحة
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
              <p className="text-sm">جاري التحميل من قاعدة البيانات...</p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-300 font-medium">خطأ في الاتصال</p>
                <p className="text-[11px] text-red-400/80 mt-1">{error}</p>
              </div>
            </div>
          ) : dataSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <HardDrive className="w-12 h-12 text-slate-700" />
              <p className="text-sm font-medium">لا توجد مصادر بيانات محفوظة</p>
              <p className="text-[11px] text-slate-600">ارفع ملف Excel أو اربط Google Sheet وسيتم حفظه تلقائياً هنا</p>
            </div>
          ) : (
            dataSources.map(ds => (
              <div
                key={ds.id}
                className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  activeId === ds.id || currentDataSource?.id === ds.id
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-slate-800 bg-slate-800/30 hover:border-slate-700 hover:bg-slate-800/50"
                }`}
              >
                {/* Icon */}
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  ds.source_type === "google_sheets"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                }`}>
                  {ds.source_type === "google_sheets"
                    ? <BarChart2 className="w-4 h-4" />
                    : <FileSpreadsheet className="w-4 h-4" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-200 truncate">{ds.name}</p>
                    {(activeId === ds.id || currentDataSource?.id === ds.id) && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> نشط
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Table2 className="w-3 h-3" />
                      {(ds.row_count || 0).toLocaleString()} صف
                    </span>
                    {ds.file_size && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatBytes(ds.file_size)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(ds.created_at)}
                    </span>
                  </div>
                  {ds.file_name && ds.file_name !== ds.name && (
                    <p className="text-[10px] text-slate-600 mt-0.5 truncate">{ds.file_name}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDelete(ds)}
                    disabled={deletingId === ds.id}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="حذف"
                  >
                    {deletingId === ds.id
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>

                  <button
                    onClick={() => handleActivate(ds)}
                    disabled={loadingId === ds.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-[11px] font-bold transition cursor-pointer border border-violet-500/20 disabled:opacity-50"
                  >
                    {loadingId === ds.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    {loadingId === ds.id ? "جاري التحميل..." : "تحميل"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={fetchSources}
            disabled={loading}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            تحديث القائمة
          </button>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Supabase — localhost:8000
          </div>
        </div>
      </div>
    </div>
  );
};
