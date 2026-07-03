import { v4 as uuidv4 } from "uuid";
import { mockContacts } from "@/lib/mock-data";
import { getState, setState } from "@/lib/store/server-store";
import {
  buildCalendarVoiceScript,
  getVoiceCalendarEvents,
} from "@/lib/voice/calendar-data";
import {
  buildEmailVoiceScript,
  buildVoiceEmailDraft,
  getVoiceEmails,
} from "@/lib/voice/email-data";
import {
  buildTasksVoiceScript,
  defaultMeetingEnd,
  findCalendarEvent,
  matchByTitle,
} from "@/lib/voice/tool-helpers";
import { getAuthenticatedClient } from "@/lib/google/client";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  fetchGoogleCalendarEvents,
} from "@/lib/google/calendar";
import { invalidateGoogleCache, getGoogleCache, setGoogleCache } from "@/lib/google/cache";
import { isGoogleConnected, getGoogleTokens } from "@/lib/google/token-store";
import { filterCalendarEvents } from "@/lib/calendar-utils";
import { userTimezone } from "@/lib/calendar-dates";
import { generateGeminiImage } from "@/lib/gemini/image";
import {
  buildDailyBriefingScript,
  estimateJewelleryPrice,
  getMarketRatesSummary,
  getNewsHeadlinesScript,
  getPoliticsHeadlinesScript,
  getSportsHeadlinesScript,
} from "@/lib/voice/section-tools";
import { getAssistantSalesSummary, formatSalesReportMarkdown } from "@/lib/assistant/sales-data";
import { buildCompanyKnowledgeVoiceAnswer } from "@/lib/voice/rag-tool";
import { sortTopProducts } from "@/lib/utils";
import type { CalendarEvent, Contact, Reminder } from "@/types";

import type { VoiceUiAction } from "@/lib/voice/types";
export type { VoiceUiAction } from "@/lib/voice/types";

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
  contacts: "/contacts",
  images: "/images",
  news: "/news",
  analyst: "/analyst",
  calculator: "/calculator",
  settings: "/settings",
};

function formatEventTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function getAllCalendarEvents(): Promise<CalendarEvent[]> {
  if (isGoogleConnected()) {
    const client = await getAuthenticatedClient();
    if (client) {
      const tz = userTimezone(getState());
      const events = await fetchGoogleCalendarEvents(client, tz);
      const integration = {
        connected: true as const,
        email: getGoogleTokens()?.email,
      };
      const cached = getGoogleCache();
      setGoogleCache({
        emails: cached?.emails ?? getState().emails,
        events,
        contacts: cached?.contacts ?? getState().contacts,
        integration,
      });
      return filterCalendarEvents(events);
    }
  }
  return filterCalendarEvents(getState().events);
}

function findContact(query: string): Contact | undefined {
  const q = query.toLowerCase().trim();
  const contacts = getState().contacts.length ? getState().contacts : mockContacts;
  if (!q) return undefined;
  return (
    contacts.find((c) => c.name.toLowerCase() === q) ||
    contacts.find((c) => c.name.toLowerCase().includes(q)) ||
    contacts.find((c) => q.includes(c.name.toLowerCase()))
  );
}

function buildContactsScript(contacts: Contact[], query?: string): string {
  if (query) {
    const match = findContact(query);
    if (!match) {
      return `I couldn't find a contact matching "${query}". Try the Contacts page for the full list.`;
    }
    const parts = [`${match.name}, ${match.role} at ${match.company}.`];
    if (match.phone) parts.push(`Phone: ${match.phone}.`);
    if (match.whatsapp) parts.push(`WhatsApp: ${match.whatsapp}.`);
    return parts.join(" ");
  }
  const list = contacts.filter((c) => c.isImportant).slice(0, 6);
  if (list.length === 0) {
    return "No contacts found.";
  }
  return `Key contacts: ${list.map((c) => `${c.name} (${c.role})`).join("; ")}.`;
}

export async function executeVoiceTool(
  name: string,
  args: Record<string, unknown>
): Promise<VoiceToolResult> {
  switch (name) {
    case "get_today_sales": {
      const focusArg = String(args.focus ?? "summary");
      const userMessage = args.user_message ? String(args.user_message) : "";
      const { detectSalesFocus } = await import("@/lib/ai/sales-focus");
      const { formatSalesByFocus } = await import("@/lib/assistant/sales-data");
      const focus = (
        focusArg === "top_store" || focusArg === "summary" || focusArg === "full_report"
          ? focusArg
          : detectSalesFocus(userMessage || focusArg)
      ) as "top_store" | "summary" | "full_report";

      const { summary, source, label, vendorCode } = getAssistantSalesSummary();
      const topStores = summary.topStores.slice(0, 5);
      const topProducts = sortTopProducts(summary.topProducts).slice(0, 5);
      const synthesizedAnswer = formatSalesByFocus(focus);

      const spoken =
        focus === "top_store" && topStores[0]
          ? `Your top store is ${topStores[0].name} at ${topStores[0].revenue.toLocaleString()} dollars net.`
          : source === "report"
            ? `Latest report${label ? ` ${label}` : ""}: ${summary.totalRevenue.toLocaleString()} dollars net across ${summary.totalTransactions.toLocaleString()} units.`
            : `Today's sales are $${summary.totalRevenue.toLocaleString()} across ${summary.totalTransactions} transactions. Demo data until a CSV is uploaded.`;

      return {
        output: JSON.stringify({
          source,
          reportLabel: label,
          vendorCode,
          focus,
          synthesizedAnswer,
          totalRevenue: summary.totalRevenue,
          totalTransactions: summary.totalTransactions,
          averageOrderValue: Math.round(summary.averageOrderValue),
          vsPreviousPercent: Number(summary.comparisonPreviousDay.toFixed(1)),
          grossSales: "grossSales" in summary ? summary.grossSales : undefined,
          discountTotal: "discountTotal" in summary ? summary.discountTotal : undefined,
          topStores: topStores.map((s) => ({ name: s.name, revenue: Math.round(s.revenue) })),
          topProducts: topProducts.map((p) => ({
            name: p.name,
            itemNumber: p.itemNumber,
            revenue: Math.round(p.revenue),
            units: p.units,
          })),
          spokenAnswer: spoken,
          markdown:
            focus === "full_report" ? formatSalesReportMarkdown() : synthesizedAnswer,
          note:
            source === "report"
              ? `From uploaded report${vendorCode ? ` (${vendorCode})` : ""}.`
              : "Demo POS data — upload CSV in Data Analyst.",
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
            id: e.id,
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

    case "list_tasks": {
      const tasks = getState().reminders;
      const script = buildTasksVoiceScript(tasks);
      const pending = tasks.filter((t) => !t.completed);
      return {
        output: JSON.stringify({
          count: pending.length,
          spokenAnswer: script,
          tasks: pending.slice(0, 10).map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            dueTime: t.dueTime,
            priority: t.priority,
          })),
        }),
        uiAction: { type: "navigate", path: "/calendar" },
      };
    }

    case "create_reminder":
    case "add_task": {
      const reminder: Reminder = {
        id: uuidv4(),
        title: String(args.title ?? "Task"),
        description: args.description ? String(args.description) : undefined,
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
          spokenAnswer: `Done. I added the task "${reminder.title}" for ${reminder.dueDate}${reminder.dueTime ? ` at ${reminder.dueTime}` : ""}.`,
          task: {
            id: reminder.id,
            title: reminder.title,
            dueDate: reminder.dueDate,
            dueTime: reminder.dueTime,
            priority: reminder.priority,
          },
        }),
        uiAction: { type: "navigate", path: "/calendar" },
      };
    }

    case "delete_task": {
      const state = getState();
      const pending = state.reminders.filter((r) => !r.completed);
      const taskId = args.task_id ? String(args.task_id) : undefined;
      const titleQuery = args.title ? String(args.title) : undefined;
      const target =
        (taskId ? pending.find((t) => t.id === taskId) : undefined) ||
        (titleQuery ? matchByTitle(pending, titleQuery) : undefined);

      if (!target) {
        return {
          output: JSON.stringify({
            success: false,
            spokenAnswer: "I couldn't find that task. Say the task name again or check your task list on Calendar.",
          }),
        };
      }

      setState((s) => ({
        ...s,
        reminders: s.reminders.filter((r) => r.id !== target.id),
      }));

      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `Removed the task "${target.title}".`,
          removedId: target.id,
        }),
        uiAction: { type: "navigate", path: "/calendar" },
      };
    }

    case "complete_task": {
      const state = getState();
      const pending = state.reminders.filter((r) => !r.completed);
      const taskId = args.task_id ? String(args.task_id) : undefined;
      const titleQuery = args.title ? String(args.title) : undefined;
      const target =
        (taskId ? pending.find((t) => t.id === taskId) : undefined) ||
        (titleQuery ? matchByTitle(pending, titleQuery) : undefined);

      if (!target) {
        return {
          output: JSON.stringify({
            success: false,
            spokenAnswer: "I couldn't find that task to mark complete.",
          }),
        };
      }

      setState((s) => ({
        ...s,
        reminders: s.reminders.map((r) =>
          r.id === target.id ? { ...r, completed: true } : r
        ),
      }));

      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `Marked "${target.title}" as complete. Nice work.`,
          taskId: target.id,
        }),
        uiAction: { type: "navigate", path: "/calendar" },
      };
    }

    case "add_meeting": {
      const title = String(args.title ?? "Meeting");
      const start = String(args.start ?? new Date().toISOString());
      const end = defaultMeetingEnd(start, args.end ? String(args.end) : undefined);
      const location = args.location ? String(args.location) : undefined;
      const attendees = Array.isArray(args.attendees)
        ? args.attendees.map(String)
        : args.attendees
          ? String(args.attendees)
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : [];

      let event: CalendarEvent;

      if (isGoogleConnected()) {
        const client = await getAuthenticatedClient();
        if (client) {
          event = await createGoogleCalendarEvent(client, {
            title,
            start,
            end,
            location,
            attendees,
            status: "confirmed",
          });
          invalidateGoogleCache();
          const tz = userTimezone(getState());
          const refreshed = await fetchGoogleCalendarEvents(client, tz);
          const integration = {
            connected: true as const,
            email: getGoogleTokens()?.email,
          };
          const cached = getGoogleCache();
          setGoogleCache({
            emails: cached?.emails ?? getState().emails,
            events: refreshed,
            contacts: cached?.contacts ?? getState().contacts,
            integration,
          });
        } else {
          event = {
            id: uuidv4(),
            title,
            start,
            end,
            location,
            attendees,
            status: "confirmed",
          };
          setState((s) => ({ ...s, events: [...s.events, event] }));
        }
      } else {
        event = {
          id: uuidv4(),
          title,
          start,
          end,
          location,
          attendees,
          status: "confirmed",
        };
        setState((s) => ({ ...s, events: [...s.events, event] }));
      }

      const tz = userTimezone(getState());
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `Scheduled "${title}" for ${formatEventTime(start, tz)}.`,
          event: {
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
          },
        }),
        uiAction: { type: "navigate", path: "/calendar" },
      };
    }

    case "delete_all_meetings": {
      const eventIds = Array.isArray(args.event_ids)
        ? args.event_ids.map(String)
        : [];
      const events = await getAllCalendarEvents();
      const toDelete =
        eventIds.length > 0
          ? events.filter((e) => eventIds.includes(e.id))
          : events;

      if (toDelete.length === 0) {
        return {
          output: JSON.stringify({
            success: false,
            spokenAnswer: "There are no meetings on your calendar to delete.",
          }),
        };
      }

      if (isGoogleConnected()) {
        const client = await getAuthenticatedClient();
        if (client) {
          for (const event of toDelete) {
            try {
              await deleteGoogleCalendarEvent(client, event.id);
            } catch {
              /* continue with remaining */
            }
          }
          invalidateGoogleCache();
        }
      }

      const removeIds = new Set(toDelete.map((e) => e.id));
      setState((s) => ({
        ...s,
        events: s.events.filter((e) => !removeIds.has(e.id)),
      }));

      const count = toDelete.length;
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `Removed ${count} meeting${count !== 1 ? "s" : ""} from your calendar.`,
          removedCount: count,
        }),
        uiAction: { type: "navigate", path: "/calendar" },
      };
    }

    case "delete_meeting": {
      const titleQuery = String(args.title ?? args.event_title ?? "");
      const eventId = args.event_id ? String(args.event_id) : undefined;
      const events = await getAllCalendarEvents();
      const target =
        (eventId ? events.find((e) => e.id === eventId) : undefined) ||
        (titleQuery ? findCalendarEvent(events, titleQuery) : undefined);

      if (!target) {
        return {
          output: JSON.stringify({
            success: false,
            spokenAnswer: "I couldn't find that meeting. Try the exact title or open your calendar.",
          }),
        };
      }

      if (isGoogleConnected()) {
        const client = await getAuthenticatedClient();
        if (client) {
          try {
            await deleteGoogleCalendarEvent(client, target.id);
            invalidateGoogleCache();
          } catch {
            return {
              output: JSON.stringify({
                success: false,
                spokenAnswer: "I found the meeting but couldn't remove it from Google Calendar. Try the Calendar page.",
              }),
            };
          }
        }
      }

      setState((s) => ({
        ...s,
        events: s.events.filter((e) => e.id !== target.id),
      }));

      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `Removed the meeting "${target.title}".`,
          removedId: target.id,
        }),
        uiAction: { type: "navigate", path: "/calendar" },
      };
    }

    case "list_contacts": {
      const query = args.query ? String(args.query) : undefined;
      const contacts = getState().contacts.length ? getState().contacts : mockContacts;
      const script = buildContactsScript(contacts, query);
      return {
        output: JSON.stringify({
          spokenAnswer: script,
          contacts: contacts.slice(0, 12).map((c) => ({
            name: c.name,
            role: c.role,
            phone: c.phone,
            whatsapp: c.whatsapp,
          })),
        }),
        uiAction: { type: "navigate", path: "/contacts" },
      };
    }

    case "search_company_knowledge": {
      const query = String(args.query ?? "").trim();
      const result = buildCompanyKnowledgeVoiceAnswer(query);
      return {
        output: JSON.stringify({
          spokenAnswer: result.spokenAnswer,
          available: result.available,
          chunkCount: result.chunkCount,
          context: result.context,
        }),
      };
    }

    case "draft_email_reply": {
      const userMessage = args.user_message ? String(args.user_message) : undefined;
      const draft = await buildVoiceEmailDraft({ userMessage });
      return {
        output: JSON.stringify({
          success: Boolean(draft.targetEmail),
          spokenAnswer: draft.script,
          targetEmail: draft.targetEmail,
          draftPreview: draft.draftPreview,
        }),
        uiAction: { type: "navigate", path: draft.targetEmail ? "/chat" : "/email" },
      };
    }

    case "get_daily_briefing": {
      const script = await buildDailyBriefingScript();
      return {
        output: JSON.stringify({ spokenAnswer: script }),
        uiAction: { type: "navigate", path: "/dashboard" },
      };
    }

    case "get_metal_rates": {
      const rates = await getMarketRatesSummary();
      return {
        output: JSON.stringify({
          spokenAnswer: rates.spokenAnswer,
          gold22PerGram: rates.gold22PerGram,
          gold24PerGram: rates.gold24PerGram,
          silverPerGram: rates.silverPerGram,
          live: rates.live,
        }),
        uiAction: { type: "navigate", path: "/calculator" },
      };
    }

    case "estimate_jewellery_price": {
      const weight = Number(args.weight_grams ?? args.weight ?? 0);
      const result = estimateJewelleryPrice({
        weight_grams: weight,
        karat: args.karat ? String(args.karat) : "22K",
        metal: args.metal ? String(args.metal) : "gold",
        making_percent: args.making_percent != null ? Number(args.making_percent) : undefined,
        tax_percent: args.tax_percent != null ? Number(args.tax_percent) : undefined,
      });
      return {
        output: JSON.stringify({
          spokenAnswer: result.spokenAnswer,
          estimatedTotal: result.total,
        }),
        uiAction: { type: "navigate", path: "/calculator" },
      };
    }

    case "get_industry_news": {
      const script = await getNewsHeadlinesScript();
      return {
        output: JSON.stringify({ spokenAnswer: script }),
        uiAction: { type: "navigate", path: "/news?tab=industry" },
      };
    }

    case "get_sports_news": {
      const script = await getSportsHeadlinesScript();
      return {
        output: JSON.stringify({ spokenAnswer: script }),
        uiAction: { type: "navigate", path: "/news?tab=sports" },
      };
    }

    case "get_politics_news": {
      const script = await getPoliticsHeadlinesScript();
      return {
        output: JSON.stringify({ spokenAnswer: script }),
        uiAction: { type: "navigate", path: "/news?tab=politics" },
      };
    }

    case "open_data_analyst": {
      return {
        output: JSON.stringify({
          spokenAnswer:
            "Opening the Data Analyst. Upload your sales CSV file there, then ask questions like top products or monthly trends. I can guide you on the Analyst page.",
        }),
        uiAction: { type: "navigate", path: "/analyst" },
      };
    }

    case "generate_jewellery_image": {
      const prompt = String(args.prompt ?? "").trim();
      if (!prompt) {
        return {
          output: JSON.stringify({
            success: false,
            spokenAnswer:
              "Please describe the jewelry piece you want to generate, for example a gold bridal necklace with rubies.",
          }),
          uiAction: { type: "navigate", path: "/images" },
        };
      }
      const fullPrompt = `Professional high-end jewelry product photography. ${prompt}. Studio lighting, sharp focus, fine detail on metal and gemstones, elegant clean background, photorealistic, luxury catalog quality.`;
      try {
        const { image, model } = await generateGeminiImage(fullPrompt, "1024x1024", "high");
        setState((s) => ({
          ...s,
          voiceLastImage: {
            prompt,
            src: image,
            createdAt: new Date().toISOString(),
          },
        }));
        return {
          output: JSON.stringify({
            success: true,
            spokenAnswer: `Your jewelry image is ready on the Images page. I created it using ${model}.`,
            model,
          }),
          uiAction: { type: "navigate", path: "/images" },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        return {
          output: JSON.stringify({
            success: false,
            spokenAnswer: `I couldn't generate that image right now. Open the Images page to try again. ${message}`,
          }),
          uiAction: { type: "navigate", path: "/images" },
        };
      }
    }

    case "show_detail_page": {
      const page = String(args.page ?? "dashboard");
      const path = PAGE_PATHS[page] ?? "/dashboard";
      return {
        output: JSON.stringify({ opened: page, path, spokenAnswer: `Opening ${page}.` }),
        uiAction: { type: "navigate", path },
      };
    }

    default:
      return { output: JSON.stringify({ error: `Unknown tool: ${name}` }) };
  }
}
