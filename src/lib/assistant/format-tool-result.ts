import { formatCurrency, formatPieceCount } from "@/lib/utils";
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
    open_document_scanner: "general",
    draft_email_reply: "email_draft",
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

    case "get_today_sales": {
      const revenue = Number(data.totalRevenue ?? 0);
      const units = Number(data.totalTransactions ?? 0);
      const source = String(data.source ?? "mock");
      const label = data.reportLabel ? String(data.reportLabel) : undefined;
      const topStores = (data.topStores as Array<{ name: string; revenue: number }>) ?? [];
      const topProducts =
        (data.topProducts as Array<{ name: string; itemNumber?: string; revenue: number; units: number }>) ?? [];

      let md = `**Sales summary** — ${formatCurrency(revenue)} net · ${units.toLocaleString()} units`;
      if (source === "report" && label) md += `\n\n_From uploaded report: **${label}**_`;
      else if (source === "mock") md += `\n\n_Demo data — upload a CSV in **Data Analyst** for real numbers._`;

      if (topStores.length > 0) {
        md += `\n\n**Top stores**\n${topStores
          .slice(0, 5)
          .map((s, i) => `${i + 1}. ${s.name} — ${formatCurrency(s.revenue)}`)
          .join("\n")}`;
      }
      if (topProducts.length > 0) {
        md += `\n\n**Top products**\n${topProducts
          .slice(0, 5)
          .map((p, i) => {
            const id = p.itemNumber ? `#${p.itemNumber} · ` : "";
            return `${i + 1}. ${id}${p.name} — ${formatCurrency(p.revenue)} · ${formatPieceCount(p.units)}`;
          })
          .join("\n")}`;
      }
      return md;
    }

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

    case "get_industry_news":
    case "get_sports_news":
    case "get_politics_news":
    case "open_data_analyst":
    case "open_document_scanner":
    case "draft_email_reply":
    case "show_detail_page":
      return String(data.spokenAnswer ?? data.message ?? "Done.");

    default:
      return String(data.spokenAnswer ?? data.message ?? result.output);
  }
}
