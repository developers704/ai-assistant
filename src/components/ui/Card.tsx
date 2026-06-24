import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  /** Solid white card for high-contrast content (charts, tables). */
  solid?: boolean;
}

export function Card({ className, hover, solid, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl p-5 transition-all duration-300",
        solid ? "glass-solid text-slate-900" : "glass-panel text-ink",
        hover &&
          "hover:shadow-elevated hover:border-white/35 hover:-translate-y-0.5 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-base font-semibold text-inherit", className)} {...props}>
      {children}
    </h3>
  );
}
