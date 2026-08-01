import OpenAI from "openai";
import type { Email } from "@/types";
import { htmlToPlainText, looksLikeHtml } from "@/lib/email-html";
import { OPENAI_CHAT_MODEL, chatCompletionLimits } from "@/lib/openai/config";

export interface EmailSigner {
  name: string;
  role: string;
  company: string;
}

export type DraftMode = "reply" | "followup" | "rewrite" | "polish";
export type RewriteTone = "shorter" | "formal" | "casual" | "regenerate";

function buildTemplateCompose(signer: EmailSigner, rough: string): string {
  const cleaned = rough.replace(/\s+/g, " ").trim() || "Please see the note below.";
  return `Hello,

${cleaned}

Best regards,
${signer.name}
${signer.role} | ${signer.company}`;
}

function titleCaseSubject(topic: string): string {
  const t = topic.replace(/\s+/g, " ").trim();
  if (!t) return "Quick note";
  const short = t.length > 72 ? `${t.slice(0, 69).trim()}…` : t;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function buildTemplateComposePair(
  signer: EmailSigner,
  toName: string,
  topic: string
): { subject: string; body: string } {
  const first = toName.split(/\s+/)[0] || toName || "there";
  const subject = titleCaseSubject(topic);
  const body = `Hi ${first},

I wanted to let you know that ${topic.replace(/^(to\s+)/i, "").trim()}.

Best regards,
${signer.name}
${signer.role} | ${signer.company}`;
  return { subject, body };
}

/** New outbound email from a spoken/typed topic (not a reply thread). */
export async function generateComposeEmail(
  signer: EmailSigner,
  opts: {
    to: string;
    toName?: string;
    topic: string;
    styleCard?: string;
  }
): Promise<{ subject: string; body: string }> {
  const topic = opts.topic.replace(/\s+/g, " ").trim();
  const toName = opts.toName?.trim() || opts.to;
  const fallback = buildTemplateComposePair(signer, toName, topic || "following up");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE") || !topic) {
    return fallback;
  }

  const style =
    opts.styleCard?.trim() ||
    "Warm, concise, confident. Match a senior jewelry-retail executive voice.";

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      ...chatCompletionLimits(OPENAI_CHAT_MODEL, {
        temperature: 0.4,
        maxTokens: 500,
      }),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write new outbound emails for ${signer.name}, ${signer.role} at ${signer.company}.
Return JSON only: {"subject":"...","body":"..."}.
Plain text body (no markdown). Short subject. Natural sign-off with name (and role/company if it fits).
Do not invent facts beyond the user's topic. STYLE GUIDE:
${style}`,
        },
        {
          role: "user",
          content: `To: ${toName} <${opts.to}>
Topic / intent from user:
${topic}

Write a professional email that conveys this.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { subject?: string; body?: string };
    const subject = parsed.subject?.trim();
    const body = parsed.body?.trim();
    if (!subject || !body) return fallback;
    return { subject, body };
  } catch (err) {
    console.warn("Compose email generation failed, using template:", err);
    return fallback;
  }
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
    /** Recipient line for new compose polish */
    recipients?: string;
  }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const mode = options?.mode ?? "reply";
  const rough = options?.existingDraft?.trim() || "";

  if (!apiKey || apiKey.includes("REPLACE")) {
    if (mode === "polish" || (mode === "rewrite" && rough)) {
      return buildTemplateCompose(signer, rough);
    }
    return buildTemplateReply(email, signer);
  }

  const threadText = formatThreadForDraft(email);
  const messageCount = email.threadMessages?.length ?? 1;
  const style =
    options?.styleCard?.trim() ||
    "Warm, concise, confident. Match a senior jewelry-retail executive voice.";

  let userPrompt = "";
  let systemExtra = `You draft email replies for ${signer.name}, ${signer.role} at ${signer.company}.
You receive a FULL email thread (${messageCount} message${messageCount === 1 ? "" : "s"}), oldest to newest.
Read the entire conversation before drafting. Address open questions and the latest message.
Write plain text only (no markdown, no bullet lists unless the thread clearly uses them).
STYLE GUIDE:
${style}
Do not invent facts that are not in the thread. End with a natural sign-off that matches the style (include name; role/company if that matches their sent style).`;

  if (mode === "polish" && rough) {
    systemExtra = `You polish outgoing emails for ${signer.name}, ${signer.role} at ${signer.company}.
The user typed a hurried / informal draft. Rewrite it into a clear, professional, well-structured email.
Fix spelling and grammar. Keep the same intent, requests, and facts — do not invent new commitments or details.
Write plain text only (no markdown). Use short paragraphs. End with a natural sign-off matching this STYLE GUIDE:
${style}`;
    userPrompt = `Paraphrase this rough draft into a professional email.

Subject: ${email.subject || "(no subject)"}
To: ${options?.recipients || email.to || email.fromEmail || ""}

Rough draft:
${rough}`;
  } else if (mode === "followup") {
    if (!threadText.trim()) return buildTemplateReply(email, signer);
    userPrompt = `Draft a polite FOLLOW-UP for this thread (no reply yet / waiting on them). Keep it short.

Thread subject: ${email.subject}

${threadText}`;
  } else if (mode === "rewrite" && rough) {
    userPrompt = `${rewriteInstruction(options?.rewriteTone)}

Current draft:
${rough}

${threadText.trim() ? `Thread subject: ${email.subject}\n\n${threadText}` : `Subject: ${email.subject || "(no subject)"}`}`;
    if (!threadText.trim()) {
      systemExtra = `You rewrite outgoing emails for ${signer.name}, ${signer.role} at ${signer.company}.
Write plain text only. STYLE GUIDE:
${style}
Keep facts; end with a natural sign-off.`;
    }
  } else {
    if (!threadText.trim()) return buildTemplateReply(email, signer);
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
        { role: "system", content: systemExtra },
        { role: "user", content: userPrompt },
      ],
    });

    const draft = completion.choices[0]?.message?.content?.trim();
    if (!draft) {
      if (mode === "polish" || mode === "rewrite") {
        return buildTemplateCompose(signer, rough);
      }
      return buildTemplateReply(email, signer);
    }
    return draft;
  } catch (err) {
    console.warn("Smart email draft failed, using template:", err);
    if (mode === "polish" || mode === "rewrite") {
      return buildTemplateCompose(signer, rough);
    }
    return buildTemplateReply(email, signer);
  }
}
