/**
 * Deterministic forecasting on time series aggregated by DuckDB.
 * Holt-Winters additive (when enough history for a seasonal cycle),
 * otherwise Holt's linear trend. Confidence bounds from in-sample residuals.
 */
import type { ForecastPoint, QueryResult } from "./types";

interface SeriesPoint {
  period: string;
  value: number;
}

type Granularity = "year" | "quarter" | "month" | "week" | "day" | "index";

function detectGranularity(periods: string[]): Granularity {
  const p = periods[0] ?? "";
  if (/^\d{4}$/.test(p)) return "year";
  if (/^\d{4}-Q[1-4]$/i.test(p)) return "quarter";
  if (/^\d{4}-\d{2}$/.test(p)) return "month";
  if (/^\d{4}-\d{2}-\d{2}/.test(p)) {
    // Distinguish daily vs weekly buckets by median gap.
    const dates = periods
      .map((s) => new Date(s.slice(0, 10)).getTime())
      .filter((t) => !isNaN(t));
    if (dates.length >= 2) {
      const gaps = [];
      for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1]);
      gaps.sort((a, b) => a - b);
      const median = gaps[Math.floor(gaps.length / 2)] / 86400000;
      if (median >= 6) return "week";
    }
    return "day";
  }
  return "index";
}

function seasonLength(g: Granularity): number {
  switch (g) {
    case "month": return 12;
    case "quarter": return 4;
    case "day": return 7;
    default: return 0;
  }
}

function nextPeriodLabel(last: string, step: number, g: Granularity): string {
  if (g === "year") return String(Number(last) + step);
  if (g === "quarter") {
    const m = last.match(/^(\d{4})-Q([1-4])$/i);
    if (m) {
      const total = Number(m[1]) * 4 + (Number(m[2]) - 1) + step;
      return `${Math.floor(total / 4)}-Q${(total % 4) + 1}`;
    }
  }
  if (g === "month") {
    const [y, mo] = last.split("-").map(Number);
    const total = y * 12 + (mo - 1) + step;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  }
  if (g === "day" || g === "week") {
    const d = new Date(last.slice(0, 10));
    d.setUTCDate(d.getUTCDate() + step * (g === "week" ? 7 : 1));
    return d.toISOString().slice(0, 10);
  }
  return `t+${step}`;
}

function holtLinear(values: number[], horizon: number) {
  const alpha = 0.5;
  const beta = 0.3;
  let level = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;
  const residuals: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prediction = level + trend;
    residuals.push(values[i] - prediction);
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecasts = Array.from({ length: horizon }, (_, h) => level + trend * (h + 1));
  return { forecasts, residuals };
}

function holtWinters(values: number[], m: number, horizon: number) {
  const alpha = 0.3;
  const beta = 0.1;
  const gamma = 0.3;
  const n = values.length;

  // Initial level/trend from the first season; seasonals from first-cycle deviations.
  const firstSeasonAvg = values.slice(0, m).reduce((a, b) => a + b, 0) / m;
  const secondSeasonAvg = values.slice(m, 2 * m).reduce((a, b) => a + b, 0) / m;
  let level = firstSeasonAvg;
  let trend = (secondSeasonAvg - firstSeasonAvg) / m;
  const seasonals = values.slice(0, m).map((v) => v - firstSeasonAvg);

  const residuals: number[] = [];
  for (let i = m; i < n; i++) {
    const sIdx = i % m;
    const prediction = level + trend + seasonals[sIdx];
    residuals.push(values[i] - prediction);
    const prevLevel = level;
    level = alpha * (values[i] - seasonals[sIdx]) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonals[sIdx] = gamma * (values[i] - level) + (1 - gamma) * seasonals[sIdx];
  }
  const forecasts = Array.from({ length: horizon }, (_, h) => {
    const sIdx = (n + h) % m;
    return level + trend * (h + 1) + seasonals[sIdx];
  });
  return { forecasts, residuals };
}

/**
 * Build forecast points from a DuckDB time-series result.
 * Expects the first column to be the period and the second the value, ascending.
 */
export function computeForecast(result: QueryResult, horizon: number): ForecastPoint[] {
  const [periodCol, valueCol] = result.columns;
  if (!periodCol || !valueCol) {
    throw new Error("Forecast query must return a period column and a value column.");
  }

  const series: SeriesPoint[] = result.rows
    .map((r) => ({ period: String(r[periodCol]), value: Number(r[valueCol]) }))
    .filter((p) => p.period !== "null" && isFinite(p.value));

  if (series.length < 4) {
    throw new Error(
      `Not enough history to forecast (need at least 4 periods, got ${series.length}).`
    );
  }

  const values = series.map((p) => p.value);
  const periods = series.map((p) => p.period);
  const g = detectGranularity(periods);
  const m = seasonLength(g);

  const { forecasts, residuals } =
    m > 0 && values.length >= 2 * m
      ? holtWinters(values, m, horizon)
      : holtLinear(values, horizon);

  const sigma = residuals.length
    ? Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / residuals.length)
    : 0;

  const points: ForecastPoint[] = series.map((p) => ({
    period: p.period,
    actual: p.value,
    forecast: null,
    lower: null,
    upper: null,
  }));

  const last = periods[periods.length - 1];
  for (let h = 0; h < horizon; h++) {
    const f = forecasts[h];
    const band = 1.96 * sigma * Math.sqrt(h + 1);
    points.push({
      period: nextPeriodLabel(last, h + 1, g),
      actual: null,
      forecast: Math.round(f * 100) / 100,
      lower: Math.round((f - band) * 100) / 100,
      upper: Math.round((f + band) * 100) / 100,
    });
  }

  // Connect history and forecast lines at the last actual point.
  const lastActualIdx = series.length - 1;
  points[lastActualIdx].forecast = points[lastActualIdx].actual;
  points[lastActualIdx].lower = points[lastActualIdx].actual;
  points[lastActualIdx].upper = points[lastActualIdx].actual;

  return points;
}
