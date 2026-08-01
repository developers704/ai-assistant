/**
 * Self-check: purchase vs travel bucket priority.
 * Run: npx tsx scripts/check-email-buckets.ts
 */
import assert from "node:assert/strict";
import { deriveInboxBucket } from "../src/lib/email-buckets";
import type { Email } from "../src/types";

function mail(partial: Partial<Email> & Pick<Email, "subject" | "from" | "fromEmail">): Email {
  return {
    id: "1",
    threadId: "1",
    preview: partial.preview ?? "",
    body: partial.body ?? "",
    receivedAt: new Date().toISOString(),
    isImportant: false,
    isRead: true,
    needsReply: false,
    category: "normal",
    ...partial,
  };
}

const nemix = deriveInboxBucket(
  mail({
    from: "Irtaza Q",
    fromEmail: "developer@arrakconsulting.com",
    subject: "Fwd: Order 4464 confirmed",
    preview: "NEMIX RAM order summary View your order",
    body: "Order summary DELL 32GB DDR4 RDIMM $335 View your order Download to track with shop",
  })
);
assert.equal(nemix, "purchases", `NEMIX order should be purchases, got ${nemix}`);

const flight = deriveInboxBucket(
  mail({
    from: "United",
    fromEmail: "noreply@united.com",
    subject: "Your boarding pass",
    body: "Flight UA123 itinerary departure gate",
  })
);
assert.equal(flight, "travel", `boarding pass should be travel, got ${flight}`);

const shipArrival = deriveInboxBucket(
  mail({
    from: "Amazon",
    fromEmail: "ship@amazon.com",
    subject: "Your package has a new arrival date",
    body: "Order #123-456 tracking number estimated arrival tomorrow",
  })
);
assert.equal(
  shipArrival,
  "purchases",
  `shipping arrival should be purchases, got ${shipArrival}`
);

console.log("check-email-buckets: ok");
