import type OpenAI from "openai";
import { getChatOpenAITools } from "@/lib/tools/registry";

/** Chat-only write tools (not in voice realtime). Registry holds shared read/write metadata. */
const CHAT_ONLY_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a NEW task/reminder. Maps to add_task.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          due_date: { type: "string" },
          due_time: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["title", "due_date"],
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
];

/** OpenAI chat tools — registry (single source) + chat-only proposals. */
export const ASSISTANT_CHAT_TOOLS: OpenAI.ChatCompletionTool[] = [
  ...getChatOpenAITools(),
  ...CHAT_ONLY_TOOLS,
];

export const READ_TOOL_NAMES = new Set([
  "get_calendar_today",
  "get_email_summary",
  "get_today_sales",
  "query_sales",
  "compare_sales",
  "get_sales_entity_details",
  "get_top_vendor_models",
  "apply_sales_dashboard_filters",
  "get_sales_snapshot",
  "get_sales_data_status",
  "get_sales_insights",
  "list_tasks",
  "list_contacts",
  "get_metal_rates",
  "estimate_jewellery_price",
  "get_industry_news",
  "get_sports_news",
  "get_politics_news",
  "show_detail_page",
  "open_data_analyst",
  "search_company_knowledge",
  "get_store_directory",
  "find_nearest_store",
  "get_store_distance",
  "list_valliani_stores",
  "get_valliani_store_details",
  "draft_email_reply",
  "delete_task",
  "complete_task",
  "delete_meeting",
]);

export function mapToolNameForExecutor(name: string): string {
  if (name === "create_reminder") return "add_task";
  return name;
}
