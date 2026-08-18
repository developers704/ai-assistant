"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidIsoDate } from "@/lib/reports/date-utils";

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

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
type PanelMode = "days" | "months";

type Cell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

/**
 * Sales date filter — separate From / To calendars with ERP-style
 * day grid + year month picker (click "August 2026" → all months).
 */
export function SalesDateRangePicker({
  availableDates,
  reportRange,
  value,
  onChange,
  className,
}: SalesDateRangePickerProps) {
  const [openField, setOpenField] = useState<ActiveField | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("days");
  const [draftFrom, setDraftFrom] = useState<string | null>(value?.from ?? null);
  const [draftTo, setDraftTo] = useState<string | null>(value?.to ?? null);
  const [focusIso, setFocusIso] = useState<string | null>(value?.to ?? value?.from ?? null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** After From pick: reopen To without resetting drafts from applied value. */
  const skipDraftResetRef = useRef(false);

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

  function openCalendar(field: ActiveField) {
    const fresh = openField == null && !skipDraftResetRef.current;
    if (skipDraftResetRef.current) skipDraftResetRef.current = false;

    const nextFrom = fresh ? (value?.from ?? null) : draftFrom;
    const nextTo = fresh ? (value?.to ?? null) : draftTo;
    if (fresh) {
      setDraftFrom(nextFrom);
      setDraftTo(nextTo);
    }
    setOpenField(field);
    setPanelMode("days");
    const seed =
      field === "to" && !nextTo
        ? nextFrom
        : (field === "from" ? nextFrom : nextTo) ||
          nextFrom ||
          nextTo ||
          sortedAvail[sortedAvail.length - 1] ||
          reportRange?.to ||
          null;
    setFocusIso(seed);
    const p = seed ? parseIso(seed) : null;
    if (p) setView({ y: p.y, m: p.m });
  }

  const discardAndClose = () => {
    setOpenField(null);
    setDraftFrom(value?.from ?? null);
    setDraftTo(value?.to ?? null);
    setPanelMode("days");
  };

  useEffect(() => {
    if (!openField) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) discardAndClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") discardAndClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openField, value?.from, value?.to]);

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
  const previewTo = draftTo;
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

  /** From: single day only. To: one from marker until end day picked, then show range. */
  const inSelection = (iso: string) => {
    if (openField === "from") return iso === draftFrom;
    if (!draftTo) return iso === draftFrom;
    return Boolean(rangeFrom && rangeTo && iso >= rangeFrom && iso <= rangeTo);
  };
  const isEdge = (iso: string) => {
    if (openField === "from") return iso === draftFrom;
    if (!draftTo) return iso === draftFrom;
    return Boolean(rangeFrom && rangeTo && (iso === rangeFrom || iso === rangeTo));
  };

  const applyDraft = (from: string, to: string) => {
    onChange(from <= to ? { from, to } : { from: to, to: from });
  };

  const pickDay = (iso: string) => {
    if (!availableSet.has(iso) || !openField) return;
    setFocusIso(iso);

    if (openField === "from") {
      setDraftFrom(iso);
      setDraftTo(null);
      setOpenField(null);
      skipDraftResetRef.current = true;
      requestAnimationFrame(() => openCalendar("to"));
      return;
    }

    const from = draftFrom;
    if (!from) return;

    setDraftTo(iso);
    applyDraft(from, iso);
    setOpenField(null);
    setPanelMode("days");
  };

  const pickMonth = (month: number) => {
    setView((v) => ({ y: v.y, m: month }));
    setPanelMode("days");
  };

  const fieldIso =
    openField === "from"
      ? draftFrom
      : openField === "to"
        ? draftTo
        : null;

  const headerIso =
    focusIso ||
    fieldIso ||
    draftTo ||
    draftFrom ||
    sortedAvail[sortedAvail.length - 1] ||
    reportRange?.to ||
    null;

  const monthsWithData = useMemo(() => {
    const set = new Set<number>();
    for (const iso of sortedAvail) {
      const p = parseIso(iso);
      if (p && p.y === view.y) set.add(p.m);
    }
    return set;
  }, [sortedAvail, view.y]);

  const displayFrom = openField ? draftFrom : value?.from ?? null;
  const displayTo = openField ? draftTo : value?.to ?? null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* ERP-style: Date From: [____][📅]  To: [____][📅] */}
      <div
        className={cn(
          "select-dark inline-flex h-9 items-center gap-2 sm:gap-3 px-2.5 sm:px-3 rounded-xl text-sm whitespace-nowrap",
          "backdrop-blur-md"
        )}
        aria-label={triggerLabel}
      >
        <label className="inline-flex items-center gap-1.5 min-w-0">
          <span className="text-[12px] text-ink-muted shrink-0">Date From:</span>
          <span
            className={cn(
              "inline-flex h-7 items-stretch overflow-hidden rounded-md ring-1 bg-white/[0.04]",
              openField === "from"
                ? "ring-sky-400/55 bg-sky-500/15"
                : "ring-white/15"
            )}
          >
            <button
              type="button"
              onClick={() =>
                openField === "from" ? discardAndClose() : openCalendar("from")
              }
              className="min-w-[5.75rem] px-2 text-left text-[12px] tabular-nums text-white/90 hover:bg-white/[0.06]"
              aria-label="Date from"
              aria-expanded={openField === "from"}
            >
              {displayFrom ? usDate(displayFrom) : ""}
            </button>
            <button
              type="button"
              onClick={() =>
                openField === "from" ? discardAndClose() : openCalendar("from")
              }
              className="flex w-7 items-center justify-center border-l border-white/12 text-sky-300/90 hover:bg-white/10"
              aria-label="Open from calendar"
            >
              <CalendarDays size={14} />
            </button>
          </span>
        </label>

        <label className="inline-flex items-center gap-1.5 min-w-0">
          <span className="text-[12px] text-ink-muted shrink-0">To:</span>
          <span
            className={cn(
              "inline-flex h-7 items-stretch overflow-hidden rounded-md ring-1 bg-white/[0.04]",
              openField === "to"
                ? "ring-sky-400/55 bg-sky-500/15"
                : "ring-white/15"
            )}
          >
            <button
              type="button"
              onClick={() =>
                openField === "to" ? discardAndClose() : openCalendar("to")
              }
              className="min-w-[5.75rem] px-2 text-left text-[12px] tabular-nums text-white/90 hover:bg-white/[0.06]"
              aria-label="Date to"
              aria-expanded={openField === "to"}
            >
              {displayTo ? usDate(displayTo) : ""}
            </button>
            <button
              type="button"
              onClick={() =>
                openField === "to" ? discardAndClose() : openCalendar("to")
              }
              className="flex w-7 items-center justify-center border-l border-white/12 text-sky-300/90 hover:bg-white/10"
              aria-label="Open to calendar"
            >
              <CalendarDays size={14} />
            </button>
          </span>
        </label>
      </div>

      {openField != null && (
        <div
          className={cn(
            "absolute left-0 z-40 mt-2 w-[19rem] overflow-hidden rounded-xl",
            "border border-white/12 bg-[#101826] shadow-2xl ring-1 ring-white/10"
          )}
        >
          {/* ERP header: recent / selected date always on top */}
          <div className="border-b border-white/10 bg-[#152033] px-3 py-2.5">
            <p className="text-[13px] font-medium text-sky-100/90 tabular-nums">
              {headerIso ? longWeekdayDate(headerIso) : "Select a date"}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">
              {openField === "from" ? "Date From" : "To"}
            </p>
          </div>

          <div className="p-3">
            {panelMode === "days" ? (
              <>
                {/* Month nav — click label for year/month grid */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                    onClick={() => setView((v) => addMonths(v.y, v.m, -1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelMode("months")}
                    className="rounded-md px-2.5 py-1 text-sm font-semibold text-white/90 ring-1 ring-sky-400/35 bg-sky-500/15 hover:bg-sky-500/25"
                    title="Show all months"
                  >
                    {monthLabel(view.y, view.m)}
                  </button>
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
                    const isFieldPick =
                      openField === "from"
                        ? cell.iso === draftFrom
                        : cell.iso === draftTo;

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
                          available &&
                            !selected &&
                            !weekend &&
                            "text-white/80 hover:bg-white/10",
                          !available && weekend && cell.inMonth && "text-red-400/35",
                          selected && !edge && "bg-sky-500/25 text-sky-50",
                          edge && "bg-sky-500 text-white font-semibold",
                          selected && !edge && "rounded-none",
                          edge &&
                            cell.iso === rangeFrom &&
                            rangeFrom !== rangeTo &&
                            "rounded-l-md rounded-r-none",
                          edge &&
                            cell.iso === rangeTo &&
                            rangeFrom !== rangeTo &&
                            "rounded-r-md rounded-l-none",
                          edge && rangeFrom === rangeTo && "rounded-md",
                          isFieldPick && "ring-2 ring-amber-300/70 ring-inset"
                        )}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Year view — all 12 months (ERP style) */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                    onClick={() => setView((v) => ({ y: v.y - 1, m: v.m }))}
                    aria-label="Previous year"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelMode("days")}
                    className="rounded-md px-2.5 py-1 text-sm font-semibold text-white/90 ring-1 ring-sky-400/35 bg-sky-500/15 hover:bg-sky-500/25"
                    title="Back to days"
                  >
                    {view.y}
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                    onClick={() => setView((v) => ({ y: v.y + 1, m: v.m }))}
                    aria-label="Next year"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5 py-1">
                  {MONTHS_SHORT.map((label, idx) => {
                    const month = idx + 1;
                    const hasData = monthsWithData.has(month);
                    const isCurrent = view.m === month;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => pickMonth(month)}
                        className={cn(
                          "rounded-md py-2.5 text-[13px] font-medium transition-colors",
                          isCurrent
                            ? "bg-sky-500 text-white"
                            : hasData
                              ? "text-white/85 hover:bg-white/10"
                              : "text-white/35 hover:bg-white/[0.06]"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
