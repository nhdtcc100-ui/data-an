import React from 'react';
import type { WidgetConfig } from '../../types/dashboard';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { sanitizeMojibakeString } from '../../features/dashboard-builder/DashboardStore';

interface KpiWidgetProps {
  title: string;
  value: number;
  config: WidgetConfig;
}

export const KpiWidget: React.FC<KpiWidgetProps> = ({
  title,
  value,
  config
}) => {
  const delta = config.comparisonDelta ?? 12.5;
  const isPositive = delta >= 0;

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
    <div className="flex flex-col justify-between h-full p-4 select-none">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-slate-400 leading-tight">
          {sanitizeMojibakeString(title)}
        </span>
        <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          <TrendingUp className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="my-2">
        <div className="text-2xl lg:text-3xl font-black text-slate-100 font-mono tracking-tight">
          {formatNumber(value, config.numberFormat)}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
        <div className={`flex items-center gap-1 font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          <span>{Math.abs(delta)}%</span>
          <span className="text-[11px] font-normal text-slate-500 mr-1">مقارنة بالفترة السابقة</span>
        </div>
      </div>
    </div>
  );
};
