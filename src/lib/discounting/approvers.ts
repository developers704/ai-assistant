import fs from "fs";
import path from "path";
import Papa from "papaparse";
import type { ManagerTier } from "@/lib/inventory/types";
import { loadSalespersonDirectory } from "@/lib/sales/salesperson-directory";

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
 * Resolve APP code → approver.
 * Exact first (AS-GM → Adnan), then longest listed prefix before `-`
 * (AJ-UNKNOWN → AJ / District) so store AS does not steal AS-GM when listed.
 */
export function resolveApprover(code: string): ApproverEntry | null {
  const map = loadApprovers();
  const key = code.trim().toUpperCase();
  if (!key) return null;
  if (map.has(key)) {
    return { ...map.get(key)!, code: key };
  }

  let best: ApproverEntry | null = null;
  let bestLen = 0;
  for (const [k, entry] of map) {
    if (key.startsWith(`${k}-`) && k.length > bestLen) {
      best = entry;
      bestLen = k.length;
    }
  }
  if (best) return { ...best, code: key };
  return null;
}

/** Prefer DM, then CM, then Manager from APP codes. */
export function pickApproverForV1(codes: string[]): ApproverEntry | null {
  const resolved = codes.map(resolveApprover).filter(Boolean) as ApproverEntry[];
  if (!resolved.length) return null;
  return (
    resolved.find((a) => a.role === "dm") ??
    resolved.find((a) => a.role === "cm") ??
    resolved.find((a) => a.role === "m") ??
    resolved[0]
  );
}

export const DEFAULT_DISCOUNTING_ROLES: ManagerTier[] = ["dm", "cm", "m"];
