/** DM-restricted allowlists. Admin (`role=admin`) bypasses these. */

export const DM_ALLOWED_APP_PREFIXES = [
  "/sales",
  "/calculator",
  "/stores",
] as const;

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/me"
  ) {
    return true;
  }
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icon") ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico"
  ) {
    return true;
  }
  return false;
}

export function isDmAllowedAppPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return DM_ALLOWED_APP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function isDmAllowedApiPath(pathname: string): boolean {
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/state")) return true;
  if (pathname.startsWith("/api/inventory")) return true;
  if (pathname.startsWith("/api/products")) return true;
  if (pathname.startsWith("/api/ui-context")) return true;
  if (pathname.startsWith("/api/sales")) return true;
  if (pathname.startsWith("/api/reports")) return true;
  if (pathname.startsWith("/api/stores")) return true;
  return false;
}
