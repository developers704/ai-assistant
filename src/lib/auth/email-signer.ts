import { readSessionFromCookies } from "@/lib/auth/session";
import { findAuthUser } from "@/lib/auth/users";
import type { EmailSigner } from "@/lib/voice/email-draft";

const COMPANY = "Valliani Jewelers";

/**
 * Email / AI-draft signature for the logged-in app user
 * (kash, ross, adeel, shaun, rozina, aj — not the mailbox IMAP login).
 */
export async function resolveEmailSignerFromSession(): Promise<EmailSigner> {
  const session = await readSessionFromCookies();
  if (!session) {
    return {
      name: "Kash Valliani",
      role: "Founder & President",
      company: COMPANY,
    };
  }

  const live = findAuthUser(session.username);
  const name = (live?.name ?? session.name ?? session.username).trim();
  // Rozina has empty title on purpose — no District Manager line
  const role = (live?.title ?? session.title ?? "").trim();

  return {
    name: name || session.username,
    role,
    company: COMPANY,
  };
}
