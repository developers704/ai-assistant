import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-white/15 text-ink-secondary border border-white/20 backdrop-blur-sm",
    success: "bg-emerald-500/20 text-emerald-100 border border-emerald-400/30",
    warning: "bg-amber-500/20 text-amber-100 border border-amber-400/30",
    danger: "bg-rose-500/20 text-rose-100 border border-rose-400/30",
    info: "bg-violet-500/25 text-violet-100 border border-violet-400/35 shadow-glow",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
