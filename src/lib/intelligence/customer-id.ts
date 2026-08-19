import type { IntelligenceRow } from "@/lib/intelligence/types";

function normEmail(raw: string): string {
  const e = raw.trim().toLowerCase();
  if (!e || /^na@/i.test(e) || e === "n/a") return "";
  return e;
}

function normPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

/** Stable customer key for retention / demographics (email → phone → name+zip). */
export function customerKey(row: IntelligenceRow): string {
  const email = normEmail(row.customerEmail);
  if (email) return `e:${email}`;
  const phone = normPhone(row.customerPhone);
  if (phone) return `p:${phone}`;
  const name = `${row.customerFirstName} ${row.customerLastName}`.trim().toUpperCase();
  const zip = row.customerZip.trim();
  if (name && zip) return `n:${name}|${zip}`;
  if (name) return `n:${name}`;
  return "";
}

export function isWalkInCustomer(row: IntelligenceRow): boolean {
  const name = `${row.customerFirstName} ${row.customerLastName}`.trim().toUpperCase();
  return /WALK/.test(name);
}
