import fs from "fs";
import path from "path";
import type { NextResponse } from "next/server";
import {
  applyPermissionsCookie,
  mergePermissionMap,
  type PermissionOverrides,
  type UserPermissionKey,
  type UserPermissionMap,
} from "@/lib/auth/user-permissions";
import { findAuthUser } from "@/lib/auth/users";
import { loadRolePermissionOverrides } from "@/lib/auth/role-permissions-store";

const PERMS_DIR = path.join(process.cwd(), ".data", "auth");
const PERMS_FILE = path.join(PERMS_DIR, "user-permissions.json");

function ensureDir() {
  if (!fs.existsSync(PERMS_DIR)) {
    fs.mkdirSync(PERMS_DIR, { recursive: true });
  }
}

/** Source of truth for DM permission overrides (server only). */
export function loadPermissionOverrides(): PermissionOverrides {
  ensureDir();
  if (!fs.existsSync(PERMS_FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(PERMS_FILE, "utf8")) as PermissionOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePermissionOverrides(data: PermissionOverrides): PermissionOverrides {
  ensureDir();
  fs.writeFileSync(PERMS_FILE, JSON.stringify(data, null, 2), "utf8");
  return data;
}

export function getPermissionMapForUser(
  username?: string | null,
  role?: string | null
): UserPermissionMap {
  const liveRole = role ?? findAuthUser(username ?? "")?.role ?? null;
  return mergePermissionMap(
    username,
    liveRole,
    loadPermissionOverrides(),
    loadRolePermissionOverrides()
  );
}

export function setPermissionMapForUser(
  username: string,
  updates: Partial<UserPermissionMap>
): UserPermissionMap {
  const key = (username ?? "").trim().toLowerCase();
  const stored = loadPermissionOverrides();
  stored[key] = { ...(stored[key] ?? {}), ...updates };
  savePermissionOverrides(stored);
  const liveRole = findAuthUser(username)?.role ?? "dm";
  return getPermissionMapForUser(username, liveRole);
}

/** Hide vendor names when vendor_info permission is off. */
export function hidesVendorInfoFromPermissions(
  username: string | null | undefined
): boolean {
  const key = (username ?? "").trim().toLowerCase();
  // Rozina: always hide vendor (hard rule)
  if (key === "rozina") return true;
  const user = findAuthUser(username ?? "");
  if (user?.role === "admin") return false;
  const map = getPermissionMapForUser(username, user?.role ?? "dm");
  return !map.vendor_info;
}

export function syncPermissionsCookie(res: NextResponse): void {
  applyPermissionsCookie(res, loadPermissionOverrides(), loadRolePermissionOverrides());
}

export type { UserPermissionKey, UserPermissionMap, PermissionOverrides };
