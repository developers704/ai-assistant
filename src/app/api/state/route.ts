import { NextResponse } from "next/server";
import { getEnrichedState } from "@/lib/google/sync";

export async function GET(request: Request) {
  const quick = new URL(request.url).searchParams.get("quick") === "1";
  const state = await getEnrichedState({ quick });
  return NextResponse.json(state);
}
