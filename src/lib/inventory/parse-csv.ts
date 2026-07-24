import type { InventoryItem } from "./types";

function parsePrice(raw: string): number {
  const s = raw.trim().replace(/[$,]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function parseWeight(raw: string): number {
  const n = parseFloat(raw.trim().replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseQty(raw: string): number {
  const n = parseFloat(raw.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Parse a single CSV line respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

type ColumnKey =
  | "sku"
  | "description"
  | "vendorModel"
  | "tagPrice"
  | "costPrice"
  | "store"
  | "department"
  | "design"
  | "class"
  | "subClass"
  | "avgWeight"
  | "onhandQty";

const HEADER_ALIASES: Record<string, ColumnKey> = {
  "sku #": "sku",
  sku: "sku",
  "item #": "sku",
  "item desc": "description",
  description: "description",
  "vendor model": "vendorModel",
  "tag price": "tagPrice",
  "individual selling value": "tagPrice",
  "cost price": "costPrice",
  "individual cost value": "costPrice",
  store: "store",
  department: "department",
  design: "design",
  class: "class",
  "sub-class": "subClass",
  "sub class": "subClass",
  avgweight: "avgWeight",
  "avg weight": "avgWeight",
  "onhand qty": "onhandQty",
  "on hand qty": "onhandQty",
  "on-hand qty": "onhandQty",
  "qty on hand": "onhandQty",
};

function buildColumnMap(headers: string[]): Partial<Record<ColumnKey, number>> {
  const map: Partial<Record<ColumnKey, number>> = {};
  headers.forEach((header, index) => {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    if (key !== undefined && map[key] === undefined) {
      map[key] = index;
    }
  });
  return map;
}

const WATCH_BRAND_LABELS: Record<string, string> = {
  ROLEX: "Rolex",
  GUCCI: "Gucci",
  RADO: "Rado",
  LONGINES: "Longines",
  MOVADO: "Movado",
  BULOVA: "Bulova",
  "MICHAEL KO": "Michael Kors",
};

const GENERIC_DEPARTMENTS = new Set([
  "LADYS RING",
  "PENDANT",
  "EARRINGS",
  "GOLD CHAIN",
  "GOLD BANDS",
  "GOLD HOOPS",
  "GOLD PNDTS",
  "GOLD ID",
  "BE",
  "BP",
  "B",
  "SS CHAIN",
  "WATCH",
  "BRACELET",
  "NECKLACE",
]);

function deriveBrand(
  department: string,
  design: string,
  description: string,
  vendorModel: string
): string {
  const dept = department.trim().toUpperCase();
  if (WATCH_BRAND_LABELS[dept]) return WATCH_BRAND_LABELS[dept];
  if (dept.startsWith("MICHAEL")) return "Michael Kors";

  if (/benchmark/i.test(description) || /benchmark/i.test(vendorModel)) {
    return "Benchmark";
  }

  const designTrim = design.trim();
  if (designTrim && !/^GOLD JEWL$/i.test(designTrim) && !/^PLAIN$/i.test(designTrim)) {
    return designTrim;
  }

  const quoted = description.match(/"([^"]+)"/);
  if (quoted?.[1]) return quoted[1].replace(/-/g, " ").trim();

  if (dept && !GENERIC_DEPARTMENTS.has(dept)) return department.trim();

  return "—";
}

function getField(cols: string[], map: Partial<Record<ColumnKey, number>>, key: ColumnKey): string {
  const index = map[key];
  if (index === undefined) return "";
  return (cols[index] ?? "").trim();
}

function rowToItem(cols: string[], map: Partial<Record<ColumnKey, number>>): InventoryItem | null {
  const sku = getField(cols, map, "sku");
  if (!sku || sku.toUpperCase() === "ITEM") return null;

  const tagPrice = parsePrice(getField(cols, map, "tagPrice"));
  const costPrice = parsePrice(getField(cols, map, "costPrice"));
  const hasOnhandCol = map.onhandQty !== undefined;
  const onhandQty = hasOnhandCol ? parseQty(getField(cols, map, "onhandQty")) : undefined;
  const store = getField(cols, map, "store");

  // Pricing CSVs need a price; on-hand CSVs need store + onhand column.
  if (!hasOnhandCol && tagPrice <= 0 && costPrice <= 0) return null;
  if (hasOnhandCol && !store) return null;

  const department = getField(cols, map, "department");
  const design = getField(cols, map, "design");
  const description = getField(cols, map, "description");
  const vendorModel = getField(cols, map, "vendorModel");

  return {
    sku,
    description,
    vendorModel,
    tagPrice,
    costPrice,
    store,
    department,
    design,
    class: getField(cols, map, "class"),
    subClass: getField(cols, map, "subClass"),
    avgWeight: parseWeight(getField(cols, map, "avgWeight")),
    brand: deriveBrand(department, design, description, vendorModel),
    ...(onhandQty !== undefined ? { onhandQty } : {}),
  };
}

export function parseInventoryCsv(csvText: string): {
  items: InventoryItem[];
  hasOnhandColumn: boolean;
} {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { items: [], hasOnhandColumn: false };

  const headers = parseCsvLine(lines[0]);
  const columnMap = buildColumnMap(headers);

  if (columnMap.sku === undefined) {
    throw new Error('Inventory CSV must include a "SKU #" column.');
  }
  if (columnMap.tagPrice === undefined && columnMap.onhandQty === undefined) {
    throw new Error(
      'Inventory CSV must include a "Tag Price" / "Individual Selling Value" or "Onhand Qty" column.'
    );
  }

  const hasOnhandColumn = columnMap.onhandQty !== undefined;
  const items: InventoryItem[] = [];
  const seenStoreSku = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const item = rowToItem(cols, columnMap);
    if (!item) continue;

    // Keep one row per store + SKU (on-hand files have many stores per SKU).
    const dedupeKey = `${item.store.trim().toUpperCase()}|${item.sku.trim().toUpperCase()}`;
    if (seenStoreSku.has(dedupeKey)) continue;
    seenStoreSku.add(dedupeKey);

    items.push(item);
  }

  return { items, hasOnhandColumn };
}
