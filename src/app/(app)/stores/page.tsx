"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { StoreDirectoryEntry } from "@/lib/stores/types";
import {
  formatTodayHoursLabel,
  getStoreOpenStatus,
  getWeeklyHoursRows,
} from "@/lib/stores/store-hours";
import { haversineMiles } from "@/lib/stores/distance";
import {
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  Search,
  Star,
  MessageSquare,
  Route,
} from "lucide-react";

const StoresMap = dynamic(
  () => import("@/components/stores/StoresMap").then((m) => m.StoresMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08]">
        <p className="text-sm text-white/40 animate-pulse">Loading map…</p>
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

  const distanceMiles = useMemo(() => {
    if (!distanceFromId || !distanceToId || distanceFromId === distanceToId) return null;
    const from = stores.find((s) => s.id === distanceFromId);
    const to = stores.find((s) => s.id === distanceToId);
    if (!from || !to) return null;
    const miles = haversineMiles(from, to);
    return miles == null ? null : Math.round(miles * 10) / 10;
  }, [stores, distanceFromId, distanceToId]);

  const storeOptions = useMemo(
    () =>
      [...stores].sort((a, b) =>
        (a.mall || a.name).localeCompare(b.mall || b.name)
      ),
    [stores]
  );

  return (
    <PageShell accent="sky">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Locations"
          title="Stores Map & Info"
          subtitle="Valliani Jewelers locations · Google ratings & reviews"
          action={
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {stores.length > 0 && (
                <Badge variant="success">{stores.length} locations</Badge>
              )}
            </div>
          }
        />
      </PageShellHeader>

      <PageShellBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <LushMetric label="Total stores" value={String(stores.length || "—")} accent="sky" />
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

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mall, city, phone…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white/[0.04] ring-1 ring-white/10 text-ink placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
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

        {!loading && stores.length > 0 && (
          <div className="rounded-2xl ring-1 ring-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Route size={15} className="text-sky-300/80" />
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Distance between stores
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 sm:gap-3 items-end">
              <label className="block min-w-0">
                <span className="text-[11px] text-white/40 mb-1 block">From</span>
                <select
                  value={distanceFromId}
                  onChange={(e) => setDistanceFromId(e.target.value)}
                  className="select-dark w-full px-3 py-2.5 rounded-xl text-sm"
                >
                  <option value="">Select store…</option>
                  {storeOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.mall || s.name}
                      {s.city ? ` · ${s.city}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <span className="hidden sm:block text-white/30 pb-2.5 text-center">→</span>
              <label className="block min-w-0">
                <span className="text-[11px] text-white/40 mb-1 block">To</span>
                <select
                  value={distanceToId}
                  onChange={(e) => setDistanceToId(e.target.value)}
                  className="select-dark w-full px-3 py-2.5 rounded-xl text-sm"
                >
                  <option value="">Select store…</option>
                  {storeOptions.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id === distanceFromId}>
                      {s.mall || s.name}
                      {s.city ? ` · ${s.city}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl bg-sky-500/10 ring-1 ring-sky-400/20 px-4 py-2.5 min-w-[7.5rem] text-center">
                {distanceMiles != null ? (
                  <>
                    <p className="text-lg font-semibold text-sky-200 tabular-nums leading-none">
                      {distanceMiles}
                      <span className="text-sm font-medium ml-1">mi</span>
                    </p>
                    <p className="text-[10px] text-white/35 mt-1">straight-line</p>
                  </>
                ) : distanceFromId && distanceToId && distanceFromId === distanceToId ? (
                  <p className="text-xs text-white/40">Same store</p>
                ) : distanceFromId && distanceToId ? (
                  <p className="text-xs text-white/40">Need map pins</p>
                ) : (
                  <p className="text-xs text-white/40">Pick both</p>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-ink-muted animate-pulse">Loading stores…</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] gap-4 sm:gap-5 min-h-[28rem]">
            <div className="h-[min(52vh,28rem)] xl:h-auto xl:min-h-[28rem]">
              <StoresMap
                stores={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>

            <div className="flex flex-col gap-4 min-h-0">
              {selected && (
                <StoreDetailCard store={selected} />
              )}

              <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.025] overflow-hidden flex flex-col min-h-0 max-h-[min(40vh,22rem)] xl:max-h-none xl:flex-1">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Store list
                  </p>
                  <span className="text-[11px] text-white/35">{filtered.length}</span>
                </div>
                <ul className="overflow-y-auto divide-y divide-white/5 flex-1">
                  {filtered.map((store) => {
                    const active = store.id === selectedId;
                    return (
                      <li key={store.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(store.id)}
                          className={cn(
                            "w-full text-left px-4 py-3 transition-colors",
                            active ? "bg-sky-500/15" : "hover:bg-white/[0.04]"
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
                                    {typeof store.googleReviewCount === "number"
                                      ? ` (${store.googleReviewCount})`
                                      : ""}
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

function StoreDetailCard({ store }: { store: StoreDirectoryEntry }) {
  const openStatus = getStoreOpenStatus(store);
  const hoursLabel = formatTodayHoursLabel(store);
  const weeklyHours = getWeeklyHoursRows(store);

  return (
    <div className="rounded-2xl ring-1 ring-white/[0.08] bg-white/[0.03] p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35 mb-1">
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

      {(store.address || store.fullAddress) && (
        <p className="flex items-start gap-2 text-sm text-white/70">
          <MapPin size={15} className="text-sky-300/80 shrink-0 mt-0.5" />
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
                  row.isToday ? "bg-amber-500/10" : ""
                )}
              >
                <span
                  className={cn(
                    "text-white/50",
                    row.isToday && "text-amber-200/90 font-medium"
                  )}
                >
                  {row.label}
                  {row.isToday ? " · Today" : ""}
                </span>
                <span
                  className={cn(
                    "tabular-nums text-white/70",
                    row.isToday && "text-amber-100 font-medium"
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
              <span className="text-white/35 font-normal text-xs ml-1.5">
                / 5
              </span>
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Recent Google reviews
          </p>
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {store.googleReviews.slice(0, 3).map((review, i) => (
              <li
                key={`${review.authorName}-${i}`}
                className="rounded-xl bg-white/[0.025] ring-1 ring-white/[0.06] px-3 py-2.5"
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
              </li>
            ))}
          </ul>
        </div>
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
