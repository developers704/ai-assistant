"use client";

/**
 * Ambient gradient orbs + dot grid for the futuristic glass theme.
 */
export function FuturisticBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-mesh-gradient" />
      <div className="absolute inset-0 bg-dot-grid opacity-20" />
      {/* Keep orbs in corners only — less wash-out on content */}
      <div className="orb orb-purple -top-32 -left-32 w-[280px] h-[280px]" />
      <div className="orb orb-blue top-[8%] -right-40 w-[240px] h-[240px]" />
      <div className="orb orb-orange -bottom-32 left-[15%] w-[220px] h-[220px]" />
    </div>
  );
}
