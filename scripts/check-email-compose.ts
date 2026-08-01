import {
  parseEmailRecipient,
  parseComposeTopic,
  isComposeEmailToPerson,
  composeEmailHasBody,
  resolveEmailRecipient,
} from "../src/lib/ai/email-compose";

const msg =
  "send an email to Umair Jam about to attend meeting tomorrow at 9 pm";

const checks: [string, boolean][] = [
  [String(parseEmailRecipient(msg) === "Umair Jam"), true],
  [String(!!parseComposeTopic(msg)?.includes("attend")), true],
  [String(isComposeEmailToPerson(msg)), true],
  [String(composeEmailHasBody(msg)), true],
  [
    String(
      parseEmailRecipient("email umair@valliani.com that I will be late") ===
        "umair@valliani.com"
    ),
    true,
  ],
];

const state = {
  contacts: [
    {
      id: "1",
      name: "Umair Jam",
      email: "umair@example.com",
      role: "",
      company: "",
      isImportant: false,
    },
  ],
  emails: [],
} as Parameters<typeof resolveEmailRecipient>[1];

const ok = resolveEmailRecipient("Umair Jam", state);
const missing = resolveEmailRecipient("Nobody Here", state);
const byEmail = resolveEmailRecipient("umair@example.com", state);

console.log({
  recipient: parseEmailRecipient(msg),
  topic: parseComposeTopic(msg),
  resolve: ok,
  missing,
  byEmail,
});

if (ok.status !== "ok" || ok.email !== "umair@example.com") {
  throw new Error("resolve Umair Jam failed");
}
if (missing.status !== "missing") throw new Error("missing expected");
if (byEmail.status !== "ok") throw new Error("email resolve failed");
for (const [got, want] of checks) {
  if (got !== String(want)) throw new Error(`check failed: ${got}`);
}
console.log("ok");
