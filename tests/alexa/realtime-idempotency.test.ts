import { describe, expect, it } from "vitest";
import { claimIdempotencyKey, rememberIdempotencyResult } from "@/lib/tools/idempotency";

describe("realtime-idempotency", () => {
  it("executes once per toolCallId", () => {
    const callId = `call-${Date.now()}`;
    const key = `voice-call:${callId}`;
    const first = claimIdempotencyKey(key);
    expect(first.ok).toBe(true);
    rememberIdempotencyResult(key, {
      ok: true,
      status: "success",
      tool: "query_sales",
      spokenAnswer: "Done.",
    });
    const second = claimIdempotencyKey(key);
    expect(second.ok).toBe(false);
    expect((second.existing as { tool: string }).tool).toBe("query_sales");
  });
});
