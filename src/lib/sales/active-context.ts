import fs from "fs";
import path from "path";
import type { SalesFiltersCanonical } from "@/lib/sales/snapshot/schema";

export interface ActiveSalesContext {
  dataVersion?: string;
  dateRange?: SalesFiltersCanonical["dateRange"];
  stores?: string[];
  cities?: string[];
  states?: string[];
  regions?: string[];
  departments?: string[];
  designs?: string[];
  vendors?: string[];
  classes?: string[];
  metals?: string[];
  products?: string[];
  skus?: string[];
  vendorModels?: string[];
  metrics?: string[];
  groupBy?: string[];
  updatedAt: string;
}

const FILE = path.join(process.cwd(), ".data", "sales-active-context.json");

function ensureDir() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
}

export function getActiveSalesContext(): ActiveSalesContext {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    return JSON.parse(raw) as ActiveSalesContext;
  } catch {
    return { updatedAt: new Date().toISOString() };
  }
}

export function setActiveSalesContext(
  patch: Partial<ActiveSalesContext>
): ActiveSalesContext {
  ensureDir();
  const next: ActiveSalesContext = {
    ...getActiveSalesContext(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function clearActiveSalesContext(): ActiveSalesContext {
  const next: ActiveSalesContext = { updatedAt: new Date().toISOString() };
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}
