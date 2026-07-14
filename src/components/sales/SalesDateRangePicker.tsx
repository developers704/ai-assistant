"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatReportDateDisplay,
  formatReportDateRange,
  isValidIsoDate,
} from "@/lib/reports/date-utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isoFromYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  if (!isValidIsoDate(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1 };
}

function monthLabel(y: number, m: number): string {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type SalesDateRangeValue = {
  from: string;
  to: string;
};

type SalesDateRangePickerProps = {
  availableDates: string[];
  reportRange?: { from: string; to: string } | null;
  value: SalesDateRangeValue | null;
  onChange: (next: SalesDateRangeValue | null) => void;
  className?: string;
};

/**
 * Popover calendar for Sales Dashboard.
 * - Click one day → filter that day
 * - Click a second day → filter from–to range
 * Only dates present in the report are selectable.
 */
export function SalesDateRangePicker({
  availableDates,
  reportRange,
  value,
  onChange,
  className,
}: SalesDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const availableSet = useMemo(() => new Set(availableDates.filter(isValidIsoDate)), [availableDates]);
  const sortedAvail = useMemo(
    () => [...availableSet].sort(),
    [availableSet]
  );

  const initialMonth = useMemo(() => {
    const seed = value?.from || sortedAvail[sortedAvail.length - 1] || reportRange?.to;
    const p = seed ? parseIso(seed) : null;
    if (p) return { y: p.y, m: p.m };
    return { y: 2026, m: 7 };
  }, [value?.from, sortedAvail, reportRange?.to]);

  const [view, setView] = useState(initialMonth);

  useEffect(() => {
    if (open) {
      setView(initialMonth);
      setDraftFrom(null);
    }
  }, [open, initialMonth]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = value
    ? value.from === value.to
      ? formatReportDateDisplay(value.from)
      : formatReportDateRange(value.from, value.to)
    : reportRange
      ? `All dates (${formatReportDateRange(reportRange.from, reportRange.to)})`
      : "All dates";

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m - 1, 1));
    const startPad = first.getUTCDay();
    const dim = daysInMonth(view.y, view.m);
    const out: Array<{ iso: string | null; day: number | null }> = [];
    for (let i = 0; i < startPad; i++) out.push({ iso: null, day: null });
    for (let d = 1; d <= dim; d++) {
      out.push({ iso: isoFromYmd(view.y, view.m, d), day: d });
    }
    while (out.length % 7 !== 0) out.push({ iso: null, day: null });
    return out;
  }, [view]);

  const inSelection = (iso: string) => {
    if (!value) return false;
    return iso >= value.from && iso <= value.to;
  };

  const isEdge = (iso: string) => value && (iso === value.from || iso === value.to);

  const pickDay = (iso: string) => {
    if (!availableSet.has(iso)) return;
    if (!draftFrom) {
      // Start range / single
      setDraftFrom(iso);
      onChange({ from: iso, to: iso });
      return;
    }
    if (iso === draftFrom) {
      onChange({ from: iso, to: iso });
      setDraftFrom(null);
      setOpen(false);
      return;
    }
    const from = iso < draftFrom ? iso : draftFrom;
    const to = iso < draftFrom ? draftFrom : iso;
    onChange({ from, to });
    setDraftFrom(null);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setDraftFrom(null);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "select-dark inline-flex h-9 items-center gap-2 px-3 rounded-xl text-sm",
          "backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/40",
          "min-w-[12rem] max-w-[20rem]"
        )}
        aria-label="Filter by date"
        aria-expanded={open}
      >
        <CalendarDays size={15} className="text-ink-muted shrink-0" />
        <span className="truncate text-left flex-1">{label}</span>
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-[17.5rem] rounded-2xl border border-white/12 bg-[#121a28] p-3 shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              type="button"
              className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => setView((v) => addMonths(v.y, v.m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-semibold text-white/90">{monthLabel(view.y, view.m)}</p>
            <button
              type="button"
              className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => setView((v) => addMonths(v.y, v.m, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <p className="text-[10px] text-white/40 mb-2 px-0.5">
            {draftFrom
              ? "Click another day for a date range, or the same day to keep one day."
              : "Click a day for that date, or pick two days for a range."}
          </p>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="h-7 flex items-center justify-center text-[10px] font-semibold uppercase text-white/35"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              if (!cell.iso || cell.day == null) {
                return <div key={`e-${i}`} className="h-8" />;
              }
              const available = availableSet.has(cell.iso);
              const selected = inSelection(cell.iso);
              const edge = Boolean(isEdge(cell.iso));
              const drafting = draftFrom === cell.iso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={!available}
                  onClick={() => pickDay(cell.iso!)}
                  className={cn(
                    "h-8 rounded-lg text-xs tabular-nums transition-colors",
                    !available && "text-white/18 cursor-not-allowed",
                    available && !selected && "text-white/75 hover:bg-white/10",
                    selected && !edge && "bg-amber-500/20 text-amber-100",
                    (edge || drafting) && "bg-amber-500/45 text-white font-semibold ring-1 ring-amber-300/40"
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/80"
            >
              <X size={12} />
              Clear dates
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:bg-white/15"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
