import fs from "fs";
import path from "path";
import { parseIntelligenceCsv } from "@/lib/intelligence/parse-rows";
import type { IntelligenceRow } from "@/lib/intelligence/types";

const SEED_PATH = path.join(
  process.cwd(),
  "data",
  "intelligence",
  "sales-customer-jan25-aug26.csv"
);

let cached: { rows: IntelligenceRow[]; mtime: number } | null = null;

export function intelligenceSeedPath(): string {
  return SEED_PATH;
}

export function intelligenceSeedExists(): boolean {
  return fs.existsSync(SEED_PATH);
}

export function loadIntelligenceRows(forceReload = false): IntelligenceRow[] {
  if (!fs.existsSync(SEED_PATH)) return [];
  const stat = fs.statSync(SEED_PATH);
  if (!forceReload && cached && cached.mtime === stat.mtimeMs) {
    return cached.rows;
  }
  const rows = parseIntelligenceCsv(fs.readFileSync(SEED_PATH, "utf8"));
  cached = { rows, mtime: stat.mtimeMs };
  return rows;
}

export function clearIntelligenceCache(): void {
  cached = null;
}

export function intelligenceDateBounds(rows: IntelligenceRow[]): {
  from: string;
  to: string;
  dates: string[];
} {
  const dates = [...new Set(rows.map((r) => r.date).filter(Boolean))].sort();
  return {
    from: dates[0] ?? "",
    to: dates[dates.length - 1] ?? "",
    dates,
  };
}
