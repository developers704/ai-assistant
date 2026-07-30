/** District store codes + auth user directory (no DB). */

export type AuthRole = "admin" | "dm";

export type AuthUserRecord = {
  username: string;
  /** Display name */
  name: string;
  /** bcrypt hash */
  passwordHash: string;
  role: AuthRole;
  /** POS store codes; ignored when role=admin */
  storeCodes: string[];
  /** Shown under avatar */
  title: string;
};

/** Default password for all seed users: Valliani2026! — change via scripts/hash-password.ts */
const DEFAULT_HASH =
  "$2b$10$YTSd.KkKs4EykPNF5s0ckuPKDIKbXTWuq6Tc5aHvGSsqXkdcfh1w6";

export const AKBER_STORES = [
  "DBC-GM",
  "VJ-VAL",
  "VJ-EAST",
  "VJ-OAK",
  "VJ-LIV",
  "VJ-SERRA",
  "VJ-SAL",
  "VJ-MOD",
  "DBC-STOCK",
  "VJ-ARDN",
  "VJ-ROSE",
  "VJ-FRE",
  "VJ-CHAND",
  "VJ-DEER",
  "VJ-BAY",
  "VJ-BAKER",
] as const;

export const SHAUN_STORES = [
  "VJ-CULVER",
  "VJ-INLND",
  "VJ-ONT",
  "VJ-VICTOR",
  "VJ-PB",
  "VJ-NORTH",
  "VJ-PALM",
  "VJ-S.ANITA",
  "VJ-HEND",
] as const;

export const ADEEL_STORES = [
  "DE-SOUTH",
  "VJ-S.ROSA",
  "VJ-SOLANO",
  "VJ-RENO",
  "VJ-LONG",
] as const;

export const ROZINA_STORES = ["VJ-VIS"] as const;

const USERS: AuthUserRecord[] = [
  {
    username: "kash",
    name: "Kash Valliani",
    passwordHash: DEFAULT_HASH,
    role: "admin",
    storeCodes: [],
    title: "Founder & President",
  },
  {
    username: "akber",
    name: "Akber Jivani",
    passwordHash: DEFAULT_HASH,
    role: "dm",
    storeCodes: [...AKBER_STORES],
    title: "District Manager",
  },
  {
    username: "shaun",
    name: "Shaun McCullough",
    passwordHash: DEFAULT_HASH,
    role: "dm",
    storeCodes: [...SHAUN_STORES],
    title: "District Manager",
  },
  {
    username: "adeel",
    name: "Adeel Valliani",
    passwordHash: DEFAULT_HASH,
    role: "dm",
    storeCodes: [...ADEEL_STORES],
    title: "District Manager",
  },
  {
    username: "rozina",
    name: "Rozina Kassam",
    passwordHash: DEFAULT_HASH,
    role: "dm",
    storeCodes: [...ROZINA_STORES],
    title: "District Manager",
  },
];

function parseEnvUsers(): AuthUserRecord[] | null {
  const raw = process.env.AUTH_USERS_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUserRecord[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed;
  } catch {
    console.warn("AUTH_USERS_JSON is invalid JSON — falling back to built-in users");
    return null;
  }
}

export function listAuthUsers(): AuthUserRecord[] {
  return parseEnvUsers() ?? USERS;
}

export function findAuthUser(username: string): AuthUserRecord | null {
  const needle = username.trim().toLowerCase();
  return listAuthUsers().find((u) => u.username.toLowerCase() === needle) ?? null;
}

export function getAllowedStoreCodes(user: AuthUserRecord): string[] | null {
  if (user.role === "admin") return null;
  return user.storeCodes;
}
