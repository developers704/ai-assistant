import { NextResponse } from "next/server";
import { getAllStores, isStoreDirectoryAvailable, loadStoreDirectory } from "@/lib/stores/store-directory";
import { mockStores, getStoreStats } from "@/lib/mock-data";

export async function GET() {
  if (isStoreDirectoryAvailable()) {
    const dir = loadStoreDirectory();
    const stores = getAllStores();
    const open = stores.filter((s) => s.status === "open").length;
    const openingSoon = stores.filter((s) => s.status === "opening_soon").length;
    const byState = stores.reduce(
      (acc, s) => {
        acc[s.stateCode] = (acc[s.stateCode] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      source: "synced",
      lastSyncedAt: dir.lastSyncedAt,
      sourceUrl: dir.sourceUrl,
      stores,
      stats: {
        total: stores.length,
        open,
        openingSoon,
        byState,
      },
    });
  }

  const stats = getStoreStats();
  return NextResponse.json({ source: "mock", stores: mockStores, stats });
}
