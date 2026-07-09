"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { StoreDirectoryEntry } from "@/lib/stores/types";
import "leaflet/dist/leaflet.css";

const markerIcon = L.divIcon({
  className: "stores-map-marker",
  html: `<span class="stores-map-pin"></span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

const selectedIcon = L.divIcon({
  className: "stores-map-marker",
  html: `<span class="stores-map-pin stores-map-pin-selected"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

function FitBounds({
  stores,
  selectedId,
}: {
  stores: StoreDirectoryEntry[];
  selectedId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const selected = stores.find((s) => s.id === selectedId);
    if (selected?.latitude != null && selected?.longitude != null) {
      map.flyTo([selected.latitude, selected.longitude], 11, { duration: 0.6 });
      return;
    }

    const points = stores
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => [s.latitude!, s.longitude!] as [number, number]);

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 8 });
  }, [map, stores, selectedId]);

  return null;
}

type StoresMapProps = {
  stores: StoreDirectoryEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function StoresMap({ stores, selectedId, onSelect }: StoresMapProps) {
  const mappable = useMemo(
    () => stores.filter((s) => s.latitude != null && s.longitude != null),
    [stores]
  );

  const center = useMemo((): [number, number] => {
    if (mappable.length === 0) return [36.7783, -119.4179];
    const lat = mappable.reduce((s, r) => s + (r.latitude ?? 0), 0) / mappable.length;
    const lng = mappable.reduce((s, r) => s + (r.longitude ?? 0), 0) / mappable.length;
    return [lat, lng];
  }, [mappable]);

  if (mappable.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08]">
        <p className="text-sm text-white/40">No geocoded store locations yet.</p>
      </div>
    );
  }

  return (
    <div className="stores-map-shell h-full min-h-[320px] overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
      <MapContainer
        center={center}
        zoom={5}
        className="h-full w-full min-h-[320px] z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds stores={mappable} selectedId={selectedId} />
        {mappable.map((store) => (
          <Marker
            key={store.id}
            position={[store.latitude!, store.longitude!]}
            icon={store.id === selectedId ? selectedIcon : markerIcon}
            eventHandlers={{
              click: () => onSelect(store.id),
            }}
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
        ))}
      </MapContainer>
    </div>
  );
}
