"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface PlasmaOrbProps {
  /** Tailwind size classes, e.g. "h-20 w-20" */
  className?: string;
  /** Optional icon/content centered inside the sphere */
  children?: React.ReactNode;
  /** 0–1 mic/voice energy — drives ripple amplitude */
  audioLevel?: number;
  /** denser particle field for large hero/voice orbs */
  density?: "low" | "high";
  /**
   * particles = magenta point-cloud sphere (voice/hero)
   * css = lightweight gradient orb (avatars / sidebar)
   */
  variant?: "particles" | "css";
}

/** Hash-based 3D value noise (cheap, no deps) */
function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, z: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);

  const n000 = hash3(x0, y0, z0);
  const n100 = hash3(x0 + 1, y0, z0);
  const n010 = hash3(x0, y0 + 1, z0);
  const n110 = hash3(x0 + 1, y0 + 1, z0);
  const n001 = hash3(x0, y0, z0 + 1);
  const n101 = hash3(x0 + 1, y0, z0 + 1);
  const n011 = hash3(x0, y0 + 1, z0 + 1);
  const n111 = hash3(x0 + 1, y0 + 1, z0 + 1);

  const nx00 = n000 * (1 - u) + n100 * u;
  const nx10 = n010 * (1 - u) + n110 * u;
  const nx01 = n001 * (1 - u) + n101 * u;
  const nx11 = n011 * (1 - u) + n111 * u;
  const nxy0 = nx00 * (1 - v) + nx10 * v;
  const nxy1 = nx01 * (1 - v) + nx11 * v;
  return nxy0 * (1 - w) + nxy1 * w;
}

function fbm(x: number, y: number, z: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    sum += amp * smoothNoise(x * freq, y * freq, z * freq);
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum;
}

type Particle = { theta: number; phi: number; jitter: number };

function CssPlasmaOrb({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("plasma-orb", className)} aria-hidden={!children}>
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="electric-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" result="noise" seed="2">
              <animate attributeName="baseFrequency" values="0.06;0.08;0.06" dur="3s" repeatCount="indefinite" />
            </feTurbulence>
            <feColorMatrix
              type="matrix"
              values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 20 -8"
              in="noise"
              result="highContrast"
            />
            <feComposite operator="in" in="SourceGraphic" in2="highContrast" result="composite" />
          </filter>
        </defs>
      </svg>
      <span className="plasma-lightning" />
      <span className="plasma-lightning-b" />
      <span className="plasma-core" />
      <span className="plasma-shine" />
      {children && (
        <span className="relative z-10 flex h-full w-full items-center justify-center">{children}</span>
      )}
    </div>
  );
}

/**
 * Magenta particle plasma sphere — rippled point-cloud matching the reference.
 * audioLevel boosts displacement so the orb vibrates when the user speaks.
 */
export function PlasmaOrb({
  className,
  children,
  audioLevel = 0,
  density = "low",
  variant = "css",
}: PlasmaOrbProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const tRef = useRef(0);

  useEffect(() => {
    levelRef.current += (audioLevel - levelRef.current) * 0.35;
  }, [audioLevel]);

  useEffect(() => {
    if (variant !== "particles") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const count = density === "high" ? 3800 : 900;
    const particles: Particle[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const theta = golden * i;
      particles.push({
        theta,
        phi: Math.acos(Math.max(-1, Math.min(1, y))),
        jitter: Math.random(),
      });
    }
    particlesRef.current = particles;

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

    const drawn: { x: number; y: number; z: number; n: number; j: number }[] = [];

    const draw = () => {
      const size = wrap.clientWidth || 112;
      const cx = size / 2;
      const cy = size / 2;
      const baseR = size * 0.38;
      const level = levelRef.current;
      tRef.current += 0.008 + level * 0.045;
      const t = tRef.current;

      ctx.clearRect(0, 0, size, size);

      const glow = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, baseR * 1.55);
      glow.addColorStop(0, `rgba(232, 121, 249, ${0.18 + level * 0.28})`);
      glow.addColorStop(0.55, `rgba(168, 85, 247, ${0.1 + level * 0.14})`);
      glow.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.05);
      core.addColorStop(0, "rgba(40, 8, 55, 0.95)");
      core.addColorStop(0.45, "rgba(88, 28, 135, 0.55)");
      core.addColorStop(1, "rgba(2, 6, 23, 0.15)");
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 1.02, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      const rotY = t * 0.35;
      const rotX = Math.sin(t * 0.22) * 0.25;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const amp = 0.1 + level * 0.32;
      const pts = particlesRef.current;

      drawn.length = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        let x = Math.sin(p.phi) * Math.cos(p.theta);
        let y = Math.cos(p.phi);
        let z = Math.sin(p.phi) * Math.sin(p.theta);

        const n = fbm(x * 2.2 + t * 0.4, y * 2.2 + t * 0.25, z * 2.2 + t * 0.35) * 2 - 1;
        const ripple =
          1 + n * amp + Math.sin(p.phi * 6 + t * 2.2 + p.jitter) * amp * 0.35;
        x *= ripple;
        y *= ripple;
        z *= ripple;

        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        drawn.push({ x: x1, y: y1, z: z2, n, j: p.jitter });
      }
      drawn.sort((a, b) => a.z - b.z);

      for (let i = 0; i < drawn.length; i++) {
        const d = drawn[i];
        const depth = (d.z + 1) * 0.5;
        const px = cx + d.x * baseR;
        const py = cy + d.y * baseR;
        const sizeDot = (0.55 + depth * 1.35) * (density === "high" ? 1.05 : 0.95);
        const bright = 0.25 + depth * 0.75 + Math.max(0, d.n) * 0.35 + level * 0.2;
        const r = Math.floor(180 + bright * 75);
        const g = Math.floor(40 + bright * 40 + d.j * 20);
        const b = Math.floor(200 + bright * 55);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.35 + depth * 0.55})`;
        ctx.beginPath();
        ctx.arc(px, py, sizeDot, 0, Math.PI * 2);
        ctx.fill();
      }

      const shine = ctx.createRadialGradient(
        cx - baseR * 0.35,
        cy - baseR * 0.4,
        0,
        cx - baseR * 0.35,
        cy - baseR * 0.4,
        baseR * 0.55
      );
      shine.addColorStop(0, "rgba(255,255,255,0.22)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [density, variant]);

  if (variant === "css") {
    return <CssPlasmaOrb className={className}>{children}</CssPlasmaOrb>;
  }

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-hidden rounded-full", className)}
      aria-hidden={!children}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {children && (
        <span className="relative z-10 flex h-full w-full items-center justify-center">
          {children}
        </span>
      )}
    </div>
  );
}
