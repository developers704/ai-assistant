import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { findAuthUser, getAllowedStoreCodes } from "@/lib/auth/users";
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

/** Directory store list wins over the 14-day cookie so access changes apply without a new login. */
export function withLiveStoreAccess(session: SessionPayload | null): SessionPayload | null {
  if (!session) return null;
  const live = findAuthUser(session.username);
  if (!live) return session;
  return { ...session, storeCodes: getAllowedStoreCodes(live) };
}

export async function readSessionFromCookies(): Promise<SessionPayload | null> {
  try {
    const jar = await cookies();
    const token = jar.get(AUTH_COOKIE)?.value;
    if (!token) return null;
    return withLiveStoreAccess(await verifySessionToken(token));
  } catch (err) {
    // Scripts and unit tests import app code outside a Next.js request (e.g. test:chat).
    if (
      err instanceof Error &&
      err.message.includes("was called outside a request scope")
    ) {
      return null;
    }
    throw err;
  }
}

export async function readSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return withLiveStoreAccess(await verifySessionToken(token));
}

export function applySessionCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
}
