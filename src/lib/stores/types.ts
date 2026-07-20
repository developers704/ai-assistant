export type StoreStatus = "Open" | "Opening Soon" | "Closed" | string;

export interface NearestStoreRef {
  id: string;
  name: string;
  distanceMiles: number;
}

/** Cached Google Places review (API returns up to 5 most relevant). */
export interface StoreGoogleReview {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  time?: number | null;
  profilePhotoUrl?: string | null;
  language?: string | null;
}

export interface StoreDirectoryEntry {
  id: string;
  /** POS / sales report store code when known (e.g. VJ-BAY). */
  storeCode?: string | null;
  officialName?: string | null;
  name: string;
  mall: string;
  city: string | null;
  state: string;
  stateCode: string;
  country: string;
  status: StoreStatus;
  address: string | null;
  addressRaw?: string | null;
  fullAddress?: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  needsGeocoding?: boolean;
  geocodingQuery?: string | null;
  phone: string | null;
  email: string | null;
  manager: string | null;
  region: string;
  timezone: string | null;
  openingHours: Record<string, string | null> | string | null;
  hoursRaw?: string | null;
  services: string[] | null;
  aliases: string[];
  googleMapsUrl: string | null;
  appleMapsUrl: string | null;
  storeUrl: string | null;
  googlePlaceId?: string | null;
  /** Google Places star rating (1–5). */
  googleRating?: number | null;
  /** Total Google review count. */
  googleReviewCount?: number | null;
  /** Up to 5 Google Places reviews (API hard limit), newest → oldest when synced. */
  googleReviews?: StoreGoogleReview[] | null;
  googleMapsPlaceUrl?: string | null;
  googleRatingSyncedAt?: string | null;
  nearestStores: NearestStoreRef[];
  sourceUrl: string;
  lastSyncedAt: string;
}

export interface StoreDirectoryFile {
  schemaVersion?: string;
  company?: string;
  sourceUrl: string;
  sourceExtractedAt?: string;
  generatedAt?: string;
  sourceNote?: string;
  counts?: Record<string, unknown>;
  lastSyncedAt: string;
  storeCount?: number;
  stores: StoreDirectoryEntry[];
}

export interface ParsedStoreCard {
  index: number;
  name: string;
  mall: string;
  address: string;
  phone: string | null;
  email: string | null;
  hours: string | null;
  status: StoreStatus;
  searchText: string;
  googleMapsUrl: string | null;
}
