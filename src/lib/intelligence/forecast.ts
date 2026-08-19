import type { ForecastPoint } from "@/lib/analyst/types";

/** Simple Holt linear trend on monthly totals. */
export function forecastMonthly(
  monthly: Array<{ month: string; net: number }>,
  horizon = 3
): { points: ForecastPoint[]; trendPct: number | null; projectedNext: number | null } {
  if (monthly.length < 3) {
    return { points: [], trendPct: null, projectedNext: null };
  }
  const values = monthly.map((m) => m.net);
  const alpha = 0.5;
  const beta = 0.3;
  let level = values[0]!;
  let trend = values.length > 1 ? values[1]! - values[0]! : 0;
  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i]! + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecasts: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    forecasts.push(Math.max(0, level + trend * h));
  }
  const residuals: number[] = [];
  let l2 = values[0]!;
  let t2 = values.length > 1 ? values[1]! - values[0]! : 0;
  for (let i = 1; i < values.length; i++) {
    residuals.push(values[i]! - (l2 + t2));
    const pl = l2;
    l2 = alpha * values[i]! + (1 - alpha) * (l2 + t2);
    t2 = beta * (l2 - pl) + (1 - beta) * t2;
  }
  const sigma = residuals.length
    ? Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / residuals.length)
    : 0;

  const points: ForecastPoint[] = monthly.map((m) => ({
    period: m.month,
    actual: Math.round(m.net * 100) / 100,
    forecast: null,
    lower: null,
    upper: null,
  }));

  const lastMonth = monthly[monthly.length - 1]!.month;
  const [y, mo] = lastMonth.split("-").map(Number);
  for (let h = 0; h < horizon; h++) {
    const total = y! * 12 + (mo! - 1) + h + 1;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    const period = `${ny}-${String(nm).padStart(2, "0")}`;
    const f = forecasts[h]!;
    const band = 1.96 * sigma * Math.sqrt(h + 1);
    points.push({
      period,
      actual: null,
      forecast: Math.round(f * 100) / 100,
      lower: Math.round(Math.max(0, f - band) * 100) / 100,
      upper: Math.round((f + band) * 100) / 100,
    });
  }

  const lastIdx = monthly.length - 1;
  points[lastIdx]!.forecast = points[lastIdx]!.actual;
  points[lastIdx]!.lower = points[lastIdx]!.actual;
  points[lastIdx]!.upper = points[lastIdx]!.actual;

  const prev = values[values.length - 2] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const trendPct = prev > 0 ? ((last - prev) / prev) * 100 : null;

  return {
    points,
    trendPct: trendPct != null ? Math.round(trendPct * 10) / 10 : null,
    projectedNext: forecasts[0] != null ? Math.round(forecasts[0] * 100) / 100 : null,
  };
}
