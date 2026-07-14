"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency, formatPieceCount, cn } from "@/lib/utils";
import { formatReportDateDisplay } from "@/lib/reports/date-utils";
import type { VizChartRow } from "@/lib/sales/visualizations";

const PALETTE = [
  "#34d399",
  "#a78bfa",
  "#fb923c",
  "#38bdf8",
  "#f472b6",
  "#fbbf24",
  "#2dd4bf",
  "#c084fc",
  "#f87171",
  "#60a5fa",
];

const tooltipStyle = {
  backgroundColor: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "#f1f5f9",
  boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
};

function moneyTick(v: number) {
  return Math.abs(v) >= 1000
    ? Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)
    : `$${Math.round(v)}`;
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/[0.04] ring-1 ring-white/10 backdrop-blur-md p-4 sm:p-5 overflow-hidden",
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-sm sm:text-base font-bold text-ink tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function SalesTrendChart({ data }: { data: VizChartRow[] }) {
  const rows = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatReportDateDisplay(d.name) || d.name,
      })),
    [data]
  );

  if (!rows.length) {
    return (
      <ChartCard title="Sales trend" subtitle="Net sales by day">
        <p className="text-sm text-ink-muted py-16 text-center">No daily trend for this filter.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Latest sales trend"
      subtitle="Daily net sales · hover for detail"
      className="md:col-span-2"
    >
      <div className="h-[260px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(241,245,249,0.45)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={moneyTick}
              tick={{ fill: "rgba(241,245,249,0.45)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => {
                const n = typeof value === "number" ? value : Number(value) || 0;
                if (name === "netSales") return [formatCurrency(n), "Net sales"];
                if (name === "unitsSold") return [formatPieceCount(n), "Units"];
                return [n, String(name)];
              }}
              labelFormatter={(label) => String(label)}
            />
            <Area
              type="monotone"
              dataKey="netSales"
              stroke="#34d399"
              strokeWidth={2.5}
              fill="url(#salesTrendFill)"
              activeDot={{ r: 5, fill: "#6ee7b7", stroke: "#064e3b", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function SalesHBarChart({
  title,
  subtitle,
  data,
  metric = "netSales",
}: {
  title: string;
  subtitle?: string;
  data: VizChartRow[];
  metric?: "netSales" | "unitsSold";
}) {
  const [metricState, setMetricState] = useState<"netSales" | "unitsSold">(metric);
  const rows = data.slice(0, 12);

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="flex gap-1.5 mb-3">
        {(["netSales", "unitsSold"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetricState(m)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
              metricState === m
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30"
                : "text-ink-muted hover:text-ink hover:bg-white/5"
            )}
          >
            {m === "netSales" ? "Revenue" : "Units"}
          </button>
        ))}
      </div>
      {!rows.length ? (
        <p className="text-sm text-ink-muted py-12 text-center">No data for this filter.</p>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={metricState === "netSales" ? moneyTick : (v) => String(v)}
                tick={{ fill: "rgba(241,245,249,0.45)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fill: "rgba(241,245,249,0.65)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value) || 0;
                  return metricState === "netSales"
                    ? [formatCurrency(n), "Net sales"]
                    : [formatPieceCount(n), "Units"];
                }}
              />
              <Bar dataKey={metricState} radius={[0, 8, 8, 0]} maxBarSize={18}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function SalesDonutChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: VizChartRow[];
}) {
  const rows = data.slice(0, 8);
  const [active, setActive] = useState<number | null>(null);

  return (
    <ChartCard title={title} subtitle={subtitle}>
      {!rows.length ? (
        <p className="text-sm text-ink-muted py-12 text-center">No data for this filter.</p>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="netSales"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                onMouseEnter={(_, i) => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {rows.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PALETTE[i % PALETTE.length]}
                    fillOpacity={active == null || active === i ? 1 : 0.35}
                    stroke="rgba(15,23,42,0.6)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _n, item) => {
                  const n = typeof value === "number" ? value : Number(value) || 0;
                  const share = (item?.payload as VizChartRow | undefined)?.share;
                  return [
                    `${formatCurrency(n)}${share != null ? ` · ${share}%` : ""}`,
                    "Net sales",
                  ];
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={48}
                wrapperStyle={{ fontSize: 10, color: "rgba(241,245,249,0.7)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function SalesModelsChart({ data }: { data: VizChartRow[] }) {
  const rows = data.slice(0, 12);
  return (
    <ChartCard
      title="Top vendor models"
      subtitle="By pieces sold · tap metric to switch"
      className="md:col-span-2"
    >
      {!rows.length ? (
        <p className="text-sm text-ink-muted py-12 text-center">No models for this filter.</p>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-28}
                textAnchor="end"
                height={60}
                tick={{ fill: "rgba(241,245,249,0.55)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="units"
                tick={{ fill: "rgba(241,245,249,0.45)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <YAxis
                yAxisId="rev"
                orientation="right"
                tickFormatter={moneyTick}
                tick={{ fill: "rgba(241,245,249,0.45)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  const n = typeof value === "number" ? value : Number(value) || 0;
                  if (name === "unitsSold") return [formatPieceCount(n), "Units"];
                  return [formatCurrency(n), "Revenue"];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgba(241,245,249,0.7)" }} />
              <Bar
                yAxisId="units"
                dataKey="unitsSold"
                name="unitsSold"
                fill="#a78bfa"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                yAxisId="rev"
                dataKey="netSales"
                name="netSales"
                fill="#34d399"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                fillOpacity={0.55}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
