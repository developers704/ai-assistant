import { NextResponse } from "next/server";
import { getEnrichedState } from "@/lib/google/sync";
import { readSessionFromCookies } from "@/lib/auth/session";
import { appStateForSession } from "@/lib/auth/app-state";
import { syncPermissionsCookie } from "@/lib/auth/user-permissions-store";

export async function GET(request: Request) {
  const quick = new URL(request.url).searchParams.get("quick") === "1";
  const state = await getEnrichedState({ quick });
  const session = await readSessionFromCookies();
  const res = NextResponse.json(appStateForSession(state, session));
  if (session) syncPermissionsCookie(res);
  return res;
}
