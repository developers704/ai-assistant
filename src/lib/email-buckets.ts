import type { Email, InboxBucket } from "@/types";

export type { InboxBucket };
export type MailFolder = "inbox" | "starred" | "sent" | "drafts";

const ASK_RE =
  /\?|\b(please|kindly|can you|could you|would you|let me know|need you to|looking for|confirm|asap|by eod|by end of)\b/i;

/** Calendar / Zoom / Meet / Zoho Meeting style invites & reminders → FYI (not Marketing). */
export function isMeetingOrCalendarMail(
  from: string,
  subject: string,
  body = ""
): boolean {
  const text = `${from} ${subject} ${body}`.toLowerCase();
  return (
    /\b(meeting|calendar|invite|invitation|webinar|zoom|google meet|teams meeting|zohomeeting|zoho meeting|webex|gotomeeting)\b/.test(
      text
    ) ||
    /\b(join meeting|starts in \d+\s*mins?|meeting id|meeting password|add to calendar|ics)\b/.test(
      text
    ) ||
    /calendar-notification|noreply@.*meeting|mailer\.zohomeeting|calendar\.google/.test(text)
  );
}

/** Online orders, receipts, shipping — boss shops a lot. */
export function isPurchasesMail(from: string, subject: string, body = ""): boolean {
  const text = `${from} ${subject} ${body}`.toLowerCase();
  return (
    /\b(order|ordered|purchase|purchased|receipt|invoice|shipped|shipping|delivered|delivery|tracking|parcel|package|refund|payment received|your order|order confirmation|order #|out for delivery)\b/.test(
      text
    ) ||
    /\b(amazon|ebay|etsy|shopify|walmart|target|best buy|apple\.com|store\.|checkout|cart)\b/.test(
      text
    ) ||
    /@(amazon|ebay|etsy|shopify|stripe|paypal|square)\./.test(text)
  );
}

/** Flights, hotels, bookings — boss travels. */
export function isTravelMail(from: string, subject: string, body = ""): boolean {
  if (isMeetingOrCalendarMail(from, subject, body) && !/\b(flight|hotel|itinerary|boarding)\b/i.test(textOf(from, subject, body))) {
    return false;
  }
  const text = textOf(from, subject, body);
  return (
    /\b(flight|flights|airline|boarding pass|itinerary|hotel|booking|reservation|check-in|check in|departure|arrival|airport|airfare|trip|travel|vacation|cruise|rental car|car hire|uber|lyft)\b/.test(
      text
    ) ||
    /\b(expedia|booking\.com|airbnb|hotels\.com|kayak|skyscanner|marriott|hilton|delta|united|american airlines|emirates|qatar|etihad|southwest)\b/.test(
      text
    ) ||
    /@(expedia|booking|airbnb|tripadvisor|hilton|marriott|delta|united|aa\.com)\./.test(text)
  );
}

function textOf(from: string, subject: string, body = ""): string {
  return `${from} ${subject} ${body}`.toLowerCase();
}

export function isLikelyAutomatedMail(from: string, subject: string): boolean {
  const text = `${from} ${subject}`.toLowerCase();
  return (
    /noreply|no-reply|donotreply|mailer-daemon|notification@|notifications@/.test(text) ||
    /order has been received|login details|password reset|verify your email|your receipt|unsubscribe|newsletter|wordpress/.test(
      text
    )
  );
}

/** True promo / newsletter noise — not meeting / purchases / travel. */
export function isMarketingNoise(from: string, subject: string, body = ""): boolean {
  if (isMeetingOrCalendarMail(from, subject, body)) return false;
  if (isPurchasesMail(from, subject, body)) return false;
  if (isTravelMail(from, subject, body)) return false;
  const text = textOf(from, subject, body);
  return (
    /\b(unsubscribe|newsletter|promo|sale|% off|deal of|marketing|campaign|digest)\b/.test(
      text
    ) || /category_promotions/.test(text)
  );
}

function latestBody(email: Email): string {
  const msgs = email.threadMessages?.length ? email.threadMessages : [email];
  const last = msgs[msgs.length - 1];
  return `${last?.subject ?? ""} ${last?.preview ?? ""} ${last?.body ?? ""}`;
}

/**
 * Triage priority:
 * meeting → FYI
 * purchases / travel → Categories
 * marketing → Marketing
 * needs reply → To Respond
 * else FYI
 */
export function deriveInboxBucket(email: Email): InboxBucket {
  const fromBlob = `${email.from} ${email.fromEmail}`;
  const body = latestBody(email);

  if (isMeetingOrCalendarMail(fromBlob, email.subject, body)) {
    return "fyi";
  }

  // Travel before purchases when both match (e.g. hotel receipt) — travel wins for trips.
  if (isTravelMail(fromBlob, email.subject, body)) {
    return "travel";
  }

  if (isPurchasesMail(fromBlob, email.subject, body)) {
    return "purchases";
  }

  if (email.category === "promotional" || isMarketingNoise(fromBlob, email.subject, body)) {
    return "marketing";
  }

  if (isLikelyAutomatedMail(fromBlob, email.subject)) {
    return "fyi";
  }

  if (email.needsReply || ASK_RE.test(body)) {
    return "to_respond";
  }

  return "fyi";
}

export function withInboxBucket(email: Email): Email {
  const inboxBucket = deriveInboxBucket({ ...email, inboxBucket: undefined });
  return {
    ...email,
    inboxBucket,
    needsReply: inboxBucket === "to_respond",
  };
}

export function bucketLabel(bucket: InboxBucket): string {
  switch (bucket) {
    case "to_respond":
      return "To Respond";
    case "fyi":
      return "FYI";
    case "marketing":
      return "Marketing";
    case "purchases":
      return "Purchases";
    case "travel":
      return "Travel";
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
