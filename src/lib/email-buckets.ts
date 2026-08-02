import type { Email, InboxBucket } from "@/types";

export type { InboxBucket };
export type MailFolder = "inbox" | "starred" | "sent" | "drafts";

const ASK_RE =
  /\?|\b(please|kindly|can you|could you|would you|let me know|need you to|looking for|confirm|asap|by eod|by end of)\b/i;

const WEEKDAY_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/i;

function textOf(from: string, subject: string, body = ""): string {
  return `${from} ${subject} ${body}`.toLowerCase();
}

function attachmentNamesOf(email: Email): string[] {
  const names: string[] = [];
  for (const a of email.attachments ?? []) {
    if (a.filename) names.push(a.filename);
  }
  for (const m of email.threadMessages ?? []) {
    for (const a of m.attachments ?? []) {
      if (a.filename) names.push(a.filename);
    }
  }
  return names;
}

/** Full thread text for meeting detection (invite often not in the latest reply). */
function threadTextForMeeting(email: Email): string {
  const msgs = email.threadMessages?.length ? email.threadMessages : [email];
  return msgs
    .map((m) => `${m.from} ${m.fromEmail} ${m.subject} ${m.preview} ${m.body}`)
    .join("\n")
    .slice(0, 10_000);
}

/**
 * Calendar / Zoom / Meet / Zoho invites → Meeting.
 * Tight signals only — bare "invite"/"meeting" in marketing must not match.
 */
export function isMeetingOrCalendarMail(
  from: string,
  subject: string,
  body = "",
  attachmentNames: string[] = []
): boolean {
  const files = attachmentNames.join(" ").toLowerCase();
  if (/\.ics\b/.test(files)) return true;

  const fromL = from.toLowerCase();
  const subjectL = subject.toLowerCase();
  const blob = textOf(from, subject, body);

  // Known calendar / conferencing senders
  if (
    /zohomeeting|mailer\.zohomeeting|calendar-notification@|calendar\.google|invite\.ics/.test(
      blob
    ) ||
    /@(zoom\.us|gotomeeting\.com|webex\.com|teams\.microsoft\.com)/.test(fromL) ||
    /\b(zoho meeting|zoom\.us|google meet|microsoft teams|webex)\b/.test(fromL)
  ) {
    return true;
  }

  // Subject patterns used by Zoho / Google / Outlook
  if (
    /^\s*(invitation|invite|reminder)\s*[-–:]/i.test(subject) ||
    /\b(meeting invitation|calendar invite|invited you to (a )?meeting|join (the )?meeting|meeting starts in)\b/i.test(
      subject
    ) ||
    (/\bmeeting\b/i.test(subject) &&
      (WEEKDAY_RE.test(subject) ||
        /\b\d{1,2}:\d{2}\b/.test(subject) ||
        /\b(am|pm)\b/i.test(subject)))
  ) {
    return true;
  }

  // Strong body cues (conferencing UI copy)
  if (
    /\b(join meeting|meeting id\b|meeting password|add to calendar|starts in \d+\s*mins?)\b/i.test(
      body
    ) ||
    /\b(join zoom|join with google meet|join microsoft teams)\b/i.test(body)
  ) {
    return true;
  }

  // Subject mentions Zoom/Meet/Teams explicitly
  if (/\b(zoom|google meet|microsoft teams|webex|zoho meeting|gotomeeting)\b/i.test(subjectL)) {
    return true;
  }

  return false;
}

/** Clear ecommerce / order / receipt signals (beats weak travel keywords like "arrival"). */
export function isStrongPurchaseMail(
  from: string,
  subject: string,
  body = ""
): boolean {
  const text = textOf(from, subject, body);
  return (
    /\b(order\s*#?\s*\d+|order\s+\d+|order confirmed|order confirmation|your order|order summary|view your order|purchase confirmed|payment received|shipping confirmation|out for delivery|tracking number|track (your )?(order|package|shipment))\b/.test(
      text
    ) ||
    /\b(invoice|receipt|refunded|refund|shipped|parcel|package)\b/.test(text) ||
    /\b(amazon|ebay|etsy|shopify|nemix|newegg|best buy|walmart|target)\b/.test(text) ||
    /@(amazon|ebay|etsy|shopify|stripe|paypal|square|nemix)\./.test(text)
  );
}

/** Online orders, receipts, shipping — boss shops a lot. */
export function isPurchasesMail(from: string, subject: string, body = ""): boolean {
  if (isStrongPurchaseMail(from, subject, body)) return true;
  const text = textOf(from, subject, body);
  return (
    /\b(order|ordered|purchase|purchased|receipt|invoice|shipped|shipping|delivered|delivery|tracking|parcel|package|refund|payment received|checkout|cart)\b/.test(
      text
    ) ||
    /\b(amazon|ebay|etsy|shopify|walmart|target|best buy|apple\.com|store\.)\b/.test(
      text
    ) ||
    /@(amazon|ebay|etsy|shopify|stripe|paypal|square)\./.test(text)
  );
}

/** True travel: flights, hotels, car rental — not shipping “arrival”. */
export function isTravelMail(from: string, subject: string, body = ""): boolean {
  if (isStrongPurchaseMail(from, subject, body)) return false;
  if (
    isMeetingOrCalendarMail(from, subject, body) &&
    !/\b(flight|hotel|itinerary|boarding)\b/i.test(textOf(from, subject, body))
  ) {
    return false;
  }
  const text = textOf(from, subject, body);
  return (
    /\b(flight|flights|airline|boarding pass|itinerary|hotel|booking\.com|airbnb|check-in flight|departure gate|airfare|vacation|cruise|rental car|car hire)\b/.test(
      text
    ) ||
    /\b(expedia|kayak|skyscanner|marriott|hilton|delta airlines|united airlines|american airlines|emirates|qatar|etihad|southwest airlines)\b/.test(
      text
    ) ||
    (/\b(travel itinerary|trip itinerary|hotel reservation|flight reservation)\b/.test(text) &&
      !isPurchasesMail(from, subject, body)) ||
    /@(expedia|booking|airbnb|tripadvisor|hilton|marriott|delta|united|aa\.com)\./.test(text)
  );
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
 * meeting → Meeting
 * strong purchases → Purchases
 * travel → Travel
 * purchases → Purchases
 * marketing → Marketing
 * needs reply → To Respond
 * else FYI
 */
export function deriveInboxBucket(email: Email): InboxBucket {
  const fromBlob = `${email.from} ${email.fromEmail}`;
  const body = latestBody(email);
  const files = attachmentNamesOf(email);
  const meetingCorpus = threadTextForMeeting(email);

  if (isMeetingOrCalendarMail(fromBlob, email.subject, meetingCorpus, files)) {
    return "meeting";
  }

  if (isStrongPurchaseMail(fromBlob, email.subject, body)) {
    return "purchases";
  }

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
    case "meeting":
      return "Meeting";
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
