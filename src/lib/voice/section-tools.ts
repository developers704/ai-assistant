import { fetchLiveNews } from "@/lib/news";
import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";
import { getState } from "@/lib/store/server-store";
import {
  buildCalendarVoiceScript,
  getVoiceCalendarEvents,
} from "@/lib/voice/calendar-data";
import { buildEmailVoiceScript, getVoiceEmails } from "@/lib/voice/email-data";
import { buildTasksVoiceScript } from "@/lib/voice/tool-helpers";

const TROY_OUNCE_GRAMS = 31.1035;
const KARAT_PURITY: Record<string, number> = {
  "24K": 1,
  "22K": 0.9167,
  "18K": 0.75,
  "14K": 0.5833,
};

async function fetchSpot(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.gold-api.com/price/${symbol}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: number };
    return typeof data.price === "number" ? data.price : null;
  } catch {
    return null;
  }
}

export interface MarketRatesSummary {
  gold22PerGram: number;
  gold24PerGram: number;
  silverPerGram: number;
  live: boolean;
  spokenAnswer: string;
}

export async function getMarketRatesSummary(): Promise<MarketRatesSummary> {
  const goldOz = (await fetchSpot("XAU")) ?? 4332;
  const silverOz = (await fetchSpot("XAG")) ?? 70;
  const live = (await fetchSpot("XAU")) != null;
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
      ? `Live rates: 22 karat gold is about $${gold22} per gram, 24 karat is $${gold24}, and silver is $${silverPerGram} per gram. Open the Price Calculator for a full quote.`
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

export interface HealthSnapshot {
  weightLb: number;
  heightIn: number;
  steps: number;
  stepGoal: number;
  caloriesBurned: number;
  restingHeartRate: number;
  sleepHours: number;
  waterCups: number;
  waterGoal: number;
}

export const DEFAULT_HEALTH: HealthSnapshot = {
  weightLb: 170,
  heightIn: 70,
  steps: 6500,
  stepGoal: 10000,
  caloriesBurned: 420,
  restingHeartRate: 62,
  sleepHours: 6.5,
  waterCups: 5,
  waterGoal: 8,
};

function computeBmi(weightLb: number, heightIn: number): number {
  if (!heightIn) return 0;
  return Math.round((weightLb / (heightIn * heightIn)) * 703 * 10) / 10;
}

export function buildHealthBriefing(data: HealthSnapshot = DEFAULT_HEALTH): string {
  const bmi = computeBmi(data.weightLb, data.heightIn);
  const stepPct = Math.round((data.steps / data.stepGoal) * 100);
  const waterPct = Math.round((data.waterCups / data.waterGoal) * 100);

  let bmiLabel = "healthy range";
  if (bmi < 18.5) bmiLabel = "underweight range";
  else if (bmi >= 25 && bmi < 30) bmiLabel = "overweight range";
  else if (bmi >= 30) bmiLabel = "obese range";

  return `Health briefing: BMI ${bmi}, ${bmiLabel}. Steps ${data.steps.toLocaleString()} of ${data.stepGoal.toLocaleString()} goal, ${stepPct} percent. Resting heart rate ${data.restingHeartRate}. Sleep ${data.sleepHours} hours. Water ${data.waterCups} of ${data.waterGoal} cups, ${waterPct} percent. Sync Apple Watch on the Health page for your latest numbers.`;
}

export async function getNewsHeadlinesScript(): Promise<string> {
  const result = await fetchLiveNews(false);
  if (!result.news.length) {
    return result.error
      ? "I couldn't load industry news right now. Open the News page to retry."
      : "No industry headlines available right now.";
  }
  const top = result.news.slice(0, 3);
  return `Top jewellery industry headlines: ${top.map((n) => n.title).join(". ")}. Open News for full stories and live gold charts.`;
}

export async function buildDailyBriefingScript(): Promise<string> {
  const [calendar, inbox] = await Promise.all([getVoiceCalendarEvents(), getVoiceEmails()]);
  const sales = computeSalesSummary(mockSalesData);
  const tasks = buildTasksVoiceScript(getState().reminders);

  return [
    `Daily briefing for Kash.`,
    buildCalendarVoiceScript(calendar.events, calendar.tz),
    buildEmailVoiceScript(inbox.emails),
    tasks,
    `Today's sales: $${sales.totalRevenue.toLocaleString()} across ${sales.totalTransactions} transactions.`,
  ].join(" ");
}
