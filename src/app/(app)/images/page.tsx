"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { CameraModal } from "@/components/CameraModal";
import { ImageCreateBar, type ReferenceItem } from "@/components/images/ImageCreateBar";
import { GEMINI_IMAGE_MODEL_LABEL } from "@/lib/gemini/config";
import {
  Sparkles,
  Loader2,
  Download,
  AlertTriangle,
  Image as ImageIcon,
  X,
  Maximize2,
  RefreshCw,
  Gem,
  Zap,
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

const SIZES = [
  { id: "1024x1024", label: "Square", ratio: "1:1" },
  { id: "1792x1024", label: "Wide", ratio: "16:9" },
  { id: "1536x1024", label: "Landscape", ratio: "3:2" },
  { id: "1024x1536", label: "Portrait", ratio: "2:3" },
];

const QUALITIES = [
  { id: "low", label: "Draft" },
  { id: "medium", label: "Standard" },
  { id: "high", label: "High" },
];

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
          {img.kind === "enhanced" ? "Edited" : img.kind === "composed" ? "Composed" : "Generated"}
        </span>
        <span className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-medium ring-1 ring-white/20">
          <Maximize2 size={12} /> View
        </span>
      </div>

      {!featured && (
        <p className="text-[11px] text-ink-muted mt-2 px-1 line-clamp-2 leading-relaxed">{img.prompt}</p>
      )}

      <div className="flex gap-1.5 mt-2 px-0.5">
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
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<ReferenceItem[]>([]);
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("high");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
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
      setImages((prev) => [
        {
          id: crypto.randomUUID(),
          prompt: text.trim(),
          src: data.image,
          kind: "composed",
          size,
          quality,
          composeRefs: refItems.map((r) => r.file),
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

  const enhance = async (file: File, instructions: string) => {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("instructions", instructions.trim());
      fd.append("size", size);
      fd.append("quality", quality);
      const res = await fetch("/api/enhance-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Enhancement failed");
      setImages((prev) => [
        {
          id: crypto.randomUUID(),
          prompt: instructions.trim(),
          src: data.image,
          kind: "enhanced",
          size,
          quality,
          sourceFile: file,
          instructions: instructions.trim(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    const text = prompt.trim();
    if (!text || loading) return;

    if (refs.length === 0) {
      await generate(text);
    } else if (refs.length === 1) {
      await enhance(refs[0].file, text);
    } else {
      await compose(text, refs);
    }
  };

  const addCameraCapture = (f: File | null | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    setRefs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) },
    ]);
  };

  const regenerate = (img: GeneratedImage) => {
    if (loading) return;
    setSize(img.size);
    setQuality(img.quality);
    setPrompt(img.prompt);
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
      enhance(img.sourceFile, img.instructions ?? img.prompt);
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
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />

        {/* Header */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-2 border-b border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_4px_20px_rgba(139,92,246,0.35)]">
                  <Gem size={16} className="text-white" />
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
                  <Zap size={10} /> {GEMINI_IMAGE_MODEL_LABEL}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-display font-bold text-gradient-title tracking-tight">
                Jewelry Studio
              </h1>
            </div>
            {images.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 ring-1 ring-white/10 shrink-0">
                <ImageIcon size={15} className="text-fuchsia-300" />
                <p className="text-sm font-semibold text-ink">{images.length}</p>
              </div>
            )}
          </div>
        </div>

        {/* Create bar + gallery */}
        <div className="relative flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-5">
            <ImageCreateBar
              prompt={prompt}
              onPromptChange={setPrompt}
              refs={refs}
              onRefsChange={setRefs}
              size={size}
              quality={quality}
              sizes={SIZES}
              qualities={QUALITIES}
              onSizeChange={setSize}
              onQualityChange={setQuality}
              loading={loading}
              onCreate={create}
              onCamera={() => setShowCamera(true)}
            />

            {error && (
              <div className="max-w-3xl mx-auto flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 ring-1 ring-rose-400/25 text-sm text-rose-200">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {loading && (
              <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[200px] rounded-2xl bg-black/20 ring-1 ring-white/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-fuchsia-500/5 to-transparent animate-pulse" />
                <div className="relative flex flex-col items-center text-center px-6 py-8">
                  <Loader2 size={32} className="text-fuchsia-300 animate-spin mb-3" />
                  <p className="text-sm font-medium text-ink">Creating your image…</p>
                  <p className="text-xs text-ink-muted mt-1">Usually 10–30 seconds</p>
                </div>
              </div>
            )}

            {!loading && images.length === 0 && (
              <div className="max-w-3xl mx-auto relative flex flex-col items-center justify-center min-h-[180px] rounded-2xl overflow-hidden text-center px-6 py-10 ring-1 ring-white/[0.08]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(139,92,246,0.08),transparent)]" />
                <div className="pointer-events-none absolute inset-0 border border-dashed border-fuchsia-400/15 rounded-2xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 ring-1 ring-fuchsia-400/30 shadow-[0_8px_32px_rgba(139,92,246,0.2)] mb-4">
                  <Sparkles size={24} className="text-fuchsia-300" />
                </div>
                <p className="relative text-sm text-white/50">Your creations will appear here</p>
              </div>
            )}

            {!loading && latest && (
              <div className="max-w-4xl mx-auto space-y-4 pb-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300/90 mb-1">
                      Latest
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
        onCapture={addCameraCapture}
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
