import type { ParsedStoreCard, StoreStatus } from "@/lib/stores/types";

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function extractCoordsFromMapUrl(
  url: string | null | undefined
): { latitude: number; longitude: number } | null {
  if (!url) return null;
  const decoded = decodeHtml(url);

  const atMatch = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) };
  }

  const dMatch = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dMatch) {
    return { latitude: parseFloat(dMatch[1]), longitude: parseFloat(dMatch[2]) };
  }

  return null;
}

export function parseMallFromName(name: string): string {
  const mall = name
    .replace(/^Valliani Jewelers\s*[-–]?\s*/i, "")
    .replace(/\s*\(Opening Soon\)\s*/i, "")
    .trim();
  if (!mall) return name.trim();
  return mall;
}

export function detectStatus(name: string, searchText: string): StoreStatus {
  const combined = `${name} ${searchText}`.toLowerCase();
  if (/\bopening soon\b/.test(combined)) return "opening_soon";
  return "open";
}

export function parseAddressParts(raw: string): {
  address: string;
  city: string;
  stateCode: string;
  zipCode: string | null;
} {
  const text = raw.replace(/\s+/g, " ").trim();

  const standard = text.match(
    /^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$/i
  );
  if (standard) {
    return {
      address: standard[1].trim(),
      city: standard[2].trim(),
      stateCode: standard[3].toUpperCase(),
      zipCode: standard[4] ?? null,
    };
  }

  const weird = text.match(/^(.+?),\s*([A-Z]{2}),\s*([^,]+),\s*(\d{5})$/i);
  if (weird) {
    return {
      address: weird[1].trim(),
      city: weird[3].trim(),
      stateCode: weird[2].toUpperCase(),
      zipCode: weird[4],
    };
  }

  const stateZip = text.match(/,\s*([A-Z]{2})\s+(\d{5})/i);
  if (stateZip) {
    const before = text.slice(0, stateZip.index).trim();
    const parts = before.split(",").map((p) => p.trim()).filter(Boolean);
    const city = parts.length > 1 ? parts[parts.length - 1] : "";
    const address = parts.length > 1 ? parts.slice(0, -1).join(", ") : before;
    return {
      address: address || text,
      city,
      stateCode: stateZip[1].toUpperCase(),
      zipCode: stateZip[2],
    };
  }

  return { address: text, city: "", stateCode: "", zipCode: null };
}

const STATE_NAMES: Record<string, string> = {
  CA: "California",
  NV: "Nevada",
  AZ: "Arizona",
  TX: "Texas",
};

const STATE_TIMEZONES: Record<string, string> = {
  CA: "America/Los_Angeles",
  NV: "America/Los_Angeles",
  AZ: "America/Phoenix",
  TX: "America/Chicago",
};

export function stateName(code: string): string {
  return STATE_NAMES[code.toUpperCase()] ?? code;
}

export function stateTimezone(code: string): string | null {
  return STATE_TIMEZONES[code.toUpperCase()] ?? null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildStoreId(mall: string, city: string, stateCode: string, index: number): string {
  const base = slugify(`${mall}-${city}-${stateCode}`);
  return base ? `vj-${base}` : `vj-store-${index}`;
}

export function buildAliases(
  name: string,
  mall: string,
  city: string,
  searchText: string
): string[] {
  const set = new Set<string>();
  const add = (v: string | null | undefined) => {
    const t = v?.trim();
    if (t && t.length > 2) set.add(t);
  };

  add(name);
  add(mall);
  add(city);
  add(mall.replace(/^Westfield\s+/i, ""));
  add(mall.replace(/^The\s+/i, ""));

  for (const token of searchText.toLowerCase().split(/\s+/)) {
    if (token.length > 3 && !/^\(?\d{3}\)?/.test(token)) {
      set.add(token);
    }
  }

  return Array.from(set);
}

function parseCardBlock(block: string, index: number): ParsedStoreCard | null {
  const nameMatch = block.match(/class="sld-store-card__name">([^<]+)</);
  const addrMatch = block.match(/class="sld-store-card__address">([^<]+)</);
  const searchMatch = block.match(/data-search-text="([^"]*)"/);
  const mapMatch = block.match(/data-map-url="([^"]*)"/);
  const storeAddrMatch = block.match(/data-store-address="([^"]*)"/);
  const phoneMatch = block.match(/href="tel:([^"]+)"/);
  const emailMatch = block.match(/href="mailto:([^"]+)"/);

  const name = decodeHtml(nameMatch?.[1] ?? "");
  if (!name) return null;

  const address = decodeHtml(addrMatch?.[1] ?? storeAddrMatch?.[1] ?? "");
  const mall = parseMallFromName(name);
  const searchText = decodeHtml(searchMatch?.[1] ?? "");

  return {
    index,
    name,
    mall,
    address,
    phone: phoneMatch?.[1] ? formatPhone(phoneMatch[1]) : null,
    email: emailMatch?.[1] ?? null,
    hours: null,
    status: detectStatus(name, searchText),
    searchText,
    googleMapsUrl: decodeHtml(mapMatch?.[1] ?? "") || null,
  };
}

function parseDetailHours(html: string): Map<number, string> {
  const map = new Map<number, string>();
  const re =
    /data-block-index="(\d+)"[\s\S]*?class="sld-detail-hours">([^<]*)</gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const hours = decodeHtml(m[2]);
    if (hours) map.set(parseInt(m[1], 10), hours);
  }
  return map;
}

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return digits;
}

/** Parse all store cards + detail hours from the official Find Your Location page HTML. */
export function parseStoreLocatorPage(html: string): ParsedStoreCard[] {
  const hoursByIndex = parseDetailHours(html);
  const cardRe =
    /<button[^>]*class="sld-store-card[^"]*"[^>]*data-store-index="(\d+)"[\s\S]*?<\/button>/gi;

  const stores: ParsedStoreCard[] = [];
  let match: RegExpExecArray | null;

  while ((match = cardRe.exec(html)) !== null) {
    const index = parseInt(match[1], 10);
    const card = parseCardBlock(match[0], index);
    if (!card) continue;
    card.hours = hoursByIndex.get(index) ?? null;
    stores.push(card);
  }

  stores.sort((a, b) => a.index - b.index);
  return stores;
}
