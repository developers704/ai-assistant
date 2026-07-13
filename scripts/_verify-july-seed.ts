/**
 * Reset seed + verify Top Vendor Models.
 * Run: npx tsx scripts/_verify-july-seed.ts
 */
import { clearAllReports, listReports, getLatestReportWithSummary } from "../src/lib/reports/store";
import { getTopVendorModels } from "../src/lib/sales/sales-product-analysis";
import { refreshSalesData, ensureActiveSalesVersion } from "../src/lib/sales/refresh/service";
import { querySales } from "../src/lib/sales/query-sales";

async function main() {
  clearAllReports();
  const list = listReports(); // triggers seed
  console.log(
    "listReports count:",
    list.length,
    list.map((r) => ({ id: r.id, label: r.label, dateRange: r.dateRange, rowCount: r.rowCount }))
  );

  const latest = getLatestReportWithSummary();
  console.log({
    label: latest?.meta.label,
    dateRange: latest?.meta.dateRange,
    rowCount: latest?.meta.rowCount,
  });
  console.log(
    "topProducts sample:",
    latest?.summary.topProducts?.slice(0, 5).map((p) => ({
      model: p.vendorModel,
      name: p.name,
      units: p.units,
      revenue: p.revenue,
    }))
  );
  console.log("count topProducts", latest?.summary.topProducts?.length);

  const TARGET = "DATEJUST-TT-41MM-NW";
  const djIdx = latest?.summary.topProducts?.findIndex(
    (p) =>
      (p.vendorModel ?? "").toUpperCase() === TARGET ||
      (p.name ?? "").toUpperCase().includes(TARGET)
  );
  console.log(
    "DATEJUST-TT-41MM-NW in summary.topProducts:",
    djIdx !== undefined && djIdx >= 0
      ? { rank: djIdx + 1, entry: latest!.summary.topProducts![djIdx] }
      : "NOT FOUND"
  );

  const refresh = await refreshSalesData({ force: true });
  console.log("refreshSalesData(force):", {
    success: refresh.success,
    dataVersion: refresh.dataVersion,
    skipped: refresh.skipped,
    rowsProcessed: refresh.rowsProcessed,
    validRows: refresh.validRows,
    errors: refresh.errors,
    warnings: Array.isArray(refresh.warnings) ? refresh.warnings.slice(0, 5) : refresh.warnings,
  });

  const active = await ensureActiveSalesVersion();
  console.log("ensureActiveSalesVersion:", active);

  const result = await querySales({
    limit: 20,
    sortBy: "quantity",
    include: { topVendorModels: true },
  });
  const models = result.rankings?.topVendorModels ?? [];
  console.log(
    "querySales topVendorModels sample (top 5):",
    models.slice(0, 5).map((m, i) => ({
      rank: i + 1,
      key: m.key,
      label: m.label,
      unitsSold: m.unitsSold,
      netSales: m.netSales,
    }))
  );
  const djQ = models.findIndex(
    (m) =>
      (m.key ?? "").toUpperCase().includes(TARGET) ||
      (m.label ?? "").toUpperCase().includes(TARGET)
  );
  console.log(
    "DATEJUST-TT-41MM-NW in querySales topVendorModels:",
    djQ >= 0 ? { rank: djQ + 1, entry: models[djQ] } : "NOT FOUND"
  );
  console.log("count topVendorModels", models.length);

  void getTopVendorModels;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
