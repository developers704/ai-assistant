import { priorYearCompareWindow } from "@/lib/reports/date-utils";
import { formatCurrency, formatPieceCount } from "@/lib/utils";

export type BriefWindow = "week" | "month" | "season";

export type BriefModel = {
  vendorModel?: string;
  name: string;
  revenue: number;
  units: number;
  onHandTotal?: number;
  imageUrl?: string | null;
  kashCost?: number | null;
  department?: string;
};

export type BriefRank = {
  name: string;
  revenue: number;
  units?: number;
  imageUrl?: string | null;
};

export type BriefPay = {
  name: string;
  revenue: number;
};

export type BriefFact = {
  label: string;
  value: string;
};

export type BriefStory = {
  id: string;
  kicker: string;
  title: string;
  deck: string;
  figure: string;
  tone: "up" | "down" | "ink";
  imageUrl?: string | null;
  facts: BriefFact[];
};

export type BriefSection = {
  id: "models" | "stores" | "vendors" | "people" | "pay";
  label: string;
  stories: BriefStory[];
};

export type BriefEdition = {
  from: string;
  to: string;
  lyFrom: string | null;
  lyTo: string | null;
  net: number;
  lyNet: number;
  units: number;
  delta: number | null;
  headline: string;
  deck: string;
  sections: BriefSection[];
};

const SECTION_LIMIT = 6;

export function inclusiveDays(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function shiftIsoDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Week, month-to-date, or Jul 1–through, ending on the latest sales day. */
export function briefWindowRange(window: BriefWindow, dataThrough: string): { from: string; to: string } {
  const to = dataThrough;
  if (window === "week") return { from: shiftIsoDays(to, -6), to };
  if (window === "month") return { from: `${to.slice(0, 7)}-01`, to };
  const year = to.slice(0, 4);
  const seasonStart = `${year}-07-01`;
  return { from: seasonStart <= to ? seasonStart : `${year}-01-01`, to };
}

export function briefPriorYear(from: string, to: string): { from: string; to: string } | null {
  return priorYearCompareWindow(from, to, "2025-01-01");
}

/** Null when last year has no base to compare. */
export function pctDelta(current: number, prior: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
  if (prior === 0) return current === 0 ? 0 : null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

export function forecastTwoWeeks(units: number, dayCount: number): number {
  if (dayCount <= 0 || units <= 0) return 0;
  return (units / dayCount) * 14;
}

function toneOf(delta: number | null): "up" | "down" | "ink" {
  if (delta == null || Math.abs(delta) < 5) return "ink";
  return delta > 0 ? "up" : "down";
}

export function formatSignedPct(delta: number | null): string {
  if (delta == null) return "New";
  if (Math.abs(delta) < 0.5) return "Level";
  const rounded = Math.round(delta);
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${Math.abs(rounded)}%`;
}

function money(n: number): string {
  return formatCurrency(n);
}

function pieces(n: number): string {
  return formatPieceCount(n);
}

function forecastLabel(units: number): string {
  if (units <= 0) return "0";
  if (units < 10) {
    const rounded = Math.round(units * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return String(Math.round(units));
}

function modelKey(model: BriefModel): string {
  return (model.vendorModel || model.name || "").trim().toUpperCase();
}

function modelTitle(model: BriefModel): string {
  return (model.vendorModel || model.name || "—").trim() || "—";
}

function kickerForModel(input: {
  units: number;
  onHand: number | null;
  delta: number | null;
}): string {
  const { units, onHand, delta } = input;
  if (onHand != null && units >= 3 && onHand <= 1) return "Running thin";
  if (onHand != null && onHand >= 6 && units > 0 && onHand > units * 3) return "Stock is heavy";
  if (delta == null) return "New this year";
  if (delta >= 20) return "Ahead of last year";
  if (delta <= -20) return "Behind last year";
  return "Steady";
}

function kashLine(revenue: number, units: number, kashCost: number | null | undefined): string | null {
  if (kashCost == null || !(kashCost > 0) || units <= 0) return null;
  const avg = revenue / units;
  if (avg < kashCost) return `Average ${money(avg)} sits under Kash cost ${money(kashCost)}.`;
  return `Average ${money(avg)} clears Kash cost ${money(kashCost)}.`;
}

function isJewelryModel(model: BriefModel): boolean {
  const vm = (model.vendorModel || model.name || "").trim().toUpperCase();
  const name = `${model.name || ""} ${model.department || ""}`.toUpperCase();
  if (!vm || vm === "—" || vm === "ITEM" || vm === "BATTERY") return false;
  if (vm.startsWith("MLB-") || vm.startsWith("JVV-")) return false;
  if (/RECYCLING FEE|CARE PLAN|GIFT BOX|\bBATTERY\b/.test(name)) return false;
  const avg = model.units > 0 ? model.revenue / model.units : model.revenue;
  if (model.units > 0 && avg < 40) return false;
  return model.revenue !== 0 || model.units !== 0;
}

/** A few fast movers and a few big tickets, without fee or care-plan lines. */
function pickModels(models: BriefModel[]): BriefModel[] {
  const pool = models.filter(isJewelryModel);
  const byUnits = [...pool].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  const byRevenue = [...pool].sort((a, b) => b.revenue - a.revenue || b.units - a.units);
  const chosen: BriefModel[] = [];
  const seen = new Set<string>();
  for (const model of [...byRevenue.slice(0, 3), ...byUnits.slice(0, 3)]) {
    const key = modelKey(model);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    chosen.push(model);
  }
  return chosen.slice(0, SECTION_LIMIT);
}

function buildModelStories(models: BriefModel[], lyModels: BriefModel[], dayCount: number, showKash: boolean): BriefStory[] {
  const ly = new Map(lyModels.filter(isJewelryModel).map((m) => [modelKey(m), m]));
  const ranked = pickModels(models);

  return ranked.map((m) => {
    const title = modelTitle(m);
    const prior = ly.get(modelKey(m));
    const delta = prior ? pctDelta(m.revenue, prior.revenue) : null;
    const onHand = m.onHandTotal == null ? null : m.onHandTotal;
    const next = forecastTwoWeeks(m.units, dayCount);
    const kash = showKash ? kashLine(m.revenue, m.units, m.kashCost) : null;
    const lySentence = prior
      ? `Last year this window was ${money(prior.revenue)} on ${pieces(prior.units)}.`
      : "Not among last year's leading models.";
    const handSentence = onHand == null ? "" : ` ${pieces(onHand)} on hand.`;
    const forecastSentence =
      next > 0 ? ` About ${forecastLabel(next)} in the next two weeks.` : "";
    const dept = m.department && m.name && m.name !== title ? `${m.department}. ` : "";
    return {
      id: `model:${title}`,
      kicker: kickerForModel({ units: m.units, onHand, delta }),
      title,
      deck: `${dept}Sold ${pieces(m.units)} for ${money(m.revenue)}.${handSentence} ${lySentence}${forecastSentence}${kash ? ` ${kash}` : ""}`.replace(/\s+/g, " ").trim(),
      figure: formatSignedPct(delta),
      tone: toneOf(delta),
      imageUrl: m.imageUrl,
      facts: [
        { label: "Sold", value: pieces(m.units) },
        { label: "Net", value: money(m.revenue) },
        { label: "On hand", value: onHand == null ? "—" : pieces(onHand) },
        { label: "Last year", value: prior ? money(prior.revenue) : "—" },
        { label: "Next 2 wks", value: forecastLabel(next) },
        ...(showKash && m.kashCost != null && m.kashCost > 0
          ? [{ label: "Kash CP", value: money(m.kashCost) }]
          : []),
      ],
    };
  });
}

function buildRankStories(prefix: string, rows: BriefRank[], lyRows: BriefRank[]): BriefStory[] {
  const ly = new Map(lyRows.map((r) => [r.name.trim().toUpperCase(), r]));
  return [...rows]
    .filter((r) => r.name && r.revenue !== 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, SECTION_LIMIT)
    .map((r) => {
      const prior = ly.get(r.name.trim().toUpperCase());
      const delta = prior ? pctDelta(r.revenue, prior.revenue) : null;
      const kicker = delta == null ? "New this year" : delta >= 20 ? "Ahead of last year" : delta <= -20 ? "Behind last year" : "Steady";
      return {
        id: `${prefix}:${r.name}`,
        kicker,
        title: r.name,
        deck: `${money(r.revenue)} this window${r.units != null ? `, ${pieces(r.units)}` : ""}. ${
          prior ? `Last year ${money(prior.revenue)}.` : "Not among last year's leaders."
        }`,
        figure: formatSignedPct(delta),
        tone: toneOf(delta),
        imageUrl: r.imageUrl,
        facts: [
          { label: "Net", value: money(r.revenue) },
          { label: "Last year", value: prior ? money(prior.revenue) : "—" },
          { label: "Vs last year", value: formatSignedPct(delta) },
          ...(r.units != null ? [{ label: "Units", value: pieces(r.units) }] : []),
        ],
      };
    });
}

function buildPayStories(rows: BriefPay[], lyRows: BriefPay[]): BriefStory[] {
  const ly = new Map(lyRows.map((r) => [r.name.trim().toUpperCase(), r]));
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  return [...rows]
    .filter((r) => r.name && r.revenue !== 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, SECTION_LIMIT)
    .map((r) => {
      const prior = ly.get(r.name.trim().toUpperCase());
      const delta = prior ? pctDelta(r.revenue, prior.revenue) : null;
      const share = total > 0 ? Math.round((r.revenue / total) * 100) : 0;
      return {
        id: `pay:${r.name}`,
        kicker: delta == null ? "New this year" : delta >= 15 ? "Heavier than last year" : delta <= -15 ? "Lighter than last year" : "Steady",
        title: r.name,
        deck: `${money(r.revenue)} applied, ${share}% of this window. ${
          prior ? `Last year ${money(prior.revenue)}.` : "Not among last year's leading methods."
        }`,
        figure: formatSignedPct(delta),
        tone: toneOf(delta),
        facts: [
          { label: "Applied", value: money(r.revenue) },
          { label: "Share", value: `${share}%` },
          { label: "Last year", value: prior ? money(prior.revenue) : "—" },
          { label: "Vs last year", value: formatSignedPct(delta) },
        ],
      };
    });
}

function paperHeadline(delta: number | null, leadName: string | null): string {
  const who = leadName ? `${leadName} leads` : "The floor";
  if (delta == null) return `${who} this edition.`;
  if (delta >= 8) return `${who}, ahead of last year.`;
  if (delta <= -8) return `${who}, behind last year's pace.`;
  return `${who}, level with last year.`;
}

export function buildBriefEdition(input: {
  from: string;
  to: string;
  net: number;
  lyNet: number;
  units: number;
  models: BriefModel[];
  lyModels: BriefModel[];
  stores: BriefRank[];
  lyStores: BriefRank[];
  vendors: BriefRank[];
  lyVendors: BriefRank[];
  people: BriefRank[];
  lyPeople: BriefRank[];
  pay: BriefPay[];
  lyPay: BriefPay[];
  showKash: boolean;
}): BriefEdition {
  const ly = briefPriorYear(input.from, input.to);
  const days = inclusiveDays(input.from, input.to);
  const delta = pctDelta(input.net, input.lyNet);
  const sections: BriefSection[] = [
    { id: "models", label: "Models", stories: buildModelStories(input.models, input.lyModels, days, input.showKash) },
    { id: "stores", label: "Stores", stories: buildRankStories("store", input.stores, input.lyStores) },
    { id: "vendors", label: "Vendors", stories: buildRankStories("vendor", input.vendors, input.lyVendors) },
    { id: "people", label: "People", stories: buildRankStories("person", input.people, input.lyPeople) },
    { id: "pay", label: "Pay", stories: buildPayStories(input.pay, input.lyPay) },
  ];
  const topStore = [...input.stores].sort((a, b) => b.revenue - a.revenue)[0]?.name ?? null;
  const topModel = pickModels(input.models)[0];
  const modelBit = topModel ? `${modelTitle(topModel)} is the busiest model.` : "";
  const pace =
    delta == null
      ? `${money(input.net)} net.`
      : `${money(input.net)} net, ${formatSignedPct(delta)} versus the same weekdays last year.`;
  return {
    from: input.from,
    to: input.to,
    lyFrom: ly?.from ?? null,
    lyTo: ly?.to ?? null,
    net: input.net,
    lyNet: input.lyNet,
    units: input.units,
    delta,
    headline: paperHeadline(delta, topStore),
    deck: `${pace} ${modelBit}`.trim(),
    sections,
  };
}
