import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const variants = {
      primary: "btn-futuristic text-white hover:shadow-glow",
      secondary: "btn-glass text-ink hover:text-white",
      ghost: "text-ink-secondary hover:bg-white/10 hover:text-ink",
      danger: "bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-600 hover:to-pink-700 shadow-lg",
      outline: "border border-white/30 text-ink-secondary btn-glass hover:border-white/45 hover:text-ink",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm rounded-full",
      md: "px-4 py-2.5 text-sm rounded-full",
      lg: "px-6 py-3 text-base rounded-full",
      icon: "p-2.5 rounded-full",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
