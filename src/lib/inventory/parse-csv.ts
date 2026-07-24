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
  | "avgWeight";

const HEADER_ALIASES: Record<string, ColumnKey> = {
  "sku #": "sku",
  "sku": "sku",
  "item desc": "description",
  "description": "description",
  "vendor model": "vendorModel",
  "tag price": "tagPrice",
  "cost price": "costPrice",
  "store": "store",
  "department": "department",
  "design": "design",
  "class": "class",
  "sub-class": "subClass",
  "sub class": "subClass",
  "avgweight": "avgWeight",
  "avg weight": "avgWeight",
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
  if (tagPrice <= 0 && costPrice <= 0) return null;

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
    store: getField(cols, map, "store"),
    department,
    design,
    class: getField(cols, map, "class"),
    subClass: getField(cols, map, "subClass"),
    avgWeight: parseWeight(getField(cols, map, "avgWeight")),
    brand: deriveBrand(department, design, description, vendorModel),
  };
}

export function parseInventoryCsv(csvText: string): InventoryItem[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const columnMap = buildColumnMap(headers);

  if (columnMap.sku === undefined) {
    throw new Error('Inventory CSV must include a "SKU #" column.');
  }
  if (columnMap.tagPrice === undefined) {
    throw new Error('Inventory CSV must include a "Tag Price" column.');
  }

  const items: InventoryItem[] = [];
  const seenSku = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const item = rowToItem(cols, columnMap);
    if (!item) continue;

    const skuKey = item.sku.trim().toUpperCase();
    if (seenSku.has(skuKey)) continue;
    seenSku.add(skuKey);

    items.push(item);
  }

  return items;
}
