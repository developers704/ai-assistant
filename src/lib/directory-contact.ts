import type { Contact } from "@/types";

function isIrtizaContact(contact: Contact): boolean {
  const blob = `${contact.name} ${contact.role} ${contact.email ?? ""}`.toLowerCase();
  return /\birtiz[ae]\b/.test(blob);
}

/** Irtiza is IT Head. A synced card titled Manager must not stay that way. */
export function correctDirectoryContact(contact: Contact): Contact {
  if (!isIrtizaContact(contact)) return contact;
  return { ...contact, name: "Irtiza", role: "IT Head" };
}

export function irtizaDedupeKey(contact: Contact): string | null {
  return isIrtizaContact(contact) ? "person:irtiza" : null;
}
