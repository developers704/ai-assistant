import fs from "fs";
import path from "path";
import type { HrWarningNotice, HrWarningRemark } from "./types";
import { namesMatch } from "./name-match";

const DATA_DIR = path.join(process.cwd(), ".data", "hr");
const STORE_PATH = path.join(DATA_DIR, "warnings.json");

type WarningStoreFile = {
  notices: HrWarningNotice[];
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): WarningStoreFile {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) return { notices: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as WarningStoreFile;
    if (!parsed || !Array.isArray(parsed.notices)) return { notices: [] };
    return {
      notices: parsed.notices.map((n) => ({
        ...n,
        remarks: Array.isArray(n.remarks) ? n.remarks : [],
      })),
    };
  } catch {
    return { notices: [] };
  }
}

function writeStore(store: WarningStoreFile) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function listWarningNotices(): HrWarningNotice[] {
  return readStore().notices;
}

export function findWarningNotice(caseId: string): HrWarningNotice | null {
  const id = caseId.trim().toUpperCase();
  return readStore().notices.find((n) => n.caseId.toUpperCase() === id) ?? null;
}

export function findWarningForEmployee(
  employeeName: string,
  date: string
): HrWarningNotice | null {
  return (
    readStore().notices.find(
      (n) => n.date === date && namesMatch(n.employeeName, employeeName)
    ) ?? null
  );
}

export function upsertWarningNotice(notice: HrWarningNotice): HrWarningNotice {
  const store = readStore();
  const idx = store.notices.findIndex(
    (n) => n.caseId.toUpperCase() === notice.caseId.toUpperCase()
  );
  const next: HrWarningNotice = {
    ...notice,
    remarks: notice.remarks ?? [],
  };
  if (idx >= 0) {
    next.remarks = mergeRemarks(store.notices[idx]!.remarks, next.remarks);
    store.notices[idx] = next;
  } else {
    store.notices.unshift(next);
  }
  writeStore(store);
  return next;
}

function remarkKey(r: HrWarningRemark): string {
  if (r.messageId?.trim()) return `mid:${r.messageId.trim().toLowerCase()}`;
  return `uid:${r.uid}:${r.fromEmail.toLowerCase()}:${r.sentAt}`;
}

function mergeRemarks(
  existing: HrWarningRemark[],
  incoming: HrWarningRemark[]
): HrWarningRemark[] {
  const byKey = new Map<string, HrWarningRemark>();
  for (const r of existing) byKey.set(remarkKey(r), r);
  for (const r of incoming) {
    const k = remarkKey(r);
    if (!byKey.has(k)) byKey.set(k, r);
  }
  return [...byKey.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export function addWarningRemarks(
  caseId: string,
  remarks: HrWarningRemark[]
): HrWarningNotice | null {
  const store = readStore();
  const idx = store.notices.findIndex(
    (n) => n.caseId.toUpperCase() === caseId.trim().toUpperCase()
  );
  if (idx < 0) return null;
  const current = store.notices[idx]!;
  const next: HrWarningNotice = {
    ...current,
    remarks: mergeRemarks(current.remarks, remarks),
  };
  store.notices[idx] = next;
  writeStore(store);
  return next;
}
