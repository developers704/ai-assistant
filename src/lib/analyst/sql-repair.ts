import type { TableSchema } from "@/lib/analyst/types";

/** Build a DuckDB expression that casts a date-like column to DATE across common formats. */
export function robustDateExpr(columnName: string): string {
  const q = `"${columnName.replace(/"/g, '""')}"`;
  return `coalesce(
  try_cast(${q} AS DATE),
  try_strptime(trim(cast(${q} AS VARCHAR)), '%m/%d/%Y')::DATE,
  try_strptime(trim(cast(${q} AS VARCHAR)), '%d/%m/%Y')::DATE,
  try_strptime(trim(cast(${q} AS VARCHAR)), '%Y-%m-%d')::DATE,
  try_strptime(trim(cast(${q} AS VARCHAR)), '%Y/%m/%d')::DATE
)`;
}

/**
 * Patch common LLM SQL mistakes for Valliani store-sales CSVs so filters actually match.
 */
export function repairAnalystSql(sql: string, schema: TableSchema): string {
  let out = sql.trim();
  if (!out) return out;

  const dateCol =
    schema.columns.find((c) => /transaction\s*date/i.test(c.name))?.name ??
    schema.columns.find((c) => c.kind === "date")?.name;

  const designCol = schema.columns.find((c) => /^design$/i.test(c.name))?.name;

  // Case-insensitive Design equality / IN lists
  if (designCol) {
    const dq = `"${designCol.replace(/"/g, '""')}"`;
    out = out.replace(
      new RegExp(`${dq}\\s*=\\s*'([^']*)'`, "gi"),
      (_m, v: string) => `lower(trim(${dq})) = '${String(v).toLowerCase().trim()}'`
    );
    out = out.replace(
      new RegExp(`lower\\(\\s*${dq}\\s*\\)\\s*=\\s*'([^']*)'`, "gi"),
      (_m, v: string) => `lower(trim(${dq})) = '${String(v).toLowerCase().trim()}'`
    );
  }

  // Robust date equality: col = DATE 'YYYY-MM-DD' or CAST(col AS DATE) = DATE '...'
  if (dateCol) {
    const dq = `"${dateCol.replace(/"/g, '""')}"`;
    const robust = robustDateExpr(dateCol);
    const dateLit = String.raw`DATE\s+'(\d{4}-\d{2}-\d{2})'`;

    out = out.replace(
      new RegExp(
        String.raw`(?:try_cast|cast)\s*\(\s*${dq}\s+AS\s+DATE\s*\)\s*=\s*${dateLit}`,
        "gi"
      ),
      (_m, iso: string) => `${robust} = DATE '${iso}'`
    );
    out = out.replace(
      new RegExp(String.raw`${dq}\s*=\s*${dateLit}`, "gi"),
      (_m, iso: string) => `${robust} = DATE '${iso}'`
    );
    // String literal ISO compare
    out = out.replace(
      new RegExp(String.raw`${dq}\s*=\s*'(\d{4}-\d{2}-\d{2})'`, "gi"),
      (_m, iso: string) => `${robust} = DATE '${iso}'`
    );
    // US / EU slash dates in SQL literals → ISO via both interpretations already in robust lhs;
    // convert rhs '7/10/2026' or '10/07/2026' when title intent is July:
    out = out.replace(
      new RegExp(String.raw`${dq}\s*=\s*'(\d{1,2})/(\d{1,2})/(\d{4})'`, "gi"),
      (_m, a: string, b: string, y: string) => {
        const n1 = Number(a);
        const n2 = Number(b);
        // Prefer US m/d/Y when month<=12 (Valliani POS exports are m/d/Y)
        const iso =
          n1 <= 12
            ? `${y}-${String(n1).padStart(2, "0")}-${String(n2).padStart(2, "0")}`
            : `${y}-${String(n2).padStart(2, "0")}-${String(n1).padStart(2, "0")}`;
        return `${robust} = DATE '${iso}'`;
      }
    );
  }

  // Scalar SUM(...) without COALESCE → COALESCE(SUM(...), 0)
  out = out.replace(
    /\bSUM\s*\(([^)]+)\)\s+AS\s+("?[A-Za-z_][\w]*"?)/gi,
    (_m, expr: string, alias: string) => `COALESCE(SUM(${expr}), 0) AS ${alias}`
  );

  return out;
}

/** True when a result is a useless all-null aggregate. */
export function isEmptyAggregateResult(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return true;
  if (rows.length !== 1) return false;
  const vals = Object.values(rows[0]);
  return vals.every((v) => v == null || v === "" || v === "—");
}
