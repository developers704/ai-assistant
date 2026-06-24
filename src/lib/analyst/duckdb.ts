/**
 * DuckDB-WASM engine running fully in the browser.
 * All numbers shown to the user are computed here — never by the LLM.
 */
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import Papa from "papaparse";
import type { ColumnInfo, ColumnKind, QueryResult, TableSchema } from "./types";

let dbPromise: Promise<AsyncDuckDB> | null = null;

async function createDB(): Promise<AsyncDuckDB> {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" })
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  // Cast wide types to JS-friendly ones so result values are exact and renderable.
  await db.open({
    query: {
      castBigIntToDouble: true,
      castDecimalToDouble: true,
      castTimestampToDate: true,
    },
  });
  return db;
}

export function getDB(): Promise<AsyncDuckDB> {
  if (!dbPromise) dbPromise = createDB();
  return dbPromise;
}

function kindFromDuckType(type: string): ColumnKind {
  const t = type.toUpperCase();
  if (/INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL/.test(t)) return "number";
  if (/DATE|TIMESTAMP|TIME/.test(t)) return "date";
  if (/BOOL/.test(t)) return "boolean";
  return "text";
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function normalizeValue(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "bigint") {
    return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(v)
      : v.toString();
  }
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 19).replace("T", " ");
  }
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  if (typeof v === "object") return String(v);
  return v;
}

async function withConnection<T>(fn: (conn: AsyncDuckDBConnection) => Promise<T>): Promise<T> {
  const db = await getDB();
  const conn = await db.connect();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

/** Execute a read-only SQL query against the loaded table and return plain JS rows. */
export async function runQuery(sql: string): Promise<QueryResult> {
  return withConnection(async (conn) => {
    const table = await conn.query(sql);
    const columns = table.schema.fields.map((f) => f.name);
    const rows: Record<string, unknown>[] = [];
    for (const batchRow of table.toArray()) {
      const json = batchRow.toJSON() as Record<string, unknown>;
      const obj: Record<string, unknown> = {};
      for (const c of columns) obj[c] = normalizeValue(json[c]);
      rows.push(obj);
    }
    return { columns, rows };
  });
}

/** SQL expression that turns currency-formatted text ("$3,600.00", "(1,234)") into DOUBLE. */
function cleanNumberExpr(q: string): string {
  return `try_cast(nullif(trim(regexp_replace(replace(replace(trim(${q}), '$', ''), ',', ''), '^\\((.*)\\)$', '-\\1')), '') AS DOUBLE)`;
}

interface ConversionResult {
  notes: Map<string, { failed: number }>;
  dropped: string[];
}

/**
 * Detect text columns that actually hold currency/numbers (e.g. "3,600.00")
 * or m/d/Y dates (e.g. "12/31/2025") and rebuild the table with real types.
 * Without this, SUM() on a currency-text column silently drops every value
 * containing a comma — catastrophically wrong totals.
 */
async function autoCleanColumns(
  conn: AsyncDuckDBConnection,
  describe: { name: string; type: string }[]
): Promise<ConversionResult> {
  const notes = new Map<string, { failed: number }>();
  const dropped: string[] = [];
  const textCols = describe.filter((c) => kindFromDuckType(c.type) === "text");
  if (textCols.length === 0) return { notes, dropped };

  const dateFormats = ["%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"];
  const exprs: string[] = [];
  textCols.forEach((c, i) => {
    const q = quoteIdent(c.name);
    exprs.push(`count(*) FILTER (WHERE trim(coalesce(${q}, '')) <> '')::DOUBLE AS ne${i}`);
    exprs.push(`count(*) FILTER (WHERE ${cleanNumberExpr(q)} IS NOT NULL)::DOUBLE AS num${i}`);
    dateFormats.forEach((f, j) => {
      exprs.push(
        `count(*) FILTER (WHERE try_strptime(trim(coalesce(${q}, '')), '${f}') IS NOT NULL)::DOUBLE AS d${i}_${j}`
      );
    });
  });
  const statsRes = await conn.query(`SELECT ${exprs.join(", ")} FROM data`);
  const stats = statsRes.toArray()[0].toJSON() as Record<string, unknown>;
  const n = (key: string) => Number(normalizeValue(stats[key])) || 0;

  const THRESHOLD = 0.95;
  const selectParts: string[] = [];
  let needsRebuild = false;

  for (const col of describe) {
    const q = quoteIdent(col.name);
    const i = textCols.findIndex((t) => t.name === col.name);
    if (i === -1) {
      selectParts.push(q);
      continue;
    }
    const nonEmpty = n(`ne${i}`);
    if (nonEmpty === 0) {
      // Fully empty column (e.g. from a trailing comma in every row) — drop it.
      dropped.push(col.name);
      needsRebuild = true;
      continue;
    }
    const numOk = n(`num${i}`);
    if (numOk / nonEmpty >= THRESHOLD) {
      selectParts.push(`${cleanNumberExpr(q)} AS ${q}`);
      notes.set(col.name, { failed: nonEmpty - numOk });
      needsRebuild = true;
      continue;
    }
    const dateIdx = dateFormats.findIndex((_, j) => n(`d${i}_${j}`) / nonEmpty >= THRESHOLD);
    if (dateIdx >= 0) {
      selectParts.push(
        `cast(try_strptime(trim(coalesce(${q}, '')), '${dateFormats[dateIdx]}') AS DATE) AS ${q}`
      );
      notes.set(col.name, { failed: nonEmpty - n(`d${i}_${dateIdx}`) });
      needsRebuild = true;
      continue;
    }
    selectParts.push(q);
  }

  if (needsRebuild) {
    await conn.query("DROP TABLE IF EXISTS data_clean");
    await conn.query(`CREATE TABLE data_clean AS SELECT ${selectParts.join(", ")} FROM data`);
    await conn.query("DROP TABLE data");
    await conn.query("ALTER TABLE data_clean RENAME TO data");
  }
  return { notes, dropped };
}

/**
 * Load a CSV file into DuckDB table `data` and profile it.
 * Uses PapaParse to sanitize/validate the file, then DuckDB's CSV sniffer
 * (sample_size=-1 scans every row, so type detection is exact).
 */
export async function loadCSV(file: File): Promise<TableSchema> {
  const text = await file.text();

  // Validate structure with PapaParse before handing to the engine.
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true, preview: 5 });
  if (parsed.data.length < 2) {
    throw new Error("This CSV appears to be empty or has no data rows.");
  }

  const db = await getDB();
  await db.registerFileText("upload.csv", text);

  return withConnection(async (conn) => {
    await conn.query("DROP TABLE IF EXISTS data");
    await conn.query(
      "CREATE TABLE data AS SELECT * FROM read_csv_auto('upload.csv', header=true, sample_size=-1)"
    );

    // Convert currency-text and date-text columns to real types before profiling.
    const conversions = await autoCleanColumns(conn, await runDescribe(conn));

    const describe = await runDescribe(conn);
    const countRes = await conn.query("SELECT count(*)::DOUBLE AS n FROM data");
    const rowCount = Number(normalizeValue(countRes.toArray()[0].toJSON().n));

    // Null counts + sample values per column in two queries total.
    const nullExprs = describe
      .map(
        (c, i) => `count(*) FILTER (WHERE ${quoteIdent(c.name)} IS NULL)::DOUBLE AS c${i}`
      )
      .join(", ");
    const nullsRes = await conn.query(`SELECT ${nullExprs} FROM data`);
    const nullsRow = nullsRes.toArray()[0].toJSON() as Record<string, unknown>;

    const previewRes = await conn.query("SELECT * FROM data LIMIT 8");
    const previewCols = previewRes.schema.fields.map((f) => f.name);
    const previewRows = previewRes.toArray().map((r) => {
      const json = r.toJSON() as Record<string, unknown>;
      const obj: Record<string, unknown> = {};
      for (const c of previewCols) obj[c] = normalizeValue(json[c]);
      return obj;
    });

    // For category-like text columns, capture the complete distinct value list so
    // the AI can filter with exact equality (e.g. Department = 'GOLD RINGS')
    // instead of error-prone substring matching.
    const MAX_CATEGORY_VALUES = 80;
    const distinctValues = new Map<string, string[]>();
    const textCols = describe.filter((c) => kindFromDuckType(c.type) === "text");
    if (textCols.length > 0) {
      const distinctExprs = textCols
        .map((c, i) => `count(DISTINCT ${quoteIdent(c.name)})::DOUBLE AS d${i}`)
        .join(", ");
      const distinctRes = await conn.query(`SELECT ${distinctExprs} FROM data`);
      const distinctRow = distinctRes.toArray()[0].toJSON() as Record<string, unknown>;
      for (let i = 0; i < textCols.length; i++) {
        const count = Number(normalizeValue(distinctRow[`d${i}`])) || 0;
        if (count < 1 || count > MAX_CATEGORY_VALUES) continue;
        const q = quoteIdent(textCols[i].name);
        const valsRes = await conn.query(
          `SELECT DISTINCT ${q} AS v FROM data WHERE ${q} IS NOT NULL AND trim(${q}) <> '' ORDER BY v LIMIT ${MAX_CATEGORY_VALUES}`
        );
        const vals = valsRes
          .toArray()
          .map((r) => String(normalizeValue((r.toJSON() as Record<string, unknown>).v)));
        if (vals.length > 0) distinctValues.set(textCols[i].name, vals);
      }
    }

    const columns: ColumnInfo[] = describe.map((c, i) => {
      const samples: string[] = [];
      for (const row of previewRows) {
        const v = row[c.name];
        if (v != null && samples.length < 5 && !samples.includes(String(v))) {
          samples.push(String(v));
        }
      }
      const conversion = conversions.notes.get(c.name);
      const distincts = distinctValues.get(c.name);
      return {
        name: c.name,
        type: c.type,
        kind: kindFromDuckType(c.type),
        sampleValues: samples,
        nullCount: Number(normalizeValue(nullsRow[`c${i}`])) || 0,
        ...(conversion
          ? { convertedFrom: "text" as const, conversionFailures: conversion.failed }
          : {}),
        ...(distincts ? { distinctValues: distincts } : {}),
      };
    });

    return { fileName: file.name, rowCount, columns, previewRows };
  });
}

async function runDescribe(
  conn: AsyncDuckDBConnection
): Promise<{ name: string; type: string }[]> {
  const res = await conn.query("DESCRIBE data");
  return res.toArray().map((r) => {
    const j = r.toJSON() as Record<string, unknown>;
    return { name: String(j.column_name), type: String(j.column_type) };
  });
}

/** Guard: only allow a single read-only SELECT/WITH statement. */
export function validateReadOnlySQL(sql: string): string | null {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!/^(select|with)\b/i.test(trimmed)) {
    return "Only SELECT queries are allowed.";
  }
  if (trimmed.includes(";")) {
    return "Multiple SQL statements are not allowed.";
  }
  if (/\b(insert|update|delete|drop|alter|create|attach|copy|export|install|load|pragma|set)\b/i.test(trimmed.replace(/'[^']*'/g, ""))) {
    return "The query contains a disallowed statement.";
  }
  return null;
}
