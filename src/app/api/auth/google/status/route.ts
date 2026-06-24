import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/google/config";
import { getGoogleTokens, isGoogleConnected } from "@/lib/google/token-store";

export async function GET() {
  const tokens = getGoogleTokens();

  return NextResponse.json({
    configured: isGoogleConfigured(),
    connected: isGoogleConnected(),
    email: tokens?.email ?? null,
  });
}
