import {
  getMessage,
  getMessagePage,
  sendMail,
} from "@/lib/valliani-mail/api";
import { htmlToPlain } from "@/lib/valliani-mail/compose-html";
import { getSavedEmail, hasMailSession } from "@/lib/valliani-mail/session";
import { ALL_MAIL_FOLDER, type MailMessage } from "@/lib/valliani-mail/types";
import type { HrEmployeeDay, HrWarningNotice, HrWarningRemark } from "./types";
import {
  draftWarningNotice,
  extractWarningCaseId,
  HR_WARNING_TO,
  isLateForWarning,
  noticeFromDraft,
} from "./warning-notice";
import { buildWarningNoticePdf, pdfBytesToBase64 } from "./warning-notice-pdf";
import { draftWriteUpNotice, writeUpFromDraft } from "./write-up-notice";
import { buildWriteUpPdf } from "./write-up-pdf";
import { replySubjectForThread, stripQuotedReply } from "./remark-text";
import {
  defaultHrMailRouting,
  normalizeHrMailRouting,
  parseHrMailAddresses,
  type HrMailRouting,
} from "./mail-routing";

async function loadHrMailRouting(): Promise<HrMailRouting> {
  try {
    const res = await fetch("/api/hr/mail-routing", { cache: "no-store" });
    if (!res.ok) return defaultHrMailRouting();
    return normalizeHrMailRouting(await res.json());
  } catch {
    return defaultHrMailRouting();
  }
}

export async function isWarningMailSessionReady(): Promise<{
  ok: boolean;
  reason?: string;
  routing: HrMailRouting;
}> {
  const routing = await loadHrMailRouting();
  if (!hasMailSession()) {
    return {
      ok: false,
      routing,
      reason: `Sign in to E-Mails as ${routing.from}, then send.`,
    };
  }
  const email = getSavedEmail();
  if (email && email.toLowerCase() !== routing.from.toLowerCase()) {
    return {
      ok: false,
      routing,
      reason: `E-Mails is signed in as ${email}. Switch to ${routing.from} to send HR notices.`,
    };
  }
  return { ok: true, routing };
}

function addressEmail(list: { address?: string; name?: string }[] | undefined): {
  email: string;
  name: string;
} {
  const first = list?.[0];
  return {
    email: (first?.address ?? "").trim(),
    name: (first?.name ?? "").trim(),
  };
}

function isFromWarningMailbox(message: MailMessage, fromEmail: string): boolean {
  const from = addressEmail(message.from).email.toLowerCase();
  return from === fromEmail.trim().toLowerCase();
}

function remarkBody(message: MailMessage): string {
  const text = message.bodyText?.trim();
  const raw = text
    ? text
    : message.bodyHtml?.trim()
      ? htmlToPlain(message.bodyHtml)
      : message.preview?.trim() || "";
  return stripQuotedReply(raw);
}

function isOriginalWarningMail(
  message: MailMessage,
  caseId: string,
  fromEmail: string
): boolean {
  if (!isFromWarningMailbox(message, fromEmail)) return false;
  if (/^\s*re\s*:/i.test(message.subject || "")) return false;
  if (message.inReplyTo?.trim()) return false;
  return extractWarningCaseId(message.subject) === caseId.toUpperCase();
}

export function mailToRemark(message: MailMessage, caseId: string): HrWarningRemark {
  const from = addressEmail(message.from);
  const messageId = message.messageId?.trim() || `${message.sourceFolder}:${message.uid}`;
  return {
    id: `${caseId}:${messageId}`,
    fromName: from.name,
    fromEmail: from.email,
    sentAt: message.date || new Date().toISOString(),
    subject: message.subject || "",
    body: remarkBody(message),
    messageId,
    uid: message.uid,
  };
}

async function hydrateIfNeeded(message: MailMessage): Promise<MailMessage> {
  if (message.bodyText?.trim() || message.bodyHtml?.trim()) return message;
  if (!message.uid || !message.sourceFolder) return message;
  try {
    return await getMessage({ folder: message.sourceFolder, uid: message.uid });
  } catch {
    return message;
  }
}

async function searchCaseMessages(caseId: string): Promise<MailMessage[]> {
  const folders = ["Inbox", "Sent", "Sent Mails", ALL_MAIL_FOLDER];
  const byKey = new Map<string, MailMessage>();
  for (const folder of folders) {
    try {
      const page = await getMessagePage({
        folder,
        search: caseId,
        limit: 50,
        offset: 0,
      });
      for (const message of page.messages) {
        const found = extractWarningCaseId(message.subject);
        if (found !== caseId.toUpperCase()) continue;
        const key = message.messageId?.trim() || `${message.sourceFolder}:${message.uid}`;
        if (!byKey.has(key)) byKey.set(key, message);
      }
    } catch {
      /* folder may be missing */
    }
  }
  return [...byKey.values()];
}

function sortOldestFirst(messages: MailMessage[]): MailMessage[] {
  return [...messages].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

function replyRecipient(
  notice: HrWarningNotice,
  thread: MailMessage[],
  routing: HrMailRouting
): string[] {
  const inbound = [...thread].reverse().find((m) => !isFromWarningMailbox(m, routing.from));
  const email = addressEmail(inbound?.from).email;
  if (email) return [email];
  const stored = parseHrMailAddresses(notice.to);
  if (stored.length) return stored;
  return routing.to.length ? routing.to : [HR_WARNING_TO];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function persistRemarks(
  caseId: string,
  remarks: HrWarningRemark[]
): Promise<HrWarningNotice | null> {
  const res = await fetch("/api/hr/warnings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remarks", caseId, remarks }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    warning?: HrWarningNotice;
  };
  if (!res.ok) throw new Error(json.error || "Could not save remarks");
  return json.warning ?? null;
}

export async function sendLateWarningNotice(emp: HrEmployeeDay): Promise<HrWarningNotice> {
  const ready = await isWarningMailSessionReady();
  if (!ready.ok) throw new Error(ready.reason);
  const draft = draftWarningNotice(emp, ready.routing);
  const pdfBytes = await buildWarningNoticePdf({
    employeeName: draft.employeeName,
    date: draft.date,
    employeeCode: draft.employeeCode,
    jobTitle: draft.jobTitle,
    manager: draft.manager,
    lateMinutes: draft.lateMinutes,
    description: draft.description,
  });
  await sendMail({
    to: ready.routing.to,
    subject: draft.subject,
    body: draft.text,
    html: draft.html,
    attachments: [
      {
        filename: draft.pdfFilename,
        contentType: "application/pdf",
        contentBase64: pdfBytesToBase64(pdfBytes),
        size: pdfBytes.byteLength,
      },
    ],
  });
  const notice = noticeFromDraft(draft);
  return persistNotice(notice);
}

export async function sendWriteUpNotice(
  emp: HrEmployeeDay,
  description: string
): Promise<HrWarningNotice> {
  const ready = await isWarningMailSessionReady();
  if (!ready.ok) throw new Error(ready.reason);
  const draft = draftWriteUpNotice(emp, description, ready.routing);
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
  await sendMail({
    to: ready.routing.to,
    subject: draft.subject,
    body: draft.text,
    html: draft.html,
    attachments: [
      {
        filename: draft.pdfFilename,
        contentType: "application/pdf",
        contentBase64: pdfBytesToBase64(pdfBytes),
        size: pdfBytes.byteLength,
      },
    ],
  });
  return persistNotice(writeUpFromDraft(draft));
}

async function persistNotice(notice: HrWarningNotice): Promise<HrWarningNotice> {
  const res = await fetch("/api/hr/warnings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "record", notice }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    warning?: HrWarningNotice;
  };
  if (!res.ok) throw new Error(json.error || "Notice mailed, but saving the record failed");
  return json.warning ?? notice;
}

export async function syncWarningRemarks(caseId: string): Promise<HrWarningNotice | null> {
  const ready = await isWarningMailSessionReady();
  if (!ready.ok) throw new Error(ready.reason);
  const messages = await searchCaseMessages(caseId);
  const replies: HrWarningRemark[] = [];
  for (const message of messages) {
    if (isOriginalWarningMail(message, caseId, ready.routing.from)) continue;
    const hydrated = await hydrateIfNeeded(message);
    const remark = mailToRemark(hydrated, caseId);
    if (!remark.body) continue;
    replies.push(remark);
  }
  return persistRemarks(caseId, replies);
}

export async function replyOnWarningThread(
  notice: HrWarningNotice,
  body: string
): Promise<HrWarningNotice | null> {
  const ready = await isWarningMailSessionReady();
  if (!ready.ok) throw new Error(ready.reason);
  const trimmed = stripQuotedReply(body);
  if (!trimmed) throw new Error("Write a reply first");

  const thread = await searchCaseMessages(notice.caseId);
  const target = sortOldestFirst(thread).at(-1) ?? null;
  const to = replyRecipient(notice, thread, ready.routing);
  const subject = replySubjectForThread(notice.subject);
  const html = `<p>${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>`;

  await sendMail({
    to,
    subject,
    body: trimmed,
    html,
    composeMode: "reply",
    replyToUid: target && target.uid > 0 ? target.uid : undefined,
    replyToFolder: target?.sourceFolder || undefined,
    inReplyTo: target?.messageId || undefined,
    references: [
      ...(target?.references ?? []),
      target?.messageId,
      notice.messageId,
    ].filter((id): id is string => Boolean(id)),
  });

  const remark: HrWarningRemark = {
    id: `${notice.caseId}:hr-${Date.now()}`,
    fromName: "Umair",
    fromEmail: ready.routing.from,
    sentAt: new Date().toISOString(),
    subject,
    body: trimmed,
    messageId: `hr-${Date.now()}`,
    uid: 0,
  };
  return persistRemarks(notice.caseId, [remark]);
}
