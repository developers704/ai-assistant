import { findAuthUser } from "@/lib/auth/users";
import { getPermissionMapForUser } from "@/lib/auth/user-permissions-store";
import { normalizeUsername } from "@/lib/auth/user-permissions";
import { employeeNameTokens, namesMatch } from "@/lib/hr/name-match";
import { loadActiveTimecardRows } from "@/lib/hr/store";
import { hrStoreNameFromPosCode, posStoreCodeFromHrStore } from "@/lib/hr/hr-store-pos";
import {
  loadSalespersonDirectory,
  resolveSalespersonLabelWithCode,
  type SalespersonDirectoryEntry,
} from "@/lib/sales/salesperson-directory";
import type { HrSelfSalesperson, HrSalesScopePayload } from "@/lib/hr/hr-self-sales-types";

export type { HrSelfSalesperson, HrSalesScopePayload } from "@/lib/hr/hr-self-sales-types";

/** Forced salesperson filter when login cannot be matched — yields zero rows. */
export const UNMATCHED_HR_SALESPERSON = "__unmatched_self__";

type PunchLike = {
  employeeName: string;
  employeeCode?: string | null;
  store?: string | null;
};

export type HrSelfSalesUser = {
  username: string;
  name: string;
  role?: string | null;
  employeeCode?: string | null;
  storeCodes?: string[] | null;
};

const VIEW_ALL_USERNAMES = new Set(["kash", "ross", "marina", "admin"]);

export function canViewAllHrSales(user: {
  username?: string | null;
  role?: string | null;
}): boolean {
  if (user.role === "admin" || user.role === "hr") return true;
  const u = normalizeUsername(user.username);
  if (VIEW_ALL_USERNAMES.has(u)) return true;
  const map = getPermissionMapForUser(user.username, user.role);
  return Boolean(map.hr_management);
}

function usernameLocalPart(username: string): string {
  const raw = username.trim();
  const at = raw.indexOf("@");
  return (at >= 0 ? raw.slice(0, at) : raw).trim().toLowerCase();
}

function givenNameToken(name: string): string | null {
  const raw = name.trim();
  const tokens = employeeNameTokens(raw);
  if (!tokens.length) return null;
  if (raw.includes(",")) return tokens[1] ?? null;
  return tokens[0] ?? null;
}

function directoryVariants(entry: SalespersonDirectoryEntry): string[] {
  return [
    entry.displayName,
    `${entry.lastName}, ${entry.firstName}`,
    `${entry.firstName} ${entry.lastName}`,
    `${entry.firstName}, ${entry.lastName}`,
  ].filter((n) => n.replace(/[^a-z]/gi, "").length > 2);
}

function directoryEntryMatchesUser(userName: string, entry: SalespersonDirectoryEntry): boolean {
  return directoryVariants(entry).some((v) => namesMatch(userName, v));
}

/** Directory name tokens (len≥3) are a subset of the login name tokens. */
function directorySubsetMatch(userName: string, entry: SalespersonDirectoryEntry): boolean {
  const userTok = new Set(employeeNameTokens(userName));
  const dirTok = [
    ...employeeNameTokens(entry.firstName),
    ...employeeNameTokens(entry.lastName),
  ].filter((t) => t.length >= 3);
  if (!dirTok.length) return false;
  return dirTok.every((t) => userTok.has(t));
}

function pickBestCode(codes: string[], punches: PunchLike[], userName: string): string | null {
  const unique = [
    ...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean)),
  ];
  if (!unique.length) return null;
  const punchCodes = punches
    .filter((p) => namesMatch(userName, p.employeeName) && (p.employeeCode ?? "").trim())
    .map((p) => p.employeeCode!.trim().toUpperCase());
  for (const c of punchCodes) {
    if (unique.includes(c)) return c;
  }
  unique.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return unique[0] ?? null;
}

function storeForCode(
  punches: PunchLike[],
  code: string,
  userName: string,
  homeStore: string | null
): { storeCode: string | null; storeName: string | null } {
  const key = code.toUpperCase();
  const hit =
    punches.find(
      (p) => (p.employeeCode ?? "").trim().toUpperCase() === key && (p.store ?? "").trim()
    ) ??
    punches.find((p) => namesMatch(userName, p.employeeName) && (p.store ?? "").trim());
  const storeName = hit?.store?.trim() || hrStoreNameFromPosCode(homeStore);
  const storeCode = posStoreCodeFromHrStore(hit?.store) ?? homeStore;
  return { storeCode, storeName: storeName || hrStoreNameFromPosCode(storeCode) };
}

function toSelf(
  code: string,
  store: { storeCode: string | null; storeName: string | null },
  directory: Map<string, SalespersonDirectoryEntry>
): HrSelfSalesperson {
  const key = code.trim().toUpperCase();
  return {
    code: key,
    label: resolveSalespersonLabelWithCode(key, directory),
    storeCode: store.storeCode,
    storeName: store.storeName,
  };
}

/**
 * Map a logged-in user to their POS salesperson (code + label).
 * Prefers employeeCode, then username local-part as code, then timecard
 * name/code, then salesperson-directory name match.
 */
export function resolveHrSelfSalesperson(
  user: HrSelfSalesUser,
  opts?: {
    directory?: Map<string, SalespersonDirectoryEntry>;
    punches?: PunchLike[];
  }
): HrSelfSalesperson | null {
  const directory = opts?.directory ?? loadSalespersonDirectory();
  const punches = opts?.punches ?? loadActiveTimecardRows();
  const homeStore = (user.storeCodes ?? []).find((s) => s && s !== "NA") ?? null;
  const userName = user.name || "";

  const explicit = (user.employeeCode ?? "").trim().toUpperCase();
  if (explicit && (directory.has(explicit) || punches.some((p) => (p.employeeCode ?? "").trim().toUpperCase() === explicit))) {
    return toSelf(explicit, storeForCode(punches, explicit, userName, homeStore), directory);
  }

  const localAsCode = usernameLocalPart(user.username).replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (localAsCode && directory.has(localAsCode)) {
    return toSelf(localAsCode, storeForCode(punches, localAsCode, userName, homeStore), directory);
  }

  const punchHits = punches
    .filter((p) => {
      if (explicit && (p.employeeCode ?? "").trim().toUpperCase() === explicit) return true;
      return namesMatch(userName, p.employeeName);
    })
    .map((p) => (p.employeeCode ?? "").trim().toUpperCase())
    .filter(Boolean);
  const punchCode = pickBestCode(punchHits, punches, userName);
  if (punchCode) {
    return toSelf(punchCode, storeForCode(punches, punchCode, userName, homeStore), directory);
  }

  const strictHits: string[] = [];
  const looseHits: string[] = [];
  for (const [code, entry] of directory) {
    if (directoryEntryMatchesUser(userName, entry)) strictHits.push(code);
    else if (directorySubsetMatch(userName, entry)) looseHits.push(code);
  }
  const nameHits = strictHits.length ? strictHits : looseHits.length === 1 ? looseHits : [];
  if (nameHits.length) {
    const code = pickBestCode(nameHits, punches, userName);
    if (code) {
      return toSelf(code, storeForCode(punches, code, userName, homeStore), directory);
    }
  }

  const given =
    givenNameToken(userName) ??
    usernameLocalPart(user.username).replace(/[^a-z0-9]/gi, "");
  if (given && given.length >= 3) {
    const firstHits: string[] = [];
    for (const [code, entry] of directory) {
      const first = employeeNameTokens(entry.firstName)[0];
      if (first === given) firstHits.push(code);
    }
    const code = pickBestCode(firstHits, punches, userName);
    if (
      code &&
      (firstHits.length === 1 ||
        punches.some((p) => (p.employeeCode ?? "").trim().toUpperCase() === code))
    ) {
      return toSelf(code, storeForCode(punches, code, userName, homeStore), directory);
    }
  }

  return null;
}

export function resolveHrSelfSalespersonForSession(session: {
  username: string;
  name: string;
}): HrSelfSalesperson | null {
  const live = findAuthUser(session.username);
  return resolveHrSelfSalesperson({
    username: session.username,
    name: live?.name ?? session.name,
    employeeCode: live?.employeeCode,
    storeCodes: live?.storeCodes ?? null,
  });
}

export function lockHrSalesQuery(opts: {
  hrSales: boolean;
  session: { username: string; name: string; role: string };
  salespeople: string[];
  stores: string[];
  departments: string[];
}): {
  salespeople: string[];
  stores: string[];
  departments: string[];
  hrSalesScope?: HrSalesScopePayload;
  selfLocked: boolean;
} {
  if (!opts.hrSales) {
    return {
      salespeople: opts.salespeople,
      stores: opts.stores,
      departments: opts.departments,
      selfLocked: false,
    };
  }
  if (canViewAllHrSales(opts.session)) {
    return {
      salespeople: opts.salespeople,
      stores: opts.stores,
      departments: opts.departments,
      hrSalesScope: { mode: "all" },
      selfLocked: false,
    };
  }
  const self = resolveHrSelfSalespersonForSession(opts.session);
  return {
    salespeople: self ? [self.label] : [UNMATCHED_HR_SALESPERSON],
    stores: [],
    departments: [],
    hrSalesScope: { mode: "self", self },
    selfLocked: true,
  };
}

export function salespersonForHrCommissionRequest(opts: {
  session: { username: string; name: string; role: string };
  requested: string;
}): { ok: true; salesperson: string } | { ok: false; status: 400 | 404; error: string } {
  if (canViewAllHrSales(opts.session)) {
    const requested = opts.requested.trim();
    if (!requested) return { ok: false, status: 400, error: "salesperson is required" };
    return { ok: true, salesperson: requested };
  }
  const self = resolveHrSelfSalespersonForSession(opts.session);
  if (!self) {
    return { ok: false, status: 404, error: "Could not match your login to a salesperson" };
  }
  return { ok: true, salesperson: self.label };
}
