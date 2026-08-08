import fs from "fs";
import path from "path";
import Papa from "papaparse";
import type { ManagerTier } from "@/lib/inventory/types";
import {
  loadSalespersonDirectory,
} from "@/lib/sales/salesperson-directory";

export type ApproverRole = ManagerTier;

export type ApproverEntry = {
  code: string;
  name: string;
  role: ApproverRole;
};

let cached: Map<string, ApproverEntry> | null = null;

export function approversCsvPath(): string {
  return path.join(process.cwd(), "data", "discounting", "approvers.csv");
}

function parseRole(raw: string): ApproverRole | null {
  const r = raw.trim().toLowerCase();
  if (r === "dm" || r === "district" || r === "district manager") return "dm";
  if (r === "cm" || r === "corporate" || r === "corporate manager") return "cm";
  if (r === "m" || r === "manager" || r === "store manager") return "m";
  return null;
}

export function parseApproversCsv(csv: string): Map<string, ApproverEntry> {
  const map = new Map<string, ApproverEntry>();
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
    const role = parseRole(String(row["Role"] ?? row["role"] ?? ""));
    if (!role) continue;
    const nameRaw =
      String(row["Name"] ?? row["name"] ?? "").trim() ||
      loadSalespersonDirectory().get(code)?.displayName ||
      code;
    map.set(code, { code, name: nameRaw, role });
  }
  return map;
}

export function loadApprovers(forceReload = false): Map<string, ApproverEntry> {
  if (cached && !forceReload) return cached;
  const file = approversCsvPath();
  if (!fs.existsSync(file)) {
    cached = new Map();
    return cached;
  }
  cached = parseApproversCsv(fs.readFileSync(file, "utf-8"));
  return cached;
}

/**
 * Resolve APP code → approver. `AJ-MOD` maps to base `AJ` when base exists.
 */
export function resolveApprover(code: string): ApproverEntry | null {
  const map = loadApprovers();
  const key = code.trim().toUpperCase();
  if (!key) return null;
  if (map.has(key)) return map.get(key)!;
  const base = key.split("-")[0];
  if (base && map.has(base)) {
    const root = map.get(base)!;
    return { ...root, code: key };
  }
  return null;
}

/** First DM/CM/M match from a list of APP codes (prefer dm). */
export function pickApproverForV1(codes: string[]): ApproverEntry | null {
  const resolved = codes.map(resolveApprover).filter(Boolean) as ApproverEntry[];
  if (!resolved.length) return null;
  return (
    resolved.find((a) => a.role === "dm") ??
    resolved.find((a) => a.role === "cm") ??
    resolved[0]
  );
}
