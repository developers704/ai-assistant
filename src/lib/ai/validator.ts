import type { ToolResult } from "@/lib/tools/types";

/** Deterministic validation first — no OpenAI unless complex failure. */
export function validateToolResult(result: ToolResult): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (result.status === "needs_confirmation" && !result.pendingAction) {
    issues.push("Confirmation required but no pendingAction returned.");
  }
  if (result.status === "success" && !result.spokenAnswer && !result.textAnswer) {
    issues.push("Success without user-facing answer.");
  }
  if (result.status === "failed" && !result.error && !result.spokenAnswer) {
    issues.push("Failed without error message.");
  }
  if (result.ok && result.status === "failed") {
    issues.push("Inconsistent ok/status flags.");
  }

  return { valid: issues.length === 0, issues };
}

export function validatePlannerSteps(steps: unknown[]): boolean {
  return Array.isArray(steps) && steps.length > 0 && steps.length <= 5;
}
