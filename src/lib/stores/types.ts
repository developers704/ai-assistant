export type StoreStatus = "Open" | "Opening Soon" | "Closed" | string;

export interface NearestStoreRef {
  id: string;
  name: string;
  distanceMiles: number;
}

export interface StoreDirectoryEntry {
  id: string;
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
