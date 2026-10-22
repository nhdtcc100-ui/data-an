import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  projectTitle: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

/**
 * Premium confirmation modal for irreversible project deletion.
 * Cleans from both local state and Supabase database permanently.
 */
export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  projectTitle,
  onConfirm,
  onCancel,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  // Close on Escape (only when not actively deleting)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, isDeleting]);

  const handleExecuteDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error('[DeleteConfirmModal] Error deleting project:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={() => { if (!isDeleting) onCancel(); }}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">تأكيد حذف المشروع نهائياً</h2>
              <p className="text-xs text-rose-400/80 mt-0.5 font-medium">حذف قطعي من قاعدة البيانات والذاكرة</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-2">
            <p className="text-xs text-slate-400 font-medium">أنت على وشك حذف المشروع التالي:</p>
            <div className="flex items-center gap-2 text-rose-200 font-bold text-sm bg-slate-950/60 p-2.5 rounded-xl border border-rose-500/20">
              <span className="text-base">🗑️</span>
              <span className="truncate">{projectTitle}</span>
            </div>
            <p className="text-[11px] text-rose-300/90 leading-relaxed pt-1">
              ⚠️ سيتم حذف هذا المشروع نهائياً ولن يظهر مجدداً حتى بعد تحديث الصفحة (Refresh). لا يمكن استرجاع البيانات بعد الحذف.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            إلغاء التراجع
          </button>
          <button
            onClick={handleExecuteDelete}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition disabled:opacity-60 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جارٍ الحذف نهائياً...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف نهائي الآن</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
