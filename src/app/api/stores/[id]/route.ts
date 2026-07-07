import { NextResponse } from "next/server";
import { getStoreById } from "@/lib/stores/store-directory";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const store = getStoreById(id);
  if (!store) {
    return NextResponse.json({ ok: false, message: "Store not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, store });
}

