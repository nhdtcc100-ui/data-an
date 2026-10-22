import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  LayoutDashboard,
  Eye,
  Lock,
  Globe,
  Clock,
  ChevronLeft,
  Copy,
  Trash2,
  Edit3,
  CheckCircle2,
  FileSpreadsheet,
  X,
  Sparkles,
  Link2
} from 'lucide-react';
import { useDashboardStore } from '../dashboard-builder/DashboardStore';
import { PROJECT_COLOR_ACCENTS, PROJECT_CATEGORIES, type CreateProjectOptions } from '../../types/project';

interface WorkspaceListProps {
  onSelectDashboard: () => void;
  onOpenUpload: () => void;
}

// ─── New Project Modal ────────────────────────────────────────────────────────
const QUICK_TEMPLATES = [
  { title: 'لوحة مبيعات وعروض أسعار', icon: '💰', category: 'sales', colorAccent: 'sky' as const, dataSourceType: 'empty' as const, description: 'تحليل الأسعار والعروض والمقارنة بين الموردين' },
  { title: 'لوحة تسويق وإعلانات', icon: '📢', category: 'marketing', colorAccent: 'violet' as const, dataSourceType: 'empty' as const, description: 'متابعة حملات التسويق وتحليل العائد والانتشار' },
  { title: 'لوحة موارد بشرية', icon: '👥', category: 'hr', colorAccent: 'emerald' as const, dataSourceType: 'empty' as const, description: 'إدارة الموظفين والأداء وتقارير الحضور' },
  { title: 'لوحة مالية ومحاسبة', icon: '📊', category: 'finance', colorAccent: 'amber' as const, dataSourceType: 'empty' as const, description: 'تتبع الإيرادات والمصروفات والميزانيات' },
  { title: 'لوحة عمليات ولوجستيات', icon: '⚙️', category: 'operations', colorAccent: 'cyan' as const, dataSourceType: 'empty' as const, description: 'رصد سلاسل التوريد والمخزون والتسليمات' },
];

interface NewProjectModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onCreated }) => {
  const { createProject } = useDashboardStore();
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [selectedType, setSelectedType] = useState<'google_sheets' | 'excel_csv' | 'empty' | null>(null);
  const [form, setForm] = useState<Partial<CreateProjectOptions>>({ colorAccent: 'sky', icon: '📊' });

  const handleCreate = () => {
    if (!form.title?.trim()) return;
    const id = createProject({
      title: form.title.trim(),
      description: form.description,
      category: form.category,
      icon: form.icon || '📊',
      colorAccent: form.colorAccent || 'sky',
      dataSourceType: selectedType || 'empty',
      googleSheetUrl: form.googleSheetUrl
    });
    onCreated(id);
  };

  const handleTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    const id = createProject({
      title: tpl.title,
      description: tpl.description,
      icon: tpl.icon,
      category: tpl.category,
      colorAccent: tpl.colorAccent,
      dataSourceType: tpl.dataSourceType
    });
    onCreated(id);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100">إنشاء مشروع جديد</h2>
              <p className="text-xs text-slate-400 mt-0.5">كل مشروع مستقل ببياناته ولوحاته ورابطه الخاص</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'type' ? (
          <div className="p-6 space-y-6">
            {/* Source Type Selection */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">اختر مصدر البيانات</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { type: 'google_sheets' as const, icon: '🟢', label: 'Google Sheets', sub: 'مزامنة حية ومباشرة' },
                  { type: 'excel_csv' as const, icon: '📑', label: 'Excel / CSV', sub: 'رفع ملف بيانات' },
                  { type: 'empty' as const, icon: '⬜', label: 'لوحة فارغة', sub: 'ابدأ من الصفر' },
                ].map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => { setSelectedType(opt.type); setStep('form'); }}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/60 transition group cursor-pointer"
                  >
                    <span className="text-3xl">{opt.icon}</span>
                    <span className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition">{opt.label}</span>
                    <span className="text-[10px] text-slate-500">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Templates */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                قوالب جاهزة
              </p>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_TEMPLATES.map((tpl) => {
                  const accent = PROJECT_COLOR_ACCENTS.find((a) => a.name === tpl.colorAccent) || PROJECT_COLOR_ACCENTS[0];
                  return (
                    <button
                      key={tpl.title}
                      onClick={() => handleTemplate(tpl)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-sky-500/40 text-right transition cursor-pointer group"
                    >
                      <span className="text-2xl">{tpl.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition">{tpl.title}</div>
                        <div className="text-[10px] text-slate-500 truncate">{tpl.description}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${accent.bg} ${accent.text} border ${accent.border}`}>
                        قالب
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <button onClick={() => setStep('type')} className="text-xs text-sky-400 hover:text-sky-300 transition font-semibold flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
              رجوع
            </button>

            {/* Project Name */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">اسم المشروع *</label>
              <input
                autoFocus
                type="text"
                placeholder="مثال: تحليل مبيعات 2026"
                value={form.title || ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 focus:border-sky-500/60 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">الوصف (اختياري)</label>
              <input
                type="text"
                placeholder="وصف مختصر للمشروع..."
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 focus:border-sky-500/60 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>

            {/* Google Sheet URL (conditional) */}
            {selectedType === 'google_sheets' && (
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">رابط Google Sheet</label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={form.googleSheetUrl || ''}
                  onChange={(e) => setForm({ ...form, googleSheetUrl: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500/60 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition font-mono text-xs"
                />
              </div>
            )}

            {/* Icon + Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">أيقونة المشروع</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {['📊', '💰', '📢', '👥', '⚙️', '🔒', '📑', '🌐', '🏭', '📈'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setForm({ ...form, icon: emoji })}
                      className={`p-2 rounded-xl text-lg transition cursor-pointer border ${form.icon === emoji ? 'bg-sky-500/20 border-sky-500/60' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">لون الهوية</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PROJECT_COLOR_ACCENTS.map((accent) => (
                    <button
                      key={accent.name}
                      onClick={() => setForm({ ...form, colorAccent: accent.name })}
                      className={`py-2 rounded-xl text-[10px] font-bold transition cursor-pointer border ${form.colorAccent === accent.name ? `${accent.bg} ${accent.text} ${accent.border}` : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      {accent.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={!form.title?.trim()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-sky-500/20 transition cursor-pointer"
            >
              إنشاء المشروع
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main WorkspaceList ────────────────────────────────────────────────────────
export const WorkspaceList: React.FC<WorkspaceListProps> = ({
  onSelectDashboard,
  onOpenUpload
}) => {
  const {
    projects,
    currentProjectId,
    switchProject,
    duplicateProject,
    deleteProject,
    updateProjectMeta,
    setProjectGoogleSheetUrl
  } = useDashboardStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [sheetModalProj, setSheetModalProj] = useState<{ id: string; title: string; url: string } | null>(null);
  const [sheetModalUrl, setSheetModalUrl] = useState('');

  const handleSaveSheetUrl = () => {
    if (sheetModalProj) {
      setProjectGoogleSheetUrl(sheetModalProj.id, sheetModalUrl.trim());
      setSheetModalProj(null);
    }
  };

  const handleOpenProject = (projectId: string) => {
    switchProject(projectId);
    onSelectDashboard();
  };

  const handleDuplicate = (projectId: string) => {
    duplicateProject(projectId);
  };

  const handleDelete = (projectId: string, title: string) => {
    if (projects.length <= 1) {
      alert('لا يمكن حذف المشروع الأخير.');
      return;
    }
    if (window.confirm(`هل تريد حذف مشروع "${title}"؟ سيُحذف نهائياً.`)) {
      deleteProject(projectId);
    }
  };

  const handleRenameStart = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleRenameCommit = () => {
    if (editingId && editTitle.trim()) {
      updateProjectMeta(editingId, { title: editTitle.trim() });
    }
    setEditingId(null);
    setEditTitle('');
  };

  const totalWidgets = projects.reduce((sum, p) => sum + p.dashboard.widgets.length, 0);
  const totalRecords = projects.reduce((sum, p) => sum + (p.dataSource?.rawRows?.length || 0), 0);

  return (
    <>
      {showNewModal && (
        <NewProjectModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => { setShowNewModal(false); handleOpenProject(id); }}
        />
      )}

      {sheetModalProj && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSheetModalProj(null)}>
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">رابط Google Sheet الخاص بالمشروع</h3>
                  <p className="text-xs text-slate-400 font-semibold text-emerald-400">{sheetModalProj.title}</p>
                </div>
              </div>
              <button onClick={() => setSheetModalProj(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 leading-relaxed">
                ✨ هذا الرابط مخصص حصرياً لهذا المشروع، ولن يتداخل مع أي مشروع آخر.
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">رابط ملف Google Sheet</label>
                <input
                  type="url"
                  value={sheetModalUrl}
                  onChange={(e) => setSheetModalUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500/60 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                💡 تأكد من اختيار: «أي شخص لديه الرابط يمكنه العرض» في إعدادات مشاركة الشيت.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSheetModalProj(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveSheetUrl}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                حفظ الرابط للمشروع
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 bg-slate-950/70 select-none custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ── Workspace Banner ── */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                <FolderKanban className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-100">مساحة العمل الرئيسية</h1>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">Owner</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {projects.length} مشاريع مستقلة • {totalWidgets} عنصر مرئي • {totalRecords.toLocaleString()} سجل
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onOpenUpload}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>رفع بيانات Excel</span>
              </button>

              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>مشروع جديد</span>
              </button>
            </div>
          </div>

          {/* ── Projects Grid ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-sky-400" />
                <span>المشاريع والتقارير ({projects.length})</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj) => {
                const accent = PROJECT_COLOR_ACCENTS.find((a) => a.name === proj.colorAccent) || PROJECT_COLOR_ACCENTS[0];
                const isActive = proj.id === currentProjectId;
                const categoryInfo = PROJECT_CATEGORIES.find((c) => c.value === proj.category);
                const recordCount = proj.dataSource?.rawRows?.length || 0;

                return (
                  <div
                    key={proj.id}
                    className={`group bg-slate-900/90 hover:bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 shadow-lg ${
                      isActive
                        ? `border-sky-500/60 shadow-sky-500/10`
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Top row: icon + status */}
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent.from} ${accent.to} flex items-center justify-center text-xl shadow-md`}>
                            {proj.icon || '📊'}
                          </div>
                          <div>
                            {editingId === proj.id ? (
                              <input
                                autoFocus
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={handleRenameCommit}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCommit(); if (e.key === 'Escape') setEditingId(null); }}
                                className="text-xs font-bold bg-slate-800 border border-sky-500/60 rounded-lg px-2 py-1 text-slate-100 outline-none w-36"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <h3
                                className={`text-sm font-bold transition-colors ${isActive ? 'text-sky-300' : 'text-slate-100 group-hover:text-sky-300'}`}
                              >
                                {proj.title}
                              </h3>
                            )}
                            {categoryInfo && (
                              <span className="text-[10px] text-slate-500">{categoryInfo.icon} {categoryInfo.label}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isActive && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/25 font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              نشط
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                            proj.isPublic
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {proj.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          </span>
                        </div>
                      </div>

                      {proj.description && (
                        <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">{proj.description}</p>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className={`p-2 rounded-xl text-center ${accent.bg} border ${accent.border}`}>
                          <div className={`text-sm font-black ${accent.text}`}>{proj.dashboard.widgets.length}</div>
                          <div className="text-[9px] text-slate-500">عنصر</div>
                        </div>
                        <div className="p-2 rounded-xl text-center bg-slate-800/80 border border-slate-700">
                          <div className="text-sm font-black text-slate-300">{recordCount.toLocaleString()}</div>
                          <div className="text-[9px] text-slate-500">سجل</div>
                        </div>
                        <div className="p-2 rounded-xl text-center bg-slate-800/80 border border-slate-700">
                          <div className="text-[9px] font-bold text-slate-300 mt-1">
                            {proj.dataSourceType === 'google_sheets' ? '🟢' : '📑'}
                          </div>
                          <div className="text-[9px] text-slate-500">
                            {proj.dataSourceType === 'google_sheets' ? 'Sheets' : 'File'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer: time + actions */}
                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(proj.updatedAt).toLocaleDateString('ar-SA')}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Rename */}
                        <button
                          onClick={() => handleRenameStart(proj.id, proj.title)}
                          title="إعادة تسمية"
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {/* Edit Google Sheet URL */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSheetModalProj({ id: proj.id, title: proj.title, url: proj.googleSheetUrl || '' });
                            setSheetModalUrl(proj.googleSheetUrl || '');
                          }}
                          title={proj.googleSheetUrl ? "تعديل رابط Google Sheet المخصص لهذا المشروع" : "ربط Google Sheet بهذا المشروع"}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            proj.googleSheetUrl
                              ? 'text-emerald-400 hover:bg-emerald-500/20'
                              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                        {/* Duplicate */}
                        <button
                          onClick={() => handleDuplicate(proj.id)}
                          title="تكرار المشروع"
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {/* View (public) */}
                        <button
                          title="عرض التقرير"
                          className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete */}
                        {projects.length > 1 && (
                          <button
                            onClick={() => handleDelete(proj.id, proj.title)}
                            title="حذف المشروع"
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition cursor-pointer opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* Open */}
                        <button
                          onClick={() => handleOpenProject(proj.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isActive
                              ? `bg-gradient-to-r ${accent.from} ${accent.to} text-white shadow-md`
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          <span>{isActive ? 'متابعة' : 'فتح'}</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Project Card */}
              <button
                onClick={() => setShowNewModal(true)}
                className="group border-2 border-dashed border-slate-700 hover:border-sky-500/60 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:-translate-y-1 cursor-pointer min-h-[200px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-sky-500/10 border border-slate-700 group-hover:border-sky-500/40 flex items-center justify-center transition">
                  <Plus className="w-6 h-6 text-slate-500 group-hover:text-sky-400 transition" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-400 group-hover:text-sky-400 transition">إنشاء مشروع جديد</p>
                  <p className="text-xs text-slate-600 mt-1">Google Sheets, Excel, أو قالب جاهز</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
