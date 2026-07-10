import { NextResponse } from "next/server";
import { reconnectInstagram, getMetaStatus } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = reconnectInstagram();
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, status: getMetaStatus() });
}
