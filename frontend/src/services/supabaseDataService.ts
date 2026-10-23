// ============================================================
// Supabase Data Service
// Handles syncing Excel/Sheet data to Supabase DB
// ============================================================

import { supabase, DEFAULT_WORKSPACE_ID } from './supabaseClient';
import type { DataSource, Column, ColumnDataType, Sheet } from '../types/dataSource';

// Column mapping: Arabic field names -> DB columns
const COLUMN_MAP: Record<string, string> = {
  'اسم الشركة': 'company_name',
  'الموقع': 'location',
  'الهاتف / الاتصال': 'phone',
  'الهاتف': 'phone',
  'كود المنتج / الموديل': 'product_code',
  'كود المنتج': 'product_code',
  'اسم المنتج والوصف': 'product_name_full',
  'اسم المنتج': 'product_name',
  'الكمية': 'quantity',
  'سعر المفرد': 'unit_price',
  'الخصم': 'discount',
  'السعر الإجمالي': 'total_price',
  'مدة العرض': 'offer_duration',
  'العرض': 'offer_terms',
  'الضمان': 'warranty',
  'القسم': 'department',
  'الحالة': 'status',
};

const KNOWN_COLUMNS = new Set(Object.keys(COLUMN_MAP));

function mapRowToProduct(row: Record<string, any>, dataSourceId: string, rowIndex: number) {
  if (!row || typeof row !== 'object') {
    return { data_source_id: dataSourceId, row_index: rowIndex, extra_data: null };
  }
  const product: Record<string, any> = {
    data_source_id: dataSourceId,
    row_index: rowIndex,
    extra_data: {},
  };

  for (const [key, val] of Object.entries(row)) {
    const dbCol = COLUMN_MAP[key];
    if (dbCol) {
      if (['quantity', 'unit_price', 'discount', 'total_price'].includes(dbCol)) {
        if (typeof val === 'number') {
          product[dbCol] = isNaN(val) ? 0 : val;
        } else {
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          product[dbCol] = isNaN(num) ? 0 : num;
        }
      } else {
        product[dbCol] = val !== undefined && val !== null ? String(val).slice(0, 4000) : null;
      }
    } else if (!KNOWN_COLUMNS.has(key)) {
      product.extra_data[key] = val;
    }
  }

  if (Object.keys(product.extra_data).length === 0) {
    product.extra_data = null;
  }

  return product;
}

export interface SyncResult {
  success: boolean;
  dataSourceId?: string;
  rowsInserted?: number;
  error?: string;
}

/**
 * Syncs a DataSource (from Excel/Google Sheets) to Supabase.
 * Creates a data_source record, clears old products, inserts new rows.
 */
export async function syncDataSourceToSupabase(
  ds: DataSource,
  options?: { sourceName?: string; projectId?: string }
): Promise<SyncResult> {
  try {
    const rawSourceName = options?.sourceName || ds?.fileName || 'مصدر بيانات جديد';
    const sourceName = rawSourceName.slice(0, 190);
    const rows = ds?.rawRows || [];
    const columnsMeta = ds?.columns?.map(c => ({ name: c.columnName, type: c.dataType })) || [];

    const fileType = ds?.fileName?.toLowerCase().endsWith('.csv') ? 'csv' : 'excel';
    const filePath = `/storage/project-files/${ds?.fileName || 'dataset.xlsx'}`;
    const fileSize = ds?.fileSizeBytes || 0;

    // 1. Create data_source record
    const { data: dsRecord, error: dsError } = await supabase
      .from('data_sources')
      .insert({
        workspace_id: DEFAULT_WORKSPACE_ID,
        name: sourceName,
        file_type: fileType,
        file_path: filePath,
        file_size_bytes: fileSize,
        row_count: rows.length,
        schema_metadata: {
          projectId: options?.projectId || ds?.id || null,
          columns: columnsMeta,
          fileName: ds?.fileName || null,
          sheetsCount: ds?.sheets?.length || 1
        }
      })
      .select()
      .single();

    if (dsError || !dsRecord) {
      return { success: false, error: dsError?.message || 'Failed to create data source record' };
    }

    const dataSourceId = dsRecord.id;

    // 2. Insert products in batches of 500
    const BATCH_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const products = batch.map((row, idx) => mapRowToProduct(row, dataSourceId, i + idx));

      const { error: insertError } = await supabase.from('products').insert(products);
      if (insertError) {
        console.error('Batch insert error:', insertError);
        return { success: false, error: `خطأ أثناء إدراج السجلات: ${insertError.message}` };
      } else {
        insertedCount += batch.length;
      }
    }

    // 3. Update row_count
    await supabase
      .from('data_sources')
      .update({ row_count: insertedCount })
      .eq('id', dataSourceId);

    // 4. Log upload history (safely)
    try {
      await supabase.from('upload_history').insert({
        data_source_id: dataSourceId,
        file_name: ds?.fileName || sourceName,
        file_size: ds?.fileSizeBytes || null,
        row_count: insertedCount,
        status: 'success',
      });
    } catch (historyErr) {
      console.warn('Upload history log notice:', historyErr);
    }

    return { success: true, dataSourceId, rowsInserted: insertedCount };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown error during sync' };
  }
}

/**
 * Load all data sources from Supabase
 */
export async function loadDataSources() {
  const { data, error } = await supabase
    .from('data_sources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Load products for a specific data source
 */
export async function loadProducts(dataSourceId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('data_source_id', dataSourceId)
    .order('row_index', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Delete a data source and all its products
 */
export async function deleteDataSource(dataSourceId: string) {
  const { error } = await supabase
    .from('data_sources')
    .delete()
    .eq('id', dataSourceId);

  if (error) throw error;
}

/**
 * Convert products records back to DataSource format
 */
export function productsToDataSource(
  products: any[],
  dsRecord: any,
  originalColumns?: any[]
): DataSource {
  const REVERSE_MAP: Record<string, string> = {
    company_name: 'اسم الشركة',
    location: 'الموقع',
    phone: 'الهاتف / الاتصال',
    product_code: 'كود المنتج / الموديل',
    product_name_full: 'اسم المنتج والوصف',
    product_name: 'اسم المنتج',
    quantity: 'الكمية',
    unit_price: 'سعر المفرد',
    discount: 'الخصم',
    total_price: 'السعر الإجمالي',
    offer_duration: 'مدة العرض',
    offer_terms: 'العرض',
    warranty: 'الضمان',
    department: 'القسم',
    status: 'الحالة',
  };

  const rawRows = products.map((p: any) => {
    const row: Record<string, any> = {};
    for (const [dbCol, arabicName] of Object.entries(REVERSE_MAP)) {
      if (p[dbCol] !== null && p[dbCol] !== undefined) {
        row[arabicName] = p[dbCol];
      }
    }
    if (p.extra_data) Object.assign(row, p.extra_data);
    return row;
  });

  const metadata = dsRecord.schema_metadata || {};
  const columnsList = metadata.columns || dsRecord.columns_meta || [];
  const cols: Column[] = originalColumns || (columnsList.map((c: any, i: number) => ({
    id: `c-db-${i}`,
    columnName: c.name || c.columnName,
    dataType: (c.type || c.dataType || 'string') as ColumnDataType,
    sampleValues: [] as (string | number)[],
  })) ?? []);

  const sheetObj: Sheet = {
    id: 'sheet-db-0',
    name: dsRecord.name,
    rowCount: rawRows.length,
    columns: cols,
    rawRows,
  };

  return {
    id: dsRecord.id,
    workspaceId: dsRecord.workspace_id || 'ws-main',
    fileName: metadata.fileName || dsRecord.file_name || dsRecord.name,
    fileSizeBytes: dsRecord.file_size_bytes || dsRecord.file_size || 0,
    uploadedAt: dsRecord.created_at || new Date().toISOString(),
    sheets: [sheetObj],
    activeSheetId: sheetObj.id,
    columns: cols,
    rawRows,
  };
}
