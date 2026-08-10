/**
 * Self-check for Valliani mail helpers (no live credentials).
 * Run: npx tsx scripts/check-valliani-mail-api.ts
 */
import assert from "node:assert/strict";
import {
  decodeQuotedPrintable,
  folderSortRank,
  formatMailDate,
  buildReplyBody,
  isSyntheticMailFolder,
  normalizeSubjectForThread,
  sameMailThread,
  sortThreadOldestFirst,
  jwtExpiresWithin,
  looksLikeQuotedPrintable,
  messageListPreview,
  normalizeMailPlainText,
  parseMailMessage,
  prettyFolderName,
  sortFolders,
  type MailFolder,
} from "../src/lib/valliani-mail/types";
import { withAllMailFolder } from "../src/lib/valliani-mail/api";
import {
  attachmentExt,
  attachmentHasPayload,
  attachmentKind,
  blobFromAttachment,
  canInlinePreview,
  cleanBase64,
  mimeForAttachment,
} from "../src/lib/valliani-mail/attachments";

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeJwt(expSecondsFromNow: number): string {
  const header = b64url({ alg: "none", typ: "JWT" });
  const payload = b64url({
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
  });
  return `${header}.${payload}.sig`;
}

assert.equal(folderSortRank("INBOX"), 0);
assert.equal(folderSortRank("inbox"), 0);
assert.equal(folderSortRank("Sent"), 1);
assert.equal(folderSortRank("Drafts"), 2);
assert.equal(folderSortRank("Junk"), 3);
assert.equal(folderSortRank("Trash"), 4);
assert.equal(folderSortRank("__scheduled__"), 5);
assert.equal(folderSortRank("__snoozed__"), 6);
assert.equal(folderSortRank("Archive"), 7);
assert.equal(folderSortRank("__all__"), 8);
assert.equal(folderSortRank("__starred__"), 9);
assert.equal(folderSortRank("Custom"), 10);

assert.equal(prettyFolderName("__all__"), "All Mail");
assert.equal(prettyFolderName("INBOX"), "Inbox");
assert.equal(prettyFolderName("Sent Items"), "Sent Mails");
assert.equal(prettyFolderName("__scheduled__"), "Scheduled");
assert.equal(prettyFolderName("Snoozed"), "Snoozed");

const folders: MailFolder[] = [
  { path: "Trash", name: "Trash", listed: true, subscribed: false },
  { path: "INBOX", name: "Inbox", listed: true, subscribed: false },
  { path: "Sent", name: "Sent", listed: true, subscribed: false },
  { path: "__snoozed__", name: "Snoozed", listed: true, subscribed: false },
  { path: "__scheduled__", name: "Scheduled", listed: true, subscribed: false },
];
const sorted = sortFolders(folders);
assert.deepEqual(
  sorted.map((f) => f.path),
  ["INBOX", "Sent", "Trash", "__scheduled__", "__snoozed__"]
);

const merged = withAllMailFolder([
  { path: "INBOX", name: "Inbox", listed: true, subscribed: false },
  { path: "Scheduled", name: "Scheduled", listed: true, subscribed: false },
  { path: "Snoozed", name: "Snoozed", listed: true, subscribed: false },
  { path: "Sent", name: "Sent", listed: true, subscribed: false },
]);
assert.deepEqual(
  merged.map((f) => f.path),
  ["INBOX", "Sent", "Scheduled", "__all__", "__starred__"]
);
assert.equal(isSyntheticMailFolder("__scheduled__"), true);
assert.equal(isSyntheticMailFolder("Scheduled"), false);
assert.equal(isSyntheticMailFolder("INBOX"), false);

assert.equal(jwtExpiresWithin(null, 60_000), false);
assert.equal(jwtExpiresWithin("not-a-jwt", 60_000), false);
assert.equal(jwtExpiresWithin(fakeJwt(3600), 120_000), false);
assert.equal(jwtExpiresWithin(fakeJwt(30), 120_000), true);

assert.equal(looksLikeQuotedPrintable("Hi Raza,=20 Thanks"), true);
assert.equal(
  decodeQuotedPrintable("Hi Raza,=20 Thanks =F0=9F=91=8D=F0=9F=99=8F"),
  "Hi Raza,  Thanks 👍🙏"
);
assert.equal(
  normalizeMailPlainText("Hi Raza,=20 Thanks =F0=9F=91=8D"),
  "Hi Raza, Thanks 👍"
);

const parsed = parseMailMessage({
  uid: 1,
  subject: "Re: test",
  preview: "Hi Raza,=20 Thanks =F0=9F=91=8D=F0=9F=99=8F",
  bodyText: "Hi Raza,=20 Thanks =F0=9F=91=8D=F0=9F=99=8F",
  from: [],
  to: [],
  flags: [],
});
assert.equal(parsed.preview, "Hi Raza, Thanks 👍🙏");
assert.equal(parsed.bodyText, "Hi Raza, Thanks 👍🙏");
assert.ok(!messageListPreview(parsed).includes("=20"));
assert.ok(!messageListPreview(parsed).includes("=F0"));
assert.match(messageListPreview(parsed), /Hi Raza, Thanks/);

const withAtt = parseMailMessage({
  uid: 2,
  subject: "docs",
  attachments: [
    {
      filename: "ADP Developer Resources.pdf",
      content_type: "application/pdf",
      size: 12,
      content_base64: Buffer.from("%PDF-1.4 test").toString("base64"),
    },
    {
      name: "sheet.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      data: "AAAA",
    },
    {
      filename: "photo.JPG",
      download_url: "https://example.com/photo.jpg",
    },
  ],
});
assert.equal(withAtt.attachments.length, 3);
assert.equal(withAtt.attachments[0].filename, "ADP Developer Resources.pdf");
assert.ok(withAtt.attachments[0].contentBase64);
assert.equal(attachmentKind(withAtt.attachments[0]), "pdf");
assert.equal(canInlinePreview("pdf"), true);
assert.equal(mimeForAttachment(withAtt.attachments[0]), "application/pdf");
assert.ok(attachmentHasPayload(withAtt.attachments[0]));
assert.ok(blobFromAttachment(withAtt.attachments[0]));

assert.equal(attachmentExt("sheet.xlsx"), "xlsx");
assert.equal(attachmentKind(withAtt.attachments[1]), "excel");
assert.ok(attachmentHasPayload(withAtt.attachments[1]));

assert.equal(attachmentKind(withAtt.attachments[2]), "image");
assert.equal(withAtt.attachments[2].downloadUrl, "https://example.com/photo.jpg");
assert.ok(attachmentHasPayload(withAtt.attachments[2]));
assert.equal(cleanBase64("data:application/pdf;base64,QQ=="), "QQ==");

assert.equal(
  formatMailDate("2026-08-10T17:54:35.000Z").includes("T17:54"),
  false
);
assert.ok(formatMailDate("2026-08-10T17:54:35.000Z").length > 6);
const replyBody = buildReplyBody({
  ...parsed,
  date: "2026-08-10T17:54:35.000Z",
  from: [{ name: "Umair Jam", address: "a@b.com", label: "Umair Jam" }],
  bodyText: "hi how are you sir ??\npls check docs",
  preview: "",
});
assert.ok(!replyBody.includes("T17:54:35.000Z"));
assert.match(replyBody, /Umair Jam wrote:/);
assert.match(replyBody, /^> hi how are you sir \?\?/m);

assert.equal(normalizeSubjectForThread("Re: Re: test"), "test");
const a = parseMailMessage({
  uid: 10,
  subject: "test",
  messageId: "<a@x>",
  from: [],
  to: [],
  flags: [],
});
const b = parseMailMessage({
  uid: 11,
  subject: "Re: test",
  inReplyTo: "<a@x>",
  from: [],
  to: [],
  flags: [],
});
assert.equal(sameMailThread(a, b), true);
const ordered = sortThreadOldestFirst([
  { ...b, date: "2026-08-10T12:00:00.000Z" },
  { ...a, date: "2026-08-10T11:00:00.000Z" },
]);
assert.equal(ordered[0]!.uid, 10);
assert.equal(ordered[1]!.uid, 11);

console.log("check-valliani-mail-api: ok");
