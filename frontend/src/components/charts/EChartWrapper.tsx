import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface EChartWrapperProps {
  options: echarts.EChartsOption;
  theme?: 'dark' | 'light';
  onEvents?: Record<string, (params: any) => void>;
  className?: string;
}

function getCategoryAxisData(options: any): { isHorizontal: boolean; categories: string[] } | null {
  if (!options) return null;
  const xAxis = Array.isArray(options.xAxis) ? options.xAxis[0] : options.xAxis;
  const yAxis = Array.isArray(options.yAxis) ? options.yAxis[0] : options.yAxis;

  // Horizontal bar: yAxis is category
  if (yAxis && yAxis.type === 'category' && Array.isArray(yAxis.data) && yAxis.data.length > 0) {
    return { isHorizontal: true, categories: yAxis.data };
  }
  // Vertical bar / Line / Area: xAxis is category
  if (xAxis && (xAxis.type === 'category' || Array.isArray(xAxis.data)) && Array.isArray(xAxis.data) && xAxis.data.length > 0) {
    return { isHorizontal: false, categories: xAxis.data };
  }
  return null;
}

export const EChartWrapper: React.FC<EChartWrapperProps> = ({
  options,
  theme = 'dark',
  onEvents,
  className = 'w-full h-full min-h-[260px]'
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const lastHandledTimeRef = useRef<number>(0);

  // Store refs to OUR ZRender handlers so we can remove ONLY them
  // (calling zr.off('click') without a handler removes ECharts' own internals too — bug!)
  const zrClickRef = useRef<((e: any) => void) | null>(null);
  const zrMoveRef = useRef<((e: any) => void) | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      const clientWidth = chartRef.current.clientWidth;
      const clientHeight = chartRef.current.clientHeight;
      // Provide fallback dimension if mounted in an unmeasured layout to avoid console warning
      const initOpts = clientWidth > 0 && clientHeight > 0
        ? undefined
        : { width: clientWidth || 300, height: clientHeight || 260 };
      chartInstance.current = echarts.init(chartRef.current, theme, initOpts);
    }

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (chartRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            chartInstance.current?.resize();
          }
        }
      });
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      chartInstance.current?.dispose();
    };
  }, [theme]);

  useEffect(() => {
    if (!chartInstance.current) return;
    const chart = chartInstance.current;
    chart.setOption(options, true);

    const clickHandler = onEvents?.click;

    // Debounced safe click handler — prevents double-firing when both
    // ECharts click AND ZRender grid-click fire for the same interaction
    const safeClickHandler = (params: any) => {
      const now = Date.now();
      if (now - lastHandledTimeRef.current < 250) return;
      lastHandledTimeRef.current = now;
      clickHandler?.(params);
    };

    // Register ECharts-level click — works for Pie, Funnel, Radar, Scatter, etc.
    if (onEvents) {
      Object.entries(onEvents).forEach(([eventName, handler]) => {
        chart.off(eventName);
        if (eventName === 'click') {
          chart.on('click', safeClickHandler);
        } else {
          chart.on(eventName, handler);
        }
      });
    }

    // For bar/line charts: also support clicking anywhere in the grid band
    // (allows triggering even very small / zero-height bars)
    const zr = chart.getZr();
    const catInfo = getCategoryAxisData(options);

    // Remove only OUR previously stored handlers — never touch ECharts internals
    if (zrClickRef.current) {
      zr.off('click', zrClickRef.current);
      zrClickRef.current = null;
    }
    if (zrMoveRef.current) {
      zr.off('mousemove', zrMoveRef.current);
      zrMoveRef.current = null;
    }

    if (catInfo && clickHandler) {
      const mousemoveHandler = (e: any) => {
        if (chart.containPixel('grid', [e.offsetX, e.offsetY])) {
          zr.setCursorStyle('pointer');
        } else {
          zr.setCursorStyle('default');
        }
      };

      const zrClickHandler = (e: any) => {
        const pointInPixel: [number, number] = [e.offsetX, e.offsetY];
        if (chart.containPixel('grid', pointInPixel)) {
          try {
            const pointInGrid = chart.convertFromPixel({ seriesIndex: 0 }, pointInPixel);
            if (pointInGrid && pointInGrid.length >= 2) {
              const rawIdx = catInfo.isHorizontal ? pointInGrid[1] : pointInGrid[0];
              const catIdx = Math.round(rawIdx);
              if (catIdx >= 0 && catIdx < catInfo.categories.length) {
                const categoryName = String(catInfo.categories[catIdx] ?? '');
                if (categoryName) {
                  safeClickHandler({
                    name: categoryName,
                    dataIndex: catIdx,
                    componentType: 'series',
                    event: e
                  });
                }
              }
            }
          } catch (err) {
            console.debug('Error in grid click coordinate conversion:', err);
          }
        }
      };

      // Save refs so next render can cleanly remove them
      zrMoveRef.current = mousemoveHandler;
      zrClickRef.current = zrClickHandler;

      zr.on('mousemove', mousemoveHandler);
      zr.on('click', zrClickHandler);
    }
  }, [options, onEvents]);

  return <div ref={chartRef} className={className} />;
};
