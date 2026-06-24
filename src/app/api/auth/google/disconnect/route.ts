import { NextResponse } from "next/server";
import { clearGoogleTokens } from "@/lib/google/token-store";
import { invalidateGoogleCache } from "@/lib/google/sync";

export async function POST() {
  clearGoogleTokens();
  invalidateGoogleCache();
  return NextResponse.json({ success: true });
}
