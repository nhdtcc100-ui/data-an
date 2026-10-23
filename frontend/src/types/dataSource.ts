export type ColumnDataType = 'string' | 'numeric' | 'date' | 'boolean';

export interface Column {
  id: string;
  columnName: string;
  dataType: ColumnDataType;
  sampleValues?: (string | number)[];
  sourceTableId?: string;   // الجدول الأصلي (للأعمدة المدمجة)
  isComputed?: boolean;     // هل هو عمود محسوب؟
}

export interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  columns: Column[];
  previewRows?: Record<string, any>[];
  rawRows?: Record<string, any>[];
}

export interface DataSource {
  id: string;
  workspaceId: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: string;
  sheets: Sheet[];
  activeSheetId: string;
  columns: Column[];
  rawRows: Record<string, any>[];
  multiModel?: MultiTableDataSource;
}

// ══════════════════════════════════════════════════════════════
// نموذج البيانات المتعدد المصادر (Multi-Table Data Model)
// ══════════════════════════════════════════════════════════════

/** إدخال جدول واحد (ملف أو ورقة أو جدول DB) */
export interface TableEntry {
  id: string;
  name: string;
  sourceType: 'file' | 'sheet' | 'db';
  fileName?: string;
  columns: Column[];
  rawRows: Record<string, any>[];
  rowCount: number;
  uploadedAt: string;
  color?: string; // لون العرض في الرسم البياني
}

/** علاقة ربط بين جدولين */
export interface TableRelation {
  id: string;
  leftTableId: string;
  rightTableId: string;
  leftColumn: string;
  rightColumn: string;
  joinType: 'inner' | 'left' | 'right';
  confidence: number;       // 0–1
  isAutoDetected: boolean;
}

/** عقدة في شجرة الصيغ (AST) */
export type FormulaNode =
  | { type: 'column'; name: string }
  | { type: 'number'; value: number }
  | { type: 'func'; name: 'abs' | 'round' | 'sqrt'; arg: FormulaNode }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '%'; left: FormulaNode; right: FormulaNode };

/** عمود محسوب */
export interface ComputedColumn {
  id: string;
  name: string;
  formula: string;           // نص الصيغة كما كتبه المستخدم
  expression?: FormulaNode;  // الشجرة المحللة
  dataType: 'numeric';
  sourceColumns: string[];
  description?: string;
}

/** نموذج البيانات المدمج */
export interface MultiTableDataSource {
  tables: TableEntry[];
  relations: TableRelation[];
  computedColumns: ComputedColumn[];
  mergedRows?: Record<string, any>[];
  mergedColumns?: Column[];
  lastMergedAt?: string;
  mode?: 'join' | 'append' | 'auto';
}

