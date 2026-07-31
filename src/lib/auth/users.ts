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

export const AJ_STORES = [
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

/** @deprecated use AJ_STORES */
export const AKBER_STORES = AJ_STORES;

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
    passwordHash:
      "$2b$10$OOR0KpMPwlmJVTYq6XEZ1ewnj8cTHd8GQec/dS3C90al8axjElReq", // Kash-Valliani
    role: "admin",
    storeCodes: [],
    title: "Founder & President",
  },
  {
    username: "aj",
    name: "AJ",
    passwordHash:
      "$2b$10$jJOVYmYvNxqCNyMon31GVu/65jMjPqxnYTOmo7QcWLjXq25AmRlFC", // AJ-Valliani
    role: "dm",
    storeCodes: [...AJ_STORES],
    title: "District Manager",
  },
  {
    username: "shaun",
    name: "Shaun McCullough",
    passwordHash:
      "$2b$10$osp08e.v5x3cWWCVzrDAseA7NDUveOAn5Xy3Qa62mB8O72JXGXAka", // Shaun-Valliani
    role: "dm",
    storeCodes: [...SHAUN_STORES],
    title: "District Manager",
  },
  {
    username: "adeel",
    name: "Adeel Valliani",
    passwordHash:
      "$2b$10$fbYMCo9.e.CPpQp0DUrZXeQ9PSf1DKKTSXbakOtcLkk94rmYBD/Xm", // Adeel-Valliani
    role: "dm",
    storeCodes: [...ADEEL_STORES],
    title: "District Manager",
  },
  {
    username: "rozina",
    name: "Rozina Kassam",
    passwordHash:
      "$2b$10$OBpALP1RdZwVEQxVzl61JevYdrYcaDp521ZWmMndRQzJP4tvqRa7W", // Rozy-Valliani
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
  // Former login "akber" → AJ
  const alias = needle === "akber" ? "aj" : needle;
  return listAuthUsers().find((u) => u.username.toLowerCase() === alias) ?? null;
}

export function getAllowedStoreCodes(user: AuthUserRecord): string[] | null {
  if (user.role === "admin") return null;
  return user.storeCodes;
}
