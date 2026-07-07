"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import {
  LushMetric,
  LushPanel,
  PageShell,
  PageShellBody,
  PageShellHeader,
} from "@/components/layout/PageShell";
import type { StoreDirectoryEntry } from "@/lib/stores/types";

type StoresApiResponse = {
  stores: StoreDirectoryEntry[];
  overview?: {
    totalStores: number;
    openNow: number;
    openingSoon: number;
    statesCovered: number;
    averageGoogleRating: number | null;
  };
};

type GoogleReview = {
  rating?: number;
  text?: { text?: string };
  authorAttribution?: { displayName?: string };
};

type GoogleStoreDetails = {
  ok?: boolean;
  message?: string;
  phone?: string | null;
  openNow?: boolean | null;
  rating?: number | null;
  userRatingCount?: number | null;
  currentOpeningHours?: string[] | null;
  googleMapsUri?: string | null;
  reviews?: GoogleReview[];
};

declare global {
  interface Window {
    google?: typeof google;
  }
}

function statusLabel(s: StoreDirectoryEntry): string {
  return /opening[_\s]?soon/i.test(String(s.status)) ? "Opening Soon" : "Open";
}

export default function StoresCommandCenterPage() {
  const [stores, setStores] = useState<StoreDirectoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [googleDetails, setGoogleDetails] = useState<Record<string, GoogleStoreDetails>>({});
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [overview, setOverview] = useState<StoresApiResponse["overview"]>();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d: StoresApiResponse) => {
        setStores(d.stores ?? []);
        setOverview(d.overview);
        if ((d.stores ?? []).length) setSelectedId(d.stores[0].id);
      });
  }, []);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
    if (!key || !mapRef.current) return;
    if (window.google?.maps) {
      initMap();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = initMap;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [stores]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      const hay = `${s.name} ${s.mall} ${s.city ?? ""} ${s.state} ${s.stateCode} ${s.region}`.toLowerCase();
      if (query && !hay.includes(query.toLowerCase())) return false;
      if (stateFilter && s.stateCode !== stateFilter) return false;
      if (regionFilter && s.region !== regionFilter) return false;
      const gd = googleDetails[s.id];
      if (openNowOnly && gd?.openNow !== true) return false;
      if (minRating > 0 && Number(gd?.rating ?? 0) < minRating) return false;
      return true;
    });
  }, [stores, query, stateFilter, regionFilter, openNowOnly, minRating, googleDetails]);

  function initMap() {
    if (!mapRef.current || !window.google?.maps) return;
    const gmaps = window.google.maps;
    const center = { lat: 36.7783, lng: -119.4179 };
    const map = new gmaps.Map(mapRef.current, {
      center,
      zoom: 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#101015" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#d4af37" }] },
      ],
    });
    mapObj.current = map;
    drawMarkers();
  }

  function drawMarkers() {
    if (!mapObj.current || !window.google?.maps) return;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];
    const bounds = new window.google.maps.LatLngBounds();
    filtered.forEach((s) => {
      if (typeof s.latitude !== "number" || typeof s.longitude !== "number") return;
      const marker = new window.google.maps.Marker({
        position: { lat: s.latitude, lng: s.longitude },
        map: mapObj.current!,
        title: s.mall,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#d4af37",
          fillOpacity: 1,
          strokeColor: "#111111",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => setSelectedId(s.id));
      markers.current.push(marker);
      bounds.extend(marker.getPosition()!);
    });
    if (!bounds.isEmpty()) mapObj.current.fitBounds(bounds);
  }

  useEffect(() => {
    drawMarkers();
  }, [filtered]);

  const selected = filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selected || googleDetails[selected.id]) return;
    fetch("/api/stores/google-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: selected.id }),
    })
      .then((r) => r.json())
      .then((d) => {
        setGoogleDetails((prev) => ({ ...prev, [selected.id]: d }));
      });
  }, [selected, googleDetails]);

  const states = [...new Set(stores.map((s) => s.stateCode))].sort();
  const regions = [...new Set(stores.map((s) => s.region).filter(Boolean))].sort();
  const selectedGoogle = selected ? googleDetails[selected.id] : null;

  return (
    <PageShell accent="amber">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Stores Command Center"
          title="Store Location Simulator"
          subtitle="Map-first simulator with official directory + live Google data when available."
        />
      </PageShellHeader>
      <PageShellBody>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <LushMetric label="Total Stores" value={String(overview?.totalStores ?? stores.length)} />
          <LushMetric label="Open" value={String(overview?.openNow ?? 0)} accent="emerald" />
          <LushMetric label="Opening Soon" value={String(overview?.openingSoon ?? 0)} accent="amber" />
          <LushMetric label="States Covered" value={String(overview?.statesCovered ?? states.length)} accent="sky" />
          <LushMetric
            label="Avg. Google Rating"
            value={overview?.averageGoogleRating ? overview.averageGoogleRating.toFixed(1) : "N/A"}
            accent="violet"
          />
        </div>

        <LushPanel className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search store, mall, city"
                className="col-span-2 rounded-xl bg-black/25 border border-white/10 px-3 py-2 text-sm"
              />
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="rounded-xl bg-black/25 border border-white/10 px-3 py-2 text-sm"
              >
                <option value="">All States</option>
                {states.map((s) => (
                  <option value={s} key={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="rounded-xl bg-black/25 border border-white/10 px-3 py-2 text-sm"
              >
                <option value="">All Regions</option>
                {regions.map((region) => (
                  <option value={region} key={region}>
                    {region}
                  </option>
                ))}
              </select>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="rounded-xl bg-black/25 border border-white/10 px-3 py-2 text-sm"
              >
                <option value={0}>Any Rating</option>
                <option value={4}>4.0+</option>
                <option value={4.5}>4.5+</option>
              </select>
              <label className="rounded-xl bg-black/25 border border-white/10 px-3 py-2 text-xs flex items-center gap-2">
                <input type="checkbox" checked={openNowOnly} onChange={(e) => setOpenNowOnly(e.target.checked)} />
                Open now
              </label>
            </div>
            <div ref={mapRef} className="w-full h-[58vh] rounded-2xl border border-amber-400/20 overflow-hidden" />
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-black/20 p-4 space-y-3 max-h-[72vh] overflow-y-auto">
            {selected ? (
              <>
                <h3 className="text-lg font-semibold text-amber-200">{selected.mall}</h3>
                <p className="text-sm text-white/75">{selected.fullAddress ?? selected.address}</p>
                <p className="text-sm text-white/80">Status: {statusLabel(selected)}</p>
                <p className="text-sm text-white/80">Region: {selected.region || "N/A"}</p>
                <p className="text-sm text-white/80">Phone: {selectedGoogle?.phone ?? selected.phone ?? "N/A"}</p>
                <p className="text-sm text-white/80">
                  Open now:{" "}
                  {selectedGoogle?.openNow == null ? "Unknown (local fallback in use)" : selectedGoogle.openNow ? "Yes" : "No"}
                </p>
                <p className="text-sm text-white/80">
                  Rating: {selectedGoogle?.rating ? `${selectedGoogle.rating} (${selectedGoogle.userRatingCount ?? 0})` : "N/A"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`} className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-xs">
                      Call
                    </a>
                  )}
                  {selected.email && (
                    <a href={`mailto:${selected.email}`} className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-xs">
                      Email
                    </a>
                  )}
                  {(selectedGoogle?.googleMapsUri ?? selected.googleMapsUrl) && (
                    <a
                      href={selectedGoogle?.googleMapsUri ?? selected.googleMapsUrl ?? "#"}
                      target="_blank"
                      className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-xs"
                    >
                      Directions
                    </a>
                  )}
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(selected.fullAddress ?? selected.address ?? "");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-xs"
                  >
                    Copy Address
                  </button>
                  <button
                    onClick={() =>
                      fetch("/api/stores/google-details", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ storeId: selected.id, forceRefresh: true }),
                      })
                        .then((r) => r.json())
                        .then((d) => setGoogleDetails((prev) => ({ ...prev, [selected.id]: d })))
                    }
                    className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-xs"
                  >
                    Refresh Google Data
                  </button>
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <h4 className="text-sm font-semibold text-amber-200">Opening Hours</h4>
                  {Array.isArray(selectedGoogle?.currentOpeningHours) && selectedGoogle.currentOpeningHours.length > 0 ? (
                    selectedGoogle.currentOpeningHours.slice(0, 7).map((line, idx) => (
                      <p key={idx} className="text-xs text-white/70">
                        {line}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-white/60">Live hours unavailable. Using official local directory data.</p>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <h4 className="text-sm font-semibold text-amber-200">Google Reviews</h4>
                  {Array.isArray(selectedGoogle?.reviews) && selectedGoogle.reviews.length > 0 ? (
                    selectedGoogle.reviews.slice(0, 3).map((r: GoogleReview, i: number) => (
                      <div key={i} className="text-xs text-white/80 bg-white/5 rounded-lg p-2">
                        <p className="font-semibold">
                          {r.authorAttribution?.displayName ?? "Reviewer"} - {r.rating ?? "N/A"}★
                        </p>
                        <p>{r.text?.text ?? "No comment text."}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-white/60">
                      Reviews are not available for this store right now. Showing official local store directory data.
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <h4 className="text-sm font-semibold text-amber-200">Nearest Stores</h4>
                  {selected.nearestStores?.length ? (
                    selected.nearestStores.slice(0, 3).map((n) => (
                      <p key={n.id} className="text-xs text-white/75">
                        {n.name}: {n.distanceMiles} miles
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-white/60">Nearest store distances unavailable for this location.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-white/70">No store matches current filters.</p>
            )}
          </div>
        </LushPanel>
      </PageShellBody>
    </PageShell>
  );
}

