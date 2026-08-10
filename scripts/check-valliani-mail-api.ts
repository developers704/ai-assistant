/**
 * Self-check for Valliani mail helpers (no live credentials).
 * Run: npx tsx scripts/check-valliani-mail-api.ts
 */
import assert from "node:assert/strict";
import {
  decodeQuotedPrintable,
  folderSortRank,
  jwtExpiresWithin,
  looksLikeQuotedPrintable,
  messageListPreview,
  normalizeMailPlainText,
  parseMailMessage,
  prettyFolderName,
  sortFolders,
  type MailFolder,
} from "../src/lib/valliani-mail/types";

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
assert.equal(folderSortRank("__all__"), 2);
assert.equal(folderSortRank("Drafts"), 3);
assert.equal(folderSortRank("Archive"), 4);
assert.equal(folderSortRank("Junk"), 5);
assert.equal(folderSortRank("Trash"), 6);
assert.equal(folderSortRank("Custom"), 9);

assert.equal(prettyFolderName("__all__"), "All Mail");
assert.equal(prettyFolderName("INBOX"), "Inbox");
assert.equal(prettyFolderName("Sent Items"), "Sent Mails");

const folders: MailFolder[] = [
  { path: "Trash", name: "Trash", listed: true, subscribed: false },
  { path: "INBOX", name: "Inbox", listed: true, subscribed: false },
  { path: "Sent", name: "Sent", listed: true, subscribed: false },
];
const sorted = sortFolders(folders);
assert.deepEqual(
  sorted.map((f) => f.path),
  ["INBOX", "Sent", "Trash"]
);

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

console.log("check-valliani-mail-api: ok");
