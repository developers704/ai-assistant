/** Flagship realtime voice model — best tool calling + natural speech. */
export const VOICE_REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-1.5";

/** Tried in order when creating a voice session (first match wins). */
export const VOICE_REALTIME_MODEL_FALLBACKS = [
  process.env.OPENAI_REALTIME_MODEL,
  "gpt-realtime-1.5",
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
- Portfolio / investments / net worth → call get_portfolio.
- Open a screen → call show_detail_page (sales, calendar, email, dashboard, chat, contacts, investments, images).

DATA RULES:
- NEVER invent meetings, emails, sales, tasks, or portfolio numbers.
- Speak ONLY from tool results or LIVE CONTEXT below.
- After a write action (add/delete task or meeting), confirm briefly what you did.

You help with daily briefings, sales, calendar, tasks, email drafts, contacts, portfolio, and navigation.`;

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
    name: "get_portfolio",
    description: "Portfolio value, investments, holdings, net worth.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "draft_email_reply",
    description: "Draft an email reply to the most important inbox email and open it on AI Chat for review.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
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
          enum: ["sales", "calendar", "email", "dashboard", "chat", "contacts", "investments", "images"],
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
