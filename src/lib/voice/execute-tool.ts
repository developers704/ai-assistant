import { v4 as uuidv4 } from "uuid";
import { mockContacts } from "@/lib/mock-data";
import { getState, setState } from "@/lib/store/server-store";
import {
  buildCalendarMarkdown,
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
  buildAnalystReportScript,
  buildSettingsStatusScript,
  estimateJewelleryPrice,
  getMarketRatesSummary,
  getNewsHeadlinesMarkdown,
  getNewsHeadlinesScript,
  getPoliticsHeadlinesMarkdown,
  getPoliticsHeadlinesScript,
  getSportsHeadlinesMarkdown,
  getSportsHeadlinesScript,
} from "@/lib/voice/section-tools";
import { getAssistantSalesSummary, formatSalesReportMarkdown } from "@/lib/assistant/sales-data";
import { buildCompanyKnowledgeVoiceAnswer } from "@/lib/voice/rag-tool";
import {
  answerStoreQuery,
  buildFindNearestStoreToolResult,
  extractStoreQueryPhrase,
  getStoreDetails,
  listStores,
} from "@/lib/stores/store-intelligence";
import {
  fetchInstagramAccount,
  fetchInstagramPosts,
  fetchPostComments,
  fetchPostInsights,
  fetchInstagramConversations,
  fetchConversationMessages,
  getMetaConfig,
} from "@/lib/social/meta-client";
import { draftInstagramCaption, draftCommentReply } from "@/lib/social/instagram-drafts";
import { sortTopProductsByUnits, filterTopProductSkus } from "@/lib/utils";
import { resolveMeetingToolArgs } from "@/lib/ai/meeting-parse";
import { openingSpokenForSection, APP_SECTIONS, type AppSectionId } from "@/lib/ai/app-map";
import { updateUiContext } from "@/lib/store/ui-context";
import { buildSectionContextBlock, buildSectionRuntimeContext } from "@/lib/ai/section-context";
import { updateWorkingMemory } from "@/lib/memory/working-memory";
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
  chat: "/chat",
  contacts: "/contacts",
  images: "/images",
  news: "/news",
  analyst: "/analyst",
  calculator: "/calculator",
  stores: "/stores",
  settings: "/settings",
  social: "/social",
};

/** Prefer canonical APP_SECTIONS routes when available. */
function resolvePagePath(page: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSectionRoute } = require("@/lib/alexa/navigation-resolver") as typeof import("@/lib/alexa/navigation-resolver");
    return resolveSectionRoute(page) ?? PAGE_PATHS[page] ?? "/chat";
  } catch {
    return PAGE_PATHS[page] ?? "/chat";
  }
}

function formatInstagramDate(iso?: string | null): string {
  if (!iso) return "unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown date";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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
      const dateArg =
        typeof args.date === "string" && args.date.trim() ? args.date.trim() : undefined;

      // "Show Novello sales" → open filtered dashboard; speak Opening line only.
      const { wantsSalesShowOnly, wantsSalesExplain } = await import("@/lib/sales/sales-schema");
      const { isOpenSectionRequest } = await import("@/lib/voice/intent");
      if (
        userMessage &&
        wantsSalesShowOnly(userMessage) &&
        !wantsSalesExplain(userMessage) &&
        !isOpenSectionRequest(userMessage)
      ) {
        const { ensureActiveSalesVersion } = await import("@/lib/sales/refresh/service");
        await ensureActiveSalesVersion();
        const { querySales } = await import("@/lib/sales/query-sales");
        const { salesDashboardToQuery } = await import("@/lib/sales/sales-dashboard-state");
        const result = await querySales({
          userMessage,
          dateRange: dateArg
            ? { type: "custom", startDate: dateArg, endDate: dateArg }
            : undefined,
          display: { navigateToSales: true, applyDashboardFilters: true },
        });
        const path = result.dashboardState
          ? salesDashboardToQuery(result.dashboardState)
          : "/sales";
        return {
          output: JSON.stringify({
            success: true,
            navigateTo: path,
            spokenAnswer: result.spokenAnswer,
            speakOnly: result.spokenAnswer,
            instruction: "Speak ONLY the spokenAnswer Opening line. No summary.",
            dashboardState: result.dashboardState,
          }),
          uiAction: { type: "navigate", path },
        };
      }

      const { isSalesUnifiedIntelligenceEnabled } = await import("@/lib/sales/flags");
      if (isSalesUnifiedIntelligenceEnabled()) {
        try {
          const { ensureActiveSalesVersion } = await import("@/lib/sales/refresh/service");
          await ensureActiveSalesVersion();
        } catch {
          // Fall through to legacy sales formatters even if version refresh fails.
        }
      }

      const { detectSalesFocus } = await import("@/lib/ai/sales-focus");
      const {
        formatSalesByFocus,
        formatSalesSpokenBrief,
        getAssistantSalesSummary: getSales,
      } = await import("@/lib/assistant/sales-data");
      const { isValidIsoDate } = await import("@/lib/reports/date-utils");
      const focus = (
        focusArg === "top_store" ||
        focusArg === "top_products" ||
        focusArg === "summary" ||
        focusArg === "full_report"
          ? focusArg
          : detectSalesFocus(userMessage || focusArg)
      ) as "top_store" | "top_products" | "summary" | "full_report";

      const salesOpts = {
        filterDate: dateArg && isValidIsoDate(dateArg) ? dateArg : undefined,
        userMessage: userMessage || undefined,
      };
      const { summary, source, label, vendorCode, filterDate, dateMissing } =
        getSales(salesOpts);
      const topStores = summary.topStores.slice(0, 5);
      const topProducts = sortTopProductsByUnits(filterTopProductSkus(summary.topProducts)).slice(0, 5);
      const synthesizedAnswer = formatSalesByFocus(focus, salesOpts);

      let spoken: string;
      if (dateMissing || filterDate || focus === "summary") {
        spoken = formatSalesSpokenBrief(salesOpts);
      } else if (focus === "top_store" && topStores[0]) {
        spoken = `Your top store is ${topStores[0].name} at ${topStores[0].revenue.toLocaleString()} dollars net.`;
      } else if (focus === "top_products" && topProducts[0]) {
        spoken = `Your top SKU by quantity is ${topProducts[0].itemNumber}, ${topProducts[0].units} units sold, about ${topProducts[0].revenue.toLocaleString()} dollars revenue.`;
      } else if (focus === "full_report") {
        spoken = source === "report"
          ? `Full report${label ? ` ${label}` : ""}: ${summary.totalRevenue.toLocaleString()} dollars net, ${summary.totalTransactions.toLocaleString()} units across ${summary.topStores.length} stores.`
          : `Demo sales data: ${summary.totalRevenue.toLocaleString()} dollars. Upload a CSV in Data Analyst for live numbers.`;
      } else {
        spoken = formatSalesSpokenBrief(salesOpts);
      }

      const salesPath = filterDate
        ? `/sales?date=${encodeURIComponent(filterDate)}`
        : "/sales";

      return {
        output: JSON.stringify({
          source,
          reportLabel: label,
          vendorCode,
          focus,
          filterDate: filterDate ?? null,
          dateMissing: dateMissing ?? false,
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
            focus === "full_report"
              ? formatSalesReportMarkdown(salesOpts)
              : synthesizedAnswer,
          note:
            source === "report"
              ? `From uploaded report${vendorCode ? ` (${vendorCode})` : ""}${filterDate ? ` · ${filterDate}` : ""}.`
              : "Demo POS data — upload CSV in Data Analyst.",
        }),
        uiAction: { type: "navigate", path: salesPath },
      };
    }

    case "query_sales":
    case "compare_sales":
    case "get_sales_entity_details":
    case "get_top_vendor_models":
    case "apply_sales_dashboard_filters": {
      const { ensureActiveSalesVersion } = await import("@/lib/sales/refresh/service");
      await ensureActiveSalesVersion();
      const { querySales } = await import("@/lib/sales/query-sales");
      const { salesDashboardToQuery } = await import("@/lib/sales/sales-dashboard-state");
      const userMessage = args.user_message ? String(args.user_message) : "";

      if (name === "compare_sales") {
        const left = String(args.left ?? "");
        const right = String(args.right ?? "");
        const result = await querySales({
          userMessage: userMessage || `Compare ${left} and ${right}`,
          comparison: {
            mode: "compare_entities",
            entityType: args.entity_type as
              | "store"
              | "department"
              | "design"
              | "vendor"
              | "class"
              | "product"
              | undefined,
            entities: left && right ? [left, right] : undefined,
          },
          display: {
            navigateToSales: args.navigate !== false && (args.navigate === true || /\b(show|open|dikhao)\b/i.test(userMessage)),
            applyDashboardFilters: true,
          },
        });
        const path = result.dashboardState
          ? salesDashboardToQuery(result.dashboardState)
          : "/sales";
        return {
          output: JSON.stringify({
            ...result,
            synthesizedAnswer: result.textAnswer,
            spokenAnswer: result.spokenAnswer,
          }),
          uiAction:
            result.dashboardState && (args.navigate === true || /\b(show|open|dikhao)\b/i.test(userMessage))
              ? { type: "navigate", path }
              : undefined,
        };
      }

      if (name === "get_sales_entity_details") {
        const entityType = String(args.entity_type || "store") as
          | "store"
          | "department"
          | "design"
          | "vendor"
          | "class"
          | "product";
        const entityName = String(args.entity_name || "");
        const filterKey =
          entityType === "store"
            ? "stores"
            : entityType === "department"
              ? "departments"
              : entityType === "design"
                ? "designs"
                : entityType === "vendor"
                  ? "vendors"
                  : entityType === "class"
                    ? "classes"
                    : "products";
        const result = await querySales({
          userMessage,
          [filterKey]: entityName ? [entityName] : undefined,
          groupBy: ["store", "department", "vendor", "design", "class", "vendor_model"],
          display: {
            navigateToSales: args.navigate !== false,
            applyDashboardFilters: true,
            openDetailPanel: true,
            detailType: entityType === "product" ? "design" : entityType,
            detailValue: entityName,
          },
        });
        const path = result.dashboardState
          ? salesDashboardToQuery(result.dashboardState)
          : "/sales";
        return {
          output: JSON.stringify({
            ...result,
            synthesizedAnswer: result.textAnswer,
            spokenAnswer: result.spokenAnswer,
          }),
          uiAction: { type: "navigate", path },
        };
      }

      if (name === "get_top_vendor_models") {
        const result = await querySales({
          userMessage,
          vendors: Array.isArray(args.vendors) ? (args.vendors as string[]) : undefined,
          designs: Array.isArray(args.designs) ? (args.designs as string[]) : undefined,
          departments: Array.isArray(args.departments)
            ? (args.departments as string[])
            : undefined,
          stores: Array.isArray(args.stores) ? (args.stores as string[]) : undefined,
          groupBy: ["vendor_model"],
          include: { topVendorModels: true, summary: true },
          limit: typeof args.limit === "number" ? args.limit : 10,
          display: {
            navigateToSales: Boolean(args.navigate) || /\b(show|dikhao|open)\b/i.test(userMessage),
            applyDashboardFilters: true,
          },
        });
        const path = result.dashboardState
          ? salesDashboardToQuery(result.dashboardState)
          : "/sales";
        return {
          output: JSON.stringify({
            ...result,
            synthesizedAnswer: result.textAnswer,
            spokenAnswer: result.spokenAnswer,
            topVendorModels: result.rankings?.topVendorModels ?? result.breakdowns?.byVendorModel,
          }),
          uiAction:
            args.navigate === true || /\b(show|dikhao|open)\b/i.test(userMessage)
              ? { type: "navigate", path }
              : undefined,
        };
      }

      if (name === "apply_sales_dashboard_filters") {
        // Entity filters come from the spoken line only — do not trust model-filled
        // designs/stores/etc. (e.g. leftover "EA" when user said "Great Mall sales").
        const result = await querySales({
          userMessage:
            userMessage ||
            [
              Array.isArray(args.stores) ? (args.stores as string[]).join(" ") : "",
              Array.isArray(args.designs) ? (args.designs as string[]).join(" ") : "",
              Array.isArray(args.departments)
                ? (args.departments as string[]).join(" ")
                : "",
              Array.isArray(args.vendors) ? (args.vendors as string[]).join(" ") : "",
              Array.isArray(args.classes) ? (args.classes as string[]).join(" ") : "",
              args.date ? String(args.date) : "",
              "sales",
            ]
              .filter(Boolean)
              .join(" "),
          resetContext: true,
          dateRange: args.date
            ? { type: "custom", startDate: String(args.date), endDate: String(args.date) }
            : undefined,
          display: { navigateToSales: true, applyDashboardFilters: true },
        });
        const path = result.dashboardState
          ? salesDashboardToQuery(result.dashboardState)
          : "/sales";
        return {
          output: JSON.stringify({
            success: true,
            navigateTo: path,
            synthesizedAnswer: result.textAnswer,
            spokenAnswer: result.spokenAnswer || "Opening Sales Dashboard.",
            speakOnly: result.spokenAnswer || "Opening Sales Dashboard.",
            instruction: "Speak ONLY the spokenAnswer line. Do not summarize sales numbers unless the user asked to explain or discuss.",
            dashboardState: result.dashboardState,
          }),
          uiAction: { type: "navigate", path },
        };
      }

      // query_sales
      const result = await querySales({
        userMessage,
        designs: Array.isArray(args.designs) ? (args.designs as string[]) : undefined,
        departments: Array.isArray(args.departments)
          ? (args.departments as string[])
          : undefined,
        stores: Array.isArray(args.stores) ? (args.stores as string[]) : undefined,
        vendors: Array.isArray(args.vendors) ? (args.vendors as string[]) : undefined,
        classes: Array.isArray(args.classes) ? (args.classes as string[]) : undefined,
        groupBy: Array.isArray(args.groupBy)
          ? (args.groupBy as Array<
              | "date"
              | "store"
              | "department"
              | "design"
              | "vendor"
              | "class"
              | "product"
              | "sku"
              | "vendor_model"
            >)
          : undefined,
        dateRange: args.date_type
          ? {
              type: String(args.date_type) as
                | "today"
                | "yesterday"
                | "this_week"
                | "last_week"
                | "this_month"
                | "last_month"
                | "all_dates"
                | "custom",
              startDate: args.start_date ? String(args.start_date) : undefined,
              endDate: args.end_date ? String(args.end_date) : undefined,
            }
          : args.start_date
            ? {
                type: "custom",
                startDate: String(args.start_date),
                endDate: String(args.end_date ?? args.start_date),
              }
            : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
        display: {
          navigateToSales:
            args.navigate === true ||
            /\b(explain|discuss|summarize|summary|overview)\b/i.test(userMessage) ||
            (args.navigate !== false && /\b(show|dikhao|open|kholo|give(?:\s+me)?|get(?:\s+me)?|pull up|bring up)\b/i.test(userMessage)),
          applyDashboardFilters: true,
        },
      });
      const path = result.dashboardState
        ? salesDashboardToQuery(result.dashboardState)
        : "/sales";
      const shouldNav = Boolean(
        args.navigate === true ||
          (result.dashboardState &&
            (/\b(explain|discuss|summarize|summary|overview)\b/i.test(userMessage) ||
              (args.navigate !== false &&
                /\b(show|dikhao|open|kholo|give(?:\s+me)?|get(?:\s+me)?|pull up|bring up)\b/i.test(userMessage))))
      );
      return {
        output: JSON.stringify({
          ...result,
          synthesizedAnswer: result.textAnswer,
          spokenAnswer: result.spokenAnswer,
        }),
        uiAction: shouldNav ? { type: "navigate", path } : undefined,
      };
    }

    case "get_sales_snapshot": {
      const { ensureActiveSalesVersion } = await import("@/lib/sales/refresh/service");
      await ensureActiveSalesVersion();
      const { readActiveSnapshot } = await import("@/lib/sales/data/version-store");
      const { compactSnapshotSummary } = await import("@/lib/sales/snapshot/builder");
      const snapshot = readActiveSnapshot();
      if (!snapshot) {
        return {
          output: JSON.stringify({
            success: false,
            spokenAnswer: "No sales snapshot is available yet. Upload a report or refresh sales data.",
          }),
        };
      }
      const compact = compactSnapshotSummary(snapshot);
      const spoken = `Sales snapshot through ${compact.dataThrough ?? "unknown"}: ${Math.round(compact.summary.netSales).toLocaleString()} dollars net, ${compact.summary.units.toLocaleString()} units.`;
      return {
        output: JSON.stringify({
          success: true,
          snapshot: compact,
          spokenAnswer: spoken,
          markdown: spoken,
        }),
        uiAction: { type: "navigate", path: "/sales" },
      };
    }

    case "get_sales_data_status": {
      const { ensureActiveSalesVersion } = await import("@/lib/sales/refresh/service");
      await ensureActiveSalesVersion();
      const { getActiveSalesStatus } = await import("@/lib/sales/data/version-store");
      const status = getActiveSalesStatus();
      const meta = status.metadata;
      const spoken = meta
        ? `Active sales version ${meta.dataVersion}. Data through ${meta.dataThrough ?? "unknown"}, ${meta.validRowCount.toLocaleString()} valid rows.`
        : "No active sales version is loaded yet.";
      return {
        output: JSON.stringify({
          success: Boolean(meta),
          ...status,
          spokenAnswer: spoken,
          markdown: spoken,
        }),
      };
    }

    case "get_sales_insights": {
      const { ensureActiveSalesVersion } = await import("@/lib/sales/refresh/service");
      await ensureActiveSalesVersion();
      const { readActiveSnapshot } = await import("@/lib/sales/data/version-store");
      const snapshot = readActiveSnapshot();
      if (!snapshot) {
        return {
          output: JSON.stringify({
            success: false,
            spokenAnswer: "No sales insights yet — refresh sales data first.",
          }),
        };
      }
      const top = snapshot.insights.topPerformers[0];
      const weak = snapshot.insights.weakPerformers[0];
      const lowMargin = snapshot.insights.highSalesLowMarginEntities[0];
      const spoken = [
        top?.description,
        weak?.description,
        lowMargin?.description,
      ]
        .filter(Boolean)
        .slice(0, 2)
        .join(" ");
      return {
        output: JSON.stringify({
          success: true,
          insights: snapshot.insights,
          spokenAnswer: spoken || "Insights are ready on the Sales Dashboard.",
          markdown: spoken || "Insights are ready on the Sales Dashboard.",
        }),
        uiAction: { type: "navigate", path: "/sales" },
      };
    }

    case "refresh_sales_data": {
      const { refreshSalesData } = await import("@/lib/sales/refresh/service");
      const result = await refreshSalesData({
        force: args.force !== false,
        clearMemory: true,
      });
      const spoken = result.success
        ? result.skipped
          ? "Sales data is already up to date."
          : `Sales data refreshed. Version ${result.dataVersion} with ${result.validRows.toLocaleString()} rows through ${result.dateRange.to ?? "the latest date"}.`
        : `I couldn't refresh sales data. ${result.errors[0] ?? "Please try again."}`;
      return {
        output: JSON.stringify({
          ...result,
          spokenAnswer: spoken,
          markdown: spoken,
        }),
        uiAction: result.success ? { type: "navigate", path: "/sales" } : undefined,
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
      const markdown = buildCalendarMarkdown(events, tz);
      return {
        output: JSON.stringify({
          date: todayKey,
          timezone: tz,
          eventCount: events.length,
          spokenAnswer: script,
          markdown,
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
      const resolved = resolveMeetingToolArgs(args, getState());
      const title = resolved.title;
      const start = resolved.start;
      const end = defaultMeetingEnd(start, resolved.end);
      const location = resolved.location;
      const attendees = resolved.attendees;

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
      const userMessage = args.user_message
        ? String(args.user_message)
        : args.query
          ? String(args.query)
          : undefined;
      const result = buildCompanyKnowledgeVoiceAnswer(userMessage ?? "");
      return {
        output: JSON.stringify({
          spokenAnswer: result.markdown ?? result.spokenAnswer,
          markdown: result.markdown ?? result.spokenAnswer,
          available: result.available,
          chunkCount: result.chunkCount,
          context: result.context,
          mode: result.mode,
        }),
      };
    }

    case "get_store_directory": {
      const userMessage = args.user_message
        ? String(args.user_message)
        : args.query
          ? String(args.query)
          : "";
      const answer = answerStoreQuery(userMessage);
      return {
        output: JSON.stringify({
          spokenAnswer: answer.markdown,
          markdown: answer.markdown,
          intent: answer.intent,
        }),
      };
    }

    case "list_valliani_stores": {
      const payload = listStores({
        state: args.state ? String(args.state) : undefined,
        city: args.city ? String(args.city) : undefined,
        region: args.region ? String(args.region) : undefined,
        status: args.status ? String(args.status) : undefined,
      });
      return {
        output: JSON.stringify({
          spokenAnswer: payload.message,
          markdown: payload.message,
          ok: payload.ok,
          stores: payload.stores,
        }),
      };
    }

    case "get_valliani_store_details": {
      const details = getStoreDetails({
        id: args.id ? String(args.id) : undefined,
        storeName: args.storeName ? String(args.storeName) : args.query ? String(args.query) : undefined,
        city: args.city ? String(args.city) : undefined,
      });
      return {
        output: JSON.stringify({
          spokenAnswer: details.message,
          markdown: details.message,
          ok: details.ok,
          store: details.store,
        }),
      };
    }

    case "find_nearest_store": {
      const userMessage = args.user_message ? String(args.user_message) : "";
      const storeName = args.storeName
        ? String(args.storeName)
        : userMessage
          ? extractStoreQueryPhrase(userMessage)
          : undefined;
      const result = buildFindNearestStoreToolResult({
        storeName,
        city: args.city ? String(args.city) : undefined,
        state: args.state ? String(args.state) : undefined,
        limit: typeof args.limit === "number" ? args.limit : 3,
      });
      return {
        output: JSON.stringify({
          spokenAnswer: result.message,
          markdown: result.message,
          ...result,
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
      const result = await estimateJewelleryPrice({
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
      const markdown = await getNewsHeadlinesMarkdown();
      return {
        output: JSON.stringify({ spokenAnswer: script, markdown }),
        uiAction: { type: "navigate", path: "/news?tab=industry" },
      };
    }

    case "get_sports_news": {
      const script = await getSportsHeadlinesScript();
      const markdown = await getSportsHeadlinesMarkdown();
      return {
        output: JSON.stringify({ spokenAnswer: script, markdown }),
        uiAction: { type: "navigate", path: "/news?tab=sports" },
      };
    }

    case "get_politics_news": {
      const script = await getPoliticsHeadlinesScript();
      const markdown = await getPoliticsHeadlinesMarkdown();
      return {
        output: JSON.stringify({ spokenAnswer: script, markdown }),
        uiAction: { type: "navigate", path: "/news?tab=politics" },
      };
    }

    case "open_data_analyst": {
      const userMessage = args.user_message ? String(args.user_message) : undefined;
      const openOnly =
        !userMessage ||
        /^(?:please\s+)?(?:open|go to|take me to|show(?:\s+me)?)\b/i.test(userMessage.trim());
      if (openOnly) {
        return {
          output: JSON.stringify({
            spokenAnswer: openingSpokenForSection("analyst"),
            hasReport: getAssistantSalesSummary().source === "report",
          }),
          uiAction: { type: "navigate", path: "/analyst" },
        };
      }
      const script = buildAnalystReportScript(userMessage);
      return {
        output: JSON.stringify({
          spokenAnswer: script,
          hasReport: getAssistantSalesSummary().source === "report",
        }),
        uiAction: { type: "navigate", path: "/analyst" },
      };
    }

    case "get_settings_status": {
      const script = buildSettingsStatusScript();
      return {
        output: JSON.stringify({ spokenAnswer: script }),
        uiAction: { type: "navigate", path: "/settings" },
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

    case "get_instagram_account": {
      const result = await fetchInstagramAccount();
      if (!result.ok) {
        return {
          output: JSON.stringify({ success: false, spokenAnswer: result.error, error: result.error, code: result.code }),
          uiAction: { type: "navigate", path: "/social" },
        };
      }
      const a = result.data;
      const followers = a.followersCount != null ? a.followersCount.toLocaleString() : "unavailable";
      const spoken = `Instagram @${a.username}${a.name ? ` (${a.name})` : ""} has ${followers} followers and ${a.mediaCount ?? 0} posts.`;
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: spoken,
          markdown: `**@${a.username}**${a.name ? ` — ${a.name}` : ""}\n\n- Followers: **${followers}**\n- Posts: **${a.mediaCount ?? 0}**`,
          account: a,
        }),
        uiAction: { type: "navigate", path: "/social" },
      };
    }

    case "get_instagram_recent_posts": {
      const limit = typeof args.limit === "number" ? args.limit : 12;
      const result = await fetchInstagramPosts(limit);
      if (!result.ok) {
        return {
          output: JSON.stringify({ success: false, spokenAnswer: result.error, error: result.error, code: result.code }),
          uiAction: { type: "navigate", path: "/social" },
        };
      }
      const posts = result.data;
      if (posts.length === 0) {
        return {
          output: JSON.stringify({ success: true, spokenAnswer: "No Instagram posts found.", markdown: "No Instagram posts found.", posts: [] }),
          uiAction: { type: "navigate", path: "/social" },
        };
      }
      const lines = posts.slice(0, 8).map((p) => {
        const caption = (p.caption ?? "").replace(/\s+/g, " ").slice(0, 60);
        return `- ${formatInstagramDate(p.timestamp)} · ${p.mediaType ?? "POST"} · ❤ ${p.likeCount ?? "—"} · 💬 ${p.commentsCount ?? "—"}${caption ? ` — ${caption}` : ""}`;
      });
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `You have ${posts.length} recent Instagram posts. The latest is from ${formatInstagramDate(posts[0].timestamp)}.`,
          markdown: `**Recent Instagram posts** (${posts.length})\n\n${lines.join("\n")}`,
          posts,
        }),
        uiAction: { type: "navigate", path: "/social" },
      };
    }

    case "get_instagram_post_comments": {
      const mediaId = String(args.mediaId ?? "").trim();
      if (!mediaId) {
        return {
          output: JSON.stringify({ success: false, spokenAnswer: "I need the post ID to fetch comments. Open the Social page and pick a post." }),
          uiAction: { type: "navigate", path: "/social" },
        };
      }
      const result = await fetchPostComments(mediaId);
      if (!result.ok) {
        return {
          output: JSON.stringify({ success: false, spokenAnswer: result.error, error: result.error, code: result.code }),
        };
      }
      const comments = result.data;
      if (comments.length === 0) {
        return {
          output: JSON.stringify({ success: true, spokenAnswer: "Comments are not available for this post.", markdown: "Comments are not available for this post.", comments: [] }),
        };
      }
      const lines = comments.slice(0, 8).map((c) => `- **@${c.username ?? "user"}**: ${(c.text ?? "").slice(0, 100)}`);
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `This post has ${comments.length} comment${comments.length !== 1 ? "s" : ""}.`,
          markdown: `**Comments** (${comments.length})\n\n${lines.join("\n")}`,
          comments,
        }),
      };
    }

    case "get_instagram_post_insights": {
      const mediaId = String(args.mediaId ?? "").trim();
      if (!mediaId) {
        return {
          output: JSON.stringify({ success: false, spokenAnswer: "I need the post ID to fetch insights." }),
          uiAction: { type: "navigate", path: "/social" },
        };
      }
      const result = await fetchPostInsights(mediaId);
      if (!result.ok) {
        const msg = result.code === "METRIC_UNAVAILABLE" ? "Insight metric not available for this media type." : result.error;
        return {
          output: JSON.stringify({ success: false, spokenAnswer: msg, error: msg, code: result.code, insights: [] }),
        };
      }
      const insights = result.data;
      const lines = insights.map((i) => `- ${i.title ?? i.name}: **${i.value ?? "—"}**`);
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: insights.length
            ? `Post performance: ${insights.map((i) => `${i.title ?? i.name} ${i.value ?? "n/a"}`).join(", ")}.`
            : "No insight metrics were returned for this post.",
          markdown: insights.length ? `**Post insights**\n\n${lines.join("\n")}` : "No insight metrics available for this post.",
          insights,
        }),
      };
    }

    case "get_instagram_inbox": {
      const result = await fetchInstagramConversations(25);
      if (!result.ok) {
        return {
          output: JSON.stringify({ success: false, spokenAnswer: result.error, error: result.error, code: result.code }),
          uiAction: { type: "navigate", path: "/social" },
        };
      }
      const convs = result.data;
      if (convs.length === 0) {
        return {
          output: JSON.stringify({ success: true, spokenAnswer: "No Instagram DMs yet. When people message your business, conversations appear on the Social Inbox tab.", markdown: "No Instagram DMs yet.", conversations: [] }),
          uiAction: { type: "navigate", path: "/social" },
        };
      }
      const cfg = getMetaConfig();
      const lines = convs.slice(0, 8).map((c) => {
        const other = c.participants.find((p) => p.id !== cfg.igBusinessId) ?? c.participants[0];
        return `- @${other?.username ?? "user"}${c.unreadCount ? ` (${c.unreadCount} new)` : ""}: ${(c.snippet ?? "").slice(0, 60)}`;
      });
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `You have ${convs.length} Instagram DM conversation${convs.length !== 1 ? "s" : ""}. Open the Social Inbox tab to reply.`,
          markdown: `**Instagram inbox** (${convs.length})\n\n${lines.join("\n")}`,
          conversations: convs,
        }),
        uiAction: { type: "navigate", path: "/social" },
      };
    }

    case "get_instagram_conversation": {
      const conversationId = String(args.conversationId ?? "").trim();
      if (!conversationId) {
        return {
          output: JSON.stringify({ success: false, spokenAnswer: "I need a conversation ID. Open the Social Inbox tab and pick a thread." }),
          uiAction: { type: "navigate", path: "/social" },
        };
      }
      const result = await fetchConversationMessages(conversationId);
      if (!result.ok) {
        return { output: JSON.stringify({ success: false, spokenAnswer: result.error, error: result.error, code: result.code }) };
      }
      const msgs = result.data;
      if (msgs.length === 0) {
        return { output: JSON.stringify({ success: true, spokenAnswer: "No messages in this conversation.", markdown: "No messages in this conversation.", messages: [] }) };
      }
      const cfg = getMetaConfig();
      const lines = msgs.slice(-10).map((m) => {
        const mine = m.from?.id === cfg.igBusinessId;
        return `${mine ? "You" : `@${m.from?.username ?? "them"}`}: ${(m.message ?? "[non-text]").slice(0, 80)}`;
      });
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `Showing ${msgs.length} message${msgs.length !== 1 ? "s" : ""} in this thread.`,
          markdown: `**Thread**\n\n${lines.join("\n")}`,
          messages: msgs,
        }),
      };
    }

    case "draft_instagram_dm": {
      const incoming = String(args.message ?? "").trim();
      const intent = args.intent ? String(args.intent) : undefined;
      const to = args.to ? String(args.to) : undefined;
      const base = intent ? intent : "a friendly, on-brand reply that thanks them and offers to help";
      const draftText = to
        ? `Hi @${to.replace(/^@/, "")}, thanks for reaching out! ${intent ? intent : "We'd love to help — let us know how we can."} 💎`
        : `Thanks so much for reaching out! We'd love to help — feel free to share any details and our team will take it from there. 💎`;
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: "Here's a DM draft. Review it on the Social Inbox tab and tap Send to confirm — I never send automatically.",
          markdown: `**DM reply draft** (draft only — not sent)\n\n${draftText}\n\n_Intent: ${base}_`,
          draft: draftText,
          to,
          note: "Draft only. Sending needs confirmation in the Social Inbox and is subject to Meta's 24-hour window.",
        }),
      };
    }

    case "open_social_dashboard": {
      return {
        output: JSON.stringify({
          opened: "social",
          path: "/social",
          spokenAnswer: openingSpokenForSection("social"),
        }),
        uiAction: { type: "navigate", path: "/social" },
      };
    }

    case "draft_instagram_caption": {
      const topic = String(args.topic ?? "").trim();
      const draft = draftInstagramCaption(topic);
      const md = `**Caption drafts** (draft only — not published)\n\n${draft.variations
        .map((v, i) => `${i + 1}. ${v}`)
        .join("\n\n")}\n\n${draft.hashtags.join(" ")}`;
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `Here are ${draft.variations.length} caption drafts. Publishing needs confirmation and is not enabled yet.`,
          markdown: md,
          variations: draft.variations,
          hashtags: draft.hashtags,
          note: draft.note,
        }),
      };
    }

    case "draft_instagram_comment_reply": {
      const comment = String(args.comment ?? "").trim();
      const commenter = args.commenter ? String(args.commenter) : undefined;
      const draft = draftCommentReply(comment, commenter);
      return {
        output: JSON.stringify({
          success: true,
          spokenAnswer: `Here's a reply draft. Replying needs confirmation and is not enabled yet.`,
          markdown: `**Reply draft** (draft only — not posted)\n\n${draft.reply}`,
          reply: draft.reply,
          note: draft.note,
        }),
      };
    }

    case "show_detail_page": {
      const page = String(args.page ?? "chat");
      const path = resolvePagePath(page);
      const spokenAnswer = openingSpokenForSection(page);
      updateUiContext({ currentPath: path, lastOpenedPage: path });
      updateWorkingMemory({ currentPage: path, lastTopic: page });
      const state = getState();
      const sectionCtx = buildSectionRuntimeContext(state);
      const sectionBrief = buildSectionContextBlock(sectionCtx);
      const section = APP_SECTIONS[page as AppSectionId];
      return {
        output: JSON.stringify({
          opened: page,
          path,
          spokenAnswer,
          // For the model only — do NOT speak this; use on follow-up questions.
          sectionBrief,
          availableData: section?.availableData ?? [],
          relatedTools: section?.relatedTools ?? [],
          speakOnly: spokenAnswer,
          instruction:
            "Speak ONLY the spokenAnswer line. Do not summarize the section. On later questions while here, use relatedTools and sectionBrief.",
        }),
        uiAction: { type: "navigate", path },
      };
    }

    default:
      return { output: JSON.stringify({ error: `Unknown tool: ${name}` }) };
  }
}
