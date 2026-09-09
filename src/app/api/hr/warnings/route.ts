import { NextRequest, NextResponse } from "next/server";
import { requireHrManagement } from "@/lib/auth/hr-guard";
import { readSessionFromCookies } from "@/lib/auth/session";
import { analyzeDay } from "@/lib/hr/analyze";
import { loadActiveScheduleEntries, loadActiveTimecardRows } from "@/lib/hr/store";
import { namesMatch } from "@/lib/hr/name-match";
import { readHrMailRouting } from "@/lib/hr/mail-routing-store";
import {
  draftWarningNotice,
  isEligibleForHrNotice,
  isLateForWarning,
  noticeFromDraft,
  warningChatMessageFromDraft,
} from "@/lib/hr/warning-notice";
import { buildWarningNoticePdf, pdfBytesToBase64 } from "@/lib/hr/warning-notice-pdf";
import {
  draftWriteUpNotice,
  requireWriteUpDescription,
  writeUpFromDraft,
} from "@/lib/hr/write-up-notice";
import { buildWriteUpPdf } from "@/lib/hr/write-up-pdf";
import {
  addWarningRemarks,
  findWarningForEmployee,
  findWarningNotice,
  findWriteUpForEmployee,
  listWarningNotices,
  upsertWarningNotice,
  waiveWarningNotice,
  unwaiveWarningNotice,
  upsertAbsenceWaiver,
  removeAbsenceWaiver,
  normalizeWaiverComment,
} from "@/lib/hr/warning-store";
import type { HrWarningNotice, HrWarningRemark } from "@/lib/hr/types";
import { routeLog } from "@/lib/hr/logger";
import { sendHrSmtpMail } from "@/lib/hr/smtp-mail";
import { hrSmtpPassword, readHrNoticeSettings } from "@/lib/hr/notice-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminOnly() {
  return requireHrManagement();
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
    waivedAt: o.waivedAt == null || o.waivedAt === "" ? null : String(o.waivedAt),
    waivedBy: o.waivedBy == null || o.waivedBy === "" ? null : String(o.waivedBy),
    waivedComment: o.waivedComment == null || o.waivedComment === "" ? null : String(o.waivedComment),
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
  routeLog("src/app/api/hr/warnings/route.ts", "GET warnings", { date, employeeName });

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

  const noticeSettings = readHrNoticeSettings();
  const draft = isEligibleForHrNotice(emp)
    ? draftWarningNotice(
        emp,
        { ...readHrMailRouting(), from: noticeSettings.warningFrom },
        noticeSettings.templates,
      )
    : null;
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
  routeLog("src/app/api/hr/warnings/route.ts", "POST warning action", {
    action,
    caseId: body.caseId,
    employeeName: body.employeeName ?? (body.notice as Record<string, unknown> | undefined)?.employeeName,
    date: body.date ?? (body.notice as Record<string, unknown> | undefined)?.date,
  });

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

  if (action === "smtpWarning") {
    const notice = asNotice(body.notice ?? body);
    if (!notice) return NextResponse.json({ error: "Invalid warning notice" }, { status: 400 });
    const rows = loadActiveTimecardRows();
    const schedule = loadActiveScheduleEntries();
    const emp = analyzeDay(notice.date, rows, schedule).find((e) =>
      namesMatch(e.employeeName, notice.employeeName)
    );
    if (!emp || !isEligibleForHrNotice(emp)) {
      return NextResponse.json({ error: "No attendance violation for a warning notice" }, { status: 400 });
    }
    const noticeSettings = readHrNoticeSettings();
    const draft = draftWarningNotice(
      { ...emp, employeeCode: notice.employeeCode ?? emp.employeeCode },
      {
        ...readHrMailRouting(),
        from: noticeSettings.warningFrom,
      },
      noticeSettings.templates,
    );
    await sendHrSmtpMail({
      to: draft.to,
      subject: draft.subject,
      text: draft.text,
      html: draft.html,
      from: noticeSettings.warningFrom,
      user: noticeSettings.writeUpFrom,
      pass: hrSmtpPassword(noticeSettings),
    });
    const saved = upsertWarningNotice(
      noticeFromDraft(draft, { messageId: notice.messageId ?? `smtp:${draft.caseId}` })
    );
    return NextResponse.json({ ok: true, success: true, warning: saved });
  }

  const session = await readSessionFromCookies();
  const actor = session?.name?.trim() || session?.username || null;

  if (action === "waive") {
    const caseId = String(body.caseId ?? "").trim();
    const comment = normalizeWaiverComment(body.comment);
    if (!caseId) {
      return NextResponse.json({ error: "caseId is required" }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json({ error: "A waive note is required" }, { status: 400 });
    }
    const updated = waiveWarningNotice(caseId, actor, comment);
    if (!updated) {
      return NextResponse.json({ error: "Warning notice not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, warning: updated });
  }

  if (action === "unwaive") {
    const caseId = String(body.caseId ?? "").trim();
    if (!caseId) {
      return NextResponse.json({ error: "caseId is required" }, { status: 400 });
    }
    const updated = unwaiveWarningNotice(caseId);
    if (!updated) {
      return NextResponse.json({ error: "Warning notice not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, warning: updated });
  }

  if (action === "waive-absence") {
    const employeeName = String(body.employeeName ?? "").trim();
    const date = String(body.date ?? "").trim();
    const employeeCode = body.employeeCode == null ? null : String(body.employeeCode).trim();
    const comment = normalizeWaiverComment(body.comment);
    if (!employeeName || !date) {
      return NextResponse.json({ error: "employeeName and date are required" }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json({ error: "A waive note is required" }, { status: 400 });
    }
    const waiver = upsertAbsenceWaiver({ employeeName, employeeCode, date, waivedBy: actor, comment });
    return NextResponse.json({ ok: true, absenceWaiver: waiver });
  }

  if (action === "unwaive-absence") {
    const employeeName = String(body.employeeName ?? "").trim();
    const date = String(body.date ?? "").trim();
    const employeeCode = body.employeeCode == null ? null : String(body.employeeCode).trim();
    if (!employeeName || !date) {
      return NextResponse.json({ error: "employeeName and date are required" }, { status: 400 });
    }
    const waiver = removeAbsenceWaiver({ employeeName, employeeCode, date });
    if (!waiver) {
      return NextResponse.json({ error: "Absence waiver not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, absenceWaiver: waiver });
  }

  if (action === "smtpWriteUp") {
    const source = (body.notice && typeof body.notice === "object"
      ? body.notice
      : body) as Record<string, unknown>;
    const employeeName = String(source.employeeName ?? "").trim();
    const date = String(source.date ?? "").trim();
    const description = String(body.description ?? source.description ?? "").trim();
    if (!employeeName || !date) return NextResponse.json({ error: "employeeName and date are required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Write a description before sending the write-up" }, { status: 400 });
    const emp = analyzeDay(date, loadActiveTimecardRows(), loadActiveScheduleEntries()).find((e) => namesMatch(e.employeeName, employeeName));
    if (!emp || !isEligibleForHrNotice(emp)) return NextResponse.json({ error: "No attendance violation for a write-up" }, { status: 400 });
    const settings = readHrNoticeSettings();
    const draft = draftWriteUpNotice({
      ...emp,
      employeeCode: source.employeeCode == null ? emp.employeeCode : String(source.employeeCode),
      store: source.store == null ? emp.store : String(source.store),
    }, description, { ...readHrMailRouting(), from: settings.writeUpFrom });
    const pdfBytes = await buildWriteUpPdf({
      employeeName: draft.employeeName,
      date: draft.date,
      employeeCode: draft.employeeCode,
      jobTitle: draft.jobTitle,
      manager: draft.manager,
      store: draft.store,
      description: draft.description,
      tardiness: isLateForWarning(emp.lateMinutes),
      otherViolation: !isLateForWarning(emp.lateMinutes),
    });
    await sendHrSmtpMail({
      to: draft.to,
      subject: draft.subject,
      text: draft.text,
      html: draft.html,
      from: settings.writeUpFrom,
      user: settings.writeUpFrom,
      pass: hrSmtpPassword(settings),
      attachments: [{ filename: draft.pdfFilename, content: Buffer.from(pdfBytes) }],
    });
    const saved = upsertWarningNotice(writeUpFromDraft(draft, { messageId: `smtp:${draft.caseId}` }));
    return NextResponse.json({ ok: true, success: true, warning: saved, writeUp: saved });
  }

  // Additive for Valliani app chat/mail write-ups. Website still builds PDF client-side.
  if (action === "writeUpAttachment" || action === "writeUpMessage") {
    const employeeName = String(
      (body.notice as Record<string, unknown> | undefined)?.employeeName ??
        body.employeeName ??
        ""
    ).trim();
    const date = String(
      (body.notice as Record<string, unknown> | undefined)?.date ?? body.date ?? ""
    ).trim();
    const descriptionRaw = String(
      body.description ??
        (body.notice as Record<string, unknown> | undefined)?.description ??
        ""
    );
    if (!employeeName || !date) {
      return NextResponse.json(
        { error: "employeeName and date are required" },
        { status: 400 }
      );
    }
    let description: string;
    try {
      description = requireWriteUpDescription(descriptionRaw);
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "Write a description before sending the write-up",
        },
        { status: 400 }
      );
    }

    const rows = loadActiveTimecardRows();
    const schedule = loadActiveScheduleEntries();
    const employees = analyzeDay(date, rows, schedule);
    const emp = employees.find((e) => namesMatch(e.employeeName, employeeName));
    if (!emp) {
      return NextResponse.json({ error: "Employee not found for that date" }, { status: 404 });
    }
    if (!isEligibleForHrNotice(emp)) {
      return NextResponse.json(
        { error: "No attendance violation for a write-up" },
        { status: 400 }
      );
    }

    const existingWriteUp = findWriteUpForEmployee(employeeName, date);
    if (existingWriteUp && body.resend !== true) {
      return NextResponse.json(
        {
          error: "A write-up was already sent for this employee and date",
          writeUp: existingWriteUp,
        },
        { status: 409 }
      );
    }

    const noticeIn = asNotice(body.notice ?? body);
    const draft = draftWriteUpNotice(
      {
        ...emp,
        employeeCode: noticeIn?.employeeCode ?? emp.employeeCode,
        store: noticeIn?.store ?? emp.store,
      },
      description,
      readHrMailRouting()
    );
    const saved = upsertWarningNotice({
      ...writeUpFromDraft(draft, {
        messageId: noticeIn?.messageId ?? `writeup:${draft.caseId}`,
      }),
      to: noticeIn?.to || draft.to,
      from: noticeIn?.from || draft.from,
      remarks: findWarningNotice(draft.caseId)?.remarks ?? [],
    });

    const warning = findWarningForEmployee(employeeName, date);
    if (warning?.waivedAt) {
      unwaiveWarningNotice(warning.caseId);
    }

    const payload: Record<string, unknown> = {
      ok: true,
      success: true,
      notice: saved,
      writeUp: saved,
      message: draft.text,
      subject: draft.subject,
      html: draft.html,
      text: draft.text,
    };

    if (action === "writeUpAttachment") {
      const pdfBytes = await buildWriteUpPdf({
        employeeName: draft.employeeName,
        date: draft.date,
        employeeCode: draft.employeeCode,
        jobTitle: draft.jobTitle,
        manager: draft.manager,
        store: draft.store,
        description: draft.description,
        tardiness: isLateForWarning(emp.lateMinutes),
        otherViolation: !isLateForWarning(emp.lateMinutes),
      });
      payload.pdfBase64 = pdfBytesToBase64(pdfBytes);
      payload.pdfFilename = draft.pdfFilename;
    }

    return NextResponse.json(payload);
  }

  if (action === "chatAttachment" || action === "chatMessage") {
    const notice = asNotice(body.notice ?? body);
    const sendPdf = body.sendPdf === true || body.includePdf === true || action === "chatAttachment";
    if (!notice) {
      return NextResponse.json({ error: "Invalid warning notice" }, { status: 400 });
    }

    const rows = loadActiveTimecardRows();
    const schedule = loadActiveScheduleEntries();
    const employees = analyzeDay(notice.date, rows, schedule);
    const emp = employees.find((e) => namesMatch(e.employeeName, notice.employeeName));
    const noticeSettings = readHrNoticeSettings();
    const draft = emp && isEligibleForHrNotice(emp)
      ? draftWarningNotice(
          {
            ...emp,
            employeeCode: notice.employeeCode ?? emp.employeeCode,
            mail:
              String(notice.mail ?? "").trim() ||
              String(notice.to ?? "").trim() ||
              emp.mail ||
              null,
            userEmail:
              String(notice.userEmail ?? "").trim() || emp.userEmail || null,
          },
          { ...readHrMailRouting(), from: noticeSettings.warningFrom },
          noticeSettings.templates
        )
      : null;
    const saved = upsertWarningNotice({
      ...(draft ? noticeFromDraft(draft, { messageId: `chat:${draft.caseId}` }) : notice),
      to: notice.to || draft?.to || "",
      sentAt: new Date().toISOString(),
      messageId: notice.messageId ?? (draft ? `chat:${draft.caseId}` : `chat:${notice.caseId}`),
      remarks: findWarningNotice(notice.caseId)?.remarks ?? notice.remarks ?? [],
    });

    const payload: Record<string, unknown> = {
      ok: true,
      success: true,
      notice: saved,
      message: draft
        ? warningChatMessageFromDraft(draft)
        : String(body.message || notice.description || notice.subject),
      subject: draft?.subject ?? notice.subject ?? null,
      html: draft?.html ?? null,
      text: draft?.text ?? null,
      to: draft?.to ?? notice.to ?? null,
    };

    if (sendPdf) {
      const source = draft ?? notice;
      const pdfBytes = await buildWarningNoticePdf({
        employeeName: source.employeeName,
        date: source.date,
        employeeCode: source.employeeCode,
        jobTitle: source.jobTitle,
        manager: source.manager,
        lateMinutes: source.lateMinutes,
        description: source.description ?? notice.description ?? "Attendance warning.",
      });
      payload.pdfBase64 = pdfBytesToBase64(pdfBytes);
      payload.pdfFilename = `Employee-Warning-Notice-${String(source.employeeCode || source.employeeName || "employee").replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
    }

    return NextResponse.json(payload);
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
