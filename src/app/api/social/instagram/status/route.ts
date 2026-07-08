import { NextResponse } from "next/server";
import { getMetaStatus } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // getMetaStatus never returns the token value, only whether one exists.
  return NextResponse.json(getMetaStatus());
}
