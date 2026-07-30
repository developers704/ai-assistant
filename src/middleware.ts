import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth/session-token";
import {
  isDmAllowedApiPath,
  isDmAllowedAppPath,
  isPublicPath,
} from "@/lib/auth/routes";

/**
 * Kash / admin → full Alexa.
 * DMs → Sales + Calculator + Stores only (no voice/chat/etc.).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    if (pathname === "/login" || pathname.startsWith("/login/")) {
      const token = req.cookies.get(AUTH_COOKIE)?.value;
      if (token && (await verifySessionToken(token))) {
        return NextResponse.redirect(new URL("/sales", req.url));
      }
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (session.role === "admin") {
    if (pathname === "/" || pathname === "") {
      return NextResponse.redirect(new URL("/sales", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (!isDmAllowedApiPath(pathname)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "") {
    return NextResponse.redirect(new URL("/sales", req.url));
  }

  if (!isDmAllowedAppPath(pathname)) {
    return NextResponse.redirect(new URL("/sales", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
