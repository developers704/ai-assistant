import { deriveInboxBucket } from "../src/lib/email-buckets";
import type { Email } from "../src/types";

function mail(partial: Partial<Email> & Pick<Email, "subject" | "from">): Email {
  return {
    id: "1",
    threadId: "1",
    fromEmail: partial.fromEmail ?? "x@y.com",
    preview: "",
    body: "",
    receivedAt: new Date().toISOString(),
    isImportant: false,
    isRead: false,
    needsReply: false,
    category: "normal",
    ...partial,
  };
}

const cases: [string, Email, string][] = [
  [
    "zoho invite",
    mail({
      from: "Zoho Meeting",
      fromEmail: "noreply@mailer.zohomeeting.com",
      subject: "Invitation - JEWEL MATE on Friday",
      body: "Join meeting Meeting ID 109",
      attachments: [
        {
          filename: "invite.ics",
          mimeType: "text/calendar",
          size: 1,
          messageId: "1",
          attachmentId: "a",
        },
      ],
    }),
    "meeting",
  ],
  [
    "reply on invite thread",
    mail({
      from: "Umair Jam",
      fromEmail: "umair@x.com",
      subject: "Re: Test",
      body: "ok",
      threadMessages: [
        mail({
          id: "0",
          from: "Zoho Meeting",
          fromEmail: "noreply@mailer.zohomeeting.com",
          subject: "Invitation - Test",
          body: "Join meeting Meeting ID 1 password abc",
        }),
        mail({
          id: "1",
          from: "Umair Jam",
          fromEmail: "umair@x.com",
          subject: "Re: Test",
          body: "ok",
        }),
      ],
    }),
    "meeting",
  ],
  [
    "claude marketing not meeting",
    mail({
      from: "Claude Team",
      fromEmail: "no-reply@anthropic.com",
      subject: "Claude, on your desktop",
      body: "The desktop app picks up where the browser leaves off. You're invited to try it.",
    }),
    "fyi", // or marketing — must NOT be meeting
  ],
];

let failed = 0;
for (const [name, email, expect] of cases) {
  const got = deriveInboxBucket(email);
  const ok =
    name === "claude marketing not meeting"
      ? got !== "meeting"
      : got === expect;
  if (!ok) {
    console.error("FAIL", name, "got", got, "want", expect);
    failed++;
  } else {
    console.log("ok", name, "→", got);
  }
}
if (failed) process.exit(1);
console.log("meeting-bucket-ok");
