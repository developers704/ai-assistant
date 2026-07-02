import OpenAI from "openai";
import type { Email } from "@/types";
import { htmlToPlainText, looksLikeHtml } from "@/lib/email-html";
import { OPENAI_CHAT_MODEL } from "@/lib/openai/config";

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

function emailBodyForDraft(email: Email): string {
  const raw = email.body || email.preview || "";
  const plain = looksLikeHtml(raw) ? htmlToPlainText(raw) : raw;
  return plain.replace(/\s+/g, " ").trim().slice(0, 2000);
}

/** LLM-written reply; falls back to template if OpenAI is unavailable. */
export async function generateSmartEmailReply(
  email: Email,
  signer: EmailSigner
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return buildTemplateReply(email, signer);
  }

  const bodyPlain = emailBodyForDraft(email);
  if (!bodyPlain) {
    return buildTemplateReply(email, signer);
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.4,
      max_tokens: 450,
      messages: [
        {
          role: "system",
          content: `You draft professional executive email replies for ${signer.name}, ${signer.role} at ${signer.company}.
Write plain text only (no markdown, no bullet lists). Warm, concise, confident — 2 to 4 short paragraphs.
Address the sender's specific points from the email. End with a sign-off using exactly:
Best regards,
${signer.name}
${signer.role} | ${signer.company}`,
        },
        {
          role: "user",
          content: `Draft a reply to this email:

From: ${email.from} <${email.fromEmail}>
Subject: ${email.subject}

${bodyPlain}`,
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
