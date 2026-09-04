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
  | "vendor_info";

export type UserPermissionMap = Record<UserPermissionKey, boolean>;
export type PermissionOverrides = Record<string, Partial<UserPermissionMap>>;

export const PERMISSION_COOKIE_NAME = "alexa-user-permissions-v1";

/** Only Kash edits the DM permission matrix (Ross is admin but excluded). */
export function canManageDmPermissions(username?: string | null): boolean {
  return normalizeUsername(username) === "kash";
}

/** Kash + Ross see real Individual Cost Value; everyone else sees Whole Cost. */
export function canSeeRealInventoryCost(username?: string | null): boolean {
  const u = normalizeUsername(username);
  return u === "kash" || u === "ross";
}

export const USER_PERMISSION_SECTIONS: Array<{
  key: UserPermissionKey;
  label: string;
  description: string;
}> = [
  { key: "sales_dashboard", label: "Sales Dashboard", description: "Net sales, stores, and revenue dashboard" },
  { key: "stores_map", label: "Stores Map & Info", description: "Store locations and details" },
  { key: "price_calculator", label: "Price Calculator", description: "Pricing and wholesale cost tools" },
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
];

export const DM_USERNAMES = ["aj", "shaun", "adeel", "rozina"] as const;

export function normalizeUsername(value?: string | null): string {
  const n = (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (n === "akber") return "aj";
  if (n === "kash" || n === "kashif valliani") return "kash";
  return n;
}

export function getDefaultPermissionMapForRole(
  role?: string | null
): UserPermissionMap {
  if (role === "admin") {
    return Object.fromEntries(
      USER_PERMISSION_SECTIONS.map((s) => [s.key, true])
    ) as UserPermissionMap;
  }

  if (role === "dm") {
    return {
      sales_dashboard: true,
      stores_map: true,
      price_calculator: true,
      discounting: false,
      news_markets: false,
      email: false,
      calendar: false,
      contacts: false,
      ai_chat: false,
      data_analyst: false,
      image_generation: false,
      social: false,
      vendor_info: true,
    };
  }

  /** Screenshot defaults: Sales, Stores, Calculator, Email, Contacts, Vendor Info. */
  if (role === "hr_access") {
    return {
      sales_dashboard: true,
      stores_map: true,
      price_calculator: true,
      discounting: false,
      news_markets: false,
      email: true,
      calendar: false,
      contacts: true,
      ai_chat: false,
      data_analyst: false,
      image_generation: false,
      social: false,
      vendor_info: true,
    };
  }

  return {
    sales_dashboard: false,
    stores_map: false,
    price_calculator: false,
    discounting: false,
    news_markets: false,
    email: false,
    calendar: false,
    contacts: false,
    ai_chat: false,
    data_analyst: false,
    image_generation: false,
    social: false,
    vendor_info: true,
  };
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
  map: UserPermissionMap,
  _vendorInfoExplicitlySet: boolean
): UserPermissionMap {
  const key = normalizeUsername(username);
  const next = { ...map };
  // Rozina must never see vendor codes/names — ignore any override that turns it on.
  if (key === "rozina") {
    next.vendor_info = false;
  }
  return next;
}

export function mergePermissionMap(
  username?: string | null,
  role?: string | null,
  overrides?: PermissionOverrides | null
): UserPermissionMap {
  const base = getDefaultPermissionMapForRole(role);
  const key = normalizeUsername(username);
  if (!key) return base;

  const override = overrides?.[key] ?? {};
  const merged = { ...base, ...override };
  const vendorExplicit = Object.prototype.hasOwnProperty.call(
    override,
    "vendor_info"
  );
  return applyBuiltInFixes(username, merged, vendorExplicit);
}

export function readPermissionOverridesFromCookieValue(
  value?: string | null
): PermissionOverrides {
  if (!value) return {};
  try {
    const raw = decodeURIComponent(value);
    const parsed = JSON.parse(raw) as PermissionOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getPermissionMapForUserFromCookie(
  username?: string | null,
  role?: string | null,
  rawCookieValue?: string | null
): UserPermissionMap {
  const stored = readPermissionOverridesFromCookieValue(rawCookieValue);
  return mergePermissionMap(username, role, stored);
}

/** Encode overrides for the sync cookie middleware reads. */
export function encodePermissionOverridesCookie(data: PermissionOverrides): string {
  return encodeURIComponent(JSON.stringify(data));
}

export function applyPermissionsCookie(
  res: NextResponse,
  overrides: PermissionOverrides
): void {
  res.cookies.set({
    name: PERMISSION_COOKIE_NAME,
    value: encodePermissionOverridesCookie(overrides),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
  // Rozina: always hide (hard rule — not overridable in UI)
  if (normalizeUsername(user.username) === "rozina") return true;
  if (user.authRole === "admin") return false;
  if (user.permissions && typeof user.permissions.vendor_info === "boolean") {
    return !user.permissions.vendor_info;
  }
  return false;
}
