"use client";

import { useEffect, useState } from "react";
import {
  resolveProductImageCandidates,
  resolveProductImageUrl,
} from "@/lib/reports/product-image";
import { ImageOff, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductLightbox({
  src,
  alt,
  subtitle,
  onClose,
}: {
  src: string;
  alt: string;
  subtitle?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close image preview"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 sm:-right-2 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="overflow-hidden rounded-2xl ring-1 ring-white/15 bg-[#0f1624] shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[min(78vh,720px)] w-full object-contain bg-black/40"
          />
          {(alt || subtitle) && (
            <div className="px-4 py-3 border-t border-white/10">
              {alt && <p className="text-sm text-ink font-medium line-clamp-2">{alt}</p>}
              {subtitle && (
                <p className="text-[11px] font-mono text-cyan-300/80 mt-0.5">{subtitle}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductThumb({
  imageDir,
  imageUrl,
  alt,
  subtitle,
  onOpen,
  size = "md",
  className,
}: {
  imageDir?: string;
  imageUrl?: string | null;
  alt: string;
  subtitle?: string;
  onOpen: (src: string, alt: string, subtitle?: string) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const candidates = (() => {
    const fromDir = resolveProductImageCandidates(imageDir);
    if (fromDir.length) return fromDir;
    if (imageUrl) {
      // Server may have baked a .jpg URL — also try .webp
      const webp = imageUrl.replace(/\.(jpe?g|png|gif)(\?.*)?$/i, ".webp$2");
      return webp !== imageUrl ? [webp, imageUrl] : [imageUrl];
    }
    const resolved = resolveProductImageUrl(imageDir);
    return resolved ? [resolved] : [];
  })();

  const [idx, setIdx] = useState(0);
  const src = candidates[idx] ?? null;
  const box = size === "sm" ? "h-9 w-9" : "h-11 w-11";

  if (!src || idx >= candidates.length) {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/10 text-white/25 shrink-0",
          box,
          className
        )}
        title={candidates[0] ? `Image not found: ${candidates[0]}` : "No image"}
      >
        <ImageOff size={size === "sm" ? 12 : 14} />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(src, alt, subtitle);
      }}
      className={cn(
        "group relative shrink-0 rounded-lg overflow-hidden ring-1 ring-white/15 bg-white/[0.04] hover:ring-violet-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 transition-all",
        box,
        className
      )}
      title="Click to enlarge"
      aria-label={`Enlarge photo: ${alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setIdx((i) => i + 1)}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 transition-colors">
        <ZoomIn
          size={size === "sm" ? 12 : 14}
          className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
        />
      </span>
    </button>
  );
}
