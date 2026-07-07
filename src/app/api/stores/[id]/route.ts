import { NextRequest, NextResponse } from "next/server";
import { getStoreById } from "@/lib/stores/store-directory";
import { getStoreGoogleDetails } from "@/lib/stores/google-details";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const store = getStoreById(id);
  if (!store) {
    return NextResponse.json({ ok: false, message: "Store not found" }, { status: 404 });
  }
  const includeGoogle = req.nextUrl.searchParams.get("includeGoogle") === "1";
  if (!includeGoogle) return NextResponse.json({ ok: true, store });
  const google = await getStoreGoogleDetails(id);
  return NextResponse.json({ ok: true, store, google });
}

