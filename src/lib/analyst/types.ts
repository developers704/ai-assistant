export type ColumnKind = "number" | "date" | "text" | "boolean";

export interface ColumnInfo {
  name: string;
  type: string;
  kind: ColumnKind;
  sampleValues: string[];
  nullCount: number;
  /** Set when the loader auto-converted this column from text (currency/date cleanup). */
  convertedFrom?: "text";
  /** Non-empty values that could not be parsed during auto-conversion. */
  conversionFailures?: number;
  /** Complete list of distinct values, for low-cardinality text columns (categories). */
  distinctValues?: string[];
}

export interface TableSchema {
  fileName: string;
  rowCount: number;
  columns: ColumnInfo[];
  previewRows: Record<string, unknown>[];
}

export type ChartType = "bar" | "line" | "area" | "pie" | "none";

export interface AnalystPlan {
  taskType: "query" | "forecast";
  sql: string;
  chartType: ChartType;
  xKey: string | null;
  yKeys: string[];
  title: string;
  explanation: string;
  forecastPeriods: number | null;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface ForecastPoint {
  period: string;
  actual: number | null;
  forecast: number | null;
  lower: number | null;
  upper: number | null;
}

export interface AnalystMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan?: AnalystPlan;
  result?: QueryResult;
  forecastData?: ForecastPoint[];
  error?: string;
}

/** Compact schema representation sent to the LLM (never the full data). */
export interface SchemaForLLM {
  rowCount: number;
  columns: {
    name: string;
    type: string;
    kind: ColumnKind;
    samples: string[];
    /** Present when the column is a category with a known, complete value list. */
    allValues?: string[];
  }[];
}

export function toSchemaForLLM(schema: TableSchema): SchemaForLLM {
  return {
    rowCount: schema.rowCount,
    columns: schema.columns.map((c) => ({
      name: c.name,
      type: c.type,
      kind: c.kind,
      samples: c.sampleValues.slice(0, 5),
      ...(c.distinctValues ? { allValues: c.distinctValues } : {}),
    })),
  };
}
