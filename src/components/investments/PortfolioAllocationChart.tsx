"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { getChartColor, type AllocationSlice } from "@/lib/plaid/portfolio-context";

interface PortfolioAllocationChartProps {
  slices: AllocationSlice[];
  totalValue: number;
  title?: string;
}

export function PortfolioAllocationChart({
  slices,
  totalValue,
  title = "Allocation",
}: PortfolioAllocationChartProps) {
  if (slices.length === 0) return null;

  const data = slices.map((s) => ({
    name: s.name,
    value: s.value,
    percent: s.percent,
  }));

  return (
    <div>
      <p className="text-sm font-medium text-ink mb-3">{title}</p>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
              label={({ name, percent }) =>
                (percent ?? 0) >= 5 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
              }
            >
              {data.map((_, i) => (
                <Cell key={i} fill={getChartColor(i)} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 15, 25, 0.95)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "12px",
                fontSize: "12px",
                color: "#e2e8f0",
              }}
              formatter={(value, _name, item) => {
                const num = Number(value ?? 0);
                const pct = Number(item.payload?.percent ?? 0);
                return [`${formatCurrency(num)} (${pct.toFixed(1)}%)`, item.payload?.name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
              formatter={(value) => (
                <span className="text-ink-secondary">{String(value).slice(0, 24)}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1.5">
        {slices.slice(0, 6).map((s, i) => (
          <div key={s.name} className="flex items-center justify-between text-sm gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getChartColor(i) }}
              />
              <span className="text-ink-secondary truncate">{s.name}</span>
            </div>
            <span className="text-ink font-medium shrink-0">
              {formatCurrency(s.value)}{" "}
              <span className="text-ink-muted font-normal">({s.percent.toFixed(1)}%)</span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-muted mt-2 text-right">Total {formatCurrency(totalValue)}</p>
    </div>
  );
}
