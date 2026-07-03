"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { CameraModal } from "@/components/CameraModal";
import { ReferenceComposer, type ReferenceItem } from "@/components/images/ReferenceComposer";
import { GEMINI_IMAGE_MODEL_LABEL } from "@/lib/gemini/config";
import {
  Wand2,
  Sparkles,
  Loader2,
  Download,
  AlertTriangle,
  Image as ImageIcon,
  Upload,
  X,
  Maximize2,
  RefreshCw,
  Pencil,
  Camera,
  Gem,
  Zap,
  Layers,
} from "lucide-react";

type ImageKind = "generated" | "enhanced" | "composed";

interface GeneratedImage {
  id: string;
  prompt: string;
  src: string;
  kind: ImageKind;
  size: string;
  quality: string;
  sourceFile?: File;
  instructions?: string;
  composeRefs?: File[];
}

const PROMPT_IDEAS = [
  { label: "Solitaire ring", text: "Gold diamond solitaire engagement ring on a white marble surface" },
  { label: "Bridal set", text: "22KT yellow gold bridal necklace set with rubies and emeralds" },
  { label: "Stud earrings", text: "Pair of diamond stud earrings in white gold, macro shot" },
  { label: "Cuban chain", text: "Men's gold chain bracelet, thick Cuban link, studio lighting" },
  { label: "Pearl pendant", text: "Pearl and diamond pendant on a black velvet background" },
];

const SIZES = [
  { id: "1024x1024", label: "Square", ratio: "1:1" },
  { id: "1792x1024", label: "Wide", ratio: "16:9" },
  { id: "1536x1024", label: "Landscape", ratio: "3:2" },
  { id: "1024x1536", label: "Portrait", ratio: "2:3" },
];

const QUALITIES = [
  { id: "low", label: "Draft", hint: "Fast" },
  { id: "medium", label: "Standard", hint: "Balanced" },
  { id: "high", label: "High", hint: "Best" },
];

const MAX_BYTES = 20 * 1024 * 1024;

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; hint?: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "px-2 sm:px-3 py-2.5 sm:py-2 rounded-xl text-xs font-medium transition-all duration-200 text-center sm:text-left min-h-[44px] sm:min-h-0",
              value === opt.id
                ? "bg-gradient-to-br from-violet-500/30 to-fuchsia-500/25 text-white ring-1 ring-fuchsia-400/50 shadow-[0_0_20px_rgba(192,132,252,0.15)]"
                : "bg-white/5 text-ink-muted hover:text-ink hover:bg-white/10 ring-1 ring-white/10"
            )}
          >
            <span className="block truncate">{opt.label}</span>
            {opt.hint && value === opt.id && (
              <span className="hidden sm:inline ml-1 opacity-70">· {opt.hint}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageCard({
  img,
  loading,
  featured,
  onView,
  onRegenerate,
  onDownload,
  onRemove,
}: {
  img: GeneratedImage;
  loading: boolean;
  featured?: boolean;
  onView: () => void;
  onRegenerate: () => void;
  onDownload: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl ring-1 ring-white/10 bg-black/20 transition-all duration-300 hover:ring-fuchsia-400/30 hover:shadow-[0_8px_40px_rgba(168,85,247,0.12)]",
        featured ? "p-1.5" : "p-1"
      )}
    >
      <div
        className={cn("relative cursor-zoom-in overflow-hidden rounded-xl", featured ? "aspect-[4/3]" : "aspect-square")}
        onClick={onView}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.src}
          alt={img.prompt}
          className="h-full w-full object-cover bg-white/5 transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span
          className={cn(
            "absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase backdrop-blur-md",
            img.kind === "enhanced"
              ? "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40"
              : img.kind === "composed"
                ? "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/40"
                : "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/40"
          )}
        >
          {img.kind === "enhanced" ? "Enhanced" : img.kind === "composed" ? "Composed" : "AI Generated"}
        </span>
        <span className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-medium ring-1 ring-white/20">
          <Maximize2 size={12} /> View
        </span>
      </div>

      {!featured && (
        <p className="text-[11px] text-ink-muted mt-2 px-1 line-clamp-2 leading-relaxed">{img.prompt}</p>
      )}

      <div className={cn("flex gap-1.5", featured ? "mt-2 px-0.5" : "mt-2 px-0.5")}>
        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onRegenerate} disabled={loading}>
          <RefreshCw size={13} /> Redo
        </Button>
        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onDownload}>
          <Download size={13} /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label="Remove" className="px-2.5">
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}

export default function ImageGenerationPage() {
  const [mode, setMode] = useState<"generate" | "enhance" | "compose">("compose");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1792x1024");
  const [quality, setQuality] = useState("high");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [viewing, setViewing] = useState<GeneratedImage | null>(null);

  const latest = images[0];
  const history = images.slice(1);

  useEffect(() => {
    fetch("/api/voice/last-image")
      .then((r) => r.json())
      .then((data: { image?: { prompt: string; src: string } | null }) => {
        if (!data.image?.src) return;
        setImages((prev) => {
          if (prev.some((img) => img.src === data.image!.src)) return prev;
          return [
            {
              id: crypto.randomUUID(),
              prompt: data.image!.prompt,
              src: data.image!.src,
              kind: "generated",
              size: "1024x1024",
              quality: "high",
            },
            ...prev,
          ];
        });
      })
      .catch(() => {});
  }, []);

  const compose = async (text: string, refItems: ReferenceItem[]) => {
    if (!text.trim() || refItems.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("prompt", text.trim());
      fd.append("size", size);
      fd.append("quality", quality);
      refItems.forEach((r) => fd.append("images", r.file));
      const res = await fetch("/api/compose-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Compose failed");
      const refFiles = refItems.map((r) => r.file);
      setImages((prev) => [
        {
          id: crypto.randomUUID(),
          prompt: text.trim(),
          src: data.image,
          kind: "composed",
          size,
          quality,
          composeRefs: refFiles,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const generate = async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text.trim(), size, quality }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
      setImages((prev) => [
        { id: crypto.randomUUID(), prompt: text.trim(), src: data.image, kind: "generated", size, quality },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("Image is too large. Please use a file under 20MB.");
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG or WEBP).");
      return;
    }
    setError(null);
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  const enhance = async (source?: File, sourceInstructions?: string) => {
    const useFile = source ?? file;
    if (!useFile || loading) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", useFile);
      fd.append("instructions", sourceInstructions ?? instructions);
      fd.append("size", size);
      fd.append("quality", quality);
      const res = await fetch("/api/enhance-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Enhancement failed");
      setImages((prev) => [
        {
          id: crypto.randomUUID(),
          prompt: (sourceInstructions ?? instructions).trim() || "Enhanced product photo",
          src: data.image,
          kind: "enhanced",
          size,
          quality,
          sourceFile: useFile,
          instructions: sourceInstructions ?? instructions,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const regenerate = (img: GeneratedImage) => {
    if (loading) return;
    setSize(img.size);
    setQuality(img.quality);
    if (img.kind === "generated") {
      generate(img.prompt);
    } else if (img.kind === "composed" && img.composeRefs?.length) {
      compose(
        img.prompt,
        img.composeRefs.map((f) => ({
          id: f.name,
          file: f,
          preview: URL.createObjectURL(f),
        }))
      );
    } else if (img.sourceFile) {
      enhance(img.sourceFile, img.instructions);
    }
  };

  const download = (img: GeneratedImage) => {
    const a = document.createElement("a");
    a.href = img.src;
    a.download = `jewelry-${img.id.slice(0, 8)}.png`;
    a.click();
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setViewing((v) => (v?.id === id ? null : v));
  };

  return (
    <div className="flex flex-col max-lg:-mx-3 max-lg:-mt-1 max-lg:-mb-3 lg:mx-0 max-lg:min-h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px))] lg:h-[calc(100dvh-4rem)]">
      <div className="glass-panel-strong rounded-2xl lg:rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10 relative">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />

        {/* Header */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_4px_20px_rgba(139,92,246,0.35)]">
                  <Gem size={16} className="text-white sm:w-[18px] sm:h-[18px]" />
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
                  <Zap size={10} /> {GEMINI_IMAGE_MODEL_LABEL}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-display font-bold text-gradient-title tracking-tight">
                Jewelry Studio
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-lg leading-relaxed">
                Compose from multiple references, generate from text, or enhance a photo.
              </p>
            </div>
            {images.length > 0 && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/5 ring-1 ring-white/10 shrink-0">
                <ImageIcon size={15} className="text-fuchsia-300" />
                <div>
                  <p className="text-sm font-semibold text-ink leading-none">{images.length}</p>
                  <p className="text-[10px] text-ink-muted uppercase tracking-wide mt-0.5">Creations</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Body: single scroll on mobile, split on desktop */}
        <div className="relative flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          {/* Controls panel */}
          <div className="lg:w-[min(420px,100%)] shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 lg:overflow-y-auto lg:min-h-0">
            <div className="p-3 sm:p-5 space-y-4 lg:max-h-full safe-area-bottom">
              {/* Mode switch */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/25 ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowCamera(false);
                    setMode("compose");
                    setError(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 min-h-[44px]",
                    mode === "compose"
                      ? "bg-gradient-to-br from-violet-600/80 to-fuchsia-600/70 text-white shadow-[0_4px_24px_rgba(139,92,246,0.25)]"
                      : "text-ink-muted hover:text-ink hover:bg-white/5"
                  )}
                >
                  <Layers size={15} /> Compose
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCamera(false);
                    setMode("generate");
                    setError(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 min-h-[44px]",
                    mode === "generate"
                      ? "bg-gradient-to-br from-violet-600/80 to-fuchsia-600/70 text-white shadow-[0_4px_24px_rgba(139,92,246,0.25)]"
                      : "text-ink-muted hover:text-ink hover:bg-white/5"
                  )}
                >
                  <Wand2 size={15} /> Generate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("enhance");
                    setError(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 min-h-[44px]",
                    mode === "enhance"
                      ? "bg-gradient-to-br from-violet-600/80 to-fuchsia-600/70 text-white shadow-[0_4px_24px_rgba(139,92,246,0.25)]"
                      : "text-ink-muted hover:text-ink hover:bg-white/5"
                  )}
                >
                  <Sparkles size={15} /> Enhance
                </button>
              </div>

              {mode === "compose" ? (
                <ReferenceComposer
                  size={size}
                  quality={quality}
                  loading={loading}
                  onSizeChange={setSize}
                  onQualityChange={setQuality}
                  onCompose={compose}
                  sizes={SIZES.map((s) => ({ id: s.id, label: s.label, hint: s.ratio }))}
                  qualities={QUALITIES}
                />
              ) : mode === "generate" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    generate(prompt);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2 block">
                      Describe your piece
                    </label>
                    <div className="relative rounded-2xl ring-1 ring-white/15 focus-within:ring-fuchsia-400/40 focus-within:shadow-[0_0_30px_rgba(192,132,252,0.08)] transition-all">
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="18KT white gold halo ring, 2ct oval diamond, soft studio lighting, white background…"
                        rows={4}
                        className="w-full px-4 py-3.5 rounded-2xl bg-black/30 text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none resize-none"
                      />
                      <span className="absolute bottom-2.5 right-3 text-[10px] text-ink-muted tabular-nums">
                        {prompt.length}/500
                      </span>
                    </div>
                  </div>

                  <OptionGroup label="Aspect ratio" value={size} options={SIZES} onChange={setSize} />
                  <OptionGroup label="Output quality" value={quality} options={QUALITIES} onChange={setQuality} />

                  <Button
                    type="submit"
                    disabled={loading || !prompt.trim()}
                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 shadow-[0_8px_32px_rgba(139,92,246,0.35)]"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                    {loading ? "Creating magic…" : "Generate image"}
                  </Button>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
                      Quick ideas
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin snap-x snap-mandatory">
                      {PROMPT_IDEAS.map((idea) => (
                        <button
                          key={idea.text}
                          type="button"
                          onClick={() => {
                            setPrompt(idea.text);
                            generate(idea.text);
                          }}
                          disabled={loading}
                          className="snap-start shrink-0 flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-fuchsia-400/30 text-left transition-all disabled:opacity-50 w-[min(44vw,160px)] min-h-[64px]"
                        >
                          <span className="text-xs font-medium text-ink">{idea.label}</span>
                          <span className="text-[10px] text-ink-muted line-clamp-1">{idea.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    enhance();
                  }}
                  className="space-y-4"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />

                  {!filePreview ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOver(false);
                          pickFile(e.dataTransfer.files?.[0]);
                        }}
                        className={cn(
                          "w-full flex flex-col items-center justify-center gap-3 py-8 sm:py-12 rounded-2xl border-2 border-dashed transition-all duration-200",
                          dragOver
                            ? "border-fuchsia-400/60 bg-fuchsia-500/15 scale-[1.01]"
                            : "border-white/20 bg-black/20 hover:border-fuchsia-400/40 hover:bg-fuchsia-500/5"
                        )}
                      >
                        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 ring-1 ring-fuchsia-400/30">
                          <Upload size={28} className="text-fuchsia-300" />
                        </span>
                        <div className="text-center px-4">
                          <p className="text-sm font-semibold text-ink">Drop your jewelry photo</p>
                          <p className="text-xs text-ink-muted mt-1">PNG, JPG, WEBP · up to 20MB</p>
                        </div>
                      </button>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-[10px] text-ink-muted uppercase tracking-widest">or</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>

                      <Button type="button" variant="outline" className="w-full" onClick={() => setShowCamera(true)} disabled={loading}>
                        <Camera size={16} /> Open camera
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="relative w-28 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={filePreview}
                            alt="Upload preview"
                            className="w-full rounded-xl object-cover aspect-square ring-2 ring-fuchsia-400/30"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setFile(null);
                              setFilePreview(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center ring-2 ring-white/20 hover:bg-rose-600 transition-colors"
                            aria-label="Remove"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5 block">
                            Style notes (optional)
                          </label>
                          <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="White background, warm gold tone, soft reflection…"
                            rows={3}
                            className="w-full px-3 py-2.5 rounded-xl bg-black/30 text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none focus:ring-1 focus:ring-fuchsia-400/40 resize-none ring-1 ring-white/10"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-ink-muted hover:text-fuchsia-300 inline-flex items-center gap-1 transition-colors"
                        >
                          <Pencil size={12} /> Change photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCamera(true)}
                          className="text-ink-muted hover:text-fuchsia-300 inline-flex items-center gap-1 transition-colors"
                        >
                          <Camera size={12} /> Retake
                        </button>
                      </div>
                    </div>
                  )}

                  <OptionGroup label="Aspect ratio" value={size} options={SIZES} onChange={setSize} />
                  <OptionGroup label="Output quality" value={quality} options={QUALITIES} onChange={setQuality} />

                  <Button
                    type="submit"
                    disabled={loading || !file}
                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 shadow-[0_8px_32px_rgba(139,92,246,0.35)]"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {loading ? "Enhancing…" : "Enhance to e-commerce"}
                  </Button>
                </form>
              )}

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 ring-1 ring-rose-400/25 text-sm text-rose-200">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Canvas / gallery — hidden empty state on mobile; full panel on desktop */}
          <div
            className={cn(
              "flex-1 min-w-0 flex flex-col p-3 sm:p-5",
              "lg:overflow-y-auto lg:min-h-0",
              !loading && images.length === 0 && "hidden lg:flex"
            )}
          >
            {loading && (
              <div className="flex flex-col items-center justify-center min-h-[220px] sm:min-h-[280px] rounded-2xl bg-black/20 ring-1 ring-white/10 relative overflow-hidden my-2 lg:my-0 lg:flex-1">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-fuchsia-500/5 to-transparent animate-pulse" />
                <div className="relative flex flex-col items-center text-center px-6">
                  <div className="relative mb-5">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-fuchsia-400/30 flex items-center justify-center">
                      <Loader2 size={36} className="text-fuchsia-300 animate-spin" />
                    </div>
                    <Sparkles size={16} className="absolute -top-1 -right-1 text-amber-300 animate-pulse" />
                  </div>
                  <p className="text-base font-medium text-ink">
                    {mode === "enhance"
                      ? "Polishing your photo…"
                      : mode === "compose"
                        ? "Composing from references…"
                        : "Rendering your jewelry…"}
                  </p>
                  <p className="text-sm text-ink-muted mt-1">Usually 10–30 seconds · sit tight</p>
                </div>
              </div>
            )}

            {!loading && images.length === 0 && (
              <div className="hidden lg:flex flex-1 flex-col items-center justify-center min-h-[280px] rounded-2xl border border-dashed border-white/15 bg-black/15 text-center px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-dot-grid opacity-30" />
                <div className="relative">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/25 to-fuchsia-600/20 ring-1 ring-fuchsia-400/25 shadow-[0_8px_40px_rgba(139,92,246,0.15)]">
                    <ImageIcon size={36} className="text-fuchsia-300/80" />
                  </div>
                  <p className="text-lg font-semibold text-ink">Your canvas is ready</p>
                  <p className="text-sm text-ink-muted mt-2 max-w-sm mx-auto leading-relaxed">
                    Upload references and use @img1 @img2 in your prompt, generate from text, or enhance a photo.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    {["Rings", "Necklaces", "Earrings", "Bracelets"].map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full text-xs text-ink-muted bg-white/5 ring-1 ring-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!loading && latest && (
              <div className="space-y-4 pb-4 lg:pb-0">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300/90 mb-1">
                      Latest creation
                    </p>
                    <p className="text-sm text-ink-secondary line-clamp-2">{latest.prompt}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => download(latest)} className="shrink-0 w-full sm:w-auto">
                    <Download size={14} /> Download
                  </Button>
                </div>

                <ImageCard
                  img={latest}
                  loading={loading}
                  featured
                  onView={() => setViewing(latest)}
                  onRegenerate={() => regenerate(latest)}
                  onDownload={() => download(latest)}
                  onRemove={() => removeImage(latest.id)}
                />

                {history.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-3">
                      Previous ({history.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                      {history.map((img) => (
                        <ImageCard
                          key={img.id}
                          img={img}
                          loading={loading}
                          onView={() => setViewing(img)}
                          onRegenerate={() => regenerate(img)}
                          onDownload={() => download(img)}
                          onRemove={() => removeImage(img.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <CameraModal
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={pickFile}
        title="Capture jewelry photo"
      />

      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewing.src}
              alt={viewing.prompt}
              className="max-h-[78vh] w-auto max-w-full rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.5)] object-contain ring-1 ring-white/10"
            />
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 max-w-2xl">
              <p className="text-sm text-white/75 text-center line-clamp-2 flex-1 min-w-[200px]">{viewing.prompt}</p>
              <Button size="sm" onClick={() => download(viewing)}>
                <Download size={14} /> Download
              </Button>
              <Button size="sm" variant="outline" onClick={() => regenerate(viewing)} disabled={loading}>
                <RefreshCw size={14} /> Regenerate
              </Button>
            </div>
          </div>
          <button
            onClick={() => setViewing(null)}
            aria-label="Close"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors ring-1 ring-white/20"
          >
            <X size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
