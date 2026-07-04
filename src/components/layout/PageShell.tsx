"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/* ── Page header (classy gradient) ── */

export function PageHeader({
  title,
  subtitle,
  action,
  compact,
  eyebrow,
  gradient,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  eyebrow?: string;
  gradient?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3",
        compact ? "mb-0" : "mb-0"
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40 mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            "font-display font-bold tracking-tight leading-tight",
            compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl lg:text-[1.75rem]",
            gradient ? "text-gradient-title" : "text-ink"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-white/40 mt-1 text-xs sm:text-sm leading-relaxed max-w-xl">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/* ── Full-page glass shell with ambient glow ── */

const SHELL_ACCENTS = {
  violet: "from-violet-600/15 via-transparent to-fuchsia-600/8",
  emerald: "from-emerald-600/12 via-transparent to-cyan-600/6",
  amber: "from-amber-500/12 via-transparent to-orange-600/6",
  rose: "from-rose-600/12 via-transparent to-violet-600/6",
  sky: "from-sky-500/12 via-transparent to-indigo-600/6",
  indigo: "from-indigo-600/12 via-transparent to-violet-600/6",
} as const;

export function PageShell({
  children,
  accent = "violet",
  className,
}: {
  children: React.ReactNode;
  accent?: keyof typeof SHELL_ACCENTS;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col min-h-0 relative", className)}>
      <div className="glass-panel-strong rounded-2xl sm:rounded-3xl ring-1 ring-white/[0.08] overflow-hidden relative">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
            SHELL_ACCENTS[accent]
          )}
        />
        <div className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-fuchsia-500/8 blur-3xl" />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

export function PageShellHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 sm:px-6 pt-5 pb-4 border-b border-white/[0.06]", className)}>
      {children}
    </div>
  );
}

export function PageShellBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 sm:px-6 py-5 space-y-5 sm:space-y-6", className)}>{children}</div>
  );
}

/* ── Section heading with icon ── */

export function SectionHeading({
  title,
  icon: Icon,
  iconClass,
  action,
}: {
  title: string;
  icon: LucideIcon;
  iconClass?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl ring-1 ring-white/10",
            iconClass ?? "bg-white/[0.06] text-white/60"
          )}
        >
          <Icon size={15} strokeWidth={1.75} />
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/55">{title}</h3>
      </div>
      {action}
    </div>
  );
}

/* ── Lush content panel ── */

export function LushPanel({
  children,
  className,
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.025] backdrop-blur-sm",
        padding && "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── KPI metric card ── */

export function LushMetric({
  label,
  value,
  footer,
  accent = "default",
}: {
  label: string;
  value: string;
  footer?: React.ReactNode;
  accent?: "default" | "emerald" | "amber" | "violet" | "sky";
}) {
  const valueColors = {
    default: "text-white",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    violet: "text-violet-200",
    sky: "text-sky-300",
  };
  return (
    <div className="rounded-2xl ring-1 ring-white/[0.08] bg-white/[0.03] p-4 sm:p-5 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/[0.03] blur-2xl" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35 relative">{label}</p>
      <p className={cn("text-2xl sm:text-3xl font-bold mt-1.5 tabular-nums tracking-tight relative", valueColors[accent])}>
        {value}
      </p>
      {footer && <div className="mt-2 relative text-sm">{footer}</div>}
    </div>
  );
}

/* ── Tab bar ── */

export function LushTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: LucideIcon; color?: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-black/20 ring-1 ring-white/[0.06] w-fit">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all",
              isActive
                ? "bg-gradient-to-br from-white/[0.12] to-white/[0.04] text-white ring-1 ring-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
            )}
          >
            {Icon && (
              <Icon size={14} strokeWidth={1.75} className={isActive ? t.color : undefined} />
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Settings / form section card ── */

export function LushSection({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl ring-1 ring-white/[0.08] bg-white/[0.03] p-5", className)}>
      <div className="flex items-center gap-2.5 mb-4">
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/12 ring-1 ring-violet-400/20">
            <Icon size={15} className="text-violet-300" strokeWidth={1.75} />
          </span>
        )}
        <h3 className="text-sm font-semibold text-white/85">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ── Empty state ── */

export function LushEmpty({
  message,
  icon: Icon,
}: {
  message: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-2xl ring-1 ring-dashed ring-white/[0.08] bg-white/[0.02] py-10 px-6 text-center">
      {Icon && (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10 mb-3">
          <Icon size={20} className="text-white/30" />
        </span>
      )}
      <p className="text-sm text-white/35">{message}</p>
    </div>
  );
}
