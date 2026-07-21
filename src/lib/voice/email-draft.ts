import OpenAI from "openai";
import type { Email } from "@/types";
import { htmlToPlainText, looksLikeHtml } from "@/lib/email-html";
import { OPENAI_CHAT_MODEL, chatCompletionLimits } from "@/lib/openai/config";

export interface EmailSigner {
  name: string;
  role: string;
  company: string;
}

function buildTemplateReply(email: Email, signer: EmailSigner): string {
  const firstName = email.from.split(" ")[0] || email.from;
  return `Hi ${firstName},

Thank you for your email regarding "${email.subject}".

I've reviewed the details and will follow up with next steps shortly. Please let me know if you need anything else in the meantime.

Best regards,
${signer.name}
${signer.role} | ${signer.company}`;
}

function plainBody(email: Email, max = 1800): string {
  const raw = email.body || email.preview || "";
  const plain = looksLikeHtml(raw) ? htmlToPlainText(raw) : raw;
  return plain.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Build chronological thread transcript for the LLM (oldest → newest). */
export function formatThreadForDraft(email: Email): string {
  const messages =
    email.threadMessages && email.threadMessages.length > 0
      ? email.threadMessages
      : [email];

  return messages
    .map((m, i) => {
      const when = m.receivedAt
        ? new Date(m.receivedAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "";
      const body = plainBody(m, 1200);
      return `--- Message ${i + 1} of ${messages.length} (${when}) ---
From: ${m.from} <${m.fromEmail}>
Subject: ${m.subject}

${body}`;
    })
    .join("\n\n");
}

/** LLM-written reply using full thread context; falls back to template if OpenAI is unavailable. */
export async function generateSmartEmailReply(
  email: Email,
  signer: EmailSigner
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return buildTemplateReply(email, signer);
  }

  const threadText = formatThreadForDraft(email);
  if (!threadText.trim()) {
    return buildTemplateReply(email, signer);
  }

  const messageCount = email.threadMessages?.length ?? 1;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      ...chatCompletionLimits(OPENAI_CHAT_MODEL, {
        temperature: 0.4,
        maxTokens: 550,
      }),
      messages: [
        {
          role: "system",
          content: `You draft professional executive email replies for ${signer.name}, ${signer.role} at ${signer.company}.
You receive a FULL email thread (${messageCount} message${messageCount === 1 ? "" : "s"}), oldest to newest.
Read the entire conversation before drafting. Address open questions, prior commitments, and the latest message.
Write plain text only (no markdown, no bullet lists). Warm, concise, confident — 2 to 4 short paragraphs.
Do not invent facts that are not in the thread. End with a sign-off using exactly:
Best regards,
${signer.name}
${signer.role} | ${signer.company}`,
        },
        {
          role: "user",
          content: `Draft a reply that continues this email thread. Reply to the latest message from ${email.from}.

Thread subject: ${email.subject}

${threadText}`,
        },
      ],
    });

    const draft = completion.choices[0]?.message?.content?.trim();
    if (!draft) return buildTemplateReply(email, signer);
    return draft;
  } catch (err) {
    console.warn("Smart email draft failed, using template:", err);
    return buildTemplateReply(email, signer);
  }
}
