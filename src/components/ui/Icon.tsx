import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** Pixel-aligned Lucide sizes for sharp rendering on retina displays. */
export const ICON_SIZES = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  "2xl": 28,
} as const;

export type IconSize = keyof typeof ICON_SIZES;

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize | number;
  strokeWidth?: number;
  className?: string;
  /** Slightly bolder stroke for active / emphasis states */
  active?: boolean;
}

/**
 * Crisp Lucide wrapper — consistent stroke, geometric precision, retina-friendly sizes.
 */
export function Icon({
  icon: LucideIcon,
  size = "md",
  strokeWidth,
  className,
  active = false,
}: IconProps) {
  const px = typeof size === "number" ? size : ICON_SIZES[size];
  const sw = strokeWidth ?? (active ? 2.25 : 2);

  return (
    <LucideIcon
      size={px}
      strokeWidth={sw}
      absoluteStrokeWidth
      className={cn("icon-crisp shrink-0", className)}
      aria-hidden
    />
  );
}

export interface IconBadgeProps {
  icon: LucideIcon;
  iconBg?: string;
  /** Gradient stops, e.g. `from-violet-500 to-indigo-600` — enables lush style when set. */
  gradient?: string;
  iconColor: string;
  activeBg?: string;
  glow?: string;
  activeGlow?: string;
  ringColor?: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "lush";
  className?: string;
}

const BADGE = {
  sm: { box: "h-8 w-8 rounded-lg", icon: "sm" as const },
  md: { box: "h-9 w-9 rounded-xl", icon: "md" as const },
  lg: { box: "h-11 w-11 rounded-2xl", icon: "lg" as const },
} as const;

/** Colored icon tile used in sidebar, section headers, and widgets. */
export function IconBadge({
  icon,
  iconBg = "bg-white/10",
  gradient,
  iconColor,
  activeBg,
  glow,
  activeGlow,
  ringColor,
  active = false,
  size = "md",
  variant = "default",
  className,
}: IconBadgeProps) {
  const s = BADGE[size];
  const isLush = variant === "lush" || !!gradient;

  return (
    <span
      className={cn(
        "icon-badge flex shrink-0 items-center justify-center transition-all duration-300",
        isLush ? "icon-badge-lush" : "ring-1",
        s.box,
        gradient
          ? cn("bg-gradient-to-br", gradient, active && "icon-badge-lush-active")
          : cn(active && activeBg ? activeBg : iconBg),
        ringColor ? cn("ring-1", ringColor) : !isLush && "ring-white/12",
        isLush && glow && !active && glow,
        isLush && active && activeGlow && activeGlow,
        className
      )}
    >
      <Icon icon={icon} size={s.icon} active={active} className={iconColor} />
    </span>
  );
}
