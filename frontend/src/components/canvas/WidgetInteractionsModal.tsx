import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Widget, WidgetType } from '../../types/dashboard';
import { useDashboardStore } from '../../features/dashboard-builder/DashboardStore';
import {
  Link2,
  Unlink,
  Check,
  X,
  Search,
  BarChart3,
  BarChart2,
  LineChart,
  PieChart,
  Table,
  FileSpreadsheet,
  Activity,
  Filter,
  Layers,
  Sparkles,
  RefreshCw,
  Shield,
  ShieldAlert,
  ArrowRightLeft,
  LayoutGrid,
  Sun,
  Flame,
  Cloud
} from 'lucide-react';

interface WidgetInteractionsModalProps {
  widget: Widget;
  isOpen: boolean;
  onClose: () => void;
}

const WIDGET_TYPE_INFO: Record<WidgetType, { label: string; icon: React.ReactNode; category: 'chart' | 'table' | 'kpi' | 'filter' }> = {
  bar: { label: 'مخطط شريطي', icon: <BarChart3 className="w-4 h-4 text-sky-400" />, category: 'chart' },
  horizontal_bar: { label: 'شريطي أفقي', icon: <BarChart2 className="w-4 h-4 text-emerald-400" />, category: 'chart' },
  treemap: { label: 'خريطة الشجرة', icon: <LayoutGrid className="w-4 h-4 text-amber-400" />, category: 'chart' },
  sunburst: { label: 'أشعة الشمس', icon: <Sun className="w-4 h-4 text-orange-400" />, category: 'chart' },
  heatmap: { label: 'خريطة حرارية', icon: <Flame className="w-4 h-4 text-red-400" />, category: 'chart' },
  wordcloud: { label: 'سحابة كلمات', icon: <Cloud className="w-4 h-4 text-sky-400" />, category: 'chart' },
  line: { label: 'مخطط خطي', icon: <LineChart className="w-4 h-4 text-indigo-400" />, category: 'chart' },
  area: { label: 'مخطط مساحي', icon: <Layers className="w-4 h-4 text-purple-400" />, category: 'chart' },
  donut: { label: 'دائري مجوف', icon: <PieChart className="w-4 h-4 text-rose-400" />, category: 'chart' },
  pie: { label: 'دائري كامل', icon: <PieChart className="w-4 h-4 text-amber-400" />, category: 'chart' },
  radar: { label: 'مخطط راداري', icon: <Sparkles className="w-4 h-4 text-pink-400" />, category: 'chart' },
  funnel: { label: 'مخطط قمعي', icon: <Layers className="w-4 h-4 text-orange-400" />, category: 'chart' },
  scatter: { label: 'مخطط انتشار', icon: <Sparkles className="w-4 h-4 text-blue-400" />, category: 'chart' },
  gauge: { label: 'عداد إنجاز', icon: <Activity className="w-4 h-4 text-teal-400" />, category: 'chart' },
  table: { label: 'جدول بيانات', icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />, category: 'table' },
  pivot: { label: 'جدول محوري', icon: <Table className="w-4 h-4 text-amber-400" />, category: 'table' },
  kpi: { label: 'مؤشر أداء KPI', icon: <Activity className="w-4 h-4 text-emerald-400" />, category: 'kpi' },
  slicer: { label: 'فلتر تفاعلي', icon: <Filter className="w-4 h-4 text-cyan-400" />, category: 'filter' }
};

export const WidgetInteractionsModal: React.FC<WidgetInteractionsModalProps> = ({
  widget,
  isOpen,
  onClose
}) => {
  const {
    currentDashboard,
    setWidgetLinks,
    toggleWidgetLink,
    setWidgetIgnoreIncoming
  } = useDashboardStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'chart' | 'table' | 'kpi' | 'filter'>('all');
  const [bidirectional, setBidirectional] = useState(true);

  const otherWidgets = currentDashboard.widgets.filter((w) => w.id !== widget.id);

  // Current settings of this widget
  const crossFilterMode = widget.config?.crossFilterMode || 'all';
  const ignoreIncoming = Boolean(widget.config?.ignoreIncomingFilters);

  // Determine current active linked IDs
  const activeLinkedIds: string[] = useMemo(() => {
    if (widget.config?.linkedWidgetIds !== undefined) {
      return widget.config.linkedWidgetIds || [];
    }
    if (crossFilterMode === 'none') return [];
    // Default mode 'all': all other widgets are linked
    return otherWidgets.map((w) => w.id);
  }, [widget.config?.linkedWidgetIds, crossFilterMode, otherWidgets]);

  // Filter other widgets by search and category
  const filteredOtherWidgets = otherWidgets.filter((w) => {
    const info = WIDGET_TYPE_INFO[w.type] || { label: w.type, category: 'chart' };
    if (filterCategory !== 'all' && info.category !== filterCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (w.title || '').toLowerCase().includes(q);
      const matchLabel = (info.label || '').toLowerCase().includes(q);
      if (!matchTitle && !matchLabel) return false;
    }
    return true;
  });

  const handleSetMode = (mode: 'all' | 'custom' | 'none') => {
    if (mode === 'all') {
      setWidgetLinks(widget.id, undefined, 'all', bidirectional);
    } else if (mode === 'none') {
      setWidgetLinks(widget.id, [], 'none', bidirectional);
    } else {
      // Switch to custom with current links
      setWidgetLinks(widget.id, activeLinkedIds, 'custom', bidirectional);
    }
  };

  const handleToggleLink = (targetId: string) => {
    toggleWidgetLink(widget.id, targetId, bidirectional);
  };

  const handleLinkAll = () => {
    const allIds = otherWidgets.map((w) => w.id);
    setWidgetLinks(widget.id, allIds, 'custom', bidirectional);
  };

  const handleUnlinkAll = () => {
    setWidgetLinks(widget.id, [], 'custom', bidirectional);
  };

  const handleLinkCategory = (category: 'chart' | 'table') => {
    const categoryIds = otherWidgets
      .filter((w) => (WIDGET_TYPE_INFO[w.type]?.category || 'chart') === category)
      .map((w) => w.id);
    setWidgetLinks(widget.id, categoryIds, 'custom', bidirectional);
  };

  const currentInfo = WIDGET_TYPE_INFO[widget.type] || { label: widget.type, icon: <BarChart3 className="w-4 h-4" /> };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-8 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto text-slate-100"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">إدارة ربط التفاعل والتصفية المتقاطعة</h3>
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {currentInfo.icon}
                  <span>{currentInfo.label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                العنصر المحدد: <span className="text-sky-300 font-medium font-sans">{widget.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 1. Mode Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              نمط تفاعل وتصفية هذا العنصر مع باقي اللوحة:
            </label>
            <div className="grid grid-cols-3 gap-3">
              {/* Option: All */}
              <button
                type="button"
                onClick={() => handleSetMode('all')}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-right transition cursor-pointer ${
                  crossFilterMode === 'all'
                    ? 'bg-sky-500/15 border-sky-500 text-sky-200 shadow-sm shadow-sky-500/10'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span className="font-bold text-sm flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-sky-400" />
                    ربط مع الكل
                  </span>
                  {crossFilterMode === 'all' && <Check className="w-4 h-4 text-sky-400" />}
                </div>
                <span className="text-[11px] leading-relaxed opacity-80">
                  يرتبط تلقائياً بجميع الجارتات والجداول في التقرير (الافتراضي).
                </span>
              </button>

              {/* Option: Custom */}
              <button
                type="button"
                onClick={() => handleSetMode('custom')}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-right transition cursor-pointer ${
                  crossFilterMode === 'custom'
                    ? 'bg-purple-500/15 border-purple-500 text-purple-200 shadow-sm shadow-purple-500/10'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span className="font-bold text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    تخصيص الربط
                  </span>
                  {crossFilterMode === 'custom' && <Check className="w-4 h-4 text-purple-400" />}
                </div>
                <span className="text-[11px] leading-relaxed opacity-80">
                  تحديد دقيق للجارتات والجداول المرتبطة والمفصولة.
                </span>
              </button>

              {/* Option: None */}
              <button
                type="button"
                onClick={() => handleSetMode('none')}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-right transition cursor-pointer ${
                  crossFilterMode === 'none'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-200 shadow-sm shadow-rose-500/10'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span className="font-bold text-sm flex items-center gap-1.5">
                    <Unlink className="w-4 h-4 text-rose-400" />
                    فصل تام (مستقل)
                  </span>
                  {crossFilterMode === 'none' && <Check className="w-4 h-4 text-rose-400" />}
                </div>
                <span className="text-[11px] leading-relaxed opacity-80">
                  لا يؤثر هذا العنصر على أي جارت أو جدول آخر عند النقر.
                </span>
              </button>
            </div>
          </div>

          {/* 2. Custom Linking List & Controls */}
          <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <span>قائمة العناصر المستهدفة بالربط والتصفية</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {crossFilterMode === 'none'
                      ? '0 مرتبطة'
                      : `${activeLinkedIds.length} من ${otherWidgets.length} مرتبطة`}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  العناصر المحددة بـ <span className="text-sky-400 font-semibold">مرتبط 🔗</span> تتصفى فورياً عند النقر هنا، والمفصولة تبقى ثابتة.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleLinkAll}
                  className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                >
                  ربط الكل
                </button>
                <button
                  type="button"
                  onClick={handleUnlinkAll}
                  className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 rounded-lg transition cursor-pointer"
                >
                  فصل الكل
                </button>
                <button
                  type="button"
                  onClick={() => handleLinkCategory('table')}
                  className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 rounded-lg transition cursor-pointer"
                >
                  الجداول فقط
                </button>
                <button
                  type="button"
                  onClick={() => handleLinkCategory('chart')}
                  className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-sky-200 rounded-lg transition cursor-pointer"
                >
                  الجارتات فقط
                </button>
              </div>
            </div>

            {/* Filter Bar & Search */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="ابحث عن جارت أو جدول..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    filterCategory === 'all' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('chart')}
                  className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    filterCategory === 'chart' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📊 جارتات
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('table')}
                  className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    filterCategory === 'table' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📋 جداول
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('kpi')}
                  className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    filterCategory === 'kpi' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🎯 مؤشرات
                </button>
              </div>
            </div>

            {/* Target Visuals List */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {filteredOtherWidgets.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  لا توجد عناصر مطابقة للبحث
                </div>
              ) : (
                filteredOtherWidgets.map((target) => {
                  const targetInfo = WIDGET_TYPE_INFO[target.type] || { label: target.type, icon: <BarChart3 className="w-4 h-4" /> };
                  const isLinked = crossFilterMode === 'all'
                    ? (widget.config?.linkedWidgetIds ? widget.config.linkedWidgetIds.includes(target.id) : true)
                    : activeLinkedIds.includes(target.id);

                  return (
                    <div
                      key={target.id}
                      onClick={() => handleToggleLink(target.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                        isLinked
                          ? 'bg-slate-900/90 border-sky-500/40 hover:border-sky-400'
                          : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700/60 shrink-0">
                          {targetInfo.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {target.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                              {targetInfo.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {target.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isLinked ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                            <Link2 className="w-3.5 h-3.5" />
                            مرتبط
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg">
                            <Unlink className="w-3.5 h-3.5 text-rose-400" />
                            مفصول
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bidirectional Sync Checkbox */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={bidirectional}
                  onChange={(e) => setBidirectional(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                <span>تطبيق الربط/الفصل بالاتجاهين متبادلاً (Bidirectional Sync)</span>
              </label>
              <span className="text-[10px] text-slate-500">موصى به لتناغم اللوحة</span>
            </div>
          </div>

          {/* 3. Incoming Filter Isolation */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg border ${
                ignoreIncoming ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                {ignoreIncoming ? <ShieldAlert className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">
                  استقبال التصفية من الجارتات الأخرى (Incoming Filters)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {ignoreIncoming
                    ? 'هذا العنصر معزول تماماً ومستقل، ولن يتأثر بنقرات أو فلاتر أي جارت آخر ويعرض البيانات كاملة دائماً.'
                    : 'يتأثر هذا العنصر بالنقرات والتصفية القادمة من الجارتات المرتبطة به بشكل طبيعي.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setWidgetIgnoreIncoming(widget.id, !ignoreIncoming)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                ignoreIncoming
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {ignoreIncoming ? 'مستقل (معزول) 🛡️' : 'يستقبل التصفية ✅'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/50">
          <button
            type="button"
            onClick={() => {
              setWidgetLinks(widget.id, undefined, 'all', true);
              setWidgetIgnoreIncoming(widget.id, false);
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>إعادة ضبط للافتراضي (مرتبط بالكامل)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition cursor-pointer"
          >
            حفظ وإغلاق
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
