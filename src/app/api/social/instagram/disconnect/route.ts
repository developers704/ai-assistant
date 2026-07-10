import { NextResponse } from "next/server";
import { disconnectInstagram, getMetaStatus } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  disconnectInstagram();
  return NextResponse.json({ success: true, status: getMetaStatus() });
}
