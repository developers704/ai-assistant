import { describe, expect, it } from "vitest";
import { routeIntent } from "@/lib/ai/intent-router";
import {
  detectPolicyFocus,
  retrieveKnowledge,
} from "@/lib/rag/retrieve";
import {
  buildCompanyKnowledgeAnswer,
  looksLikeCompanyKnowledgeQuery,
} from "@/lib/voice/company-knowledge-format";

describe("company policies knowledge", () => {
  it("routes misspelled villiani + policies to knowledge.search", () => {
    expect(
      routeIntent({ message: "which policies does villiani offers" })
    ).toBe("knowledge.search");
    expect(routeIntent({ message: "what policies does valliani offer" })).toBe(
      "knowledge.search"
    );
  });

  it("detects broad policies overview", () => {
    expect(detectPolicyFocus("which policies does villiani offers")).toBe(
      "policies_overview"
    );
    expect(detectPolicyFocus("policies")).toBe("policies_overview");
    expect(detectPolicyFocus("return policy")).toBe("return");
  });

  it("answers broad policies with real policy sections", () => {
    const answer = buildCompanyKnowledgeAnswer(
      "which policies does villiani offers"
    );
    expect(answer.chunkCount).toBeGreaterThan(0);
    expect(answer.markdown).toMatch(/return/i);
    expect(answer.markdown).toMatch(/shipping/i);
    expect(answer.markdown).not.toMatch(/couldn't find that in our company knowledge/i);
  });

  it("retrieves policy chunks for bare 'policies'", () => {
    const chunks = retrieveKnowledge("policies");
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("does not treat yes-pls as company knowledge", () => {
    expect(looksLikeCompanyKnowledgeQuery("yes pls")).toBe(false);
    expect(looksLikeCompanyKnowledgeQuery("who is donald trump")).toBe(false);
  });
});
