import React from 'react';
import { ArrowUpDown, Layers, ChevronLeft } from 'lucide-react';

interface PivotRow {
  groupKey: string;
  count: number;
  revenue: number;
  profit: number;
}

interface PivotTableWidgetProps {
  data: PivotRow[];
  groupByColumn: string;
  drillEnabled?: boolean;
  hasMoreLevels?: boolean;
  onGroupClick?: (groupKey: string) => void;
}

export const PivotTableWidget: React.FC<PivotTableWidgetProps> = ({
  data,
  groupByColumn,
  drillEnabled,
  hasMoreLevels,
  onGroupClick
}) => {
  const totalRevenue = data.reduce((acc, row) => acc + row.revenue, 0);
  const totalProfit = data.reduce((acc, row) => acc + row.profit, 0);
  const totalCount = data.reduce((acc, row) => acc + row.count, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
        <table className="w-full text-right border-collapse" style={{ fontSize: 'clamp(8.5px, 2.2vw, 12px)' }}>
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/90 sticky top-0 text-slate-400 font-semibold">
              <th className="p-1.5 sm:p-2.5 flex items-center gap-1.5">
                <span>{groupByColumn || 'التصنيف'}</span>
                {drillEnabled && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-medium"
                    title="عمود هرمي (انقر على أي صف للتعمق بالطبقة التالية)"
                  >
                    <Layers className="w-2.5 h-2.5 text-sky-400" />
                    <span>هرمي</span>
                  </span>
                )}
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </th>
              <th className="p-1.5 sm:p-2.5 text-center">العمليات</th>
              <th className="p-1.5 sm:p-2.5 text-left">الإيرادات المجمعة</th>
              <th className="p-1.5 sm:p-2.5 text-left">هامش الأرباح</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200 font-mono">
            {data.map((row) => (
              <tr
                key={row.groupKey}
                className="hover:bg-slate-800/50 transition-colors group"
              >
                <td
                  onClick={drillEnabled && hasMoreLevels ? () => onGroupClick?.(row.groupKey) : undefined}
                  className={`p-1.5 sm:p-2.5 font-sans font-medium ${
                    drillEnabled && hasMoreLevels
                      ? 'cursor-pointer hover:text-sky-300 hover:bg-sky-500/10 text-sky-200 transition-colors'
                      : 'text-slate-100'
                  }`}
                  title={drillEnabled && hasMoreLevels ? `انقر للتعمق في: ${row.groupKey}` : undefined}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={drillEnabled && hasMoreLevels ? 'underline-offset-2 group-hover:underline' : ''}>
                      {row.groupKey}
                    </span>
                    {drillEnabled && hasMoreLevels && (
                      <ChevronLeft className="w-3 h-3 text-sky-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all shrink-0" />
                    )}
                  </div>
                </td>
                <td className="p-1.5 sm:p-2.5 text-center text-slate-400">
                  {row.count.toLocaleString()}
                </td>
                <td className="p-1.5 sm:p-2.5 text-left text-sky-400 font-bold">
                  ${row.revenue.toLocaleString()}
                </td>
                <td className="p-1.5 sm:p-2.5 text-left text-emerald-400 font-bold">
                  ${row.profit.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-700 bg-slate-900/90 font-bold text-slate-100 font-mono">
              <td className="p-1.5 sm:p-2.5 font-sans">المجموع الإجمالي</td>
              <td className="p-1.5 sm:p-2.5 text-center text-slate-300">
                {totalCount.toLocaleString()}
              </td>
              <td className="p-1.5 sm:p-2.5 text-left text-sky-400">
                ${totalRevenue.toLocaleString()}
              </td>
              <td className="p-1.5 sm:p-2.5 text-left text-emerald-400">
                ${totalProfit.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
