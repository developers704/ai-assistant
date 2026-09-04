import type { NextResponse } from "next/server";

export type UserPermissionKey =
  | "sales_dashboard"
  | "stores_map"
  | "price_calculator"
  | "discounting"
  | "news_markets"
  | "email"
  | "calendar"
  | "contacts"
  | "ai_chat"
  | "data_analyst"
  | "image_generation"
  | "social"
  | "vendor_info"
  | "hr_management"
  | "hr_sales"
  | "sku_lookup"
  | "user_admin";

export type UserPermissionMap = Record<UserPermissionKey, boolean>;
export type PermissionOverrides = Record<string, Partial<UserPermissionMap>>;
export type RolePermissionOverrides = Partial<
  Record<"admin" | "employee" | "hr" | "dm", Partial<UserPermissionMap>>
>;

export const PERMISSION_COOKIE_NAME = "alexa-user-permissions-v1";

/** Admin or HR may manage users and role permissions. */
export function canManageUsersByRole(role?: string | null): boolean {
  return role === "admin" || role === "hr";
}

/** @deprecated Settings matrix; use canManageUsersByRole. */
export function canManageDmPermissions(username?: string | null): boolean {
  return normalizeUsername(username) === "kash";
}

/** Admins see real Individual Cost; everyone else sees Whole Cost. */
export function canSeeRealInventoryCost(
  username?: string | null,
  role?: string | null
): boolean {
  if (role === "admin") return true;
  const u = normalizeUsername(username);
  return u === "kash" || u === "ross" || u === "admin" || u === "marina";
}

/** Employees never see wholesale / cost price (calculator, SKU lookup, inventory API). */
export function hidesWholesaleCost(role?: string | null): boolean {
  return role === "employee";
}

export const USER_PERMISSION_SECTIONS: Array<{
  key: UserPermissionKey;
  label: string;
  description: string;
}> = [
  { key: "sales_dashboard", label: "Sales Dashboard", description: "Net sales, stores, and revenue dashboard" },
  { key: "hr_sales", label: "HR Sales", description: "Employee sales rankings (no schedule)" },
  { key: "hr_management", label: "HR Management", description: "Attendance, schedule, warnings, and HR sales" },
  { key: "sku_lookup", label: "SKU Lookup", description: "Product info and wholesale cost — no customer offer" },
  { key: "stores_map", label: "Stores Map & Info", description: "Store locations and details" },
  { key: "price_calculator", label: "Price Calculator", description: "Pricing, customer offer, and wholesale cost" },
  { key: "discounting", label: "Discounting", description: "High discounts vs manager calculator limits" },
  { key: "news_markets", label: "News & Markets", description: "Business news dashboard" },
  { key: "email", label: "Email", description: "Inbox and email workflows" },
  { key: "calendar", label: "Calendar & Tasks", description: "Calendar and scheduling tools" },
  { key: "contacts", label: "Contacts", description: "Directory and contact access" },
  { key: "ai_chat", label: "AI Chat", description: "Assistant chat and follow-ups" },
  { key: "data_analyst", label: "Data Analyst", description: "CSV and data analysis tools" },
  { key: "image_generation", label: "Image Generation", description: "Image creation tools" },
  { key: "social", label: "Social", description: "Instagram and social workflows" },
  { key: "vendor_info", label: "Vendor Info", description: "Vendor names and vendor-level detail" },
  { key: "user_admin", label: "Users & Roles", description: "Create, edit, and delete users and role permissions" },
];

export const DM_USERNAMES = ["aj", "shaun", "adeel", "rozina"] as const;

export function normalizeUsername(value?: string | null): string {
  const n = (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (n === "akber") return "aj";
  if (n === "kash" || n === "kashif valliani") return "kash";
  return n;
}

export function emptyPermissionMap(value = false): UserPermissionMap {
  return Object.fromEntries(
    USER_PERMISSION_SECTIONS.map((s) => [s.key, value])
  ) as UserPermissionMap;
}

function normalizeRole(role?: string | null): "admin" | "employee" | "hr" | "dm" | null {
  if (role === "admin" || role === "employee" || role === "hr" || role === "dm") return role;
  if (role === "hr_access") return "employee";
  return null;
}

export function getDefaultPermissionMapForRole(
  role?: string | null
): UserPermissionMap {
  const r = normalizeRole(role);
  if (r === "admin") {
    return emptyPermissionMap(true);
  }

  if (r === "dm") {
    return {
      ...emptyPermissionMap(false),
      sales_dashboard: true,
      stores_map: true,
      price_calculator: true,
      vendor_info: true,
    };
  }

  if (r === "hr") {
    return {
      ...emptyPermissionMap(false),
      hr_management: true,
      hr_sales: true,
      user_admin: true,
      vendor_info: true,
    };
  }

  if (r === "employee") {
    return {
      ...emptyPermissionMap(false),
      hr_sales: true,
      sku_lookup: true,
      vendor_info: true,
    };
  }

  return { ...emptyPermissionMap(false), vendor_info: true };
}

/**
 * Rozina: every sold line in Top Vendor Models (ITEM / JVV / findings).
 * Net Sales is already full CSV for all users; this only unlocks Top Models soft-hides.
 */
export function showsAllSoldInTopVendorModels(username?: string | null): boolean {
  return normalizeUsername(username) === "rozina";
}

/** Built-in overrides applied after user/file overrides (Rozina: never vendor). */
function applyBuiltInFixes(
  username: string | null | undefined,
  map: UserPermissionMap
): UserPermissionMap {
  const key = normalizeUsername(username);
  const next = { ...map };
  if (key === "rozina") {
    next.vendor_info = false;
  }
  return next;
}

export function mergePermissionMap(
  username?: string | null,
  role?: string | null,
  overrides?: PermissionOverrides | null,
  roleOverrides?: RolePermissionOverrides | null
): UserPermissionMap {
  const typedRole = normalizeRole(role);
  const base = getDefaultPermissionMapForRole(role);
  const fromRole =
    typedRole && roleOverrides?.[typedRole]
      ? { ...base, ...roleOverrides[typedRole] }
      : base;
  const key = normalizeUsername(username);
  if (!key) return fromRole;

  const override = overrides?.[key] ?? {};
  const merged = { ...fromRole, ...override };
  return applyBuiltInFixes(username, merged);
}

export function readPermissionOverridesFromCookieValue(
  value?: string | null
): { users: PermissionOverrides; roles: RolePermissionOverrides } {
  if (!value) return { users: {}, roles: {} };
  try {
    const raw = decodeURIComponent(value);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return { users: {}, roles: {} };
    const roles = (parsed.__roles as RolePermissionOverrides | undefined) ?? {};
    const users: PermissionOverrides = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k === "__roles") continue;
      if (v && typeof v === "object") users[k] = v as Partial<UserPermissionMap>;
    }
    return { users, roles };
  } catch {
    return { users: {}, roles: {} };
  }
}

export function getPermissionMapForUserFromCookie(
  username?: string | null,
  role?: string | null,
  rawCookieValue?: string | null
): UserPermissionMap {
  const stored = readPermissionOverridesFromCookieValue(rawCookieValue);
  return mergePermissionMap(username, role, stored.users, stored.roles);
}

/** Encode overrides for the sync cookie middleware reads. */
export function encodePermissionOverridesCookie(
  users: PermissionOverrides,
  roles: RolePermissionOverrides = {}
): string {
  return encodeURIComponent(JSON.stringify({ ...users, __roles: roles }));
}

export function applyPermissionsCookie(
  res: NextResponse,
  overrides: PermissionOverrides,
  roles: RolePermissionOverrides = {}
): void {
  res.cookies.set({
    name: PERMISSION_COOKIE_NAME,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    value: encodePermissionOverridesCookie(overrides, roles),
  });
}

export function canUserAccessSection(
  section: UserPermissionKey,
  map: UserPermissionMap
): boolean {
  return Boolean(map[section]);
}

/** Client/server UI helper: hide vendor when permissions say so. */
export function userHidesVendorInfo(user: {
  authRole?: string | null;
  username?: string | null;
  permissions?: Record<string, boolean> | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (normalizeUsername(user.username) === "rozina") return true;
  if (user.authRole === "admin") return false;
  if (user.permissions && typeof user.permissions.vendor_info === "boolean") {
    return !user.permissions.vendor_info;
  }
  return false;
}

export function homePathForRole(
  role?: string | null,
  permissions?: Partial<UserPermissionMap> | null
): string {
  const r = normalizeRole(role);
  if (r === "employee") return "/hr";
  if (r === "hr") return "/hr";
  if (permissions?.sales_dashboard === false && permissions?.hr_sales) return "/hr";
  return "/sales";
}
