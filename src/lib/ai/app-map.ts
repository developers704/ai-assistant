/**
 * Canonical map of every Alexa app section — routes, tools, and response guidance.
 */

export type AppSectionId =
  | "chat"
  | "dashboard"
  | "news"
  | "email"
  | "calendar"
  | "sales"
  | "calculator"
  | "analyst"
  | "images"
  | "contacts"
  | "settings";

export interface AppSectionDefinition {
  id: AppSectionId;
  label: string;
  route: string;
  purpose: string;
  availableData: string[];
  relatedTools: string[];
  commonQuestions: string[];
  whenToNavigate: string;
  whenToClarify: string;
  whenToUseLiveTool: string;
  exampleResponses: Record<string, string>;
  /** Keywords for matching user questions about this section */
  aliases: string[];
}

const section = (
  def: Omit<AppSectionDefinition, "aliases"> & { aliases?: string[] }
): AppSectionDefinition => ({
  ...def,
  aliases: def.aliases ?? [def.label.toLowerCase(), def.id],
});

export const APP_SECTIONS: Record<AppSectionId, AppSectionDefinition> = {
  chat: section({
    id: "chat",
    label: "AI Chat",
    route: "/chat",
    purpose:
      "Executive command center — ask anything, draft emails, schedule meetings, and get focused answers without leaving chat.",
    availableData: [
      "Chat history",
      "Pending email/meeting confirmations",
      "Voice assistant",
      "Quick-action suggestions",
    ],
    relatedTools: [
      "get_today_sales",
      "get_email_summary",
      "get_calendar_today",
      "draft_email_reply",
      "add_meeting",
      "get_industry_news",
      "search_company_knowledge",
    ],
    commonQuestions: [
      "Draft an email to Ross",
      "What's my top store?",
      "Schedule a meeting tomorrow",
      "Summarize my inbox",
    ],
    whenToNavigate:
      "When user wants a dedicated workspace (full inbox, calendar grid, sales charts) instead of chat.",
    whenToClarify:
      "When intent is ambiguous between read vs write (e.g. 'email' could mean inbox summary or compose).",
    whenToUseLiveTool:
      "Always call the relevant tool before answering live sales, inbox, or calendar questions.",
    exampleResponses: {
      greeting:
        "I'm Alexa, your executive assistant. Ask me about sales, email, calendar, news, or say what you'd like done.",
      capabilities:
        "Here I can answer questions, draft emails, schedule meetings, and pull live sales or inbox data — all in one place.",
    },
    aliases: ["ai chat", "chat", "assistant", "alexa"],
  }),

  dashboard: section({
    id: "dashboard",
    label: "Daily Briefing",
    route: "/dashboard",
    purpose:
      "Morning executive snapshot — today's priorities, meetings, urgent email, tasks, and sales pulse in one view.",
    availableData: [
      "Today's calendar events",
      "Urgent / unread email highlights",
      "Pending tasks",
      "Sales trend vs yesterday",
      "AI-generated daily briefing",
    ],
    relatedTools: ["get_daily_briefing", "get_calendar_today", "get_email_summary", "get_today_sales"],
    commonQuestions: [
      "What's my briefing today?",
      "What should I focus on?",
      "Any urgent items?",
    ],
    whenToNavigate: "When user wants the full briefing dashboard instead of a chat summary.",
    whenToClarify: "When user asks for 'briefing' but means a specific area (sales only, email only).",
    whenToUseLiveTool: "Call get_daily_briefing for a spoken/text executive summary.",
    exampleResponses: {
      explain:
        "**Daily Briefing** pulls your calendar, inbox priorities, tasks, and sales into one executive snapshot. Say **open briefing** or ask *what's my focus today?*",
      capabilities:
        "Here I can summarize your day, flag urgent email, list meetings, and highlight sales movement — ask *what's my briefing?*",
    },
    aliases: ["daily briefing", "briefing", "dashboard", "morning briefing"],
  }),

  news: section({
    id: "news",
    label: "News & Markets",
    route: "/news",
    purpose:
      "Jewelry industry headlines plus live gold/silver rates and market charts (stocks, sports, politics tabs).",
    availableData: [
      "Industry RSS headlines",
      "Live gold & silver spot rates",
      "Market / sports / politics news tabs",
      "Calculator-linked metal prices",
    ],
    relatedTools: [
      "get_industry_news",
      "get_metal_rates",
      "get_sports_news",
      "get_politics_news",
    ],
    commonQuestions: [
      "What's happening in jewelry news?",
      "Gold price today?",
      "Open industry headlines",
    ],
    whenToNavigate: "When user wants full charts, tabs, or live scrolling headlines.",
    whenToClarify: "When user says 'markets' — clarify industry vs stocks vs metals.",
    whenToUseLiveTool: "Call get_industry_news or get_metal_rates — never guess prices.",
    exampleResponses: {
      explain:
        "**News & Markets** covers jewelry industry headlines, live **gold/silver** prices, and tabs for markets, sports, and politics. Say **open news** for the full page.",
      capabilities:
        "Here I can fetch industry headlines, live gold and silver rates, and summarize market news. Try *what's gold at today?* or *jewelry industry news*.",
    },
    aliases: ["news", "markets", "market", "gold", "silver", "industry news"],
  }),

  email: section({
    id: "email",
    label: "Email",
    route: "/email",
    purpose:
      "Gmail-connected inbox — read, prioritize urgent mail, and draft/send replies with confirmation.",
    availableData: [
      "Inbox threads (Gmail or demo)",
      "Selected email context",
      "Unread / urgent / needs-reply flags",
      "Draft pending actions",
    ],
    relatedTools: ["get_email_summary", "draft_email_reply"],
    commonQuestions: [
      "Any urgent emails?",
      "Reply to this",
      "Send email to Ross",
      "Summarize inbox",
    ],
    whenToNavigate: "When user needs to browse threads or read full HTML bodies.",
    whenToClarify:
      "When no email is selected and user says 'reply to this' — ask which thread or offer inbox summary.",
    whenToUseLiveTool: "Call get_email_summary for counts; draft_email_reply for compose (uses selectedEmail).",
    exampleResponses: {
      explain:
        "This is your **Email** workspace — inbox with urgent flags and reply drafting. Select a message, then say **reply to this**.",
      capabilities:
        "Here I can summarize unread mail, surface urgent items, and draft replies to the selected email. Select a message first for *reply to this*.",
      replyNoSelection:
        "Select an email on the left first, then say **reply to this** — or tell me who to email (e.g. *send email to Ross*).",
    },
    aliases: ["email", "inbox", "mail", "gmail"],
  }),

  calendar: section({
    id: "calendar",
    label: "Calendar & Tasks",
    route: "/calendar",
    purpose:
      "Google Calendar meetings plus internal tasks/reminders — view, schedule, and cancel with confirmation.",
    availableData: [
      "Today's and upcoming events",
      "Selected meeting",
      "Pending tasks / reminders",
      "Meeting create/cancel pending actions",
    ],
    relatedTools: [
      "get_calendar_today",
      "list_tasks",
      "add_meeting",
      "delete_meeting",
      "delete_all_meetings",
      "add_task",
      "delete_task",
    ],
    commonQuestions: [
      "What's on my calendar?",
      "Schedule meeting with Ross tomorrow",
      "Remove all meetings",
      "My tasks",
    ],
    whenToNavigate: "When user wants the full calendar grid or task list UI.",
    whenToClarify:
      "Bulk delete vs single meeting; missing time or attendee for new meetings.",
    whenToUseLiveTool:
      "Call get_calendar_today / list_tasks for live schedule; stage dangerous deletes.",
    exampleResponses: {
      explain:
        "**Calendar & Tasks** shows meetings and to-dos. I can list today's schedule, book meetings, or remove events — destructive actions need your **yes** to confirm.",
      capabilities:
        "Here I can list today's meetings and tasks, schedule new meetings, or cancel events. Try *what's on my calendar?* or *set meeting with Ross tomorrow*.",
    },
    aliases: ["calendar", "tasks", "meetings", "schedule", "calender"],
  }),

  sales: section({
    id: "sales",
    label: "Sales Dashboard",
    route: "/sales",
    purpose:
      "Store-level POS sales from uploaded CSV — revenue, top stores/products, margins, and trends.",
    availableData: [
      "Latest uploaded sales report",
      "Top stores & products",
      "Net/gross revenue, discounts, margin",
      "Selected report metadata",
    ],
    relatedTools: ["get_today_sales", "open_data_analyst"],
    commonQuestions: [
      "Best store?",
      "Top products?",
      "Full sales report",
      "Explain this dashboard",
    ],
    whenToNavigate: "When user wants charts and tables beyond a chat summary.",
    whenToClarify: "When user says 'sales' but means analyst CSV vs dashboard report.",
    whenToUseLiveTool:
      "Call get_today_sales with focus top_store | summary | full_report — default to short answers.",
    exampleResponses: {
      explain:
        "**Sales Dashboard** shows your latest uploaded report — net revenue, top stores, and products. Ask *best store?* for a short answer or *full report* for everything.",
      capabilities:
        "Here I can tell you top stores, revenue, and product leaders from your latest report. Try *best store with sales?* — I'll keep it concise unless you ask for a full breakdown.",
    },
    aliases: ["sales", "sales dashboard", "revenue", "stores", "pos"],
  }),

  calculator: section({
    id: "calculator",
    label: "Price Calculator",
    route: "/calculator",
    purpose:
      "Jewelry pricing — estimate piece value from weight, karat, making charges, and live gold/silver rates.",
    availableData: [
      "Live gold/silver spot rates",
      "Karat and making-charge presets",
      "Estimated totals",
    ],
    relatedTools: ["get_metal_rates", "estimate_jewellery_price"],
    commonQuestions: [
      "Price a 22K gold chain",
      "What's gold per gram?",
      "Estimate 10g ring",
    ],
    whenToNavigate: "When user wants the interactive calculator UI with sliders.",
    whenToClarify: "Missing weight, karat, or metal type for estimates.",
    whenToUseLiveTool: "Call get_metal_rates or estimate_jewellery_price with user specs.",
    exampleResponses: {
      explain:
        "**Price Calculator** estimates jewelry value using live metal rates, karat, weight, and making charges. Open the page to adjust inputs, or tell me weight and karat here.",
      capabilities:
        "Here I can quote live gold/silver rates and estimate a piece (e.g. *10 grams 22K gold chain*). For full controls, open the calculator page.",
    },
    aliases: ["calculator", "price calculator", "pricing", "gold price", "estimate"],
  }),

  analyst: section({
    id: "analyst",
    label: "Data Analyst",
    route: "/analyst",
    purpose:
      "Upload any sales CSV and query it with natural language — DuckDB SQL, charts, trends, and forecasts.",
    availableData: [
      "Uploaded CSV datasets",
      "DuckDB in-browser analytics",
      "Generated SQL and chart specs",
      "Schema inference",
    ],
    relatedTools: ["open_data_analyst"],
    commonQuestions: [
      "What is data analyst?",
      "Analyze my CSV",
      "Top products last month",
      "Forecast next week",
    ],
    whenToNavigate:
      "When user needs to upload a file, run SQL, or see interactive charts.",
    whenToClarify: "When no CSV is loaded — prompt user to upload first.",
    whenToUseLiveTool:
      "Direct simple sales questions to get_today_sales; complex analysis → open_data_analyst / analyst page.",
    exampleResponses: {
      explain:
        "**Data Analyst** lets you upload a sales CSV and ask questions in plain English. It runs **DuckDB** queries, builds charts, and supports trends and forecasts — upload a file on the Analyst page to start.",
      capabilities:
        "Here you upload CSV data and ask anything — top SKUs, monthly trends, store comparisons. For today's bundled report, use Sales Dashboard; for custom files, open **Data Analyst**.",
    },
    aliases: ["data analyst", "analyst", "csv", "duckdb", "sql", "upload"],
  }),

  images: section({
    id: "images",
    label: "Image Generation",
    route: "/images",
    purpose:
      "AI jewelry product imagery — generate rings, necklaces, and campaign visuals from descriptions.",
    availableData: [
      "Generated image gallery",
      "Last prompt and result",
      "Gemini / OpenAI image APIs",
    ],
    relatedTools: ["generate_jewellery_image"],
    commonQuestions: [
      "Generate a gold bridal necklace",
      "Create ring image",
      "Show my generations",
    ],
    whenToNavigate: "When user wants the gallery or fine-tune prompts visually.",
    whenToClarify: "When prompt is too vague — ask metal, stones, style.",
    whenToUseLiveTool: "Call generate_jewellery_image with a detailed prompt.",
    exampleResponses: {
      explain:
        "**Image Generation** creates AI jewelry photos from your description — rings, necklaces, bridal sets. Open the page to browse past images or say *generate a platinum oval diamond ring*.",
      capabilities:
        "Here I can generate product-style jewelry images from a text prompt. Describe metal, stones, and style — or open the gallery on the Image Generation page.",
    },
    aliases: ["images", "image generation", "generate", "ai image", "jewelry photo"],
  }),

  contacts: section({
    id: "contacts",
    label: "Contacts",
    route: "/contacts",
    purpose:
      "Executive rolodex — team, vendors, and key partners with phone, email, and WhatsApp.",
    availableData: [
      "Contact names, roles, companies",
      "Phone / email / WhatsApp",
      "Selected contact",
      "Important contact flags",
    ],
    relatedTools: ["list_contacts"],
    commonQuestions: [
      "Find Ross",
      "Lisa's phone number",
      "Who is my GM?",
    ],
    whenToNavigate: "When user wants to browse or edit the full contact list.",
    whenToClarify: "Ambiguous names — ask which Ross or role.",
    whenToUseLiveTool: "Call list_contacts with query — never invent numbers.",
    exampleResponses: {
      explain:
        "**Contacts** stores your key people — leadership, store managers, vendors. Ask *find Ross* or select someone here for email/meeting actions.",
      capabilities:
        "Here I can look up names, roles, and phone numbers. Try *find [name]* or open the full directory.",
    },
    aliases: ["contacts", "contact", "phone", "rolodex", "people"],
  }),

  settings: section({
    id: "settings",
    label: "Settings",
    route: "/settings",
    purpose:
      "Profile, Google/Plaid integrations, confirmation preferences, and assistant behavior.",
    availableData: [
      "User profile & role",
      "Google Gmail/Calendar connection",
      "Confirm-before-send preferences",
      "Timezone & communication style",
    ],
    relatedTools: ["search_company_knowledge"],
    commonQuestions: [
      "Connect Gmail",
      "Turn off confirm before send",
      "Update my profile",
    ],
    whenToNavigate: "When user needs toggles, OAuth, or profile forms.",
    whenToClarify: "Distinguish account settings vs company policy questions.",
    whenToUseLiveTool:
      "Company policy → search_company_knowledge; account changes → direct to Settings UI.",
    exampleResponses: {
      explain:
        "**Settings** manages your profile, Google connection, and confirmation preferences (email, meetings, calls). Open the page to connect Gmail or adjust how I ask before sending.",
      capabilities:
        "Here you connect Google, set confirm-before-send rules, and update your executive profile. For company policies, ask me directly — for account toggles, use this page.",
    },
    aliases: ["settings", "preferences", "profile", "connect google", "integration"],
  }),
};

export const APP_SECTION_LIST = Object.values(APP_SECTIONS);

/** Resolve section from URL path (handles query strings). */
export function sectionForPath(path: string): AppSectionDefinition {
  const base = path.split("?")[0] || "/chat";
  const found = APP_SECTION_LIST.find(
    (s) => s.route === base || (base !== "/" && base.startsWith(s.route))
  );
  return found ?? APP_SECTIONS.chat;
}

/** Match user text to a section by label, alias, or id. */
export function sectionFromMessage(message: string): AppSectionDefinition | null {
  const lower = message.toLowerCase();
  for (const sec of APP_SECTION_LIST) {
    if (sec.aliases.some((a) => lower.includes(a))) return sec;
  }
  return null;
}

export function sectionIdFromPath(path: string): AppSectionId {
  return sectionForPath(path).id;
}
