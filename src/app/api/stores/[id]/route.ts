import { NextResponse } from "next/server";
import { getStoreById } from "@/lib/stores/store-directory";
import { readSessionFromCookies } from "@/lib/auth/session";
import { directoryStoreAllowedForSession } from "@/lib/auth/scope-stores";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const store = getStoreById(id);
  if (!store) {
    return NextResponse.json({ ok: false, message: "Store not found" }, { status: 404 });
  }

  if (!directoryStoreAllowedForSession(session, store)) {
    return NextResponse.json({ ok: false, message: "Store not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, store });
}
