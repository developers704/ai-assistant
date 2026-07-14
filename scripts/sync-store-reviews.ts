/**
 * Sync Google Places ratings & reviews into the Valliani store directory.
 *
 * Uses:
 *   Places API (New) Text Search → place IDs
 *   Place Details (Legacy) with reviews_sort=newest → up to 5 newest reviews
 *
 * Google hard-caps Places Details at 5 reviews per place. Full review history
 * requires Google Business Profile API (verified owner) or a partner aggregator.
 *
 * Google Cloud Console:
 *   1. Enable "Places API (New)" and legacy "Places API"
 *   2. Billing enabled on the project
 *   3. API key in .env.local as GOOGLE_MAPS_API_KEY
 *
 * Usage:
 *   npm run stores:reviews
 */
import fs from "node:fs";
import path from "node:path";

const STORE_FILE = path.join(process.cwd(), "data/knowledge/valliani/store-directory.json");
const CACHE_FILE = path.join(process.cwd(), ".data/stores/places-reviews-cache.json");

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type Store = {
  id: string;
  name: string;
  mall: string;
  city: string | null;
  stateCode: string;
  fullAddress?: string | null;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  phone?: string | null;
  googlePlaceId?: string | null;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  googleReviews?: Array<{
    authorName: string;
    rating: number;
    text: string;
    relativeTime: string;
    time?: number | null;
    profilePhotoUrl?: string | null;
    language?: string | null;
  }> | null;
  googleMapsPlaceUrl?: string | null;
  googleRatingSyncedAt?: string | null;
  googleMapsUrl?: string | null;
};

type PlaceDetailsMapped = {
  id: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string | null;
  reviews: NonNullable<Store["googleReviews"]>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isBusinessPlaceId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("ChIJ");
}

function searchQuery(store: Store): string {
  return ["Valliani Jewelers", store.mall, store.city, store.stateCode].filter(Boolean).join(" ");
}

async function textSearchNew(
  query: string,
  apiKey: string,
  location?: { lat: number; lng: number } | null
): Promise<{ placeId: string; name: string; rating?: number; userRatingCount?: number } | null> {
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 3,
  };
  if (location) {
    body.locationBias = {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: 5000,
      },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    error?: { message?: string; status?: string };
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      rating?: number;
      userRatingCount?: number;
    }>;
  };

  if (!res.ok) {
    throw new Error(`Text Search (New) ${res.status}: ${json.error?.message ?? res.statusText}`);
  }

  const hit = json.places?.[0];
  if (!hit?.id) return null;
  return {
    placeId: hit.id,
    name: hit.displayName?.text ?? "",
    rating: hit.rating,
    userRatingCount: hit.userRatingCount,
  };
}

/**
 * Place Details (New) — returns max 5 reviews (Google hard-cap).
 * Sort is relevance by default; we reorder by publishTime client-side.
 * True `reviews_sort=newest` only exists on Place Details (Legacy).
 */
async function placeDetailsNew(
  placeId: string,
  apiKey: string
): Promise<PlaceDetailsMapped | null> {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", "en");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,rating,userRatingCount,googleMapsUri,reviews",
    },
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    id?: string;
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    reviews?: Array<{
      authorAttribution?: { displayName?: string; photoUri?: string };
      rating?: number;
      text?: { text?: string; languageCode?: string };
      relativePublishTimeDescription?: string;
      publishTime?: string;
    }>;
  };

  if (!res.ok) {
    throw new Error(`Place Details (New) ${res.status}: ${json.error?.message ?? res.statusText}`);
  }

  const reviews = (json.reviews ?? [])
    .map((r) => ({
      authorName: r.authorAttribution?.displayName ?? "Google user",
      rating: r.rating ?? 0,
      text: r.text?.text ?? "",
      relativeTime: r.relativePublishTimeDescription ?? "",
      time: r.publishTime ? Date.parse(r.publishTime) / 1000 : null,
      profilePhotoUrl: r.authorAttribution?.photoUri ?? null,
      language: r.text?.languageCode ?? null,
    }))
    .sort((a, b) => (b.time ?? 0) - (a.time ?? 0));

  return {
    id: json.id ?? placeId,
    rating: json.rating,
    userRatingCount: json.userRatingCount,
    googleMapsUri: json.googleMapsUri ?? null,
    reviews,
  };
}

/**
 * Place Details (Legacy) with reviews_sort=newest — preferred when key allows it.
 */
async function placeDetailsLegacyNewest(
  placeId: string,
  apiKey: string
): Promise<PlaceDetailsMapped | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "place_id,name,rating,user_ratings_total,url,reviews"
  );
  url.searchParams.set("reviews_sort", "newest");
  url.searchParams.set("language", "en");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  const json = (await res.json()) as {
    status?: string;
    error_message?: string;
    result?: {
      place_id?: string;
      rating?: number;
      user_ratings_total?: number;
      url?: string;
      reviews?: Array<{
        author_name?: string;
        rating?: number;
        text?: string;
        relative_time_description?: string;
        time?: number;
        profile_photo_url?: string;
        language?: string;
      }>;
    };
  };

  if (json.status === "REQUEST_DENIED") {
    return null; // caller falls back to Places API (New)
  }
  if (json.status && json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    throw new Error(
      `Place Details (Legacy) ${json.status}: ${json.error_message ?? "request failed"}`
    );
  }
  if (!json.result) return null;

  const reviews = (json.result.reviews ?? [])
    .map((r) => ({
      authorName: r.author_name ?? "Google user",
      rating: r.rating ?? 0,
      text: r.text ?? "",
      relativeTime: r.relative_time_description ?? "",
      time: r.time ?? null,
      profilePhotoUrl: r.profile_photo_url ?? null,
      language: r.language ?? null,
    }))
    .sort((a, b) => (b.time ?? 0) - (a.time ?? 0));

  return {
    id: json.result.place_id ?? placeId,
    rating: json.result.rating,
    userRatingCount: json.result.user_ratings_total,
    googleMapsUri: json.result.url ?? null,
    reviews,
  };
}

async function main() {
  loadEnvLocal();
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Set GOOGLE_MAPS_API_KEY (or GOOGLE_MAPS_SERVER_KEY) in .env.local");
  }

  const directory = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  const stores: Store[] = directory.stores;
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  const cache: Record<string, unknown> = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
    : {};

  // Bust details cache for a fresh pull
  for (const key of Object.keys(cache)) {
    if (
      key.startsWith("details:") ||
      key.startsWith("detailsNew") ||
      key.startsWith("detailsLegacy") ||
      key.startsWith("detailsRefresh")
    ) {
      delete cache[key];
    }
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

  // Probe Legacy once — REQUEST_DENIED means key only has Places API (New).
  let useLegacyNewest = false;
  const probeId = stores.find((s) => isBusinessPlaceId(s.googlePlaceId))?.googlePlaceId;
  if (probeId) {
    const probe = await placeDetailsLegacyNewest(probeId, apiKey);
    useLegacyNewest = probe != null;
    console.log(
      useLegacyNewest
        ? "Using Place Details (Legacy) reviews_sort=newest"
        : "Legacy Places denied — using Places API (New); sorting returned reviews by date"
    );
  }

  let resolved = 0;
  let rated = 0;
  let failed = 0;

  for (const store of stores) {
    try {
      let placeId = store.googlePlaceId ?? null;

      if (!isBusinessPlaceId(placeId)) {
        const q = searchQuery(store);
        const cacheKey = `searchNew:${q}`;
        let found = cache[cacheKey] as
          | { placeId: string; name: string; rating?: number; userRatingCount?: number }
          | null
          | undefined;

        if (found === undefined) {
          console.log(`Resolving Place ID · ${store.mall}`);
          found = await textSearchNew(
            q,
            apiKey,
            store.latitude != null && store.longitude != null
              ? { lat: store.latitude, lng: store.longitude }
              : null
          );
          cache[cacheKey] = found;
          fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
          await sleep(250);
        }

        if (found?.placeId) {
          placeId = found.placeId;
          store.googlePlaceId = placeId;
          resolved++;
        } else {
          console.warn(`  No Google business found for ${store.mall}`);
          failed++;
          continue;
        }
      }

      const detailsKey = `detailsRefresh:${placeId}`;
      let details = cache[detailsKey] as PlaceDetailsMapped | null | undefined;
      if (details === undefined) {
        console.log(`Fetching reviews · ${store.mall}`);
        details = useLegacyNewest
          ? await placeDetailsLegacyNewest(placeId!, apiKey)
          : await placeDetailsNew(placeId!, apiKey);
        if (!details && useLegacyNewest) {
          details = await placeDetailsNew(placeId!, apiKey);
        }
        cache[detailsKey] = details;
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        await sleep(250);
      }

      if (!details) {
        failed++;
        continue;
      }

      store.googlePlaceId = details.id || placeId;
      store.googleRating = details.rating ?? null;
      store.googleReviewCount = details.userRatingCount ?? null;
      store.googleMapsPlaceUrl = details.googleMapsUri ?? store.googleMapsUrl ?? null;
      if (details.googleMapsUri) store.googleMapsUrl = details.googleMapsUri;
      store.googleReviews = details.reviews;
      store.googleRatingSyncedAt = new Date().toISOString();
      rated++;
      console.log(
        `  ✓ ${store.mall}: ${store.googleRating ?? "—"}★ · ${store.googleReviews.length} reviews (of ${store.googleReviewCount ?? 0} total on Google)`
      );
    } catch (err) {
      failed++;
      console.error(`  ✗ ${store.mall}:`, err instanceof Error ? err.message : err);
    }
  }

  directory.generatedAt = new Date().toISOString();
  directory.storeCount = stores.length;
  fs.writeFileSync(STORE_FILE, JSON.stringify(directory, null, 2));
  console.log(`\nDone. Rated ${rated}/${stores.length} · resolved IDs ${resolved} · failed ${failed}`);
  console.log(`Updated ${STORE_FILE}`);
  console.log(`
Note: Google Places API returns a MAXIMUM of 5 reviews per store (newest first).
Total review counts (e.g. 704) are shown, but full history is not available via Places API.
To pull ALL reviews for Valliani locations, use Google Business Profile API (verified owner)
or a approved review-aggregation partner — not public Places Details.
`);
  if (failed === stores.length) {
    console.log(`
If every store failed with PERMISSION_DENIED / API not enabled:
  1. Open Google Cloud Console → APIs & Services → Library
  2. Enable "Places API (New)"  (not the legacy Places API)
  3. Ensure billing is on and your key can call Places API (New)
  4. Re-run: npm run stores:reviews
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
