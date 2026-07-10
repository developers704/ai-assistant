import {
  fetchLiveNews,
  fetchRssPoliticsNews,
  fetchRssSportsNews,
} from "@/lib/news";
import { getMetaStatus } from "@/lib/social/meta-client";
import { getState } from "@/lib/store/server-store";
import { getAssistantSalesSummary } from "@/lib/assistant/sales-data";
import { sortTopProductsByUnits, filterTopProductSkus } from "@/lib/utils";
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

export async function estimateJewelleryPrice(args: {
  weight_grams: number;
  karat?: string;
  metal?: string;
  making_percent?: number;
  tax_percent?: number;
}): Promise<{ total: number; spokenAnswer: string }> {
  const weight = Math.max(0, args.weight_grams);
  const karat = args.karat ?? "22K";
  const metal = args.metal ?? "gold";
  const makingPct = args.making_percent ?? 12;
  const taxPct = args.tax_percent ?? 8;

  const rates = await getMarketRatesSummary();
  let ratePerGram = rates.gold22PerGram;
  if (metal === "silver") {
    ratePerGram = rates.silverPerGram;
  } else if (karat === "24K") {
    ratePerGram = rates.gold24PerGram;
  } else if (karat === "18K") {
    ratePerGram = Math.round(rates.gold24PerGram * KARAT_PURITY["18K"] * 100) / 100;
  } else if (karat === "14K") {
    ratePerGram = Math.round(rates.gold24PerGram * KARAT_PURITY["14K"] * 100) / 100;
  }

  const metalCost = weight * ratePerGram;
  const making = metalCost * (makingPct / 100);
  const subtotal = metalCost + making;
  const tax = subtotal * (taxPct / 100);
  const total = Math.round((subtotal + tax) * 100) / 100;

  const rateNote = rates.live ? "using live spot rates" : "using indicative rates";

  return {
    total,
    spokenAnswer: `For ${weight} grams of ${metal === "silver" ? "silver" : karat + " gold"}, estimated total is about $${total.toLocaleString()} ${rateNote}, including ${makingPct}% making and ${taxPct}% tax. Open the Calculator to fine-tune.`,
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

/** Integration and profile status for Settings voice answers. */
export function buildSettingsStatusScript(): string {
  const state = getState();
  const google = state.integrations?.google;
  const plaid = state.integrations?.plaid;
  const news = state.integrations?.news;
  const parts: string[] = [];

  parts.push(
    google?.connected
      ? `Google is connected${google.email ? ` as ${google.email}` : ""} for Gmail, Calendar, and Contacts.`
      : "Google is not connected. Connect it in Settings for live inbox and calendar."
  );

  parts.push(
    plaid?.connected
      ? `Plaid investments are connected${plaid.institutionName ? ` to ${plaid.institutionName}` : ""}.`
      : "Plaid is not connected."
  );

  parts.push(
    news?.configured
      ? "News API is configured for live industry headlines."
      : "News API is not configured on the server."
  );

  const social = getMetaStatus();
  parts.push(
    social.connected
      ? "Instagram Business is connected for the Social dashboard."
      : "Instagram is not connected. Add Meta env keys in Settings."
  );

  const prefs = state.user?.preferences;
  if (prefs?.confirmBeforeMeeting) {
    parts.push("Meeting confirmations are enabled.");
  }
  if (prefs?.confirmBeforeSend) {
    parts.push("Email send confirmations are enabled.");
  }

  return parts.join(" ");
}

/** Summarize latest uploaded report for Data Analyst voice queries. */
export function buildAnalystReportScript(userMessage?: string): string {
  const { summary, source, label } = getAssistantSalesSummary();
  if (source !== "report") {
    return "No sales report is loaded yet. Open Data Analyst and upload your CSV, or check the Sales Dashboard after a report is seeded.";
  }

  const topStores = summary.topStores.slice(0, 3);
  const topProducts = sortTopProductsByUnits(filterTopProductSkus(summary.topProducts)).slice(0, 3);
  const lower = (userMessage ?? "").toLowerCase();

  if (/\btop\s+(product|sku)/i.test(lower)) {
    if (!topProducts.length) return "The report has no product breakdown available.";
    return `From ${label ?? "your report"}, top SKUs by quantity: ${topProducts.map((p) => `${p.itemNumber} with ${p.units} units`).join(", ")}. Open Data Analyst for deeper queries.`;
  }

  if (/\btop\s+store/i.test(lower) && topStores[0]) {
    return `From ${label ?? "your report"}, top store is ${topStores[0].name} at $${Math.round(topStores[0].revenue).toLocaleString()} net. Open Data Analyst for custom analysis.`;
  }

  return `Latest report ${label ?? ""}: $${summary.totalRevenue.toLocaleString()} net revenue, ${summary.totalTransactions.toLocaleString()} units, ${topStores.length} stores tracked. Top store: ${topStores[0]?.name ?? "n/a"}. Open Data Analyst to run custom SQL on the CSV.`;
}
