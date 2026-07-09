/**
 * One-shot: apply Google Maps weekly hours pasted by the user (2026-07-09).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../data/knowledge/valliani/store-directory.json");

const h = (open, close) => `${open} - ${close}`;

/** @type {Record<string, Record<string, string>>} */
const HOURS = {
  "westfield-galleria-mall": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "eastridge-centre": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "8:00 PM"),
  },
  "northridge-mall": {
    monday: h("11:00 AM", "8:00 PM"),
    tuesday: h("11:00 AM", "8:00 PM"),
    wednesday: h("11:00 AM", "8:00 PM"),
    thursday: h("11:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "8:00 PM"),
  },
  "southland-mall": {
    monday: h("11:00 AM", "7:00 PM"),
    tuesday: h("11:00 AM", "7:00 PM"),
    wednesday: h("11:00 AM", "7:00 PM"),
    thursday: h("11:00 AM", "7:00 PM"),
    friday: h("11:00 AM", "8:00 PM"),
    saturday: h("11:00 AM", "8:00 PM"),
    sunday: h("11:00 AM", "6:00 PM"),
  },
  "serramonte-center": {
    monday: h("10:00 AM", "9:00 PM"),
    tuesday: h("10:00 AM", "9:00 PM"),
    wednesday: h("10:00 AM", "9:00 PM"),
    thursday: h("10:00 AM", "9:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("10:00 AM", "7:00 PM"),
  },
  "visalia-mall": {
    monday: h("11:00 AM", "7:00 PM"),
    tuesday: h("11:00 AM", "7:00 PM"),
    wednesday: h("11:00 AM", "7:00 PM"),
    thursday: h("11:00 AM", "7:00 PM"),
    friday: h("11:00 AM", "8:00 PM"),
    saturday: h("11:00 AM", "8:00 PM"),
    sunday: h("11:00 AM", "6:00 PM"),
  },
  "fashion-fair-mall": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "8:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "westfield-valley-fair": {
    monday: h("10:00 AM", "9:00 PM"),
    tuesday: h("10:00 AM", "9:00 PM"),
    wednesday: h("10:00 AM", "9:00 PM"),
    thursday: h("10:00 AM", "9:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("10:00 AM", "9:00 PM"),
  },
  "westfield-oakridge": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "valley-plaza": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "8:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("10:00 AM", "9:00 PM"),
  },
  "san-francisco-premium-outlets": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "8:00 PM"),
    saturday: h("10:00 AM", "7:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "inland-center": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "8:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "arden-fair": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "8:00 PM"),
    saturday: h("10:00 AM", "7:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "westfield-culver-city": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "8:00 PM"),
  },
  "the-shops-at-santa-anita": {
    monday: h("10:00 AM", "9:00 PM"),
    tuesday: h("10:00 AM", "9:00 PM"),
    wednesday: h("10:00 AM", "9:00 PM"),
    thursday: h("10:00 AM", "9:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "8:00 PM"),
    sunday: h("11:00 AM", "8:00 PM"),
  },
  "the-mall-of-victor-valley": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "8:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "6:00 PM"),
  },
  "ontario-mills": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "8:00 PM"),
  },
  "westfield-plaza-bonita": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "weberstown-mall": {
    monday: h("11:00 AM", "8:00 PM"),
    tuesday: h("11:00 AM", "8:00 PM"),
    wednesday: h("11:00 AM", "8:00 PM"),
    thursday: h("11:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "8:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "meadowood-mall": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("11:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "9:00 PM"),
    sunday: h("10:00 AM", "8:00 PM"),
  },
  "santa-rosa-plaza": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "8:00 PM"),
    saturday: h("10:00 AM", "8:00 PM"),
    sunday: h("10:00 AM", "6:00 PM"),
  },
  "chandler-fashion-center": {
    monday: h("10:00 AM", "9:00 PM"),
    tuesday: h("10:00 AM", "9:00 PM"),
    wednesday: h("10:00 AM", "9:00 PM"),
    thursday: h("10:00 AM", "9:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "6:00 PM"),
  },
  "longview-mall": {
    monday: h("11:00 AM", "8:00 PM"),
    tuesday: h("11:00 AM", "8:00 PM"),
    wednesday: h("11:00 AM", "6:00 PM"),
    thursday: h("11:00 AM", "6:00 PM"),
    friday: h("11:00 AM", "8:00 PM"),
    saturday: h("10:00 AM", "8:00 PM"),
    sunday: h("12:00 PM", "6:00 PM"),
  },
  "northridge-fashion-center": {
    monday: h("11:00 AM", "8:00 PM"),
    tuesday: h("11:00 AM", "8:00 PM"),
    wednesday: h("11:00 AM", "8:00 PM"),
    thursday: h("11:00 AM", "8:00 PM"),
    friday: h("11:00 AM", "9:00 PM"),
    saturday: h("11:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "antelope-valley-mall": {
    monday: h("11:00 AM", "8:00 PM"),
    tuesday: h("11:00 AM", "8:00 PM"),
    wednesday: h("11:00 AM", "8:00 PM"),
    thursday: h("11:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  "great-mall": {
    monday: h("10:00 AM", "8:00 PM"),
    tuesday: h("10:00 AM", "8:00 PM"),
    wednesday: h("10:00 AM", "8:00 PM"),
    thursday: h("10:00 AM", "8:00 PM"),
    friday: h("10:00 AM", "6:00 PM"),
    saturday: h("10:00 AM", "9:00 PM"),
    sunday: h("11:00 AM", "7:00 PM"),
  },
  deerbrook: {
    monday: h("11:00 AM", "8:00 PM"),
    tuesday: h("11:00 AM", "8:00 PM"),
    wednesday: h("11:00 AM", "8:00 PM"),
    thursday: h("11:00 AM", "8:00 PM"),
    friday: h("11:00 AM", "9:00 PM"),
    saturday: h("10:00 AM", "6:00 PM"),
    sunday: h("11:00 AM", "6:00 PM"),
  },
};

function hoursRawSummary(hours) {
  const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const labels = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
  const groups = [];
  let start = 0;
  for (let i = 1; i <= order.length; i++) {
    const same = i < order.length && hours[order[i]] === hours[order[start]];
    if (same) continue;
    const dayRange =
      i - start === 1
        ? labels[order[start]]
        : `${labels[order[start]]}-${labels[order[i - 1]]}`;
    groups.push(`${dayRange}: ${hours[order[start]].replace(/:00 /g, " ").toLowerCase()}`);
    start = i;
  }
  return groups.join(", ");
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const syncedAt = new Date().toISOString();
let updated = 0;
const missing = [];

for (const store of data.stores) {
  const next = HOURS[store.id];
  if (!next) {
    missing.push(store.id);
    continue;
  }
  store.openingHours = next;
  store.hoursRaw = hoursRawSummary(next);
  store.hoursSource = "google_maps_manual_2026-07-09";
  store.lastSyncedAt = syncedAt;
  updated++;
}

data.generatedAt = syncedAt;
data.sourceNote =
  (data.sourceNote || "") +
  " Weekly opening hours updated from Google Maps listings on 2026-07-09 for stores with pasted hours.";

fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(`Updated hours for ${updated} stores.`);
console.log(`Unchanged (no Google paste): ${missing.join(", ")}`);
