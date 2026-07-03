"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Loader2, Layers, Upload, X, Plus } from "lucide-react";

export interface ReferenceItem {
  id: string;
  file: File;
  preview: string;
}

const MAX_REFS = 8;
const MAX_BYTES = 20 * 1024 * 1024;

const COMPOSE_IDEAS = [
  {
    label: "On wrist",
    text: "Take @img1 and place the jewelry from @img2 on the wrist in @img1. Ultra high detail, studio lighting.",
  },
  {
    label: "Two pieces",
    text: "Combine @img1 and @img2 into one elegant product shot on white background.",
  },
  {
    label: "Model + product",
    text: "Reimagine @img1 in ultra detail while placing the piece from @img2 naturally on the model.",
  },
];

interface ReferenceComposerProps {
  size: string;
  quality: string;
  loading: boolean;
  onSizeChange: (s: string) => void;
  onQualityChange: (q: string) => void;
  onCompose: (prompt: string, refs: ReferenceItem[]) => void;
  sizes: { id: string; label: string; hint?: string }[];
  qualities: { id: string; label: string; hint?: string }[];
}

export function ReferenceComposer({
  size,
  quality,
  loading,
  onSizeChange,
  onQualityChange,
  onCompose,
  sizes,
  qualities,
}: ReferenceComposerProps) {
  const [refs, setRefs] = useState<ReferenceItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

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
      next.push({
        id: crypto.randomUUID(),
        file: f,
        preview: URL.createObjectURL(f),
      });
    }
    setRefs(next);
  };

  const removeRef = (id: string) => {
    setRefs((prev) => {
      const item = prev.find((r) => r.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((r) => r.id !== id);
    });
  };

  const insertTag = (index: number) => {
    const tag = `@img${index + 1}`;
    setPrompt((p) => (p ? `${p} ${tag}` : tag));
    promptRef.current?.focus();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || refs.length === 0 || loading) return;
    onCompose(prompt.trim(), refs);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            References
          </p>
          <span className="text-[10px] text-ink-muted tabular-nums">
            {refs.length}/{MAX_REFS}
          </span>
        </div>

        <div
          className={cn(
            "grid grid-cols-4 gap-2 p-2 rounded-2xl bg-black/20 ring-1 ring-white/10 min-h-[88px]",
            dragOver && "ring-fuchsia-400/40 bg-fuchsia-500/5"
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
          {refs.map((ref, i) => (
            <div key={ref.id} className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-white/15 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ref.preview} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => insertTag(i)}
                className="absolute bottom-0 inset-x-0 py-0.5 text-[9px] font-bold bg-black/70 text-fuchsia-200 hover:bg-fuchsia-600/80 transition-colors"
              >
                @img{i + 1}
              </button>
              <button
                type="button"
                onClick={() => removeRef(ref.id)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {refs.length < MAX_REFS && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-ink-muted hover:border-fuchsia-400/40 hover:text-fuchsia-300 hover:bg-fuchsia-500/5 transition-all"
            >
              <Plus size={18} />
              <span className="text-[9px] font-medium">Add</span>
            </button>
          )}
        </div>

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
          className="mt-2 text-xs text-ink-muted hover:text-fuchsia-300 inline-flex items-center gap-1 transition-colors"
        >
          <Upload size={12} /> Upload references · drag & drop
        </button>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2 block">
          Prompt
        </label>
        <div className="relative rounded-2xl ring-1 ring-white/15 focus-within:ring-fuchsia-400/40 transition-all">
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Take @img1 and place the bracelets from @img2 & @img3 on the wrist. Ultra high detail, studio lighting…"
            rows={4}
            className="w-full px-4 py-3.5 rounded-2xl bg-black/30 text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none resize-none"
          />
        </div>
        <p className="text-[10px] text-ink-muted mt-1.5">
          Tap <strong className="text-fuchsia-300/90">@img1</strong> on a thumbnail or type tags to reference each image.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
          Aspect ratio
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {sizes.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSizeChange(opt.id)}
              className={cn(
                "px-2 py-2 rounded-xl text-xs font-medium transition-all text-center",
                size === opt.id
                  ? "bg-gradient-to-br from-violet-500/30 to-fuchsia-500/25 text-white ring-1 ring-fuchsia-400/50"
                  : "bg-white/5 text-ink-muted hover:text-ink ring-1 ring-white/10"
              )}
            >
              {opt.label}
              {opt.hint && <span className="block text-[9px] opacity-70">{opt.hint}</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
          Output quality
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {qualities.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onQualityChange(opt.id)}
              className={cn(
                "px-2 py-2 rounded-xl text-xs font-medium transition-all text-center",
                quality === opt.id
                  ? "bg-gradient-to-br from-violet-500/30 to-fuchsia-500/25 text-white ring-1 ring-fuchsia-400/50"
                  : "bg-white/5 text-ink-muted hover:text-ink ring-1 ring-white/10"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {localError && <p className="text-xs text-rose-300">{localError}</p>}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
          Quick compose
        </p>
        <div className="flex flex-col gap-1.5">
          {COMPOSE_IDEAS.map((idea) => (
            <button
              key={idea.label}
              type="button"
              disabled={loading}
              onClick={() => setPrompt(idea.text)}
              className="text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-xs text-ink-secondary disabled:opacity-40 transition-all"
            >
              <span className="font-medium text-ink">{idea.label}</span>
              <span className="block text-[10px] text-ink-muted line-clamp-1 mt-0.5">{idea.text}</span>
            </button>
          ))}
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !prompt.trim() || refs.length === 0}
        className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 shadow-[0_8px_32px_rgba(139,92,246,0.35)]"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Layers size={18} />}
        {loading ? "Composing…" : "Compose final image"}
      </Button>
    </form>
  );
}
