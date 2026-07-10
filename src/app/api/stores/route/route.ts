import { NextRequest, NextResponse } from "next/server";

type RouteBody = {
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
};

function parseCoord(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Driving route between two lat/lng points via public OSRM.
 * Returns GeoJSON-style [lat, lng] positions for Leaflet + distance/duration.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fromLat = parseCoord(sp.get("fromLat"));
  const fromLng = parseCoord(sp.get("fromLng"));
  const toLat = parseCoord(sp.get("toLat"));
  const toLng = parseCoord(sp.get("toLng"));

  if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
    return NextResponse.json(
      { error: "fromLat, fromLng, toLat, toLng are required" },
      { status: 400 }
    );
  }

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Routing service unavailable", fallback: true },
        { status: 502 }
      );
    }
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: [number, number][] };
      }>;
    };

    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      return NextResponse.json(
        { error: "No route found", fallback: true },
        { status: 404 }
      );
    }

    // OSRM returns [lng, lat] — convert to Leaflet [lat, lng]
    const positions = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number]
    );
    const miles = Math.round((route.distance / 1609.344) * 10) / 10;
    const minutes = Math.round(route.duration / 60);

    return NextResponse.json({
      ok: true,
      positions,
      distanceMiles: miles,
      durationMinutes: minutes,
      mode: "driving",
    });
  } catch {
    return NextResponse.json(
      { error: "Routing failed", fallback: true },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: RouteBody = {};
  try {
    body = (await req.json()) as RouteBody;
  } catch {
    /* ignore */
  }
  const url = new URL(req.url);
  if (body.fromLat != null) url.searchParams.set("fromLat", String(body.fromLat));
  if (body.fromLng != null) url.searchParams.set("fromLng", String(body.fromLng));
  if (body.toLat != null) url.searchParams.set("toLat", String(body.toLat));
  if (body.toLng != null) url.searchParams.set("toLng", String(body.toLng));
  return GET(new NextRequest(url));
}
