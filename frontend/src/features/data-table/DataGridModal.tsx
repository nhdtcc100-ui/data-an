import React, { useState } from 'react';
import { useDashboardStore } from '../dashboard-builder/DashboardStore';
import {
  Table as TableIcon,
  X,
  Search,
  Plus,
  Trash2,
  Download,
  Check,
  Edit2
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const DataGridModal: React.FC = () => {
  const {
    currentDataSource,
    isDataGridOpen,
    setDataGridOpen,
    updateRawCell,
    addRawRow,
    deleteRawRow
  } = useDashboardStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colName: string } | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [isAddRowOpen, setIsAddRowOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  if (!isDataGridOpen) return null;

  const columns = currentDataSource.columns || [];
  const rows = currentDataSource.rawRows || [];

  // Filter rows by search
  const filteredRows = rows.filter((row) => {
    if (!searchQuery.trim()) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const startEditCell = (rowIndex: number, colName: string, currentVal: any) => {
    setEditingCell({ rowIndex, colName });
    setCellValue(String(currentVal ?? ''));
  };

  const saveCell = () => {
    if (!editingCell) return;
    const colDef = columns.find((c) => c.columnName === editingCell.colName);
    let valToSave: any = cellValue;
    if (colDef?.dataType === 'numeric') {
      const parsed = parseFloat(cellValue);
      valToSave = isNaN(parsed) ? 0 : parsed;
    }
    updateRawCell(editingCell.rowIndex, editingCell.colName, valToSave);
    setEditingCell(null);
  };

  const handleAddNewRow = () => {
    const rowToInsert: Record<string, any> = {};
    for (const col of columns) {
      const val = newRowData[col.columnName];
      if (col.dataType === 'numeric') {
        rowToInsert[col.columnName] = val ? parseFloat(val) || 0 : 0;
      } else {
        rowToInsert[col.columnName] = val || 'قيمة جديدة';
      }
    }
    addRawRow(rowToInsert);
    setIsAddRowOpen(false);
    setNewRowData({});
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${currentDataSource.fileName || 'exported_data'}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] select-none">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <TableIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  مستعرض ومحرر البيانات الحية (Real Data Grid & In-Memory Editor)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  {rows.length.toLocaleString()} سجل فعلي
                </span>
              </div>
              <p className="text-xs text-slate-400">
                الملف النشط: <span className="text-sky-300 font-mono">{currentDataSource.fileName}</span> — أي تعديل هنا ينعكس فورياً وبشكل حي على كافة الرسوم البيانية!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={() => setDataGridOpen(false)}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="ابحث في كافة الحقول والسجلات الحقيقية..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pr-9 pl-3 py-2 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddRowOpen(!isAddRowOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سطر بيانات جديد</span>
            </button>
          </div>
        </div>

        {/* Add Row Drawer / Form */}
        {isAddRowOpen && (
          <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-end gap-3 animate-in slide-in-from-top-2 duration-200">
            {columns.map((col) => (
              <div key={col.id} className="flex-1 min-w-[140px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  {col.columnName} ({col.dataType === 'numeric' ? 'رقم' : 'نص'})
                </label>
                <input
                  type={col.dataType === 'numeric' ? 'number' : 'text'}
                  placeholder={`أدخل ${col.columnName}`}
                  value={newRowData[col.columnName] || ''}
                  onChange={(e) =>
                    setNewRowData({ ...newRowData, [col.columnName]: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-sky-500 outline-none"
                />
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={handleAddNewRow}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> حفظ السطر
              </button>
              <button
                onClick={() => setIsAddRowOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-950/90 text-slate-400 font-bold border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="p-3 w-12 text-center text-slate-600">#</th>
                {columns.map((col) => (
                  <th key={col.id} className="p-3 font-semibold text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span>{col.columnName}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-slate-500 font-mono">
                        {col.dataType}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="p-3 w-16 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {pageRows.map((row, idx) => {
                const globalIndex = (currentPage - 1) * pageSize + idx;
                return (
                  <tr key={globalIndex} className="hover:bg-slate-800/40 transition group">
                    <td className="p-2.5 text-center text-slate-600 font-mono text-[11px]">
                      {globalIndex + 1}
                    </td>

                    {columns.map((col) => {
                      const isEditing =
                        editingCell?.rowIndex === globalIndex && editingCell?.colName === col.columnName;

                      return (
                        <td
                          key={col.id}
                          onDoubleClick={() => startEditCell(globalIndex, col.columnName, row[col.columnName])}
                          className="p-2.5 text-slate-200"
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                type={col.dataType === 'numeric' ? 'number' : 'text'}
                                value={cellValue}
                                onChange={(e) => setCellValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveCell();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                className="bg-slate-950 border border-sky-500 text-white rounded px-2 py-0.5 text-xs w-full outline-none font-mono"
                              />
                              <button
                                onClick={saveCell}
                                className="p-1 rounded bg-sky-500 text-white hover:bg-sky-400"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group/cell">
                              <span className={col.dataType === 'numeric' ? 'font-mono text-sky-300' : ''}>
                                {row[col.columnName] !== undefined && row[col.columnName] !== null
                                  ? typeof row[col.columnName] === 'number'
                                    ? row[col.columnName].toLocaleString()
                                    : String(row[col.columnName])
                                  : '—'}
                              </span>
                              <button
                                onClick={() => startEditCell(globalIndex, col.columnName, row[col.columnName])}
                                className="opacity-0 group-hover/cell:opacity-100 text-slate-500 hover:text-sky-400 p-0.5 rounded transition"
                                title="تعديل القيمة (أو انقر نقراً مزدوجاً)"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => deleteRawRow(globalIndex)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                        title="حذف هذا السجل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="p-10 text-center text-slate-500 text-xs">
                    لا توجد بيانات مطابقة لنتيجة البحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Pagination */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              عرض {Math.min(filteredRows.length, (currentPage - 1) * pageSize + 1)} إلى{' '}
              {Math.min(filteredRows.length, currentPage * pageSize)} من أصل {filteredRows.length} سجل
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition cursor-pointer"
            >
              السابق
            </button>
            <span className="px-2 text-slate-300 font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition cursor-pointer"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
