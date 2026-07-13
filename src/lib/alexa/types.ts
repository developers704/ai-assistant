import { z } from "zod";

export type AlexaChannel = "chat" | "voice" | "analyst" | "automation";

export type AlexaDomain =
  | "sales"
  | "email"
  | "calendar"
  | "tasks"
  | "contacts"
  | "stores"
  | "social"
  | "calculator"
  | "news"
  | "knowledge"
  | "navigation"
  | "media"
  | "general"
  | "unknown";

export type AlexaRiskLevel = "read" | "draft" | "write" | "destructive";

export type AlexaDisplayIntent =
  | "tell"
  | "show"
  | "open"
  | "navigate"
  | "execute"
  | "unknown";

export interface AlexaTurnInput {
  conversationId: string;
  channel: AlexaChannel;
  message: string;
  currentRoute?: string;
  timezone?: string;
  locale?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AlexaIntent {
  domain: AlexaDomain;
  action: string;
  confidence: number;
  requiresTool: boolean;
  requiresClarification: boolean;
  missingFields: string[];
  requiresConfirmation: boolean;
  requestedNavigation: boolean;
  displayIntent: AlexaDisplayIntent;
  entities: Record<string, unknown>;
  metrics?: string[];
  groupBy?: string[];
}

export interface AlexaUiAction {
  type: "none" | "navigate" | "apply_filters" | "show_detail" | "open_modal";
  route?: string;
  sectionId?: string;
  filters?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export interface AlexaFreshness {
  source?: string;
  asOf?: string;
  fetchedAt?: string;
}

export interface AlexaPendingAction {
  id: string;
  conversationId: string;
  type: string;
  risk: AlexaRiskLevel;
  status:
    | "awaiting_confirmation"
    | "confirmed"
    | "rejected"
    | "executed"
    | "expired"
    | "failed";
  payload: Record<string, unknown>;
  summary: string;
  createdBy: AlexaChannel;
  createdAt: string;
  expiresAt: string;
}

export interface AlexaToolResult<T = unknown> {
  ok: boolean;
  status:
    | "success"
    | "partial"
    | "not_found"
    | "needs_clarification"
    | "needs_confirmation"
    | "error";
  tool: string;
  data?: T;
  textAnswer?: string;
  spokenAnswer?: string;
  uiAction?: AlexaUiAction;
  pendingAction?: AlexaPendingAction | null;
  freshness?: AlexaFreshness;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  } | null;
  metadata?: {
    durationMs?: number;
    cached?: boolean;
    traceId?: string;
  };
}

export interface AlexaTurnResult {
  traceId: string;
  intent: AlexaIntent;
  toolResult?: AlexaToolResult;
  textAnswer: string;
  spokenAnswer: string;
  uiAction?: AlexaUiAction;
  pendingAction?: AlexaPendingAction | null;
  /** When true, caller may fall back to legacy LLM/rules for general chat. */
  deferToLegacy?: boolean;
}

export interface AlexaToolExecutionContext {
  traceId: string;
  conversationId: string;
  channel: AlexaChannel;
  currentRoute?: string;
  timezone?: string;
  userId?: string;
  idempotencyKey?: string;
  confirmed?: boolean;
  pendingActionId?: string;
}

export interface EntityCandidate {
  type: string;
  rawValue: string;
  resolvedValue?: string;
  confidence: number;
  alternatives?: string[];
}

export interface AlexaWorkingMemory {
  conversationId: string;
  lastDomain?: AlexaDomain;
  lastIntent?: AlexaIntent;
  lastTool?: string;
  currentRoute?: string;
  lastUiAction?: AlexaUiAction;
  salesContext?: {
    dateRange?: unknown;
    stores?: string[];
    designs?: string[];
    departments?: string[];
    vendors?: string[];
    classes?: string[];
    products?: string[];
    metrics?: string[];
    groupBy?: string[];
  };
  emailContext?: {
    lastMessageId?: string;
    lastThreadId?: string;
    sender?: string;
    subject?: string;
  };
  calendarContext?: {
    lastEventId?: string;
    attendee?: string;
    dateRange?: unknown;
  };
  socialContext?: {
    conversationId?: string;
    postId?: string;
    username?: string;
  };
  storeContext?: {
    storeId?: string;
    city?: string;
    state?: string;
  };
  pendingActionId?: string;
  updatedAt: string;
}

export const AlexaToolResultSchema = z.object({
  ok: z.boolean(),
  status: z.enum([
    "success",
    "partial",
    "not_found",
    "needs_clarification",
    "needs_confirmation",
    "error",
  ]),
  tool: z.string(),
  data: z.unknown().optional(),
  textAnswer: z.string().optional(),
  spokenAnswer: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});

export function unknownIntent(partial?: Partial<AlexaIntent>): AlexaIntent {
  return {
    domain: "unknown",
    action: "unknown",
    confidence: 0,
    requiresTool: false,
    requiresClarification: false,
    missingFields: [],
    requiresConfirmation: false,
    requestedNavigation: false,
    displayIntent: "unknown",
    entities: {},
    ...partial,
  };
}
