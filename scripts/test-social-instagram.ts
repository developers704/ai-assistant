import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildGraphUrl,
  fetchInstagramAccount,
  fetchInstagramPosts,
  fetchInstagramConversations,
  fetchConversationMessages,
  getMetaStatus,
  verifyWebhookToken,
  type MetaConfig,
} from "../src/lib/social/meta-client";
import { TOOL_BY_NAME } from "../src/lib/tools/metadata";
import { routeIntent, intentToTool } from "../src/lib/ai/intent-router";
import { resolveOpenTargetFromMessage, offerPath } from "../src/lib/actions/pending-offer";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const ROOT = join(__dirname, "..");

console.log("════════════════════════════════════════════════════════════");
console.log("  Social / Instagram Integration Tests");
console.log("════════════════════════════════════════════════════════════\n");

/* 1. Status endpoint works without leaking the token value. */
const status = getMetaStatus();
assert("status returns connected boolean", typeof status.connected === "boolean");
assert("status exposes hasToken (not token)", typeof status.hasToken === "boolean");
const statusJson = JSON.stringify(status);
assert("status never contains an access token value", !/access_token|EAA[A-Za-z0-9]/.test(statusJson), statusJson);

/* 2. meta-client URL builder works and appends token server-side. */
const cfg: MetaConfig = {
  graphVersion: "v25.0",
  pageId: "PAGE",
  igBusinessId: "IGBIZ",
  token: "TESTTOKEN",
};
const url = buildGraphUrl("IGBIZ/media", { fields: "id,caption" }, cfg);
assert("URL builder uses graph version", url.includes("/v25.0/"), url);
assert("URL builder includes node path", url.includes("/IGBIZ/media"), url);
assert("URL builder includes fields param", url.includes("fields=id%2Ccaption"), url);
assert("URL builder appends access_token", url.includes("access_token=TESTTOKEN"), url);

/* 3. account + posts handle missing token gracefully. */
const savedToken = process.env.META_TEST_ACCESS_TOKEN;
delete process.env.META_TEST_ACCESS_TOKEN;
(async () => {
  const acc = await fetchInstagramAccount();
  assert("account handles missing token", !acc.ok && acc.code === "NO_TOKEN", JSON.stringify(acc));
  const posts = await fetchInstagramPosts();
  assert("posts handles missing token", !posts.ok && posts.code === "NO_TOKEN", JSON.stringify(posts));
  if (savedToken) process.env.META_TEST_ACCESS_TOKEN = savedToken;

  /* 4. Tool registry includes all Instagram tools. */
  const igTools = [
    "get_instagram_account",
    "get_instagram_recent_posts",
    "get_instagram_post_comments",
    "get_instagram_post_insights",
    "open_social_dashboard",
    "draft_instagram_caption",
    "draft_instagram_comment_reply",
    "get_instagram_inbox",
    "get_instagram_conversation",
    "draft_instagram_dm",
  ];
  for (const t of igTools) {
    assert(`tool registry has ${t}`, TOOL_BY_NAME.has(t));
  }

  /* 5. Intent routing: "open social" navigates to /social. */
  const openIntent = routeIntent({ message: "open social" });
  assert("open social routes to social.open", openIntent === "social.open", openIntent);
  assert("social.open maps to open_social_dashboard", intentToTool("social.open") === "open_social_dashboard");
  assert("resolveOpenTarget('open social') = social", resolveOpenTargetFromMessage("open social") === "social");
  assert("offerPath(social) is /social", offerPath("social") === "/social");

  const followersIntent = routeIntent({ message: "how many instagram followers do I have" });
  assert("followers question routes to social.account", followersIntent === "social.account", followersIntent);

  const publishIntent = routeIntent({ message: "post this to Instagram" });
  assert("'post this to instagram' is blocked", publishIntent === "social.publish_blocked", publishIntent);

  const inboxIntent = routeIntent({ message: "show my Instagram DMs" });
  assert("DM question routes to social.inbox", inboxIntent === "social.inbox", inboxIntent);

  const dmIntent = routeIntent({ message: "draft a reply to this Instagram message" });
  assert("DM reply routes to social.dm", dmIntent === "social.dm", dmIntent);

  /* 6b. Messaging helpers handle missing token gracefully. */
  const convs = await fetchInstagramConversations();
  assert("conversations handles missing token", !convs.ok && convs.code === "NO_TOKEN", JSON.stringify(convs));
  const msgs = await fetchConversationMessages("t_conv_123");
  assert("messages handles missing token", !msgs.ok && msgs.code === "NO_TOKEN", JSON.stringify(msgs));

  /* 6c. Webhook verify token helper. */
  process.env.META_WEBHOOK_VERIFY_TOKEN = "alex_social_2026";
  assert("webhook verify matches correct token", verifyWebhookToken("alex_social_2026"));
  assert("webhook verify rejects wrong token", !verifyWebhookToken("nope"));
  delete process.env.META_WEBHOOK_VERIFY_TOKEN;
  assert("webhook verify rejects when env unset", !verifyWebhookToken("alex_social_2026"));

  /* 6. Page + components build (files exist). */
  assert("social page exists", existsSync(join(ROOT, "src/app/(app)/social/page.tsx")));
  assert("SocialDashboard exists", existsSync(join(ROOT, "src/components/social/SocialDashboard.tsx")));
  assert("meta-client exists", existsSync(join(ROOT, "src/lib/social/meta-client.ts")));

  /* 7. No frontend (client) code references the access token env var. */
  const clientFiles = [
    "src/components/social/SocialDashboard.tsx",
    "src/components/social/InstagramAccountHeader.tsx",
    "src/components/social/InstagramOverviewCards.tsx",
    "src/components/social/InstagramPostsList.tsx",
    "src/components/social/InstagramPostCard.tsx",
    "src/components/social/InstagramCommentsPanel.tsx",
    "src/components/social/InstagramInbox.tsx",
    "src/components/social/types.ts",
    "src/app/(app)/social/page.tsx",
  ];
  for (const f of clientFiles) {
    const content = existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), "utf8") : "";
    assert(`no token ref in ${f}`, !content.includes("META_TEST_ACCESS_TOKEN"), f);
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("────────────────────────────────────────────────────────────\n");

  if (failed > 0) process.exit(1);
  console.log("✓ All social/instagram tests passed.");
})();
