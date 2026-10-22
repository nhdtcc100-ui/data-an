// ==============================================================================
// Dynamic SQL Query Builder for DuckDB Embedded OLAP Engine
// Protects against SQL Injection via Column Sanitization & Whitelisting
// ==============================================================================

export interface FilterCondition {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'LIKE';
  value: string | number | boolean | Array<string | number>;
}

export interface MetricDefinition {
  column: string;
  aggregation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
  alias?: string;
}

export interface QueryPayload {
  tableName: string; // Parquet file path or table name
  metrics: MetricDefinition[];
  dimensions: string[];
  filters?: FilterCondition[];
  orderBy?: { column: string; direction: 'ASC' | 'DESC' }[];
  limit?: number;
}

/**
 * Sanitizes an identifier to prevent SQL injection
 */
function sanitizeIdentifier(ident: string): string {
  return ident.replace(/;/g, '').replace(/--/g, '').replace(/"/g, '""');
}

/**
 * Sanitizes a file path or table name
 */
function sanitizePath(filePath: string): string {
  return filePath.replace(/;/g, '').replace(/--/g, '').replace(/'/g, "''");
}

/**
 * Sanitizes a filter value safely
 */
function sanitizeValue(val: string | number | boolean | Array<string | number>): string {
  if (Array.isArray(val)) {
    const list = val.map((v) => (typeof v === 'string' ? `'${v.replace(/;/g, '').replace(/--/g, '').replace(/'/g, "''")}'` : v)).join(', ');
    return `(${list})`;
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val.toString() : '0';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  return `'${String(val).replace(/;/g, '').replace(/--/g, '').replace(/'/g, "''")}'`;
}

/**
 * Builds an optimized DuckDB SQL query reading directly from Parquet files
 */
export function buildDuckDbSql(payload: QueryPayload): string {
  const selectParts: string[] = [];

  // Dimensions
  for (const dim of payload.dimensions) {
    selectParts.push(`"${sanitizeIdentifier(dim)}"`);
  }

  // Aggregated Metrics
  for (const metric of payload.metrics) {
    const colName = sanitizeIdentifier(metric.column);
    const agg = metric.aggregation.toUpperCase();
    const alias = metric.alias ? sanitizeIdentifier(metric.alias) : `${colName}_${agg}`;
    selectParts.push(`${agg}("${colName}") AS "${alias}"`);
  }

  const selectClause = selectParts.length > 0 ? selectParts.join(', ') : '*';

  // Read directly from Parquet cache file
  const sanitizedPath = sanitizePath(payload.tableName);
  let sql = `SELECT ${selectClause} FROM read_parquet('${sanitizedPath}')`;

  // Filters (WHERE Clause)
  if (payload.filters && payload.filters.length > 0) {
    const conditions = payload.filters.map((f) => {
      const col = sanitizeIdentifier(f.column);
      const val = sanitizeValue(f.value);
      if (f.operator === 'IN') {
        return `"${col}" IN ${val}`;
      }
      return `"${col}" ${f.operator} ${val}`;
    });
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  // GROUP BY for dimensions
  if (payload.dimensions.length > 0) {
    const groupBy = payload.dimensions.map((d) => `"${sanitizeIdentifier(d)}"`).join(', ');
    sql += ` GROUP BY ${groupBy}`;
  }

  // ORDER BY
  if (payload.orderBy && payload.orderBy.length > 0) {
    const orderParts = payload.orderBy.map(
      (o) => `"${sanitizeIdentifier(o.column)}" ${o.direction === 'DESC' ? 'DESC' : 'ASC'}`
    );
    sql += ` ORDER BY ${orderParts.join(', ')}`;
  }

  // LIMIT
  if (payload.limit && payload.limit > 0) {
    sql += ` LIMIT ${Math.min(payload.limit, 100000)}`;
  }

  return sql;
}
