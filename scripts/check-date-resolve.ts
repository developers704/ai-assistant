import { readNormalizedRows } from "../src/lib/sales/data/version-store";
import { filterRows, summarizeRows } from "../src/lib/sales/sales-aggregate";
import { resolveDateRange } from "../src/lib/sales/sales-date-resolver";
import { readVersionMetadata, readActivePointer } from "../src/lib/sales/data/version-store";

const rows = readNormalizedRows()!;
const meta = readVersionMetadata(readActivePointer().activeVersion!);
const dates = meta?.availableDates?.length
  ? meta.availableDates
  : [...new Set(rows.map((r) => r.date).filter(Boolean))].sort();

const resolved = resolveDateRange(
  { type: "custom", startDate: "2025-01-01", endDate: "2026-08-18" },
  dates
);

const byBounds = summarizeRows(
  filterRows(rows, { dateFrom: resolved.startDate!, dateTo: resolved.endDate! })
);
const byUser = summarizeRows(
  filterRows(rows, { dateFrom: "2025-01-01", dateTo: "2026-08-18" })
);
const throughFeb4 = summarizeRows(
  filterRows(rows, { dateFrom: "2025-01-01", dateTo: "2026-02-04" })
);

console.log({
  resolvedStart: resolved.startDate,
  resolvedEnd: resolved.endDate,
  intersectCount: resolved.dates.length,
  lastIntersect: resolved.dates.slice(-3),
  byBoundsNet: +byBounds.netSales.toFixed(0),
  byBoundsUnits: byBounds.unitsSold,
  byUserNet: +byUser.netSales.toFixed(0),
  feb4Net: +throughFeb4.netSales.toFixed(0),
  feb4Units: throughFeb4.unitsSold,
  maxRowDate: rows.reduce((m, r) => (r.date && r.date > m ? r.date : m), ""),
});
