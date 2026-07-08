import { NextResponse } from "next/server";
import { fetchInstagramAccount } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchInstagramAccount();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.code === "NO_TOKEN" || result.code === "TOKEN_EXPIRED" ? 401 : 502 }
    );
  }
  return NextResponse.json({ account: result.data });
}
