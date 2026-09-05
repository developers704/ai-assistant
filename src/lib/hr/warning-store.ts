import fs from "fs";
import path from "path";
import type { HrAbsenceWaiver, HrNoticeKind, HrWarningNotice, HrWarningRemark } from "./types";
import { namesMatch } from "./name-match";
import { stripQuotedReply } from "./remark-text";

const DATA_DIR = path.join(process.cwd(), ".data", "hr");
const STORE_PATH = path.join(DATA_DIR, "warnings.json");

type WarningStoreFile = {
  notices: HrWarningNotice[];
  absenceWaivers?: HrAbsenceWaiver[];
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): WarningStoreFile {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) return { notices: [], absenceWaivers: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as WarningStoreFile;
    if (!parsed || !Array.isArray(parsed.notices)) return { notices: [], absenceWaivers: [] };
    return {
      notices: parsed.notices.map((n) => ({
        ...n,
        remarks: Array.isArray(n.remarks) ? n.remarks : [],
      })),
      absenceWaivers: Array.isArray(parsed.absenceWaivers) ? parsed.absenceWaivers : [],
    };
  } catch {
    return { notices: [], absenceWaivers: [] };
  }
}

function writeStore(store: WarningStoreFile) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function noticeKind(notice: Pick<HrWarningNotice, "kind" | "caseId">): HrNoticeKind {
  if (notice.kind === "writeup" || notice.kind === "warning") return notice.kind;
  return /^HR-WRITEUP-/i.test(notice.caseId) ? "writeup" : "warning";
}

export function listWarningNotices(): HrWarningNotice[] {
  return readStore().notices.map((n) => ({
    ...n,
    kind: noticeKind(n),
  }));
}

export function findWarningNotice(caseId: string): HrWarningNotice | null {
  const id = caseId.trim().toUpperCase();
  return listWarningNotices().find((n) => n.caseId.toUpperCase() === id) ?? null;
}

export function findNoticeForEmployee(
  employeeName: string,
  date: string,
  kind: HrNoticeKind
): HrWarningNotice | null {
  return (
    listWarningNotices().find(
      (n) =>
        n.date === date &&
        namesMatch(n.employeeName, employeeName) &&
        noticeKind(n) === kind
    ) ?? null
  );
}

export function findWarningForEmployee(
  employeeName: string,
  date: string
): HrWarningNotice | null {
  return findNoticeForEmployee(employeeName, date, "warning");
}

export function findWriteUpForEmployee(
  employeeName: string,
  date: string
): HrWarningNotice | null {
  return findNoticeForEmployee(employeeName, date, "writeup");
}

export function upsertWarningNotice(notice: HrWarningNotice): HrWarningNotice {
  const store = readStore();
  const idx = store.notices.findIndex(
    (n) => n.caseId.toUpperCase() === notice.caseId.toUpperCase()
  );
  const next: HrWarningNotice = {
    ...notice,
    kind: noticeKind(notice),
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

function remarkContentKey(r: HrWarningRemark): string {
  const body = stripQuotedReply(r.body).toLowerCase().replace(/\s+/g, " ").trim();
  return `${r.fromEmail.toLowerCase()}::${body}`;
}

function remarkKey(r: HrWarningRemark): string {
  if (r.messageId?.trim() && !r.messageId.startsWith("hr-") && !r.messageId.startsWith("local-")) {
    return `mid:${r.messageId.trim().toLowerCase()}`;
  }
  return `body:${remarkContentKey(r)}`;
}

function mergeRemarks(
  existing: HrWarningRemark[],
  incoming: HrWarningRemark[]
): HrWarningRemark[] {
  const byKey = new Map<string, HrWarningRemark>();
  const content = new Set<string>();
  for (const r of existing) {
    byKey.set(remarkKey(r), r);
    content.add(remarkContentKey(r));
  }
  for (const r of incoming) {
    const ck = remarkContentKey(r);
    if (content.has(ck)) continue;
    const k = remarkKey(r);
    if (!byKey.has(k)) {
      byKey.set(k, r);
      content.add(ck);
    }
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

export function isWarningWaived(notice: Pick<HrWarningNotice, "waivedAt"> | null | undefined): boolean {
  return Boolean(notice?.waivedAt);
}

export function waiveWarningNotice(caseId: string, waivedBy?: string | null): HrWarningNotice | null {
  const store = readStore();
  const idx = store.notices.findIndex(
    (n) => n.caseId.toUpperCase() === caseId.trim().toUpperCase()
  );
  if (idx < 0) return null;
  const current = store.notices[idx]!;
  const next: HrWarningNotice = {
    ...current,
    kind: noticeKind(current),
    waivedAt: new Date().toISOString(),
    waivedBy: waivedBy ?? current.waivedBy ?? null,
  };
  store.notices[idx] = next;
  writeStore(store);
  return next;
}

export function countedScheduleWarnings(opts: {
  from: string;
  to: string;
  notices?: HrWarningNotice[];
}): HrWarningNotice[] {
  const notices = opts.notices ?? listWarningNotices();
  return notices.filter(
    (n) =>
      noticeKind(n) === "warning" &&
      !isWarningWaived(n) &&
      n.date >= opts.from &&
      n.date <= opts.to
  );
}

export function listAbsenceWaivers(): HrAbsenceWaiver[] {
  return readStore().absenceWaivers ?? [];
}

export function absenceWaiverAppliesTo(
  waiver: Pick<HrAbsenceWaiver, "employeeName" | "employeeCode" | "date">,
  person: {
    date?: string;
    employeeName: string;
    employeeCode?: string | null;
    displayName?: string | null;
  }
): boolean {
  if (person.date && waiver.date !== person.date) return false;
  const code = (person.employeeCode ?? "").trim().toUpperCase();
  const waiverCode = (waiver.employeeCode ?? "").trim().toUpperCase();
  if (code && waiverCode && code === waiverCode) return true;
  if (namesMatch(waiver.employeeName, person.employeeName)) return true;
  if (person.displayName && namesMatch(waiver.employeeName, person.displayName)) return true;
  return false;
}

export function findAbsenceWaiver(
  employeeName: string,
  date: string,
  employeeCode?: string | null
): HrAbsenceWaiver | null {
  return (
    listAbsenceWaivers().find((w) =>
      absenceWaiverAppliesTo(w, { employeeName, date, employeeCode })
    ) ?? null
  );
}

export function upsertAbsenceWaiver(input: {
  employeeName: string;
  employeeCode?: string | null;
  date: string;
  waivedBy?: string | null;
}): HrAbsenceWaiver {
  const store = readStore();
  const waivers = [...(store.absenceWaivers ?? [])];
  const idx = waivers.findIndex((w) =>
    absenceWaiverAppliesTo(w, {
      employeeName: input.employeeName,
      employeeCode: input.employeeCode,
      date: input.date,
    })
  );
  const next: HrAbsenceWaiver = {
    employeeName: input.employeeName.trim(),
    employeeCode: input.employeeCode?.trim() || null,
    date: input.date,
    waivedAt: new Date().toISOString(),
    waivedBy: input.waivedBy ?? (idx >= 0 ? waivers[idx]!.waivedBy : null) ?? null,
  };
  if (idx >= 0) waivers[idx] = next;
  else waivers.unshift(next);
  store.absenceWaivers = waivers;
  writeStore(store);
  return next;
}

export function unwaivedAbsentDates(
  absentDates: string[],
  waivers: HrAbsenceWaiver[],
  person: {
    employeeName: string;
    employeeCode?: string | null;
    displayName?: string | null;
  }
): string[] {
  return absentDates.filter(
    (date) => !waivers.some((w) => absenceWaiverAppliesTo(w, { ...person, date }))
  );
}
