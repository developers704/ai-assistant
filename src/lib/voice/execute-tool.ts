import { v4 as uuidv4 } from "uuid";
import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { setState } from "@/lib/store/server-store";
import {
  buildCalendarVoiceScript,
  getVoiceCalendarEvents,
} from "@/lib/voice/calendar-data";
import { buildEmailVoiceScript, getVoiceEmails } from "@/lib/voice/email-data";
import type { Reminder } from "@/types";

export interface VoiceUiAction {
  type: "navigate";
  path: string;
}

export interface VoiceToolResult {
  output: string;
  uiAction?: VoiceUiAction;
}

const PAGE_PATHS: Record<string, string> = {
  sales: "/sales",
  calendar: "/calendar",
  email: "/email",
  dashboard: "/dashboard",
  chat: "/chat",
};

function formatEventTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export async function executeVoiceTool(
  name: string,
  args: Record<string, unknown>
): Promise<VoiceToolResult> {
  switch (name) {
    case "get_today_sales": {
      const summary = computeSalesSummary(mockSalesData);
      const top = summary.topStores.slice(0, 3);
      return {
        output: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          totalRevenue: summary.totalRevenue,
          totalTransactions: summary.totalTransactions,
          averageOrderValue: Math.round(summary.averageOrderValue),
          vsYesterdayPercent: Number(summary.comparisonPreviousDay.toFixed(1)),
          topStores: top.map((s) => ({ name: s.name, revenue: Math.round(s.revenue) })),
          note: "Demo POS data until JewelMate is connected.",
        }),
        uiAction: { type: "navigate", path: "/sales" },
      };
    }

    case "get_email_summary": {
      const { emails, googleConnected, source } = await getVoiceEmails();
      const script = buildEmailVoiceScript(emails);

      return {
        output: JSON.stringify({
          total: emails.length,
          unread: emails.filter((e) => !e.isRead).length,
          spokenAnswer: script,
          topEmails: emails.slice(0, 5).map((e) => ({
            from: e.from,
            subject: e.subject,
            unread: !e.isRead,
            category: e.category,
          })),
          googleConnected,
          source,
        }),
        uiAction: { type: "navigate", path: "/email" },
      };
    }

    case "get_calendar_today": {
      const { events, tz, todayKey, googleConnected, source } =
        await getVoiceCalendarEvents();
      const script = buildCalendarVoiceScript(events, tz);

      return {
        output: JSON.stringify({
          date: todayKey,
          timezone: tz,
          eventCount: events.length,
          spokenAnswer: script,
          events: events.slice(0, 12).map((e) => ({
            title: e.title,
            start: e.start,
            startLocal: formatEventTime(e.start, tz),
            location: e.location,
          })),
          googleConnected,
          source,
        }),
        uiAction: { type: "navigate", path: "/calendar" },
      };
    }

    case "create_reminder": {
      const reminder: Reminder = {
        id: uuidv4(),
        title: String(args.title ?? "Reminder"),
        dueDate: String(args.due_date ?? new Date().toISOString().split("T")[0]),
        dueTime: args.due_time ? String(args.due_time) : undefined,
        priority: (args.priority as Reminder["priority"]) ?? "medium",
        completed: false,
        recurring: null,
        createdAt: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        reminders: [...s.reminders, reminder],
      }));

      return {
        output: JSON.stringify({
          success: true,
          reminder: {
            title: reminder.title,
            dueDate: reminder.dueDate,
            dueTime: reminder.dueTime,
            priority: reminder.priority,
          },
        }),
      };
    }

    case "show_detail_page": {
      const page = String(args.page ?? "dashboard");
      const path = PAGE_PATHS[page] ?? "/dashboard";
      return {
        output: JSON.stringify({ opened: page, path }),
        uiAction: { type: "navigate", path },
      };
    }

    default:
      return { output: JSON.stringify({ error: `Unknown tool: ${name}` }) };
  }
}
