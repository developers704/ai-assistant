import Papa from "papaparse";
import { isValidIsoDate, parseReportFilterDate } from "@/lib/reports/date-utils";
import type { IntelligenceRow } from "@/lib/intelligence/types";
import { customerKey } from "@/lib/intelligence/customer-id";

function parseNumber(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  const s = String(raw).trim().replace(/[$,]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getUTCFullYear()}-${String(raw.getUTCMonth() + 1).padStart(2, "0")}-${String(raw.getUTCDate()).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  const parsed = parseReportFilterDate(s);
  if (parsed && isValidIsoDate(parsed)) return parsed;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const iso = s.slice(0, 10);
    return isValidIsoDate(iso) ? iso : null;
  }
  return null;
}

function findCol(columns: string[], patterns: RegExp[]): string | null {
  for (const col of columns) {
    const t = col.trim().toLowerCase();
    if (patterns.some((p) => p.test(t))) return col;
  }
  return null;
}

export function parseIntelligenceCsv(csvText: string): IntelligenceRow[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const cols = parsed.meta.fields ?? [];
  if (!cols.length) return [];

  const colTxn = findCol(cols, [/^transaction\s*#$/]);
  const colDate = findCol(cols, [/^transaction\s*date$/, /^date$/]);
  const colItem = findCol(cols, [/^item\s*#$/]);
  const colStyle = findCol(cols, [/^style\s*#$/]);
  const colDesc = findCol(cols, [/^description$/]);
  const colModel = findCol(cols, [/^vendormodel1$/, /^vendor\s*model$/]);
  const colVendor = findCol(cols, [/^vendor\s*name$/, /^vendor$/]);
  const colQty = findCol(cols, [/^qty$/, /^quantity$/]);
  const colInvCost = findCol(cols, [/^inventory\s*cost$/]);
  const colGross = findCol(cols, [/^sales\s*amount$/]);
  const colDisc = findCol(cols, [/^disc\s*amt$/, /^discount$/]);
  const colTotal = findCol(cols, [/^total$/]);
  const colStore = findCol(cols, [/^store$/]);
  const colDept = findCol(cols, [/^department$/]);
  const colDesign = findCol(cols, [/^design$/]);
  const colClass = findCol(cols, [/^class$/]);
  const colSub = findCol(cols, [/^sub-class$/, /^subclass$/]);
  const colSp = findCol(cols, [/^salespersons$/]);
  const colFn = findCol(cols, [/^cust\.\s*first\s*name$/]);
  const colLn = findCol(cols, [/^cust\.\s*last\s*name/]);
  const colCity = findCol(cols, [/^customer\s*city$/]);
  const colState = findCol(cols, [/^customer\s*state$/]);
  const colZip = findCol(cols, [/^customer\s*zip/]);
  const colStreet = findCol(cols, [/^customer\s*street$/]);
  const colEmail = findCol(cols, [/^customer\s*email$/]);
  const colPhone = findCol(cols, [/^customer\s*phone$/]);
  const colHome = findCol(cols, [/^customer\s*home\s*phone$/]);

  const out: IntelligenceRow[] = [];
  for (const rec of parsed.data) {
    const date = colDate ? normalizeDate(rec[colDate]) : null;
    if (!date) continue;
    const sku = colItem ? String(rec[colItem] ?? "").trim() : "";
    const netRevenue = colTotal ? parseNumber(rec[colTotal]) : 0;
    const grossSales = colGross ? parseNumber(rec[colGross]) : netRevenue;
    const row: IntelligenceRow = {
      date,
      transactionId: colTxn ? String(rec[colTxn] ?? "").trim() : "",
      storeName: colStore ? String(rec[colStore] ?? "").trim() : "",
      sku,
      itemNumber: sku,
      style: colStyle ? String(rec[colStyle] ?? "").trim() : "",
      description: colDesc ? String(rec[colDesc] ?? "").trim() : "",
      vendorModel: colModel ? String(rec[colModel] ?? "").trim() : "",
      vendor: colVendor ? String(rec[colVendor] ?? "").trim().toUpperCase() : "",
      department: colDept ? String(rec[colDept] ?? "").trim() : "",
      design: colDesign ? String(rec[colDesign] ?? "").trim() : "",
      productClass: colClass ? String(rec[colClass] ?? "").trim() : "",
      subClass: colSub ? String(rec[colSub] ?? "").trim() : "",
      quantity: colQty ? parseNumber(rec[colQty]) : 0,
      inventoryCost: colInvCost ? parseNumber(rec[colInvCost]) : 0,
      grossSales,
      discountAmount: colDisc ? parseNumber(rec[colDisc]) : Math.max(0, grossSales - netRevenue),
      netRevenue,
      salespersons: colSp ? String(rec[colSp] ?? "").trim() : "",
      customerFirstName: colFn ? String(rec[colFn] ?? "").trim() : "",
      customerLastName: colLn ? String(rec[colLn] ?? "").trim() : "",
      customerCity: colCity ? String(rec[colCity] ?? "").trim() : "",
      customerState: colState ? String(rec[colState] ?? "").trim() : "",
      customerZip: colZip ? String(rec[colZip] ?? "").trim() : "",
      customerStreet: colStreet ? String(rec[colStreet] ?? "").trim() : "",
      customerEmail: colEmail ? String(rec[colEmail] ?? "").trim() : "",
      customerPhone:
        (colPhone ? String(rec[colPhone] ?? "").trim() : "") ||
        (colHome ? String(rec[colHome] ?? "").trim() : ""),
      customerId: "",
    };
    row.customerId = customerKey(row);
    out.push(row);
  }
  return out;
}
