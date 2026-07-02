import type { Email } from "@/types";
import { getState } from "@/lib/store/server-store";
import { getUiContext } from "@/lib/store/ui-context";
import { isGoogleConnected, getGoogleTokens } from "@/lib/google/token-store";
import { getAuthenticatedClient } from "@/lib/google/client";
import { fetchGmailInbox } from "@/lib/google/gmail";
import { getGoogleCache, setGoogleCache } from "@/lib/google/cache";
import { sortEmails } from "@/lib/email-utils";
import { findEmailByContext, parseReplyTargetFromMessage } from "@/lib/email-utils";
import { withTimeout } from "@/lib/async-utils";
import { generateSmartEmailReply } from "@/lib/voice/email-draft";
import { createPendingAction, savePendingAction } from "@/lib/actions/confirmation";
import type { PendingAction } from "@/types";

const EMAIL_FETCH_TIMEOUT_MS = 10000;

/** Real Gmail when connected — never demo mockEmails. */
export async function getVoiceEmails(): Promise<{
  emails: Email[];
  googleConnected: boolean;
  source: "google" | "google-cache" | "demo" | "empty";
}> {
  const googleConnected = isGoogleConnected();

  if (!googleConnected) {
    return {
      emails: sortEmails(getState().emails),
      googleConnected: false,
      source: "demo",
    };
  }

  const cached = getGoogleCache();
  if (cached?.emails?.length) {
    return {
      emails: sortEmails(cached.emails),
      googleConnected: true,
      source: "google-cache",
    };
  }

  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      return { emails: [], googleConnected: true, source: "empty" };
    }

    const page = await withTimeout(
      fetchGmailInbox(client, { maxResults: 25 }),
      EMAIL_FETCH_TIMEOUT_MS,
      "Gmail fetch"
    );
    const emails = sortEmails(page.emails);
    const integration = {
      connected: true as const,
      email: getGoogleTokens()?.email,
      gmailNextPageToken: page.nextPageToken,
      gmailHasMore: !!page.nextPageToken,
    };
    setGoogleCache({
      emails,
      events: cached?.events ?? [],
      contacts: cached?.contacts ?? [],
      integration,
      gmailNextPageToken: page.nextPageToken,
    });

    return { emails, googleConnected: true, source: "google" };
  } catch (err) {
    console.warn("Voice email fetch failed:", err);
    return { emails: [], googleConnected: true, source: "empty" };
  }
}

/** Short spoken inbox summary (max ~3 sentences). */
export function buildEmailVoiceScript(emails: Email[]): string {
  if (emails.length === 0) {
    return "I couldn't load your inbox right now. Try opening the Email page and ask again.";
  }

  const urgent = emails.filter((e) => e.category === "urgent");
  const needsReply = emails.filter((e) => e.needsReply);
  const important = emails.filter(
    (e) => (e.isImportant || e.category === "important") && e.category !== "urgent"
  );
  const unread = emails.filter((e) => !e.isRead);

  const parts: string[] = [
    `You have ${unread.length} unread out of ${emails.length} emails in your inbox.`,
  ];

  if (urgent.length > 0) {
    parts.push(`Most urgent: ${urgent[0].from} — ${urgent[0].subject}.`);
  } else if (needsReply.length > 0) {
    parts.push(`Needs your reply: ${needsReply[0].from} — ${needsReply[0].subject}.`);
  } else if (important.length > 0) {
    parts.push(`Important: ${important[0].from} — ${important[0].subject}.`);
  } else if (unread.length > 0) {
    parts.push(`Latest unread from ${unread[0].from}: ${unread[0].subject}.`);
  } else {
    parts.push("No urgent items — your inbox looks clear.");
  }

  return parts.slice(0, 3).join(" ");
}

function pickEmailForDraft(emails: Email[]): Email | undefined {
  const selectedId = getUiContext().selectedEmailId;
  if (selectedId) {
    const selected = emails.find((e) => e.id === selectedId);
    if (selected) return selected;
  }
  return (
    emails.find((e) => e.needsReply) ||
    emails.find((e) => !e.isRead && (e.isImportant || e.category === "important")) ||
    emails.find((e) => !e.isRead) ||
    emails[0]
  );
}

export interface VoiceEmailDraftResult {
  script: string;
  targetEmail?: {
    id: string;
    from: string;
    subject: string;
    to: string;
    threadId?: string;
  };
  draftPreview?: string;
  pendingAction?: PendingAction;
}

/** Draft reply to the most relevant inbox email (voice + chat). */
export async function buildVoiceEmailDraft(hints?: {
  userMessage?: string;
  fromHint?: string;
  subjectHint?: string;
  source?: "voice" | "chat";
}): Promise<VoiceEmailDraftResult> {
  const { emails } = await getVoiceEmails();
  const state = getState();

  let target = pickEmailForDraft(emails);

  if (hints?.userMessage) {
    const parsed = parseReplyTargetFromMessage(hints.userMessage);
    const matched = findEmailByContext(
      emails,
      hints.fromHint ?? parsed.from,
      hints.subjectHint ?? parsed.subject
    );
    if (matched) target = matched;
  } else if (hints?.fromHint || hints?.subjectHint) {
    const matched = findEmailByContext(emails, hints.fromHint, hints.subjectHint);
    if (matched) target = matched;
  }

  if (!target) {
    return {
      script:
        "I couldn't find an email to draft from. Open your Email page, select the message, then ask me to draft a reply.",
    };
  }

  const body = await generateSmartEmailReply(target, {
    name: state.user?.name || "Kash Valliani",
    role: state.user?.role || "Founder & President",
    company: state.user?.company || "Valliani Jewelers",
  });

  const pending = saveVoiceEmailDraftPending(
    {
      script: "",
      targetEmail: {
        id: target.id,
        from: target.from,
        subject: target.subject,
        to: target.fromEmail,
      },
      draftPreview: body,
    },
    hints?.source ?? "chat"
  );

  const script = pending
    ? `I've drafted a reply to **${target.from}** about "${target.subject}". Review the draft below and tap **Send email** when you're ready.`
    : `I couldn't save the draft. Please try again from the Email page.`;

  return {
    script,
    targetEmail: {
      id: target.id,
      from: target.from,
      subject: target.subject,
      to: target.fromEmail,
    },
    draftPreview: body,
    pendingAction: pending ?? undefined,
  };
}

export function saveVoiceEmailDraftPending(
  draft: VoiceEmailDraftResult,
  source: "voice" | "chat" = "chat"
): PendingAction | null {
  if (!draft.targetEmail || !draft.draftPreview) return null;

  const subject = draft.targetEmail.subject.startsWith("Re:")
    ? draft.targetEmail.subject
    : `Re: ${draft.targetEmail.subject}`;

  const pending = createPendingAction({
    type: "email",
    title: `Reply to ${draft.targetEmail.from}`,
    summary: `Reply to ${draft.targetEmail.from} about "${draft.targetEmail.subject}"`,
    preview: draft.draftPreview,
    payload: {
      to: draft.targetEmail.to,
      subject,
      body: draft.draftPreview,
      to_name: draft.targetEmail.from,
      inReplyTo: draft.targetEmail.id,
      threadId: draft.targetEmail.threadId,
    },
    toolName: "send_email_reply",
    source,
    riskLevel: "confirmation_required",
    confirmText: "Send email",
  });

  savePendingAction(pending);
  return pending;
}

