"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, X, Camera } from "lucide-react";

export interface ReferenceItem {
  id: string;
  file: File;
  preview: string;
}

const MAX_REFS = 8;
const MAX_BYTES = 20 * 1024 * 1024;

interface ImageCreateBarProps {
  prompt: string;
  onPromptChange: (v: string) => void;
  refs: ReferenceItem[];
  onRefsChange: (refs: ReferenceItem[]) => void;
  /** Kept for API defaults — UI no longer exposes ratio/quality controls */
  size?: string;
  quality?: string;
  sizes?: { id: string; label: string; ratio: string }[];
  qualities?: { id: string; label: string }[];
  onSizeChange?: (s: string) => void;
  onQualityChange?: (q: string) => void;
  loading: boolean;
  onCreate: () => void;
  onCamera?: () => void;
}

export function ImageCreateBar({
  prompt,
  onPromptChange,
  refs,
  onRefsChange,
  loading,
  onCreate,
  onCamera,
}: ImageCreateBarProps) {
  const [focused, setFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | File[] | null | undefined) => {
    if (!list?.length) return;
    setLocalError(null);
    const next = [...refs];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_REFS) break;
      if (f.size > MAX_BYTES) {
        setLocalError("Each image must be under 20MB.");
        continue;
      }
      if (!f.type.startsWith("image/")) continue;
      next.push({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) });
    }
    onRefsChange(next);
  };

  const removeRef = (id: string) => {
    onRefsChange(
      refs.filter((r) => {
        if (r.id === id) URL.revokeObjectURL(r.preview);
        return r.id !== id;
      })
    );
  };

  const canCreate = !loading && prompt.trim().length > 0;

  const placeholder =
    refs.length === 0
      ? "Describe the image you want to create…"
      : refs.length === 1
        ? "Describe how to transform this photo — white background, studio lighting…"
        : "Use @img1, @img2… to combine your references…";

  const shellActive = focused || dragOver;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className={cn(
          "relative rounded-[1.75rem] p-[1.5px] transition-all duration-500",
          shellActive || dragOver
            ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_60px_rgba(168,85,247,0.35),0_20px_50px_rgba(15,23,42,0.5)]"
            : "bg-gradient-to-r from-violet-500/50 via-fuchsia-500/40 to-cyan-400/30 shadow-[0_12px_48px_rgba(139,92,246,0.2)]"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <div className="relative overflow-hidden rounded-[1.65rem] bg-[#121a28]/95 backdrop-blur-2xl">
          {/* Ambient inner glow */}
          <div className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.12),transparent)]" />

          <div className="relative px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4">
            {refs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {refs.map((ref, i) => (
                  <div
                    key={ref.id}
                    className="relative h-14 w-14 rounded-xl overflow-hidden ring-1 ring-fuchsia-400/30 shadow-[0_4px_20px_rgba(0,0,0,0.4)] group shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.preview} alt={`Reference ${i + 1}`} className="h-full w-full object-cover" />
                    {refs.length > 1 && (
                      <span className="absolute bottom-0 inset-x-0 py-0.5 text-[8px] font-bold text-center bg-gradient-to-t from-violet-900/90 to-violet-700/70 text-fuchsia-100">
                        @img{i + 1}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRef(ref.id)}
                      className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ring-1 ring-white/20"
                      aria-label="Remove"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canCreate) {
                  e.preventDefault();
                  onCreate();
                }
              }}
              placeholder={placeholder}
              rows={refs.length > 0 ? 2 : 3}
              className="w-full resize-none bg-transparent text-[15px] sm:text-base text-white/90 placeholder:text-white/35 focus:outline-none leading-relaxed min-h-[72px] caret-fuchsia-400"
            />

            <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-1 min-w-0 p-1 rounded-2xl bg-black/25 ring-1 ring-white/[0.06]">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={refs.length >= MAX_REFS}
                  title="Add reference image"
                  aria-label="Add reference image"
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white/50 hover:text-fuchsia-300 hover:bg-fuchsia-500/10 transition-all disabled:opacity-35"
                >
                  <ImagePlus size={17} strokeWidth={1.75} />
                  {refs.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-white">
                      {refs.length}
                    </span>
                  )}
                </button>

                {onCamera && (
                  <>
                    <span className="h-4 w-px bg-white/10 shrink-0" aria-hidden />
                    <button
                      type="button"
                      onClick={onCamera}
                      title="Use camera"
                      aria-label="Use camera"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-white/50 hover:text-fuchsia-300 hover:bg-fuchsia-500/10 transition-all"
                    >
                      <Camera size={16} strokeWidth={1.75} />
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onCreate}
                disabled={!canCreate}
                className={cn(
                  "h-10 sm:h-11 px-6 sm:px-8 rounded-xl text-sm sm:text-base font-semibold transition-all shrink-0 inline-flex items-center gap-2",
                  canCreate
                    ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-[length:200%_100%] hover:bg-right text-white shadow-[0_4px_28px_rgba(168,85,247,0.45)] hover:shadow-[0_6px_36px_rgba(192,132,252,0.55)] hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-white/[0.08] text-white/30 cursor-not-allowed"
                )}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {localError && <p className="text-xs text-rose-400 mt-2 px-1 text-center">{localError}</p>}
    </div>
  );
}
