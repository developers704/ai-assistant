import { querySales } from "../src/lib/sales/query-sales";
import { readActivePointer, readVersionMetadata, readNormalizedRows } from "../src/lib/sales/data/version-store";
import { isSalesUnifiedIntelligenceEnabled } from "../src/lib/sales/flags";
import { getActiveSalesContext } from "../src/lib/sales/active-context";

async function main() {
  console.log("unifiedEnabled", isSalesUnifiedIntelligenceEnabled());
  console.log("pointer", readActivePointer());
  console.log("meta", readVersionMetadata(readActivePointer().activeVersion!));
  console.log("activeCtx", JSON.stringify(getActiveSalesContext(), null, 2));
  console.log("normalizedLen", readNormalizedRows()?.length);

  const r = await querySales({
    dateRange: { type: "all_dates" },
    limit: 20,
    sortBy: "quantity",
    resetContext: true,
    include: { summary: true, topVendorModels: true },
  });
  console.log("availability", r.availability);
  console.log("summary", r.summary);
  console.log("freshness", r.freshness);
  console.log("warnings", r.warnings);
  console.log("resolvedDateRange", r.query?.resolvedDateRange);
  console.log("filters", r.query?.filters);
  console.log("topVM count", r.rankings?.topVendorModels?.length);
  console.log(
    "topVM sample",
    JSON.stringify(r.rankings?.topVendorModels?.slice(0, 5), null, 2)
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
