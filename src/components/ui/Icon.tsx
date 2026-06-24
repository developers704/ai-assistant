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
  iconBg: string;
  iconColor: string;
  activeBg?: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
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
  iconBg,
  iconColor,
  activeBg,
  active = false,
  size = "md",
  className,
}: IconBadgeProps) {
  const s = BADGE[size];

  return (
    <span
      className={cn(
        "icon-badge flex shrink-0 items-center justify-center ring-1 ring-white/15",
        s.box,
        active && activeBg ? activeBg : iconBg,
        className
      )}
    >
      <Icon icon={icon} size={s.icon} active={active} className={iconColor} />
    </span>
  );
}
