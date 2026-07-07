import { getAllStores, getStoreSummary } from "@/lib/stores/store-directory";
import { getStoreGoogleDetails } from "@/lib/stores/google-details";

async function run() {
  const stores = getAllStores();
  if (!stores.length) {
    throw new Error("No stores found. Run stores sync first.");
  }
  const summary = getStoreSummary();
  console.log("Stores summary:", summary);

  const first = stores[0];
  const details = await getStoreGoogleDetails(first.id);
  if (!details) {
    throw new Error("Google detail resolver returned empty response.");
  }
  console.log("Sample store:", first.id, first.mall);
  console.log("Google details status:", (details as { ok?: boolean }).ok !== false ? "ok" : "fallback");
  console.log("Store command center checks passed.");
}

void run().catch((err) => {
  console.error("Store command center test failed:", err);
  process.exit(1);
});

