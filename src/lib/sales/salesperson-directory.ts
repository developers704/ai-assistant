import fs from "fs";
import path from "path";
import Papa from "papaparse";

export type SalespersonDirectoryEntry = {
  code: string;
  firstName: string;
  lastName: string;
  /** Display label without code, e.g. "Anita Sapra". */
  displayName: string;
};

let cached: Map<string, SalespersonDirectoryEntry> | null = null;

function titleCaseWord(w: string): string {
  if (!w) return "";
  if (w === w.toUpperCase() || w === w.toLowerCase()) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }
  return w;
}

/** Pretty-print POS name tokens (keeps parenthetical bits). */
export function formatSalespersonName(first: string, last: string): string {
  const parts = [first, last]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!parts) return "";
  return parts
    .split(" ")
    .map((tok) => {
      if (tok.startsWith("(") && tok.endsWith(")")) {
        const inner = tok.slice(1, -1);
        return `(${inner
          .split(/\s+/)
          .map(titleCaseWord)
          .join(" ")})`;
      }
      if (tok.includes("-")) {
        return tok.split("-").map(titleCaseWord).join("-");
      }
      return titleCaseWord(tok);
    })
    .join(" ");
}

export function salespersonDirectoryPath(): string {
  return path.join(process.cwd(), "data", "salespersons", "salespersons.csv");
}

export function parseSalespersonDirectoryCsv(
  csv: string
): Map<string, SalespersonDirectoryEntry> {
  const map = new Map<string, SalespersonDirectoryEntry>();
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  for (const row of parsed.data ?? []) {
    const code = String(row["Code"] ?? row["code"] ?? "")
      .replace(/\r?\n/g, "")
      .trim()
      .toUpperCase();
    if (!code) continue;
    const firstName = String(row["First Name"] ?? row["first name"] ?? "").trim();
    const lastName = String(row["Last Name"] ?? row["last name"] ?? "").trim();
    const displayName = formatSalespersonName(firstName, lastName) || code;
    map.set(code, { code, firstName, lastName, displayName });
  }
  return map;
}

export function loadSalespersonDirectory(
  forceReload = false
): Map<string, SalespersonDirectoryEntry> {
  if (cached && !forceReload) return cached;
  const file = salespersonDirectoryPath();
  if (!fs.existsSync(file)) {
    cached = new Map();
    return cached;
  }
  cached = parseSalespersonDirectoryCsv(fs.readFileSync(file, "utf8"));
  return cached;
}

/** Resolve code → display name; unknown codes stay as the code. */
export function resolveSalespersonLabel(
  code: string,
  directory?: Map<string, SalespersonDirectoryEntry>
): string {
  const key = code.trim().toUpperCase();
  if (!key) return code;
  const dir = directory ?? loadSalespersonDirectory();
  const hit = dir.get(key);
  return hit?.displayName || key;
}

/** Label with code suffix when named, e.g. "Anita Sapra (AA)" or just "ZZ9". */
export function resolveSalespersonLabelWithCode(
  code: string,
  directory?: Map<string, SalespersonDirectoryEntry>
): string {
  const key = code.trim().toUpperCase();
  if (!key) return code;
  const dir = directory ?? loadSalespersonDirectory();
  const hit = dir.get(key);
  if (!hit || hit.displayName === key) return key;
  return `${hit.displayName} (${key})`;
}

/** Clear cache (tests / after replacing the list file). */
export function clearSalespersonDirectoryCache() {
  cached = null;
}
