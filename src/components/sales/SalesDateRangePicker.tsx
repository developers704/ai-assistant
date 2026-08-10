"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidIsoDate } from "@/lib/reports/date-utils";

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

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

/** ERP-style header: "Monday, August 10, 2026" */
function longWeekdayDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso;
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** POS / ERP short date: 8/9/2026 */
function usDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

function shortRange(from: string, to: string): string {
  return from === to ? usDate(from) : `${usDate(from)} – ${usDate(to)}`;
}

function weekdayUtc(iso: string): number {
  return new Date(`${iso}T12:00:00.000Z`).getUTCDay(); // 0=Sun … 6=Sat
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

type ActiveField = "from" | "to";

type Cell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

/**
 * Sales date filter — Date From / To + ERP-style month calendar.
 * Only dates present in the report are selectable. Weekends render red;
 * selected range uses blue like the POS filter calendar.
 */
export function SalesDateRangePicker({
  availableDates,
  reportRange,
  value,
  onChange,
  className,
}: SalesDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<ActiveField>("from");
  const [draftFrom, setDraftFrom] = useState<string | null>(value?.from ?? null);
  const [draftTo, setDraftTo] = useState<string | null>(value?.to ?? null);
  const [focusIso, setFocusIso] = useState<string | null>(value?.to ?? value?.from ?? null);
  const rootRef = useRef<HTMLDivElement>(null);

  const availableSet = useMemo(
    () => new Set(availableDates.filter(isValidIsoDate)),
    [availableDates]
  );
  const sortedAvail = useMemo(() => [...availableSet].sort(), [availableSet]);

  const [view, setView] = useState(() => {
    const seed =
      value?.from || sortedAvail[sortedAvail.length - 1] || reportRange?.to;
    const p = seed ? parseIso(seed) : null;
    return p ? { y: p.y, m: p.m } : { y: 2026, m: 8 };
  });

  useEffect(() => {
    if (!open) return;
    setDraftFrom(value?.from ?? null);
    setDraftTo(value?.to ?? null);
    setActiveField("from");
    const seed = value?.to || value?.from || sortedAvail[sortedAvail.length - 1] || reportRange?.to;
    setFocusIso(seed ?? null);
    const p = seed ? parseIso(seed) : null;
    if (p) setView({ y: p.y, m: p.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  const triggerLabel = value ? shortRange(value.from, value.to) : "All dates";

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m - 1, 1));
    const startPad = first.getUTCDay();
    const dim = daysInMonth(view.y, view.m);
    const prev = addMonths(view.y, view.m, -1);
    const prevDim = daysInMonth(prev.y, prev.m);
    const next = addMonths(view.y, view.m, 1);

    const out: Cell[] = [];
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevDim - i;
      out.push({ iso: isoFromYmd(prev.y, prev.m, d), day: d, inMonth: false });
    }
    for (let d = 1; d <= dim; d++) {
      out.push({ iso: isoFromYmd(view.y, view.m, d), day: d, inMonth: true });
    }
    let n = 1;
    while (out.length % 7 !== 0) {
      out.push({ iso: isoFromYmd(next.y, next.m, n), day: n, inMonth: false });
      n++;
    }
    return out;
  }, [view]);

  const previewFrom = draftFrom;
  const previewTo = draftTo ?? draftFrom;
  const rangeFrom =
    previewFrom && previewTo
      ? previewFrom <= previewTo
        ? previewFrom
        : previewTo
      : previewFrom;
  const rangeTo =
    previewFrom && previewTo
      ? previewFrom <= previewTo
        ? previewTo
        : previewFrom
      : previewTo;

  const inSelection = (iso: string) =>
    Boolean(rangeFrom && rangeTo && iso >= rangeFrom && iso <= rangeTo);
  const isEdge = (iso: string) =>
    Boolean(rangeFrom && rangeTo && (iso === rangeFrom || iso === rangeTo));

  const applyDraft = (from: string | null, to: string | null) => {
    if (!from && !to) {
      onChange(null);
      return;
    }
    if (from && !to) {
      onChange({ from, to: from });
      return;
    }
    if (!from && to) {
      onChange({ from: to, to });
      return;
    }
    if (from && to) {
      onChange(from <= to ? { from, to } : { from: to, to: from });
    }
  };

  const pickDay = (iso: string) => {
    if (!availableSet.has(iso)) return;
    setFocusIso(iso);

    if (activeField === "from") {
      setDraftFrom(iso);
      const nextTo = draftTo && draftTo < iso ? null : draftTo;
      if (nextTo == null) {
        setDraftTo(iso);
        setActiveField("to");
        applyDraft(iso, iso);
      } else {
        setDraftTo(nextTo);
        applyDraft(iso, nextTo);
        setActiveField("to");
      }
      return;
    }

    const start = draftFrom ?? iso;
    setDraftFrom(start);
    setDraftTo(iso);
    applyDraft(start, iso);
  };

  const clear = () => {
    setDraftFrom(null);
    setDraftTo(null);
    setFocusIso(null);
    onChange(null);
    setActiveField("from");
  };

  const headerIso =
    focusIso ||
    (activeField === "to" ? draftTo : draftFrom) ||
    draftTo ||
    draftFrom ||
    sortedAvail[sortedAvail.length - 1] ||
    reportRange?.to ||
    null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "select-dark inline-flex h-9 items-center gap-2 px-3 rounded-xl text-sm whitespace-nowrap",
          "backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400/40"
        )}
        aria-label="Filter by date"
        aria-expanded={open}
      >
        <CalendarDays size={15} className="text-ink-muted shrink-0" />
        <span className="text-left font-medium tabular-nums">{triggerLabel}</span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-40 mt-2 w-[19rem] overflow-hidden rounded-xl",
            "border border-white/12 bg-[#101826] shadow-2xl ring-1 ring-white/10"
          )}
        >
          {/* ERP header: full weekday + date */}
          <div className="border-b border-white/10 bg-[#152033] px-3 py-2.5">
            <p className="text-[13px] font-medium text-sky-100/90 tabular-nums">
              {headerIso ? longWeekdayDate(headerIso) : "Select a date"}
            </p>
          </div>

          <div className="p-3">
            {/* Date From / To like POS filter */}
            <div className="mb-3 space-y-2">
              <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
                <span className="text-[11px] text-white/55">Date From:</span>
                <button
                  type="button"
                  onClick={() => setActiveField("from")}
                  className={cn(
                    "flex h-8 items-center justify-between rounded-md px-2 text-left text-sm tabular-nums ring-1 transition-colors",
                    activeField === "from"
                      ? "bg-sky-500/20 ring-sky-400/50 text-white"
                      : "bg-white/[0.04] ring-white/12 text-white/85 hover:bg-white/[0.07]"
                  )}
                >
                  <span>{draftFrom ? usDate(draftFrom) : "—"}</span>
                  <CalendarDays size={13} className="text-white/40" />
                </button>
              </div>
              <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
                <span className="text-[11px] text-white/55">To:</span>
                <button
                  type="button"
                  onClick={() => setActiveField("to")}
                  className={cn(
                    "flex h-8 items-center justify-between rounded-md px-2 text-left text-sm tabular-nums ring-1 transition-colors",
                    activeField === "to"
                      ? "bg-sky-500/20 ring-sky-400/50 text-white"
                      : "bg-white/[0.04] ring-white/12 text-white/85 hover:bg-white/[0.07]"
                  )}
                >
                  <span>{draftTo ? usDate(draftTo) : "—"}</span>
                  <CalendarDays size={13} className="text-white/40" />
                </button>
              </div>
            </div>

            {/* Month nav */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                onClick={() => setView((v) => addMonths(v.y, v.m, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm font-semibold text-white/90">
                {monthLabel(view.y, view.m)}
              </p>
              <button
                type="button"
                className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                onClick={() => setView((v) => addMonths(v.y, v.m, 1))}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mb-0.5 grid grid-cols-7">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={cn(
                    "flex h-7 items-center justify-center text-[10px] font-bold tracking-wide",
                    i === 0 || i === 6 ? "text-red-400/90" : "text-white/40"
                  )}
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((cell) => {
                const available = availableSet.has(cell.iso);
                const selected = inSelection(cell.iso);
                const edge = isEdge(cell.iso);
                const weekend = (() => {
                  const wd = weekdayUtc(cell.iso);
                  return wd === 0 || wd === 6;
                })();

                return (
                  <button
                    key={`${cell.iso}-${cell.inMonth ? "in" : "out"}`}
                    type="button"
                    disabled={!available}
                    onClick={() => pickDay(cell.iso)}
                    onMouseEnter={() => setFocusIso(cell.iso)}
                    className={cn(
                      "relative h-8 text-[12px] tabular-nums transition-colors",
                      !cell.inMonth && "opacity-40",
                      !available && "cursor-not-allowed opacity-30",
                      available && !selected && weekend && "text-red-400",
                      available && !selected && !weekend && "text-white/80 hover:bg-white/10",
                      !available && weekend && cell.inMonth && "text-red-400/35",
                      selected && !edge && "bg-sky-500/25 text-sky-50",
                      edge && "bg-sky-500 text-white font-semibold",
                      selected && !edge && "rounded-none",
                      edge && cell.iso === rangeFrom && rangeFrom !== rangeTo && "rounded-l-md rounded-r-none",
                      edge && cell.iso === rangeTo && rangeFrom !== rangeTo && "rounded-r-md rounded-l-none",
                      edge && rangeFrom === rangeTo && "rounded-md"
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex justify-center border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={clear}
                className="min-w-[4.5rem] rounded-md px-4 py-1 text-[12px] text-white/55 hover:bg-white/10 hover:text-white/90"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
