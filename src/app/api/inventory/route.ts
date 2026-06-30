import { NextRequest, NextResponse } from "next/server";
import {
  getInventoryStatus,
  lookupInventory,
  saveInventoryCsv,
} from "@/lib/inventory/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
    const { rowCount } = saveInventoryCsv(csvText, file.name);
    return NextResponse.json({
      ok: true,
      rowCount,
      status: getInventoryStatus(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save inventory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const sku = req.nextUrl.searchParams.get("sku")?.trim();
  const store = req.nextUrl.searchParams.get("store")?.trim();
  const status = getInventoryStatus();

  if (!sku || !store) {
    return NextResponse.json({ status });
  }

  if (!status.loaded) {
    return NextResponse.json(
      {
        error: "Inventory file not loaded",
        hint: "Upload inventory CSV to .data/inventory/inventory.csv on the server, or use POST /api/inventory",
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

  return NextResponse.json({
    ...result,
    status,
  });
}
