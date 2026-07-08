import type { PendingAction } from "@/types";

/** Standard tool result — single format for Voice, Chat, and planner steps. */
export type ToolRiskLevel = "safe" | "confirmation_required" | "dangerous";

export type ToolCategory =
  | "calendar"
  | "email"
  | "sales"
  | "contacts"
  | "tasks"
  | "news"
  | "knowledge"
  | "stores"
  | "social"
  | "navigation"
  | "media"
  | "calculator";

export type ToolResultStatus =
  | "success"
  | "failed"
  | "needs_confirmation"
  | "not_found";

export interface ToolExecutionContext {
  source: "voice" | "chat";
  currentPath?: string;
  selectedEmailId?: string;
  selectedMeetingId?: string;
  selectedReportId?: string;
  selectedContactId?: string;
  /** Set when user confirmed a staged pending action */
  confirmed?: boolean;
  pendingActionId?: string;
}

export interface ToolResult {
  ok: boolean;
  toolName: string;
  status: ToolResultStatus;
  confidence: number;
  spokenAnswer?: string;
  textAnswer?: string;
  data?: Record<string, unknown>;
  navigateTo?: string;
  pendingAction?: PendingAction;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  requiresConfirmation: boolean;
  allowedInVoice: boolean;
  allowedInChat: boolean;
  opensPage?: string;
  whenToUse: string;
  whenNotToUse: string;
  examplePhrases: string[];
  costNotes?: string;
  /** OpenAI function parameters JSON schema */
  parameters: Record<string, unknown>;
}
