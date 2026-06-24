"use client";

import { Download } from "lucide-react";
import type { QueryResult } from "@/lib/analyst/types";

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toLocaleString("en-US");
    return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return String(v);
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ResultTable({ result, title }: { result: QueryResult; title?: string }) {
  if (result.rows.length === 0) {
    return <p className="text-sm text-ink-muted italic">The query returned no rows.</p>;
  }

  const download = () => {
    const lines = [
      result.columns.map(csvEscape).join(","),
      ...result.rows.map((r) => result.columns.map((c) => csvEscape(r[c])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "analysis-result").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-ink-muted">
          {result.rows.length.toLocaleString()} row{result.rows.length === 1 ? "" : "s"} · all rows shown
        </p>
        <button
          onClick={download}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
        >
          <Download size={13} /> Download CSV
        </button>
      </div>
      <div className="overflow-auto max-h-96 rounded-xl border border-white/10 bg-black/15">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-ink-secondary whitespace-nowrap">#</th>
              {result.columns.map((c) => (
                <th
                  key={c}
                  className="px-3 py-2 text-left text-xs font-semibold text-ink-secondary whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-1.5 text-xs text-ink-muted">{i + 1}</td>
                {result.columns.map((c) => (
                  <td
                    key={c}
                    className={`px-3 py-1.5 whitespace-nowrap ${
                      typeof row[c] === "number" ? "text-right tabular-nums" : ""
                    } text-ink`}
                  >
                    {formatCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
