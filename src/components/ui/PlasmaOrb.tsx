import { cn } from "@/lib/utils";

interface PlasmaOrbProps {
  /** Tailwind size classes, e.g. "h-20 w-20" */
  className?: string;
  /** Optional icon/content centered inside the sphere */
  children?: React.ReactNode;
}

/**
 * 3D Siri-style plasma energy sphere — pure CSS.
 * Layers: sphere shading → two counter-rotating energy swirls →
 * breathing core → glassy specular highlight.
 */
export function PlasmaOrb({ className, children }: PlasmaOrbProps) {
  return (
    <div className={cn("plasma-orb", className)} aria-hidden>
      <span className="plasma-swirl-a" />
      <span className="plasma-swirl-b" />
      <span className="plasma-core" />
      <span className="plasma-shine" />
      {children && (
        <span className="relative z-10 flex h-full w-full items-center justify-center">
          {children}
        </span>
      )}
    </div>
  );
}
