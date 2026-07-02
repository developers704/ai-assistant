import {
  fetchLiveNews,
  fetchRssPoliticsNews,
  fetchRssSportsNews,
} from "@/lib/news";
import { getState } from "@/lib/store/server-store";
import {
  buildCalendarVoiceScript,
  getVoiceCalendarEvents,
} from "@/lib/voice/calendar-data";
import { buildEmailVoiceScript, getVoiceEmails } from "@/lib/voice/email-data";
import { buildTasksVoiceScript } from "@/lib/voice/tool-helpers";
import { getAssistantSalesSummary } from "@/lib/assistant/sales-data";
import { fetchMetalMetricSpot, KARAT_PURITY, TROY_OUNCE_GRAMS } from "@/lib/markets/metalmetric";

export interface MarketRatesSummary {
  gold22PerGram: number;
  gold24PerGram: number;
  silverPerGram: number;
  live: boolean;
  spokenAnswer: string;
}

export async function getMarketRatesSummary(): Promise<MarketRatesSummary> {
  const spot = await fetchMetalMetricSpot();
  const goldOz = spot?.goldPerOz ?? 4332;
  const silverOz = spot?.silverPerOz ?? 70;
  const live = spot?.live ?? false;
  const goldPerGram = goldOz / TROY_OUNCE_GRAMS;
  const gold22 = Math.round(goldPerGram * KARAT_PURITY["22K"] * 100) / 100;
  const gold24 = Math.round(goldPerGram * 100) / 100;
  const silverPerGram = Math.round((silverOz / TROY_OUNCE_GRAMS) * 100) / 100;

  return {
    gold22PerGram: gold22,
    gold24PerGram: gold24,
    silverPerGram,
    live,
    spokenAnswer: live
      ? `Live MetalMetric rates: 22 karat gold is about $${gold22} per gram, 24 karat is $${gold24}, and silver is $${silverPerGram} per gram. Open the Price Calculator for a full quote.`
      : `Indicative rates: 22 karat gold about $${gold22} per gram, silver about $${silverPerGram} per gram. Open the Price Calculator for details.`,
  };
}

export function estimateJewelleryPrice(args: {
  weight_grams: number;
  karat?: string;
  metal?: string;
  making_percent?: number;
  tax_percent?: number;
}): { total: number; spokenAnswer: string } {
  const weight = Math.max(0, args.weight_grams);
  const karat = args.karat ?? "22K";
  const metal = args.metal ?? "gold";
  const makingPct = args.making_percent ?? 12;
  const taxPct = args.tax_percent ?? 8;

  let ratePerGram = 127.7;
  if (metal === "silver") {
    ratePerGram = 2.25;
  } else {
    ratePerGram = { "24K": 139.3, "22K": 127.7, "18K": 104.5, "14K": 81.2 }[karat] ?? 127.7;
  }

  const metalCost = weight * ratePerGram;
  const making = metalCost * (makingPct / 100);
  const subtotal = metalCost + making;
  const tax = subtotal * (taxPct / 100);
  const total = Math.round((subtotal + tax) * 100) / 100;

  return {
    total,
    spokenAnswer: `For ${weight} grams of ${karat !== "22K" || metal === "silver" ? "" : "22K "}${metal}, estimated total is about $${total.toLocaleString()} including ${makingPct}% making and ${taxPct}% tax. Use the Calculator page to fine-tune.`,
  };
}

export async function getNewsHeadlinesScript(): Promise<string> {
  const result = await fetchLiveNews(false);
  if (!result.news.length) {
    return result.error
      ? "I couldn't load industry news right now. Open the News page to retry."
      : "No industry headlines available right now.";
  }
  const top = result.news.slice(0, 3);
  return `Top jewelry industry headlines: ${top.map((n) => n.title).join(". ")}. Open News for full stories and live gold charts.`;
}

export async function getSportsHeadlinesScript(): Promise<string> {
  const result = await fetchRssSportsNews(false);
  if (!result.news.length) {
    return result.error
      ? "I couldn't load sports news right now. Open the News page to retry."
      : "No sports headlines available right now.";
  }
  const top = result.news.slice(0, 3);
  return `Top sports headlines: ${top.map((n) => `${n.title}, from ${n.source}`).join(". ")}. Open News for the full sports feed.`;
}

export async function getPoliticsHeadlinesScript(): Promise<string> {
  const result = await fetchRssPoliticsNews(false);
  if (!result.news.length) {
    return result.error
      ? "I couldn't load politics news right now. Open the News page to retry."
      : "No politics headlines available right now.";
  }
  const top = result.news.slice(0, 4);
  return `Top US and world headlines: ${top.map((n) => n.title).join(". ")}. Open News for the full politics feed.`;
}

export async function buildDailyBriefingScript(): Promise<string> {
  const [calendar, inbox] = await Promise.all([getVoiceCalendarEvents(), getVoiceEmails()]);
  const { summary, source, label } = getAssistantSalesSummary();
  const tasks = buildTasksVoiceScript(getState().reminders);

  const salesLine =
    source === "report"
      ? `Latest report${label ? ` ${label}` : ""}: $${summary.totalRevenue.toLocaleString()} net, ${summary.totalTransactions.toLocaleString()} units.`
      : `Today's sales: $${summary.totalRevenue.toLocaleString()} across ${summary.totalTransactions} transactions.`;

  return [
    `Daily briefing for Kash.`,
    buildCalendarVoiceScript(calendar.events, calendar.tz),
    buildEmailVoiceScript(inbox.emails),
    tasks,
    salesLine,
  ].join(" ");
}
