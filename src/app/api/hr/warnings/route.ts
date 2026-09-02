import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import { analyzeDay } from "@/lib/hr/analyze";
import { loadActiveScheduleEntries, loadActiveTimecardRows } from "@/lib/hr/store";
import { namesMatch } from "@/lib/hr/name-match";
import {
  draftWarningNotice,
  isEligibleForHrNotice,
} from "@/lib/hr/warning-notice";
import {
  addWarningRemarks,
  findWarningForEmployee,
  findWarningNotice,
  findWriteUpForEmployee,
  listWarningNotices,
  upsertWarningNotice,
} from "@/lib/hr/warning-store";
import type { HrWarningNotice, HrWarningRemark } from "@/lib/hr/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminOnly() {
  const session = await readSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

function asNotice(value: unknown): HrWarningNotice | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const caseId = String(o.caseId ?? "").trim();
  const employeeName = String(o.employeeName ?? "").trim();
  const date = String(o.date ?? "").trim();
  const subject = String(o.subject ?? "").trim();
  if (!caseId || !employeeName || !date || !subject) return null;
  const remarks = Array.isArray(o.remarks) ? (o.remarks as HrWarningRemark[]) : [];
  return {
    caseId,
    employeeName,
    employeeCode: o.employeeCode == null ? null : String(o.employeeCode),
    jobTitle: o.jobTitle == null ? null : String(o.jobTitle),
    manager: o.manager == null ? null : String(o.manager),
    date,
    lateMinutes: Number(o.lateMinutes) || 0,
    description: o.description == null ? null : String(o.description),
    store: o.store == null ? null : String(o.store),
    kind: o.kind === "writeup" || /^HR-WRITEUP-/i.test(caseId) ? "writeup" : "warning",
    from: String(o.from ?? ""),
    to: String(o.to ?? ""),
    subject,
    sentAt: String(o.sentAt ?? new Date().toISOString()),
    messageId: o.messageId == null ? null : String(o.messageId),
    remarks,
  };
}

function asRemarks(value: unknown): HrWarningRemark[] {
  if (!Array.isArray(value)) return [];
  const out: HrWarningRemark[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    const body = String(o.body ?? "").trim();
    if (!id) continue;
    out.push({
      id,
      fromName: String(o.fromName ?? ""),
      fromEmail: String(o.fromEmail ?? ""),
      sentAt: String(o.sentAt ?? ""),
      subject: String(o.subject ?? ""),
      body,
      messageId: String(o.messageId ?? ""),
      uid: Number(o.uid) || 0,
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const denied = await adminOnly();
  if (denied) return denied;

  const date = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  const employeeName = req.nextUrl.searchParams.get("employeeName")?.trim() ?? "";

  if (!date || !employeeName) {
    return NextResponse.json({ notices: listWarningNotices() });
  }

  const existing = findWarningForEmployee(employeeName, date);
  const existingWriteUp = findWriteUpForEmployee(employeeName, date);
  const rows = loadActiveTimecardRows();
  const schedule = loadActiveScheduleEntries();
  const employees = analyzeDay(date, rows, schedule);
  const emp = employees.find((e) => namesMatch(e.employeeName, employeeName));
  if (!emp) {
    return NextResponse.json({ error: "Employee not found for that date" }, { status: 404 });
  }
  if (!isEligibleForHrNotice(emp) && !existing && !existingWriteUp) {
    return NextResponse.json(
      { error: "No attendance violation for a warning notice", employee: emp, warning: null, writeUp: null },
      { status: 400 }
    );
  }

  const draft = isEligibleForHrNotice(emp) ? draftWarningNotice(emp) : null;
  return NextResponse.json({
    employee: emp,
    draft,
    warning: existing,
    writeUp: existingWriteUp,
  });
}

export async function POST(req: NextRequest) {
  const denied = await adminOnly();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "record").trim();

  if (action === "remarks") {
    const caseId = String(body.caseId ?? "").trim();
    const remarks = asRemarks(body.remarks);
    if (!caseId) {
      return NextResponse.json({ error: "caseId is required" }, { status: 400 });
    }
    const updated = addWarningRemarks(caseId, remarks);
    if (!updated) {
      return NextResponse.json({ error: "Warning notice not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, warning: updated });
  }

  const notice = asNotice(body.notice ?? body);
  if (!notice) {
    return NextResponse.json({ error: "Invalid warning notice" }, { status: 400 });
  }
  const existing = findWarningNotice(notice.caseId);
  const saved = upsertWarningNotice({
    ...notice,
    remarks: existing?.remarks ?? notice.remarks ?? [],
  });
  return NextResponse.json({ ok: true, warning: saved });
}
