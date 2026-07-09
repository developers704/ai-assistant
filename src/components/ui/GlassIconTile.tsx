"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

/** Soft glass / layered gradient palettes for section tiles */
export const GLASS_PALETTES = {
  violet: {
    from: "#818cf8",
    via: "#a78bfa",
    to: "#c084fc",
    glow: "rgba(167, 139, 250, 0.45)",
  },
  indigo: {
    from: "#60a5fa",
    via: "#818cf8",
    to: "#a78bfa",
    glow: "rgba(99, 102, 241, 0.45)",
  },
  cyan: {
    from: "#22d3ee",
    via: "#67e8f9",
    to: "#a5b4fc",
    glow: "rgba(34, 211, 238, 0.4)",
  },
  fuchsia: {
    from: "#e879f9",
    via: "#c084fc",
    to: "#a78bfa",
    glow: "rgba(232, 121, 249, 0.45)",
  },
  rose: {
    from: "#fb7185",
    via: "#f472b6",
    to: "#c084fc",
    glow: "rgba(244, 114, 182, 0.4)",
  },
  amber: {
    from: "#fbbf24",
    via: "#fb923c",
    to: "#f472b6",
    glow: "rgba(251, 146, 60, 0.4)",
  },
  emerald: {
    from: "#34d399",
    via: "#2dd4bf",
    to: "#67e8f9",
    glow: "rgba(52, 211, 153, 0.4)",
  },
  sky: {
    from: "#38bdf8",
    via: "#60a5fa",
    to: "#818cf8",
    glow: "rgba(56, 189, 248, 0.4)",
  },
  slate: {
    from: "#94a3b8",
    via: "#a78bfa",
    to: "#818cf8",
    glow: "rgba(148, 163, 184, 0.35)",
  },
} as const;

export type GlassPalette = keyof typeof GLASS_PALETTES;

type GlassIconTileProps = {
  icon: LucideIcon;
  palette?: GlassPalette;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** show sparkle accent like the reference icons */
  sparkle?: boolean;
};

const SIZES = {
  sm: { box: "h-[34px] w-[34px] rounded-[10px]", icon: "sm" as const },
  md: { box: "h-10 w-10 rounded-xl", icon: "md" as const },
  lg: { box: "h-11 w-11 rounded-2xl", icon: "lg" as const },
};

/**
 * Soft glass 3D icon tile — layered translucent gradients + sparkle accent.
 * Matches the attached glassmorphism icon style, tinted per section.
 */
export function GlassIconTile({
  icon,
  palette = "violet",
  active = false,
  size = "sm",
  className,
  sparkle = false,
}: GlassIconTileProps) {
  const p = GLASS_PALETTES[palette];
  const s = SIZES[size];

  return (
    <span
      className={cn(
        "glass-icon-tile relative flex shrink-0 items-center justify-center overflow-hidden",
        s.box,
        active && "glass-icon-tile-active",
        className
      )}
      style={
        {
          "--gi-from": p.from,
          "--gi-via": p.via,
          "--gi-to": p.to,
          "--gi-glow": p.glow,
        } as React.CSSProperties
      }
    >
      {/* Layered glass planes */}
      <span className="glass-icon-layer glass-icon-layer-back" aria-hidden />
      <span className="glass-icon-layer glass-icon-layer-mid" aria-hidden />
      <span className="glass-icon-layer glass-icon-layer-front" aria-hidden />
      {sparkle && <span className="glass-icon-sparkle" aria-hidden />}
      <Icon icon={icon} size={s.icon} className="relative z-10 text-white/90" />
    </span>
  );
}
