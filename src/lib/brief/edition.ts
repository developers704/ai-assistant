import { priorYearCompareWindow } from "@/lib/reports/date-utils";
import { formatCurrency, formatPieceCount } from "@/lib/utils";

export type BriefStoreHouse = "aj" | "shaun" | "new";

/** Same selling stores as AJ_STORES / SHAUN_STORES. Kept here so the paper stays off the auth module. */
const AJ_HOUSE = new Set([
  "DBC-GM",
  "VJ-VAL",
  "VJ-EAST",
  "VJ-OAK",
  "VJ-LIV",
  "VJ-SERRA",
  "VJ-SAL",
  "VJ-MOD",
  "DBC-STOCK",
  "VJ-ARDN",
  "VJ-ROSE",
  "VJ-FRE",
  "VJ-CHAND",
  "VJ-DEER",
  "VJ-BAY",
  "VJ-BAKER",
]);
const SHAUN_HOUSE = new Set([
  "VJ-CULVER",
  "VJ-INLND",
  "VJ-ONT",
  "VJ-VICTOR",
  "VJ-PB",
  "VJ-NORTH",
  "VJ-PALM",
  "VJ-S.ANITA",
  "VJ-HEND",
]);
const NEW_STORES = new Set(["VJ-DEER", "VJ-BAY", "VJ-HEND"]);
const SKIP_STORES = new Set(["MAIN", "VJ-CON", "VJ-WEB", "CON", "WEB"]);

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

export type BriefLine = {
  id: string;
  name: string;
  revenue: number;
  units: number;
  lyRevenue: number | null;
  lyUnits: number | null;
  delta: number | null;
  tone: "up" | "down" | "ink";
};

export type BriefSection = {
  id: "departments" | "designs" | "models" | "stores" | "vendors" | "people" | "pay";
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

/** Same month and day last year. September 1–21 stays September 1–21. */
export function briefSameDatesLastYear(from: string, to: string): { from: string; to: string } | null {
  const start = minusOneCalendarYear(from);
  const end = minusOneCalendarYear(to);
  if (!start || !end || start > end) return null;
  return { from: start, to: end };
}

function minusOneCalendarYear(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const year = Number(iso.slice(0, 4)) - 1;
  const candidate = `${year}${iso.slice(4)}`;
  const parsed = new Date(`${candidate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) {
    return `${year}-02-28`;
  }
  return candidate;
}

/** Blank and "Unknown department / vendor / class / design" buckets stay out of stories. */
export function isUnknownBriefName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n || n === "—" || n === "-") return true;
  return n.startsWith("unknown");
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
  if (delta == null) return "This window";
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
        { label: "Next 2 wks", value: `${forecastLabel(next)} pcs` },
        ...(showKash && m.kashCost != null && m.kashCost > 0
          ? [{ label: "Kash CP", value: money(m.kashCost) }]
          : []),
      ],
    };
  });
}

function rankKey(name: string): string {
  return name.trim().toUpperCase();
}

function namedRanks(rows: BriefRank[]): BriefRank[] {
  return rows.filter((r) => r.name && !isUnknownBriefName(r.name) && r.revenue !== 0);
}

export function isNewBriefStore(name: string): boolean {
  return NEW_STORES.has(rankKey(name));
}

export function briefHouseForStore(name: string): BriefStoreHouse | "other" {
  const key = rankKey(name);
  if (NEW_STORES.has(key)) return "new";
  if (AJ_HOUSE.has(key)) return "aj";
  if (SHAUN_HOUSE.has(key)) return "shaun";
  return "other";
}

function storeMatchesHouse(name: string, house: BriefStoreHouse): boolean {
  const key = rankKey(name);
  if (SKIP_STORES.has(key) || isUnknownBriefName(name)) return false;
  if (house === "new") return NEW_STORES.has(key);
  if (house === "aj") return AJ_HOUSE.has(key);
  return SHAUN_HOUSE.has(key);
}

function sellingStores(rows: BriefRank[]): BriefRank[] {
  return namedRanks(rows).filter((r) => !SKIP_STORES.has(rankKey(r.name)));
}

function comparableDelta(current: number, prior: BriefRank | undefined, name: string): number | null {
  if (!prior || !(prior.revenue > 0) || isNewBriefStore(name)) return null;
  return pctDelta(current, prior.revenue);
}

export function storeLines(
  stores: BriefRank[],
  lyStores: BriefRank[],
  house: BriefStoreHouse,
  limit = 16
): BriefLine[] {
  const ly = new Map(sellingStores(lyStores).map((r) => [rankKey(r.name), r]));
  return sellingStores(stores)
    .filter((r) => storeMatchesHouse(r.name, house))
    .sort((a, b) => b.revenue - a.revenue || (b.units ?? 0) - (a.units ?? 0))
    .slice(0, limit)
    .map((r) => {
      const prior = ly.get(rankKey(r.name));
      const delta = comparableDelta(r.revenue, prior, r.name);
      return {
        id: `store:${r.name}`,
        name: r.name,
        revenue: r.revenue,
        units: r.units ?? 0,
        lyRevenue: prior ? prior.revenue : null,
        lyUnits: prior?.units ?? null,
        delta,
        tone: toneOf(delta),
      };
    });
}

function sumRanks(rows: BriefRank[]): { revenue: number; units: number; count: number } {
  return rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      units: acc.units + (r.units ?? 0),
      count: acc.count + 1,
    }),
    { revenue: 0, units: 0, count: 0 }
  );
}

function houseRows(rows: BriefRank[], house: BriefStoreHouse): BriefRank[] {
  return sellingStores(rows).filter((r) => storeMatchesHouse(r.name, house));
}

function buildHouseStory(
  id: string,
  title: string,
  nowRows: BriefRank[],
  lyRows: BriefRank[],
  kind: "house" | "new"
): BriefStory {
  const now = sumRanks(nowRows);
  const prior = sumRanks(lyRows);
  const delta = kind === "new" ? null : prior.revenue > 0 ? pctDelta(now.revenue, prior.revenue) : null;
  const lead = [...nowRows].sort((a, b) => b.revenue - a.revenue)[0]?.name ?? null;
  const kicker =
    kind === "new"
      ? "Opened this year"
      : delta == null
        ? "This September"
        : delta >= 8
          ? "Ahead of last year"
          : delta <= -8
            ? "Behind last year"
            : "Steady";
  const lySentence =
    kind === "new" || prior.revenue <= 0
      ? "No sales on these dates last year."
      : `Last year ${money(prior.revenue)} on the same dates.`;
  const leadSentence = lead ? ` ${lead} leads the floor.` : "";
  return {
    id,
    kicker,
    title,
    deck: `${money(now.revenue)} this September${now.units ? ` on ${pieces(now.units)}` : ""}. ${lySentence}${leadSentence}`.replace(/\s+/g, " ").trim(),
    figure: kind === "new" ? money(now.revenue) : formatSignedPct(delta),
    tone: toneOf(delta),
    facts: [
      { label: "Net", value: money(now.revenue) },
      { label: "Last year", value: prior.revenue > 0 && kind !== "new" ? money(prior.revenue) : "—" },
      { label: "Vs last year", value: kind === "new" ? "—" : formatSignedPct(delta) },
      { label: "Units", value: pieces(now.units) },
      { label: "Stores", value: String(now.count) },
    ],
  };
}

function buildMoverStories(stores: BriefRank[], lyStores: BriefRank[]): BriefStory[] {
  const ly = new Map(sellingStores(lyStores).map((r) => [rankKey(r.name), r]));
  const scored = sellingStores(stores)
    .filter((r) => !isNewBriefStore(r.name))
    .map((r) => {
      const prior = ly.get(rankKey(r.name));
      if (!prior || !(prior.revenue > 0)) return null;
      const delta = pctDelta(r.revenue, prior.revenue);
      if (delta == null) return null;
      return { row: r, prior, delta, dollars: r.revenue - prior.revenue };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
  const up = [...scored].filter((r) => r.dollars > 0).sort((a, b) => b.dollars - a.dollars).slice(0, 3);
  const down = [...scored].filter((r) => r.dollars < 0).sort((a, b) => a.dollars - b.dollars).slice(0, 3);
  return [
    ...up.map((r) => ({
      id: `store:${r.row.name}`,
      kicker: "Rose this September",
      title: r.row.name,
      deck: `${money(r.row.revenue)} this September${r.row.units != null ? ` on ${pieces(r.row.units)}` : ""}. Last year ${money(r.prior.revenue)} on the same dates.`,
      figure: formatSignedPct(r.delta),
      tone: toneOf(r.delta),
      facts: [
        { label: "Net", value: money(r.row.revenue) },
        { label: "Last year", value: money(r.prior.revenue) },
        { label: "Vs last year", value: formatSignedPct(r.delta) },
        ...(r.row.units != null ? [{ label: "Units", value: pieces(r.row.units) }] : []),
      ],
    })),
    ...down.map((r) => ({
      id: `store:${r.row.name}`,
      kicker: "Slipped this September",
      title: r.row.name,
      deck: `${money(r.row.revenue)} this September${r.row.units != null ? ` on ${pieces(r.row.units)}` : ""}. Last year ${money(r.prior.revenue)} on the same dates.`,
      figure: formatSignedPct(r.delta),
      tone: toneOf(r.delta),
      facts: [
        { label: "Net", value: money(r.row.revenue) },
        { label: "Last year", value: money(r.prior.revenue) },
        { label: "Vs last year", value: formatSignedPct(r.delta) },
        ...(r.row.units != null ? [{ label: "Units", value: pieces(r.row.units) }] : []),
      ],
    })),
  ];
}

function buildStoreStories(stores: BriefRank[], lyStores: BriefRank[]): BriefStory[] {
  const houses: Array<{ id: string; title: string; house: BriefStoreHouse; kind: "house" | "new" }> = [
    { id: "house:AJ", title: "AJ", house: "aj", kind: "house" },
    { id: "house:Shaun", title: "Shaun", house: "shaun", kind: "house" },
    { id: "house:New", title: "New stores", house: "new", kind: "new" },
  ];
  const houseStories = houses.flatMap(({ id, title, house, kind }) => {
    const nowRows = houseRows(stores, house);
    if (sumRanks(nowRows).revenue === 0) return [];
    return [buildHouseStory(id, title, nowRows, houseRows(lyStores, house), kind)];
  });
  return [...houseStories, ...buildMoverStories(stores, lyStores)];
}

export function designLines(designs: BriefRank[], lyDesigns: BriefRank[], limit = 8): BriefLine[] {
  const ly = new Map(namedRanks(lyDesigns).map((r) => [rankKey(r.name), r]));
  return namedRanks(designs)
    .sort((a, b) => b.revenue - a.revenue || (b.units ?? 0) - (a.units ?? 0))
    .slice(0, limit)
    .map((r) => {
      const prior = ly.get(rankKey(r.name));
      const delta = prior ? pctDelta(r.revenue, prior.revenue) : null;
      return {
        id: `design:${r.name}`,
        name: r.name,
        revenue: r.revenue,
        units: r.units ?? 0,
        lyRevenue: prior ? prior.revenue : null,
        lyUnits: prior?.units ?? null,
        delta,
        tone: toneOf(delta),
      };
    });
}

function buildDepartmentStories(rows: BriefRank[], lyRows: BriefRank[]): BriefStory[] {
  const ly = new Map(namedRanks(lyRows).map((r) => [rankKey(r.name), r]));
  const pool = namedRanks(rows).sort((a, b) => b.revenue - a.revenue);
  let worst: BriefRank | null = null;
  let worstDrop = 0;
  for (const row of pool) {
    const prior = ly.get(rankKey(row.name));
    if (!prior) continue;
    const drop = prior.revenue - row.revenue;
    if (drop > worstDrop) {
      worstDrop = drop;
      worst = row;
    }
  }
  const worstName = worst?.name ?? null;
  let ranked = pool.slice(0, SECTION_LIMIT);
  if (worst && worstName && worstDrop > 0 && !ranked.some((r) => rankKey(r.name) === rankKey(worstName))) {
    ranked = [...ranked.slice(0, Math.max(0, SECTION_LIMIT - 1)), worst];
  }
  const bestName = pool[0]?.name ?? null;
  return ranked.map((r) => {
    const prior = ly.get(rankKey(r.name));
    const delta = prior ? pctDelta(r.revenue, prior.revenue) : null;
    const kicker =
      bestName && r.name === bestName
        ? "Best this September"
        : worstName && r.name === worstName && worstDrop > 0
          ? "Furthest behind"
          : delta == null
            ? "This September"
            : delta >= 20
              ? "Ahead of last year"
              : delta <= -20
                ? "Behind last year"
                : "Steady";
    return {
      id: `department:${r.name}`,
      kicker,
      title: r.name,
      deck: `${money(r.revenue)} this September${r.units != null ? ` on ${pieces(r.units)}` : ""}. ${
        prior ? `Last year ${money(prior.revenue)} on the same dates.` : "No sales on these dates last year."
      }`,
      figure: formatSignedPct(delta),
      tone: toneOf(delta),
      facts: [
        { label: "Net", value: money(r.revenue) },
        { label: "Last year", value: prior ? money(prior.revenue) : "—" },
        { label: "Vs last year", value: formatSignedPct(delta) },
        ...(r.units != null ? [{ label: "Units", value: pieces(r.units) }] : []),
      ],
    };
  });
}

function buildDesignStories(rows: BriefRank[], lyRows: BriefRank[]): BriefStory[] {
  return buildRankStories("design", rows, lyRows).map((story) => ({
    ...story,
    deck: story.deck.replace("this window", "this September").replace("Last year", "Last year, same dates,"),
  }));
}

function buildRankStories(prefix: string, rows: BriefRank[], lyRows: BriefRank[]): BriefStory[] {
  const ly = new Map(namedRanks(lyRows).map((r) => [rankKey(r.name), r]));
  return namedRanks(rows)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, SECTION_LIMIT)
    .map((r) => {
      const prior = ly.get(r.name.trim().toUpperCase());
      const delta = prior ? pctDelta(r.revenue, prior.revenue) : null;
      const kicker = delta == null ? "This window" : delta >= 20 ? "Ahead of last year" : delta <= -20 ? "Behind last year" : "Steady";
      return {
        id: `${prefix}:${r.name}`,
        kicker,
        title: r.name,
        deck: `${money(r.revenue)} this window${r.units != null ? `, ${pieces(r.units)}` : ""}. ${
          prior ? `Last year ${money(prior.revenue)}.` : "Not among last year's leaders."
        }`,
        figure: formatSignedPct(delta),
        tone: toneOf(delta),
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
        kicker: delta == null ? "This window" : delta >= 15 ? "Heavier than last year" : delta <= -15 ? "Lighter than last year" : "Steady",
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

function paperHeadline(delta: number | null, leadName: string | null, leadIsDepartment: boolean): string {
  if (leadIsDepartment && leadName) return `${leadName} leads this September.`;
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
  departments?: BriefRank[];
  lyDepartments?: BriefRank[];
  designs?: BriefRank[];
  lyDesigns?: BriefRank[];
  /** Calendar comparison, e.g. Sep 1–21 vs Sep 1–21. Falls back to weekday alignment. */
  compareFrom?: string | null;
  compareTo?: string | null;
}): BriefEdition {
  const ly =
    input.compareFrom && input.compareTo
      ? { from: input.compareFrom, to: input.compareTo }
      : briefPriorYear(input.from, input.to);
  const days = inclusiveDays(input.from, input.to);
  const delta = pctDelta(input.net, input.lyNet);
  const departments = namedRanks(input.departments ?? []).sort((a, b) => b.revenue - a.revenue);
  const designs = namedRanks(input.designs ?? []).sort((a, b) => b.revenue - a.revenue);
  const sections: BriefSection[] = [
    { id: "departments", label: "Departments", stories: buildDepartmentStories(input.departments ?? [], input.lyDepartments ?? []) },
    { id: "designs", label: "Designs", stories: buildDesignStories(input.designs ?? [], input.lyDesigns ?? []) },
    { id: "stores", label: "Stores", stories: buildStoreStories(input.stores, input.lyStores) },
    { id: "models", label: "Models", stories: buildModelStories(input.models, input.lyModels, days, input.showKash) },
    { id: "vendors", label: "Vendors", stories: buildRankStories("vendor", input.vendors, input.lyVendors) },
    { id: "people", label: "People", stories: buildRankStories("person", input.people, input.lyPeople) },
    { id: "pay", label: "Pay", stories: buildPayStories(input.pay, input.lyPay) },
  ];
  const topStore = [...input.stores].filter((r) => !isUnknownBriefName(r.name)).sort((a, b) => b.revenue - a.revenue)[0]?.name ?? null;
  const leadDepartment = departments[0]?.name ?? null;
  const topModel = pickModels(input.models)[0];
  const designBit = designs[0] ? `${designs[0].name} is the strongest design.` : "";
  const modelBit = topModel ? `${modelTitle(topModel)} is the busiest model.` : "";
  const comparedWith = input.compareFrom ? "the same dates last year" : "the same weekdays last year";
  const pace =
    delta == null
      ? `${money(input.net)} net.`
      : `${money(input.net)} net, ${formatSignedPct(delta)} versus ${comparedWith}.`;
  const aside = leadDepartment ? designBit : modelBit;
  return {
    from: input.from,
    to: input.to,
    lyFrom: ly?.from ?? null,
    lyTo: ly?.to ?? null,
    net: input.net,
    lyNet: input.lyNet,
    units: input.units,
    delta,
    headline: paperHeadline(delta, leadDepartment ?? topStore, Boolean(leadDepartment)),
    deck: `${pace} ${aside}`.trim(),
    sections,
  };
}
