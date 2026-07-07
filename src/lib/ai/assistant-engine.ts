import { v4 as uuidv4 } from "uuid";
import type {
  AIResponse,
  AppState,
  IntentType,
  PendingAction,
  Reminder,
  CalendarEvent,
} from "@/types";
import { computeSalesSummary } from "@/lib/mock-data";
import { mockSalesData } from "@/lib/mock-data";
import {
  userTimezone,
  isTodayInTimezone,
  isEventOnDate,
  resolveCalendarDay,
} from "@/lib/calendar-dates";
import { findEmailByContext } from "@/lib/email-utils";
import {
  buildStoreListMarkdown,
  detectStoreRegionQuery,
  isStoreLocationQuery,
} from "@/lib/stores/store-knowledge";
import {
  answerStoreQuery,
  isStoreIntelligenceQuery,
} from "@/lib/stores/store-intelligence";
import { isStoreDirectoryAvailable } from "@/lib/stores/store-directory";
import { resolveTaskTarget } from "@/lib/voice/tool-helpers";
import { formatLongDate } from "@/lib/utils";
import { getAssistantSalesSummary, formatSalesReportMarkdown } from "@/lib/assistant/sales-data";
import { isComposeEmailToPerson } from "@/lib/ai/email-compose";

function isAcknowledgmentMessage(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .trim()
    .replace(/[!.,]+$/g, "")
    .replace(/\s+/g, " ");
  if (!normalized || normalized.length > 50) return false;

  return (
    /^(ok(ay)?|k)( (thank\s*you|thankyou|thanks|thx|ty|cheers))?$/i.test(normalized) ||
    /^(thank\s*you|thankyou|thanks|thx|ty|cheers|much appreciated|appreciate it)( (so much|a lot|again))?$/i.test(
      normalized
    ) ||
    /^(got it|perfect|great|cool|nice|good|awesome|sounds good|noted|will do|lovely|fine)$/i.test(
      normalized
    )
  );
}

function detectIntent(message: string): IntentType {
  const lower = message.toLowerCase().trim();

  if (isAcknowledgmentMessage(message)) {
    return "acknowledgment";
  }

  if (/^(yes|confirm|go ahead|send it|proceed|approved?|do it)\b/.test(lower)) return "confirm_action";
  if (/^(no|cancel|reject|don't|stop|nevermind|never mind)\b/.test(lower)) return "reject_action";
  if (/help|what can you do|capabilities/.test(lower)) return "help";
  if (
    /good morning|hello|hi\b|hey\b|greetings|how\s+(?:r\s+u|are\s+you|you\s+doing|going)/.test(lower)
  ) {
    return "greeting";
  }
  if (/what('s| is|s)?\s*(today'?s?\s*)?date|what date|today'?s date|date today/.test(lower)) {
    return "date_query";
  }
  if (/focus on today|what do i need|daily briefing|morning briefing|what('s| is) on today|priorities today/.test(lower)) {
    return "daily_briefing";
  }
  if (/sales report|today('s)? sales|store sales|revenue|sales across|sales data|forecast|show me.*sales/.test(lower)) {
    return "sales_report";
  }
  if (
    /book|set up.*meeting|meeting with|meeting at|\bschedule\b[\s\S]{0,20}\b(?:a |an )?(?:meeting|appointment|call|with)\b/.test(
      lower
    )
  ) {
    return "schedule_meeting";
  }
  if (
    /(?:what'?s|whats|what is|show|list|view)\b[\s\S]{0,40}\b(?:today|tomorrow|my)?\s*schedule\b/.test(
      lower
    )
  ) {
    return "calendar_today";
  }
  if (/summarize.*(?:email|inbox)|summarize inbox|important email|inbox summary|pending repl|email summary|check email/.test(lower)) return "email_summary";
  if (isComposeEmailToPerson(message) || /draft.*(?:email|reply)|write.*email|reply to|email to|send email/.test(lower)) return "email_draft";
  if (/whatsapp|whats app|message to|text to|send.*to.*manager/.test(lower)) return "whatsapp_draft";
  if (
    /(?:remove|delete|cancel)\s+(?:the\s+)?(?:this\s+)?task|remove .+ from (?:my )?tasks?|delete .+ task/i.test(
      lower
    )
  ) {
    return "task_delete";
  }
  if (
    /(?:mark.*complete|done with|finished.*task|complete.*task|task.*(?:is )?(?:done|completed)|this is completed)/i.test(
      lower
    ) &&
    !/create|add|new task|remind/i.test(lower)
  ) {
    return "task_complete";
  }
  if (/remind me|set.*reminder|create.*reminder|every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.test(lower)) {
    return "reminder_create";
  }
  if (/show.*(?:reminder|tasks?)|pending task|my tasks|all tasks|task list|to-do|todo/.test(lower)) {
    return "reminder_list";
  }
  if (
    /(?:what'?s|whats|what is)\s+(?:on\s+)?(?:my\s+)?(?:calender|calendar)|(?:calender|calendar)\s+today|today('s)?\s*schedule|on my (?:calender|calendar)|my meetings|what meetings|any meetings? today|(?:do|have) (?:i|we) have (?:any |a )?meetings? (?:today|tomorrow)|(?:am i|do i) have (?:any |a )?meetings? (?:today|tomorrow)|meetings? (?:for )?(?:today|tomorrow)|(?:anything|something) (?:scheduled|on) (?:today|tomorrow)|events? (?:today|tomorrow)|what'?s on (?:today|tomorrow)|appointments? (?:today|tomorrow)/.test(
      lower
    )
  ) {
    return "calendar_today";
  }
  if (/summarize.*(pdf|document|doc|file|contract|report)|key points|analyze.*(excel|csv|data)/.test(lower)) return "document_summarize";
  if (/analyze.*(screenshot|image|photo|picture|dashboard)|what does this (show|dashboard)/.test(lower)) return "image_analyze";
  if (/call\s+\w+|phone call|dial/.test(lower)) return "call_prepare";
  if (isStoreDirectoryAvailable() && isStoreIntelligenceQuery(message)) return "store_list";
  if (isStoreLocationQuery(message)) return "store_list";

  return "general";
}

function extractMeetingDetails(message: string): { person: string; time: string; date: string } {
  const personMatch = message.match(/(?:with|meeting)\s+([A-Za-z]+)/i);
  const timeMatch = message.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)/i);
  const isTomorrow = /tomorrow/i.test(message);

  const person = personMatch?.[1] || "Team Member";
  let time = "10:00 AM";
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] || "00";
    const period = timeMatch[3].toUpperCase();
    time = `${hour}:${minute} ${period}`;
  }

  const date = isTomorrow ? "tomorrow" : "today";
  return { person, time, date };
}

function extractWhatsAppDetails(message: string, state: AppState): { contact: string; content: string } {
  const toMatch = message.match(/(?:whatsapp|message|text|send)\s+(?:to\s+)?(?:the\s+)?(\w+(?:\s+\w+)?)/i);
  const contentMatch = message.match(/[:]\s*(.+)$/);

  let contact = "Manager";
  if (toMatch) {
    const name = toMatch[1];
    const found = state.contacts.find(
      (c) => c.name.toLowerCase().includes(name.toLowerCase()) || c.role.toLowerCase().includes(name.toLowerCase())
    );
    contact = found?.name || name;
  }

  const content = contentMatch?.[1]?.trim() || "Please send today's closing sales report.";
  return { contact, content };
}

function extractReminderDetails(message: string): Partial<Reminder> {
  const followUpMatch = message.match(/follow-up reminder for email from\s+(.+)/i);
  if (followUpMatch) {
    const person = followUpMatch[1].trim();
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 2);
    return {
      title: `Follow up on email from ${person}`,
      description: "Reminder to reply or follow up on this email thread.",
      dueDate: followUpDate.toISOString().split("T")[0],
      priority: "high",
      recurring: null,
    };
  }

  const titleMatch = message.match(/remind me(?:\s+to|\s+every|\s+at|\s+on)?\s+(.+?)(?:\s+(?:at|on|every|tomorrow)|$)/i);
  const isRecurring = /every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(message);
  const isTomorrow = /tomorrow/i.test(message);
  const timeMatch = message.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)/i);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + (isTomorrow ? 1 : 0));

  let dueTime: string | undefined;
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] || "00";
    const period = timeMatch[3].toLowerCase();
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    dueTime = `${hour.toString().padStart(2, "0")}:${minute}`;
  }

  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  const dayMatch = message.match(/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);

  return {
    title: titleMatch?.[1]?.trim() || message.replace(/remind me/i, "").trim() || "New reminder",
    dueDate: tomorrow.toISOString().split("T")[0],
    dueTime,
    priority: /urgent|important|asap/i.test(message) ? "high" : "medium",
    recurring: isRecurring ? "weekly" : null,
    recurringDay: dayMatch ? dayMap[dayMatch[1].toLowerCase()] : undefined,
  };
}

export function processMessage(message: string, state: AppState): AIResponse {
  const intent = detectIntent(message);

  switch (intent) {
    case "confirm_action":
      return handleConfirmAction(state);
    case "reject_action":
      return handleRejectAction(state);
    case "acknowledgment":
      return handleAcknowledgment(message);
    case "date_query": {
      const tz = userTimezone(state);
      const now = new Date();
      return {
        intent: "date_query",
        message: `Today is **${formatLongDate(now)}** (${tz}).`,
        speak: true,
      };
    }
    case "greeting": {
      const tz = userTimezone(state);
      const meetings = state.events.filter(
        (e) => isTodayInTimezone(e.start, tz) && e.status !== "cancelled"
      ).length;
      const tasks = state.reminders.filter((r) => !r.completed).length;
      const casual = /how\s+(?:r\s+u|are\s+you|you\s+doing|going)/.test(message.toLowerCase());
      return {
        intent: "greeting",
        message: casual
          ? `I'm doing well, thank you. You have **${meetings}** meeting${meetings !== 1 ? "s" : ""} today and **${tasks}** pending task${tasks !== 1 ? "s" : ""}. What can I help with?`
          : `Good day, Kash. I'm your Executive AI Assistant. You have ${meetings} meetings today and ${tasks} pending tasks. How may I assist you?`,
        speak: true,
      };
    }
    case "daily_briefing":
      return generateDailyBriefing(state);
    case "store_list":
      return listStores(message);
    case "sales_report":
      return generateSalesReport();
    case "schedule_meeting":
      return prepareScheduleMeeting(message, state);
    case "email_summary":
      return summarizeEmails(state);
    case "email_draft":
      return draftEmail(message, state);
    case "whatsapp_draft":
      return draftWhatsApp(message, state);
    case "reminder_create":
      return createReminder(message);
    case "reminder_list":
      return listReminders(state);
    case "task_delete":
      return deleteTask(message, state);
    case "task_complete":
      return completeTask(message, state);
    case "calendar_today":
      return showCalendar(message, state);
    case "document_summarize":
      return summarizeDocument(state);
    case "image_analyze":
      return analyzeImage(state);
    case "call_prepare":
      return prepareCall(message, state);
    case "help":
      return {
        intent,
        message: `I can help you with:

• **Voice & Chat** — Ask me anything naturally
• **Email** — Summarize inbox, draft replies, find important messages
• **Calendar** — View schedule, book/reschedule meetings (with confirmation)
• **Reminders** — Set tasks, recurring reminders, daily briefings
• **Sales Reports** — Daily/weekly sales, store & product analysis
• **Documents** — Summarize PDFs, contracts, Excel reports
• **Images** — Generate jewelry product photos, analyze screenshots and dashboards
• **WhatsApp & Calls** — Draft messages and prepare calls (always with confirmation)

Try: "What do I need to focus on today?" or "Summarize my inbox."`,
        speak: true,
      };
    default:
      return {
        intent: "general",
        message: `I understand you're asking about "${message}". I can help with emails, calendar, reminders, sales reports, documents, and messaging. Could you provide more details about what you'd like me to do?`,
        speak: true,
      };
  }
}

function generateDailyBriefing(state: AppState): AIResponse {
  const tz = userTimezone(state);
  const todayEvents = state.events.filter((e) => isTodayInTimezone(e.start, tz) && e.status !== "cancelled");
  const pendingTasks = state.reminders.filter((r) => !r.completed);
  const summary = computeSalesSummary(mockSalesData);
  const urgentEmails = state.emails.filter((e) => e.category === "urgent" && !e.isRead);

  const actions: string[] = [];
  if (urgentEmails.length > 0) actions.push(`respond to urgent email from ${urgentEmails[0].from}`);
  if (pendingTasks.some((t) => t.title.toLowerCase().includes("supplier") || t.title.toLowerCase().includes("diamond"))) actions.push("follow up with Ahmed on the diamond shipment");
  if (pendingTasks.some((t) => t.title.toLowerCase().includes("sales"))) actions.push("review daily sales across all 29 locations");
  if (todayEvents.some((e) => e.title.toLowerCase().includes("texas"))) actions.push("prepare for the Texas expansion meeting at 4 PM");
  else if (todayEvents.length > 0) actions.push(`confirm the ${new Date(todayEvents[todayEvents.length - 1].start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} meeting`);

  const salesChange = summary.comparisonPreviousDay;
  const salesNote = salesChange < 0
    ? `Yesterday's sales were ${Math.abs(salesChange).toFixed(0)}% lower than the previous day.`
    : `Sales are trending ${salesChange >= 0 ? "up" : "down"} at ${Math.abs(salesChange).toFixed(1)}% vs yesterday.`;

  return {
    intent: "daily_briefing",
    message: `Here's your focus for today:

**Schedule:** ${todayEvents.length} meeting${todayEvents.length !== 1 ? "s" : ""} — ${todayEvents.map((e) => e.title).join(", ") || "None scheduled"}

**Tasks:** ${pendingTasks.length} pending item${pendingTasks.length !== 1 ? "s" : ""}

**Sales:** ${salesNote}

**Priority actions:**
${actions.map((a, i) => `${i + 1}. ${a.charAt(0).toUpperCase() + a.slice(1)}`).join("\n")}

${urgentEmails.length > 0 ? `\n⚠️ **Alert:** Urgent email from ${urgentEmails[0].from} — "${urgentEmails[0].subject}"` : ""}`,
    speak: true,
    data: { events: todayEvents.length, tasks: pendingTasks.length, salesChange },
  };
}

function generateSalesReport(): AIResponse {
  const { summary, source } = getAssistantSalesSummary();

  return {
    intent: "sales_report",
    message: formatSalesReportMarkdown(),
    speak: true,
    data: { summary, source },
  };
}

function prepareScheduleMeeting(message: string, state: AppState): AIResponse {
  const { person, time, date } = extractMeetingDetails(message);
  const contact = state.contacts.find((c) => c.name.toLowerCase().includes(person.toLowerCase()));

  const pendingAction: PendingAction = {
    id: uuidv4(),
    type: "meeting_create",
    title: `Schedule meeting with ${contact?.name || person}`,
    preview: `Meeting with ${contact?.name || person} on ${date} at ${time}`,
    payload: { person: contact?.name || person, time, date, attendees: [contact?.name || person] },
    createdAt: new Date().toISOString(),
  };

  return {
    intent: "schedule_meeting",
    message: `I'd like to schedule a meeting:

**With:** ${contact?.name || person}${contact?.role ? ` (${contact.role})` : ""}
**When:** ${date} at ${time}
**Duration:** 1 hour (default)

Should I create this meeting and send calendar invites?`,
    pendingAction,
    speak: true,
  };
}

function summarizeEmails(state: AppState): AIResponse {
  const urgent = state.emails.filter((e) => e.category === "urgent");
  const needsReply = state.emails.filter((e) => e.needsReply);
  const important = state.emails.filter(
    (e) => (e.isImportant || e.category === "important") && e.category !== "urgent"
  );
  const unread = state.emails.filter((e) => !e.isRead);

  const suggestedActions: string[] = [];
  if (needsReply[0]) {
    suggestedActions.push(`Reply to **${needsReply[0].from}** — ${needsReply[0].subject}`);
  }
  if (needsReply[1]) {
    suggestedActions.push(`Follow up with **${needsReply[1].from}** — ${needsReply[1].subject}`);
  }
  if (important[0] && !needsReply.includes(important[0])) {
    suggestedActions.push(`Review **${important[0].from}** — ${important[0].subject}`);
  }

  return {
    intent: "email_summary",
    message: `**Email Summary — ${unread.length} unread, ${state.emails.length} in inbox**

**Urgent (${urgent.length}):**
${urgent.map((e) => `• **${e.from}** — ${e.subject}\n  _${e.preview.slice(0, 120)}_`).join("\n\n") || "None"}

**Needs Reply (${needsReply.length}):**
${needsReply.map((e) => `• **${e.from}** — ${e.subject}`).join("\n") || "None"}

**Important (${important.length}):**
${important.slice(0, 5).map((e) => `• **${e.from}** — ${e.subject}`).join("\n") || "None"}

**Suggested Actions:**
${suggestedActions.map((a, i) => `${i + 1}. ${a}`).join("\n") || "Your inbox looks clear — no urgent actions needed."}`,
    speak: true,
  };
}

function parseReplyTarget(message: string): { from?: string; subject?: string } {
  const replyMatch = message.match(
    /(?:draft a reply to|reply to)\s+(.+?)(?:\s+about\s+(.+))?$/i
  );
  if (replyMatch) {
    return {
      from: replyMatch[1]?.replace(/["']/g, "").trim(),
      subject: replyMatch[2]?.replace(/["']/g, "").trim(),
    };
  }

  const toMatch = message.match(/(?:email|to)\s+([A-Za-z\s]+?)(?:\s+about|\s+regarding|$)/i);
  return { from: toMatch?.[1]?.trim() };
}

function draftEmail(message: string, state: AppState): AIResponse {
  const isReply = /draft.*reply|reply to/i.test(message);
  const { from: fromHint, subject: subjectHint } = parseReplyTarget(message);
  const matchedEmail = isReply
    ? findEmailByContext(state.emails, fromHint, subjectHint)
    : undefined;

  const recipient = matchedEmail?.from || fromHint || "the recipient";
  const contact = state.contacts.find(
    (c) =>
      c.name.toLowerCase().includes(recipient.toLowerCase()) ||
      c.email?.toLowerCase() === matchedEmail?.fromEmail.toLowerCase()
  );

  const replySubject = matchedEmail
    ? matchedEmail.subject.startsWith("Re:")
      ? matchedEmail.subject
      : `Re: ${matchedEmail.subject}`
    : `Follow-up — ${state.user?.company}`;

  const draftBody = matchedEmail
    ? `Hi ${matchedEmail.from.split(" ")[0] || matchedEmail.from},

Thank you for your email regarding "${matchedEmail.subject}".

I've reviewed the details${matchedEmail.body.includes("Teams") || matchedEmail.body.includes("meeting") ? " and noted the meeting information" : ""}. I'll follow up with next steps shortly.

Please let me know if you need anything else in the meantime.

Best regards,
${state.user?.name || "Kash Valliani"}
${state.user?.role || "Founder & President"} | ${state.user?.company || "Valliani Jewelers"}`
    : `Dear ${contact?.name || recipient},

I hope this message finds you well. I wanted to follow up regarding our recent discussion and ensure we are aligned on next steps.

Please let me know if you have any questions or if there's anything else I can assist with.

Best regards,
${state.user?.name || "Kash Valliani"}
${state.user?.role || "Founder & President"} | ${state.user?.company || "Valliani Jewelers"}`;

  const toAddress =
    matchedEmail?.fromEmail || contact?.email || `${recipient.toLowerCase().replace(/\s/g, "")}@example.com`;

  const pendingAction: PendingAction = {
    id: uuidv4(),
    type: "email",
    title: isReply ? `Reply to ${recipient}` : `Email to ${contact?.name || recipient}`,
    preview: draftBody,
    payload: {
      to: toAddress,
      subject: replySubject,
      body: draftBody,
      inReplyTo: matchedEmail?.id,
    },
    createdAt: new Date().toISOString(),
  };

  return {
    intent: "email_draft",
    message: `I've drafted ${isReply ? "a reply" : "an email"} for your review:

**To:** ${recipient} (${toAddress})
**Subject:** ${replySubject}

---
${draftBody}
---

Should I send this email?`,
    pendingAction,
    speak: true,
  };
}

function draftWhatsApp(message: string, state: AppState): AIResponse {
  const { contact, content } = extractWhatsAppDetails(message, state);
  const contactInfo = state.contacts.find((c) => c.name.toLowerCase().includes(contact.toLowerCase()));

  const pendingAction: PendingAction = {
    id: uuidv4(),
    type: "whatsapp",
    title: `WhatsApp to ${contactInfo?.name || contact}`,
    preview: content,
    payload: {
      contactId: contactInfo?.id,
      contactName: contactInfo?.name || contact,
      phone: contactInfo?.whatsapp || contactInfo?.phone,
      content,
    },
    createdAt: new Date().toISOString(),
  };

  return {
    intent: "whatsapp_draft",
    message: `Here's the WhatsApp message preview:

**To:** ${contactInfo?.name || contact}${contactInfo?.role ? ` (${contactInfo.role})` : ""}
**Message:** "${content}"

Should I send this?`,
    pendingAction,
    speak: true,
  };
}

function createReminder(message: string): AIResponse {
  const details = extractReminderDetails(message);
  const reminder: Reminder = {
    id: uuidv4(),
    title: details.title || "New reminder",
    description: details.description,
    dueDate: details.dueDate || new Date().toISOString().split("T")[0],
    dueTime: details.dueTime,
    priority: details.priority || "medium",
    completed: false,
    recurring: details.recurring,
    recurringDay: details.recurringDay,
    createdAt: new Date().toISOString(),
  };

  return {
    intent: "reminder_create",
    message: `Reminder created:

**${reminder.title}**
📅 ${reminder.dueDate}${reminder.dueTime ? ` at ${reminder.dueTime}` : ""}
${reminder.recurring ? `🔁 Repeats every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][reminder.recurringDay || 0]}` : ""}
Priority: ${reminder.priority}

I'll notify you when it's due.`,
    speak: true,
    data: { reminder },
  };
}

function listStores(message: string): AIResponse {
  if (isStoreDirectoryAvailable()) {
    const answer = answerStoreQuery(message);
    return {
      intent: "store_list",
      message: answer.markdown,
      speak: true,
    };
  }
  const region = detectStoreRegionQuery(message) ?? "all";
  return {
    intent: "store_list",
    message: buildStoreListMarkdown(region),
    speak: true,
  };
}

function deleteTask(message: string, state: AppState): AIResponse {
  const lastAssistant = [...state.chatHistory]
    .reverse()
    .find((m) => m.role === "assistant")
    ?.content;
  const contextMessage = lastAssistant ? `${lastAssistant}\n${message}` : message;
  const target =
    resolveTaskTarget(contextMessage, state.reminders) ??
    resolveTaskTarget(message, state.reminders);
  if (!target) {
    return {
      intent: "task_delete",
      message:
        "I couldn't find which task to remove. Please say the task name, or open Calendar & Tasks to delete it manually.",
      speak: true,
    };
  }

  return {
    intent: "task_delete",
    message: `Removed task:\n\n**${target.title}**`,
    speak: true,
    data: { deletedReminderId: target.id },
  };
}

function completeTask(message: string, state: AppState): AIResponse {
  const lastAssistant = [...state.chatHistory]
    .reverse()
    .find((m) => m.role === "assistant")
    ?.content;
  const contextMessage = lastAssistant ? `${lastAssistant}\n${message}` : message;
  const target =
    resolveTaskTarget(contextMessage, state.reminders) ??
    resolveTaskTarget(message, state.reminders);
  if (!target) {
    return {
      intent: "task_complete",
      message:
        "I couldn't find which task to mark complete. Please say the task name, or check Calendar & Tasks.",
      speak: true,
    };
  }

  return {
    intent: "task_complete",
    message: `Marked complete:\n\n**${target.title}**`,
    speak: true,
    data: { completedReminderId: target.id },
  };
}

function listReminders(state: AppState): AIResponse {
  const pending = state.reminders.filter((r) => !r.completed);
  const high = pending.filter((r) => r.priority === "high");

  return {
    intent: "reminder_list",
    message: `**Pending Tasks (${pending.length})**

${high.length > 0 ? `**High Priority:**\n${high.map((r) => `• ${r.title}${r.dueTime ? ` — ${r.dueTime}` : ""}`).join("\n")}\n\n` : ""}**All Tasks:**
${pending.map((r) => `• [${r.priority.toUpperCase()}] ${r.title} — ${r.dueDate}${r.dueTime ? ` ${r.dueTime}` : ""}`).join("\n") || "No pending tasks. You're all caught up!"}`,
    speak: true,
  };
}

function showCalendar(message: string, state: AppState): AIResponse {
  const tz = userTimezone(state);
  const { label, dateKey, formattedDate } = resolveCalendarDay(message, tz);
  const googleConnected = state.integrations?.google?.connected ?? false;

  const dayEvents = state.events
    .filter((e) => isEventOnDate(e.start, dateKey, tz) && e.status !== "cancelled")
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const sourceNote = googleConnected
    ? `\n\n_Synced from Google Calendar (${tz})._`
    : "\n\n_Using demo calendar — connect Google in Settings for live events._";

  return {
    intent: "calendar_today",
    message: `**${label}** — ${formattedDate} (${dayEvents.length} events)

${dayEvents.map((e) => {
  const start = new Date(e.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const end = new Date(e.end).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  return `**${start} – ${end}** — ${e.title}\n${e.location ? `📍 ${e.location}` : ""}${e.attendees.length ? `\n👥 ${e.attendees.join(", ")}` : ""}`;
}).join("\n\n") || "No meetings scheduled for this day. Your calendar is clear."}${sourceNote}`,
    speak: true,
    data: { events: dayEvents, dateKey },
  };
}

function summarizeDocument(state: AppState): AIResponse {
  const doc = state.documents[0];
  if (!doc) {
    return {
      intent: "document_summarize",
      message: "No documents uploaded yet. Please upload a document on the Documents screen, and I'll analyze it for you.",
      speak: true,
    };
  }

  return {
    intent: "document_summarize",
    message: `**Summary: ${doc.name}**

${doc.summary || "Document analyzed successfully."}

**Key Points:**
${doc.keyPoints?.map((p) => `• ${p}`).join("\n") || "• No key points extracted"}

${doc.actionItems?.length ? `**Action Items:**\n${doc.actionItems.map((a) => `• ${a}`).join("\n")}` : ""}`,
    speak: true,
    data: { document: doc },
  };
}

function analyzeImage(state: AppState): AIResponse {
  const latest = state.imageAnalyses[0];
  if (!latest) {
    return {
      intent: "image_analyze",
      message: `Please upload an image on the Image Analysis screen. I can analyze:
• Dashboard screenshots
• Business charts and reports
• Whiteboard photos
• Business cards
• Product images

Once uploaded, ask me "What does this show?" and I'll provide insights.`,
      speak: true,
    };
  }

  return {
    intent: "image_analyze",
    message: `**Image Analysis: ${latest.name}**

${latest.description}

**Insights:**
${latest.insights.map((i) => `• ${i}`).join("\n")}

${latest.actionItems?.length ? `**Recommended Actions:**\n${latest.actionItems.map((a) => `• ${a}`).join("\n")}` : ""}`,
    speak: true,
    data: { analysis: latest },
  };
}

function prepareCall(message: string, state: AppState): AIResponse {
  const callMatch = message.match(/call\s+(\w+)/i);
  const purposeMatch = message.match(/(?:ask|about|regarding|if)\s+(.+?)$/i);
  const personName = callMatch?.[1] || "Ahmed";
  const contact = state.contacts.find((c) => c.name.toLowerCase().includes(personName.toLowerCase()));
  const purpose = purposeMatch?.[1]?.trim() || "Follow up on pending matters";

  const pendingAction: PendingAction = {
    id: uuidv4(),
    type: "call",
    title: `Call ${contact?.name || personName}`,
    preview: `Purpose: ${purpose}`,
    payload: {
      contactName: contact?.name || personName,
      phone: contact?.phone || "+1-555-0000",
      purpose,
    },
    createdAt: new Date().toISOString(),
  };

  return {
    intent: "call_prepare",
    message: `I'm ready to place a call:

**Contact:** ${contact?.name || personName}
**Phone:** ${contact?.phone || "Number on file"}
**Purpose:** ${purpose}

Should I place this call? I'll log notes afterward and can create a follow-up task if needed.`,
    pendingAction,
    speak: true,
  };
}

function handleAcknowledgment(message: string): AIResponse {
  const lower = message.toLowerCase().trim();
  const isThanks = /thanks?|thank\s*you|thankyou|thx|\bty\b|appreciate|cheers/.test(lower);
  return {
    intent: "acknowledgment",
    message: isThanks
      ? "You're welcome! Let me know if you need anything else."
      : "Got it. I'm here whenever you need me.",
    speak: true,
  };
}

function handleConfirmAction(state: AppState): AIResponse {
  const pending = state.pendingActions[0];
  if (!pending) {
    return {
      intent: "confirm_action",
      message: "There's nothing pending confirmation right now. What would you like me to help with?",
      speak: true,
    };
  }

  let resultMessage = "";
  switch (pending.type) {
    case "email":
      resultMessage = `✅ Email sent to ${pending.payload.to}. I've logged this in your activity history.`;
      break;
    case "whatsapp":
      resultMessage = `✅ WhatsApp message sent to ${pending.payload.contactName}: "${pending.payload.content}"`;
      break;
    case "call":
      resultMessage = `✅ Call initiated to ${pending.payload.contactName}. Once complete, I'll help you log notes and create follow-up tasks.`;
      break;
    case "meeting_create":
      resultMessage = `✅ Meeting scheduled with ${pending.payload.person} on ${pending.payload.date} at ${pending.payload.time}. Calendar invites have been sent.`;
      break;
    default:
      resultMessage = "✅ Action completed successfully.";
  }

  return {
    intent: "confirm_action",
    message: resultMessage,
    speak: true,
    data: { confirmedAction: pending, clearPending: true },
  };
}

function handleRejectAction(state: AppState): AIResponse {
  if (state.pendingActions.length === 0) {
    return {
      intent: "reject_action",
      message: "No pending actions to cancel.",
      speak: true,
    };
  }

  return {
    intent: "reject_action",
    message: "Understood. I've cancelled that action. Would you like me to revise it, or is there something else I can help with?",
    speak: true,
    data: { clearPending: true },
  };
}

export function executeSideEffects(response: AIResponse, state: AppState): Partial<AppState> {
  const updates: Partial<AppState> = {};

  if (response.data?.reminder) {
    updates.reminders = [...state.reminders, response.data.reminder as Reminder];
  }

  if (response.data?.deletedReminderId) {
    updates.reminders = state.reminders.filter(
      (r) => r.id !== response.data!.deletedReminderId
    );
  }

  if (response.data?.completedReminderId) {
    updates.reminders = state.reminders.map((r) =>
      r.id === response.data!.completedReminderId ? { ...r, completed: true } : r
    );
  }

  if (response.pendingAction) {
    updates.pendingActions = [response.pendingAction];
  }

  if (response.data?.clearPending) {
    updates.pendingActions = [];
  }

  if (response.data?.confirmedAction) {
    const action = response.data.confirmedAction as PendingAction;
    updates.pendingActions = [];
    updates.recentActions = [
      {
        id: uuidv4(),
        type: action.type,
        description: action.title,
        timestamp: new Date().toISOString(),
        status: "completed" as const,
      },
      ...state.recentActions,
    ].slice(0, 20);

    if (action.type === "meeting_create") {
      const event: CalendarEvent = {
        id: uuidv4(),
        title: `Meeting with ${action.payload.person}`,
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        attendees: action.payload.attendees as string[],
        status: "confirmed",
      };
      updates.events = [...state.events, event];
    }

    if (action.type === "whatsapp") {
      updates.whatsappMessages = [
        {
          id: uuidv4(),
          contactId: (action.payload.contactId as string) || "",
          contactName: action.payload.contactName as string,
          content: action.payload.content as string,
          direction: "outgoing",
          status: "sent",
          createdAt: new Date().toISOString(),
        },
        ...state.whatsappMessages,
      ];
    }
  }

  return updates;
}

export function getMessageIntent(message: string): IntentType {
  return detectIntent(message);
}

export function shouldUseRuleEngine(message: string, state?: { pendingActions?: unknown[] }): boolean {
  const intent = detectIntent(message);
  if (intent === "confirm_action" || intent === "reject_action") {
    return !!(state?.pendingActions?.length);
  }
  return (
    intent === "acknowledgment" ||
    intent === "sales_report" ||
    intent === "calendar_today" ||
    intent === "email_summary" ||
    intent === "daily_briefing" ||
    intent === "reminder_list" ||
    intent === "date_query"
  );
}
