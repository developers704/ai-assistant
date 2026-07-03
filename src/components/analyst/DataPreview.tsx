"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Hash, Calendar, Type, ToggleLeft, Table2, Wand2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ColumnKind, TableSchema } from "@/lib/analyst/types";

const kindIcon: Record<ColumnKind, React.ReactNode> = {
  number: <Hash size={11} />,
  date: <Calendar size={11} />,
  text: <Type size={11} />,
  boolean: <ToggleLeft size={11} />,
};

const kindColor: Record<ColumnKind, string> = {
  number: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/20",
  date: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/20",
  text: "bg-white/10 text-ink-secondary ring-1 ring-white/10",
  boolean: "bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/20",
};

export function DataPreview({ schema }: { schema: TableSchema }) {
  const [open, setOpen] = useState(false);

  const converted = schema.columns.filter((c) => c.convertedFrom);
  const failures = converted.reduce((a, c) => a + (c.conversionFailures ?? 0), 0);

  return (
    <Card className="p-3 sm:p-4 ring-1 ring-white/5">
      <button className="w-full flex items-center justify-between text-left gap-2" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-cyan-500/20 ring-1 ring-cyan-400/20 shrink-0">
            <Table2 size={15} className="text-cyan-300" />
          </span>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-ink truncate">{schema.fileName}</p>
            <p className="text-[11px] sm:text-xs text-ink-muted">
              {schema.rowCount.toLocaleString()} rows · {schema.columns.length} columns
            </p>
          </div>
        </div>
        <span className="text-ink-muted shrink-0">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {open && converted.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[11px] text-ink-secondary flex items-start gap-1.5">
            <Wand2 size={12} className="text-amber-300 shrink-0 mt-0.5" />
            Auto-converted to real{" "}
            {converted.some((c) => c.kind === "number") ? "numbers" : "dates"}
            {converted.some((c) => c.kind === "number") && converted.some((c) => c.kind === "date") ? " and dates" : ""}{" "}
            (currency symbols and thousands commas handled): {converted.map((c) => `"${c.name}"`).join(", ")}
          </p>
          {failures > 0 && (
            <p className="text-[11px] text-amber-300 flex items-start gap-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {failures.toLocaleString()} value{failures === 1 ? "" : "s"} could not be parsed —{" "}
              {converted
                .filter((c) => (c.conversionFailures ?? 0) > 0)
                .map((c) => `"${c.name}" (${c.conversionFailures})`)
                .join(", ")}
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {schema.columns.map((c) => (
              <span
                key={c.name}
                title={`${c.type}${c.convertedFrom ? " · auto-converted from text" : ""}${
                  c.nullCount > 0 ? ` · ${c.nullCount} empty values` : ""
                }`}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium ${kindColor[c.kind]}`}
              >
                {kindIcon[c.kind]} {c.name}
                {c.convertedFrom && <Wand2 size={10} className="opacity-70" />}
                {c.nullCount > 0 && <span className="opacity-60">({c.nullCount} empty)</span>}
              </span>
            ))}
          </div>

          <div className="overflow-auto rounded-xl border border-white/10 bg-black/15">
            <table className="w-full text-xs">
              <thead className="bg-white/5">
                <tr>
                  {schema.columns.map((c) => (
                    <th key={c.name} className="px-3 py-2 text-left font-semibold text-ink-secondary whitespace-nowrap">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schema.previewRows.map((row, i) => (
                  <tr key={i} className="border-t border-white/5">
                    {schema.columns.map((c) => (
                      <td key={c.name} className="px-3 py-1.5 whitespace-nowrap text-ink">
                        {row[c.name] == null ? "—" : String(row[c.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
