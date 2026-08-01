import OpenAI from "openai";
import type { Email } from "@/types";
import { htmlToPlainText, looksLikeHtml } from "@/lib/email-html";
import { OPENAI_CHAT_MODEL, chatCompletionLimits } from "@/lib/openai/config";

export interface EmailSigner {
  name: string;
  role: string;
  company: string;
}

export type DraftMode = "reply" | "followup" | "rewrite";
export type RewriteTone = "shorter" | "formal" | "casual" | "regenerate";

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

/** Compact style notes from recent sent mail. */
export function buildStyleCardFromSent(snippets: string[]): string {
  if (!snippets.length) {
    return "Warm, concise, professional. Prefer short paragraphs. Sign off with Best regards.";
  }
  const sample = snippets.slice(0, 8).join("\n\n---\n\n").slice(0, 3500);
  return `Match the writer's tone from these recent SENT emails (formality, greetings, sign-offs, length):\n\n${sample}`;
}

function rewriteInstruction(tone?: RewriteTone): string {
  switch (tone) {
    case "shorter":
      return "Rewrite shorter: half the length, keep the same meaning and sign-off.";
    case "formal":
      return "Rewrite more formal and polished; keep facts and sign-off.";
    case "casual":
      return "Rewrite warmer and more casual; keep facts and sign-off.";
    default:
      return "Write a fresh alternative draft with the same intent.";
  }
}

export async function generateSmartEmailReply(
  email: Email,
  signer: EmailSigner,
  options?: {
    mode?: DraftMode;
    rewriteTone?: RewriteTone;
    existingDraft?: string;
    styleCard?: string;
  }
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
  const mode = options?.mode ?? "reply";
  const style =
    options?.styleCard?.trim() ||
    "Warm, concise, confident. Match a senior jewelry-retail executive voice.";

  let userPrompt = "";
  if (mode === "followup") {
    userPrompt = `Draft a polite FOLLOW-UP for this thread (no reply yet / waiting on them). Keep it short.

Thread subject: ${email.subject}

${threadText}`;
  } else if (mode === "rewrite" && options?.existingDraft?.trim()) {
    userPrompt = `${rewriteInstruction(options.rewriteTone)}

Current draft:
${options.existingDraft}

Thread subject: ${email.subject}

${threadText}`;
  } else {
    userPrompt = `Draft a reply that continues this email thread. Reply to the latest message from ${email.from}.

Thread subject: ${email.subject}

${threadText}`;
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      ...chatCompletionLimits(OPENAI_CHAT_MODEL, {
        temperature: 0.45,
        maxTokens: 550,
      }),
      messages: [
        {
          role: "system",
          content: `You draft email replies for ${signer.name}, ${signer.role} at ${signer.company}.
You receive a FULL email thread (${messageCount} message${messageCount === 1 ? "" : "s"}), oldest to newest.
Read the entire conversation before drafting. Address open questions and the latest message.
Write plain text only (no markdown, no bullet lists unless the thread clearly uses them).
STYLE GUIDE:
${style}
Do not invent facts that are not in the thread. End with a natural sign-off that matches the style (include name; role/company if that matches their sent style).`,
        },
        { role: "user", content: userPrompt },
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
