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
import { sanitizeMojibakeString } from '../../features/dashboard-builder/DashboardStore';

interface KpiWidgetProps {
  title: string;
  value: number;
  config: WidgetConfig;
}

const getGradientForTheme = (theme?: string, customGradient?: string) => {
  if (customGradient) return customGradient;
  switch (theme) {
    case 'emerald':
      return 'from-emerald-500/15 via-teal-500/10 to-emerald-600/20';
    case 'sky':
      return 'from-sky-500/15 via-blue-500/10 to-indigo-600/20';
    case 'amber':
      return 'from-amber-500/15 via-orange-500/10 to-yellow-600/20';
    case 'rose':
      return 'from-rose-500/15 via-pink-500/10 to-red-600/20';
    case 'cyan':
      return 'from-cyan-500/15 via-teal-500/10 to-blue-600/20';
    case 'violet':
    default:
      // Modern Purple Glassmorphism Dashboard Theme (مثل الفيديو تماماً)
      return 'from-violet-500/20 via-purple-500/10 to-indigo-600/20';
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
  const delta = config.comparisonDelta ?? 12.5;
  const isPositive = delta >= 0;
  const gradient = getGradientForTheme(config.colorTheme, config.kpiGradient);
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
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
      className={`glass-card relative overflow-hidden flex flex-col justify-between h-full p-4 sm:p-5 select-none rounded-2xl bg-gradient-to-br ${gradient} cursor-default`}
    >
      {/* Glow highlight */}
      <div className="absolute -top-10 -left-10 w-24 h-24 bg-purple-500/20 dark:bg-purple-500/30 rounded-full blur-xl pointer-events-none" />

      {/* Header: Title and Glass Icon */}
      <div className="flex items-start justify-between relative z-10 gap-2">
        <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-300 leading-tight truncate">
          {sanitizeMojibakeString(title)}
        </span>
        <div
          className={`p-2 rounded-xl backdrop-blur-md border shadow-sm shrink-0 transition-colors ${
            isPositive
              ? 'bg-emerald-500/10 dark:bg-white/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20 dark:border-white/15'
              : 'bg-rose-500/10 dark:bg-white/10 text-rose-500 dark:text-rose-400 border-rose-500/20 dark:border-white/15'
          }`}
        >
          {icon}
        </div>
      </div>

      {/* Metric Value */}
      <div className="my-2 relative z-10">
        <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
          {formatNumber(value, config.numberFormat)}
        </div>
      </div>

      {/* Footer: Trend Change & Comparison */}
      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-200/60 dark:border-white/10 relative z-10">
        <div
          className={`flex items-center gap-1 font-bold ${
            isPositive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3.5 h-3.5" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5" />
          )}
          <span>{Math.abs(delta)}%</span>
          <span className="text-[11px] font-normal text-slate-400 dark:text-slate-400 mr-1 truncate">
            مقارنة بالفترة السابقة
          </span>
        </div>
      </div>
    </motion.div>
  );
};
