import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import type { AIResponse, AppState, PendingAction, Reminder } from "@/types";
import { buildAssistantContext } from "./context-builder";
import { resolveTaskTarget } from "@/lib/voice/tool-helpers";
import {
  retrieveKnowledge,
  formatRetrievedContext,
  getRagGuardrails,
  getRagAnswerStyle,
  isRagAvailable,
} from "@/lib/rag";

const SYSTEM_PROMPT = `You are the Executive AI Assistant for Valliani Jewelers — a premium, proactive chief-of-staff style assistant for the business owner.

You answer naturally like a capable LLM. Combine:
1) LIVE CONTEXT — emails, calendar, tasks, sales, contacts, investments/portfolio (real-time)
2) COMPANY KNOWLEDGE — retrieved official Valliani sources (policies, brands, locations, contacts)

Guidelines:
- Be concise but complete. Use markdown: **bold**, bullet lists, short sections.
- Answer style: direct answer first, then supporting detail.
- For company/policy/brand/location questions, prioritize COMPANY KNOWLEDGE sources over general knowledge or demo app data.
- Follow accuracy guardrails in COMPANY KNOWLEDGE — do not invent store counts, in-store return rules, or policy details not in sources.
- For "any meeting today?", "today mails?", etc., answer from LIVE CONTEXT.
- Respect the user's timezone when discussing dates and times.
- When the user asks to SEND email, WhatsApp, schedule a meeting, or place a call, use the appropriate tool — never claim you sent anything without calling the tool.
- For reminders/tasks: use create_reminder to ADD tasks; use delete_task to REMOVE; use complete_task to mark done. Never create a reminder when the user asked to remove or complete a task.
- For store count or location questions, use LIVE CONTEXT Store directory — Valliani has exactly 29 locations with city and mall names. Give the count and list by state when asked.
- Do not ask "could you provide more details?" when the context already has the answer.
- For portfolio, net worth, Vanguard, holdings, or allocation questions, use LIVE CONTEXT investments data.
- Pending confirmations: if something awaits confirm, remind them they can say yes or cancel.`;

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "propose_send_email",
      description:
        "Propose sending an email. User must confirm before send. Use for drafts and replies.",
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string", description: "Recipient email address" },
          to_name: { type: "string", description: "Recipient display name" },
          subject: { type: "string" },
          body: { type: "string", description: "Full email body" },
        },
        required: ["to_email", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a NEW task/reminder. Do NOT use when user wants to remove or complete an existing task.",
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
      description: "Remove/delete an existing task by title. Use when user says remove, delete, or cancel a task.",
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
      description: "Mark an existing task as done/complete by title.",
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
      name: "propose_schedule_meeting",
      description: "Propose scheduling a meeting — requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          person: { type: "string" },
          date: { type: "string", description: "e.g. tomorrow, 2026-06-20" },
          time: { type: "string", description: "e.g. 4:00 PM" },
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
      description: "Propose sending a WhatsApp message — requires confirmation.",
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

export function isLLMChatConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && !key.includes("REPLACE");
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  state: AppState,
  assistantText: string,
  userMessage: string
): AIResponse {
  switch (name) {
    case "propose_send_email": {
      const to = String(args.to_email ?? "");
      const toName = String(args.to_name ?? to);
      const subject = String(args.subject ?? "Follow-up");
      const body = String(args.body ?? "");
      const pendingAction: PendingAction = {
        id: uuidv4(),
        type: "email",
        title: `Email to ${toName}`,
        preview: body,
        payload: { to, subject, body, to_name: toName },
        createdAt: new Date().toISOString(),
      };
      return {
        intent: "email_draft",
        message:
          assistantText ||
          `I've drafted an email for your review:\n\n**To:** ${toName} (${to})\n**Subject:** ${subject}\n\n---\n${body}\n\n---\n\nShould I send this email?`,
        pendingAction,
        speak: true,
      };
    }
    case "create_reminder": {
      const reminder: Reminder = {
        id: uuidv4(),
        title: String(args.title ?? "Reminder"),
        description: args.description ? String(args.description) : undefined,
        dueDate: String(args.due_date ?? new Date().toISOString().split("T")[0]),
        dueTime: args.due_time ? String(args.due_time) : undefined,
        priority: (args.priority as Reminder["priority"]) ?? "medium",
        completed: false,
        recurring: null,
        createdAt: new Date().toISOString(),
      };
      return {
        intent: "reminder_create",
        message:
          assistantText ||
          `Reminder created:\n\n**${reminder.title}**\n📅 ${reminder.dueDate}${reminder.dueTime ? ` at ${reminder.dueTime}` : ""}\nPriority: ${reminder.priority}`,
        speak: true,
        data: { reminder },
      };
    }
    case "delete_task": {
      const title = String(args.title ?? "");
      const target = resolveTaskTarget(userMessage, state.reminders, title);
      if (!target) {
        return {
          intent: "task_delete",
          message:
            assistantText ||
            "I couldn't find that task to remove. Try the exact task name or open Calendar & Tasks.",
          speak: true,
        };
      }
      return {
        intent: "task_delete",
        message: assistantText || `Removed task:\n\n**${target.title}**`,
        speak: true,
        data: { deletedReminderId: target.id },
      };
    }
    case "complete_task": {
      const title = String(args.title ?? "");
      const target = resolveTaskTarget(userMessage, state.reminders, title);
      if (!target) {
        return {
          intent: "task_complete",
          message:
            assistantText ||
            "I couldn't find that task to mark complete. Try the exact task name or open Calendar & Tasks.",
          speak: true,
        };
      }
      return {
        intent: "task_complete",
        message: assistantText || `Marked complete:\n\n**${target.title}**`,
        speak: true,
        data: { completedReminderId: target.id },
      };
    }
    case "propose_schedule_meeting": {
      const person = String(args.person ?? "Team");
      const date = String(args.date ?? "today");
      const time = String(args.time ?? "10:00 AM");
      const title = String(args.title ?? `Meeting with ${person}`);
      const attendees = Array.isArray(args.attendees)
        ? args.attendees.map(String)
        : [person];
      const pendingAction: PendingAction = {
        id: uuidv4(),
        type: "meeting_create",
        title: `Schedule: ${title}`,
        preview: `${date} at ${time} with ${person}`,
        payload: { person, date, time, title, attendees },
        createdAt: new Date().toISOString(),
      };
      return {
        intent: "schedule_meeting",
        message:
          assistantText ||
          `I'd like to schedule:\n\n**${title}**\n📅 ${date} at ${time}\n👥 ${attendees.join(", ")}\n\nShould I create this meeting and send calendar invites?`,
        pendingAction,
        speak: true,
      };
    }
    case "propose_whatsapp": {
      const contactName = String(args.contact_name ?? "Contact");
      const content = String(args.message ?? "");
      const contact = state.contacts.find((c) =>
        c.name.toLowerCase().includes(contactName.toLowerCase())
      );
      const pendingAction: PendingAction = {
        id: uuidv4(),
        type: "whatsapp",
        title: `WhatsApp to ${contactName}`,
        preview: content,
        payload: {
          contactId: contact?.id,
          contactName: contact?.name ?? contactName,
          content,
        },
        createdAt: new Date().toISOString(),
      };
      return {
        intent: "whatsapp_draft",
        message:
          assistantText ||
          `WhatsApp preview:\n\n**To:** ${contactName}\n**Message:** "${content}"\n\nShould I send this?`,
        pendingAction,
        speak: true,
      };
    }
    default:
      return {
        intent: "general",
        message: assistantText || "I completed that request.",
        speak: true,
      };
  }
}

export async function processMessageWithLLM(
  message: string,
  state: AppState
): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const client = new OpenAI({ apiKey });

  const context = buildAssistantContext(state);
  const ragSection = isRagAvailable()
    ? (() => {
        const retrieved = retrieveKnowledge(message);
        const guardrails = getRagGuardrails();
        return `
## COMPANY KNOWLEDGE (retrieved for this question — authoritative for Valliani facts)
Answer style: ${getRagAnswerStyle()}

Accuracy guardrails:
${guardrails.map((g) => `- ${g}`).join("\n")}

${formatRetrievedContext(retrieved)}`;
      })()
    : "";

  const history = state.chatHistory.slice(-10).map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n---\nLIVE CONTEXT (real-time app data):\n\n${context}${ragSection}`,
    },
    ...history.filter((h) => h.role === "user" || h.role === "assistant"),
    { role: "user", content: message },
  ];

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 1200,
    messages,
    tools: TOOLS,
    tool_choice: "auto",
  });

  const choice = completion.choices[0]?.message;
  if (!choice) {
    throw new Error("Empty LLM response");
  }

  const text = choice.content?.trim() ?? "";

  if (choice.tool_calls?.length) {
    const tool = choice.tool_calls[0];
    if (tool.type === "function") {
      const args = parseToolArgs(tool.function.arguments);
      return handleToolCall(tool.function.name, args, state, text, message);
    }
  }

  return {
    intent: "general",
    message: text || "I'm here to help — could you rephrase that?",
    speak: true,
  };
}
