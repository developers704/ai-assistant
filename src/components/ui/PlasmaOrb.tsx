"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface PlasmaOrbProps {
  /** Tailwind size classes, e.g. "h-20 w-20" */
  className?: string;
  /** Optional icon/content centered inside the sphere */
  children?: React.ReactNode;
  /** 0–1 mic/voice energy — drives core / sparkles / rings */
  audioLevel?: number;
  /** denser field for large hero/voice orbs */
  density?: "low" | "high";
  /** kept for API compat */
  variant?: "particles" | "css";
}

/**
 * Black-diamond lumen — deep violet glass with a luminous purple heart.
 * Matches the app’s violet / fuchsia / cyan language; reacts to voice energy.
 */
export function PlasmaOrb({
  className,
  children,
  audioLevel = 0,
  density = "high",
}: PlasmaOrbProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(0);
  const rafRef = useRef(0);
  const tRef = useRef(Math.random() * 100);
  const sparksRef = useRef<
    { a: number; r: number; s: number; speed: number; tw: number }[]
  >([]);

  useEffect(() => {
    levelRef.current += (audioLevel - levelRef.current) * 0.32;
  }, [audioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const sparkCount = density === "low" ? 18 : 42;
    sparksRef.current = Array.from({ length: sparkCount }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.35 + Math.random() * 0.55,
      s: 0.4 + Math.random() * 1.4,
      speed: 0.15 + Math.random() * 0.45,
      tw: Math.random() * Math.PI * 2,
    }));

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

    const draw = () => {
      const size = wrap.clientWidth || 112;
      const cx = size / 2;
      const cy = size / 2;
      const R = size * 0.38;
      const level = levelRef.current;
      tRef.current += 0.008 + level * 0.028;
      const t = tRef.current;

      ctx.clearRect(0, 0, size, size);

      // Soft violet aura
      const aura = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.75);
      aura.addColorStop(0, `rgba(167, 139, 250, ${0.22 + level * 0.28})`);
      aura.addColorStop(0.35, `rgba(139, 92, 246, ${0.14 + level * 0.14})`);
      aura.addColorStop(0.65, `rgba(217, 70, 239, ${0.08 + level * 0.08})`);
      aura.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, size, size);

      // Orbital violet filaments
      if (density === "high" || size > 64) {
        for (let i = 0; i < 3; i++) {
          const tilt = 0.35 + i * 0.22;
          const rot = t * (0.35 + i * 0.08) + i * 1.1;
          const colors = [
            `rgba(167, 139, 250, ${0.22 + level * 0.22 - i * 0.04})`,
            `rgba(34, 211, 238, ${0.16 + level * 0.18 - i * 0.03})`,
            `rgba(232, 121, 249, ${0.18 + level * 0.2 - i * 0.04})`,
          ];
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          ctx.scale(1, tilt);
          ctx.beginPath();
          ctx.ellipse(0, 0, R * (1.12 + i * 0.08 + level * 0.06), R * (1.12 + i * 0.08), 0, 0, Math.PI * 2);
          ctx.strokeStyle = colors[i];
          ctx.lineWidth = Math.max(0.6, size * 0.004);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Gem body
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Deep indigo / near-black base
      const body = ctx.createRadialGradient(
        cx - R * 0.25,
        cy - R * 0.3,
        R * 0.05,
        cx,
        cy,
        R
      );
      body.addColorStop(0, "#2e1065");
      body.addColorStop(0.28, "#1e1b4b");
      body.addColorStop(0.55, "#0f0a1e");
      body.addColorStop(0.85, "#05030c");
      body.addColorStop(1, "#020014");
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, size, size);

      // Luminous violet heart
      const corePulse = 1 + level * 0.35 + Math.sin(t * 2.2) * 0.04;
      const coreR = R * 0.48 * corePulse;
      const coreX = cx + Math.sin(t * 0.7) * R * 0.04;
      const coreY = cy + Math.cos(t * 0.55) * R * 0.03;
      const core = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
      core.addColorStop(0, `rgba(255, 255, 255, ${0.95})`);
      core.addColorStop(0.12, `rgba(237, 233, 254, ${0.9})`);
      core.addColorStop(0.35, `rgba(196, 181, 253, ${0.8 + level * 0.12})`);
      core.addColorStop(0.55, `rgba(167, 139, 250, ${0.7 + level * 0.15})`);
      core.addColorStop(0.75, `rgba(139, 92, 246, ${0.4 + level * 0.2})`);
      core.addColorStop(1, "rgba(76, 29, 149, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Liquid plasma ribbons (violet / fuchsia / cyan)
      const ribbons = [
        { c0: "rgba(232, 121, 249,", c1: "rgba(192, 132, 252," },
        { c0: "rgba(34, 211, 238,", c1: "rgba(99, 102, 241," },
        { c0: "rgba(167, 139, 250,", c1: "rgba(217, 70, 239," },
        { c0: "rgba(244, 114, 182,", c1: "rgba(139, 92, 246," },
      ];
      for (let i = 0; i < ribbons.length; i++) {
        const ang = t * (0.4 + i * 0.12) + i * 1.6;
        const bx = cx + Math.cos(ang) * R * (0.15 + i * 0.08);
        const by = cy + Math.sin(ang * 1.3) * R * (0.2 + i * 0.06);
        const br = R * (0.28 + level * 0.1) * (0.7 + (i % 2) * 0.25);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, `${ribbons[i].c0}${0.32 + level * 0.22})`);
        g.addColorStop(0.5, `${ribbons[i].c1}${0.14})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      // Facet gleam
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const facet = ctx.createLinearGradient(
        cx - R,
        cy - R,
        cx + R * 0.4,
        cy + R * 0.6
      );
      facet.addColorStop(0, "rgba(255,255,255,0.24)");
      facet.addColorStop(0.25, "rgba(221, 214, 254, 0.1)");
      facet.addColorStop(0.5, "rgba(0,0,0,0)");
      facet.addColorStop(0.75, "rgba(167, 139, 250, 0.08)");
      facet.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = facet;
      ctx.fillRect(0, 0, size, size);
      ctx.restore();

      // Diamond dust
      for (const sp of sparksRef.current) {
        sp.a += sp.speed * 0.008 * (1 + level * 2);
        sp.tw += 0.05;
        const sr = R * sp.r * (0.92 + level * 0.12);
        const sx = cx + Math.cos(sp.a + t * 0.2) * sr;
        const sy = cy + Math.sin(sp.a * 0.9 + t * 0.15) * sr * 0.92;
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(sp.tw));
        const a = twinkle * (0.35 + level * 0.55) * (density === "low" ? 0.7 : 1);
        const ss = Math.max(0.6, (size * 0.006) * sp.s * (1 + level));
        ctx.fillStyle = `rgba(237, 233, 254, ${a})`;
        ctx.beginPath();
        ctx.arc(sx, sy, ss, 0, Math.PI * 2);
        ctx.fill();
        if (a > 0.55 && size > 48) {
          ctx.strokeStyle = `rgba(196, 181, 253, ${a * 0.7})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(sx - ss * 2.2, sy);
          ctx.lineTo(sx + ss * 2.2, sy);
          ctx.moveTo(sx, sy - ss * 2.2);
          ctx.lineTo(sx, sy + ss * 2.2);
          ctx.stroke();
        }
      }

      // Specular highlight
      const spec = ctx.createRadialGradient(
        cx - R * 0.32,
        cy - R * 0.38,
        0,
        cx - R * 0.32,
        cy - R * 0.38,
        R * 0.42
      );
      spec.addColorStop(0, "rgba(255,255,255,0.78)");
      spec.addColorStop(0.2, "rgba(237, 233, 254, 0.35)");
      spec.addColorStop(0.55, "rgba(255,255,255,0.04)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(cx - R * 0.32, cy - R * 0.38, R * 0.42, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Violet rim
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, `rgba(237, 233, 254, ${0.55 + level * 0.3})`);
      rim.addColorStop(0.35, `rgba(167, 139, 250, ${0.45 + level * 0.2})`);
      rim.addColorStop(0.65, `rgba(217, 70, 239, ${0.35 + level * 0.15})`);
      rim.addColorStop(1, `rgba(34, 211, 238, ${0.4 + level * 0.2})`);
      ctx.strokeStyle = rim;
      ctx.lineWidth = Math.max(1.2, size * 0.014);
      ctx.stroke();

      // Inner hairline
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + level * 0.08})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [density]);

  return (
    <div
      ref={wrapRef}
      className={cn("lumen-orb relative overflow-visible rounded-full", className)}
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
