import fs from "fs";
import path from "path";
import type { SalesDashboardState, SalesWorkingMemoryState } from "./sales-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const MEMORY_FILE = path.join(DATA_DIR, "sales-working-memory.json");
const DASHBOARD_FILE = path.join(DATA_DIR, "sales-dashboard-state.json");

let memCache: SalesWorkingMemoryState | null = null;
let dashCache: SalesDashboardState | null = null;

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

export function getSalesWorkingMemory(): SalesWorkingMemoryState {
  if (memCache) return memCache;
  memCache = readJson<SalesWorkingMemoryState>(MEMORY_FILE, {});
  return memCache;
}

export function updateSalesWorkingMemory(
  patch: Partial<SalesWorkingMemoryState>
): SalesWorkingMemoryState {
  const next: SalesWorkingMemoryState = {
    ...getSalesWorkingMemory(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  memCache = next;
  writeJson(MEMORY_FILE, next);
  return next;
}

export function clearSalesWorkingMemory(): void {
  memCache = {};
  if (fs.existsSync(MEMORY_FILE)) fs.unlinkSync(MEMORY_FILE);
}

export function getSalesDashboardState(): SalesDashboardState | null {
  if (dashCache) return dashCache;
  dashCache = readJson<SalesDashboardState | null>(DASHBOARD_FILE, null);
  return dashCache;
}

export function saveSalesDashboardState(state: SalesDashboardState): SalesDashboardState {
  dashCache = state;
  writeJson(DASHBOARD_FILE, state);
  return state;
}

export function clearSalesDashboardState(): void {
  dashCache = null;
  if (fs.existsSync(DASHBOARD_FILE)) fs.unlinkSync(DASHBOARD_FILE);
}

/** Build /sales URL search params from dashboard state. */
export function salesDashboardToQuery(state: SalesDashboardState): string {
  const params = new URLSearchParams();
  if (state.date) params.set("date", state.date);
  else if (state.dateFrom && state.dateTo && state.dateFrom === state.dateTo) {
    params.set("date", state.dateFrom);
  } else {
    if (state.dateFrom) params.set("from", state.dateFrom);
    if (state.dateTo) params.set("to", state.dateTo);
  }
  if (state.stores[0]) params.set("store", state.stores[0]);
  if (state.departments[0]) params.set("department", state.departments[0]);
  if (state.designs[0]) params.set("design", state.designs[0]);
  if (state.vendors[0]) params.set("vendor", state.vendors[0]);
  if (state.classes[0]) params.set("class", state.classes[0]);
  if (state.selectedDetail) {
    params.set("detail", state.selectedDetail.type);
    params.set("detailValue", state.selectedDetail.value);
  }
  const qs = params.toString();
  return qs ? `/sales?${qs}` : "/sales";
}
