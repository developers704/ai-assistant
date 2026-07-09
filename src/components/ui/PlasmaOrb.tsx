import { cn } from "@/lib/utils";

interface PlasmaOrbProps {
  /** Tailwind size classes, e.g. "h-20 w-20" */
  className?: string;
  /** Optional icon/content centered inside the sphere */
  children?: React.ReactNode;
}

/**
 * 3D Electric Plasma Sphere — Futuristic energy orb.
 * Uses an inline SVG turbulence filter combined with CSS radial gradients
 * and color-dodge blending to create a realistic electric/lightning effect.
 */
export function PlasmaOrb({ className, children }: PlasmaOrbProps) {
  return (
    <div className={cn("plasma-orb", className)} aria-hidden>
      {/* SVG Filter for Electric/Plasma Texture */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="electric-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="4" result="noise" seed="1">
              <animate attributeName="baseFrequency" values="0.025;0.035;0.025" dur="8s" repeatCount="indefinite" />
            </feTurbulence>
            <feColorMatrix type="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 30 -12" in="noise" result="highContrast" />
            <feComposite operator="in" in="SourceGraphic" in2="highContrast" result="composite" />
          </filter>
        </defs>
      </svg>

      <span className="plasma-lightning" />
      <span className="plasma-lightning-b" />
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
