import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as duckdb from 'duckdb';
import * as path from 'path';
import * as fs from 'fs';

export interface ColumnMetadata {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
}

export interface SheetMetadata {
  name: string;
  rowCount: number;
  columns: ColumnMetadata[];
}

export interface IngestionResult {
  dataSourceId: string;
  parquetPath: string;
  rowCount: number;
  fileSizeBytes: number;
  sheets: SheetMetadata[];
}

@Injectable()
export class DataIngestionService {
  private readonly logger = new Logger(DataIngestionService.name);
  private db = new duckdb.Database(':memory:');

  /**
   * Converts uploaded Excel/CSV file into an optimized Parquet columnar file
   * Extracts detailed schema metadata (sheets, columns, and data types)
   */
  async processUploadedFile(
    filePath: string,
    workspaceId: string,
    originalFilename: string
  ): Promise<IngestionResult> {
    const ext = path.extname(originalFilename).toLowerCase();
    const baseName = path.basename(originalFilename, ext);
    const targetParquetDir = path.join(process.env.STORAGE_BASE_PATH || '/app/storage', 'parquet_cache', workspaceId);

    if (!fs.existsSync(targetParquetDir)) {
      fs.mkdirSync(targetParquetDir, { recursive: true });
    }

    const parquetPath = path.join(targetParquetDir, `${baseName}_${Date.now()}.parquet`);
    const stats = fs.statSync(filePath);

    if (stats.size > 50 * 1024 * 1024) {
      throw new BadRequestException('حجم الملف يتجاوز الحد المسموح به (50 ميجابايت)');
    }

    this.logger.log(`Ingesting data file: ${originalFilename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    const con = this.db.connect();

    try {
      if (ext === '.csv') {
        // Fast CSV to Parquet conversion in DuckDB
        const convertSql = `
          COPY (SELECT * FROM read_csv_auto('${filePath}', header=true))
          TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION SNAPPY);
        `;
        await this.runSql(con, convertSql);
      } else if (ext === '.xlsx' || ext === '.xls') {
        // In production DuckDB spatial or excel extension converts sheets
        const convertSql = `
          INSTALL spatial;
          LOAD spatial;
          COPY (SELECT * FROM st_read('${filePath}'))
          TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION SNAPPY);
        `;
        await this.runSql(con, convertSql);
      } else {
        throw new BadRequestException('نوع الملف غير مدعوم. الصيغ المدعومة هي Excel و CSV فقط.');
      }

      // Inspect schema metadata from generated Parquet
      const schemaSql = `DESCRIBE SELECT * FROM read_parquet('${parquetPath}') LIMIT 1;`;
      const schemaRows = await this.querySql<{ column_name: string; column_type: string }>(con, schemaSql);

      const countSql = `SELECT count(*) as total FROM read_parquet('${parquetPath}');`;
      const countResult = await this.querySql<{ total: number }>(con, countSql);
      const rowCount = Number(countResult[0]?.total || 0);

      const columns: ColumnMetadata[] = schemaRows.map((row) => ({
        name: row.column_name,
        type: this.mapDuckDbTypeToAppType(row.column_type),
      }));

      return {
        dataSourceId: `ds_${Date.now()}`,
        parquetPath,
        rowCount,
        fileSizeBytes: stats.size,
        sheets: [
          {
            name: baseName,
            rowCount,
            columns,
          },
        ],
      };
    } finally {
      // Clean connection
    }
  }

  private mapDuckDbTypeToAppType(duckType: string): 'string' | 'number' | 'date' | 'boolean' {
    const t = duckType.toUpperCase();
    if (t.includes('INT') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL') || t.includes('HUGEINT')) {
      return 'number';
    }
    if (t.includes('DATE') || t.includes('TIME') || t.includes('TIMESTAMP')) {
      return 'date';
    }
    if (t.includes('BOOL')) {
      return 'boolean';
    }
    return 'string';
  }

  private runSql(con: duckdb.Connection, sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      con.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private querySql<T>(con: duckdb.Connection, sql: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      con.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  }
}
