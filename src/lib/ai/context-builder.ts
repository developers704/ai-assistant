import type { AppState, CalendarEvent, Email } from "@/types";
import { toEmailPreview } from "@/lib/email-html";
import { houseOfBrands, brandPillars } from "@/lib/mock-data/products";
import { buildStoreDirectoryContext } from "@/lib/stores/store-knowledge";
import { getAssistantSalesSummary } from "@/lib/assistant/sales-data";
import { formatCurrency, formatPieceCount, sortTopProducts } from "@/lib/utils";
import {
  userTimezone,
  isTodayInTimezone,
  isEventOnDate,
  dateKeyInTimezone,
  addDaysToDateKey,
  eventDateKey,
} from "@/lib/calendar-dates";

function formatEventTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEmailLine(e: Email): string {
  const flags = [
    !e.isRead ? "unread" : null,
    e.needsReply ? "needs-reply" : null,
    e.category !== "normal" ? e.category : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `- ${e.from} <${e.fromEmail}> | "${e.subject}" | ${flags || "read"} | preview: ${toEmailPreview(e.preview, 120)}`;
}

function eventsForDay(events: CalendarEvent[], dateKey: string, tz: string): CalendarEvent[] {
  return events
    .filter((e) => e.status !== "cancelled" && isEventOnDate(e.start, dateKey, tz))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export function buildAssistantContext(state: AppState): string {
  const user = state.user;
  const tz = userTimezone(state);
  const now = new Date();
  const todayKey = dateKeyInTimezone(now, tz);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  const todayEvents = eventsForDay(state.events, todayKey, tz);
  const tomorrowEvents = eventsForDay(state.events, tomorrowKey, tz);
  const upcoming = state.events
    .filter((e) => e.status !== "cancelled" && !isTodayInTimezone(e.start, tz))
    .filter((e) => eventDateKey(e.start, tz) > todayKey)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 8);

  const salesBundle = getAssistantSalesSummary();
  const sales = salesBundle.summary;
  const topProducts = sortTopProducts(sales.topProducts).slice(0, 3);
  const storeDirectory = buildStoreDirectoryContext();
  const pendingTasks = state.reminders.filter((r) => !r.completed);
  const googleConnected = state.integrations?.google?.connected ?? false;

  return `
## Current date/time
Now (user timezone ${tz}): ${now.toLocaleString("en-US", { timeZone: tz })}
Today: ${todayKey} | Tomorrow: ${tomorrowKey}

## User
Name: ${user?.name ?? "Executive"}
Role: ${user?.role ?? ""}
Company: ${user?.company ?? "Valliani Jewelers"}
Communication style: ${user?.communicationStyle ?? "professional"}

## Company profile
${user?.companyDescription ?? ""}

Brand pillars: ${brandPillars.join(", ")}
House of brands:
${houseOfBrands.map((b) => `- ${b.name}: ${b.tagline}`).join("\n")}

Business priorities:
${(user?.priorities ?? []).map((p) => `- ${p}`).join("\n")}

## Integrations
Gmail/Calendar: ${googleConnected ? `connected (${state.integrations?.google?.email ?? "Google account"})` : "not connected — email/calendar data may be demo"}
${state.integrations?.google?.syncError ? `Sync note: ${state.integrations.google.syncError}` : ""}

## Calendar (${todayEvents.length} today, ${tomorrowEvents.length} tomorrow)
### Today
${todayEvents.length ? todayEvents.map((e) => `- ${formatEventTime(e.start, tz)} — ${e.title}${e.location ? ` @ ${e.location}` : ""}`).join("\n") : "No events today."}

### Tomorrow
${tomorrowEvents.length ? tomorrowEvents.map((e) => `- ${formatEventTime(e.start, tz)} — ${e.title}`).join("\n") : "No events tomorrow."}

### Upcoming (after today)
${upcoming.length ? upcoming.map((e) => `- ${formatEventTime(e.start, tz)} — ${e.title}`).join("\n") : "None listed."}

## Inbox (${state.emails.length} messages)
${state.emails.length ? state.emails.slice(0, 20).map(formatEmailLine).join("\n") : "No emails."}

## Pending tasks (${pendingTasks.length})
${pendingTasks.length ? pendingTasks.slice(0, 15).map((t) => `- [${t.priority}] ${t.title} — due ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ""}`).join("\n") : "No pending tasks."}

## Key contacts
${state.contacts
  .filter((c) => c.isImportant)
  .slice(0, 12)
  .map((c) => `- ${c.name}, ${c.role} @ ${c.company}${c.email ? ` (${c.email})` : ""}`)
  .join("\n")}

## Store directory (authoritative — use for store count and location questions)
${storeDirectory}

## Sales (${salesBundle.source === "report" ? `uploaded report: ${salesBundle.label ?? "latest"}` : "demo POS — call get_today_sales or upload CSV"})
Total revenue: ${formatCurrency(sales.totalRevenue)}
Units: ${sales.totalTransactions.toLocaleString()} | AOV: ${formatCurrency(sales.averageOrderValue)}
vs previous period: ${sales.comparisonPreviousDay.toFixed(1)}%
Top stores: ${sales.topStores.slice(0, 3).map((s) => `${s.name} ${formatCurrency(s.revenue)}`).join("; ")}
Top products: ${topProducts.map((p) => `${p.itemNumber ? `#${p.itemNumber} ` : ""}${p.name} (${formatPieceCount(p.units)})`).join("; ")}

## Pending user confirmations
${state.pendingActions.length ? state.pendingActions.map((a) => `- ${a.type}: ${a.title}`).join("\n") : "None — if user says yes/confirm, tell them nothing is waiting."}
`.trim();
}
