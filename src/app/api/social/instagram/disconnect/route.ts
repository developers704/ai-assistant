import { NextResponse } from "next/server";
import { purgeInstagramConnection, getMetaStatus } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard disconnect — clears in-process Meta credentials so the old account cannot stay connected. */
export async function POST() {
  purgeInstagramConnection();
  return NextResponse.json({ success: true, status: getMetaStatus() });
}
