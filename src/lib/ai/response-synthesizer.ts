import type { RoutedIntent } from "@/lib/ai/intent-router";
import { detectSalesFocus } from "@/lib/ai/sales-focus";
import {
  formatSalesByFocus,
  formatTopStoreAnswer,
} from "@/lib/assistant/sales-data";
import {
  createAssistantOffer,
  type OfferTarget,
} from "@/lib/actions/pending-offer";
import type { PendingAction } from "@/types";
import type { ToolResult } from "@/lib/tools/types";

export interface SynthesizeInput {
  toolName: string;
  result: ToolResult;
  userMessage: string;
  routedIntent?: RoutedIntent;
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

function newsOffer(summary: string): SynthesizedResponse {
  return {
    message: `${summary}\n\nSay **yes** or **open news** for the full News & Markets page.`,
    pendingOffer: createAssistantOffer({
      target: "news",
      summary: "Open News & Markets for full headlines and live charts.",
      toolName: "get_industry_news",
    }),
    navigateTo: undefined,
  };
}

/** Convert tool output into a short answer that matches the user's request. */
export function synthesizeToolResponse(input: SynthesizeInput): SynthesizedResponse {
  const { toolName, result, userMessage, routedIntent } = input;
  const data = parseToolData(result);

  if (result.pendingAction) {
    return {
      message: result.textAnswer ?? result.spokenAnswer ?? "Please review and confirm.",
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
      return {
        message,
        navigateTo: "/sales",
        pendingOffer: createAssistantOffer({
          target: "sales",
          summary: "Open Sales Dashboard for store rankings and charts.",
        }),
      };
    }

    if (focus === "summary") {
      return { message, navigateTo: "/sales" };
    }

    return { message, navigateTo: "/sales" };
  }

  if (toolName === "get_email_summary" && /\b(send|write|draft|reply|email to)\b/i.test(userMessage)) {
    return {
      message:
        "That sounds like you want to **compose** an email, not read the inbox. Try: *send an email to Ross* — I'll draft it for you.",
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
    return newsOffer(short || "Here are the latest jewelry industry headlines.");
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
    return { message: formatTopStoreAnswer(), navigateTo: "/sales" };
  }

  const fallback = result.textAnswer ?? result.spokenAnswer ?? "Done.";
  if (fallback.length > 600 && toolName === "get_email_summary") {
    const unread = Number(data.unread ?? 0);
    const total = Number(data.total ?? 0);
  return {
      message: `**Inbox** — ${unread} unread of ${total} messages. Open Email for the full list.`,
      pendingOffer: createAssistantOffer({
        target: "email",
        summary: "Open your inbox.",
      }),
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
