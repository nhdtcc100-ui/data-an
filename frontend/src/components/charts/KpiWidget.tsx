import React from 'react';
import { motion } from 'framer-motion';
import type { WidgetConfig } from '../../types/dashboard';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  ShoppingBag,
  Users,
  DollarSign,
  Package,
  Target,
  Percent
} from 'lucide-react';
import { sanitizeMojibakeString, useDashboardStore } from '../../features/dashboard-builder/DashboardStore';

interface KpiWidgetProps {
  title: string;
  value: number;
  config: WidgetConfig;
}

const getGradientForTheme = (theme?: string, customGradient?: string, isDark = true) => {
  if (customGradient) return customGradient;
  switch (theme) {
    case 'emerald':
      return isDark ? 'from-emerald-500/20 via-teal-500/10 to-emerald-600/25' : 'from-emerald-500/10 via-teal-500/5 to-emerald-600/10';
    case 'sky':
      return isDark ? 'from-sky-500/20 via-blue-500/10 to-indigo-600/25' : 'from-sky-500/10 via-blue-500/5 to-indigo-600/10';
    case 'amber':
      return isDark ? 'from-amber-500/20 via-orange-500/10 to-yellow-600/25' : 'from-amber-500/10 via-orange-500/5 to-yellow-600/10';
    case 'rose':
      return isDark ? 'from-rose-500/20 via-pink-500/10 to-red-600/25' : 'from-rose-500/10 via-pink-500/5 to-red-600/10';
    case 'cyan':
      return isDark ? 'from-cyan-500/20 via-teal-500/10 to-blue-600/25' : 'from-cyan-500/10 via-teal-500/5 to-blue-600/10';
    case 'violet':
    default:
      // Modern Purple Glassmorphism Dashboard Theme (مثل الفيديو تماماً)
      return isDark ? 'from-violet-500/25 via-purple-500/15 to-indigo-600/25' : 'from-violet-500/10 via-purple-500/5 to-indigo-600/10';
  }
};

const getIconComponent = (icon?: string, className = 'w-4 h-4') => {
  switch (icon) {
    case 'shopping-bag':
      return <ShoppingBag className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'dollar':
      return <DollarSign className={className} />;
    case 'package':
      return <Package className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'percent':
      return <Percent className={className} />;
    default:
      return <TrendingUp className={className} />;
  }
};

export const KpiWidget: React.FC<KpiWidgetProps> = ({
  title,
  value,
  config
}) => {
  const { theme } = useDashboardStore();
  const isDark = theme === 'dark';
  const delta = config.comparisonDelta ?? 12.5;
  const isPositive = delta >= 0;
  const gradient = getGradientForTheme(config.colorTheme, config.kpiGradient, isDark);
  const icon = getIconComponent(config.kpiIcon);

  const formatNumber = (val: number, format?: string) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('ar-IQ', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }).format(val).replace('US$', '$');
      case 'percent':
        return `${val.toFixed(1)}%`;
      case 'compact':
        return new Intl.NumberFormat('en-US', {
          notation: 'compact',
          compactDisplay: 'short'
        }).format(val);
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
      className={`glass-card relative overflow-hidden flex flex-col justify-between h-full p-4 sm:p-5 select-none rounded-2xl bg-gradient-to-br ${gradient} cursor-default`}
    >
      {/* Glow highlight */}
      <div className={`absolute -top-10 -left-10 w-24 h-24 rounded-full blur-xl pointer-events-none ${
        isDark ? 'bg-purple-500/30' : 'bg-purple-500/15'
      }`} />

      {/* Header: Title and Glass Icon */}
      <div className="flex items-start justify-between relative z-10 gap-2">
        <span className={`text-xs sm:text-sm font-bold leading-tight truncate ${
          isDark ? 'text-slate-200 font-semibold' : 'text-slate-700 font-bold'
        }`}>
          {sanitizeMojibakeString(title)}
        </span>
        <div
          className={`p-2 rounded-xl backdrop-blur-md border shadow-sm shrink-0 transition-colors ${
            isPositive
              ? isDark
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : isDark
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-rose-50 text-rose-600 border-rose-200'
          }`}
        >
          {icon}
        </div>
      </div>

      {/* Metric Value */}
      <div className="my-2 relative z-10">
        <div className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold font-mono tracking-tight ${
          isDark ? 'text-white' : 'text-slate-950 font-black'
        }`}>
          {formatNumber(value, config.numberFormat)}
        </div>
      </div>

      {/* Footer: Trend Change & Comparison */}
      <div className={`flex items-center justify-between text-xs pt-2.5 border-t relative z-10 ${
        isDark ? 'border-white/10' : 'border-slate-200/80'
      }`}>
        <div
          className={`flex items-center gap-1 font-bold ${
            isPositive
              ? isDark ? 'text-emerald-400' : 'text-emerald-600'
              : isDark ? 'text-rose-400' : 'text-rose-600'
          }`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3.5 h-3.5" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5" />
          )}
          <span>{Math.abs(delta)}%</span>
          <span className={`text-[11px] font-normal mr-1 truncate ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            مقارنة بالفترة السابقة
          </span>
        </div>
      </div>
    </motion.div>
  );
};
