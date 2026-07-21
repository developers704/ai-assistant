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
import {
  ASSISTANT_CHAT_TOOLS,
  READ_TOOL_NAMES,
  mapToolNameForExecutor,
} from "@/lib/assistant/tool-definitions";
import {
  intentForTool,
} from "@/lib/assistant/format-tool-result";
import { executeTool } from "@/lib/tools/registry";
import { loadChatSystemPrompt } from "@/lib/prompts/loader";
import { buildDynamicContext } from "./dynamic-context";
import { OPENAI_CHAT_MODEL, chatCompletionLimits } from "@/lib/openai/config";
import { synthesizeToolResponse } from "@/lib/ai/response-synthesizer";
import { savePendingAction } from "@/lib/actions/confirmation";
import { buildAppMapPromptBlock } from "@/lib/ai/app-intelligence";

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

function handleWriteToolCall(
  name: string,
  args: Record<string, unknown>,
  state: AppState,
  assistantText: string,
  userMessage: string
): AIResponse | null {
  switch (name) {
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
      return null;
  }
}

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  state: AppState,
  assistantText: string,
  userMessage: string
): Promise<AIResponse> {
  const writeResponse = handleWriteToolCall(name, args, state, assistantText, userMessage);
  if (writeResponse) return writeResponse;

  if (READ_TOOL_NAMES.has(name) || name === "draft_email_reply") {
    const executorName = mapToolNameForExecutor(name);
    const result = await executeTool(executorName, args, { source: "chat" });
    const synthesized = synthesizeToolResponse({
      toolName: executorName,
      result,
      userMessage,
    });
    if (synthesized.pendingOffer && !result.pendingAction) {
      savePendingAction(synthesized.pendingOffer);
    }
    const prefix = assistantText ? `${assistantText}\n\n` : "";
    return {
      intent: intentForTool(name),
      message: prefix + synthesized.message,
      speak: true,
      pendingAction: result.pendingAction ?? synthesized.pendingOffer,
      data:
        synthesized.navigateTo ?? result.navigateTo
          ? { navigate: synthesized.navigateTo ?? result.navigateTo }
          : undefined,
    };
  }

  return {
    intent: "general",
    message: assistantText || "I completed that request.",
    speak: true,
  };
}

export async function processMessageWithLLM(
  message: string,
  state: AppState
): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const client = new OpenAI({ apiKey });

  const context = buildAssistantContext(state);
  const dynamic = await buildDynamicContext(state, message);
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
      content: `${loadChatSystemPrompt()}\n\n${buildAppMapPromptBlock()}\n\n---\nLIVE CONTEXT (real-time app data):\n\n${context}\n\n---\nDYNAMIC CONTEXT:\n${dynamic.textBlock}${ragSection}`,
    },
    ...history.filter((h) => h.role === "user" || h.role === "assistant"),
    { role: "user", content: message },
  ];

  const completion = await client.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    ...chatCompletionLimits(OPENAI_CHAT_MODEL, {
      temperature: 0.35,
      maxTokens: 1200,
    }),
    messages,
    tools: ASSISTANT_CHAT_TOOLS,
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
