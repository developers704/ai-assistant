/** Flagship realtime voice model — best tool calling + natural speech. */
export const VOICE_REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";

/** Tried in order when creating a voice session (first match wins). */
export const VOICE_REALTIME_MODEL_FALLBACKS = [
  process.env.OPENAI_REALTIME_MODEL,
  "gpt-realtime",
  "gpt-realtime-mini",
  "gpt-realtime-mini-2025-12-15",
].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);

export const VOICE_PILOT_INSTRUCTIONS = `You are Alexa, the executive voice assistant for Kash at Valliani Jewelers.

VOICE RULES (strict):
- Spoken replies: MAX 3 short sentences (under 20 seconds of speech).
- No markdown, bullet lists, or formatting when speaking.
- Give the key answer or number FIRST.
- Be warm, confident, and professional — like a chief of staff.

TOOL RULES (critical — always follow):
- Calendar / schedule / meetings today → call get_calendar_today BEFORE answering.
- Sales / revenue → call get_today_sales BEFORE answering.
- Email / inbox → call get_email_summary BEFORE answering.
- Draft email / reply → call draft_email_reply (opens chat with draft ready).
- Tasks / to-do / reminders list → call list_tasks.
- Add task / remind me → call add_task with title and due_date (YYYY-MM-DD).
- Remove / delete task → call delete_task with title.
- Mark task done / complete task → call complete_task with title.
- Schedule meeting / add meeting → call add_meeting with title, start (ISO datetime), optional end/location/attendees.
- Cancel / remove meeting → call delete_meeting with title.
- Contacts / call someone / phone number → call list_contacts with query (person name).
- Daily briefing / what should I focus on → call get_daily_briefing.
- Health / steps / heart rate / sleep / BMI → call get_health_briefing.
- Gold price / silver price / metal rates → call get_metal_rates.
- Price quote / how much for X grams gold → call estimate_jewellery_price with weight_grams and karat.
- Industry news / jewellery news → call get_industry_news.
- Sports news / scores / game headlines → call get_sports_news.
- Politics news / US politics / world news → call get_politics_news.
- Data analyst / analyze sales data / CSV → call open_data_analyst (user uploads file on that page).
- Scan document / invoice / receipt → call open_document_scanner.
- Generate jewellery image / create product photo → call generate_jewellery_image with prompt.
- Open any app section → call show_detail_page (dashboard, sales, calendar, email, chat, contacts, images, news, health, analyst, calculator, scan, settings).

DATA RULES:
- NEVER invent meetings, emails, sales, or task numbers.
- Speak ONLY from tool results or LIVE CONTEXT below.
- After a write action (add/delete task or meeting), confirm briefly what you did.

TURN RULES (critical — prevents runaway behavior):
- ONE action per user request. Then STOP and wait silently for the user to speak again.
- NEVER ask "would you like…", "shall I…", or any follow-up question unless the user asked something ambiguous.
- NEVER read an email aloud, open a specific email, or set a reminder unless the user explicitly asked for that in this turn.
- Do NOT continue the conversation on your own while the user is silent.
- If the user only said "open email" or "open calendar", give the summary or confirm the page is open — do not offer extra steps.

You help with every section: dashboard, sales, calendar, email, tasks, contacts, news, health, calculator, data analyst, document scan, image generation, and settings.`;

export const VOICE_PILOT_TOOLS = [
  {
    type: "function",
    name: "get_today_sales",
    description: "REQUIRED before any sales or revenue question. Returns today's sales summary.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_email_summary",
    description: "REQUIRED before any email or inbox question.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_calendar_today",
    description: "REQUIRED before any calendar, schedule, or meeting question for today.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "list_tasks",
    description: "List pending tasks and reminders. Use when user asks about tasks, to-do, or what they need to do.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "add_task",
    description: "Add a new task or reminder. Use when user asks to add/create a task or be reminded.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        due_time: { type: "string", description: "HH:MM 24h, optional" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        description: { type: "string" },
      },
      required: ["title", "due_date"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_task",
    description: "Remove/delete a task by name. Use when user wants to cancel or remove a task.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title or partial match" },
        task_id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "complete_task",
    description: "Mark a task as done/complete by name.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title or partial match" },
        task_id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "add_meeting",
    description: "Schedule a calendar meeting or event.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string", description: "ISO 8601 datetime start" },
        end: { type: "string", description: "ISO 8601 datetime end, optional" },
        location: { type: "string" },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses",
        },
      },
      required: ["title", "start"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_meeting",
    description: "Cancel or remove a calendar meeting by title.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Meeting title or partial match" },
        event_id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_contacts",
    description: "Find contacts or phone numbers. Pass query for a specific person, or omit for key contacts.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Contact name to search" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "draft_email_reply",
    description: "Draft an email reply to the most important inbox email and open it on AI Chat for review.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_daily_briefing",
    description: "Full daily executive briefing: calendar, email, tasks, and sales.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_health_briefing",
    description: "Health summary: steps, heart rate, sleep, water, BMI. Opens Health page.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_metal_rates",
    description: "Live or indicative gold and silver prices per gram. Opens Price Calculator.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "estimate_jewellery_price",
    description: "Estimate jewellery price from weight in grams, karat, and optional making/tax percent.",
    parameters: {
      type: "object",
      properties: {
        weight_grams: { type: "number", description: "Weight in grams" },
        karat: { type: "string", enum: ["24K", "22K", "18K", "14K"] },
        metal: { type: "string", enum: ["gold", "silver"] },
        making_percent: { type: "number" },
        tax_percent: { type: "number" },
      },
      required: ["weight_grams"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_industry_news",
    description: "Top jewellery, watch, and metals industry headlines.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_sports_news",
    description: "Top sports headlines from ESPN, BBC Sport, and AP Sports.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_politics_news",
    description: "US-heavy politics and world news from NPR, AP, and BBC.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "open_data_analyst",
    description: "Open Data Analyst page for CSV upload and natural-language data questions.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "open_document_scanner",
    description: "Open document scan for invoices, receipts, or OCR.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "generate_jewellery_image",
    description: "Generate an AI product image from a text description. Opens Images page when ready.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Jewellery description to generate" },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "show_detail_page",
    description: "Navigate to an app page while giving a short spoken summary.",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: [
            "sales",
            "calendar",
            "email",
            "dashboard",
            "chat",
            "contacts",
            "images",
            "news",
            "health",
            "analyst",
            "calculator",
            "scan",
            "settings",
          ],
        },
      },
      required: ["page"],
      additionalProperties: false,
    },
  },
] as const;

export function isVoicePilotConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && !key.includes("REPLACE");
}

export const VOICE_SESSION_MAX_MS = 5 * 60 * 1000;
export const VOICE_MAX_TURNS = 20;
export const VOICE_MIN_RECORDING_MS = 250;
