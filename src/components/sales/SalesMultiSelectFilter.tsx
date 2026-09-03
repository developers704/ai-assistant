"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSurfaceTone, type SurfaceTone } from "@/components/ui/surface-tone";

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
  /** Pretty-print option values in the menu / single-select trigger. */
  formatOption?: (value: string) => string;
  /** Extra match (e.g. paycode POS aliases). `query` is already trimmed + lowercased. */
  optionMatches?: (option: string, query: string) => boolean;
  /** When nothing is selected, treat this option as the checked “all” row. */
  treatEmptyAsAllValue?: string;
  /** Override surface; otherwise inherits HR light / Athena dark from context. */
  theme?: SurfaceTone;
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
  formatOption,
  optionMatches,
  treatEmptyAsAllValue,
  theme,
}: Props) {
  const tone = useSurfaceTone();
  const light = (theme ?? tone) === "light";
  const labelOf = (v: string) => formatOption?.(v) ?? v;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => {
    const s = new Set(value);
    if (value.length === 0 && treatEmptyAsAllValue) s.add(treatEmptyAsAllValue);
    return s;
  }, [value, treatEmptyAsAllValue]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      if (o.toLowerCase().includes(q)) return true;
      const pretty = formatOption?.(o) ?? o;
      if (pretty.toLowerCase().includes(q)) return true;
      return Boolean(optionMatches?.(o, q));
    });
  }, [options, query, formatOption, optionMatches]);

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
    if (treatEmptyAsAllValue && opt === treatEmptyAsAllValue) {
      onChange([]);
      return;
    }
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };

  const buttonText =
    selectionsAsChips || value.length === 0
      ? allLabel
      : value.length === 1
        ? labelOf(value[0]!)
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
            className={cn(
              "rounded-lg border shadow-xl overflow-hidden",
              light
                ? "border-[#e4e8f0] bg-white"
                : "border-slate-600 bg-slate-900"
            )}
            role="listbox"
            aria-multiselectable
            aria-label={label}
          >
            <div
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 border-b",
                light ? "border-[#e4e8f0] bg-[#f7f8fc]" : "border-slate-700 bg-slate-950"
              )}
            >
              <Search size={14} className={cn("shrink-0", light ? "text-[#8b95a5]" : "text-slate-400")} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className={cn(
                  "w-full bg-transparent text-sm focus:outline-none",
                  light
                    ? "text-[#121826] placeholder:text-[#8b95a5]"
                    : "text-slate-100 placeholder:text-slate-500"
                )}
              />
            </div>

            <div
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 border-b text-[11px]",
                light ? "border-[#e4e8f0] bg-[#f7f8fc]" : "border-slate-700 bg-slate-950"
              )}
            >
              <button
                type="button"
                className={light ? "text-[#6c4dff] hover:text-[#5a3df0]" : "text-sky-400 hover:text-sky-300"}
                onClick={() => onChange([...options])}
              >
                Select all
              </button>
              <button
                type="button"
                className={light ? "text-[#5e6b7a] hover:text-[#121826]" : "text-slate-400 hover:text-slate-200"}
                onClick={() => onChange([])}
              >
                Clear
              </button>
            </div>

            <ul className={cn("max-h-56 overflow-y-auto py-1", light ? "bg-white" : "bg-slate-900")}>
              {filtered.length === 0 ? (
                <li className={cn("px-3 py-3 text-xs", light ? "text-[#8b95a5]" : "text-slate-500")}>
                  No matches
                </li>
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
                          "w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left text-sm",
                          light
                            ? cn("text-[#121826] hover:bg-[#f1eeff]", on && "bg-[#f1eeff]")
                            : cn("text-slate-200 hover:bg-slate-800", on && "bg-slate-800 text-white")
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            on
                              ? light
                                ? "border-[#6c4dff] bg-[#6c4dff] text-white"
                                : "border-sky-500 bg-sky-600 text-white"
                              : light
                                ? "border-[#d5dbe6] bg-white"
                                : "border-slate-500 bg-slate-950"
                          )}
                        >
                          {on && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="truncate">{labelOf(opt)}</span>
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
          "px-3 text-sm inline-flex items-center gap-1.5",
          "focus:outline-none",
          light
            ? cn(
                "h-10 rounded-[11px] border border-[#d5dbe6] bg-[#fbfcfe] text-[#121826]",
                "focus:ring-2 focus:ring-[#6c4dff]/20 focus:border-[#6c4dff]",
                !selectionsAsChips && value.length > 0 && "border-[#6c4dff]/50 bg-[#f1eeff]"
              )
            : cn(
                "h-9 rounded-full border border-slate-500 bg-transparent text-slate-100",
                "focus:ring-2 focus:ring-slate-500/40 focus:border-slate-400",
                !selectionsAsChips && value.length > 0 && "border-amber-600/70 bg-[#1a2332]"
              ),
          fullWidth ? "w-full min-w-0" : "min-w-[8.75rem]"
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
            className={cn(
              "shrink-0 rounded p-0.5",
              light
                ? "text-[#8b95a5] hover:text-[#121826] hover:bg-[#eef1f6]"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-700"
            )}
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
          <ChevronDown size={14} className={cn("shrink-0", light ? "text-[#8b95a5]" : "text-slate-400")} />
        )}
      </button>
      {menu}
    </div>
  );
}
