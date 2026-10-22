// ==============================================================================
// localFileWatcherService.ts
// خدمة المراقبة الحية للملفات المحلية على الحاسوب (Live File Watcher)
// تعمل مثل Power Query: تراقب ملف Excel أو CSV المحلي في الوقت الفعلي
// وتحدث لوحة التحكم والتقارير تلقائياً بمجرد حفظ أي تعديل في الملف (Ctrl+S)
// ==============================================================================

import * as XLSX from 'xlsx';
import type { TableEntry } from '../types/dataSource';
import { parseWorksheetSmartTables } from './smartTableDetection';

export interface LiveWatcherStats {
  addedRows: number;
  totalRows: number;
  modifiedAt: Date;
  tableName: string;
}

export interface LiveWatcherStatus {
  isSupported: boolean;
  isWatching: boolean;
  fileName: string | null;
  fileSizeBytes: number;
  lastModified: number;
  lastChecked: Date | null;
  updateCount: number;
  intervalMs: number;
  error: string | null;
  tableCount: number;
}

export type LiveWatcherListener = (status: LiveWatcherStatus) => void;
export type LiveDataUpdateListener = (
  tables: TableEntry[],
  stats: LiveWatcherStats
) => void;

class LocalFileWatcherService {
  private fileHandle: any = null;
  private timerId: any = null;
  private isChecking = false;

  private status: LiveWatcherStatus = {
    isSupported: typeof window !== 'undefined' && 'showOpenFilePicker' in window,
    isWatching: false,
    fileName: null,
    fileSizeBytes: 0,
    lastModified: 0,
    lastChecked: null,
    updateCount: 0,
    intervalMs: 3000, // 3 seconds default for instant responsiveness
    error: null,
    tableCount: 0,
  };

  private prevRowCount = 0;
  private statusListeners = new Set<LiveWatcherListener>();
  private dataListeners = new Set<LiveDataUpdateListener>();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
  }

  public getStatus(): LiveWatcherStatus {
    return { ...this.status };
  }

  public subscribeStatus(listener: LiveWatcherListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  public onDataUpdate(listener: LiveDataUpdateListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((l) => {
      try {
        l(s);
      } catch (err) {
        console.error('Status listener error:', err);
      }
    });
  }

  private notifyData(tables: TableEntry[], stats: LiveWatcherStats) {
    this.dataListeners.forEach((l) => {
      try {
        l(tables, stats);
      } catch (err) {
        console.error('Data listener error:', err);
      }
    });
  }

  /**
   * فتح نافذة اختيار ملف محلي والبدء في مراقبته وتحديثه تلقائياً
   */
  public async pickAndStartWatching(
    intervalMs = 3000
  ): Promise<{ tables: TableEntry[]; fileName: string; fileSizeBytes: number }> {
    if (!this.isSupported()) {
      throw new Error(
        'متصفحك لا يدعم خاصية File System Access API للمراقبة الحية المباشرة. يمكنك استخدام ميزة رفع الملفات العادية.'
      );
    }

    try {
      // إيقاف أي مراقبة سابقة
      this.stop();

      const pickerOpts = {
        types: [
          {
            description: 'جداول بيانات Excel أو CSV',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              'application/vnd.ms-excel': ['.xls'],
              'text/csv': ['.csv'],
            },
          },
        ],
        excludeAcceptAllOption: false,
        multiple: false,
      };

      const [handle] = await (window as any).showOpenFilePicker(pickerOpts);
      if (!handle) {
        throw new Error('لم يتم اختيار ملف');
      }

      this.fileHandle = handle;
      const file: File = await handle.getFile();

      this.status.fileName = file.name;
      this.status.fileSizeBytes = file.size;
      this.status.lastModified = file.lastModified;
      this.status.intervalMs = intervalMs;
      this.status.error = null;
      this.status.updateCount = 0;

      // قراءة أولية للملف
      const tables = await this.parseFileContent(file);
      this.status.tableCount = tables.length;
      this.prevRowCount = tables.reduce((acc, t) => acc + (t.rowCount || 0), 0);

      // بدء المؤقت الدوري لفحص التعديلات
      this.startPolling(intervalMs);

      return {
        tables,
        fileName: file.name,
        fileSizeBytes: file.size,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('تم إلغاء اختيار الملف');
      }
      this.status.error = err.message || 'فشل في قراءة الملف المحلي';
      this.notifyStatus();
      throw err;
    }
  }

  /**
   * ربط مقبض ملف تم اختياره مسبقاً (FileSystemFileHandle)
   */
  public async attachFileHandle(
    handle: any,
    intervalMs = 3000
  ): Promise<{ tables: TableEntry[]; fileName: string }> {
    this.stop();
    this.fileHandle = handle;
    const file: File = await handle.getFile();

    this.status.fileName = file.name;
    this.status.fileSizeBytes = file.size;
    this.status.lastModified = file.lastModified;
    this.status.intervalMs = intervalMs;
    this.status.error = null;

    const tables = await this.parseFileContent(file);
    this.status.tableCount = tables.length;
    this.prevRowCount = tables.reduce((acc, t) => acc + (t.rowCount || 0), 0);

    this.startPolling(intervalMs);
    return { tables, fileName: file.name };
  }

  /**
   * بدء مؤقت الفحص الدوري
   */
  private startPolling(intervalMs: number) {
    if (this.timerId) clearInterval(this.timerId);

    this.status.isWatching = true;
    this.status.intervalMs = intervalMs;
    this.notifyStatus();

    this.timerId = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);
  }

  /**
   * فحص التغييرات يدوياً أو تلقائياً (مثل زر Refresh Now في Power Query)
   */
  public async checkForUpdates(force = false): Promise<boolean> {
    if (!this.fileHandle || this.isChecking) return false;

    this.isChecking = true;
    try {
      const file: File = await this.fileHandle.getFile();
      this.status.lastChecked = new Date();
      this.status.fileSizeBytes = file.size;

      const hasChanged =
        force ||
        file.lastModified > this.status.lastModified ||
        file.size !== this.status.fileSizeBytes;

      if (hasChanged) {
        console.log(
          `[LiveFileWatcher] Detected file change on disk: ${file.name} (lastModified: ${file.lastModified})`
        );
        this.status.lastModified = file.lastModified;

        const tables = await this.parseFileContent(file);
        const newTotalRows = tables.reduce((acc, t) => acc + (t.rowCount || 0), 0);
        const addedRows = newTotalRows - this.prevRowCount;
        this.prevRowCount = newTotalRows;

        this.status.tableCount = tables.length;
        this.status.updateCount += 1;
        this.status.error = null;

        const stats: LiveWatcherStats = {
          addedRows,
          totalRows: newTotalRows,
          modifiedAt: new Date(file.lastModified),
          tableName: tables[0]?.name || file.name,
        };

        this.notifyStatus();
        this.notifyData(tables, stats);
        return true;
      } else {
        this.notifyStatus();
        return false;
      }
    } catch (err: any) {
      console.warn('[LiveFileWatcher] Check error:', err);
      this.status.error = err.message || 'خطأ في فحص الملف المحلي';
      this.notifyStatus();
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * تغيير مدة التردد (مثلاً كل 3 ثوانٍ، 10 ثوانٍ، دقيقة)
   */
  public setIntervalMs(ms: number) {
    this.status.intervalMs = ms;
    if (this.status.isWatching && this.fileHandle) {
      this.startPolling(ms);
    } else {
      this.notifyStatus();
    }
  }

  /**
   * إيقاف مؤقت أو دائم للمراقبة
   */
  public stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.status.isWatching = false;
    this.notifyStatus();
  }

  /**
   * استئناف المراقبة إذا كان المقبض موجوداً
   */
  public resume() {
    if (this.fileHandle && !this.status.isWatching) {
      this.startPolling(this.status.intervalMs);
    }
  }

  /**
   * مسح الملف والمقبض بالكامل
   */
  public clear() {
    this.stop();
    this.fileHandle = null;
    this.status = {
      isSupported: this.isSupported(),
      isWatching: false,
      fileName: null,
      fileSizeBytes: 0,
      lastModified: 0,
      lastChecked: null,
      updateCount: 0,
      intervalMs: 3000,
      error: null,
      tableCount: 0,
    };
    this.prevRowCount = 0;
    this.notifyStatus();
  }

  /**
   * قراءة محتوى الملف وتحويله إلى TableEntry[]
   */
  private async parseFileContent(file: File): Promise<TableEntry[]> {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const tables: TableEntry[] = [];

    workbook.SheetNames.forEach((sheetName, idx) => {
      const ws = workbook.Sheets[sheetName];
      const smartTables = parseWorksheetSmartTables(ws, sheetName, idx);
      if (smartTables && smartTables.length > 0) {
        smartTables.forEach((st, ti) => {
          tables.push({
            id: `live-tbl-${idx}-${ti}`,
            name: st.name,
            sourceType: 'file',
            fileName: file.name,
            columns: st.columns || [],
            rawRows: st.rawRows || [],
            rowCount: st.rowCount || 0,
            uploadedAt: new Date().toISOString(),
          });
        });
      }
    });

    if (tables.length === 0) {
      throw new Error(`الملف ${file.name} لا يحتوي على أي جداول بيانات قابلة للقراءة`);
    }

    return tables;
  }
}

// Singleton instance
export const liveWatcherService = new LocalFileWatcherService();
