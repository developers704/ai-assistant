/**
 * Self-check: hybrid chat routing (general → LLM; app → rules; Valliani → RAG flag).
 * Run: npx tsx scripts/check-chat-fastpath.ts
 */
import assert from "node:assert/strict";
import {
  isTrivialChatMessage,
  shouldUseRuleEngine,
  isGeneralKnowledgeChatQuery,
  getMessageIntent,
} from "../src/lib/ai/assistant-engine";
import { looksLikeCompanyKnowledgeQuery } from "../src/lib/voice/company-knowledge-format";

assert.equal(isTrivialChatMessage("thanks"), true);
assert.equal(isTrivialChatMessage("hi"), false); // greetings go to LLM now
assert.equal(isTrivialChatMessage("show sales"), false);

assert.equal(getMessageIntent("hello"), "greeting");
assert.equal(shouldUseRuleEngine("hello"), false);
assert.equal(shouldUseRuleEngine("help"), false);
assert.equal(shouldUseRuleEngine("show me sales"), true);
assert.equal(shouldUseRuleEngine("what is the meaning of life"), false);

assert.equal(isGeneralKnowledgeChatQuery("who is president of us?"), true);
assert.equal(isGeneralKnowledgeChatQuery("i said how r u ?"), true);
assert.equal(isGeneralKnowledgeChatQuery("hi"), true);
assert.equal(isGeneralKnowledgeChatQuery("how r u"), true);
assert.equal(isGeneralKnowledgeChatQuery("show sales"), false);
assert.equal(isGeneralKnowledgeChatQuery("what is Valliani return policy"), false);

assert.equal(looksLikeCompanyKnowledgeQuery("who is president of us?"), false);
assert.equal(looksLikeCompanyKnowledgeQuery("valliani return policy"), true);
assert.equal(looksLikeCompanyKnowledgeQuery("villiani founder"), true);

console.log("check-chat-fastpath: ok");
