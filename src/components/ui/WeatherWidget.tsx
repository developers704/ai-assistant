"use client";

import { useEffect, useState } from "react";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudFog,
  CloudLightning,
  CloudDrizzle,
  Loader2,
  MapPin,
} from "lucide-react";
import { Icon as AppIcon, IconBadge } from "@/components/ui/Icon";

interface Weather {
  tempC: number;
  code: number;
  city?: string;
}

const FALLBACK = { lat: 24.8607, lon: 67.0011, label: "Karachi" };

function describe(code: number): { label: string; Icon: typeof Sun } {
  if (code === 0) return { label: "Clear", Icon: Sun };
  if (code <= 2) return { label: "Partly cloudy", Icon: Cloud };
  if (code === 3) return { label: "Overcast", Icon: Cloud };
  if (code <= 48) return { label: "Fog", Icon: CloudFog };
  if (code <= 57) return { label: "Drizzle", Icon: CloudDrizzle };
  if (code <= 67) return { label: "Rain", Icon: CloudRain };
  if (code <= 77) return { label: "Snow", Icon: CloudSnow };
  if (code <= 82) return { label: "Showers", Icon: CloudRain };
  if (code <= 86) return { label: "Snow showers", Icon: CloudSnow };
  return { label: "Thunderstorm", Icon: CloudLightning };
}

async function fetchWeather(lat: number, lon: number, fallbackCity?: string): Promise<Weather> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`
  );
  if (!res.ok) throw new Error("weather fetch failed");
  const data = await res.json();
  let city = fallbackCity;
  try {
    const geo = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (geo.ok) {
      const g = await geo.json();
      city = g.city || g.locality || fallbackCity;
    }
  } catch {
    /* city is optional */
  }
  return {
    tempC: Math.round(data.current.temperature_2m),
    code: data.current.weather_code,
    city,
  };
}

export function WeatherWidget({
  className = "",
  variant = "chip",
}: {
  className?: string;
  variant?: "chip" | "banner";
}) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = (lat: number, lon: number, city?: string) =>
      fetchWeather(lat, lon, city)
        .then((w) => !cancelled && setWeather(w))
        .catch(() => !cancelled && setError(true));

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => load(pos.coords.latitude, pos.coords.longitude),
        () => load(FALLBACK.lat, FALLBACK.lon, FALLBACK.label),
        { timeout: 8000 }
      );
    } else {
      load(FALLBACK.lat, FALLBACK.lon, FALLBACK.label);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null;

  if (!weather) {
    return (
      <div className={`flex items-center gap-2 text-ink-muted text-sm ${className}`}>
        <Loader2 size={15} className="animate-spin" /> Weather...
      </div>
    );
  }

  const { label, Icon: WeatherIcon } = describe(weather.code);

  if (variant === "banner") {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl glass-panel ring-1 ring-sky-400/15 bg-sky-500/5 ${className}`}
      >
        <IconBadge icon={WeatherIcon} iconBg="bg-sky-500/25" iconColor="text-sky-300" size="md" />
        <div className="leading-tight min-w-0">
          <p className="text-sm font-semibold text-ink">
            {weather.tempC}°C <span className="font-normal text-ink-secondary">· {label}</span>
          </p>
          {weather.city && (
            <p className="text-[11px] text-ink-muted flex items-center gap-0.5 mt-0.5">
              <AppIcon icon={MapPin} size="xs" /> {weather.city}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl glass-panel ring-1 ring-white/10 ${className}`}
    >
      <IconBadge icon={WeatherIcon} iconBg="bg-sky-500/25" iconColor="text-sky-300" size="md" />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-ink">
          {weather.tempC}°C <span className="font-normal text-ink-secondary">· {label}</span>
        </p>
        {weather.city && (
          <p className="text-[11px] text-ink-muted flex items-center gap-0.5">
            <AppIcon icon={MapPin} size="xs" /> {weather.city}
          </p>
        )}
      </div>
    </div>
  );
}
