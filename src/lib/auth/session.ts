import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session-token";

export {
  AUTH_COOKIE,
  createSessionToken,
  verifySessionToken,
  sessionCookieOptions,
  type SessionPayload,
};

export async function readSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function readSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function applySessionCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
}
