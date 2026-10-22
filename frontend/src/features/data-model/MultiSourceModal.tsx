import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X, UploadCloud, FileSpreadsheet, Globe, Link2, Database,
  CheckCircle2, AlertCircle, ArrowRight, Layers,
  Play, Plus, Trash2, GitMerge,
  Code2, Copy, Check, Info, Loader2,
  Laptop, Radio, Table
} from 'lucide-react';
import type { DataSource, TableEntry, MultiTableDataSource } from '../../types/dataSource';
import { parseWorksheetSmartTables } from '../../services/smartTableDetection';
import { detectRelations, assignTableColors } from '../../services/relationDetectionService';
import { fetchGoogleSheetData, DEFAULT_GOOGLE_SHEET_URL } from '../../services/googleSheetsService';
import { exportToPowerQuery, exportDaxMeasuresAsText } from '../../services/powerQueryExporter';
import { multiModelToDataSource, mergeTablesWithRelations } from '../../services/mergeEngine';
import { liveWatcherService } from '../../services/localFileWatcherService';
import { RelationCanvas } from '../data-model/RelationCanvas';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MultiSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (dataSource: DataSource, model: MultiTableDataSource) => void;
}

type Step = 'select' | 'model' | 'export';

interface UploadedFile {
  fileId: string;
  fileName: string;
  fileSizeBytes: number;
  tables: TableEntry[];
  selectedTableIds: Set<string>;
  isLive?: boolean;
}

interface LiveSheet {
  sheetId: string;
  url: string;
  label: string;
  table: TableEntry | null;
  status: 'idle' | 'loading' | 'ok' | 'error';
  error?: string;
}

const TABLE_COLORS = [
  '#38bdf8','#818cf8','#34d399','#fb923c',
  '#f472b6','#a3e635','#fbbf24','#c084fc',
  '#2dd4bf','#f87171'
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const MultiSourceModal: React.FC<MultiSourceModalProps> = ({ isOpen, onClose, onApply }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('select');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [liveSheets, setLiveSheets] = useState<LiveSheet[]>([]);
  const [gSheetUrl, setGSheetUrl] = useState(DEFAULT_GOOGLE_SHEET_URL);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [model, setModel] = useState<MultiTableDataSource>({
    tables: [], relations: [], computedColumns: []
  });

  // Export / Preview tab state
  const [exportTab, setExportTab] = useState<'preview' | 'mcode' | 'dax'>('preview');
  const [copied, setCopied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  // ── Collect all selected tables ──────────────────────────────────────────
  const getSelectedTables = (): TableEntry[] => {
    const tables: TableEntry[] = [];
    let colorIdx = 0;

    uploadedFiles.forEach((uf) => {
      uf.tables.forEach((t) => {
        if (uf.selectedTableIds.has(t.id)) {
          tables.push({ ...t, color: t.color || TABLE_COLORS[colorIdx++ % TABLE_COLORS.length] });
        }
      });
    });

    liveSheets.forEach((ls) => {
      if (ls.table) {
        tables.push({ ...ls.table, color: ls.table.color || TABLE_COLORS[colorIdx++ % TABLE_COLORS.length] });
      }
    });

    return tables;
  };

  // ── Live file picker via File System Access API (Power Query style) ──────
  const handlePickLiveFile = async () => {
    setUploadError(null);
    setIsUploading(true);
    try {
      const { tables, fileName, fileSizeBytes } = await liveWatcherService.pickAndStartWatching(3000);
      const newFile: UploadedFile = {
        fileId: `live-file-${Date.now()}`,
        fileName,
        fileSizeBytes,
        tables,
        selectedTableIds: new Set(tables.map((t) => t.id)),
        isLive: true
      };
      setUploadedFiles((prev) => [newFile, ...prev]);
    } catch (err: any) {
      if (err.message !== 'تم إلغاء اختيار الملف') {
        setUploadError(err.message || 'فشل في ربط الملف الحي');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // ── File upload handler ─────────────────────────────────────────────────
  const handleFilesUpload = (files: FileList) => {
    setUploadError(null);
    setIsUploading(true);

    const promises = Array.from(files).map(
      (file) =>
        new Promise<UploadedFile>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array', cellDates: true });
              const tables: TableEntry[] = [];

              workbook.SheetNames.forEach((sheetName, idx) => {
                const ws = workbook.Sheets[sheetName];
                const smartTables = parseWorksheetSmartTables(ws, sheetName, idx);
                if (smartTables) {
                  smartTables.forEach((st, ti) => {
                    tables.push({
                      id: `tbl-${Date.now()}-${idx}-${ti}`,
                      name: st.name,
                      sourceType: 'file',
                      fileName: file.name,
                      columns: st.columns || [],
                      rawRows: st.rawRows || [],
                      rowCount: st.rowCount || 0,
                      uploadedAt: new Date().toISOString()
                    });
                  });
                }
              });

              if (tables.length === 0) {
                reject(new Error(`${file.name}: لا توجد جداول بيانات صالحة`));
                return;
              }

              resolve({
                fileId: `file-${Date.now()}`,
                fileName: file.name,
                fileSizeBytes: file.size,
                tables,
                selectedTableIds: new Set(tables.map((t) => t.id))
              });
            } catch (err: any) {
              reject(new Error(`${file.name}: ${err.message}`));
            }
          };
          reader.onerror = () => reject(new Error(`فشل قراءة ${file.name}`));
          reader.readAsArrayBuffer(file);
        })
    );

    Promise.allSettled(promises).then((results) => {
      const newFiles: UploadedFile[] = [];
      const errors: string[] = [];

      results.forEach((res) => {
        if (res.status === 'fulfilled') newFiles.push(res.value);
        else errors.push(res.reason?.message || 'خطأ غير معروف');
      });

      setUploadedFiles((prev) => [...prev, ...newFiles]);
      if (errors.length > 0) setUploadError(errors.join(' | '));
      setIsUploading(false);
    });
  };

  // ── Toggle table selection ───────────────────────────────────────────────
  const toggleTable = (fileId: string, tableId: string) => {
    setUploadedFiles((prev) =>
      prev.map((uf) => {
        if (uf.fileId !== fileId) return uf;
        const next = new Set(uf.selectedTableIds);
        next.has(tableId) ? next.delete(tableId) : next.add(tableId);
        return { ...uf, selectedTableIds: next };
      })
    );
  };

  const toggleAllTables = (fileId: string, selectAll: boolean) => {
    setUploadedFiles((prev) =>
      prev.map((uf) => {
        if (uf.fileId !== fileId) return uf;
        return {
          ...uf,
          selectedTableIds: selectAll ? new Set(uf.tables.map((t) => t.id)) : new Set()
        };
      })
    );
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
  };

  // ── Add Google Sheet ─────────────────────────────────────────────────────
  const addGoogleSheet = async () => {
    const url = gSheetUrl.trim();
    if (!url) return;

    const sheetId = `gs-${Date.now()}`;
    const newSheet: LiveSheet = {
      sheetId, url,
      label: `Google Sheet ${liveSheets.length + 1}`,
      table: null, status: 'loading'
    };
    setLiveSheets((prev) => [...prev, newSheet]);

    try {
      const ds = await fetchGoogleSheetData(url);
      const table: TableEntry = {
        id: `tbl-gs-${sheetId}`,
        name: ds.fileName || `Google Sheet ${liveSheets.length + 1}`,
        sourceType: 'sheet',
        columns: ds.columns || [],
        rawRows: ds.rawRows || [],
        rowCount: ds.rawRows?.length || 0,
        uploadedAt: new Date().toISOString()
      };
      setLiveSheets((prev) =>
        prev.map((ls) =>
          ls.sheetId === sheetId ? { ...ls, table, status: 'ok', label: table.name } : ls
        )
      );
    } catch (err: any) {
      setLiveSheets((prev) =>
        prev.map((ls) =>
          ls.sheetId === sheetId ? { ...ls, status: 'error', error: err.message } : ls
        )
      );
    }
  };

  const removeSheet = (sheetId: string) => {
    setLiveSheets((prev) => prev.filter((ls) => ls.sheetId !== sheetId));
  };

  // ── Proceed to model step ────────────────────────────────────────────────
  const handleProceedToModel = () => {
    const tables = getSelectedTables();
    if (tables.length === 0) {
      setUploadError('يرجى اختيار جدول واحد على الأقل');
      return;
    }
    const colored = assignTableColors(tables);
    const relations = detectRelations(colored);
    setModel({ tables: colored, relations, computedColumns: [] });
    setStep('model');
  };

  // ── Apply to dashboard ───────────────────────────────────────────────────
  const handleApply = async () => {
    setIsApplying(true);
    try {
      const mergedDs = multiModelToDataSource(model);
      onApply(mergedDs as DataSource, model);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  // ── Export helpers ───────────────────────────────────────────────────────
  const exportResult = exportToPowerQuery(model);
  const daxCode = exportDaxMeasuresAsText(model);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  const totalSelected = getSelectedTables().length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '95vh', minHeight: 520 }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                ربط مصادر البيانات المتعددة
                <span className="mr-2 text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">
                  Power Query Engine
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                اختر ملفات أو جداول متعددة، افهم العلاقات تلقائياً، صدّر M-Code جاهزاً لـ Power BI
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step Tabs ── */}
        <div className="flex border-b border-slate-800 px-6 shrink-0">
          {(['select', 'model', 'export'] as Step[]).map((s, idx) => (
            <button key={s}
              onClick={() => { if (s !== 'select' || step === 'select') setStep(s); }}
              disabled={s === 'model' && step === 'select'}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition ${
                step === s
                  ? 'border-sky-500 text-sky-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                step === s ? 'bg-sky-500 border-sky-500 text-white'
                : idx < ['select','model','export'].indexOf(step)
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-slate-600 text-slate-500'
              }`}>{idx + 1}</span>
              {s === 'select' ? 'اختيار المصادر'
               : s === 'model' ? 'نموذج العلاقات'
               : 'تصدير Power Query'}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ════════════════════════════════════════ STEP 1: SELECT ════ */}
          {step === 'select' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ── Live Computer File Connection (Power Query Style) ── */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-emerald-950/20">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-100">
                        ربط ملف حي من الحاسوب (مراقبة وتزامن لحظي Power Query)
                      </h3>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                        أتمتة فائقة ⚡
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                      اربط ملف Excel أو CSV من جهازك مباشرة. عند حفظ أي تعديل في Excel (<span className="text-emerald-300 font-mono">Ctrl+S</span>)، يقوم النظام فوراً باكتشاف التعديل وتحديث لوحة التحكم والتقارير والرسومات البيانية تلقائياً!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePickLiveFile}
                  disabled={isUploading}
                  className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/25 transition cursor-pointer disabled:opacity-50"
                >
                  <Radio className="w-4 h-4 text-white animate-pulse" />
                  <span>ربط شيت حي من الحاسوب</span>
                </button>
              </div>

              {/* Upload zone */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                  رفع ملفات إضافية (Excel / CSV)
                </h3>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.length > 0) handleFilesUpload(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-sky-500 bg-slate-950/60 hover:bg-slate-900/40 rounded-xl p-6 flex flex-col items-center cursor-pointer transition group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
                  />
                  {isUploading
                    ? <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-2" />
                    : <UploadCloud className="w-8 h-8 text-sky-400 mb-2 group-hover:scale-110 transition" />}
                  <p className="text-sm text-slate-300 font-semibold">
                    اسحب ملفات متعددة أو انقر للاختيار
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    يمكنك اختيار أكثر من ملف دفعة واحدة — يتم كشف الجداول تلقائياً
                  </p>
                </div>

                {uploadError && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {uploadError}
                  </div>
                )}
              </div>

              {/* Uploaded files */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-4">
                  {uploadedFiles.map((uf) => (
                    <div key={uf.fileId} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                      {/* File header */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/50">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-200 flex-1">{uf.fileName}</span>
                        {uf.isLive && (
                          <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                            <Radio className="w-2.5 h-2.5 animate-pulse" />
                            تزامن حي نشط
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          {(uf.fileSizeBytes / 1024).toFixed(1)} KB · {uf.tables.length} جدول
                        </span>
                        <button
                          onClick={() => toggleAllTables(uf.fileId, uf.selectedTableIds.size < uf.tables.length)}
                          className="text-[10px] text-sky-400 hover:text-sky-300 px-2 py-0.5 rounded bg-sky-500/10 transition"
                        >
                          {uf.selectedTableIds.size === uf.tables.length ? 'إلغاء الكل' : 'اختيار الكل'}
                        </button>
                        <button onClick={() => removeFile(uf.fileId)}
                          className="text-slate-500 hover:text-red-400 transition p-1 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Tables list */}
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {uf.tables.map((table) => {
                          const isSelected = uf.selectedTableIds.has(table.id);
                          return (
                            <button
                              key={table.id}
                              onClick={() => toggleTable(uf.fileId, table.id)}
                              className={`flex items-start gap-3 p-3 rounded-lg border text-right transition ${
                                isSelected
                                  ? 'border-sky-500/50 bg-sky-500/5 text-sky-300'
                                  : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
                                isSelected ? 'border-sky-500 bg-sky-500' : 'border-slate-600'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate">{table.name}</p>
                                <p className="text-[10px] opacity-70 mt-0.5">
                                  {table.rowCount?.toLocaleString()} صف · {table.columns?.length} عمود
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {table.columns?.slice(0, 4).map((c) => (
                                    <span key={c.id} className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                                      {c.columnName}
                                    </span>
                                  ))}
                                  {(table.columns?.length || 0) > 4 && (
                                    <span className="text-[9px] text-slate-500">
                                      +{(table.columns?.length || 0) - 4}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Google Sheets section */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  ربط مباشر بـ Google Sheets (تزامن حي)
                </h3>
                <div className="flex gap-2">
                  <input
                    value={gSheetUrl}
                    onChange={(e) => setGSheetUrl(e.target.value)}
                    placeholder="الصق رابط Google Sheet..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    dir="ltr"
                  />
                  <button
                    onClick={addGoogleSheet}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة
                  </button>
                </div>

                {liveSheets.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {liveSheets.map((ls) => (
                      <div key={ls.sheetId}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-xs ${
                          ls.status === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5'
                          : ls.status === 'error' ? 'border-red-500/30 bg-red-500/5'
                          : 'border-slate-700 bg-slate-800/50'
                        }`}
                      >
                        {ls.status === 'loading' && <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />}
                        {ls.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                        {ls.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                        {ls.status === 'idle' && <Globe className="w-4 h-4 text-slate-400 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-200 truncate">{ls.label}</p>
                          {ls.table && (
                            <p className="text-slate-500 mt-0.5">
                              {ls.table.rowCount?.toLocaleString()} صف · {ls.table.columns?.length} عمود
                            </p>
                          )}
                          {ls.error && <p className="text-red-400 mt-0.5">{ls.error}</p>}
                        </div>
                        <button onClick={() => removeSheet(ls.sheetId)}
                          className="text-slate-500 hover:text-red-400 transition p-1 rounded shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════ STEP 2: MODEL ════ */}
          {step === 'model' && (
            <div className="flex-1 overflow-hidden">
              <RelationCanvas model={model} onModelChange={setModel} />
            </div>
          )}

          {/* ════════════════════════════════════════ STEP 3: EXPORT ════ */}
          {step === 'export' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Summary */}
              {(() => {
                const mergePreview = mergeTablesWithRelations(model);
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3.5 flex items-center gap-3">
                        <Database className="w-5 h-5 text-sky-400 shrink-0" />
                        <div>
                          <p className="text-base font-bold text-sky-300">{exportResult.summary.tablesCount}</p>
                          <p className="text-[11px] text-slate-400">الجداول المختارة</p>
                        </div>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-base font-bold text-emerald-300">{mergePreview.mergedRows.length.toLocaleString()}</p>
                          <p className="text-[11px] text-slate-400">إجمالي الصفوف الحقيقية</p>
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-center gap-3">
                        <Table className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                          <p className="text-base font-bold text-amber-300">{mergePreview.mergedColumns.length}</p>
                          <p className="text-[11px] text-slate-400">الأعمدة الحقيقية</p>
                        </div>
                      </div>

                      <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3.5 flex items-center gap-3">
                        <Link2 className="w-5 h-5 text-violet-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-violet-300">
                            {mergePreview.modeUsed === 'append' ? 'تجميع صفوف (Append)' : 'دمج علاقات (Join)'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {mergePreview.modeUsed === 'append' ? 'توحيد الشيتات المتشابهة' : `${exportResult.summary.relationsCount} علاقات مطبقة`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Code & Preview Tabs */}
                    <div className="flex border-b border-slate-800 gap-4 text-xs font-bold pt-2">
                      <button
                        onClick={() => setExportTab('preview')}
                        className={`flex items-center gap-1.5 pb-2.5 border-b-2 transition cursor-pointer ${
                          exportTab === 'preview' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <Table className="w-3.5 h-3.5" /> معاينة البيانات المدمجة الحقيقية
                      </button>
                      <button
                        onClick={() => setExportTab('mcode')}
                        className={`flex items-center gap-1.5 pb-2.5 border-b-2 transition cursor-pointer ${
                          exportTab === 'mcode' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <Code2 className="w-3.5 h-3.5" /> Power Query M-Code
                      </button>
                      <button
                        onClick={() => setExportTab('dax')}
                        className={`flex items-center gap-1.5 pb-2.5 border-b-2 transition cursor-pointer ${
                          exportTab === 'dax' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <Database className="w-3.5 h-3.5" /> DAX Measures
                      </button>
                    </div>

                    {/* TAB 1: Real Merged Data Preview */}
                    {exportTab === 'preview' && (
                      <div className="space-y-3">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                          <div className="overflow-x-auto max-h-[360px]">
                            <table className="w-full text-right text-xs text-slate-300 border-collapse">
                              <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                                <tr>
                                  <th className="px-3 py-2.5 text-center text-slate-600 w-10">#</th>
                                  {mergePreview.mergedColumns.map((col) => (
                                    <th key={col.id} className="px-3 py-2.5 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                                          col.dataType === 'numeric' ? 'bg-sky-500/20 text-sky-300'
                                          : col.dataType === 'date' ? 'bg-amber-500/20 text-amber-300'
                                          : 'bg-emerald-500/20 text-emerald-300'
                                        }`}>
                                          {col.dataType === 'numeric' ? '123' : col.dataType === 'date' ? 'D' : 'Aa'}
                                        </span>
                                        <span className="text-slate-200">{col.columnName}</span>
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 font-sans">
                                {mergePreview.mergedRows.slice(0, 10).map((row, rIdx) => (
                                  <tr key={rIdx} className="hover:bg-slate-800/40 transition">
                                    <td className="px-3 py-2 text-center text-slate-600 font-mono text-[10px]">{rIdx + 1}</td>
                                    {mergePreview.mergedColumns.map((col) => {
                                      const val = row[col.columnName];
                                      return (
                                        <td key={col.id} className="px-3 py-2 whitespace-nowrap text-slate-200 max-w-[200px] truncate" title={val !== null && val !== undefined ? String(val) : 'فارغ'}>
                                          {val !== null && val !== undefined && val !== '' ? (
                                            typeof val === 'number' ? val.toLocaleString('ar-EG') : String(val)
                                          ) : (
                                            <span className="text-slate-600 font-mono">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                            <span>
                              عرض أول {Math.min(10, mergePreview.mergedRows.length)} صفوف من إجمالي {mergePreview.mergedRows.length.toLocaleString()} صف حقيقي
                            </span>
                            <span className="text-emerald-400 font-medium">
                              ✓ جميع الأعمدة حقيقية ومطابقة لمصادرك
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2 & 3: Code Tabs */}
                    {exportTab !== 'preview' && (
                      <div className="space-y-4">
                        <div className="relative">
                          <div className="absolute top-3 left-3 z-10 flex gap-2">
                            <button
                              onClick={() => handleCopy(exportTab === 'mcode' ? exportResult.mCode : daxCode)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              {copied ? 'تم النسخ!' : 'نسخ'}
                            </button>
                          </div>
                          <pre
                            className="bg-slate-950 border border-slate-800 rounded-xl p-4 pt-12 text-[11px] text-slate-300 font-mono overflow-auto"
                            style={{ maxHeight: 320, direction: 'ltr', textAlign: 'left' }}
                          >
                            {exportTab === 'mcode' ? exportResult.mCode : daxCode}
                          </pre>
                        </div>

                        <div className="flex items-start gap-2 text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-xl p-3">
                          <Info className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">كيفية الاستخدام في Power BI Desktop:</p>
                            <ol className="text-slate-400 mt-1 space-y-0.5 list-decimal list-inside">
                              <li>افتح Power BI Desktop → الحصول على البيانات → استعلام فارغ</li>
                              <li>افتح المحرر المتقدم (Advanced Editor)</li>
                              <li>الصق الكود أعلاه واضبط مسارات الملفات</li>
                              <li>انقر "إغلاق وتطبيق"</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <div className="text-xs text-slate-500">
            {step === 'select' && `${totalSelected} جدول مختار`}
            {step === 'model' && `${model.relations.length} علاقة · ${model.tables.length} جداول`}
            {step === 'export' && 'جاهز للتصدير أو التطبيق على اللوحة'}
          </div>

          <div className="flex items-center gap-2">
            {step !== 'select' && (
              <button
                onClick={() => setStep(step === 'export' ? 'model' : 'select')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold transition"
              >
                رجوع
              </button>
            )}

            {step === 'select' && (
              <button
                onClick={handleProceedToModel}
                disabled={totalSelected === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                التالي: نموذج العلاقات
              </button>
            )}

            {step === 'model' && (
              <>
                <button
                  onClick={() => setStep('export')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 text-xs font-semibold transition"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  تصدير M-Code
                </button>
                <button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition"
                >
                  {isApplying
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ التطبيق...</>
                    : <><Play className="w-3.5 h-3.5" /> تطبيق على اللوحة</>}
                </button>
              </>
            )}

            {step === 'export' && (
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition"
              >
                {isApplying
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ التطبيق...</>
                  : <><Play className="w-3.5 h-3.5" /> تطبيق على اللوحة</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
