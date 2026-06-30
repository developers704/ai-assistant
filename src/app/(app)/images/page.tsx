"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { CameraModal } from "@/components/CameraModal";
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
} from "lucide-react";

type ImageKind = "generated" | "enhanced";

interface GeneratedImage {
  id: string;
  prompt: string;
  src: string;
  kind: ImageKind;
  size: string;
  quality: string;
  /** For enhanced images, the original upload + instructions so it can be re-run. */
  sourceFile?: File;
  instructions?: string;
}

const PROMPT_IDEAS = [
  "Gold diamond solitaire engagement ring on a white marble surface",
  "22KT yellow gold bridal necklace set with rubies and emeralds",
  "Pair of diamond stud earrings in white gold, macro shot",
  "Men's gold chain bracelet, thick Cuban link, studio lighting",
  "Pearl and diamond pendant on a black velvet background",
];

const SIZES = [
  { id: "1024x1024", label: "Square" },
  { id: "1536x1024", label: "Landscape" },
  { id: "1024x1536", label: "Portrait" },
];

const QUALITIES = [
  { id: "low", label: "Draft" },
  { id: "medium", label: "Standard" },
  { id: "high", label: "High" },
];

const MAX_BYTES = 20 * 1024 * 1024;

const textareaClass =
  "w-full px-4 py-3 rounded-2xl border border-white/25 bg-white/10 text-sm text-ink backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30 focus:border-fuchsia-400/40 resize-none";

const chipActive = "bg-fuchsia-500/20 text-ink ring-1 ring-fuchsia-400/40";
const chipIdle = "text-ink-muted hover:text-ink";

export default function ImageGenerationPage() {
  const [mode, setMode] = useState<"generate" | "enhance">("generate");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("high");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);

  // Enhance state
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera capture
  const [showCamera, setShowCamera] = useState(false);

  // Lightbox
  const [viewing, setViewing] = useState<GeneratedImage | null>(null);

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

  const aspectQuality = (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1.5">Aspect</label>
        <div className="flex gap-1 p-1 glass-panel rounded-2xl">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSize(s.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                size === s.id ? chipActive : chipIdle
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1.5">Quality</label>
        <div className="flex gap-1 p-1 glass-panel rounded-2xl">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setQuality(q.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                quality === q.id ? chipActive : chipIdle
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-0">
      <div className="glass-panel-strong rounded-3xl ring-1 ring-white/10 overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
          <PageHeader
            title="Jewelry Image Generation"
            subtitle="Generate photorealistic product images from text, or enhance a raw photo into an e-commerce shot"
          />
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 glass-panel rounded-2xl w-full sm:w-auto sm:inline-flex">
            <button
              type="button"
              onClick={() => {
                setShowCamera(false);
                setMode("generate");
                setError(null);
              }}
              className={cn(
                "flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                mode === "generate" ? chipActive : chipIdle
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
                "flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                mode === "enhance" ? chipActive : chipIdle
              )}
            >
              <Sparkles size={15} /> Enhance from photo
            </button>
          </div>

          {mode === "generate" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                generate(prompt);
              }}
            >
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. 18KT white gold halo ring with a 2 carat oval diamond, soft studio lighting, white background"
                rows={3}
                className={textareaClass}
              />
              <div className="flex flex-wrap items-end gap-4 mt-4">
                {aspectQuality}
                <Button type="submit" disabled={loading || !prompt.trim()} className="ml-auto">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                  {loading ? "Generating..." : "Generate"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                {PROMPT_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => {
                      setPrompt(idea);
                      generate(idea);
                    }}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel text-xs text-ink-secondary hover:bg-white/12 hover:text-ink ring-1 ring-white/10 transition-all disabled:opacity-50"
                  >
                    <Sparkles size={11} className="text-fuchsia-300" /> {idea}
                  </button>
                ))}
              </div>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enhance();
              }}
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
                      "w-full flex flex-col items-center justify-center gap-3 py-10 rounded-3xl border-2 border-dashed transition-all ring-1 ring-white/5",
                      dragOver
                        ? "border-fuchsia-400/50 bg-fuchsia-500/10"
                        : "border-fuchsia-400/30 bg-fuchsia-500/5 hover:border-fuchsia-400/50 hover:bg-fuchsia-500/10"
                    )}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-500/20 ring-1 ring-fuchsia-400/30">
                      <Upload size={26} className="text-fuchsia-300" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink">Upload a jewelry photo</p>
                      <p className="text-xs text-ink-muted mt-1">Drag &amp; drop or click — PNG, JPG, WEBP up to 20MB</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-ink-muted uppercase tracking-wide">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowCamera(true)}
                    disabled={loading}
                  >
                    <Camera size={16} /> Take photo with camera
                  </Button>
                  <p className="text-xs text-ink-muted text-center">
                    Use your phone or laptop camera to capture a piece in real time.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative w-full sm:w-44 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filePreview}
                      alt="Upload preview"
                      className="w-full rounded-2xl object-cover aspect-square bg-white/5 border border-white/15 ring-1 ring-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setFilePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-ink/90 text-white flex items-center justify-center shadow-elevated hover:bg-ink ring-1 ring-white/20"
                      aria-label="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-ink-muted mb-1.5">
                      Optional instructions
                    </label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g. pure white background, top-down angle, warm gold tone, add soft reflection"
                      rows={3}
                      className={textareaClass}
                    />
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-ink-secondary hover:text-fuchsia-300 inline-flex items-center gap-1 transition-colors"
                      >
                        <Pencil size={12} /> Choose a different photo
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="text-xs text-ink-secondary hover:text-fuchsia-300 inline-flex items-center gap-1 transition-colors"
                      >
                        <Camera size={12} /> Retake with camera
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-4 mt-4">
                {aspectQuality}
                <Button type="submit" disabled={loading || !file} className="ml-auto">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {loading ? "Enhancing..." : "Enhance to e-commerce"}
                </Button>
              </div>
            </form>
          )}

          {error && (
            <p className="text-sm text-accent-rose flex items-center gap-1.5">
              <AlertTriangle size={14} /> {error}
            </p>
          )}

          {loading && (
            <div className="glass-panel rounded-2xl flex flex-col items-center justify-center py-14 text-center ring-1 ring-white/10">
              <Loader2 size={32} className="text-fuchsia-300 animate-spin mb-3" />
              <p className="text-sm text-ink-secondary">
                {mode === "enhance" ? "Enhancing your photo..." : "Creating your jewelry image..."}
              </p>
              <p className="text-xs text-ink-muted mt-1">This can take 10–30 seconds.</p>
            </div>
          )}

          {images.length === 0 && !loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 flex flex-col items-center justify-center py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-500/20 ring-1 ring-fuchsia-400/30 mb-4">
                <ImageIcon size={28} className="text-fuchsia-300" />
              </span>
              <p className="text-ink-secondary font-medium">No images yet</p>
              <p className="text-sm text-ink-muted mt-1 max-w-sm">
                Describe a piece, upload a photo, or capture one with your camera.
              </p>
            </div>
          ) : (
            images.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((img) => (
                  <div key={img.id} className="glass-panel rounded-2xl p-3 ring-1 ring-white/10">
                    <div
                      className="relative group cursor-zoom-in"
                      onClick={() => setViewing(img)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.src}
                        alt={img.prompt}
                        className="w-full rounded-xl object-cover aspect-square bg-white/5"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase bg-ink/70 text-white backdrop-blur-sm ring-1 ring-white/10">
                        {img.kind === "enhanced" ? "Enhanced" : "Generated"}
                      </span>
                      <div className="absolute inset-0 rounded-xl bg-ink/0 group-hover:bg-ink/25 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel text-ink text-xs font-medium shadow-elevated">
                          <Maximize2 size={13} /> Full view
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-ink-muted mt-3 line-clamp-2">{img.prompt}</p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => regenerate(img)}
                        disabled={loading}
                      >
                        <RefreshCw size={14} /> Regenerate
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => download(img)}>
                        <Download size={14} /> Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeImage(img.id)}
                        aria-label="Remove image"
                        title="Remove"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <CameraModal
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={pickFile}
        title="Capture jewelry photo"
      />

      {/* Full-view lightbox */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in"
          onClick={() => setViewing(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[88vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewing.src}
              alt={viewing.prompt}
              className="max-h-[78vh] w-auto max-w-full rounded-2xl shadow-elevated object-contain"
            />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <p className="text-sm text-white/80 max-w-xl text-center line-clamp-2">{viewing.prompt}</p>
              <Button size="sm" onClick={() => download(viewing)}>
                <Download size={14} /> Download
              </Button>
            </div>
          </div>
          <button
            onClick={() => setViewing(null)}
            aria-label="Close full view"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
