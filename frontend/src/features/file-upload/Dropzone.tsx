import React, { useState, useRef, useEffect } from 'react';
import { useDashboardStore } from '../dashboard-builder/DashboardStore';
import type { DataSource, Sheet, ColumnDataType } from '../../types/dataSource';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Table,
  X,
  Sparkles,
  AlertCircle,
  Link2,
  RefreshCw,
  Globe,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  ArrowRight,
  Download,
  Layers,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchGoogleSheetData } from '../../services/googleSheetsService';
import {
  PRESET_DATASETS,
  REGIONAL_SALES_RECORDS,
  HR_EMPLOYEES_RECORDS
} from '../../services/sampleDatasets';
import { syncDataSourceToSupabase } from '../../services/supabaseDataService';
import { parseWorksheetSmartTables } from '../../services/smartTableDetection';
import { uploadProjectFile } from '../../services/projectStorageService';

interface DropzoneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_ICONS: Record<ColumnDataType, React.ReactNode> = {
  numeric: <Hash className="w-3.5 h-3.5 text-sky-400" />,
  string: <Type className="w-3.5 h-3.5 text-emerald-400" />,
  date: <Calendar className="w-3.5 h-3.5 text-amber-400" />,
  boolean: <ToggleLeft className="w-3.5 h-3.5 text-violet-400" />
};

export const DropzoneModal: React.FC<DropzoneModalProps> = ({ isOpen, onClose }) => {
  const { setDataSource, currentProjectId, projects, setProjectGoogleSheetUrl } = useDashboardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProject = projects?.find((p) => p.id === currentProjectId);

  const [step, setStep] = useState<'upload' | 'schema'>('upload');
  const [importType, setImportType] = useState<'file' | 'presets' | 'googlesheet'>('file');
  const [autoGenerateSmartDashboard, setAutoGenerateSmartDashboard] = useState<boolean>(true);
  const [isSyncingToDb, setIsSyncingToDb] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Google Sheets state - bound to current project
  const [googleSheetUrlInput, setGoogleSheetUrlInput] = useState<string>(activeProject?.googleSheetUrl || '');
  const [isLoadingGSheet, setIsLoadingGSheet] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setGoogleSheetUrlInput(activeProject?.googleSheetUrl || '');
    }
  }, [isOpen, activeProject?.googleSheetUrl]);

  // File/General state
  const [fileName, setFileName] = useState<string>('');
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [rawUploadedFile, setRawUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Parsed sheets & schema
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  // Column search filter
  const [colSearch, setColSearch] = useState('');

  if (!isOpen) return null;

  const currentSheet = sheets[activeSheetIndex] || sheets[0];
  const filteredCols = currentSheet?.columns.filter(
    (c) => !colSearch || c.columnName.toLowerCase().includes(colSearch.toLowerCase())
  ) ?? [];

  // ─── Real File Upload with Smart Table Detection ───────────────────────────
  const handleFileUpload = (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    setFileName(file.name);
    setFileSizeBytes(file.size);
    setRawUploadedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const parsedSheets: Sheet[] = [];

        workbook.SheetNames.forEach((sheetName, index) => {
          const worksheet = workbook.Sheets[sheetName];
          // ── Smart Table Detection: finds real data tables, skips filter rows ──
          const smartTables = parseWorksheetSmartTables(worksheet, sheetName, index);
          if (smartTables) {
            parsedSheets.push(...smartTables);
          }
        });

        if (parsedSheets.length === 0) throw new Error('الملف فارغ أو لا يحتوي على أي جداول بيانات صالحة.');

        setSheets(parsedSheets);
        setActiveSheetIndex(0);
        setColSearch('');
        setIsUploading(false);
        setStep('schema');
      } catch (err: any) {
        setIsUploading(false);
        setUploadError(err.message || 'حدث خطأ أثناء قراءة ملف Excel.');
      }
    };
    reader.onerror = () => { setIsUploading(false); setUploadError('فشل قراءة الملف من جهازك.'); };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  // ─── Preset Dataset Selection ──────────────────────────────────────────────
  const handleSelectPreset = (ds: DataSource) => {
    setFileName(ds.fileName);
    setFileSizeBytes(ds.fileSizeBytes || 250000);
    setSheets(ds.sheets);
    setActiveSheetIndex(0);
    setColSearch('');
    setStep('schema');
  };

  // ─── Download Sample Excel Template ────────────────────────────────────────
  const handleDownloadSample = (type: 'sales' | 'hr') => {
    try {
      const wb = XLSX.utils.book_new();
      if (type === 'sales') {
        const ws = XLSX.utils.json_to_sheet(REGIONAL_SALES_RECORDS);
        XLSX.utils.book_append_sheet(wb, ws, 'مبيعات_الفروع');
        XLSX.writeFile(wb, 'نموذج_مبيعات_الفروع_2026.xlsx');
      } else {
        const ws = XLSX.utils.json_to_sheet(HR_EMPLOYEES_RECORDS);
        XLSX.utils.book_append_sheet(wb, ws, 'الموارد_البشرية');
        XLSX.writeFile(wb, 'نموذج_الموارد_البشرية_والرواتب_2026.xlsx');
      }
    } catch (err: any) {
      console.error('Download sample error:', err);
    }
  };

  // ─── Google Sheets Fetch ───────────────────────────────────────────────────
  const handleFetchGoogleSheet = async () => {
    const url = googleSheetUrlInput.trim();
    if (!url) { setUploadError('يرجى إدخال رابط Google Sheet.'); return; }
    setUploadError(null);
    setIsLoadingGSheet(true);
    try {
      const gDataSource = await fetchGoogleSheetData(url);
      setSheets(gDataSource.sheets);
      setActiveSheetIndex(0);
      setFileName(gDataSource.fileName);
      setFileSizeBytes(gDataSource.fileSizeBytes);
      setColSearch('');
      setStep('schema');
    } catch (err: any) {
      setUploadError(err.message || 'تعذر جلب البيانات من Google Sheet.');
    } finally {
      setIsLoadingGSheet(false);
    }
  };

  // ─── Change column type ────────────────────────────────────────────────────
  const changeColumnType = (colId: string, newType: ColumnDataType) => {
    setSheets(sheets.map((sh, idx) =>
      idx !== activeSheetIndex ? sh : {
        ...sh,
        columns: sh.columns.map((col) => col.id === colId ? { ...col, dataType: newType } : col)
      }
    ));
  };

  // ─── Save & apply ─────────────────────────────────────────────────────────
  const handleSaveAndConfirm = async () => {
    if (!currentSheet) return;
    const newDataSource: DataSource = {
      id: `ds-${Date.now()}`,
      workspaceId: 'ws-main',
      fileName,
      fileSizeBytes,
      uploadedAt: new Date().toISOString(),
      sheets,
      activeSheetId: currentSheet.id,
      columns: currentSheet.columns,
      rawRows: currentSheet.rawRows || []
    };
    
    // Apply immediately to the dashboard (with smart widget auto-generation)
    setDataSource(newDataSource, autoGenerateSmartDashboard);

    // If imported from Google Sheets, store URL specifically for this project
    if (importType === 'googlesheet' && googleSheetUrlInput.trim()) {
      setProjectGoogleSheetUrl(currentProjectId, googleSheetUrlInput.trim());
    }

    // Backup original raw file to Supabase Storage partitioned by project
    if (rawUploadedFile) {
      uploadProjectFile(currentProjectId || 'proj-default', rawUploadedFile, fileName).catch((storageErr) => {
        console.warn('Notice: project file storage backup failed:', storageErr);
      });
    }

    // Sync to Supabase in background
    setIsSyncingToDb(true);
    setSyncStatus(null);
    try {
      const result = await syncDataSourceToSupabase(newDataSource, { sourceName: fileName || currentSheet.name });
      if (result.success) {
        setSyncStatus({ success: true, message: `✅ تم الحفظ في قاعدة البيانات (${result.rowsInserted?.toLocaleString()} صف)` });
        setTimeout(() => onClose(), 1200);
      } else {
        setSyncStatus({ success: false, message: `⚠️ البيانات محملة ومطبقة محلياً — خطأ DB: ${result.error}` });
        setTimeout(() => onClose(), 2000);
      }
    } catch (err: any) {
      setSyncStatus({ success: false, message: '⚠️ البيانات محملة ومطبقة محلياً بالكامل' });
      setTimeout(() => onClose(), 1500);
    } finally {
      setIsSyncingToDb(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden select-none flex flex-col max-h-[92vh]">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
        />

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>استيراد وتغيير ملفات البيانات (Excel / CSV)</span>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  Power BI Engine
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ارفع أي ملف Excel من جهازك أو اختر نموذجاً تجريبياً — يتم استخراج الحقول وتوليد لوحة مؤشرات ذكية تلقائياً
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {step === 'upload' ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-800 gap-4 text-xs font-bold">
                <button
                  onClick={() => { setImportType('file'); setUploadError(null); }}
                  className={`flex items-center gap-1.5 pb-2.5 border-b-2 transition cursor-pointer ${
                    importType === 'file'
                      ? 'border-sky-500 text-sky-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>رفع ملف من الجهاز (Excel / CSV)</span>
                </button>

                <button
                  onClick={() => { setImportType('presets'); setUploadError(null); }}
                  className={`flex items-center gap-1.5 pb-2.5 border-b-2 transition cursor-pointer ${
                    importType === 'presets'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>نماذج بيانات متنوعة جاهزة</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-normal">تبديل فوري</span>
                </button>

                <button
                  onClick={() => { setImportType('googlesheet'); setUploadError(null); }}
                  className={`flex items-center gap-1.5 pb-2.5 border-b-2 transition cursor-pointer ${
                    importType === 'googlesheet'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>ربط مباشر بـ Google Sheets</span>
                </button>
              </div>

              {/* ── 1. Local File Dropzone ── */}
              {importType === 'file' && (
                <div className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-sky-500 bg-slate-950/60 hover:bg-slate-900/40 rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer group"
                  >
                    <div className="p-4 rounded-full bg-slate-900 border border-slate-800 group-hover:scale-110 group-hover:border-sky-500/50 transition-all mb-3 text-sky-400 shadow-inner">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-200 group-hover:text-sky-300">
                      اسحب وأفلت أي ملف Excel أو CSV هنا
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      أو انقر لاختيار الملف من حاسوبك (يدعم جداول المبيعات، الرواتب، الفواتير، المخزون، وغيرها)
                    </p>
                    <div className="mt-4 flex gap-2">
                      {['.XLSX', '.CSV', '.XLS'].map((ext, i) => (
                        <span key={ext} className={`text-[10px] px-2.5 py-1 rounded font-mono border border-slate-700 bg-slate-800 ${
                          i === 0 ? 'text-sky-300' : i === 1 ? 'text-emerald-300' : 'text-amber-300'
                        }`}>{ext}</span>
                      ))}
                    </div>
                  </div>

                  {isUploading && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-400">جارٍ قراءة الملف واستخراج الأعمدة والأنواع...</p>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-sky-500 h-full w-full animate-pulse" />
                      </div>
                    </div>
                  )}

                  {/* Ready Sample Excel Download Buttons */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-200">تحميل نماذج تجريبية بصيغة Excel (.xlsx)</h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">حمّل نموذجاً واملأه ببياناتك أو ارفعه مباشرة لتجربة المنصة</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadSample('sales'); }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Download className="w-3 h-3" />
                        <span>نموذج المبيعات (.xlsx)</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadSample('hr'); }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Download className="w-3 h-3" />
                        <span>نموذج الموظفين (.xlsx)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 2. Preset Datasets Tab ── */}
              {importType === 'presets' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    اختر أي مجموعة بيانات لتغيير بيانات المنصة وإنشاء لوحة مؤشرات فورية دون الحاجة لرفع ملف خارجي:
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {PRESET_DATASETS.map((preset) => (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset.dataSource)}
                        className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/60 transition cursor-pointer flex items-center justify-between group shadow-sm"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition">
                            {preset.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-100 group-hover:text-indigo-300 transition truncate">
                                {preset.title}
                              </h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                                {preset.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                              {preset.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-slate-500 font-mono">
                            {preset.rowCount.toLocaleString()} سجل
                          </span>
                          <button className="px-3 py-1.5 rounded-lg bg-indigo-600/20 group-hover:bg-indigo-600 group-hover:text-white text-indigo-300 border border-indigo-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
                            <span>اختيار ومعاينة</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 3. Google Sheets Panel ── */}
              {importType === 'googlesheet' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-emerald-400" />
                        <span>رابط ملف Google Sheets:</span>
                      </label>
                      <div className="flex items-stretch gap-2">
                        <input
                          type="url"
                          dir="ltr"
                          value={googleSheetUrlInput}
                          onChange={(e) => { setGoogleSheetUrlInput(e.target.value); setUploadError(null); }}
                          onKeyDown={(e) => e.key === 'Enter' && handleFetchGoogleSheet()}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="flex-1 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-xs text-emerald-300 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition"
                        />
                        <button
                          onClick={handleFetchGoogleSheet}
                          disabled={isLoadingGSheet}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {isLoadingGSheet
                            ? <RefreshCw className="w-4 h-4 animate-spin" />
                            : <ArrowRight className="w-4 h-4" />
                          }
                          <span>{isLoadingGSheet ? 'جارٍ الجلب...' : 'جلب وتحليل البيانات'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      {[
                        { n: '1', title: 'افتح الشيت في جوجل', body: 'اذهب إلى Google Sheets وافتح الملف المطلوب' },
                        { n: '2', title: 'انسخ رابط الملف', body: 'من شريط العنوان أو زر «مشاركة» ▶ «نسخ الرابط»' },
                        { n: '3', title: 'الصق الرابط هنا', body: 'أدرج الرابط في المربع أعلاه ثم اضغط «جلب وتحليل البيانات»' },
                      ].map((s) => (
                        <div key={s.n} className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black flex items-center justify-center shrink-0">{s.n}</div>
                          <span className="font-bold text-slate-200">{s.title}</span>
                          <span className="text-slate-400 leading-relaxed">{s.body}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 flex gap-2.5 text-[11px]">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 text-slate-400">
                        <span className="font-bold text-amber-300 block">يجب أن يكون الملف مشتركاً بشكل عام:</span>
                        <span>في شيت جوجل: اضغط <span className="text-emerald-300 font-bold">«مشاركة (Share)»</span> ← <span className="text-emerald-300 font-bold">«أي شخص لديه الرابط — يمكنه العرض»</span>.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {uploadError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-relaxed">{uploadError}</span>
                </div>
              )}
            </>
          ) : (
            /* ── Step 2: Schema / Column Mapper ── */
            <div className="space-y-4">
              {/* Success Banner */}
              <div className="bg-emerald-500/8 border border-emerald-500/25 rounded-xl p-3.5 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-emerald-300">
                    ✅ تم استخراج المخطط بنجاح — {currentSheet?.columns.length} عمود · {(currentSheet?.rowCount ?? 0).toLocaleString()} سجل
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {fileName || 'ملف البيانات'} — راجع الأعمدة وعدّل أنواعها إذا لزم ثم اضغط «تأكيد»
                  </div>
                </div>
              </div>

              {/* Smart Auto-Generate Dashboard Option */}
              <label className="flex items-center gap-3.5 p-3.5 bg-gradient-to-r from-sky-950/70 via-indigo-950/50 to-slate-900 border border-sky-500/30 rounded-xl cursor-pointer hover:border-sky-400/60 transition select-none shadow-md">
                <input
                  type="checkbox"
                  checked={autoGenerateSmartDashboard}
                  onChange={(e) => setAutoGenerateSmartDashboard(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 accent-sky-500 cursor-pointer shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-sky-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>توليد لوحة مؤشرات وتحليلات ذكية تلقائياً لهذا الملف (Power BI Style)</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                      موصى به
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {autoGenerateSmartDashboard
                      ? 'سيتم استبدال الرسوم الثابتة ببطاقات KPI ومخططات بيانية وجدول تفصيلي وفلاتر مخصصة تماماً لأعمدة هذا الملف'
                      : 'سيتم الاحتفاظ بالرسوم الحالية ومحاولة ربطها بأعمدة الملف الجديد'}
                  </p>
                </div>
              </label>

              {/* Sheet Tabs */}
              {sheets.length > 1 && (
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-bold text-slate-500">الأوراق:</span>
                  {sheets.map((sh, idx) => (
                    <button
                      key={sh.id}
                      onClick={() => { setActiveSheetIndex(idx); setColSearch(''); }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        idx === activeSheetIndex
                          ? 'bg-sky-500 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Table className="w-3.5 h-3.5" />
                      <span>{sh.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({sh.rowCount.toLocaleString()})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Column Search */}
              <div className="relative">
                <input
                  type="text"
                  value={colSearch}
                  onChange={(e) => setColSearch(e.target.value)}
                  placeholder="ابحث عن عمود..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 outline-none"
                />
                {colSearch && (
                  <button
                    onClick={() => setColSearch('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Columns Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3 text-right">اسم العمود</th>
                        <th className="p-3">نوع البيانات</th>
                        <th className="p-3">عينة من القيم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredCols.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-slate-500 text-xs">
                            لا توجد أعمدة مطابقة للبحث
                          </td>
                        </tr>
                      )}
                      {filteredCols.map((col) => (
                        <tr key={col.id} className="hover:bg-slate-800/30 transition group">
                          {/* Column Name */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="p-1 rounded bg-slate-800 group-hover:bg-slate-700 transition">
                                {TYPE_ICONS[col.dataType]}
                              </span>
                              <span className="font-semibold text-slate-100">{col.columnName}</span>
                            </div>
                          </td>

                          {/* Type Selector */}
                          <td className="p-3">
                            <select
                              value={col.dataType}
                              onChange={(e) => changeColumnType(col.id, e.target.value as ColumnDataType)}
                              className={`bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 transition ${
                                col.dataType === 'numeric'
                                  ? 'border-sky-700/60 text-sky-300 focus:ring-sky-500/30 focus:border-sky-500'
                                  : col.dataType === 'date'
                                  ? 'border-amber-700/60 text-amber-300 focus:ring-amber-500/30 focus:border-amber-500'
                                  : col.dataType === 'boolean'
                                  ? 'border-violet-700/60 text-violet-300 focus:ring-violet-500/30 focus:border-violet-500'
                                  : 'border-emerald-700/60 text-emerald-300 focus:ring-emerald-500/30 focus:border-emerald-500'
                              }`}
                            >
                              <option value="string">نص / فئة (Text)</option>
                              <option value="numeric">رقمي / قياس (Numeric)</option>
                              <option value="date">تاريخ (Date)</option>
                              <option value="boolean">منطقي (Boolean)</option>
                            </select>
                          </td>

                          {/* Sample Values */}
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {(col.sampleValues ?? []).slice(0, 3).map((v, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700/60 max-w-[120px] truncate">
                                  {String(v)}
                                </span>
                              ))}
                              {(!col.sampleValues || col.sampleValues.length === 0) && (
                                <span className="text-slate-600">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Column Count Footer */}
                <div className="bg-slate-950/80 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{filteredCols.length} عمود{colSearch ? ` (فلترة من ${currentSheet?.columns.length})` : ''}</span>
                  <span>{(currentSheet?.rowCount ?? 0).toLocaleString()} سجل</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between shrink-0">
          {step === 'schema' ? (
            <button
              onClick={() => { setStep('upload'); setUploadError(null); setSyncStatus(null); }}
              className="text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer flex items-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              الرجوع لاختيار مصدر آخر
            </button>
          ) : (
            <span className="text-xs text-slate-500 font-mono">LENS BI — DuckDB OLAP Engine</span>
          )}

          <div className="flex flex-col items-end gap-2">
            {/* Sync status message */}
            {syncStatus && (
              <div className={`text-[11px] px-3 py-1.5 rounded-lg font-medium ${syncStatus.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                {syncStatus.message}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                إلغاء
              </button>

              {step === 'upload' ? (
                importType === 'googlesheet' ? (
                  <button
                    onClick={handleFetchGoogleSheet}
                    disabled={isLoadingGSheet}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoadingGSheet
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Globe className="w-3.5 h-3.5" />
                    }
                    <span>{isLoadingGSheet ? 'جارٍ الجلب...' : 'جلب بيانات الشيت'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition shadow-md shadow-sky-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>اختيار ملف من الجهاز</span>
                  </button>
                )
              ) : (
                <button
                  onClick={handleSaveAndConfirm}
                  disabled={isSyncingToDb}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/25 cursor-pointer flex items-center gap-2 disabled:opacity-70"
                >
                  {isSyncingToDb ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>جارٍ التطبيق والمزامنة...</span></>
                  ) : (
                    <><Check className="w-4 h-4" /><span>تأكيد وتطبيق على لوحة التحكم</span></>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
