"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface PlasmaOrbProps {
  /** Tailwind size classes, e.g. "h-20 w-20" */
  className?: string;
  /** Optional icon/content centered inside the sphere */
  children?: React.ReactNode;
  /** 0–1 mic/voice energy — drives ripple / glow */
  audioLevel?: number;
  /** denser field for large hero/voice orbs */
  density?: "low" | "high";
  /** kept for API compat — always renders the soft plasma sphere */
  variant?: "particles" | "css";
}

/**
 * Soft gaseous plasma sphere — cyan / violet / magenta core with outer glow.
 * Same look at every size (chat hero, voice, sidebar, avatars).
 */
export function PlasmaOrb({
  className,
  children,
  audioLevel = 0,
}: PlasmaOrbProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(0);
  const rafRef = useRef(0);
  const tRef = useRef(0);

  useEffect(() => {
    levelRef.current += (audioLevel - levelRef.current) * 0.28;
  }, [audioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const size = Math.max(wrap.clientWidth, wrap.clientHeight) || 112;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const noise = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const draw = () => {
      const size = wrap.clientWidth || 112;
      const cx = size / 2;
      const cy = size / 2;
      const R = size * 0.42;
      const level = levelRef.current;
      tRef.current += 0.012 + level * 0.035;
      const t = tRef.current;

      ctx.clearRect(0, 0, size, size);

      // Soft outer aura
      const aura = ctx.createRadialGradient(cx, cy, R * 0.35, cx, cy, R * 1.55);
      aura.addColorStop(0, `rgba(217, 70, 239, ${0.22 + level * 0.25})`);
      aura.addColorStop(0.45, `rgba(99, 102, 241, ${0.14 + level * 0.12})`);
      aura.addColorStop(0.75, `rgba(34, 211, 238, ${0.08 + level * 0.08})`);
      aura.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, size, size);

      // Clip to circle for body
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Deep body base
      const body = ctx.createRadialGradient(
        cx - R * 0.15,
        cy - R * 0.2,
        R * 0.05,
        cx,
        cy,
        R
      );
      body.addColorStop(0, "#f5d0fe");
      body.addColorStop(0.18, "#e879f9");
      body.addColorStop(0.4, "#a855f7");
      body.addColorStop(0.65, "#6366f1");
      body.addColorStop(0.85, "#0e7490");
      body.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, size, size);

      // Swirling gaseous blobs (soft plasma)
      const blobs = [
        { ox: 0.22, oy: -0.18, sc: 0.55, c0: "rgba(255,255,255,0.55)", c1: "rgba(232,121,249,0)" },
        { ox: -0.28, oy: 0.12, sc: 0.5, c0: "rgba(34,211,238,0.55)", c1: "rgba(34,211,238,0)" },
        { ox: 0.1, oy: 0.32, sc: 0.48, c0: "rgba(167,139,250,0.5)", c1: "rgba(99,102,241,0)" },
        { ox: -0.05, oy: -0.35, sc: 0.4, c0: "rgba(244,114,182,0.45)", c1: "rgba(244,114,182,0)" },
      ];

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const wobble = 1 + level * 0.18;
        const bx =
          cx +
          Math.cos(t * (0.7 + i * 0.15) + i) * R * b.ox * wobble +
          Math.sin(t * 0.9 + i * 1.7) * R * 0.06;
        const by =
          cy +
          Math.sin(t * (0.55 + i * 0.12) + i * 0.8) * R * b.oy * wobble +
          Math.cos(t * 0.7 + i) * R * 0.05;
        const br = R * b.sc * (1 + Math.sin(t * 1.2 + i) * 0.08 + level * 0.12);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, b.c0);
        g.addColorStop(1, b.c1);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fine luminous grain (gaseous feel) — scale-invariant
      const step = Math.max(2, Math.floor(size / 48));
      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.sqrt(dx * dx + dy * dy) / R;
          if (d > 0.98) continue;
          const n =
            noise(x * 0.08 + t * 2, y * 0.08 - t * 1.5) *
            noise(x * 0.03 - t, y * 0.03 + t * 0.7);
          if (n < 0.55) continue;
          const a = (1 - d) * (n - 0.55) * 1.6 * (0.35 + level * 0.4);
          ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, a)})`;
          ctx.fillRect(x, y, step * 0.7, step * 0.7);
        }
      }

      // Bright core
      const core = ctx.createRadialGradient(cx - R * 0.08, cy - R * 0.12, 0, cx, cy, R * 0.55);
      core.addColorStop(0, `rgba(255,255,255,${0.55 + level * 0.25})`);
      core.addColorStop(0.35, "rgba(253, 224, 255, 0.35)");
      core.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Rim light
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(232, 121, 249, ${0.35 + level * 0.25})`;
      ctx.lineWidth = Math.max(1, size * 0.012);
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-visible rounded-full", className)}
      aria-hidden={!children}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full rounded-full" />
      {children && (
        <span className="relative z-10 flex h-full w-full items-center justify-center">
          {children}
        </span>
      )}
    </div>
  );
}
