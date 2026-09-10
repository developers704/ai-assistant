/**
 * Rebuild August 1–31 2026 sales lines from the POS split-salesperson export.
 *
 * The POS file is already exploded (one row per associate; Total = that
 * person's dollars). Live seed August is the same shape. We replace August
 * with POS amounts / designs / salesperson credit, and copy Transaction #,
 * SKU, image, pay codes, and description from matching live rows when we can.
 *
 * Salespersons is rewritten to `{Sales Person}/100%` so dashboard + HR credit
 * equals the POS Sales Person column (amendments included).
 *
 * Usage:
 *   npx tsx scripts/apply-aug-salesperson-amend.ts [pos.csv]
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { normalizeDailySalesCsv } from "../src/lib/reports/normalize-daily-sales-csv";
import { parseReportFilterDate } from "../src/lib/reports/date-utils";

const SEED_PATH = path.join(process.cwd(), "data/reports/Sales-Report.csv");
const FIXTURE_PATH = path.join(
  process.cwd(),
  "scripts/fixtures/aug-2026-split-salesperson-expected.json"
);
const DEFAULT_POS =
  "/home/ubuntu/.cursor/projects/workspace/uploads/1-31aug-split-salesperson_73ff.CSV";

const AUG_FROM = "2026-08-01";
const AUG_TO = "2026-08-31";

function money(s: unknown): number {
  const n = Number(
    String(s ?? "")
      .replace(/[$,]/g, "")
      .replace(/\((.*)\)/, "-$1")
  );
  return Number.isFinite(n) ? n : 0;
}

function isoDate(raw: string): string | null {
  return parseReportFilterDate(String(raw ?? "").trim());
}

function leadingSku(raw: string): string {
  const s = String(raw ?? "").trim().toUpperCase();
  const m = s.match(/^(\d{4,})/);
  return m ? m[1]! : s;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function get(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    if (row[name] != null && String(row[name]).length) return String(row[name]);
    const want = name.replace(/\s+/g, " ").trim().toLowerCase();
    const hit = Object.keys(row).find(
      (k) => k.replace(/\s+/g, " ").trim().toLowerCase() === want
    );
    if (hit && row[hit] != null && String(row[hit]).length) return String(row[hit]);
  }
  return "";
}

function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

type LiveWrap = { row: Record<string, string>; used: boolean };

function takeFrom(map: Map<string, LiveWrap[]>, key: string): LiveWrap | null {
  const list = map.get(key);
  if (!list) return null;
  const i = list.findIndex((x) => !x.used);
  if (i < 0) return null;
  list[i]!.used = true;
  return list[i]!;
}

function pushMap(map: Map<string, LiveWrap[]>, key: string, live: LiveWrap) {
  const list = map.get(key) ?? [];
  list.push(live);
  map.set(key, list);
}

function main() {
  const posPath = process.argv[2] ?? DEFAULT_POS;
  if (!fs.existsSync(posPath)) {
    throw new Error(`POS file not found: ${posPath}`);
  }

  const seedText = fs.readFileSync(SEED_PATH, "utf8");
  const newline = seedText.includes("\r\n") ? "\r\n" : "\n";
  const seedLines = seedText.split(newline);
  if (seedLines.at(-1) === "") seedLines.pop();
  const headerLine = seedLines[0] ?? "";
  const fields = (Papa.parse<string[]>(headerLine, { header: false }).data[0] ?? []).map(
    (f) => String(f ?? "")
  );
  const dateIdx = fields.findIndex((f) => /transaction\s*date/i.test(f));
  if (dateIdx < 0) throw new Error("Seed missing Transaction Date column");

  const nonAugust: string[] = [];
  for (let i = 1; i < seedLines.length; i++) {
    const line = seedLines[i]!;
    if (!line.trim()) continue;
    const cells = Papa.parse<string[]>(line, { header: false }).data[0] ?? [];
    const iso = isoDate(String(cells[dateIdx] ?? ""));
    if (iso && iso >= AUG_FROM && iso <= AUG_TO) continue;
    nonAugust.push(line);
  }

  const seedParsed = Papa.parse<Record<string, string>>(seedText, {
    header: true,
    skipEmptyLines: "greedy",
  });
  const liveAug: LiveWrap[] = [];
  for (const row of seedParsed.data) {
    const iso = isoDate(get(row, "Transaction Date"));
    if (!iso || iso < AUG_FROM || iso > AUG_TO) continue;
    liveAug.push({ row, used: false });
  }

  const byFull = new Map<string, LiveWrap[]>();
  const byModel = new Map<string, LiveWrap[]>();
  const bySku = new Map<string, LiveWrap[]>();
  const byMoney = new Map<string, LiveWrap[]>();
  for (const live of liveAug) {
    const date = isoDate(get(live.row, "Transaction Date")) ?? "";
    const store = get(live.row, "Store").trim().toUpperCase();
    const sku = leadingSku(get(live.row, "SKU #") || get(live.row, "Item #"));
    const model = (
      get(live.row, "Vendor Model") || get(live.row, "VendorModel1")
    )
      .trim()
      .toUpperCase();
    const qty = round4(money(get(live.row, "Qty")));
    const total = round2(money(get(live.row, "Total")));
    pushMap(byFull, `${date}|${store}|${qty}|${total}|${sku}|${model}`, live);
    if (model) pushMap(byModel, `${date}|${store}|${qty}|${total}|${model}`, live);
    if (sku) pushMap(bySku, `${date}|${store}|${qty}|${total}|${sku}`, live);
    pushMap(byMoney, `${date}|${store}|${qty}|${total}`, live);
  }

  const posParsed = Papa.parse<Record<string, string>>(
    normalizeDailySalesCsv(fs.readFileSync(posPath, "utf8")),
    { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() }
  );
  const posRows = posParsed.data.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").trim())
  );

  type PosWork = {
    raw: Record<string, string>;
    date: string;
    store: string;
    sku: string;
    model: string;
    qty: number;
    total: number;
    person: string;
    live: LiveWrap | null;
  };
  const work: PosWork[] = [];
  for (const raw of posRows) {
    const date = isoDate(raw["Transaction Date"] ?? "");
    if (!date) continue;
    work.push({
      raw,
      date,
      store: String(raw.Store ?? "").trim().toUpperCase(),
      sku: leadingSku(raw["Item #"] ?? ""),
      model: String(raw.VendorModel1 ?? "").trim().toUpperCase(),
      qty: round4(money(raw.Qty)),
      total: round2(money(raw.Total)),
      person: String(raw["Sales Person"] ?? "").trim().toUpperCase(),
      live: null,
    });
  }

  let matchedExact = 0;
  for (const p of work) {
    p.live =
      takeFrom(
        byFull,
        `${p.date}|${p.store}|${p.qty}|${p.total}|${p.sku}|${p.model}`
      ) ??
      (p.model
        ? takeFrom(byModel, `${p.date}|${p.store}|${p.qty}|${p.total}|${p.model}`)
        : null) ??
      (p.sku
        ? takeFrom(bySku, `${p.date}|${p.store}|${p.qty}|${p.total}|${p.sku}`)
        : null) ??
      takeFrom(byMoney, `${p.date}|${p.store}|${p.qty}|${p.total}`);
    if (p.live) matchedExact++;
  }

  let matchedFuzzy = 0;
  for (const p of work) {
    if (p.live) continue;
    const candidates = liveAug.filter((l) => {
      if (l.used) return false;
      const date = isoDate(get(l.row, "Transaction Date"));
      const store = get(l.row, "Store").trim().toUpperCase();
      if (date !== p.date || store !== p.store) return false;
      const sku = leadingSku(get(l.row, "SKU #") || get(l.row, "Item #"));
      const model = (
        get(l.row, "Vendor Model") || get(l.row, "VendorModel1")
      )
        .trim()
        .toUpperCase();
      if (p.model && model && p.model === model) return true;
      if (p.sku && sku && p.sku === sku) return true;
      return false;
    });
    if (!candidates.length) continue;
    candidates.sort(
      (a, b) =>
        Math.abs(round2(money(get(a.row, "Total"))) - p.total) -
        Math.abs(round2(money(get(b.row, "Total"))) - p.total)
    );
    candidates[0]!.used = true;
    p.live = candidates[0]!;
    matchedFuzzy++;
  }

  const outRows: Record<string, string>[] = [];
  const byPerson = new Map<string, number>();
  const byDesign = new Map<string, number>();
  const byStore = new Map<string, number>();
  const byPersonDesign = new Map<string, number>();
  let posNet = 0;

  for (const p of work) {
    const liveRow = p.live?.row ?? {};
    const person = p.person;
    const salespersons = person
      ? `${person}/100% - `
      : String(p.raw.Salespersons ?? "").trim();
    const totalRaw = String(p.raw.Total ?? "").trim();
    const total = p.total;
    posNet += total;
    if (person) byPerson.set(person, (byPerson.get(person) ?? 0) + total);
    const designName = String(p.raw.Design ?? "").trim() || "Unknown design";
    byDesign.set(designName, (byDesign.get(designName) ?? 0) + total);
    byStore.set(p.store, (byStore.get(p.store) ?? 0) + total);
    if (person) {
      const k = `${person}||${designName}`;
      byPersonDesign.set(k, (byPersonDesign.get(k) ?? 0) + total);
    }

    const liveTotal = round2(money(get(liveRow, "Total")));
    const salesAmount =
      p.live && Math.abs(liveTotal - total) < 0.02
        ? get(liveRow, "Sales Amount")
        : totalRaw;

    const iso = p.date;
    const month = String(Number(iso.slice(5, 7)));
    const year = iso.slice(0, 4);
    const posItem = String(p.raw["Item #"] ?? "").trim();
    const posModel = String(p.raw.VendorModel1 ?? "").trim();

    const out: Record<string, string> = {};
    for (const f of fields) out[f] = "";

    const set = (name: string, value: string) => {
      const want = name.replace(/\s+/g, " ").trim().toLowerCase();
      const hit =
        fields.find((f) => f.replace(/\s+/g, " ").trim().toLowerCase() === want) ??
        name;
      out[hit] = value;
    };

    set("Transaction #", get(liveRow, "Transaction #"));
    set(
      "Transaction Date",
      get(liveRow, "Transaction Date") || String(p.raw["Transaction Date"] ?? "")
    );
    set("Transaction Month", get(liveRow, "Transaction Month") || month);
    set("Transaction Year", get(liveRow, "Transaction Year") || year);
    set("SKU #", get(liveRow, "SKU #") || posItem);
    set("Style #", get(liveRow, "Style #"));
    set(
      "Description",
      get(liveRow, "Description") || String(p.raw.Department ?? "").trim()
    );
    set("Vendor Model", posModel || get(liveRow, "Vendor Model"));
    set("Vendor Name", get(liveRow, "Vendor Name"));
    set("Qty", String(p.raw.Qty ?? "").trim());
    set("Inventory Cost", get(liveRow, "Inventory Cost"));
    set("Sales Amount", salesAmount);
    set("Disc Amt", String(p.raw["Disc Amt"] ?? "").trim());
    set("Total", totalRaw);
    set("Store", String(p.raw.Store ?? "").trim() || get(liveRow, "Store"));
    set("Department", String(p.raw.Department ?? "").trim());
    set("Design", String(p.raw.Design ?? "").trim());
    set("Class", get(liveRow, "Class"));
    set("Sub-Class", get(liveRow, "Sub-Class"));
    set("Image Dir.", get(liveRow, "Image Dir."));
    set("AvgWeight", get(liveRow, "AvgWeight"));
    set("Salespersons", salespersons);
    set("Item #", get(liveRow, "Item #") || posItem);
    set("VendorModel1", posModel || get(liveRow, "VendorModel1"));
    set("Pay Codes", get(liveRow, "Pay Codes"));
    outRows.push(out);
  }

  const newAugustLines = outRows.map((row) =>
    fields.map((f) => csvEscape(row[f] ?? "")).join(",")
  );
  const outText = [headerLine, ...nonAugust, ...newAugustLines].join(newline) + newline;
  fs.writeFileSync(SEED_PATH, outText, "utf8");

  const toObj = (m: Map<string, number>) =>
    Object.fromEntries(
      [...m.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([k, v]) => [k, +v.toFixed(2)])
    );

  const fixture = {
    posFile: path.basename(posPath),
    posRows: work.length,
    posNet: +posNet.toFixed(2),
    byPerson: toObj(byPerson),
    byDesign: toObj(byDesign),
    byStore: toObj(byStore),
    byPersonDesign: toObj(byPersonDesign),
  };
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + "\n", "utf8");

  console.log(
    JSON.stringify(
      {
        posPath,
        seedPath: SEED_PATH,
        fixturePath: FIXTURE_PATH,
        nonAugustRows: nonAugust.length,
        posRows: work.length,
        matchedExact,
        matchedFuzzy,
        unmatchedPos: work.filter((p) => !p.live).length,
        unusedLive: liveAug.filter((l) => !l.used).length,
        posNet: fixture.posNet,
        seedBytes: fs.statSync(SEED_PATH).size,
      },
      null,
      2
    )
  );
}

main();
