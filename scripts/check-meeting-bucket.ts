import { deriveInboxBucket } from "../src/lib/email-buckets";
const e = {
  id: "1", threadId: "1", from: "Zoho Meeting", fromEmail: "noreply@mailer.zohomeeting.com",
  subject: "Invitation - JEWEL MATE & IRYS on Friday", preview: "Join meeting", body: "Meeting ID 123 password",
  receivedAt: new Date().toISOString(), isImportant: false, isRead: false, needsReply: false, category: "normal" as const,
  attachments: [{ filename: "invite.ics", mimeType: "text/calendar", size: 1, messageId: "1", attachmentId: "a" }],
};
const b = deriveInboxBucket(e as any);
if (b !== "meeting") throw new Error("got " + b);
console.log("meeting-bucket-ok");
