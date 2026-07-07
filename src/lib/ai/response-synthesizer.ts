import type { AIResponse, PendingAction } from "@/types";
import type { ToolResult } from "@/lib/tools/types";
import type { RoutedIntent } from "@/lib/ai/intent-router";
import { detectSalesFocus } from "@/lib/ai/sales-focus";
import {
  formatSalesByFocus,
  formatTopStoreAnswer,
} from "@/lib/assistant/sales-data";
import type { OfferTarget } from "@/lib/actions/pending-offer";
import { recordOfferedAction } from "@/lib/memory/working-memory";
import { buildComposeEmailPrompt, isComposeEmailToPerson } from "@/lib/ai/email-compose";
import { getState } from "@/lib/store/server-store";

export type AlexaChannel = "chat" | "voice";

export interface SynthesizeInput {
  toolName: string;
  result: ToolResult;
  userMessage: string;
  routedIntent?: RoutedIntent;
  channel?: AlexaChannel;
}

export interface SynthesizedResponse {
  message: string;
  pendingOffer?: PendingAction;
  navigateTo?: string;
}

function parseToolData(result: ToolResult): Record<string, unknown> {
  if (result.data && typeof result.data === "object") {
    return result.data as Record<string, unknown>;
  }
  return {};
}

function readOnlySectionHint(sectionLabel: string, channel: AlexaChannel): string {
  if (channel === "voice") {
    return ` Say open ${sectionLabel.toLowerCase()} for the full page.`;
  }
  return `\n\nOpen **${sectionLabel}** from the sidebar for charts and details.`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

function limitVoiceSentences(text: string, max = 3): string {
  const plain = stripMarkdown(text);
  const parts = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, max).join(" ");
}

/** Format assistant response for chat vs voice channel. */
export function formatResponseForChannel(
  response: AIResponse,
  channel: AlexaChannel
): AIResponse {
  if (channel === "chat") return response;
  return {
    ...response,
    message: limitVoiceSentences(response.message),
  };
}

/** Convert tool output into a short answer that matches the user's request. */
export function synthesizeToolResponse(input: SynthesizeInput): SynthesizedResponse {
  const { toolName, result, userMessage, routedIntent, channel = "chat" } = input;
  const data = parseToolData(result);

  if (result.pendingAction) {
    return {
      message: result.textAnswer ?? result.spokenAnswer ?? "Please review and confirm.",
      pendingOffer: result.pendingAction,
    };
  }

  if (toolName === "delete_all_meetings" && result.status === "needs_confirmation") {
    return {
      message: result.textAnswer ?? result.spokenAnswer ?? "Please confirm to delete all meetings.",
      pendingOffer: result.pendingAction,
    };
  }

  if (toolName === "get_today_sales") {
    const focus =
      (typeof data.focus === "string" ? data.focus : undefined) ??
      detectSalesFocus(userMessage, routedIntent);
    const message =
      typeof data.synthesizedAnswer === "string"
        ? data.synthesizedAnswer
        : formatSalesByFocus(focus as "top_store" | "summary" | "full_report");

    if (focus === "top_store") {
      recordOfferedAction("sales:full_breakdown");
      return { message };
    }

    if (focus === "summary") {
      return { message };
    }

    return { message };
  }

  if (toolName === "get_email_summary" && isComposeEmailToPerson(userMessage)) {
    return {
      message: buildComposeEmailPrompt(userMessage, getState()),
    };
  }

  if (toolName === "get_calendar_today" && routedIntent === "calendar.create") {
    return {
      message:
        "I can schedule that meeting — please say **set meeting with [name] tomorrow** and I'll prepare a calendar invite for your confirmation.",
    };
  }

  if (toolName === "get_industry_news" || toolName === "get_metal_rates") {
    const spoken = String(data.spokenAnswer ?? result.spokenAnswer ?? "");
    const short =
      spoken.length > 420 ? `${spoken.slice(0, 400).trim()}…` : spoken;
    return {
      message: `${short || "Here are the latest jewelry industry headlines."}${readOnlySectionHint("News & Markets", channel)}`,
    };
  }

  if (toolName === "draft_email_reply") {
    return {
      message:
        result.textAnswer ??
        result.spokenAnswer ??
        "Email draft ready — review below and tap **Send email** when ready.",
      pendingOffer: result.pendingAction,
    };
  }

  if (toolName === "add_meeting" && result.status === "needs_confirmation") {
    return {
      message: result.textAnswer ?? result.spokenAnswer ?? "Meeting ready for your confirmation.",
      pendingOffer: result.pendingAction,
    };
  }

  if (routedIntent === "sales.top_store") {
    return { message: formatTopStoreAnswer() };
  }

  const fallback = result.textAnswer ?? result.spokenAnswer ?? "Done.";
  if (fallback.length > 600 && toolName === "get_email_summary") {
    const unread = Number(data.unread ?? 0);
    const total = Number(data.total ?? 0);
    return {
      message: `**Inbox** — ${unread} unread of ${total} messages.${readOnlySectionHint("Email", channel)}`,
    };
  }

  return { message: fallback, navigateTo: result.navigateTo };
}

export function synthesizeOfferExecution(
  target: OfferTarget,
  toolResult?: ToolResult
): SynthesizedResponse {
  if (toolResult) {
    return {
      message: toolResult.textAnswer ?? toolResult.spokenAnswer ?? `Opened ${target}.`,
      navigateTo: toolResult.navigateTo,
    };
  }
  const paths: Record<OfferTarget, string> = {
    news: "/news",
    sales: "/sales",
    email: "/email",
    calendar: "/calendar",
    dashboard: "/dashboard",
    analyst: "/analyst",
    images: "/images",
    contacts: "/contacts",
  };
  return {
    message: `Opening **${target}** for you.`,
    navigateTo: paths[target],
  };
}
