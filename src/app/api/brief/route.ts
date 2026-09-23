import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import { canSeeKashCostPrice } from "@/lib/auth/user-permissions";
import { buildBriefPacket } from "@/lib/brief/packet";

export const dynamic = "force-dynamic";

/** One September packet for The Edition. Admin only. */
export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const packet = await buildBriefPacket({
    showKash: canSeeKashCostPrice(session.username, session.role),
  });
  return NextResponse.json(packet);
}
