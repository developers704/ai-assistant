import type { AlexaIntent, AlexaWorkingMemory, AlexaDomain } from "@/lib/alexa/types";
import { unknownIntent } from "@/lib/alexa/types";
import { resolveEntitiesFromText, shouldClarifyEntity } from "@/lib/alexa/entity-resolver";
import { routeIntent } from "@/lib/ai/intent-router";

function domainFromRouted(intent: string): AlexaDomain {
  if (intent.startsWith("sales")) return "sales";
  if (intent.startsWith("email")) return "email";
  if (intent.startsWith("calendar") || intent.includes("meeting")) return "calendar";
  if (intent.startsWith("task")) return "tasks";
  if (intent.startsWith("contact")) return "contacts";
  if (intent.startsWith("store")) return "stores";
  if (intent.startsWith("social") || intent.includes("instagram")) return "social";
  if (intent.includes("metal") || intent.includes("price") || intent.includes("calculator"))
    return "calculator";
  if (intent.includes("news") || intent.includes("sports") || intent.includes("politics"))
    return "news";
  if (intent.includes("knowledge") || intent.includes("policy")) return "knowledge";
  if (intent.includes("nav") || intent === "navigation") return "navigation";
  if (intent.includes("image")) return "media";
  if (intent === "unknown") return "unknown";
  return "general";
}

function actionFromRouted(intent: string): string {
  if (intent.includes("create") || intent.includes("add") || intent.includes("schedule"))
    return "create";
  if (intent.includes("delete") || intent.includes("cancel") || intent.includes("remove"))
    return "delete";
  if (intent.includes("draft") || intent.includes("compose")) return "draft";
  if (intent.includes("compare")) return "compare";
  if (intent.includes("query") || intent.includes("summary") || intent.includes("list"))
    return "query";
  if (intent.includes("open") || intent === "navigation") return "navigate";
  return "query";
}

function detectDisplayIntent(message: string): AlexaIntent["displayIntent"] {
  const m = message.toLowerCase();
  if (/\b(open|navigate|take me to|go to|kholo)\b/i.test(m)) return "open";
  if (/\b(show|display|dikha)\b/i.test(m)) return "show";
  if (/\b(tell|what|how much|summarize|explain|batao)\b/i.test(m)) return "tell";
  if (/\b(schedule|delete|send|create|add)\b/i.test(m)) return "execute";
  return "unknown";
}

function mergeFollowUp(
  message: string,
  base: AlexaIntent,
  memory: AlexaWorkingMemory
): AlexaIntent {
  const m = message.toLowerCase();
  const sales = memory.salesContext;
  if (!sales || memory.lastDomain !== "sales") return base;

  const isFollowUp =
    /^(now|and|also)\b/i.test(message.trim()) ||
    /\bby\s+(department|store|vendor|design|class)\b/i.test(m) ||
    /\bcompare\s+with\b/i.test(m);

  if (!isFollowUp) return base;

  const entities = { ...base.entities };
  if (sales.designs?.length) entities.designs = sales.designs;
  if (sales.dateRange) entities.dateRange = sales.dateRange;
  if (sales.stores?.length) entities.stores = sales.stores;

  let groupBy = base.groupBy ?? sales.groupBy;
  const gb = m.match(/\bby\s+(department|store|vendor|design|class)\b/i);
  if (gb) groupBy = [gb[1].toLowerCase()];

  if (/\bcompare\s+with\b/i.test(m) && base.entities.designs) {
    entities.compareDesigns = [
      ...(Array.isArray(entities.designs) ? entities.designs : []),
      ...(Array.isArray(base.entities.designs) ? (base.entities.designs as string[]) : []),
    ];
  }

  return {
    ...base,
    domain: "sales",
    action: /\bcompare\b/i.test(m) ? "compare" : "query",
    confidence: Math.max(base.confidence, 0.9),
    requiresTool: true,
    entities,
    groupBy,
    metrics: base.metrics ?? sales.metrics ?? ["net_sales"],
  };
}

export async function resolveAlexaIntent(input: {
  normalizedMessage: string;
  memory: AlexaWorkingMemory;
  currentRoute?: string;
}): Promise<AlexaIntent> {
  const message = input.normalizedMessage;
  const routed = routeIntent({
    message,
    currentPath: input.currentRoute ?? input.memory.currentRoute,
  });
  const entities = resolveEntitiesFromText(message);
  const domain = domainFromRouted(routed);
  const action = actionFromRouted(routed);
  const displayIntent = detectDisplayIntent(message);
  const isWrite = action === "create" || action === "delete" || action === "draft";

  const entityMap: Record<string, unknown> = {};
  const missingFields: string[] = [];
  let requiresClarification = false;

  for (const e of entities) {
    if (shouldClarifyEntity(e, isWrite && (e.type === "contact" || e.type === "store"))) {
      requiresClarification = true;
      missingFields.push(e.type);
    }
    if (e.type === "design" && e.resolvedValue) {
      entityMap.designs = [...((entityMap.designs as string[]) ?? []), e.resolvedValue];
    }
    if (e.type === "store" && e.resolvedValue) {
      entityMap.stores = [...((entityMap.stores as string[]) ?? []), e.resolvedValue];
    }
    if (e.type === "contact" && e.resolvedValue) {
      entityMap.contact = e.resolvedValue;
    }
    if (e.type === "section" && e.resolvedValue) {
      entityMap.section = e.resolvedValue;
    }
  }

  if (/\byesterday\b/i.test(message)) entityMap.dateRange = { type: "yesterday" };
  else if (/\btoday\b/i.test(message)) entityMap.dateRange = { type: "today" };
  else if (/\bthis\s+month\b/i.test(message)) entityMap.dateRange = { type: "this_month" };

  if (/\btomorrow\b/i.test(message)) entityMap.date = "tomorrow";

  const groupByMatch = message.match(/\bby\s+(department|store|vendor|design|class)\b/i);
  const groupBy = groupByMatch ? [groupByMatch[1].toLowerCase()] : undefined;

  if (action === "create" && domain === "calendar" && !/\b\d{1,2}\s*(am|pm|:)\b/i.test(message)) {
    requiresClarification = true;
    if (!missingFields.includes("time")) missingFields.push("time");
  }

  let intent: AlexaIntent = {
    domain,
    action,
    confidence: routed === "unknown" ? 0.35 : 0.9,
    requiresTool: routed !== "unknown" && domain !== "general",
    requiresClarification,
    missingFields,
    requiresConfirmation:
      action === "delete" ||
      (action === "create" && (domain === "calendar" || domain === "email")),
    requestedNavigation:
      displayIntent === "open" ||
      displayIntent === "show" ||
      displayIntent === "navigate",
    displayIntent,
    entities: entityMap,
    metrics: domain === "sales" ? ["net_sales"] : undefined,
    groupBy,
  };

  if (routed === "unknown") {
    intent = unknownIntent({
      ...intent,
      confidence: 0.2,
      requiresTool: false,
    });
  }

  return mergeFollowUp(message, intent, input.memory);
}
