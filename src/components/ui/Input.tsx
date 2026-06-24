import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full px-4 py-2.5 rounded-2xl border border-white/25 bg-white/10 text-ink backdrop-blur-md",
            "placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent-purple/40 focus:border-accent-purple/50",
            "transition-all duration-200",
            error && "border-accent-rose focus:ring-accent-rose/30 focus:border-accent-rose",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-accent-rose">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
