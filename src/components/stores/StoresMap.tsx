"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { StoreDirectoryEntry } from "@/lib/stores/types";
import "leaflet/dist/leaflet.css";

const pinHtml = (tone: "default" | "selected" | "a" | "b") => {
  const cls =
    tone === "selected"
      ? "stores-map-pin stores-map-pin-selected"
      : tone === "a"
        ? "stores-map-pin stores-map-pin-a"
        : tone === "b"
          ? "stores-map-pin stores-map-pin-b"
          : "stores-map-pin";
  const label =
    tone === "a" ? `<span class="stores-map-pin-label">A</span>` : tone === "b" ? `<span class="stores-map-pin-label">B</span>` : "";
  return `<span class="${cls}">${label}</span>`;
};

const iconFor = (tone: "default" | "selected" | "a" | "b") =>
  L.divIcon({
    className: "stores-map-marker",
    html: pinHtml(tone),
    iconSize: tone === "default" ? [22, 22] : [30, 30],
    iconAnchor: tone === "default" ? [11, 11] : [15, 15],
    popupAnchor: [0, -14],
  });

const markerIcon = iconFor("default");
const selectedIcon = iconFor("selected");
const pinAIcon = iconFor("a");
const pinBIcon = iconFor("b");

/** Leaflet must remeasure after the shell gets a fixed height (avoids grey/blank tiles). */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize({ animate: false });
    run();
    const t = window.setTimeout(run, 120);
    window.addEventListener("resize", run);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", run);
    };
  }, [map]);
  return null;
}

function FitView({
  stores,
  selectedId,
  routePositions,
  userLocation,
  focusRoute,
  focusUser,
  focusUserTick,
}: {
  stores: StoreDirectoryEntry[];
  selectedId: string | null;
  routePositions: [number, number][] | null;
  userLocation: { latitude: number; longitude: number } | null;
  focusRoute: boolean;
  /** When true, center on the user (e.g. just enabled location) */
  focusUser: boolean;
  focusUserTick: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (focusRoute && routePositions && routePositions.length >= 2) {
      const bounds = L.latLngBounds(routePositions);
      if (userLocation) {
        bounds.extend([userLocation.latitude, userLocation.longitude]);
      }
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 12, animate: true });
      return;
    }

    // Just got location (or user tapped "show me") — fly there even if far from US stores
    if (focusUser && userLocation) {
      map.flyTo([userLocation.latitude, userLocation.longitude], 12, { duration: 0.8 });
      return;
    }

    const selected = stores.find((s) => s.id === selectedId);
    if (selected?.latitude != null && selected?.longitude != null) {
      map.flyTo([selected.latitude, selected.longitude], 11, { duration: 0.55 });
      return;
    }

    const points = stores
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => [s.latitude!, s.longitude!] as [number, number]);

    if (userLocation) {
      points.push([userLocation.latitude, userLocation.longitude]);
    }

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 8 });
  }, [map, stores, selectedId, routePositions, userLocation, focusRoute, focusUser, focusUserTick]);

  return null;
}

export type StoresMapProps = {
  stores: StoreDirectoryEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Store A for route */
  routeFromId?: string | null;
  /** Store B for route */
  routeToId?: string | null;
  /** When routing from user location instead of a store */
  routeFromUser?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  /** Driving path [lat,lng][] from OSRM — falls back to straight line */
  routePositions?: [number, number][] | null;
  /** Fly map to user location (Pakistan, etc.) */
  focusUser?: boolean;
  /** Increment to re-trigger fly-to-user */
  focusUserTick?: number;
};

export function StoresMap({
  stores,
  selectedId,
  onSelect,
  routeFromId = null,
  routeToId = null,
  routeFromUser = false,
  userLocation = null,
  routePositions = null,
  focusUser = false,
  focusUserTick = 0,
}: StoresMapProps) {
  const mappable = useMemo(
    () => stores.filter((s) => s.latitude != null && s.longitude != null),
    [stores]
  );

  const fromStore = mappable.find((s) => s.id === routeFromId) ?? null;
  const toStore = mappable.find((s) => s.id === routeToId) ?? null;

  const linePositions = useMemo((): [number, number][] | null => {
    if (routePositions && routePositions.length >= 2) return routePositions;

    const start: [number, number] | null = routeFromUser
      ? userLocation
        ? [userLocation.latitude, userLocation.longitude]
        : null
      : fromStore?.latitude != null && fromStore?.longitude != null
        ? [fromStore.latitude, fromStore.longitude]
        : null;

    const end: [number, number] | null =
      toStore?.latitude != null && toStore?.longitude != null
        ? [toStore.latitude, toStore.longitude]
        : null;

    if (!start || !end) return null;
    return [start, end];
  }, [routePositions, routeFromUser, userLocation, fromStore, toStore]);

  const focusRoute = Boolean(linePositions && linePositions.length >= 2);

  const center = useMemo((): [number, number] => {
    if (mappable.length === 0) return [36.7783, -119.4179];
    const lat = mappable.reduce((s, r) => s + (r.latitude ?? 0), 0) / mappable.length;
    const lng = mappable.reduce((s, r) => s + (r.longitude ?? 0), 0) / mappable.length;
    return [lat, lng];
  }, [mappable]);

  if (mappable.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center rounded-[1.25rem] bg-violet-500/[0.06] ring-1 ring-violet-400/20">
        <p className="text-sm text-white/40">No geocoded store locations yet.</p>
      </div>
    );
  }

  return (
    <div className="stores-map-shell absolute inset-0 h-full w-full overflow-hidden rounded-[1.25rem] ring-1 ring-violet-400/25 shadow-[0_0_40px_rgba(139,92,246,0.15)]">
      <MapContainer
        center={center}
        zoom={5}
        className="h-full w-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <InvalidateOnResize />
        <FitView
          stores={mappable}
          selectedId={focusRoute || focusUser ? null : selectedId}
          routePositions={linePositions}
          userLocation={userLocation}
          focusRoute={focusRoute}
          focusUser={focusUser && !focusRoute}
          focusUserTick={focusUserTick}
        />

        {linePositions && linePositions.length >= 2 && (
          <>
            <Polyline
              positions={linePositions}
              pathOptions={{
                color: "#a78bfa",
                weight: 6,
                opacity: 0.25,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={linePositions}
              pathOptions={{
                color: "#c4b5fd",
                weight: 3.5,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        )}

        {userLocation && (
          <>
            <CircleMarker
              center={[userLocation.latitude, userLocation.longitude]}
              radius={28}
              pathOptions={{
                color: "#06b6d4",
                fillColor: "#22d3ee",
                fillOpacity: 0.15,
                weight: 1.5,
                opacity: 0.55,
              }}
            />
            <CircleMarker
              center={[userLocation.latitude, userLocation.longitude]}
              radius={9}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#06b6d4",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">You are here</p>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {mappable.map((store) => {
          const isA = !routeFromUser && store.id === routeFromId;
          const isB = store.id === routeToId;
          const isSelected = store.id === selectedId && !isA && !isB;
          const icon = isA
            ? pinAIcon
            : isB
              ? pinBIcon
              : isSelected
                ? selectedIcon
                : markerIcon;

          return (
            <Marker
              key={store.id}
              position={[store.latitude!, store.longitude!]}
              icon={icon}
              eventHandlers={{
                click: () => onSelect(store.id),
              }}
              zIndexOffset={isA || isB || isSelected ? 500 : 0}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">{store.mall || store.name}</p>
                  <p className="text-slate-600 text-xs mt-0.5">
                    {[store.city, store.stateCode].filter(Boolean).join(", ")}
                  </p>
                  {store.phone && (
                    <p className="text-slate-700 text-xs mt-1">{store.phone}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
