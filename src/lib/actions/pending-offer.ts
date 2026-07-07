import type { PendingAction } from "@/types";
import { createPendingAction, savePendingAction } from "@/lib/actions/confirmation";

export type OfferTarget =
  | "news"
  | "sales"
  | "email"
  | "calendar"
  | "dashboard"
  | "analyst"
  | "images"
  | "contacts";

const OFFER_PATHS: Record<OfferTarget, string> = {
  news: "/news",
  sales: "/sales",
  email: "/email",
  calendar: "/calendar",
  dashboard: "/dashboard",
  analyst: "/analyst",
  images: "/images",
  contacts: "/contacts",
};

const OFFER_LABELS: Record<OfferTarget, string> = {
  news: "News & Markets",
  sales: "Sales Dashboard",
  email: "Email",
  calendar: "Calendar & Tasks",
  dashboard: "Daily Briefing",
  analyst: "Data Analyst",
  images: "Image Generation",
  contacts: "Contacts",
};

export function offerPath(target: OfferTarget): string {
  return OFFER_PATHS[target];
}

export function offerLabel(target: OfferTarget): string {
  return OFFER_LABELS[target];
}

/** Save a lightweight pending offer (open page / run follow-up tool on "yes"). */
export function createAssistantOffer(input: {
  target: OfferTarget;
  summary: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  source?: "voice" | "chat";
}): PendingAction {
  return createPendingAction({
    type: "assistant_offer",
    title: `Open ${OFFER_LABELS[input.target]}`,
    summary: input.summary,
    preview: OFFER_LABELS[input.target],
    payload: {
      path: OFFER_PATHS[input.target],
      target: input.target,
      toolName: input.toolName,
      toolArgs: input.toolArgs ?? {},
    },
    toolName: input.toolName ?? "show_detail_page",
    source: input.source ?? "chat",
    riskLevel: "safe",
    confirmText: "yes",
    cancelText: "cancel",
  });
}

export function saveAssistantOffer(offer: PendingAction): void {
  savePendingAction(offer);
}

export function resolveOpenTargetFromMessage(message: string): OfferTarget | null {
  const lower = message.toLowerCase();
  if (/\bnews\b|\bmarket\b/i.test(lower)) return "news";
  if (/\bsales\b|\brevenue\b/i.test(lower)) return "sales";
  if (/\bemail\b|\binbox\b|\bmail\b/i.test(lower)) return "email";
  if (/\bcalendar\b|\bmeeting\b|\bschedule\b/i.test(lower)) return "calendar";
  if (/\bbriefing\b|\bdashboard\b/i.test(lower)) return "dashboard";
  if (/\banalyst\b/i.test(lower)) return "analyst";
  if (/\bimages?\b/i.test(lower)) return "images";
  if (/\bcontacts?\b/i.test(lower)) return "contacts";
  return null;
}
