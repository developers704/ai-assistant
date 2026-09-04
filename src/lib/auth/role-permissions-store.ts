import fs from "fs";
import path from "path";
import type { AuthRole } from "@/lib/auth/users";
import {
  getDefaultPermissionMapForRole,
  mergePermissionMap,
  type PermissionOverrides,
  type UserPermissionMap,
} from "@/lib/auth/user-permissions";

const AUTH_DIR = path.join(process.cwd(), ".data", "auth");
const ROLE_FILE = path.join(AUTH_DIR, "role-permissions.json");

export type RolePermissionOverrides = Partial<Record<AuthRole, Partial<UserPermissionMap>>>;

function ensureDir() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

export function loadRolePermissionOverrides(): RolePermissionOverrides {
  ensureDir();
  if (!fs.existsSync(ROLE_FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(ROLE_FILE, "utf8")) as RolePermissionOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRolePermissionOverrides(
  data: RolePermissionOverrides
): RolePermissionOverrides {
  ensureDir();
  fs.writeFileSync(ROLE_FILE, JSON.stringify(data, null, 2), "utf8");
  return data;
}

export function getPermissionMapForRole(role: AuthRole): UserPermissionMap {
  const base = getDefaultPermissionMapForRole(role);
  const override = loadRolePermissionOverrides()[role] ?? {};
  return { ...base, ...override };
}

export function setPermissionMapForRole(
  role: AuthRole,
  updates: Partial<UserPermissionMap>
): UserPermissionMap {
  const stored = loadRolePermissionOverrides();
  stored[role] = { ...(stored[role] ?? {}), ...updates };
  saveRolePermissionOverrides(stored);
  return getPermissionMapForRole(role);
}

export function mergeRoleThenUserPermissions(
  username: string | null | undefined,
  role: string | null | undefined,
  userOverrides: PermissionOverrides | null | undefined
): UserPermissionMap {
  const typedRole = (role === "admin" || role === "employee" || role === "hr" || role === "dm"
    ? role
    : role === "hr_access"
      ? "employee"
      : null) as AuthRole | null;
  const roleMap = typedRole ? getPermissionMapForRole(typedRole) : getDefaultPermissionMapForRole(role);
  const asOverrides: PermissionOverrides = {
    ...(userOverrides ?? {}),
  };
  const key = (username ?? "").trim().toLowerCase();
  if (key) {
    asOverrides[key] = { ...roleMap, ...(asOverrides[key] ?? {}) };
  }
  return mergePermissionMap(username, typedRole ?? role, asOverrides);
}
