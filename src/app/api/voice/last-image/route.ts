import { NextResponse } from "next/server";
import { getState } from "@/lib/store/server-store";

export const runtime = "nodejs";

export async function GET() {
  const image = getState().voiceLastImage ?? null;
  return NextResponse.json({ image });
}
