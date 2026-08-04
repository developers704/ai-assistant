export type UserPermissionKey =
  | "sales_dashboard"
  | "stores_map"
  | "price_calculator"
  | "news_markets"
  | "email"
  | "calendar"
  | "contacts"
  | "ai_chat"
  | "data_analyst"
  | "image_generation"
  | "social"
  | "vendor_info";

export const PERMISSION_COOKIE_NAME = "alexa-user-permissions-v1";

export const USER_PERMISSION_SECTIONS: Array<{ key: UserPermissionKey; label: string; description: string }> = [
  { key: "sales_dashboard", label: "Sales Dashboard", description: "Net sales, stores, and revenue dashboard" },
  { key: "stores_map", label: "Stores Map & Info", description: "Store locations and details" },
  { key: "price_calculator", label: "Price Calculator", description: "Pricing and wholesale cost tools" },
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

export function getDefaultPermissionMapForRole(role?: string | null): Record<UserPermissionKey, boolean> {
  const base: Record<UserPermissionKey, boolean> = {
    sales_dashboard: false,
    stores_map: false,
    price_calculator: false,
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

  if (role === "admin") {
    return Object.fromEntries(USER_PERMISSION_SECTIONS.map((section) => [section.key, true])) as Record<UserPermissionKey, boolean>;
  }

  if (role === "dm") {
    return {
      sales_dashboard: true,
      stores_map: true,
      price_calculator: true,
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

  return base;
}

function normalizeUsername(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function getStorageKey(): string {
  return PERMISSION_COOKIE_NAME;
}

export function readPermissionOverridesFromCookieValue(value?: string | null): Record<string, Partial<Record<UserPermissionKey, boolean>>> {
  if (!value) return {};
  try {
    const raw = decodeURIComponent(value);
    const parsed = JSON.parse(raw) as Record<string, Partial<Record<UserPermissionKey, boolean>>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readStoredPermissions(): Record<string, Partial<Record<UserPermissionKey, boolean>>> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) return readPermissionOverridesFromCookieValue(document.cookie.split(`${getStorageKey()}=`)[1]?.split(";")[0]);
    const parsed = JSON.parse(raw) as Record<string, Partial<Record<UserPermissionKey, boolean>>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredPermissions(data: Record<string, Partial<Record<UserPermissionKey, boolean>>>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(), JSON.stringify(data));
    const encoded = encodeURIComponent(JSON.stringify(data));
    document.cookie = `${getStorageKey()}=${encoded}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Ignore storage failures silently.
  }
}

export function getPermissionMapForUserFromCookie(
  username?: string | null,
  role?: string | null,
  rawCookieValue?: string | null
): Record<UserPermissionKey, boolean> {
  const base = getDefaultPermissionMapForRole(role);
  const key = normalizeUsername(username);
  if (!key) return base;

  const stored = readPermissionOverridesFromCookieValue(rawCookieValue ?? undefined);
  const override = stored[key] ?? {};
  const merged = { ...base, ...override };

  if (normalizeUsername(username) === "rozina") {
    merged.vendor_info = false;
  }

  return merged;
}

export function getPermissionMapForUser(username?: string | null, role?: string | null): Record<UserPermissionKey, boolean> {
  const base = getDefaultPermissionMapForRole(role);
  const key = normalizeUsername(username);
  if (!key) return base;

  const stored = readStoredPermissions();
  const override = stored[key] ?? {};
  const merged = { ...base, ...override };

  if (normalizeUsername(username) === "rozina") {
    merged.vendor_info = false;
  }

  return merged;
}

export function setPermissionMapForUser(
  username: string,
  updates: Partial<Record<UserPermissionKey, boolean>>
): Record<UserPermissionKey, boolean> {
  const key = normalizeUsername(username);
  const stored = readStoredPermissions();
  const current = stored[key] ?? {};
  const updated = { ...current, ...updates };
  stored[key] = updated;
  writeStoredPermissions(stored);

  const role = "dm";
  return getPermissionMapForUser(username, role);
}

export function canUserAccessSection(username?: string | null, role?: string | null, section: UserPermissionKey): boolean {
  const map = getPermissionMapForUser(username, role);
  return Boolean(map[section]);
}

export function getDmPermissionChecklist(username?: string | null): Record<UserPermissionKey, boolean> {
  return getPermissionMapForUser(username, "dm");
}
