import type OpenAI from "openai";

/** Shared OpenAI chat tool definitions — aligned with voice realtime tools. */
export const ASSISTANT_CHAT_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_calendar_today",
      description:
        "REQUIRED before answering calendar, schedule, meetings, or 'what's on my calendar' questions. Returns today's events from Google Calendar or demo data.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_email_summary",
      description:
        "REQUIRED before answering inbox, email, or unread mail questions. Returns inbox summary and top messages.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_today_sales",
      description:
        "REQUIRED before sales, revenue, store performance, top products, or uploaded CSV/MHVR report questions. Uses latest uploaded report when available.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_briefing",
      description:
        "Full executive briefing: calendar, email, tasks, and sales. Use for 'what should I focus on', morning briefing, priorities.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "List pending tasks and reminders. Use for task list, to-do, what do I need to do.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_contacts",
      description: "Find a contact or list key contacts. Pass query for a specific person.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Contact name to search" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_metal_rates",
      description: "Live or indicative gold and silver prices per gram.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_jewellery_price",
      description: "Estimate jewellery price from weight, karat, and optional making/tax percent.",
      parameters: {
        type: "object",
        properties: {
          weight_grams: { type: "number" },
          karat: { type: "string", enum: ["24K", "22K", "18K", "14K"] },
          metal: { type: "string", enum: ["gold", "silver"] },
          making_percent: { type: "number" },
          tax_percent: { type: "number" },
        },
        required: ["weight_grams"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_industry_news",
      description: "Top jewellery, watch, and metals industry headlines.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sports_news",
      description: "Top sports headlines.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_politics_news",
      description: "US and world politics headlines.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "show_detail_page",
      description: "Open an app section when user asks to go to a page.",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: [
              "dashboard",
              "sales",
              "calendar",
              "email",
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
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_data_analyst",
      description: "Open Data Analyst for CSV upload and sales analysis.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a NEW task/reminder. Do NOT use when user wants to remove or complete a task.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          due_time: { type: "string", description: "HH:MM 24h, optional" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["title", "due_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Remove/delete an existing task by title.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title or keywords to match" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark an existing task as done by title.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title or keywords to match" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_send_email",
      description: "Draft an email for user confirmation before sending.",
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string" },
          to_name: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["to_email", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_schedule_meeting",
      description: "Propose scheduling a meeting — requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          person: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          title: { type: "string" },
          attendees: { type: "array", items: { type: "string" } },
        },
        required: ["person", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_whatsapp",
      description: "Propose a WhatsApp message — requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string" },
          message: { type: "string" },
        },
        required: ["contact_name", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_email_reply",
      description: "Draft a reply to the most important inbox email.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

export const READ_TOOL_NAMES = new Set([
  "get_calendar_today",
  "get_email_summary",
  "get_today_sales",
  "get_daily_briefing",
  "list_tasks",
  "list_contacts",
  "get_metal_rates",
  "estimate_jewellery_price",
  "get_industry_news",
  "get_sports_news",
  "get_politics_news",
  "show_detail_page",
  "open_data_analyst",
  "open_document_scanner",
  "draft_email_reply",
]);

/** Map chat tool names to voice executor names when they differ. */
export function mapToolNameForExecutor(name: string): string {
  if (name === "create_reminder") return "add_task";
  if (name === "open_data_analyst") return "open_data_analyst";
  return name;
}
