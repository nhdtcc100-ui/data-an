import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Widget } from '../../types/dashboard';
import { useDashboardStore } from '../../features/dashboard-builder/DashboardStore';
import { EChartWrapper } from '../charts/EChartWrapper';
import { KpiWidget } from '../charts/KpiWidget';
import { SlicerWidget } from '../filters/SlicerWidget';
import { PivotTableWidget } from '../charts/PivotTableWidget';
import { DataTableWidget } from '../charts/DataTableWidget';
import { DrillBreadcrumb } from './DrillBreadcrumb';
import { WidgetInteractionsModal } from './WidgetInteractionsModal';
import { getMotionTheme, applyMotionThemeToECharts } from '../../services/motionThemes';
import {
  filterRows,
  aggregateGroupData,
  computeDrillLevel,
  getDrillLeafRows,
  calculateKpi,
  getUniqueValues,
  calculateScatter,
  calculateRadar,
  calculateHeatmap,
  getEffectiveFiltersForWidget
} from '../../services/dataEngine';
import { WordCloudWidget } from '../charts/WordCloudWidget';
import {
  GripHorizontal,
  Settings,
  Trash2,
  Maximize2,
  Minimize2,
  Copy,
  Move,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
  Target,
  X,
  Layers,
  Link2,
  Unlink,
  ShieldAlert
} from 'lucide-react';
import * as echarts from 'echarts';

interface WidgetContainerProps {
  widget: Widget;
  index?: number;
  totalWidgets?: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const PALETTES: Record<string, { primary: string; secondary: string; gradient: [string, string] }> = {
  sky: { primary: '#0ea5e9', secondary: '#38bdf8', gradient: ['#38bdf8', '#0284c7'] },
  emerald: { primary: '#10b981', secondary: '#34d399', gradient: ['#34d399', '#059669'] },
  violet: { primary: '#8b5cf6', secondary: '#a78bfa', gradient: ['#a78bfa', '#6d28d9'] },
  amber: { primary: '#f59e0b', secondary: '#fbbf24', gradient: ['#fbbf24', '#d97706'] },
  rose: { primary: '#f43f5e', secondary: '#fb7185', gradient: ['#fb7185', '#e11d48'] },
  cyan: { primary: '#06b6d4', secondary: '#22d3ee', gradient: ['#22d3ee', '#0891b2'] },
  slate: { primary: '#64748b', secondary: '#94a3b8', gradient: ['#94a3b8', '#475569'] }
};

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  widget,
  index,
  totalWidgets,
  onDragStart,
  onDragEnd
}) => {
  const {
    currentDashboard,
    currentDataSource,
    selectedWidgetId,
    setSelectedWidgetId,
    removeWidget,
    duplicateWidget,
    setWidgetWidth,
    setWidgetHeight,
    moveWidgetToPosition,
    moveWidgetToIndex,
    updateWidgetConfig,
    activeFilters,
    widgetFilters,
    setFilter,
    isEditMode,
    theme,
    drillDownStates,
    drillDown,
    drillUp,
    resetDrillDown,
    activeTableRowKey,
    setActiveTableRowKey,
    motionTheme
  } = useDashboardStore();

  const activeMotionTheme = getMotionTheme(motionTheme || currentDashboard?.motionTheme || 'glass-capsule');

  // الثيمات الفاتحة التي تحتاج نصوصاً سوداء على الخلفية البيضاء
  const LIGHT_THEME_IDS = ['minimalism-light', 'bento-light'];
  const activeThemeId = activeMotionTheme.id;
  const isLightCard = LIGHT_THEME_IDS.includes(activeThemeId);


  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const [isInteractionsModalOpen, setIsInteractionsModalOpen] = useState(false);
  const [activeBarCategory, setActiveBarCategory] = useState<string | null>(null);

  // Escape key listener to exit fullscreen
  React.useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const currentIndex = index !== undefined
    ? index
    : currentDashboard.widgets.findIndex((w) => w.id === widget.id);
  const widgetCount = totalWidgets !== undefined
    ? totalWidgets
    : currentDashboard.widgets.length;

  const isSelected = selectedWidgetId === widget.id && isEditMode;

  const rawRows = currentDataSource.rawRows || [];

  // Compute effective filters for this specific widget based on link settings
  const effectiveFilters = React.useMemo(() => {
    return getEffectiveFiltersForWidget(
      widget,
      currentDashboard.widgets,
      widgetFilters,
      activeFilters
    );
  }, [widget, currentDashboard.widgets, widgetFilters, activeFilters]);

  const themeKey = widget.config.colorTheme || 'sky';
  const palette = PALETTES[themeKey] || PALETTES.sky;

  // Custom primary color overrides palette
  const customPrimary = widget.config.primaryColor || palette.primary;
  const customGradientStart = widget.config.primaryColor || palette.gradient[0];
  const customGradientEnd = widget.config.isGradient === false
    ? (widget.config.primaryColor || palette.gradient[1])
    : palette.gradient[1];

  const makeBarColor = (horizontal = false) =>
    widget.config.primaryColor
      ? widget.config.isGradient === false
        ? widget.config.primaryColor
        : new echarts.graphic.LinearGradient(
            horizontal ? 1 : 0, 0, horizontal ? 0 : 0, horizontal ? 0 : 1,
            [
              { offset: 0, color: customGradientStart },
              { offset: 1, color: customGradientEnd }
            ]
          )
      : new echarts.graphic.LinearGradient(
          horizontal ? 1 : 0, 0, horizontal ? 0 : 0, horizontal ? 0 : 1,
          [
            { offset: 0, color: palette.gradient[0] },
            { offset: 1, color: palette.gradient[1] }
          ]
        );

  // Drill-Down Hierarchy Configuration & Active Level
  const drillDownEnabled = Boolean(
    widget.config.drillDownEnabled &&
    widget.config.drillDownLevels &&
    widget.config.drillDownLevels.length > 0
  );
  const drillLevels = widget.config.drillDownLevels || [];
  const widgetDrill = (drillDownStates && drillDownStates[widget.id]) || { path: [], levelIndex: 0 };
  const currentDrillPath = widgetDrill.path || [];
  const currentLevelIndex = Math.min(widgetDrill.levelIndex || 0, Math.max(0, drillLevels.length - 1));

  // Determine active group column with smart fallback to available columns if column was deleted or mismatched
  const availableColumns = currentDataSource.columns || [];
  const rawGroupCol = drillDownEnabled && drillLevels.length > 0
    ? (drillLevels[currentLevelIndex] || drillLevels[0])
    : (widget.config.xAxisColumn || availableColumns[0]?.columnName || 'المنطقة');

  const groupColExists = availableColumns.some((c) => c.columnName === rawGroupCol);
  const activeGroupCol = groupColExists
    ? rawGroupCol
    : (availableColumns.find((c) => c.dataType === 'string')?.columnName || availableColumns[0]?.columnName || rawGroupCol);

  const rawYCol = widget.config.yAxisColumn || availableColumns[1]?.columnName || 'المبيعات';
  const yColExists = availableColumns.some((c) => c.columnName === rawYCol);
  const yCol = yColExists
    ? rawYCol
    : (availableColumns.find((c) => c.dataType === 'numeric')?.columnName || availableColumns[1]?.columnName || rawYCol);

  const xCol = activeGroupCol;
  const agg = widget.config.aggregation || 'SUM';
  const sortOrder = widget.config.sortOrder || 'desc';
  const topN = widget.config.topN;

  // ──────────────────────────────────────────────────────────────
  // Two-layer filter strategy (fixes cross-chart drill filter bleed):
  //
  //  Layer 1 — externalFilters:
  //    Filters from EXTERNAL linked charts only (excludeSelf=true).
  //    The widget's own widgetFilters slot is skipped here so
  //    the widget's own drill-down path is NOT double-applied.
  //
  //  Layer 2 — computeDrillLevel / getDrillLeafRows:
  //    Applies the widget's OWN drill-down path on top of Layer 1.
  //
  //  Non-drill widgets use full effectiveFilters (all sources).
  // ──────────────────────────────────────────────────────────────
  const externalFilters = React.useMemo(() => {
    if (!drillDownEnabled) return effectiveFilters;
    return getEffectiveFiltersForWidget(
      widget,
      currentDashboard.widgets,
      widgetFilters,
      activeFilters,
      { excludeSelf: true }
    );
  }, [widget, currentDashboard.widgets, widgetFilters, activeFilters, drillDownEnabled]);

  // For drill-enabled charts, base rows come from external cross-filters only;
  // own drill path is applied by computeDrillLevel below.
  const filteredRows = filterRows(rawRows, drillDownEnabled ? externalFilters : effectiveFilters);

  // Group aggregation: computeDrillLevel applies own drillPath on top of externalFilteredRows
  const aggResult = drillDownEnabled && currentDrillPath.length > 0
    ? computeDrillLevel(filteredRows, currentDrillPath, activeGroupCol, yCol, agg, sortOrder, topN)
    : aggregateGroupData(filteredRows, activeGroupCol, yCol, agg, sortOrder, topN);

  // Rows filtered by drill path for row-level widgets (DataTable, Pivot)
  const drillFilteredRows = drillDownEnabled && currentDrillPath.length > 0
    ? getDrillLeafRows(filteredRows, currentDrillPath)
    : filteredRows;

  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const splitLineColor = isDark ? '#1e293b' : '#e2e8f0';

  // Helper for number formatting
  const formatNumber = (val: number) => {
    if (widget.config.numberFormat === 'currency') {
      return `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`;
    }
    if (widget.config.numberFormat === 'compact') {
      if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
      if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
      return String(val);
    }
    if (widget.config.numberFormat === 'percent') {
      return `${val.toFixed(1)}%`;
    }
    return val.toLocaleString();
  };

  const getChartOption = (): echarts.EChartsOption => {
    const showLegend = widget.config.showLegend !== false;
    const legendPos = widget.config.legendPosition || 'bottom';
    const legendConfig = showLegend
      ? {
          show: true,
          orient: (legendPos === 'left' || legendPos === 'right' ? 'vertical' : 'horizontal') as any,
          [legendPos]: 5,
          textStyle: { color: textColor, fontSize: 10, fontFamily: 'Tajawal' },
          itemWidth: 10,
          itemHeight: 10
        }
      : { show: false };

    // 1. Donut & Pie Chart
    if (widget.type === 'pie' || widget.type === 'donut') {
      const isDonut = widget.type === 'donut';
      const holeRatio = widget.config.donutHoleRatio ?? 42;
      const hole = `${holeRatio}%`;

      // Filter out invalid/empty entries
      const validEntries = aggResult.categories
        .map((cat, idx) => ({ name: cat, value: aggResult.values[idx] }))
        .filter((e) => e.name && e.name !== '' && e.value !== undefined && !isNaN(e.value));

      const pieData = validEntries.length > 0
        ? validEntries
        : aggResult.categories.map((cat, idx) => ({
            name: cat || '(فارغ)',
            value: aggResult.values[idx] || 0
          }));

      const labelFormatter = widget.config.pieLabelType === 'value'
        ? '{b}: {c}'
        : widget.config.pieLabelType === 'name'
        ? '{b}'
        : '{b}: {d}%';

      // Curated vibrant multi-color palette for rich, high-contrast slices on all displays
      const pieColors = [
        '#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899',
        '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#e11d48',
        '#84cc16', '#3b82f6', '#f43f5e', '#a855f7', '#eab308'
      ];

      return {
        color: pieColors,
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => `${params.name}: <b>${(params.value || 0).toLocaleString()}</b> (${params.percent || 0}%)`
        },
        legend: legendConfig,
        series: [
          {
            type: 'pie',
            roseType: widget.config.pieRoseType ? 'radius' : undefined,
            radius: isDonut ? [hole, '72%'] : ['0%', '72%'],
            center: ['50%', legendPos === 'bottom' ? '44%' : '50%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: widget.config.barBorderRadius ?? (isDonut ? 6 : 4),
              borderColor: isDark ? '#0f172a' : '#fff',
              borderWidth: 2
            },
            label: {
              show: widget.config.showDataLabels ?? true,
              color: textColor,
              fontSize: 10,
              formatter: labelFormatter
            },
            emphasis: {
              label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#fff' }
            },
            data: pieData
          }
        ]
      };
    }

    // 2. Horizontal Bar Chart
    if (widget.type === 'horizontal_bar') {
      const reversedCats = [...aggResult.categories].reverse();
      const reversedVals = [...aggResult.values].reverse();
      const hBarRadius = widget.config.barBorderRadius ?? 6;
      const baseBarColor = makeBarColor(true);

      const hBarData = reversedCats.map((cat, idx) => {
        const isActive = activeBarCategory === cat;
        return {
          value: reversedVals[idx],
          itemStyle: isActive
            ? {
                borderRadius: [0, hBarRadius, hBarRadius, 0],
                color: palette.secondary,
                borderColor: '#ffffff',
                borderWidth: 2,
                shadowBlur: 12,
                shadowColor: palette.primary
              }
            : {
                borderRadius: [0, hBarRadius, hBarRadius, 0],
                color: baseBarColor
              }
        };
      });

      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
            shadowStyle: {
              color: 'rgba(56, 189, 248, 0.12)'
            }
          },
          formatter: (params: any) => `${params[0].name}: <b>${params[0].value.toLocaleString()}</b>`
        },
        grid: { top: 15, right: 25, bottom: 25, left: 85 },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: textColor, formatter: formatNumber }
        },
        yAxis: {
          type: 'category',
          triggerEvent: true,
          data: reversedCats,
          axisLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: textColor, fontFamily: 'Tajawal', fontSize: 11 }
        },
        dataZoom: reversedCats.length > 8 ? [
          {
            type: 'inside',
            yAxisIndex: 0,
            startValue: Math.max(0, reversedCats.length - 10),
            endValue: reversedCats.length - 1
          },
          {
            type: 'slider',
            yAxisIndex: 0,
            width: 14,
            right: 4,
            startValue: Math.max(0, reversedCats.length - 10),
            endValue: reversedCats.length - 1,
            borderColor: 'transparent',
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.8)',
            fillerColor: 'rgba(56, 189, 248, 0.25)',
            handleStyle: { color: palette.primary }
          }
        ] : undefined,
        series: [
          {
            type: 'bar',
            data: hBarData,
            barWidth: '55%',
            label: {
              show: widget.config.showDataLabels ?? false,
              position: 'right',
              color: textColor,
              fontSize: 10,
              formatter: (p: any) => formatNumber(p.value)
            },
            emphasis: {
              disabled: false,
              itemStyle: {
                shadowBlur: 16,
                shadowColor: palette.primary
              }
            }
          }
        ]
      };
    }

    // 3. Line & Area Chart
    if (widget.type === 'line' || widget.type === 'area') {
      const lineW = widget.config.lineWidth ?? 3;
      const isSmooth = widget.config.smoothLine !== false;
      const showSym = widget.config.showSymbols !== false;
      const areaAlpha = widget.config.areaOpacity ?? 0.4;
      const areaHex = Math.round(areaAlpha * 255).toString(16).padStart(2, '0');

      return {
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => `${params[0].name}: <b>${params[0].value.toLocaleString()}</b>`
        },
        grid: { top: 20, right: 20, bottom: 30, left: 65 },
        xAxis: {
          type: 'category',
          data: aggResult.categories,
          axisLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: textColor, fontFamily: 'Tajawal', fontSize: 11 }
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: textColor, formatter: formatNumber }
        },
        series: [
          {
            type: 'line',
            data: aggResult.values,
            smooth: isSmooth,
            symbol: showSym ? 'circle' : 'none',
            symbolSize: 6,
            lineStyle: { width: lineW, color: customPrimary },
            itemStyle: { color: customPrimary },
            label: {
              show: widget.config.showDataLabels ?? false,
              color: textColor,
              fontSize: 10,
              formatter: (p: any) => formatNumber(p.value)
            },
            areaStyle:
              widget.type === 'area'
                ? {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: `${customPrimary}${areaHex}` },
                      { offset: 1, color: `${customPrimary}00` }
                    ])
                  }
                : undefined
          }
        ]
      };
    }

    // 4. Funnel Chart
    if (widget.type === 'funnel') {
      const funnelData = aggResult.categories.map((cat, idx) => ({
        name: cat,
        value: aggResult.values[idx]
      }));

      return {
        tooltip: { trigger: 'item', formatter: '{b}: <b>{c}</b>' },
        series: [
          {
            name: widget.title,
            type: 'funnel',
            left: '10%',
            top: 20,
            bottom: 20,
            width: '80%',
            minSize: '15%',
            maxSize: '100%',
            sort: 'descending',
            gap: 3,
            label: { show: true, position: 'inside', color: '#fff', fontSize: 11, fontFamily: 'Tajawal' },
            itemStyle: { borderColor: isDark ? '#0f172a' : '#fff', borderWidth: 1 },
            data: funnelData
          }
        ]
      };
    }

    // 5. Gauge Chart
    if (widget.type === 'gauge') {
      const kpiData = calculateKpi(filteredRows, yCol, agg);
      const maxVal = widget.config.gaugeMax || Math.max(kpiData.value * 1.25, 100);

      return {
        tooltip: { formatter: '{b}: {c}' },
        series: [
          {
            type: 'gauge',
            center: ['50%', '58%'],
            radius: '85%',
            min: 0,
            max: maxVal,
            progress: {
              show: true,
              width: 14,
              itemStyle: { color: palette.primary }
            },
            pointer: { show: true, length: '60%', width: 5 },
            axisLine: { lineStyle: { width: 14, color: [[1, isDark ? '#1e293b' : '#e2e8f0']] } },
            axisTick: { show: false },
            splitLine: { length: 8, lineStyle: { width: 2, color: '#999' } },
            axisLabel: { distance: 18, color: textColor, fontSize: 10 },
            title: { offsetCenter: [0, '35%'], fontSize: 12, color: textColor, fontFamily: 'Tajawal' },
            detail: {
              valueAnimation: true,
              fontSize: 18,
              fontWeight: 'bolder',
              offsetCenter: [0, '70%'],
              color: isDark ? '#fff' : '#0f172a',
              formatter: formatNumber
            },
            data: [{ value: Math.round(kpiData.value), name: yCol }]
          }
        ]
      };
    }

    // 6. Radar Chart
    if (widget.type === 'radar') {
      const numCols = currentDataSource.columns.filter((c) => c.dataType === 'numeric').map((c) => c.columnName);
      const radarData = calculateRadar(filteredRows, xCol, numCols.slice(0, 5));

      return {
        tooltip: { trigger: 'item' },
        legend: {
          bottom: 0,
          textStyle: { color: textColor, fontSize: 10, fontFamily: 'Tajawal' }
        },
        radar: {
          indicator: radarData.indicators.map((i) => ({ ...i, color: textColor })),
          center: ['50%', '46%'],
          radius: '62%',
          splitArea: { show: false }
        },
        series: [
          {
            type: 'radar',
            data: radarData.series.map((s, idx) => ({
              ...s,
              itemStyle: { color: idx === 0 ? palette.primary : idx === 1 ? '#34d399' : '#a78bfa' },
              areaStyle: { opacity: 0.25 }
            }))
          }
        ]
      };
    }

    // 7. Scatter Plot
    if (widget.type === 'scatter') {
      const numCols = currentDataSource.columns.filter((c) => c.dataType === 'numeric');
      const sX = numCols[0]?.columnName || xCol;
      const sY = widget.config.secondaryMetric || numCols[1]?.columnName || yCol;
      const scatterResult = calculateScatter(filteredRows, sX, sY);

      return {
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => `${scatterResult.labels[params.dataIndex] || ''}<br/>${sX}: ${params.value[0]}<br/>${sY}: ${params.value[1]}`
        },
        grid: { top: 20, right: 20, bottom: 30, left: 65 },
        xAxis: {
          name: sX,
          type: 'value',
          splitLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: textColor }
        },
        yAxis: {
          name: sY,
          type: 'value',
          splitLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: textColor }
        },
        series: [
          {
            type: 'scatter',
            symbolSize: 12,
            data: scatterResult.data,
            itemStyle: { color: palette.primary, opacity: 0.8 }
          }
        ]
      };
    }

    // 8. Treemap Chart (Ideal for high cardinality descriptive data)
    if (widget.type === 'treemap') {
      const treemapData = aggResult.categories.map((cat, idx) => ({
        name: cat,
        value: aggResult.values[idx]
      }));

      return {
        tooltip: {
          formatter: (params: any) => `${params.name}: <b>${params.value?.toLocaleString()}</b>`
        },
        series: [
          {
            type: 'treemap',
            leafDepth: 1,
            roam: false,
            nodeClick: 'zoomToNode',
            breadcrumb: {
              show: true,
              itemStyle: { color: isDark ? '#1e293b' : '#e2e8f0', textStyle: { color: textColor } }
            },
            label: {
              show: true,
              formatter: '{b}\n{c}',
              fontFamily: 'Tajawal',
              fontSize: 11,
              color: '#fff'
            },
            itemStyle: {
              borderColor: isDark ? '#0f172a' : '#fff',
              borderWidth: 1.5,
              gapWidth: 1
            },
            levels: [
              {
                itemStyle: {
                  borderColor: isDark ? '#0f172a' : '#fff',
                  borderWidth: 2,
                  gapWidth: 2
                }
              },
              {
                colorSaturation: [0.35, 0.7],
                itemStyle: {
                  borderColorSaturation: 0.7,
                  gapWidth: 1
                }
              }
            ],
            data: treemapData
          }
        ]
      };
    }

    // 9. Sunburst Chart
    if (widget.type === 'sunburst') {
      const sunburstData = aggResult.categories.map((cat, idx) => ({
        name: cat,
        value: aggResult.values[idx]
      }));

      return {
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => `${params.name}: <b>${params.value?.toLocaleString()}</b>`
        },
        series: [
          {
            type: 'sunburst',
            radius: ['15%', '85%'],
            center: ['50%', '50%'],
            nodeClick: 'rootToNode',
            sort: undefined,
            emphasis: {
              focus: 'ancestor'
            },
            levels: [
              {},
              {
                r0: '15%',
                r: '45%',
                itemStyle: { borderWidth: 2, borderColor: isDark ? '#0f172a' : '#fff' },
                label: { rotate: 'tangential', fontSize: 10, fontFamily: 'Tajawal', color: textColor }
              },
              {
                r0: '45%',
                r: '85%',
                itemStyle: { borderWidth: 1, borderColor: isDark ? '#0f172a' : '#fff' },
                label: { align: 'right', fontSize: 9, fontFamily: 'Tajawal', color: textColor }
              }
            ],
            data: sunburstData
          }
        ]
      };
    }

    // 10. Heatmap Chart
    if (widget.type === 'heatmap') {
      const secCol =
        widget.config.secondaryMetric ||
        currentDataSource.columns.find((c) => (c.dataType === 'string' || c.dataType === 'date') && c.columnName !== xCol)?.columnName ||
        xCol;
      const hmResult = calculateHeatmap(filteredRows, xCol, secCol, yCol, agg);

      return {
        tooltip: {
          position: 'top',
          formatter: (params: any) => {
            const xVal = hmResult.xCategories[params.value[0]];
            const yVal = hmResult.yCategories[params.value[1]];
            const val = params.value[2];
            return `${xCol}: <b>${xVal}</b><br/>${secCol}: <b>${yVal}</b><br/>${yCol}: <b>${val?.toLocaleString()}</b>`;
          }
        },
        grid: { top: 15, right: 25, bottom: 45, left: 85 },
        xAxis: {
          type: 'category',
          data: hmResult.xCategories,
          splitArea: { show: true },
          axisLabel: {
            color: textColor,
            fontFamily: 'Tajawal',
            fontSize: 10,
            rotate: hmResult.xCategories.length > 6 ? 30 : 0
          }
        },
        yAxis: {
          type: 'category',
          data: hmResult.yCategories,
          splitArea: { show: true },
          axisLabel: { color: textColor, fontFamily: 'Tajawal', fontSize: 10 }
        },
        visualMap: {
          min: hmResult.minVal,
          max: hmResult.maxVal || 100,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          textStyle: { color: textColor, fontSize: 10, fontFamily: 'Tajawal' },
          inRange: {
            color: ['#0f172a', '#0284c7', '#38bdf8', '#fbbf24', '#f43f5e']
          }
        },
        series: [
          {
            type: 'heatmap',
            data: hmResult.data,
            label: {
              show: hmResult.xCategories.length <= 10 && hmResult.yCategories.length <= 10,
              color: '#fff',
              fontSize: 9,
              formatter: (p: any) => formatNumber(p.value[2])
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }
        ]
      };
    }

    // Default: Vertical Bar Chart
    const vBarRadius = widget.config.barBorderRadius ?? 6;
    const baseVBarColor = makeBarColor(false);

    const vBarData = aggResult.categories.map((cat, idx) => {
      const isActive = activeBarCategory === cat;
      return {
        value: aggResult.values[idx],
        itemStyle: isActive
          ? {
              borderRadius: [vBarRadius, vBarRadius, 0, 0],
              color: palette.secondary,
              borderColor: '#ffffff',
              borderWidth: 2,
              shadowBlur: 14,
              shadowColor: palette.primary
            }
          : {
              borderRadius: [vBarRadius, vBarRadius, 0, 0],
              color: baseVBarColor
            }
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: 'rgba(56, 189, 248, 0.12)'
          }
        },
        formatter: (params: any) => `${params[0].name}: <b>${params[0].value.toLocaleString()}</b>`
      },
      grid: { top: 20, right: 20, bottom: aggResult.categories.length > 8 ? 42 : 30, left: 65 },
      dataZoom: aggResult.categories.length > 8 ? [
        {
          type: 'inside',
          xAxisIndex: 0,
          startValue: 0,
          endValue: Math.min(aggResult.categories.length - 1, 9)
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 14,
          bottom: 2,
          startValue: 0,
          endValue: Math.min(aggResult.categories.length - 1, 9),
          borderColor: 'transparent',
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.8)',
          fillerColor: 'rgba(56, 189, 248, 0.25)',
          handleStyle: { color: palette.primary }
        }
      ] : undefined,
      xAxis: {
        type: 'category',
        triggerEvent: true,
        data: aggResult.categories,
        axisLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textColor, fontFamily: 'Tajawal', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textColor, formatter: formatNumber }
      },
      series: [
        {
          name: yCol,
          type: 'bar',
          barWidth: `${widget.config.barWidth ?? 45}%`,
          data: vBarData,
          label: {
            show: widget.config.showDataLabels ?? false,
            position: 'top',
            color: textColor,
            fontSize: 10,
            formatter: (p: any) => formatNumber(p.value)
          },
          emphasis: {
            disabled: false,
            itemStyle: {
              shadowBlur: 18,
              shadowColor: palette.primary
            }
          }
        }
      ]
    };
  };

  // Drill-down and Cross-filtering click event
  const onChartClick = (params: any) => {
    let targetName = params.name;
    if (!targetName && Array.isArray(params.value) && params.value.length === 3) {
      const secCol =
        widget.config.secondaryMetric ||
        currentDataSource.columns.find((c) => (c.dataType === 'string' || c.dataType === 'date') && c.columnName !== xCol)?.columnName ||
        xCol;
      const hmResult = calculateHeatmap(filteredRows, xCol, secCol, yCol, agg);
      targetName = hmResult.xCategories[params.value[0]];
    }
    if (!targetName) targetName = params.value;
    if (!targetName) return;

    // Visual feedback: highlight clicked bar (toggle off if same)
    setActiveBarCategory((prev) => (prev === String(targetName) ? null : String(targetName)));

    // If Drill-Down is enabled and there are deeper levels available, drill down
    if (drillDownEnabled && drillLevels.length > 0) {
      if (currentLevelIndex < drillLevels.length - 1) {
        drillDown(widget.id, activeGroupCol, String(targetName));
        return;
      }
    }

    // Default Cross-filtering behavior (at leaf level or when drill-down is not active)
    if (xCol) {
      const isCurrentActive = (effectiveFilters[xCol] ?? activeFilters[xCol]) === targetName;
      setFilter(xCol, isCurrentActive ? null : targetName, widget.id);
    }
  };

  const renderContent = () => {
    switch (widget.type) {
      case 'kpi': {
        const kpi = calculateKpi(filteredRows, yCol, agg);
        return <KpiWidget title={widget.title} value={kpi.value} config={widget.config} />;
      }

      case 'slicer': {
        const availableColumns = currentDataSource.columns
          .filter((c) => c.columnName && !c.columnName.startsWith('__EMPTY') && c.columnName.trim() !== '')
          .map((c) => c.columnName);

        const slicerCols = widget.config.slicerColumns && widget.config.slicerColumns.length > 0
          ? widget.config.slicerColumns
          : [widget.config.xAxisColumn || availableColumns[0] || 'المنطقة'];

        const activeCol = widget.config.activeSlicerColumn && slicerCols.includes(widget.config.activeSlicerColumn)
          ? widget.config.activeSlicerColumn
          : slicerCols[0];

        const uniqueValues = getUniqueValues(rawRows, activeCol);

        return (
          <SlicerWidget
            widgetId={widget.id}
            slicerColumns={slicerCols}
            activeColumn={activeCol}
            availableColumns={availableColumns}
            options={uniqueValues}
            rawRows={rawRows}
            selectionMode={widget.config.slicerSelectionMode || 'single'}
            onUpdateColumns={(newCols, newActive) => {
              updateWidgetConfig(widget.id, {
                slicerColumns: newCols,
                activeSlicerColumn: newActive || newCols[0],
                xAxisColumn: newActive || newCols[0]
              });
            }}
            onSelectActiveColumn={(col) => {
              updateWidgetConfig(widget.id, {
                activeSlicerColumn: col,
                xAxisColumn: col
              });
            }}
            onChangeSelectionMode={(mode) => {
              updateWidgetConfig(widget.id, { slicerSelectionMode: mode });
            }}
          />
        );
      }

      case 'pivot': {
        const secCol = widget.config.secondaryMetric || currentDataSource.columns.find((c) => c.dataType === 'numeric' && c.columnName !== yCol)?.columnName || yCol;
        const pivotRows = aggResult.categories.map((cat, idx) => {
          const catRows = drillFilteredRows.filter((r) => String(r[activeGroupCol]) === cat);
          const secSum = catRows.reduce((acc, r) => acc + (typeof r[secCol] === 'number' ? r[secCol] : parseFloat(r[secCol]) || 0), 0);

          return {
            groupKey: cat,
            count: aggResult.counts[idx],
            revenue: aggResult.values[idx],
            profit: Math.round(secSum)
          };
        });
        return (
          <PivotTableWidget
            data={pivotRows}
            groupByColumn={activeGroupCol}
            drillEnabled={drillDownEnabled}
            hasMoreLevels={currentLevelIndex < drillLevels.length - 1}
            onGroupClick={(groupKey) => {
              if (drillDownEnabled && currentLevelIndex < drillLevels.length - 1) {
                drillDown(widget.id, activeGroupCol, groupKey);
              }
            }}
          />
        );
      }

      case 'table': {
        const cleanCols = currentDataSource.columns
          .filter((c) => c.columnName && !c.columnName.startsWith('__EMPTY') && c.columnName.trim() !== '')
          .map((c) => c.columnName);
        const selectedCols = widget.config.tableColumns && widget.config.tableColumns.length > 0
          ? widget.config.tableColumns
          : cleanCols.slice(0, 5);
        return (
          <DataTableWidget
            rows={filteredRows}
            columns={selectedCols}
            config={widget.config}
            activeFilters={effectiveFilters}
            selectedRowKey={activeTableRowKey}
            onRowClick={(rowKey) => setActiveTableRowKey(rowKey)}
            onFilterRemove={(col) => setFilter(col, null, widget.id)}
            motionTheme={motionTheme || currentDashboard?.motionTheme}
          />
        );
      }

      case 'wordcloud': {
        return (
          <WordCloudWidget
            categories={aggResult.categories}
            values={aggResult.values}
            theme={themeKey}
            activeWord={activeBarCategory}
            formatNumber={formatNumber}
            onWordClick={(word, val) => onChartClick({ name: word, value: val })}
          />
        );
      }

      default:
        return (
          <EChartWrapper
            options={applyMotionThemeToECharts(getChartOption(), motionTheme || currentDashboard?.motionTheme || 'glass-capsule')}
            theme={theme}
            onEvents={{ click: onChartClick }}
          />
        );
    }
  };

  return (
    <div
      onClick={() => isEditMode && setSelectedWidgetId(widget.id)}
      style={{
        backgroundColor: widget.config.cardBgColor || undefined,
        borderColor: widget.config.cardBorderColor || undefined,
        borderRadius: widget.config.cardBorderRadius !== undefined
          ? `${widget.config.cardBorderRadius}px`
          : undefined,
        boxShadow: widget.config.cardShadow === false
          ? 'none'
          : undefined
      }}
      className={`relative flex flex-col h-full rounded-xl border transition-all duration-300 overflow-hidden widget-3d group/card cursor-default ${
        activeMotionTheme.cardWrapperClass
      } ${
        isSelected
          ? '!border-sky-500 ring-2 ring-sky-500/30 glow-sky'
          : ''
      } ${
        isLightCard ? 'text-gray-900' : 'text-slate-100'
      }`}
      data-theme={activeMotionTheme.id}
    >
      {/* Widget Header */}
      <div className={`flex items-center justify-between px-3.5 py-2 border-b select-none gap-2 ${
        isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/90'
      }`}>
        <div className={`flex items-center gap-2 overflow-hidden flex-1 ${
          widget.config.titleAlign === 'center'
            ? 'justify-center'
            : widget.config.titleAlign === 'left'
            ? 'justify-end'
            : 'justify-start'
        }`}>
          {isEditMode && (
            <div
              draggable={isEditMode}
              onDragStart={(e) => {
                if (onDragStart) {
                  onDragStart(e);
                } else {
                  e.dataTransfer.setData('text/plain', widget.id);
                  e.dataTransfer.effectAllowed = 'move';
                }
              }}
              onDragEnd={onDragEnd}
              title="اسحب بالماوس لنقل هذا العنصر وإفلاته في أي موضع بالتقرير"
              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-sky-400 transition shrink-0"
            >
              <GripHorizontal className="w-4 h-4" />
            </div>
          )}
          <h3
            className={`font-bold truncate ${
              isLightCard ? 'text-gray-900' : 'text-slate-200'
            }`}
            title={widget.title}
            style={{
              fontSize: widget.config.titleFontSize ? `${widget.config.titleFontSize}px` : '12px',
              color: widget.config.titleColor || undefined
            }}
          >
            {widget.title}
          </h3>
          {drillDownEnabled && drillLevels.length > 0 && widget.type !== 'table' && (
            <span
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-medium shrink-0 shadow-xs"
              title={`مسار هرمي: ${drillLevels.join(' ← ')}`}
            >
              <Layers className="w-3 h-3 text-sky-400" />
              <span>هرمي ({currentDrillPath.length + 1}/{drillLevels.length})</span>
            </span>
          )}
          {activeFilters[xCol] && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono shrink-0">
              مفلتر: {activeFilters[xCol]}
            </span>
          )}
        </div>

        {/* Quick Size Controls in Header (Edit Mode) */}
        {isEditMode && (
          <div className="hidden sm:flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono shrink-0">
            <span className="text-slate-500 px-1 text-[9px]">العرض:</span>
            {[3, 4, 6, 8, 12].map((colSpan) => (
              <button
                key={colSpan}
                onClick={(e) => {
                  e.stopPropagation();
                  setWidgetWidth(widget.id, colSpan);
                }}
                title={`تغيير العرض إلى ${colSpan === 12 ? 'عرض كامل 100%' : colSpan === 6 ? 'نصف الشاشة 50%' : `${colSpan}/12`}`}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  (widget.layout?.w ?? 6) === colSpan
                    ? 'bg-sky-500 text-white font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {colSpan === 12 ? '100%' : colSpan === 6 ? '50%' : colSpan === 4 ? '33%' : colSpan === 3 ? '25%' : `${colSpan}`}
              </button>
            ))}

            <div className="w-px h-3 bg-slate-800 mx-0.5" />

            {/* Height Step Controls */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setWidgetHeight(widget.id, Math.max(2, (widget.layout?.h || 4) - 1));
              }}
              title="تقليل الارتفاع"
              className="px-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer font-bold"
            >
              -
            </button>
            <span className="text-slate-500 text-[9px]">H{widget.layout?.h || 4}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setWidgetHeight(widget.id, Math.min(8, (widget.layout?.h || 4) + 1));
              }}
              title="زيادة الارتفاع"
              className="px-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer font-bold"
            >
              +
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 text-slate-400 shrink-0">
          {/* Interaction Linking Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsInteractionsModalOpen(true);
            }}
            title={
              widget.config?.ignoreIncomingFilters
                ? 'العنصر معزول عن التصفية تماماً (انقر لتعديل الربط)'
                : widget.config?.crossFilterMode === 'none'
                ? 'العنصر مفصول عن التأثير على العناصر الأخرى (انقر للربط)'
                : widget.config?.crossFilterMode === 'custom'
                ? `ربط مخصص: مرتبط مع ${widget.config?.linkedWidgetIds?.length || 0} عنصر`
                : 'ربط التفاعل: مرتبط مع كافة الجارتات والجداول (انقر للتخصيص أو الفصل)'
            }
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition cursor-pointer text-xs font-medium ${
              widget.config?.ignoreIncomingFilters || widget.config?.crossFilterMode === 'none'
                ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300'
                : widget.config?.crossFilterMode === 'custom'
                ? 'bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/40 text-purple-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
          >
            {widget.config?.ignoreIncomingFilters ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline text-[10px]">معزول</span>
              </>
            ) : widget.config?.crossFilterMode === 'none' ? (
              <>
                <Unlink className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden md:inline text-[10px]">مفصول</span>
              </>
            ) : widget.config?.crossFilterMode === 'custom' ? (
              <>
                <Link2 className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden md:inline text-[10px]">
                  ربط ({widget.config?.linkedWidgetIds?.length || 0})
                </span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden md:inline text-[10px]">ربط العناصر</span>
              </>
            )}
          </button>

          {isEditMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMoveMenuOpen(true);
              }}
              title="نقل وترتيب موضع العنصر في التقرير (البداية، المنتصف، النهاية)"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 hover:text-white transition cursor-pointer text-xs font-medium"
            >
              <Move className="w-3.5 h-3.5" />
              <span className="hidden md:inline">نقل الموضع</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(true);
            }}
            title="ملء الشاشة"
            className="p-1 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {isEditMode && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateWidget(widget.id);
                }}
                title="تكرار العنصر"
                className="p-1 hover:text-slate-200 rounded hover:bg-slate-800 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedWidgetId(widget.id);
                }}
                title="تعديل الخصائص"
                className="p-1 hover:text-sky-400 rounded hover:bg-slate-800 transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeWidget(widget.id);
                }}
                title="حذف العنصر"
                className="p-1 hover:text-rose-400 rounded hover:bg-slate-800 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Widget Reordering Modal */}
      {isMoveMenuOpen && createPortal(
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsMoveMenuOpen(false);
          }}
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-right text-slate-200 select-none my-auto"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Move className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">نقل وترتيب موضع العنصر</h4>
                  <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{widget.title}</p>
                </div>
              </div>
              <button
                onClick={() => setIsMoveMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400">الترتيب والموقع الحالي:</span>
                <span className="font-mono font-bold text-sky-400">
                  #{currentIndex + 1} من أصل {widgetCount}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5 pt-1">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => {
                    moveWidgetToPosition(widget.id, 'start');
                    setIsMoveMenuOpen(false);
                  }}
                  className="w-full text-right px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-sky-500/20 hover:text-sky-300 border border-slate-700/60 transition flex items-center justify-between text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ArrowUpToLine className="w-4 h-4 text-sky-400" />
                    <span>نقل إلى بداية التقرير (أول عنصر)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">الموقع #1</span>
                </button>

                <button
                  disabled={currentIndex === 0}
                  onClick={() => {
                    moveWidgetToPosition(widget.id, 'up');
                    setIsMoveMenuOpen(false);
                  }}
                  className="w-full text-right px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-sky-500/20 hover:text-sky-300 border border-slate-700/60 transition flex items-center justify-between text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ChevronUp className="w-4 h-4 text-indigo-400" />
                    <span>تقديم خطوة واحدة للأمام (أعلى)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">#{Math.max(1, currentIndex)}</span>
                </button>

                <button
                  onClick={() => {
                    moveWidgetToPosition(widget.id, 'middle');
                    setIsMoveMenuOpen(false);
                  }}
                  className="w-full text-right px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-sky-500/20 hover:text-sky-300 border border-slate-700/60 transition flex items-center justify-between text-xs font-semibold cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span>نقل إلى منتصف التقرير</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">#{Math.floor(widgetCount / 2) + 1}</span>
                </button>

                <button
                  disabled={currentIndex === widgetCount - 1}
                  onClick={() => {
                    moveWidgetToPosition(widget.id, 'down');
                    setIsMoveMenuOpen(false);
                  }}
                  className="w-full text-right px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-sky-500/20 hover:text-sky-300 border border-slate-700/60 transition flex items-center justify-between text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 text-indigo-400" />
                    <span>تأخير خطوة واحدة للخلف (أسفل)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">#{Math.min(widgetCount, currentIndex + 2)}</span>
                </button>

                <button
                  disabled={currentIndex === widgetCount - 1}
                  onClick={() => {
                    moveWidgetToPosition(widget.id, 'end');
                    setIsMoveMenuOpen(false);
                  }}
                  className="w-full text-right px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-sky-500/20 hover:text-sky-300 border border-slate-700/60 transition flex items-center justify-between text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ArrowDownToLine className="w-4 h-4 text-purple-400" />
                    <span>نقل إلى نهاية التقرير (آخر عنصر)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">#{widgetCount}</span>
                </button>
              </div>

              {/* Direct Jump Selector */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">أو حدد الترتيب المطلوب:</span>
                <select
                  value={currentIndex}
                  onChange={(e) => {
                    moveWidgetToIndex(widget.id, parseInt(e.target.value, 10));
                    setIsMoveMenuOpen(false);
                  }}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-sky-400 font-bold outline-none cursor-pointer"
                >
                  {Array.from({ length: widgetCount }, (_, i) => (
                    <option key={i} value={i}>
                      الموقع #{i + 1} {i === 0 ? '(البداية)' : i === widgetCount - 1 ? '(النهاية)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950/60 border-t border-slate-800 text-center">
              <button
                onClick={() => setIsMoveMenuOpen(false)}
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Hierarchical Drill-Down Breadcrumb Bar */}
      {drillDownEnabled && drillLevels.length > 0 && widget.type !== 'table' && (
        <DrillBreadcrumb
          drillPath={currentDrillPath}
          currentColumn={activeGroupCol}
          totalLevels={drillLevels.length}
          onNavigate={(toLevel) => drillUp(widget.id, toLevel)}
          onReset={() => resetDrillDown(widget.id)}
        />
      )}

      {/* Widget Body */}
      <div className="flex-1 p-2 min-h-0 overflow-hidden relative">
        {renderContent()}
      </div>

      {/* Interaction Linking Modal */}
      {isInteractionsModalOpen && (
        <WidgetInteractionsModal
          widget={widget}
          isOpen={isInteractionsModalOpen}
          onClose={() => setIsInteractionsModalOpen(false)}
        />
      )}

      {/* ── Dedicated Fullscreen Modal Overlay (Portal to document.body) ── */}
      {isFullscreen && createPortal(
        <div
          dir="rtl"
          className="fixed inset-0 z-[99999] bg-slate-950/98 backdrop-blur-xl flex flex-col p-3 sm:p-5 text-slate-100 select-none animate-fadeIn overflow-hidden"
        >
          {/* Fullscreen Dedicated Top Bar (Completely safe from any app headers) */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl mb-3 shrink-0 gap-3">
            {/* Title + Type Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 shrink-0">
                <Maximize2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md" title={widget.title}>
                    {widget.title}
                  </h2>
                  <span className="hidden xs:inline-block text-[10px] px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold shrink-0">
                    {widget.type === 'donut' || widget.type === 'pie' ? 'مخطط دائري' : widget.type === 'bar' ? 'مخطط شريطي' : widget.type === 'table' ? 'جدول بيانات' : widget.type === 'slicer' ? 'فلتر تصفية' : widget.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                  عرض مكبر بملء الشاشة مع تفاعلية كاملة ومعالجة فورية
                </p>
              </div>
            </div>

            {/* Actions: Prominent Minimize Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-500/25 transition cursor-pointer"
                title="تصغير والعودة للوحة (Esc)"
              >
                <Minimize2 className="w-4 h-4" />
                <span>تصغير الشاشة</span>
              </button>

              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer border border-slate-700/60"
                title="إغلاق (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drilldown breadcrumb inside fullscreen if applicable */}
          {drillDownEnabled && drillLevels.length > 0 && widget.type !== 'table' && (
            <div className="mb-2 shrink-0">
              <DrillBreadcrumb
                drillPath={currentDrillPath}
                currentColumn={activeGroupCol}
                totalLevels={drillLevels.length}
                onNavigate={(toLevel) => drillUp(widget.id, toLevel)}
                onReset={() => resetDrillDown(widget.id)}
              />
            </div>
          )}

          {/* Fullscreen Body (fills remaining height completely) */}
          <div className="flex-1 w-full min-h-0 relative p-3 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            {renderContent()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
