import { formatSalesReportMarkdown } from "@/lib/assistant/sales-data";
import { formatCurrency } from "@/lib/utils";
import type { VoiceToolResult } from "@/lib/voice/execute-tool";
import type { IntentType } from "@/types";

function parseOutput(output: string): Record<string, unknown> {
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    return { spokenAnswer: output };
  }
}

export function intentForTool(name: string): IntentType {
  const map: Record<string, IntentType> = {
    get_calendar_today: "calendar_today",
    get_email_summary: "email_summary",
    get_today_sales: "sales_report",
    get_daily_briefing: "daily_briefing",
    list_tasks: "reminder_list",
    list_contacts: "general",
    get_metal_rates: "general",
    estimate_jewellery_price: "general",
    get_industry_news: "general",
    get_sports_news: "general",
    get_politics_news: "general",
    show_detail_page: "general",
    open_data_analyst: "general",
    draft_email_reply: "email_draft",
    search_company_knowledge: "general",
    get_store_directory: "store_list",
    find_nearest_store: "store_list",
    list_valliani_stores: "store_list",
    get_valliani_store_details: "store_list",
  };
  return map[name] ?? "general";
}

export function formatToolResultForChat(toolName: string, result: VoiceToolResult): string {
  const data = parseOutput(result.output);

  switch (toolName) {
    case "get_calendar_today": {
      const events = (data.events as Array<{ title: string; startLocal?: string; location?: string }>) ?? [];
      if (events.length === 0) {
        return "**Today's calendar**\n\nNo meetings scheduled. Your calendar is clear.";
      }
      const lines = events
        .slice(0, 12)
        .map((e) => `- **${e.startLocal ?? ""}** — ${e.title}${e.location ? ` @ ${e.location}` : ""}`);
      return `**Today's calendar** (${events.length} event${events.length !== 1 ? "s" : ""})\n\n${lines.join("\n")}`;
    }

    case "get_email_summary": {
      const total = Number(data.total ?? 0);
      const unread = Number(data.unread ?? 0);
      const top = (data.topEmails as Array<{ from: string; subject: string; unread?: boolean }>) ?? [];
      const header = `**Inbox** — ${total} messages, **${unread}** unread`;
      if (top.length === 0) return `${header}\n\nNo emails in inbox.`;
      const lines = top.map(
        (e) => `- ${e.unread ? "🔵 " : ""}**${e.from}** — ${e.subject}`
      );
      return `${header}\n\n${lines.join("\n")}`;
    }

    case "get_today_sales":
      return typeof data.synthesizedAnswer === "string"
        ? data.synthesizedAnswer
        : typeof data.markdown === "string"
          ? data.markdown
          : formatSalesReportMarkdown();

    case "get_daily_briefing":
      return String(data.spokenAnswer ?? data.markdown ?? "Daily briefing loaded.");

    case "list_tasks": {
      const tasks = (data.tasks as Array<{ title: string; dueDate: string; priority: string }>) ?? [];
      if (tasks.length === 0) return "**Tasks**\n\nNo pending tasks. You're all caught up!";
      return `**Pending tasks** (${tasks.length})\n\n${tasks
        .map((t) => `- [${t.priority}] **${t.title}** — due ${t.dueDate}`)
        .join("\n")}`;
    }

    case "list_contacts": {
      const contacts = (data.contacts as Array<{ name: string; role: string; phone?: string }>) ?? [];
      if (contacts.length === 0) return String(data.spokenAnswer ?? "No contacts found.");
      return `**Contacts**\n\n${contacts
        .slice(0, 10)
        .map((c) => `- **${c.name}** — ${c.role}${c.phone ? ` · ${c.phone}` : ""}`)
        .join("\n")}`;
    }

    case "get_metal_rates":
      return `**Metal rates**\n\n22K gold: **$${data.gold22PerGram}/g** · 24K: **$${data.gold24PerGram}/g** · Silver: **$${data.silverPerGram}/g**${data.live ? " _(live)_" : " _(indicative)_"}`;

    case "estimate_jewellery_price":
      return `**Price estimate:** ${formatCurrency(Number(data.estimatedTotal ?? 0))}`;

    case "search_company_knowledge": {
      const markdown =
        typeof data.markdown === "string"
          ? data.markdown
          : String(data.spokenAnswer ?? "No company knowledge found.");
      return markdown;
    }

    case "get_store_directory":
    case "find_nearest_store":
    case "list_valliani_stores":
    case "get_valliani_store_details": {
      return typeof data.markdown === "string"
        ? data.markdown
        : String(data.message ?? data.spokenAnswer ?? "No store data found.");
    }

    case "get_industry_news":
    case "get_sports_news":
    case "get_politics_news":
    case "open_data_analyst":
    case "draft_email_reply":
    case "show_detail_page":
      return String(data.spokenAnswer ?? data.message ?? "Done.");

    default:
      return String(data.spokenAnswer ?? data.message ?? result.output);
  }
}
