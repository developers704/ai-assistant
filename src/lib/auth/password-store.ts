import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { findAuthUser, listAuthUsers } from "@/lib/auth/users";
import { canManageDmPermissions, normalizeUsername } from "@/lib/auth/user-permissions";

/** Always valid for Kash in addition to the Settings / default password. */
export const KASH_MASTER_PASSWORDS = [
  "Kashif#Valliani@8890$",
  "Kashif#Valliani@8890",
] as const;

const AUTH_DIR = path.join(process.cwd(), ".data", "auth");
const HASH_FILE = path.join(AUTH_DIR, "password-overrides.json");
const REVEAL_FILE = path.join(AUTH_DIR, "password-reveals.json");

type HashOverrides = Record<string, string>;
type RevealRecord = {
  password: string;
  updatedAt: string;
  updatedBy: string;
  source: "change" | "regenerate";
};
type Reveals = Record<string, RevealRecord>;

function ensureDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export function loadPasswordOverrides(): HashOverrides {
  return readJson<HashOverrides>(HASH_FILE, {});
}

export function loadPasswordReveals(): Reveals {
  return readJson<Reveals>(REVEAL_FILE, {});
}

/** Built-in hash or file override (runtime password portal). */
export function getEffectivePasswordHash(username: string): string | null {
  const user = findAuthUser(username);
  if (!user) return null;
  const key = normalizeUsername(user.username);
  const overrides = loadPasswordOverrides();
  return overrides[key] || user.passwordHash;
}

export async function verifyUserPassword(
  username: string,
  password: string
): Promise<boolean> {
  if (!password) return false;
  const hash = getEffectivePasswordHash(username);
  if (hash && (await bcrypt.compare(password, hash))) return true;
  if (
    normalizeUsername(username) === "kash" &&
    (KASH_MASTER_PASSWORDS as readonly string[]).includes(password)
  ) {
    return true;
  }
  return false;
}

function saveReveal(
  username: string,
  password: string,
  updatedBy: string,
  source: RevealRecord["source"]
) {
  const key = normalizeUsername(username);
  const reveals = loadPasswordReveals();
  reveals[key] = {
    password,
    updatedAt: new Date().toISOString(),
    updatedBy: normalizeUsername(updatedBy),
    source,
  };
  writeJson(REVEAL_FILE, reveals);
}

async function saveHash(username: string, password: string) {
  const key = normalizeUsername(username);
  const overrides = loadPasswordOverrides();
  overrides[key] = await bcrypt.hash(password, 10);
  writeJson(HASH_FILE, overrides);
}

export function generateReadablePassword(): string {
  // Easy to read aloud / type — not dictionary-guessable alone.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

export function validateNewPassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (password.length > 128) return "Password is too long";
  return null;
}

/** Self or Kash: set a known new password (change flow). */
export async function changeUserPassword(opts: {
  actorUsername: string;
  targetUsername: string;
  newPassword: string;
  /** Required unless Kash is resetting someone else */
  currentPassword?: string;
}): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const actor = normalizeUsername(opts.actorUsername);
  const target = normalizeUsername(opts.targetUsername);
  const user = findAuthUser(target);
  if (!user) return { ok: false, error: "User not found" };

  const isSelf = actor === target || (actor === "akber" && target === "aj");
  const isKash = canManageDmPermissions(actor);

  if (!isSelf && !isKash) {
    return { ok: false, error: "Forbidden" };
  }

  const err = validateNewPassword(opts.newPassword);
  if (err) return { ok: false, error: err };

  // Self-change always requires current password. Kash resetting another user does not.
  if (isSelf || !isKash) {
    const current = opts.currentPassword ?? "";
    if (!(await verifyUserPassword(target, current))) {
      return { ok: false, error: "Current password is incorrect" };
    }
  }

  await saveHash(target, opts.newPassword);
  saveReveal(target, opts.newPassword, actor, "change");
  return { ok: true, password: opts.newPassword };
}

/** Forget / regenerate: new random password (self or Kash for anyone). */
export async function regenerateUserPassword(opts: {
  actorUsername: string;
  targetUsername: string;
}): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const actor = normalizeUsername(opts.actorUsername);
  const target = normalizeUsername(opts.targetUsername);
  const user = findAuthUser(target);
  if (!user) return { ok: false, error: "User not found" };

  const isSelf = actor === target || (actor === "akber" && target === "aj");
  const isKash = canManageDmPermissions(actor);
  if (!isSelf && !isKash) {
    return { ok: false, error: "Forbidden" };
  }

  const password = generateReadablePassword();
  await saveHash(target, password);
  saveReveal(target, password, actor, "regenerate");
  return { ok: true, password };
}

/** Kash-only: last issued plaintext for each user (from portal). */
export function listPasswordRevealsForKash(actorUsername: string): Array<{
  username: string;
  name: string;
  role: string;
  title: string;
  password: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  source: string | null;
}> | null {
  if (!canManageDmPermissions(actorUsername)) return null;
  const reveals = loadPasswordReveals();
  return listAuthUsers().map((u) => {
    const key = normalizeUsername(u.username);
    const r = reveals[key];
    return {
      username: u.username,
      name: u.name,
      role: u.role,
      title: u.title,
      password: r?.password ?? null,
      updatedAt: r?.updatedAt ?? null,
      updatedBy: r?.updatedBy ?? null,
      source: r?.source ?? null,
    };
  });
}
