import { NextResponse } from "next/server";
import { fetchInstagramAccount } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchInstagramAccount();
  if (!result.ok) {
    const status =
      result.code === "NO_TOKEN" || result.code === "TOKEN_EXPIRED"
        ? 401
        : result.code === "BLOCKED_ACCOUNT"
          ? 403
          : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ account: result.data });
}
