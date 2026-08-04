/** DM-restricted allowlists. Admin (`role=admin`) bypasses these. */

import { getPermissionMapForUserFromCookie, type UserPermissionKey } from "@/lib/auth/user-permissions";

export const DM_ALLOWED_APP_PREFIXES = [
  "/sales",
  "/calculator",
  "/stores",
] as const;

const DM_APP_TO_PERMISSION: Record<string, UserPermissionKey> = {
  "/sales": "sales_dashboard",
  "/stores": "stores_map",
  "/calculator": "price_calculator",
  "/chat": "ai_chat",
  "/news": "news_markets",
  "/email": "email",
  "/calendar": "calendar",
  "/contacts": "contacts",
  "/analyst": "data_analyst",
  "/images": "image_generation",
  "/social": "social",
};

const DM_API_TO_PERMISSION: Array<{ prefix: string; permission: UserPermissionKey }> = [
  { prefix: "/api/sales", permission: "sales_dashboard" },
  { prefix: "/api/stores", permission: "stores_map" },
  { prefix: "/api/reports", permission: "sales_dashboard" },
  { prefix: "/api/inventory", permission: "price_calculator" },
  { prefix: "/api/products", permission: "price_calculator" },
  { prefix: "/api/email", permission: "email" },
  { prefix: "/api/calendar", permission: "calendar" },
  { prefix: "/api/contacts", permission: "contacts" },
  { prefix: "/api/chat", permission: "ai_chat" },
  { prefix: "/api/analyst", permission: "data_analyst" },
  { prefix: "/api/images", permission: "image_generation" },
  { prefix: "/api/social", permission: "social" },
];

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

export function isDmAllowedAppPath(
  pathname: string,
  username?: string | null,
  role?: string | null,
  permissions?: Record<UserPermissionKey, boolean>
): boolean {
  if (pathname === "/" || pathname === "") return true;
  if (pathname === "/settings") return true;

  const permissionMap =
    permissions ?? getPermissionMapForUserFromCookie(username, role);

  const matchedPath = Object.keys(DM_APP_TO_PERMISSION).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!matchedPath) {
    return DM_ALLOWED_APP_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
  }

  return Boolean(permissionMap[DM_APP_TO_PERMISSION[matchedPath]]);
}

export function isDmAllowedApiPath(
  pathname: string,
  username?: string | null,
  role?: string | null,
  permissions?: Record<UserPermissionKey, boolean>
): boolean {
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/state")) return true;
  if (pathname.startsWith("/api/ui-context")) return true;

  const permissionMap =
    permissions ?? getPermissionMapForUserFromCookie(username, role);

  const matched = DM_API_TO_PERMISSION.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (matched) {
    return Boolean(permissionMap[matched.permission]);
  }

  return false;
}
