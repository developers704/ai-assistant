import fs from "fs";
import path from "path";
import type { AuthRole, AuthUserRecord } from "@/lib/auth/users";
import { normalizeUsername } from "@/lib/auth/user-permissions";

const AUTH_DIR = path.join(process.cwd(), ".data", "auth");
const DIRECTORY_FILE = path.join(AUTH_DIR, "user-directory.json");

export type UserDirectoryOverlay = {
  users: AuthUserRecord[];
  deleted: string[];
};

function ensureDir() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

export function loadUserDirectoryOverlay(): UserDirectoryOverlay {
  ensureDir();
  if (!fs.existsSync(DIRECTORY_FILE)) {
    return { users: [], deleted: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DIRECTORY_FILE, "utf8")) as UserDirectoryOverlay;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
    };
  } catch {
    return { users: [], deleted: [] };
  }
}

export function saveUserDirectoryOverlay(overlay: UserDirectoryOverlay): UserDirectoryOverlay {
  ensureDir();
  fs.writeFileSync(DIRECTORY_FILE, JSON.stringify(overlay, null, 2), "utf8");
  return overlay;
}

export function applyUserDirectory(base: AuthUserRecord[]): AuthUserRecord[] {
  const overlay = loadUserDirectoryOverlay();
  const byKey = new Map<string, AuthUserRecord>();
  for (const user of base) {
    byKey.set(normalizeUsername(user.username), user);
  }
  for (const key of overlay.deleted) {
    byKey.delete(normalizeUsername(key));
  }
  for (const user of overlay.users) {
    if (!user?.username) continue;
    byKey.set(normalizeUsername(user.username), user);
  }
  return [...byKey.values()];
}

function upsertOverlayUser(user: AuthUserRecord): UserDirectoryOverlay {
  const overlay = loadUserDirectoryOverlay();
  const key = normalizeUsername(user.username);
  overlay.deleted = overlay.deleted.filter((d) => normalizeUsername(d) !== key);
  const idx = overlay.users.findIndex((u) => normalizeUsername(u.username) === key);
  if (idx >= 0) overlay.users[idx] = user;
  else overlay.users.push(user);
  return saveUserDirectoryOverlay(overlay);
}

export function writeDirectoryUser(user: AuthUserRecord): AuthUserRecord {
  upsertOverlayUser(user);
  return user;
}

export function patchDirectoryUser(
  current: AuthUserRecord,
  patch: Partial<AuthUserRecord>
): AuthUserRecord {
  const next: AuthUserRecord = {
    ...current,
    ...patch,
    username: current.username,
    passwordHash: patch.passwordHash ?? current.passwordHash,
  };
  return writeDirectoryUser(next);
}

export function deleteDirectoryUser(username: string): boolean {
  const key = normalizeUsername(username);
  if (!key || key === "kash") return false;
  const overlay = loadUserDirectoryOverlay();
  overlay.users = overlay.users.filter((u) => normalizeUsername(u.username) !== key);
  if (!overlay.deleted.some((d) => normalizeUsername(d) === key)) {
    overlay.deleted.push(key);
  }
  saveUserDirectoryOverlay(overlay);
  return true;
}

export function isProtectedUsername(username: string): boolean {
  return normalizeUsername(username) === "kash";
}

export function isValidAuthRole(role: string): role is AuthRole {
  return role === "admin" || role === "employee" || role === "hr" || role === "dm";
}
