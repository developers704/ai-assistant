import { priorYearCompareWindow } from "@/lib/reports/date-utils";
import { canonicalPaycode } from "@/lib/sales/paycode-normalize";
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
  /** Selling stores with positive net. Used for the one-store flag. */
  storeCount?: number;
  leadStore?: string | null;
};

export type BriefDay = {
  date: string;
  net: number;
  units: number;
  returns: number;
};

export type BriefExpertise = {
  department: string;
  design: string;
  person: string;
  revenue: number;
  units: number;
};

export type BriefHotDay = {
  store: string;
  date: string;
  net: number;
  average: number;
};

export type BriefSlice = {
  net: number;
  units: number;
  departments: BriefRank[];
  designs: BriefRank[];
  stores: BriefRank[];
  vendors: BriefRank[];
  people: BriefRank[];
  pay: BriefPay[];
  daily: BriefDay[];
  hotDay: BriefHotDay | null;
};

export type BriefPacket = {
  from: string;
  to: string;
  lyFrom: string;
  lyTo: string;
  showKash: boolean;
  now: BriefSlice;
  ly: BriefSlice;
  models: BriefModel[];
  lyModels: BriefModel[];
  watches: BriefRank[];
  lyWatches: BriefRank[];
  expertise: BriefExpertise[];
  byDepartment: Record<string, { now: BriefSlice; ly: BriefSlice }>;
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
  note?: string | null;
  onHand?: number | null;
  kashCost?: number | null;
  imageUrl?: string | null;
};

export type BriefModelStack = "returning" | "fresh";

export type BriefPayGroup = "cash" | "card" | "financing";

const PAY_CASH = new Set(["CASH", "CHK"]);
const PAY_CARD = new Set(["CC"]);
const PAY_FINANCING = new Set([
  "SYNC",
  "WELLS",
  "IDDEAL",
  "PROG",
  "ACIMA",
  "AFFIRM",
  "FLEX",
  "KAFE",
  "KAFENE",
  "BREAD",
  "GAFCO",
  "SNAP",
  "UOWN",
]);

export type BriefSection = {
  id: "departments" | "designs" | "models" | "stores" | "watches" | "cost" | "vendors" | "people" | "pay" | "notes";
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
  const n = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!n || n === "—" || n === "-" || n === "–" || n === "n/a" || n === "na" || n === "none") return true;
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

export function isJewelryModel(model: BriefModel): boolean {
  const vm = (model.vendorModel || model.name || "").trim().toUpperCase();
  const name = `${model.name || ""} ${model.department || ""}`.toUpperCase();
  if (!vm || vm === "—" || vm === "ITEM" || vm === "BATTERY") return false;
  if (vm.startsWith("MLB-") || vm.startsWith("JVV-")) return false;
  if (/RECYCLING FEE|CARE PLAN|GIFT BOX|\bBATTERY\b/.test(name)) return false;
  const avg = model.units > 0 ? model.revenue / model.units : model.revenue;
  if (model.units > 0 && avg < 40) return false;
  return model.revenue !== 0 || model.units !== 0;
}

function jewelryModels(models: BriefModel[]): BriefModel[] {
  return models.filter((model) => {
    if (!isJewelryModel(model)) return false;
    const title = modelTitle(model);
    return !isUnknownBriefName(title) && !isUnknownBriefName(model.vendorModel);
  });
}

function modelsInStack(models: BriefModel[], lyModels: BriefModel[], stack: BriefModelStack): BriefModel[] {
  const ly = new Map(jewelryModels(lyModels).map((model) => [modelKey(model), model]));
  return jewelryModels(models).filter((model) => {
    const prior = ly.get(modelKey(model));
    const returning = prior != null && prior.revenue > 0;
    return stack === "returning" ? returning : !returning;
  });
}

export function modelLines(
  models: BriefModel[],
  lyModels: BriefModel[],
  stack: BriefModelStack,
  opts?: { limit?: number; showKash?: boolean }
): BriefLine[] {
  const limit = opts?.limit ?? 8;
  const ly = new Map(jewelryModels(lyModels).map((model) => [modelKey(model), model]));
  return modelsInStack(models, lyModels, stack)
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, limit)
    .map((model) => {
      const title = modelTitle(model);
      const prior = ly.get(modelKey(model));
      const delta = stack === "returning" && prior && prior.revenue > 0 ? pctDelta(model.revenue, prior.revenue) : null;
      const onHand = model.onHandTotal == null ? null : model.onHandTotal;
      const kash = opts?.showKash ? kashLine(model.revenue, model.units, model.kashCost) : null;
      const hand = onHand == null ? null : kickerForModel({ units: model.units, onHand, delta });
      const note = [hand === "Running thin" ? hand : null, kash].filter(Boolean).join(" ");
      return {
        id: `model:${title}`,
        name: title,
        revenue: model.revenue,
        units: model.units,
        lyRevenue: prior && prior.revenue > 0 ? prior.revenue : null,
        lyUnits: prior && prior.revenue > 0 ? prior.units : null,
        delta,
        tone: toneOf(delta),
        note: note || null,
        onHand,
        kashCost: opts?.showKash && model.kashCost != null && model.kashCost > 0 ? model.kashCost : null,
        imageUrl: model.imageUrl,
      };
    });
}

function buildModelStackStories(models: BriefModel[], lyModels: BriefModel[], showKash: boolean): BriefStory[] {
  const ly = new Map(jewelryModels(lyModels).map((model) => [modelKey(model), model]));
  const stacks: Array<{ id: string; title: string; stack: BriefModelStack }> = [
    { id: "model:returning", title: "Still here", stack: "returning" },
    { id: "model:fresh", title: "This year", stack: "fresh" },
  ];
  return stacks.flatMap(({ id, title, stack }) => {
    const rows = modelsInStack(models, lyModels, stack);
    if (rows.length === 0) return [];
    const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const units = rows.reduce((sum, row) => sum + row.units, 0);
    const lyRevenue = rows.reduce((sum, row) => sum + (ly.get(modelKey(row))?.revenue ?? 0), 0);
    const delta = stack === "returning" && lyRevenue > 0 ? pctDelta(revenue, lyRevenue) : null;
    const lead = [...rows].sort((a, b) => b.revenue - a.revenue)[0];
    const leadName = lead ? modelTitle(lead) : null;
    const kicker =
      stack === "fresh"
        ? "This September"
        : delta == null
          ? "This September"
          : delta >= 8
            ? "Ahead of last year"
            : delta <= -8
              ? "Behind last year"
              : "Steady";
    const lySentence =
      stack === "fresh" || lyRevenue <= 0
        ? "No sales on these dates last year."
        : `Last year ${money(lyRevenue)} on the same dates.`;
    const leadSentence = leadName ? ` ${leadName} leads the stack.` : "";
    return [
      {
        id,
        kicker,
        title,
        deck: `${money(revenue)} this September on ${pieces(units)}. ${lySentence}${leadSentence}`.replace(/\s+/g, " ").trim(),
        figure: stack === "fresh" ? money(revenue) : formatSignedPct(delta),
        tone: toneOf(delta),
        imageUrl: lead?.imageUrl,
        facts: [
          { label: "Net", value: money(revenue) },
          { label: "Last year", value: stack === "returning" && lyRevenue > 0 ? money(lyRevenue) : "—" },
          { label: "Vs last year", value: stack === "fresh" ? "—" : formatSignedPct(delta) },
          { label: "Units", value: pieces(units) },
          { label: "Models", value: String(rows.length) },
          ...(showKash && lead?.kashCost != null && lead.kashCost > 0
            ? [{ label: "Kash CP", value: money(lead.kashCost) }]
            : []),
        ],
      },
    ];
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

export function briefPayGroup(name: string | null | undefined): BriefPayGroup | null {
  const canon = canonicalPaycode(name);
  if (!canon || isUnknownBriefName(canon)) return null;
  if (PAY_CASH.has(canon)) return "cash";
  if (PAY_CARD.has(canon)) return "card";
  if (PAY_FINANCING.has(canon)) return "financing";
  return null;
}

function foldedPay(rows: BriefPay[]): Map<string, { name: string; revenue: number; group: BriefPayGroup }> {
  const map = new Map<string, { name: string; revenue: number; group: BriefPayGroup }>();
  for (const row of rows) {
    const name = canonicalPaycode(row.name);
    const group = briefPayGroup(name);
    if (!name || !group || row.revenue === 0) continue;
    const prev = map.get(name);
    map.set(name, { name, revenue: (prev?.revenue ?? 0) + row.revenue, group });
  }
  return map;
}

function groupTotal(rows: Map<string, { revenue: number; group: BriefPayGroup }>, group: BriefPayGroup): number {
  let total = 0;
  for (const row of rows.values()) {
    if (row.group === group) total += row.revenue;
  }
  return total;
}

export function payLines(rows: BriefPay[], lyRows: BriefPay[], group: BriefPayGroup): BriefLine[] {
  const now = foldedPay(rows);
  const ly = foldedPay(lyRows);
  const window = [...now.values()].reduce((sum, row) => sum + row.revenue, 0);
  return [...now.values()]
    .filter((row) => row.group === group)
    .sort((a, b) => b.revenue - a.revenue)
    .map((row) => {
      const prior = ly.get(row.name);
      const delta = prior && prior.revenue !== 0 ? pctDelta(row.revenue, prior.revenue) : null;
      return {
        id: `pay:${row.name}`,
        name: row.name,
        revenue: row.revenue,
        units: 0,
        lyRevenue: prior ? prior.revenue : null,
        lyUnits: null,
        delta,
        tone: toneOf(delta),
        note: window > 0 ? `${Math.round((row.revenue / window) * 100)}% of applied payments` : null,
      };
    });
}

function buildPayStories(rows: BriefPay[], lyRows: BriefPay[]): BriefStory[] {
  const now = foldedPay(rows);
  const ly = foldedPay(lyRows);
  const nowTotal = [...now.values()].reduce((sum, row) => sum + row.revenue, 0);
  const lyTotal = [...ly.values()].reduce((sum, row) => sum + row.revenue, 0);
  const groups: Array<{ id: BriefPayGroup; title: string }> = [
    { id: "card", title: "Card" },
    { id: "financing", title: "Financing" },
    { id: "cash", title: "Cash" },
  ];
  const scored = groups
    .map((group) => {
      const revenue = groupTotal(now, group.id);
      const lyRevenue = groupTotal(ly, group.id);
      const share = nowTotal > 0 ? (revenue / nowTotal) * 100 : 0;
      const lyShare = lyTotal > 0 ? (lyRevenue / lyTotal) * 100 : null;
      return { ...group, revenue, lyRevenue, share, lyShare, shareDelta: lyShare == null ? null : share - lyShare };
    })
    .filter((group) => group.revenue !== 0)
    .sort((a, b) => b.revenue - a.revenue);
  const heavier = scored
    .filter((group) => group.shareDelta != null && group.shareDelta >= 3)
    .sort((a, b) => (b.shareDelta ?? 0) - (a.shareDelta ?? 0))[0];
  return scored.map((group) => {
    const delta = group.lyRevenue !== 0 ? pctDelta(group.revenue, group.lyRevenue) : null;
    const shareLabel = `${Math.round(group.share)}%`;
    const kicker =
      heavier && heavier.id === group.id
        ? "Heavier than last year"
        : group.lyShare == null
          ? "This September"
          : group.shareDelta != null && group.shareDelta <= -3
            ? "Lighter than last year"
            : "Steady";
    const lySentence =
      group.lyShare == null
        ? "No applied payments on these dates last year."
        : `Last year ${money(group.lyRevenue)}, ${Math.round(group.lyShare)}% of that September.`;
    const mix =
      heavier && heavier.id === group.id && group.lyShare != null
        ? ` Its share rose from ${Math.round(group.lyShare)}% to ${shareLabel}.`
        : group.lyShare == null && scored[0]?.id === group.id
          ? ` ${group.title} is ${shareLabel} of applied payments.`
          : "";
    return {
      id: `pay:${group.title}`,
      kicker,
      title: group.title,
      deck: `${money(group.revenue)} applied, ${shareLabel} of this September. ${lySentence}${mix}`.replace(/\s+/g, " ").trim(),
      figure: shareLabel,
      tone: toneOf(group.shareDelta),
      facts: [
        { label: "Applied", value: money(group.revenue) },
        { label: "Share", value: shareLabel },
        { label: "Last year", value: group.lyRevenue !== 0 ? money(group.lyRevenue) : "—" },
        { label: "Vs last year", value: delta == null ? "—" : formatSignedPct(delta) },
      ],
    };
  });
}

export function isBriefSellingStore(name: string): boolean {
  const key = rankKey(name);
  if (!key || isUnknownBriefName(name)) return false;
  return !SKIP_STORES.has(key);
}

function monthEndIso(to: string): string {
  const [y, m] = to.split("-").map(Number);
  if (!y || !m) return to;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${to.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

function editionDaySpan(from: string, to: string): string {
  const a = new Date(`${from}T12:00:00Z`);
  const b = new Date(`${to}T12:00:00Z`);
  const month = a.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${month} ${a.getUTCDate()}–${b.getUTCDate()}`;
  }
  const left = a.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  const right = b.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  return `${left}–${right}`;
}

/** Daily pace of the issue, applied to the rest of that month. Not a forecast. */
export function briefMonthPace(opts: {
  from: string;
  to: string;
  net: number;
  monthEnd?: string;
  daily?: { date: string; net: number }[];
}): {
  dayCount: number;
  dailyPace: number;
  restDays: number;
  rest: number;
  month: number;
  last7PerDay: number;
  earlierPerDay: number;
  slowed: boolean;
  restFrom: string;
  monthEnd: string;
} {
  const dayCount = inclusiveDays(opts.from, opts.to);
  const dailyPace = dayCount > 0 ? opts.net / dayCount : 0;
  const monthEnd = opts.monthEnd && opts.monthEnd >= opts.to ? opts.monthEnd : monthEndIso(opts.to);
  const restFrom = shiftIsoDays(opts.to, 1);
  const restDays = restFrom <= monthEnd ? inclusiveDays(restFrom, monthEnd) : 0;
  const lastStart = shiftIsoDays(opts.to, -6);
  const earlierEnd = shiftIsoDays(opts.to, -7);
  let last7 = 0;
  let earlier = 0;
  for (const day of opts.daily ?? []) {
    if (day.date >= lastStart && day.date <= opts.to) last7 += day.net;
    else if (day.date >= opts.from && day.date <= earlierEnd) earlier += day.net;
  }
  const lastDays = lastStart <= opts.to ? inclusiveDays(lastStart < opts.from ? opts.from : lastStart, opts.to) : 0;
  const earlierDays = opts.from <= earlierEnd ? inclusiveDays(opts.from, earlierEnd) : 0;
  const last7PerDay = lastDays > 0 ? last7 / lastDays : 0;
  const earlierPerDay = earlierDays > 0 ? earlier / earlierDays : 0;
  const slowed = earlierPerDay > 0 && last7PerDay < earlierPerDay * 0.9;
  return {
    dayCount,
    dailyPace,
    restDays,
    rest: dailyPace * restDays,
    month: opts.net + dailyPace * restDays,
    last7PerDay,
    earlierPerDay,
    slowed,
    restFrom,
    monthEnd,
  };
}

/** A store-day at least 2.5× that store's own pace, and at least $8,000. */
export function briefHotStoreDay(
  rows: { store: string; date: string; net: number }[]
): BriefHotDay | null {
  const byStore = new Map<string, { store: string; days: { date: string; net: number }[] }>();
  for (const row of rows) {
    if (!isBriefSellingStore(row.store) || row.net === 0) continue;
    const key = rankKey(row.store);
    const cur = byStore.get(key) ?? { store: row.store, days: [] };
    cur.days.push({ date: row.date, net: row.net });
    byStore.set(key, cur);
  }
  let best: BriefHotDay | null = null;
  let bestRatio = 0;
  for (const group of byStore.values()) {
    if (group.days.length < 3) continue;
    const average = group.days.reduce((sum, day) => sum + day.net, 0) / group.days.length;
    if (!(average > 0)) continue;
    for (const day of group.days) {
      const ratio = day.net / average;
      if (ratio < 2.5 || day.net < 8000) continue;
      if (ratio > bestRatio || (ratio === bestRatio && best && day.net > best.net)) {
        bestRatio = ratio;
        best = { store: group.store, date: day.date, net: day.net, average };
      }
    }
  }
  return best;
}

export function briefReturnSpike(
  daily: { date: string; returns: number }[]
): { date: string; returns: number; average: number } | null {
  const active = daily.filter((day) => day.returns > 0);
  if (active.length < 3) return null;
  const average = active.reduce((sum, day) => sum + day.returns, 0) / active.length;
  if (!(average > 0)) return null;
  let best: { date: string; returns: number; average: number } | null = null;
  for (const day of active) {
    if (day.returns < average * 2.5 || day.returns < 4000) continue;
    if (!best || day.returns > best.returns) best = { date: day.date, returns: day.returns, average };
  }
  return best;
}

export function briefSingleStoreModel(models: BriefModel[]): BriefModel | null {
  let best: BriefModel | null = null;
  for (const model of jewelryModels(models)) {
    if (model.storeCount !== 1 || !model.leadStore || model.units < 2 || model.revenue < 8000) continue;
    if (!best || model.revenue > best.revenue) best = model;
  }
  return best;
}

function payShareJump(
  pay: BriefPay[],
  lyPay: BriefPay[]
): { name: string; share: number; lyShare: number } | null {
  const now = foldedPay(pay);
  const ly = foldedPay(lyPay);
  const nowTotal = [...now.values()].reduce((sum, row) => sum + row.revenue, 0);
  const lyTotal = [...ly.values()].reduce((sum, row) => sum + row.revenue, 0);
  if (!(nowTotal > 0) || !(lyTotal > 0)) return null;
  let best: { name: string; share: number; lyShare: number } | null = null;
  let bestMove = 0;
  const names = new Set([...now.keys(), ...ly.keys()]);
  for (const name of names) {
    const share = ((now.get(name)?.revenue ?? 0) / nowTotal) * 100;
    const lyShare = ((ly.get(name)?.revenue ?? 0) / lyTotal) * 100;
    const move = Math.abs(share - lyShare);
    if (move < 8) continue;
    const rose = !best || share - lyShare > best.share - best.lyShare;
    if (move > bestMove || (move === bestMove && rose)) {
      bestMove = move;
      best = { name, share, lyShare };
    }
  }
  return best;
}

function departmentFlip(
  rows: BriefRank[],
  lyRows: BriefRank[]
): { name: string; fromRank: number; toRank: number } | null {
  const now = namedRanks(rows).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const ly = namedRanks(lyRows).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const lyRank = new Map(ly.map((row, index) => [rankKey(row.name), index + 1]));
  let best: { name: string; fromRank: number; toRank: number } | null = null;
  let bestMove = 0;
  now.forEach((row, index) => {
    const fromRank = lyRank.get(rankKey(row.name));
    if (!fromRank) return;
    const toRank = index + 1;
    const move = Math.abs(fromRank - toRank);
    if (move < 3) return;
    if (move > bestMove) {
      bestMove = move;
      best = { name: row.name, fromRank, toRank };
    }
  });
  return best;
}

function furthestBehind(rows: BriefRank[], lyRows: BriefRank[]): { name: string; drop: number; revenue: number; ly: number } | null {
  const ly = new Map(namedRanks(lyRows).map((row) => [rankKey(row.name), row]));
  let best: { name: string; drop: number; revenue: number; ly: number } | null = null;
  for (const row of namedRanks(rows)) {
    const prior = ly.get(rankKey(row.name));
    if (!prior || !(prior.revenue > 0)) continue;
    const drop = prior.revenue - row.revenue;
    if (drop <= 0) continue;
    if (!best || drop > best.drop) best = { name: row.name, drop, revenue: row.revenue, ly: prior.revenue };
  }
  return best;
}

function furthestStoreSlip(stores: BriefRank[], lyStores: BriefRank[]): { name: string; drop: number; revenue: number; ly: number } | null {
  const ly = new Map(sellingStores(lyStores).map((row) => [rankKey(row.name), row]));
  let best: { name: string; drop: number; revenue: number; ly: number } | null = null;
  for (const row of sellingStores(stores)) {
    if (isNewBriefStore(row.name)) continue;
    const prior = ly.get(rankKey(row.name));
    if (!prior || !(prior.revenue > 0)) continue;
    const drop = prior.revenue - row.revenue;
    if (drop <= 0) continue;
    if (!best || drop > best.drop) best = { name: row.name, drop, revenue: row.revenue, ly: prior.revenue };
  }
  return best;
}

export type CostPile = "under" | "near";

export function costPileModels(models: BriefModel[], pile: CostPile): BriefModel[] {
  return jewelryModels(models)
    .filter((model) => {
      if (!(model.units > 0) || model.kashCost == null || !(model.kashCost > 0)) return false;
      const avg = model.revenue / model.units;
      if (pile === "under") return avg < model.kashCost;
      return avg >= model.kashCost && avg <= model.kashCost * 1.1;
    })
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

export function costLines(models: BriefModel[], pile: CostPile, limit = 8): BriefLine[] {
  return costPileModels(models, pile)
    .slice(0, limit)
    .map((model) => {
      const title = modelTitle(model);
      const avg = model.units > 0 ? model.revenue / model.units : model.revenue;
      const kash = model.kashCost ?? 0;
      return {
        id: `cost:${pile}:${title}`,
        name: title,
        revenue: model.revenue,
        units: model.units,
        lyRevenue: null,
        lyUnits: null,
        delta: null,
        tone: pile === "under" ? "down" : "ink",
        note:
          pile === "under"
            ? `Average ${money(avg)} sits under Kash cost ${money(kash)}.`
            : `Average ${money(avg)} is near Kash cost ${money(kash)}.`,
        kashCost: kash,
        imageUrl: model.imageUrl,
      };
    });
}

function buildCostStories(models: BriefModel[], showKash: boolean): BriefStory[] {
  if (!showKash) return [];
  const piles: Array<{ id: CostPile; title: string }> = [
    { id: "under", title: "Under Kash cost" },
    { id: "near", title: "Near Kash cost" },
  ];
  return piles
    .map((pile) => {
      const rows = costPileModels(models, pile.id);
      const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
      const units = rows.reduce((sum, row) => sum + row.units, 0);
      const lead = rows[0];
      return { ...pile, rows, revenue, units, lead };
    })
    .filter((pile) => pile.revenue > 0 && pile.lead)
    .sort((a, b) => b.revenue - a.revenue)
    .map((pile) => {
      const lead = pile.lead!;
      const avg = lead.units > 0 ? lead.revenue / lead.units : lead.revenue;
      return {
        id: `cost:${pile.id}`,
        kicker: pile.id === "under" ? "Below cost" : "Within 10%",
        title: pile.title,
        deck: `${pieces(pile.units)} across ${pile.rows.length} models, ${money(pile.revenue)} net. ${modelTitle(lead)} is the largest, average ${money(avg)} against Kash cost ${money(lead.kashCost ?? 0)}.`,
        figure: money(pile.revenue),
        tone: pile.id === "under" ? "down" : "ink",
        imageUrl: lead.imageUrl,
        facts: [
          { label: "Net", value: money(pile.revenue) },
          { label: "Models", value: String(pile.rows.length) },
          { label: "Units", value: pieces(pile.units) },
          { label: "Kash CP", value: money(lead.kashCost ?? 0) },
        ],
      } satisfies BriefStory;
    });
}

export function watchLines(stores: BriefRank[], lyStores: BriefRank[], limit = 12): BriefLine[] {
  const ly = new Map(sellingStores(lyStores).map((row) => [rankKey(row.name), row]));
  return sellingStores(stores)
    .sort((a, b) => b.revenue - a.revenue || (b.units ?? 0) - (a.units ?? 0))
    .slice(0, limit)
    .map((row) => {
      const prior = ly.get(rankKey(row.name));
      const delta = comparableDelta(row.revenue, prior, row.name);
      return {
        id: `watch:${row.name}`,
        name: row.name,
        revenue: row.revenue,
        units: row.units ?? 0,
        lyRevenue: prior && !isNewBriefStore(row.name) ? prior.revenue : null,
        lyUnits: prior && !isNewBriefStore(row.name) ? prior.units ?? null : null,
        delta,
        tone: toneOf(delta),
      };
    });
}

function buildWatchStories(stores: BriefRank[], lyStores: BriefRank[]): BriefStory[] {
  const nowRows = sellingStores(stores);
  const lyRows = sellingStores(lyStores);
  if (sumRanks(nowRows).revenue === 0) return [];
  const total = buildHouseStory("watch:all", "Watches", nowRows, lyRows, "house");
  const top = watchLines(stores, lyStores, 3).map((line) => ({
    id: `watch:${line.name}`,
    kicker: line.delta != null && line.delta >= 8 ? "Rose this September" : line.delta != null && line.delta <= -8 ? "Slipped this September" : "This September",
    title: line.name,
    deck: `${money(line.revenue)} in watches this September${line.units ? ` on ${pieces(line.units)}` : ""}. ${
      line.lyRevenue != null ? `Last year ${money(line.lyRevenue)} on the same dates.` : "No watch sales on these dates last year."
    }`,
    figure: line.delta == null ? money(line.revenue) : formatSignedPct(line.delta),
    tone: line.tone,
    facts: [
      { label: "Net", value: money(line.revenue) },
      { label: "Last year", value: line.lyRevenue != null ? money(line.lyRevenue) : "—" },
      { label: "Vs last year", value: line.delta == null ? "—" : formatSignedPct(line.delta) },
      { label: "Units", value: pieces(line.units) },
    ],
  }));
  return [{ ...total, id: "watch:all", kicker: "By store" }, ...top];
}

export function expertiseLeaders(
  rows: BriefExpertise[],
  opts?: { department?: string | null; limit?: number }
): BriefStory[] {
  const limit = opts?.limit ?? 6;
  const department = opts?.department?.trim().toUpperCase() || "";
  const byDesign = new Map<string, { design: string; total: number; people: Map<string, { person: string; revenue: number; units: number }> }>();
  for (const row of rows) {
    if (isUnknownBriefName(row.design) || isUnknownBriefName(row.person) || !(row.revenue > 0)) continue;
    if (department && row.department.trim().toUpperCase() !== department) continue;
    const key = rankKey(row.design);
    const group = byDesign.get(key) ?? { design: row.design.trim(), total: 0, people: new Map() };
    group.total += row.revenue;
    const person = group.people.get(row.person) ?? { person: row.person, revenue: 0, units: 0 };
    person.revenue += row.revenue;
    person.units += row.units;
    group.people.set(row.person, person);
    byDesign.set(key, group);
  }
  return [...byDesign.values()]
    .map((group) => {
      const lead = [...group.people.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units)[0]!;
      const share = group.total > 0 ? (lead.revenue / group.total) * 100 : 0;
      return { ...group, lead, share };
    })
    .filter((group) => group.share >= 25 && group.total >= 500 && group.lead.revenue >= 200)
    .sort((a, b) => b.share - a.share || b.lead.revenue - a.lead.revenue)
    .slice(0, limit)
    .map((group) => {
      const share = `${Math.round(group.share)}%`;
      return {
        id: `person:${group.design}:${group.lead.person}`,
        kicker: `Strong in ${group.design}`,
        title: group.lead.person,
        deck: `${group.lead.person} wrote ${money(group.lead.revenue)} of ${group.design}, ${share} of that design.`,
        figure: share,
        tone: "ink" as const,
        facts: [
          { label: "Net", value: money(group.lead.revenue) },
          { label: "Share", value: share },
          { label: "Design", value: group.design },
          { label: "Units", value: pieces(group.lead.units) },
        ],
      };
    });
}

function buildNotesStories(input: {
  from: string;
  to: string;
  net: number;
  daily?: BriefDay[] | null;
  hotDay?: BriefHotDay | null;
  departments?: BriefRank[];
  lyDepartments?: BriefRank[];
  stores: BriefRank[];
  lyStores: BriefRank[];
  models: BriefModel[];
  pay: BriefPay[];
  lyPay: BriefPay[];
  showKash: boolean;
}): BriefStory[] {
  if (!input.daily) return [];
  const pace = briefMonthPace({ from: input.from, to: input.to, net: input.net, daily: input.daily });
  const windowLabel = editionDaySpan(input.from, input.to);
  const restLabel = pace.restDays > 0 ? editionDaySpan(pace.restFrom, pace.monthEnd) : "the rest of the month";
  const slowSentence = pace.slowed
    ? ` The last seven days slowed to ${money(pace.last7PerDay)} a day, from ${money(pace.earlierPerDay)} before that.`
    : "";
  const stories: BriefStory[] = [
    {
      id: "note:pace",
      kicker: "Pace",
      title: restLabel,
      deck: `${windowLabel} averaged ${money(pace.dailyPace)} a day. At that pace, ${restLabel} adds ${money(pace.rest)}. The month would land near ${money(pace.month)}. This is pace, not a forecast.${slowSentence}`,
      figure: money(pace.rest),
      tone: pace.slowed ? "down" : "ink",
      facts: [
        { label: "A day", value: money(pace.dailyPace) },
        { label: "Rest of month", value: money(pace.rest) },
        { label: "Month at pace", value: money(pace.month) },
        { label: "Last seven", value: pace.slowed ? "Slower" : "Holding" },
      ],
    },
  ];

  const hot = input.hotDay;
  if (hot) {
    stories.push({
      id: "flag:store-day",
      kicker: "Unusual",
      title: hot.store,
      deck: `${hot.store} took ${money(hot.net)} on ${hot.date}, against its own ${money(hot.average)} a day this September.`,
      figure: money(hot.net),
      tone: "up",
      facts: [
        { label: "That day", value: money(hot.net) },
        { label: "Its pace", value: money(hot.average) },
        { label: "Date", value: hot.date },
      ],
    });
  }
  const returns = briefReturnSpike(input.daily);
  if (returns) {
    stories.push({
      id: "flag:returns",
      kicker: "Unusual",
      title: "Returns",
      deck: `Returns reached ${money(returns.returns)} on ${returns.date}, against ${money(returns.average)} on a typical day with returns.`,
      figure: money(returns.returns),
      tone: "down",
      facts: [
        { label: "That day", value: money(returns.returns) },
        { label: "Typical", value: money(returns.average) },
        { label: "Date", value: returns.date },
      ],
    });
  }
  const single = briefSingleStoreModel(input.models);
  if (single) {
    stories.push({
      id: "flag:model",
      kicker: "Unusual",
      title: modelTitle(single),
      deck: `${modelTitle(single)} sold in ${single.leadStore} only, ${money(single.revenue)} on ${pieces(single.units)}.`,
      figure: money(single.revenue),
      tone: "ink",
      facts: [
        { label: "Net", value: money(single.revenue) },
        { label: "Store", value: single.leadStore ?? "—" },
        { label: "Units", value: pieces(single.units) },
      ],
    });
  }
  const jump = payShareJump(input.pay, input.lyPay);
  if (jump) {
    stories.push({
      id: "flag:pay",
      kicker: "Unusual",
      title: jump.name,
      deck: `${jump.name} moved from ${Math.round(jump.lyShare)}% to ${Math.round(jump.share)}% of applied payments.`,
      figure: `${Math.round(jump.share - jump.lyShare)} pts`,
      tone: toneOf(jump.share - jump.lyShare),
      facts: [
        { label: "Share", value: `${Math.round(jump.share)}%` },
        { label: "Last year", value: `${Math.round(jump.lyShare)}%` },
      ],
    });
  }
  const flip = departmentFlip(input.departments ?? [], input.lyDepartments ?? []);
  if (flip) {
    stories.push({
      id: "flag:department",
      kicker: "Unusual",
      title: flip.name,
      deck: `${flip.name} moved from #${flip.fromRank} to #${flip.toRank} among departments.`,
      figure: `#${flip.toRank}`,
      tone: flip.toRank < flip.fromRank ? "up" : "down",
      facts: [
        { label: "Last year", value: `#${flip.fromRank}` },
        { label: "This year", value: `#${flip.toRank}` },
      ],
    });
  }

  const behind = furthestBehind(input.departments ?? [], input.lyDepartments ?? []);
  const slip = furthestStoreSlip(input.stores, input.lyStores);
  const under = input.showKash ? costPileModels(input.models, "under") : [];
  const underRevenue = under.reduce((sum, row) => sum + row.revenue, 0);
  const recs: BriefStory[] = [];
  if (input.showKash && underRevenue >= 1000 && (!behind || underRevenue > behind.drop)) {
    recs.push({
      id: "rec:cost",
      kicker: "Recommendation",
      title: "Under Kash cost",
      deck: `Look at pieces selling under Kash cost. ${under.length} models, ${money(underRevenue)} net.`,
      figure: money(underRevenue),
      tone: "down",
      facts: [
        { label: "Net", value: money(underRevenue) },
        { label: "Models", value: String(under.length) },
      ],
    });
  } else if (behind) {
    recs.push({
      id: "rec:department",
      kicker: "Recommendation",
      title: behind.name,
      deck: `Put time on ${behind.name}. It is ${money(behind.drop)} behind the same dates last year.`,
      figure: money(behind.drop),
      tone: "down",
      facts: [
        { label: "This year", value: money(behind.revenue) },
        { label: "Last year", value: money(behind.ly) },
        { label: "Behind", value: money(behind.drop) },
      ],
    });
  } else {
    recs.push({
      id: "rec:department",
      kicker: "Recommendation",
      title: "Departments",
      deck: "No department is materially behind the same dates last year.",
      figure: "Level",
      tone: "ink",
      facts: [{ label: "Vs last year", value: "Level" }],
    });
  }
  if (slip) {
    recs.push({
      id: "rec:store",
      kicker: "Recommendation",
      title: slip.name,
      deck: `Walk ${slip.name}. ${money(slip.revenue)} this September, ${money(slip.ly)} on the same dates last year.`,
      figure: money(slip.drop),
      tone: "down",
      facts: [
        { label: "This year", value: money(slip.revenue) },
        { label: "Last year", value: money(slip.ly) },
        { label: "Behind", value: money(slip.drop) },
      ],
    });
  } else {
    recs.push({
      id: "rec:store",
      kicker: "Recommendation",
      title: "Stores",
      deck: "No comparable store is materially behind the same dates last year.",
      figure: "Level",
      tone: "ink",
      facts: [{ label: "Vs last year", value: "Level" }],
    });
  }
  if (pace.slowed) {
    const catchup = pace.earlierPerDay * pace.restDays;
    recs.push({
      id: "rec:pace",
      kicker: "Recommendation",
      title: "Last seven days",
      deck: `The close slowed. The earlier pace was ${money(pace.earlierPerDay)} a day; the last seven were ${money(pace.last7PerDay)}. Catching the earlier pace for the remaining ${pace.restDays} days is about ${money(catchup)}. This is pace, not a forecast.`,
      figure: money(catchup),
      tone: "down",
      facts: [
        { label: "Earlier", value: money(pace.earlierPerDay) },
        { label: "Last seven", value: money(pace.last7PerDay) },
        { label: "Catch-up", value: money(catchup) },
      ],
    });
  } else {
    recs.push({
      id: "rec:pace",
      kicker: "Recommendation",
      title: "Hold this pace",
      deck: `${windowLabel} is ${money(pace.dailyPace)} a day. The remaining ${pace.restDays} days add about ${money(pace.rest)} if that pace holds. This is pace, not a forecast.`,
      figure: money(pace.rest),
      tone: "ink",
      facts: [
        { label: "A day", value: money(pace.dailyPace) },
        { label: "Remaining", value: money(pace.rest) },
      ],
    });
  }
  return [...stories, ...recs.slice(0, 3)];
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
  /** When set, the headline names this department and people stay inside it. */
  scopeLabel?: string | null;
  watches?: BriefRank[];
  lyWatches?: BriefRank[];
  expertise?: BriefExpertise[];
  /** Pass an array (even empty) to include pace, flags, and recommendations. */
  daily?: BriefDay[] | null;
  hotDay?: BriefHotDay | null;
}): BriefEdition {
  const ly =
    input.compareFrom && input.compareTo
      ? { from: input.compareFrom, to: input.compareTo }
      : briefPriorYear(input.from, input.to);
  const delta = pctDelta(input.net, input.lyNet);
  const departments = namedRanks(input.departments ?? []).sort((a, b) => b.revenue - a.revenue);
  const designs = namedRanks(input.designs ?? []).sort((a, b) => b.revenue - a.revenue);
  const peopleFromDesign = expertiseLeaders(input.expertise ?? [], { department: input.scopeLabel });
  const watchStories = input.watches ? buildWatchStories(input.watches, input.lyWatches ?? []) : [];
  const costStories = buildCostStories(input.models, input.showKash);
  const noteStories = buildNotesStories(input);
  const sections: BriefSection[] = [
    { id: "departments", label: "Departments", stories: buildDepartmentStories(input.departments ?? [], input.lyDepartments ?? []) },
    { id: "designs", label: "Designs", stories: buildDesignStories(input.designs ?? [], input.lyDesigns ?? []) },
    { id: "stores", label: "Stores", stories: buildStoreStories(input.stores, input.lyStores) },
    ...(watchStories.length ? [{ id: "watches" as const, label: "Watches", stories: watchStories }] : []),
    { id: "models", label: "Models", stories: buildModelStackStories(input.models, input.lyModels, input.showKash) },
    ...(costStories.length ? [{ id: "cost" as const, label: "Cost", stories: costStories }] : []),
    { id: "vendors", label: "Vendors", stories: buildRankStories("vendor", input.vendors, input.lyVendors) },
    {
      id: "people",
      label: "People",
      stories: peopleFromDesign.length ? peopleFromDesign : buildRankStories("person", input.people, input.lyPeople),
    },
    { id: "pay", label: "Pay", stories: buildPayStories(input.pay, input.lyPay) },
    ...(noteStories.length ? [{ id: "notes" as const, label: "Notes", stories: noteStories }] : []),
  ];
  const topStore = [...input.stores].filter((r) => !isUnknownBriefName(r.name)).sort((a, b) => b.revenue - a.revenue)[0]?.name ?? null;
  const leadDepartment = departments[0]?.name ?? null;
  const topModel = [...jewelryModels(input.models)].sort((a, b) => b.revenue - a.revenue)[0];
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
    headline: input.scopeLabel
      ? designs[0]
        ? `${designs[0].name} leads ${input.scopeLabel}.`
        : `${input.scopeLabel} this September.`
      : paperHeadline(delta, leadDepartment ?? topStore, Boolean(leadDepartment)),
    deck: `${pace} ${aside}`.trim(),
    sections,
  };
}
