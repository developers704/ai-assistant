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
  HR_WARNING_FROM,
  noticeFromDraft,
} from "./warning-notice";
import { buildWarningNoticePdf, pdfBytesToBase64 } from "./warning-notice-pdf";

export function isWarningMailSessionReady(): { ok: boolean; reason?: string } {
  if (!hasMailSession()) {
    return {
      ok: false,
      reason: "Sign in to E-Mails as umairj@valliani.app, then send the warning notice.",
    };
  }
  const email = getSavedEmail();
  if (email && email !== HR_WARNING_FROM) {
    return {
      ok: false,
      reason: `E-Mails is signed in as ${email}. Switch to ${HR_WARNING_FROM} to send warning notices.`,
    };
  }
  return { ok: true };
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

function isFromWarningMailbox(message: MailMessage): boolean {
  const from = addressEmail(message.from).email.toLowerCase();
  return from === HR_WARNING_FROM.toLowerCase();
}

function remarkBody(message: MailMessage): string {
  const text = message.bodyText?.trim();
  if (text) return text;
  if (message.bodyHtml?.trim()) return htmlToPlain(message.bodyHtml);
  return message.preview?.trim() || "";
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
  const folders = ["Inbox", ALL_MAIL_FOLDER];
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

export async function sendLateWarningNotice(emp: HrEmployeeDay): Promise<HrWarningNotice> {
  const ready = isWarningMailSessionReady();
  if (!ready.ok) throw new Error(ready.reason);
  const draft = draftWarningNotice(emp);
  const pdfBytes = await buildWarningNoticePdf({
    employeeName: draft.employeeName,
    date: draft.date,
    employeeCode: draft.employeeCode,
    jobTitle: draft.jobTitle,
    manager: draft.manager,
    lateMinutes: draft.lateMinutes,
  });
  await sendMail({
    to: [draft.to],
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
  const res = await fetch("/api/hr/warnings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "record", notice }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    warning?: HrWarningNotice;
  };
  if (!res.ok) throw new Error(json.error || "Warning mailed, but saving the record failed");
  return json.warning ?? notice;
}

export async function syncWarningRemarks(caseId: string): Promise<HrWarningNotice | null> {
  const ready = isWarningMailSessionReady();
  if (!ready.ok) throw new Error(ready.reason);
  const messages = await searchCaseMessages(caseId);
  const replies: HrWarningRemark[] = [];
  for (const message of messages) {
    if (isFromWarningMailbox(message)) continue;
    const hydrated = await hydrateIfNeeded(message);
    const remark = mailToRemark(hydrated, caseId);
    if (!remark.body && !remark.fromEmail) continue;
    replies.push(remark);
  }
  const res = await fetch("/api/hr/warnings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remarks", caseId, remarks: replies }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    warning?: HrWarningNotice;
  };
  if (!res.ok) throw new Error(json.error || "Could not save remarks");
  return json.warning ?? null;
}
