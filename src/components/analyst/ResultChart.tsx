"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from "recharts";
import type { AnalystPlan, ForecastPoint, QueryResult } from "@/lib/analyst/types";

const PALETTE = ["#c4a059", "#3d2b1f", "#9a7a3c", "#10b981", "#6b5b4f", "#f43f5e", "#d4b06a", "#4a3024"];

function compactNumber(v: number): string {
  return Math.abs(v) >= 1000
    ? Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)
    : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e8dcc8",
  borderRadius: "12px",
  fontSize: "12px",
};

/** Resolve x/y keys against the actual result columns, with sensible fallbacks. */
function resolveKeys(plan: AnalystPlan, result: QueryResult) {
  const numericCols = result.columns.filter((c) =>
    result.rows.some((r) => typeof r[c] === "number")
  );
  const xKey =
    plan.xKey && result.columns.includes(plan.xKey)
      ? plan.xKey
      : result.columns.find((c) => !numericCols.includes(c)) ?? result.columns[0];
  let yKeys = plan.yKeys.filter((k) => numericCols.includes(k));
  if (yKeys.length === 0) yKeys = numericCols.filter((c) => c !== xKey).slice(0, 3);
  return { xKey, yKeys };
}

export function ResultChart({ plan, result }: { plan: AnalystPlan; result: QueryResult }) {
  if (plan.chartType === "none" || result.rows.length === 0) return null;
  const { xKey, yKeys } = resolveKeys(plan, result);
  if (!xKey || yKeys.length === 0) return null;

  // Keep bar/pie charts readable; the full data is always in the table below.
  const maxPoints = plan.chartType === "pie" ? 12 : plan.chartType === "bar" ? 40 : 500;
  const data = result.rows.slice(0, maxPoints).map((r) => {
    const o: Record<string, unknown> = {};
    o[xKey] = String(r[xKey] ?? "—");
    for (const k of yKeys) o[k] = typeof r[k] === "number" ? r[k] : Number(r[k]) || 0;
    return o;
  });
  const truncated = result.rows.length > maxPoints;

  let chart: React.ReactNode = null;

  if (plan.chartType === "pie") {
    chart = (
      <PieChart>
        <Pie
          data={data}
          dataKey={yKeys[0]}
          nameKey={xKey}
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={(p) => `${p.name}: ${compactNumber(p.value as number)}`}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => compactNumber(Number(v))} />
      </PieChart>
    );
  } else if (plan.chartType === "line" || plan.chartType === "area") {
    const Wrapper = plan.chartType === "line" ? LineChart : AreaChart;
    chart = (
      <Wrapper data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8dcc8" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#6b5b4f" }} />
        <YAxis tick={{ fontSize: 11, fill: "#6b5b4f" }} tickFormatter={compactNumber} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toLocaleString("en-US")} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {yKeys.map((k, i) =>
          plan.chartType === "line" ? (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={data.length <= 40}
            />
          ) : (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stroke={PALETTE[i % PALETTE.length]}
              fill={PALETTE[i % PALETTE.length]}
              fillOpacity={0.25}
            />
          )
        )}
      </Wrapper>
    );
  } else {
    const bottomMargin = data.length > 5 ? 72 : 24;
    chart = (
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: bottomMargin, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8dcc8" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 9, fill: "#6b5b4f" }}
          interval={0}
          angle={data.length > 4 ? -40 : 0}
          textAnchor={data.length > 4 ? "end" : "middle"}
          height={data.length > 4 ? 72 : 28}
        />
        <YAxis tick={{ fontSize: 11, fill: "#6b5b4f" }} tickFormatter={compactNumber} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toLocaleString("en-US")} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {yKeys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    );
  }

  return (
    <div className="mt-3 w-full">
      <div className="min-h-[260px] h-[clamp(260px,48dvh,400px)] w-full overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={280}>
          {chart as React.ReactElement}
        </ResponsiveContainer>
      </div>
      {truncated && (
        <p className="text-[11px] text-ink-muted mt-1 text-center">
          Chart shows the first {maxPoints} items — the table below contains every row.
        </p>
      )}
    </div>
  );
}

export function ForecastChart({ data }: { data: ForecastPoint[] }) {
  return (
    <div className="mt-3 min-h-[240px] h-[clamp(240px,42dvh,360px)] w-full overflow-x-auto">
      <ResponsiveContainer width="100%" height="100%" minWidth={280}>
        <ComposedChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dcc8" />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#6b5b4f" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6b5b4f" }} tickFormatter={compactNumber} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => (v == null ? "—" : Number(v).toLocaleString("en-US"))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            dataKey="upper"
            stroke="none"
            fill="#c4a059"
            fillOpacity={0.12}
            name="Confidence (upper)"
            legendType="none"
          />
          <Area
            dataKey="lower"
            stroke="none"
            fill="#ffffff"
            fillOpacity={0.9}
            name="Confidence (lower)"
            legendType="none"
          />
          <Line
            dataKey="actual"
            name="Actual"
            stroke="#3d2b1f"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls={false}
          />
          <Line
            dataKey="forecast"
            name="Forecast"
            stroke="#c4a059"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 2 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
