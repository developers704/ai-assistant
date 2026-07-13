import { describe, expect, it } from "vitest";
import { evaluateActionPolicy } from "@/lib/alexa/policy-engine";
import { getCanonicalTool } from "@/lib/tools/canonical-registry";
import { unknownIntent } from "@/lib/alexa/types";
import { createPendingAction, getPendingAction, rejectPendingAction } from "@/lib/actions/action-manager";

describe("action-manager", () => {
  it("creates and rejects pending actions", () => {
    const pending = createPendingAction({
      conversationId: "c1",
      type: "meeting_cancel",
      title: "Delete meeting",
      summary: "Delete tomorrow meeting",
      preview: "Delete tomorrow meeting",
      payload: { title: "Standup" },
      toolName: "delete_meeting",
      channel: "chat",
      risk: "destructive",
    });
    expect(pending.status).toBe("awaiting_confirmation");
    expect(getPendingAction("c1")?.id).toBe(pending.id);
    rejectPendingAction("c1");
    expect(getPendingAction("c1")).toBeNull();
  });
});

describe("policy write vs read", () => {
  it("draft_email is draft/read-ish without forced destructive", () => {
    const tool = getCanonicalTool("draft_email_reply");
    expect(tool).toBeTruthy();
    const policy = evaluateActionPolicy({
      intent: unknownIntent({ domain: "email", action: "draft" }),
      tool: tool!,
      channel: "chat",
    });
    expect(policy.allowed).toBe(true);
  });

  it("delete_meeting requires confirmation", () => {
    const tool = getCanonicalTool("delete_meeting");
    const policy = evaluateActionPolicy({
      intent: unknownIntent({ domain: "calendar", action: "delete" }),
      tool: tool!,
      channel: "voice",
    });
    expect(policy.requiresConfirmation).toBe(true);
  });
});
