export type WidgetType =
  | 'kpi'
  | 'bar'
  | 'horizontal_bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'radar'
  | 'funnel'
  | 'gauge'
  | 'scatter'
  | 'treemap'
  | 'sunburst'
  | 'heatmap'
  | 'wordcloud'
  | 'pivot'
  | 'table'
  | 'slicer';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  i: string;
}

export type AggregationType = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';

export interface WidgetConfig {
  xAxisColumn?: string;
  yAxisColumn?: string;
  secondaryMetric?: string;
  aggregation?: AggregationType;
  legendColumn?: string;
  filterValues?: Record<string, any>;
  colorPalette?: string[];
  colorTheme?: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan' | 'slate';
  numberFormat?: 'currency' | 'percent' | 'compact' | 'standard';
  comparisonDelta?: number;
  sortOrder?: 'desc' | 'asc' | 'none';
  topN?: number;
  gaugeMax?: number;
  targetValue?: number;

  // Table Widget Properties
  tableColumns?: string[];
  tablePageSize?: number;

  // Slicer Multi-Column Properties
  slicerColumns?: string[];
  activeSlicerColumn?: string;
  slicerSelectionMode?: 'single' | 'multi';

  // Power BI & Looker Style Properties
  showDataLabels?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  showGridlines?: boolean;
  smoothLine?: boolean;
  lineWidth?: number;
  showSymbols?: boolean;
  areaOpacity?: number;
  barBorderRadius?: number;
  barWidth?: number;
  donutHoleRatio?: number;
  pieRoseType?: boolean;
  pieLabelType?: 'percent' | 'value' | 'name';
  titleAlign?: 'right' | 'center' | 'left';
  titleFontSize?: number;
  titleColor?: string;
  showCardHeader?: boolean;
  cardBgColor?: string;
  cardBorderColor?: string;
  cardBorderRadius?: number;
  cardShadow?: boolean;
  primaryColor?: string;
  isGradient?: boolean;

  // Advanced Table Styling Properties
  tableHeaderBg?: string;
  tableHeaderColor?: string;
  tableZebra?: boolean;
  tableDensity?: 'compact' | 'comfortable' | 'spacious';
  tableHighlightMax?: boolean;
  tableBorderStyle?: 'horizontal' | 'grid' | 'none';

  // Drill-Down Hierarchical Navigation
  drillDownEnabled?: boolean;
  drillDownLevels?: string[];  // Ordered column names: [Company, Dept, Product, ...]

  // Cross-Filtering & Visual Interaction Linking
  crossFilterMode?: 'all' | 'custom' | 'none'; // 'all' (default), 'custom', 'none'
  linkedWidgetIds?: string[];                  // IDs of widgets receiving filters from this widget
  ignoreIncomingFilters?: boolean;             // If true, widget ignores incoming filters
  allowedIncomingWidgetIds?: string[];         // If set, only receives filters from these widgets
}


export interface Widget {
  id: string;
  dashboardId: string;
  dataSourceId: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  layout: WidgetLayout;
}

export interface Dashboard {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  widgets: Widget[];
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  motionTheme?: string;
}
