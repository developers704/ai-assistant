/**
 * Self-check: chat latency fast-paths (trivial → rules; greeting in rule engine).
 * Run: npx tsx scripts/check-chat-fastpath.ts
 */
import assert from "node:assert/strict";
import {
  isTrivialChatMessage,
  shouldUseRuleEngine,
  getMessageIntent,
} from "../src/lib/ai/assistant-engine";

assert.equal(isTrivialChatMessage("hi"), true);
assert.equal(isTrivialChatMessage("AI"), true);
assert.equal(isTrivialChatMessage("ok"), true);
assert.equal(isTrivialChatMessage("thanks!"), true);
assert.equal(isTrivialChatMessage("what were top stores yesterday"), false);
assert.equal(isTrivialChatMessage("show sales"), false);

assert.equal(getMessageIntent("hello"), "greeting");
assert.equal(shouldUseRuleEngine("hello"), true);
assert.equal(shouldUseRuleEngine("help"), true);
assert.equal(shouldUseRuleEngine("what is the meaning of life"), false);

console.log("check-chat-fastpath: ok");
