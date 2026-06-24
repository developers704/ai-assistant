import type { Contact } from "@/types";

/** Strip to digits; assume US (+1) when 10 digits. */
export function normalizePhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `1${digits}`;
  return digits;
}

export function formatTelUrl(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    return `tel:${trimmed.replace(/\s/g, "")}`;
  }
  return `tel:+${normalizePhoneDigits(trimmed)}`;
}

export function formatWhatsAppUrl(phone: string): string {
  return `https://wa.me/${normalizePhoneDigits(phone)}`;
}

export function getContactWhatsAppNumber(contact: Contact): string | null {
  return contact.whatsapp?.trim() || contact.phone?.trim() || null;
}

export function getContactPhoneNumber(contact: Contact): string | null {
  return contact.phone?.trim() || contact.whatsapp?.trim() || null;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Open installed WhatsApp app to chat with this number (mobile) or WhatsApp Web (desktop). */
export function openWhatsAppChat(phone: string): void {
  window.location.assign(formatWhatsAppUrl(phone));
}

/** Try to open magicApp (magicJack) — no public dial deep link; launch app + copy number. */
export function tryOpenMagicApp(): void {
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    window.location.href =
      "intent://#Intent;package=com.magicjack;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;end";
    return;
  }
  window.location.href = "magicapp://";
}

export type CallAppMode = "sim" | "magicapp";

export interface OpenCallResult {
  ok: boolean;
  message?: string;
}

/** Place a call via phone SIM (tel:) or magicApp for international. */
export async function openPhoneCall(
  phone: string,
  mode: CallAppMode = "sim"
): Promise<OpenCallResult> {
  const display = phone.trim().startsWith("+") ? phone.trim() : `+${normalizePhoneDigits(phone)}`;

  if (mode === "sim") {
    window.location.assign(formatTelUrl(phone));
    return { ok: true };
  }

  await copyToClipboard(display);
  tryOpenMagicApp();

  return {
    ok: true,
    message: `Opening magicApp — number ${display} copied. Paste or pick from contacts to dial internationally.`,
  };
}

export function openEmailDraft(email: string, subject?: string): void {
  const params = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  window.location.assign(`mailto:${email}${params}`);
}
