import { NextRequest, NextResponse } from "next/server";
import { getAllStores } from "@/lib/stores/store-directory";
import { canCalculateDistance, haversineMiles } from "@/lib/stores/distance";

export const runtime = "nodejs";

async function geocode(address: string, key: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
  };
  const loc = data.results?.[0]?.geometry?.location;
  if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") return null;
  return { lat: loc.lat, lng: loc.lng };
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  let customer: { lat: number; lng: number } | null =
    lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;

  if (!customer && address) {
    const key = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return NextResponse.json(
        { ok: false, message: "Google key missing. Provide lat/lng or connect GOOGLE_MAPS_SERVER_KEY." },
        { status: 400 }
      );
    }
    customer = await geocode(address, key);
  }

  if (!customer || !Number.isFinite(customer.lat) || !Number.isFinite(customer.lng)) {
    return NextResponse.json({ ok: false, message: "Provide valid customer address or coordinates." }, { status: 400 });
  }

  const ranked = getAllStores()
    .filter(canCalculateDistance)
    .map((store) => ({
      store,
      distanceMiles:
        haversineMiles(
          { latitude: customer!.lat, longitude: customer!.lng },
          { latitude: store.latitude, longitude: store.longitude }
        ) ?? Number.POSITIVE_INFINITY,
    }))
    .filter((x) => Number.isFinite(x.distanceMiles))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, 5)
    .map((x) => ({
      id: x.store.id,
      name: x.store.name,
      mall: x.store.mall,
      city: x.store.city,
      state: x.store.stateCode,
      distanceMiles: Math.round(x.distanceMiles * 10) / 10,
      phone: x.store.phone,
      address: x.store.fullAddress ?? x.store.address,
    }));

  return NextResponse.json({ ok: true, customer, nearest: ranked });
}

