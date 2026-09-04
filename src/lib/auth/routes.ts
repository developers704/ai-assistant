/** Role-based allowlists. Admin (`role=admin`) bypasses these. */

import {
  getPermissionMapForUserFromCookie,
  homePathForRole,
  type UserPermissionKey,
  type UserPermissionMap,
} from "@/lib/auth/user-permissions";

export const DM_ALLOWED_APP_PREFIXES = [
  "/sales",
  "/intelligence",
  "/calculator",
  "/stores",
] as const;

const APP_TO_PERMISSION: Record<string, UserPermissionKey | UserPermissionKey[]> = {
  "/sales": "sales_dashboard",
  "/intelligence": "sales_dashboard",
  "/stores": "stores_map",
  "/calculator": "price_calculator",
  "/sku-lookup": "sku_lookup",
  "/discounting": "discounting",
  "/chat": "ai_chat",
  "/news": "news_markets",
  "/email": "email",
  "/valliani-mail": "email",
  "/calendar": "calendar",
  "/contacts": "contacts",
  "/analyst": "data_analyst",
  "/images": "image_generation",
  "/social": "social",
  "/hr": ["hr_management", "hr_sales"],
  "/admin/users": "user_admin",
  "/admin/roles": "user_admin",
};

const API_TO_PERMISSION: Array<{
  prefix: string;
  permission: UserPermissionKey | UserPermissionKey[];
}> = [
  { prefix: "/api/sales", permission: ["sales_dashboard", "hr_sales"] },
  { prefix: "/api/intelligence", permission: "sales_dashboard" },
  { prefix: "/api/stores", permission: "stores_map" },
  { prefix: "/api/reports", permission: ["sales_dashboard", "hr_sales"] },
  { prefix: "/api/inventory", permission: ["price_calculator", "sku_lookup"] },
  { prefix: "/api/products", permission: "price_calculator" },
  { prefix: "/api/discounting", permission: "discounting" },
  { prefix: "/api/email", permission: "email" },
  { prefix: "/api/gmail", permission: "email" },
  { prefix: "/api/valliani-mail", permission: "email" },
  { prefix: "/api/calendar", permission: "calendar" },
  { prefix: "/api/reminders", permission: "calendar" },
  { prefix: "/api/contacts", permission: "contacts" },
  { prefix: "/api/chat", permission: "ai_chat" },
  { prefix: "/api/pending-action", permission: "ai_chat" },
  { prefix: "/api/analyst", permission: "data_analyst" },
  { prefix: "/api/documents", permission: "data_analyst" },
  { prefix: "/api/images", permission: "image_generation" },
  { prefix: "/api/generate-image", permission: "image_generation" },
  { prefix: "/api/compose-image", permission: "image_generation" },
  { prefix: "/api/enhance-image", permission: "image_generation" },
  { prefix: "/api/social", permission: "social" },
  { prefix: "/api/markets", permission: "news_markets" },
  { prefix: "/api/news", permission: "news_markets" },
  { prefix: "/api/hr", permission: "hr_management" },
  { prefix: "/api/admin", permission: "user_admin" },
];

function hasPermission(
  map: UserPermissionMap,
  permission: UserPermissionKey | UserPermissionKey[]
): boolean {
  const keys = Array.isArray(permission) ? permission : [permission];
  return keys.some((k) => Boolean(map[k]));
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/me"
  ) {
    return true;
  }
  if (pathname.startsWith("/api/social/instagram/webhook")) return true;
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
  permissions?: UserPermissionMap
): boolean {
  if (pathname === "/" || pathname === "") return true;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return true;
  }

  const permissionMap =
    permissions ?? getPermissionMapForUserFromCookie(username, role);

  const matchedPath = Object.keys(APP_TO_PERMISSION).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!matchedPath) {
    return DM_ALLOWED_APP_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
  }

  return hasPermission(permissionMap, APP_TO_PERMISSION[matchedPath]!);
}

export function isDmAllowedApiPath(
  pathname: string,
  username?: string | null,
  role?: string | null,
  permissions?: UserPermissionMap
): boolean {
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/state")) return true;
  if (pathname.startsWith("/api/ui-context")) return true;
  if (pathname.startsWith("/api/profile")) return true;
  if (pathname.startsWith("/api/permissions")) return true;

  const permissionMap =
    permissions ?? getPermissionMapForUserFromCookie(username, role);

  const matched = API_TO_PERMISSION.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (matched) {
    return hasPermission(permissionMap, matched.permission);
  }

  return false;
}

export { homePathForRole };
