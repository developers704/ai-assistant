/** GA mini realtime model (replaces deprecated gpt-4o-mini-realtime-preview alias). */
export const VOICE_REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-mini";

/** Tried in order when creating a voice session (first match wins). */
export const VOICE_REALTIME_MODEL_FALLBACKS = [
  process.env.OPENAI_REALTIME_MODEL,
  "gpt-realtime-mini",
  "gpt-realtime-mini-2025-12-15",
  "gpt-4o-mini-realtime-preview-2024-12-17",
  "gpt-4o-realtime-preview-2024-12-17",
].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);

export const VOICE_PILOT_INSTRUCTIONS = `You are Alexa, the executive voice assistant for Kash at Valliani Jewelers.

VOICE RULES (strict):
- Spoken replies: MAX 3 short sentences (under 20 seconds of speech).
- No markdown, bullet lists, or formatting when speaking.
- Give the key answer or number FIRST.
- Be warm, confident, and professional — like a chief of staff.

DATA RULES (critical — never break):
- For calendar, schedule, meetings, or "what's on today": ALWAYS call get_calendar_today BEFORE stating any events. Then speak ONLY from that tool result or LIVE CONTEXT below.
- For sales or revenue: ALWAYS call get_today_sales BEFORE stating numbers.
- For email or inbox questions: ALWAYS call get_email_summary BEFORE stating inbox contents.
- For "draft an email" or "reply to this email": tell the user the draft is being prepared — do not invent reminder or calendar content.
- NEVER invent meetings, standups, emails, or sales figures. Never answer an email question with calendar data or vice versa.
- Only call create_reminder when the user explicitly asks to be reminded about something.

You help with daily briefings, sales, calendar, reminders, and company questions.`;

export const VOICE_PILOT_TOOLS = [
  {
    type: "function",
    name: "get_today_sales",
    description:
      "REQUIRED before answering any sales, revenue, or store performance question. Returns today's real sales summary. Never guess revenue without calling this first.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_email_summary",
    description:
      "REQUIRED before answering any email or inbox question. Returns real Gmail inbox summary. Never guess email content.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_calendar_today",
    description:
      "REQUIRED before answering any calendar, schedule, meeting, or 'what's on today' question. Returns the authoritative list of today's real calendar events from Google Calendar. Never guess events without calling this first.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_reminder",
    description: "Create a task or reminder immediately. Use when user asks to be reminded.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        due_time: { type: "string", description: "HH:MM 24h, optional" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["title", "due_date"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "show_detail_page",
    description:
      "Open a page on screen for the user while you give a short spoken summary. Use for sales, calendar, email, or dashboard.",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: ["sales", "calendar", "email", "dashboard", "chat"],
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
export const VOICE_MAX_TURNS = 15;
/** OpenAI requires ≥100ms audio before commit; pad for mic/WebRTC latency. */
export const VOICE_MIN_RECORDING_MS = 250;
