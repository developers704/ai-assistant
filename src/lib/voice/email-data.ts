import type { Email } from "@/types";
import { getState, setState } from "@/lib/store/server-store";
import { isGoogleConnected, getGoogleTokens } from "@/lib/google/token-store";
import { getAuthenticatedClient } from "@/lib/google/client";
import { fetchGmailInbox } from "@/lib/google/gmail";
import { getGoogleCache, setGoogleCache } from "@/lib/google/cache";
import { sortEmails } from "@/lib/email-utils";
import { withTimeout } from "@/lib/async-utils";
import { v4 as uuidv4 } from "uuid";

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

    const fetched = await withTimeout(
      fetchGmailInbox(client),
      EMAIL_FETCH_TIMEOUT_MS,
      "Gmail fetch"
    );
    const emails = sortEmails(fetched);
    const integration = {
      connected: true as const,
      email: getGoogleTokens()?.email,
    };
    setGoogleCache({
      emails,
      events: cached?.events ?? [],
      contacts: cached?.contacts ?? [],
      integration,
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
  return (
    emails.find((e) => e.needsReply) ||
    emails.find((e) => !e.isRead && (e.isImportant || e.category === "important")) ||
    emails.find((e) => !e.isRead) ||
    emails[0]
  );
}

export interface VoiceEmailDraftResult {
  script: string;
  targetEmail?: { from: string; subject: string; to: string };
  draftPreview?: string;
}

/** Draft reply to the most relevant inbox email (for voice). */
export async function buildVoiceEmailDraft(): Promise<VoiceEmailDraftResult> {
  const { emails } = await getVoiceEmails();
  const state = getState();
  const target = pickEmailForDraft(emails);

  if (!target) {
    return {
      script:
        "I couldn't find an email to draft from. Open your Email page first, then ask me to draft a reply.",
    };
  }

  const firstName = target.from.split(" ")[0] || target.from;
  const subject = target.subject.startsWith("Re:") ? target.subject : `Re: ${target.subject}`;

  const body = `Hi ${firstName},

Thank you for your email regarding "${target.subject}".

I've reviewed the details and will follow up with next steps shortly. Please let me know if you need anything else in the meantime.

Best regards,
${state.user?.name || "Kash Valliani"}
${state.user?.role || "Founder & President"} | ${state.user?.company || "Valliani Jewelers"}`;

  const spoken = `I've drafted a reply to ${target.from} about "${target.subject}". It's on your AI Chat screen now — review it there and say yes when you want to send.`;

  return {
    script: spoken,
    targetEmail: {
      from: target.from,
      subject: target.subject,
      to: target.fromEmail,
    },
    draftPreview: body,
  };
}

export function saveVoiceEmailDraftPending(draft: VoiceEmailDraftResult): void {
  if (!draft.targetEmail || !draft.draftPreview) return;

  const id = uuidv4();
  const subject = draft.targetEmail.subject.startsWith("Re:")
    ? draft.targetEmail.subject
    : `Re: ${draft.targetEmail.subject}`;

  setState((s) => ({
    ...s,
    pendingActions: [
      {
        id,
        type: "email",
        title: `Reply to ${draft.targetEmail!.from}`,
        preview: draft.draftPreview!,
        payload: {
          to: draft.targetEmail!.to,
          subject,
          body: draft.draftPreview,
          to_name: draft.targetEmail!.from,
        },
        createdAt: new Date().toISOString(),
      },
    ],
  }));
}

