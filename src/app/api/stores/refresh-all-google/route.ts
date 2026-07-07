import { NextResponse } from "next/server";
import { getAllStores } from "@/lib/stores/store-directory";
import { getStoreGoogleDetails } from "@/lib/stores/google-details";

export const runtime = "nodejs";

export async function POST() {
  const stores = getAllStores();
  const results = await Promise.all(
    stores.map(async (s) => {
      const data = await getStoreGoogleDetails(s.id, true);
      return { id: s.id, ok: data && (data as { ok?: boolean }).ok !== false };
    })
  );
  const refreshed = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    total: stores.length,
    refreshed,
    failed: stores.length - refreshed,
  });
}

