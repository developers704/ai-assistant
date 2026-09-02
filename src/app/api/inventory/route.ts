import { NextRequest, NextResponse } from "next/server";
import {
  getInventoryStatus,
  lookupInventory,
  saveInventoryCsv,
} from "@/lib/inventory/store";
import { readSessionFromCookies } from "@/lib/auth/session";
import { calculatePricing, getVisibleDmCostPrice } from "@/lib/inventory/pricing";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { canSeeRealInventoryCost } from "@/lib/auth/user-permissions";
import { hidesVendorInfoFromPermissions } from "@/lib/auth/user-permissions-store";
import { invalidateOnhandCache } from "@/lib/inventory/onhand";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv")) {
    return NextResponse.json(
      { error: "Only CSV files are supported. Save Excel as CSV first." },
      { status: 400 }
    );
  }

  const csvText = await file.text();
  if (!csvText.trim()) {
    return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  }

  try {
    // Fills Whole Cost + writes calculator + sales onhand copies.
    const { rowCount, wholeCostStats } = saveInventoryCsv(csvText, file.name);
    invalidateOnhandCache();
    return NextResponse.json({
      ok: true,
      rowCount,
      wholeCostStats,
      status: getInventoryStatus(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save inventory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sku = req.nextUrl.searchParams.get("sku")?.trim();
  const store = req.nextUrl.searchParams.get("store")?.trim() || undefined;
  const status = getInventoryStatus();

  if (!sku) {
    return NextResponse.json({ status });
  }

  if (!status.loaded) {
    return NextResponse.json(
      {
        error: "Inventory file not loaded",
        hint: "Upload ON_HAND_REPORT CSV to .data/inventory/inventory.csv, or use POST /api/inventory",
        status,
      },
      { status: 503 }
    );
  }

  const result = lookupInventory(sku, store);
  if (!result) {
    return NextResponse.json(
      { error: `SKU "${sku}" not found in inventory`, status },
      { status: 404 }
    );
  }

  // Kash / Ross → real Individual Cost Value.
  // Everyone else → Whole Cost (fixed SKUs, GOLD JEWL+UV÷1.3, Diamond+UV÷8.8, sheet rules).
  let item = { ...result.item };
  let pricing = result.pricing;
  if (!canSeeRealInventoryCost(session.username)) {
    const visibleCost = getVisibleDmCostPrice(item);
    if (visibleCost > 0) {
      item = { ...item, costPrice: visibleCost };
      pricing = calculatePricing(item);
    }
  }

  const hideVendor = hidesVendorInfoFromPermissions(session.username);

  return NextResponse.json({
    item: hideVendor ? { ...item, vendor: "" } : item,
    wholeCost: getVisibleDmCostPrice(result.item),
    pricing,
    stores: result.stores,
    onHandTotal: result.onHandTotal,
    queriedSku: result.queriedSku,
    resolvedSku: result.resolvedSku,
    imageUrl: resolveProductImageUrl(item.imageDir),
    hideVendor,
    status,
  });
}
