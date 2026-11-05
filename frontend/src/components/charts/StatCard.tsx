import React from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Users,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Target,
  Percent
} from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string | number;
  isPositive?: boolean;
  icon?: React.ReactNode | string;
  gradient?: string;
  comparisonLabel?: string;
  onClick?: () => void;
  className?: string;
}

export const getKpiIcon = (iconName?: string, className = 'w-5 h-5') => {
  switch (iconName) {
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

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
  icon,
  gradient = 'from-violet-500/15 via-purple-500/10 to-indigo-500/20',
  comparisonLabel = 'مقارنة بالفترة السابقة',
  onClick,
  className = ''
}) => {
  const renderedIcon =
    typeof icon === 'string'
      ? getKpiIcon(icon, 'w-5 h-5')
      : icon || <TrendingUp className="w-5 h-5" />;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -3 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
      onClick={onClick}
      className={`glass-card relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br ${gradient} select-none cursor-pointer transition-shadow duration-300 ${className}`}
    >
      {/* Decorative Glass Glow in Corner */}
      <div className="absolute -top-12 -left-12 w-28 h-28 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-sky-500/15 rounded-full blur-xl pointer-events-none" />

      {/* Header: Title and Glass Icon Badge */}
      <div className="flex items-center justify-between relative z-10 gap-2">
        <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-300 truncate tracking-wide">
          {title}
        </p>
        <div className="p-2.5 rounded-xl bg-slate-900/5 dark:bg-white/10 text-violet-600 dark:text-violet-300 shadow-sm border border-slate-200/60 dark:border-white/10 backdrop-blur-md shrink-0">
          {renderedIcon}
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="mt-4 relative z-10">
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
          {value}
        </h3>

        {/* Change indicator & Comparison */}
        {change !== undefined && (
          <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold">
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                isPositive
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{typeof change === 'number' ? `${Math.abs(change)}%` : change}</span>
            </span>

            <span className="text-[11px] text-slate-400 dark:text-slate-400 font-normal truncate">
              {comparisonLabel}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
