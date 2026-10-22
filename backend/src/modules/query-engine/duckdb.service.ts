import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as duckdb from 'duckdb';
import { buildDuckDbSql, QueryPayload } from './query-builder';

export interface QueryResult<T = any> {
  data: T[];
  executionTimeMs: number;
  rowCount: number;
  sql: string;
}

@Injectable()
export class DuckDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DuckDbService.name);
  private db: duckdb.Database;
  private connection: duckdb.Connection;

  async onModuleInit() {
    this.logger.log('Initializing In-Memory DuckDB OLAP Engine...');
    this.db = new duckdb.Database(':memory:');
    this.connection = this.db.connect();

    // Enable multi-threading and optimize memory limits
    await this.runRawSql('PRAGMA threads=4;');
    await this.runRawSql('PRAGMA memory_limit="4GB";');
    this.logger.log('DuckDB OLAP Engine initialized with 4 threads and 4GB memory limit.');
  }

  async onModuleDestroy() {
    if (this.connection) {
      this.logger.log('Closing DuckDB connections.');
    }
  }

  /**
   * Executes an analytical query payload generated from the front-end builder
   */
  async executeAnalyticsQuery(payload: QueryPayload): Promise<QueryResult> {
    const sql = buildDuckDbSql(payload);
    const start = performance.now();

    const data = await this.allAsync(sql);
    const duration = Math.round((performance.now() - start) * 100) / 100;

    this.logger.debug(`Query executed in ${duration}ms, rows: ${data.length}`);

    return {
      data,
      executionTimeMs: duration,
      rowCount: data.length,
      sql,
    };
  }

  /**
   * Runs raw SQL query against DuckDB
   */
  async runRawSql(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Fetches all rows matching SQL query
   */
  async allAsync<T = any>(sql: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.connection.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  }
}
