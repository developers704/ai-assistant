"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/layout/Sidebar";
import {
  PageShell,
  PageShellHeader,
  PageShellBody,
  LushMetric,
} from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { StoreDirectoryEntry, StoreGoogleReview } from "@/lib/stores/types";
import {
  formatTodayHoursLabel,
  getStoreOpenStatus,
  getWeeklyHoursRows,
} from "@/lib/stores/store-hours";
import { haversineMiles, roundMiles, sortStoresByDistance } from "@/lib/stores/distance";
import {
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  Search,
  Star,
  MessageSquare,
  Route,
  Navigation,
  LocateFixed,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";

const StoresMap = dynamic(
  () => import("@/components/stores/StoresMap").then((m) => m.StoresMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-[1.25rem] bg-violet-500/[0.06] ring-1 ring-violet-400/20">
        <p className="text-sm text-violet-200/50 animate-pulse">Loading map…</p>
      </div>
    ),
  }
);

type StoresApiResponse = {
  source: string;
  lastSyncedAt?: string;
  stores: StoreDirectoryEntry[];
  stats?: {
    total: number;
    open?: number;
    openingSoon?: number;
    byState?: Record<string, number>;
  };
};

type UserLocation = { latitude: number; longitude: number };

type RouteResult = {
  positions: [number, number][];
  distanceMiles: number;
  durationMinutes: number;
  mode: "driving" | "straight";
};

const MY_LOCATION = "__me__";

function statusVariant(store: StoreDirectoryEntry): "success" | "warning" | "default" {
  const status = getStoreOpenStatus(store);
  if (status.listingStatus === "opening_soon") return "warning";
  if (status.isOpenNow === true) return "success";
  if (status.isOpenNow === false) return "default";
  if (status.listingStatus === "open") return "success";
  return "default";
}

function statusLabel(store: StoreDirectoryEntry): string {
  return getStoreOpenStatus(store).label;
}

export default function StoresPage() {
  const [stores, setStores] = useState<StoreDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [distanceFromId, setDistanceFromId] = useState<string>("");
  const [distanceToId, setDistanceToId] = useState<string>("");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ready" | "denied" | "unsupported">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [focusUser, setFocusUser] = useState(false);
  const [focusUserTick, setFocusUserTick] = useState(0);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d: StoresApiResponse) => {
        const list = Array.isArray(d.stores) ? d.stores : [];
        setStores(list);
        const firstMapped = list.find((s) => s.latitude != null && s.longitude != null);
        if (firstMapped) setSelectedId(firstMapped.id);
      })
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDistanceFromId((prev) => prev || selectedId);
  }, [selectedId]);

  const requestLocation = useCallback((opts?: { recenter?: boolean }) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported");
      setGeoError("This browser does not support location.");
      return;
    }
    // Secure context required (https or localhost)
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoStatus("denied");
      setGeoError("Location needs HTTPS (or localhost). Open the app over a secure URL.");
      return;
    }
    setGeoStatus("loading");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGeoStatus("ready");
        if (opts?.recenter !== false) {
          setFocusUser(true);
          setFocusUserTick((t) => t + 1);
        }
      },
      (err) => {
        setGeoStatus("denied");
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("Location permission denied — allow it in the browser address bar, then try again.");
        } else if (err.code === err.TIMEOUT) {
          setGeoError("Location timed out — try again outdoors or with Wi‑Fi.");
        } else {
          setGeoError("Could not get your location. Try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30_000 }
    );
  }, []);

  const states = useMemo(() => {
    const set = new Set(stores.map((s) => s.stateCode).filter(Boolean));
    return [...set].sort();
  }, [stores]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((s) => {
      if (stateFilter && s.stateCode !== stateFilter) return false;
      if (!q) return true;
      const hay = [
        s.name,
        s.mall,
        s.city,
        s.state,
        s.stateCode,
        s.address,
        s.phone,
        ...(s.aliases ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [stores, query, stateFilter]);

  const selected = stores.find((s) => s.id === selectedId) ?? null;
  const openNowCount = stores.filter((s) => getStoreOpenStatus(s).isOpenNow === true).length;
  const soonCount = stores.filter((s) => /soon/i.test(s.status)).length;
  const mappedCount = stores.filter((s) => s.latitude != null && s.longitude != null).length;

  const routeFromUser = distanceFromId === MY_LOCATION;
  const fromStore = stores.find((s) => s.id === distanceFromId) ?? null;
  const toStore = stores.find((s) => s.id === distanceToId) ?? null;

  const straightMiles = useMemo(() => {
    if (!distanceToId) return null;
    if (routeFromUser) {
      if (!userLocation || !toStore) return null;
      return roundMiles(haversineMiles(userLocation, toStore));
    }
    if (!fromStore || !toStore || distanceFromId === distanceToId) return null;
    return roundMiles(haversineMiles(fromStore, toStore));
  }, [routeFromUser, userLocation, fromStore, toStore, distanceFromId, distanceToId]);

  const distanceToSelected = useMemo(() => {
    if (!userLocation || !selected) return null;
    return roundMiles(haversineMiles(userLocation, selected));
  }, [userLocation, selected]);

  const nearestFromMe = useMemo(() => {
    if (!userLocation) return [];
    return sortStoresByDistance(userLocation, stores).slice(0, 3);
  }, [userLocation, stores]);

  // Fetch driving route when A + B are set
  useEffect(() => {
    let cancelled = false;

    const start =
      routeFromUser && userLocation
        ? userLocation
        : fromStore?.latitude != null && fromStore?.longitude != null
          ? { latitude: fromStore.latitude, longitude: fromStore.longitude }
          : null;
    const end =
      toStore?.latitude != null && toStore?.longitude != null
        ? { latitude: toStore.latitude, longitude: toStore.longitude }
        : null;

    if (!start || !end || (distanceFromId && distanceFromId === distanceToId && !routeFromUser)) {
      setRouteResult(null);
      return;
    }

    setRouteLoading(true);
    const qs = new URLSearchParams({
      fromLat: String(start.latitude),
      fromLng: String(start.longitude),
      toLat: String(end.latitude),
      toLng: String(end.longitude),
    });

    fetch(`/api/stores/route?${qs}`)
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (data.ok && Array.isArray(data.positions) && data.positions.length >= 2) {
          setRouteResult({
            positions: data.positions,
            distanceMiles: data.distanceMiles,
            durationMinutes: data.durationMinutes,
            mode: "driving",
          });
        } else if (straightMiles != null) {
          setRouteResult({
            positions: [
              [start.latitude, start.longitude],
              [end.latitude, end.longitude],
            ],
            distanceMiles: straightMiles,
            durationMinutes: 0,
            mode: "straight",
          });
        } else {
          setRouteResult(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (straightMiles != null) {
          setRouteResult({
            positions: [
              [start.latitude, start.longitude],
              [end.latitude, end.longitude],
            ],
            distanceMiles: straightMiles,
            durationMinutes: 0,
            mode: "straight",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    routeFromUser,
    userLocation,
    fromStore,
    toStore,
    distanceFromId,
    distanceToId,
    straightMiles,
  ]);

  const storeOptions = useMemo(
    () =>
      [...stores].sort((a, b) => (a.mall || a.name).localeCompare(b.mall || b.name)),
    [stores]
  );

  const displayMiles = routeResult?.distanceMiles ?? straightMiles;
  const displayMode = routeResult?.mode ?? (straightMiles != null ? "straight" : null);

  const handleSelectStore = (id: string) => {
    setSelectedId(id);
    setFocusUser(false);
  };

  const setAsDestination = (id: string) => {
    setDistanceToId(id);
    setSelectedId(id);
    if (!distanceFromId) {
      setDistanceFromId(userLocation ? MY_LOCATION : id);
    }
  };

  return (
    <PageShell accent="violet">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Locations"
          title="Stores Map & Info"
          subtitle="Find stores · drive routes · distance from you"
          action={
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  if (geoStatus === "ready" && userLocation) {
                    setFocusUser(true);
                    setFocusUserTick((t) => t + 1);
                  } else {
                    requestLocation({ recenter: true });
                  }
                }}
                disabled={geoStatus === "loading"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all",
                  geoStatus === "ready"
                    ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40"
                    : "bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/35 hover:bg-violet-500/30"
                )}
              >
                {geoStatus === "loading" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <LocateFixed size={13} />
                )}
                {geoStatus === "ready"
                  ? "Show my location"
                  : geoStatus === "denied" || geoStatus === "unsupported"
                    ? "Retry location"
                    : "Use my location"}
              </button>
              {stores.length > 0 && (
                <Badge variant="success">{stores.length} locations</Badge>
              )}
            </div>
          }
        />
      </PageShellHeader>

      <PageShellBody>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <LushMetric label="Total stores" value={String(stores.length || "—")} accent="violet" />
          <LushMetric
            label="Open now"
            value={String(openNowCount)}
            accent="emerald"
            footer={
              <p className="text-sm text-white/35">By each store&apos;s US local time</p>
            }
          />
          <LushMetric
            label="On map"
            value={`${mappedCount}`}
            footer={
              <p className="text-sm text-white/35">
                {soonCount > 0 ? `${soonCount} opening soon` : "Geocoded pins"}
              </p>
            }
          />
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300/50"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mall, city, phone…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white/[0.04] ring-1 ring-white/10 text-ink placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/35"
            />
          </div>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="select-dark px-3 py-2.5 rounded-xl text-sm"
            aria-label="Filter by state"
          >
            <option value="">All states</option>
            {states.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Route planner */}
        {!loading && stores.length > 0 && (
          <div className="stores-route-card rounded-[1.25rem] p-[1px]">
            <div className="rounded-[1.2rem] bg-[#0b0a14]/90 backdrop-blur-xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-400/30">
                    <Route size={15} className="text-violet-200" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-200/70">
                      Route &amp; distance
                    </p>
                    <p className="text-[11px] text-white/35">
                      Pick A → B — map draws the drive path
                    </p>
                  </div>
                </div>
                {displayMiles != null && (
                  <div className="rounded-xl bg-violet-500/15 ring-1 ring-violet-400/30 px-4 py-2 text-center min-w-[6.5rem]">
                    {routeLoading ? (
                      <Loader2 size={16} className="mx-auto animate-spin text-violet-200" />
                    ) : (
                      <>
                        <p className="text-xl font-semibold text-violet-100 tabular-nums leading-none">
                          {displayMiles}
                          <span className="text-sm font-medium ml-1">mi</span>
                        </p>
                        <p className="text-[10px] text-violet-200/50 mt-1">
                          {displayMode === "driving"
                            ? routeResult?.durationMinutes
                              ? `~${routeResult.durationMinutes} min drive`
                              : "driving"
                            : "straight-line"}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-end">
                <label className="block min-w-0">
                  <span className="text-[11px] text-violet-200/45 mb-1.5 flex items-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold text-white">
                      A
                    </span>
                    From
                  </span>
                  <select
                    value={distanceFromId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === MY_LOCATION && geoStatus !== "ready") {
                        requestLocation();
                      }
                      setDistanceFromId(v);
                    }}
                    className="select-dark w-full px-3 py-2.5 rounded-xl text-sm"
                  >
                    <option value="">Select start…</option>
                    <option value={MY_LOCATION}>
                      {geoStatus === "ready" ? "📍 My location" : "📍 My location (enable)"}
                    </option>
                    {storeOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.mall || s.name}
                        {s.city ? ` · ${s.city}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="hidden sm:flex items-center justify-center pb-2.5 text-violet-300/40">
                  <ArrowRight size={18} />
                </div>

                <label className="block min-w-0">
                  <span className="text-[11px] text-violet-200/45 mb-1.5 flex items-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-500 text-[9px] font-bold text-white">
                      B
                    </span>
                    To
                  </span>
                  <select
                    value={distanceToId}
                    onChange={(e) => setDistanceToId(e.target.value)}
                    className="select-dark w-full px-3 py-2.5 rounded-xl text-sm"
                  >
                    <option value="">Select destination…</option>
                    {storeOptions.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={!routeFromUser && s.id === distanceFromId}
                      >
                        {s.mall || s.name}
                        {s.city ? ` · ${s.city}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {geoError && (
                <p className="mt-3 text-xs text-rose-300/90">{geoError}</p>
              )}

              {geoStatus === "ready" && userLocation && nearestFromMe[0] && (
                <p className="mt-3 text-xs text-cyan-200/70">
                  You&apos;re on the map
                  {nearestFromMe[0].distanceMiles >= 100
                    ? ` · ~${Math.round(nearestFromMe[0].distanceMiles).toLocaleString()} mi from nearest Valliani store`
                    : ` · nearest store ${nearestFromMe[0].distanceMiles} mi away`}
                  . Tap <span className="text-cyan-100 font-medium">Show my location</span> anytime to fly there.
                </p>
              )}

              {nearestFromMe.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-[11px] text-white/35 self-center">Nearest to you:</span>
                  {nearestFromMe.map(({ store, distanceMiles }) => (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => {
                        setDistanceFromId(MY_LOCATION);
                        setDistanceToId(store.id);
                        setSelectedId(store.id);
                      }}
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-400/25 hover:bg-cyan-500/20 transition-colors"
                    >
                      {store.mall || store.name} · {distanceMiles} mi
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-ink-muted animate-pulse">Loading stores…</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] gap-4 sm:gap-5">
            {/* Map hero */}
            <div className="relative h-[min(58vh,32rem)] xl:h-auto xl:min-h-[36rem] xl:sticky xl:top-4">
              <StoresMap
                stores={filtered}
                selectedId={selectedId}
                onSelect={handleSelectStore}
                routeFromId={routeFromUser ? null : distanceFromId || null}
                routeToId={distanceToId || null}
                routeFromUser={routeFromUser}
                userLocation={userLocation}
                routePositions={routeResult?.positions ?? null}
                focusUser={focusUser}
                focusUserTick={focusUserTick}
              />

              {/* Floating distance chip on map */}
              {displayMiles != null && distanceToId && (
                <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-[500]">
                  <div className="pointer-events-auto rounded-full bg-[#0b0a14]/92 backdrop-blur-xl px-4 py-2 ring-1 ring-violet-400/40 shadow-[0_8px_32px_rgba(139,92,246,0.35)] flex items-center gap-2">
                    <Navigation size={14} className="text-violet-300" />
                    <span className="text-sm font-semibold text-white tabular-nums">
                      {displayMiles} mi
                    </span>
                    <span className="text-[11px] text-violet-200/55">
                      {displayMode === "driving" ? "drive" : "line"}
                      {routeResult?.durationMinutes
                        ? ` · ~${routeResult.durationMinutes} min`
                        : ""}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Detail + list */}
            <div className="flex flex-col gap-4 min-h-0">
              {selected && (
                <StoreDetailCard
                  store={selected}
                  distanceFromUser={distanceToSelected}
                  onRouteFromMe={() => {
                    if (geoStatus !== "ready") requestLocation();
                    setDistanceFromId(MY_LOCATION);
                    setDistanceToId(selected.id);
                  }}
                  onSetAsB={() => setAsDestination(selected.id)}
                />
              )}

              <div className="rounded-[1.25rem] ring-1 ring-violet-400/15 bg-white/[0.025] overflow-hidden flex flex-col min-h-0 max-h-[min(42vh,24rem)] xl:max-h-none xl:flex-1">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-200/50">
                    Store list
                  </p>
                  <span className="text-[11px] text-white/35">{filtered.length}</span>
                </div>
                <ul className="overflow-y-auto divide-y divide-white/5 flex-1">
                  {filtered.map((store) => {
                    const active = store.id === selectedId;
                    const fromMe =
                      userLocation &&
                      roundMiles(haversineMiles(userLocation, store));
                    return (
                      <li key={store.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectStore(store.id)}
                          className={cn(
                            "w-full text-left px-4 py-3 transition-colors",
                            active
                              ? "bg-violet-500/20"
                              : "hover:bg-violet-500/[0.08]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink truncate">
                                {store.mall || store.name}
                              </p>
                              <p className="text-xs text-white/40 mt-0.5 truncate">
                                {[store.city, store.stateCode].filter(Boolean).join(", ")}
                                {typeof store.googleRating === "number" && (
                                  <span className="text-amber-300/80 ml-1.5">
                                    · {store.googleRating.toFixed(1)}★
                                  </span>
                                )}
                                {fromMe != null && (
                                  <span className="text-cyan-300/70 ml-1.5">
                                    · {fromMe} mi away
                                  </span>
                                )}
                              </p>
                            </div>
                            <Badge variant={statusVariant(store)} className="shrink-0 text-[10px]">
                              {statusLabel(store)}
                            </Badge>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {filtered.length === 0 && (
                    <li className="px-4 py-8 text-center text-sm text-white/35">
                      No stores match your search.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </PageShellBody>
    </PageShell>
  );
}

function StoreDetailCard({
  store,
  distanceFromUser,
  onRouteFromMe,
  onSetAsB,
}: {
  store: StoreDirectoryEntry;
  distanceFromUser: number | null;
  onRouteFromMe: () => void;
  onSetAsB: () => void;
}) {
  const openStatus = getStoreOpenStatus(store);
  const hoursLabel = formatTodayHoursLabel(store);
  const weeklyHours = getWeeklyHoursRows(store);
  const [openReview, setOpenReview] = useState<StoreGoogleReview | null>(null);

  useEffect(() => {
    if (!openReview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenReview(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openReview]);

  return (
    <div className="rounded-[1.25rem] ring-1 ring-violet-400/20 bg-gradient-to-b from-violet-500/[0.08] to-white/[0.02] p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/45 mb-1">
            Selected store
          </p>
          <h2 className="text-lg font-semibold text-ink leading-snug">
            {store.mall || store.name}
          </h2>
          <p className="text-sm text-white/45 mt-0.5">
            {[store.city, store.state].filter(Boolean).join(", ")}
          </p>
        </div>
        <Badge variant={statusVariant(store)}>{openStatus.label}</Badge>
      </div>

      {distanceFromUser != null && (
        <div className="flex items-center gap-2 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-400/25 px-3 py-2">
          <LocateFixed size={14} className="text-cyan-300 shrink-0" />
          <p className="text-sm text-cyan-100">
            <span className="font-semibold tabular-nums">{distanceFromUser} mi</span>
            <span className="text-cyan-200/60 ml-1.5">from your location</span>
          </p>
        </div>
      )}

      {(store.address || store.fullAddress) && (
        <p className="flex items-start gap-2 text-sm text-white/70">
          <MapPin size={15} className="text-violet-300/80 shrink-0 mt-0.5" />
          <span>{store.fullAddress || store.address}</span>
        </p>
      )}

      {store.phone && (
        <a
          href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
          className="flex items-center gap-2 text-sm text-emerald-300/90 hover:text-emerald-200 transition-colors"
        >
          <Phone size={15} className="shrink-0" />
          {store.phone}
        </a>
      )}

      {hoursLabel && (
        <p className="flex items-start gap-2 text-sm text-white/60">
          <Clock size={15} className="text-amber-300/70 shrink-0 mt-0.5" />
          <span>{hoursLabel}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRouteFromMe}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/35 hover:bg-violet-500/35 transition-all"
        >
          <Navigation size={13} />
          Route from me
        </button>
        <button
          type="button"
          onClick={onSetAsB}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold bg-white/[0.06] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.1] transition-all"
        >
          Set as B
        </button>
      </div>

      {weeklyHours.some((row) => row.hours) && (
        <div className="rounded-xl bg-white/[0.025] ring-1 ring-white/[0.06] overflow-hidden">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/35 border-b border-white/5">
            Hours this week · {openStatus.tzLabel}
          </p>
          <ul className="divide-y divide-white/5">
            {weeklyHours.map((row) => (
              <li
                key={row.key}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-1.5 text-sm",
                  row.isToday ? "bg-violet-500/15" : ""
                )}
              >
                <span
                  className={cn(
                    "text-white/50",
                    row.isToday && "text-violet-200 font-medium"
                  )}
                >
                  {row.label}
                  {row.isToday ? " · Today" : ""}
                </span>
                <span
                  className={cn(
                    "tabular-nums text-white/70",
                    row.isToday && "text-violet-100 font-medium"
                  )}
                >
                  {row.hours ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/30">
            <Star size={11} className="text-amber-300/80" /> Rating
          </p>
          {typeof store.googleRating === "number" ? (
            <p className="text-sm font-semibold text-amber-200 mt-1 tabular-nums">
              {store.googleRating.toFixed(1)}
              <span className="text-white/35 font-normal text-xs ml-1.5">/ 5</span>
            </p>
          ) : (
            <p className="text-xs text-white/40 mt-1">Not synced yet</p>
          )}
        </div>
        <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/30">
            <MessageSquare size={11} /> Reviews
          </p>
          {typeof store.googleReviewCount === "number" ? (
            <p className="text-sm font-semibold text-ink mt-1 tabular-nums">
              {store.googleReviewCount.toLocaleString()}
            </p>
          ) : (
            <p className="text-xs text-white/40 mt-1">Not synced yet</p>
          )}
        </div>
      </div>

      {store.googleReviews && store.googleReviews.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Recent Google reviews
            </p>
            <p className="text-[10px] text-white/30 shrink-0">Newest first</p>
          </div>
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {[...store.googleReviews]
              .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
              .map((review, i) => (
              <li key={`${review.authorName}-${review.time ?? i}`}>
                <button
                  type="button"
                  onClick={() => setOpenReview(review)}
                  className="w-full text-left rounded-xl bg-white/[0.025] ring-1 ring-white/[0.06] px-3 py-2.5 hover:bg-white/[0.05] hover:ring-white/12 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-white/80 truncate">
                      {review.authorName}
                    </p>
                    <span className="text-[11px] text-amber-300/90 tabular-nums shrink-0">
                      {"★".repeat(Math.round(review.rating))}
                      <span className="text-white/30 ml-1">{review.rating}</span>
                    </span>
                  </div>
                  {review.text && (
                    <p className="text-xs text-white/50 leading-relaxed line-clamp-3">
                      {review.text}
                    </p>
                  )}
                  {review.relativeTime && (
                    <p className="text-[10px] text-white/30 mt-1">{review.relativeTime}</p>
                  )}
                  {review.text && review.text.length > 140 && (
                    <p className="text-[10px] font-semibold text-violet-300/80 mt-1.5">
                      Tap to read full review
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {typeof store.googleReviewCount === "number" &&
            store.googleReviewCount > store.googleReviews.length && (
              <p className="text-[10px] text-white/35 leading-relaxed">
                Showing {store.googleReviews.length} of{" "}
                {store.googleReviewCount.toLocaleString()} (Google Places max is 5).
              </p>
            )}
        </div>
      )}

      {openReview &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label={`Review by ${openReview.authorName}`}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              aria-label="Close review"
              onClick={() => setOpenReview(null)}
            />
            <div className="relative z-10 flex w-full max-w-xl max-h-[min(88vh,720px)] flex-col overflow-hidden rounded-2xl bg-[#1a2230] ring-1 ring-white/15 shadow-2xl">
              <div className="shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-white/10">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35 mb-1">
                    Full review
                  </p>
                  <p className="text-base font-semibold text-ink truncate">
                    {openReview.authorName}
                  </p>
                  <p className="text-sm text-amber-300/90 mt-1 tabular-nums">
                    {"★".repeat(Math.round(openReview.rating))}
                    <span className="text-white/40 ml-1.5">{openReview.rating} / 5</span>
                  </p>
                  {openReview.relativeTime && (
                    <p className="text-xs text-white/40 mt-1">{openReview.relativeTime}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenReview(null)}
                  className="shrink-0 rounded-full p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4">
                <p className="text-sm sm:text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap break-words">
                  {openReview.text || "No written review."}
                </p>
              </div>
              <div className="shrink-0 flex justify-end px-5 sm:px-6 py-3 border-t border-white/10 bg-[#151c28]">
                <Button size="sm" variant="secondary" onClick={() => setOpenReview(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <div className="flex flex-wrap gap-2 pt-1">
        {(store.googleMapsPlaceUrl || store.googleMapsUrl) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              window.open(
                store.googleMapsPlaceUrl || store.googleMapsUrl!,
                "_blank",
                "noopener,noreferrer"
              )
            }
          >
            <ExternalLink size={14} className="mr-1.5" />
            Google Maps
          </Button>
        )}
        {store.appleMapsUrl && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(store.appleMapsUrl!, "_blank", "noopener,noreferrer")}
          >
            Apple Maps
          </Button>
        )}
      </div>
    </div>
  );
}
