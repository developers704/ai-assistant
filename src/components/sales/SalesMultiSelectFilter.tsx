"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  allLabel: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  /** Stretch trigger to parent width (stacked compare filters). */
  fullWidth?: boolean;
  /** Keep "All …" label on the trigger; selections shown as chips elsewhere. */
  selectionsAsChips?: boolean;
};

/**
 * Excel-style filter: searchable dropdown with multi-select checkboxes.
 * Menu is portaled and anchored to the trigger so it stays aligned.
 */
export function SalesMultiSelectFilter({
  label,
  allLabel,
  options,
  value,
  onChange,
  className,
  fullWidth = false,
  selectionsAsChips = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const updatePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 220);
    const pad = 8;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - menuWidth - pad);
    }
    setMenuPos({
      top: rect.bottom + 4,
      left,
      width: menuWidth,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
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

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const toggle = (opt: string) => {
    if (selected.has(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };

  const buttonText =
    selectionsAsChips || value.length === 0
      ? allLabel
      : value.length === 1
        ? value[0]
        : `${value.length} selected`;

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              zIndex: 80,
            }}
            className="rounded-lg border border-slate-600 bg-slate-900 shadow-xl overflow-hidden"
            role="listbox"
            aria-multiselectable
            aria-label={label}
          >
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-slate-700 bg-slate-950">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-700 bg-slate-950 text-[11px]">
              <button
                type="button"
                className="text-sky-400 hover:text-sky-300"
                onClick={() => onChange([...options])}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-200"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            </div>

            <ul className="max-h-56 overflow-y-auto py-1 bg-slate-900">
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-xs text-slate-500">No matches</li>
              ) : (
                filtered.map((opt) => {
                  const on = selected.has(opt);
                  return (
                    <li key={opt}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => toggle(opt)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800",
                          on && "bg-slate-800 text-white"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            on
                              ? "border-sky-500 bg-sky-600 text-white"
                              : "border-slate-500 bg-slate-950"
                          )}
                        >
                          {on && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="truncate">{opt}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative inline-flex max-w-full",
        fullWidth ? "w-full" : "w-fit",
        className
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-9 px-3 rounded-full text-sm inline-flex items-center gap-1.5",
          "border border-slate-500 bg-transparent text-slate-100",
          "focus:outline-none focus:ring-2 focus:ring-slate-500/40 focus:border-slate-400",
          fullWidth ? "w-full min-w-0" : "min-w-[8.75rem]",
          !selectionsAsChips && value.length > 0 && "border-amber-600/70 bg-[#1a2332]"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="truncate flex-1 text-left">{buttonText}</span>
        {!selectionsAsChips && value.length > 0 ? (
          <span
            role="button"
            tabIndex={0}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-100 hover:bg-slate-700"
            aria-label={`Clear ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange([]);
              }
            }}
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown size={14} className="shrink-0 text-slate-400" />
        )}
      </button>
      {menu}
    </div>
  );
}
