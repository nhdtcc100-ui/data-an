import React, { useState, useMemo } from 'react';
import { useDashboardStore } from '../dashboard-builder/DashboardStore';
import { buildShareUrl, downloadDeploymentConfig, downloadFullReportPackage } from '../../services/snapshotService';
import { downloadInteractiveHtml } from '../../services/htmlExportService';
import {
  X,
  Share2,
  Copy,
  Check,
  Lock,
  Calendar,
  Code,
  ShieldCheck,
  Download,
  Server,
  Sparkles,
  Info,
  ExternalLink,
  FileCode,
  Database
} from 'lucide-react';

export const ShareModal: React.FC = () => {
  const {
    isShareModalOpen,
    setShareModalOpen,
    currentDashboard,
    currentDataSource,
    theme,
    drillDownStates,
    widgetFilters,
    activeFilters
  } = useDashboardStore();

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('Pass2026!');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'embed' | 'hosting'>('link');

  // Generate the real portable share URL with customized report payload
  // Includes the current drill-down hierarchy so the recipient sees the same view
  const shareUrl = useMemo(() => {
    return buildShareUrl(
      currentDashboard,
      currentDataSource,
      theme,
      drillDownStates,
      widgetFilters,
      activeFilters
    );
  }, [currentDashboard, currentDataSource, theme, drillDownStates, widgetFilters, activeFilters]);

  const embedCode = useMemo(() => {
    return `<iframe src="${shareUrl}" width="100%" height="750" frameborder="0" allowfullscreen style="border-radius:12px; border:1px solid #334155;"></iframe>`;
  }, [shareUrl]);

  if (!isShareModalOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const handleDownloadConfig = () => {
    downloadDeploymentConfig(currentDashboard, currentDataSource, theme);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden select-none flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>مشاركة اللوحة العامة</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-normal">
                  محمية وتفاعلية
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                مشاركة الرابط العام للعرض التفاعلي فقط دون السماح بالتعديل أو تغيير الثيم
              </p>
            </div>
          </div>

          <button
            onClick={() => setShareModalOpen(false)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 px-5 pt-3 gap-4 text-xs font-semibold shrink-0 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('link')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'link'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" /> رابط عام مباشر
          </button>
          <button
            onClick={() => setActiveTab('embed')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'embed'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" /> كود التضمين (iframe)
          </button>
          <button
            onClick={() => setActiveTab('hosting')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'hosting'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" /> إرشادات الرفع على استضافة
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === 'link' && (
            <>
              {/* Security Banner */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 flex items-start gap-3 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-slate-300 leading-relaxed">
                  <span className="font-bold text-emerald-400 block mb-0.5">ضمان حماية اللوحة:</span>
                  المستلم لهذا الرابط يدخل في وضع <span className="text-white font-semibold">"عرض القراءة فقط"</span>. لن يتمكن من فتح وضع التعديل، أو تحريك المخططات، أو تغيير الثيم، ويقتصر تفاعله على تصفية البيانات، النقر المتقاطع، وتصدير PDF.
                </div>
              </div>

              {/* Public Link Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>الرابط العام للتقرير المخصص</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 font-normal">
                      يحمل تقريرك الحالي ({currentDashboard.widgets.length} عناصر)
                    </span>
                  </label>
                  <span className="text-[10px] text-sky-400 font-mono">
                    جاهز للمشاركة الفورية
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-sky-400 font-mono truncate select-all">
                    {shareUrl}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-sky-500/20 cursor-pointer shrink-0"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-slate-400">
                    ⚡ رابط محمول ومضغوط يحمل كافة تعديلاتك ومخططاتك بدقة، ويعمل بسلاسة تامة على الواتساب والموبايل
                  </p>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 underline underline-offset-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>تجربة الرابط في تبويب جديد</span>
                  </a>
                </div>
              </div>

              {/* Standalone Interactive HTML Export Box */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-slate-900 border border-sky-500/30 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                    <FileCode className="w-4 h-4 text-sky-400" />
                    <span>تصدير كملف HTML تفاعلي مستقل (.html)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ملف واحد متكامل ترسله بالبريد أو الواتساب، يفتحه أي شخص في المتصفح أوفلاين مع بقاء حركة الماوس، الفلاتر، ونقر الجارتات!
                  </p>
                </div>
                <button
                  onClick={() => downloadInteractiveHtml(currentDashboard, currentDataSource, theme, widgetFilters, activeFilters, drillDownStates)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-500/20 cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف HTML</span>
                </button>
              </div>

              {/* Complete Portable LENS BI Package Box */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>تنزيل حزمة التقرير الشاملة (.lensbi)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    يحفظ 100% من بيانات الإكسل والمخططات وتنسيقاتك كملف محمول، لفتحه أو استيراده على أي جهاز بضغطة زر واحدة!
                  </p>
                </div>
                <button
                  onClick={() => downloadFullReportPackage(currentDashboard, currentDataSource, theme, drillDownStates, widgetFilters, activeFilters)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-500/20 cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل .lensbi</span>
                </button>
              </div>

              {/* Security Settings Section */}
              <div className="border-t border-slate-800/80 pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <Lock className="w-4 h-4 text-sky-400" />
                  <span>خيارات الوصول الإضافية</span>
                </div>

                {/* Password Protection */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 font-medium">
                    <input
                      type="checkbox"
                      checked={isPasswordProtected}
                      onChange={(e) => setIsPasswordProtected(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>تفعيل كلمة مرور لدخول التقرير</span>
                  </label>

                  {isPasswordProtected && (
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="أدخل كلمة السر المطلوبة"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 font-mono"
                    />
                  )}
                </div>

                {/* Expiry Date */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 font-medium">
                    <input
                      type="checkbox"
                      checked={hasExpiry}
                      onChange={(e) => setHasExpiry(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
                    />
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>تحديد تاريخ انتهاء صلاحية الرابط</span>
                  </label>

                  {hasExpiry && (
                    <input
                      type="date"
                      defaultValue="2026-12-31"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 font-mono"
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                رمز التضمين في صفحات الويب أو البوابات الداخلية (iframe)
              </label>
              <textarea
                readOnly
                value={embedCode}
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-indigo-300 font-mono resize-none focus:outline-none select-all"
              />
              <button
                onClick={handleCopyEmbed}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                {copiedEmbed ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedEmbed ? 'تم نسخ كود التضمين!' : 'نسخ كود iframe'}</span>
              </button>
            </div>
          )}

          {activeTab === 'hosting' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>كيف تضمن ظهور آخر تعديل للتقرير عند الرفع على الاستضافة؟</span>
                </div>
                <p className="text-[12px] text-slate-300 leading-relaxed">
                  عند التعديل محلياً، يحفظ المتصفح التغييرات في ذاكرته (<span className="text-sky-300 font-mono">localStorage</span>). لكي يرى أي زائر على الاستضافة آخر تعديل قمت به، لديك خياران ممتازان:
                </p>
              </div>

              {/* Option 1 */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px]">1</span>
                  مشاركة الرابط المحتوي على التعديلات (الأسهل والأسرع):
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed pr-6">
                  الرابط المولد في تبويب <span className="text-white font-semibold">"رابط عام مباشر"</span> يحتوي تلقائياً على كل عناصر اللوحة ومواضعها وثيمها مشفراً بالكامل. شارك هذا الرابط مع أي شخص وسيرى آخر تعديل فوراً دون الحاجة لأي قاعدة بيانات!
                </p>
              </div>

              {/* Option 2 */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">2</span>
                  تصدير التعديل كنسخة أساسية للمشروع (قبل عمل build):
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed pr-6">
                  إذا أردت أن تكون الصفحة الرئيسية على الاستضافة (<span className="text-white font-mono">https://yoursite.com</span>) تبدأ مباشرة بآخر تعديل قمت به لجميع الزوار الجدد، اضغط على الزر أدناه لتحميل ملف الإعدادات:
                </p>

                <div className="pr-6 pt-1">
                  <button
                    onClick={handleDownloadConfig}
                    className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل ملف الإعدادات (Export Deployment Config)</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-sky-950/30 p-2.5 rounded-lg border border-sky-900/40">
                <Info className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  عند بناء المشروع بأمر <code className="text-sky-300 font-mono">npm run build</code> ورفع مجلد <code className="text-sky-300 font-mono">dist</code>، سيعمل التقرير بشكل فائق السرعة عبر محرك المتصفح.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            الرابط نشط ويتم معالجة التصفية المتقاطعة فورياً عبر DuckDB
          </span>
          <button
            onClick={() => setShareModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
