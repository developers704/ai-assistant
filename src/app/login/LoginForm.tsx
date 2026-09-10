"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { FuturisticBackground } from "@/components/layout/FuturisticBackground";
import { PlasmaOrb } from "@/components/ui/PlasmaOrb";

export default function LoginForm() {
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Invalid credentials");
        return;
      }
      const body = await res.json().catch(() => ({}));
      const next = search.get("next");
      const dest =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : typeof body.homePath === "string"
            ? body.homePath
            : "/sales";
      // Full navigation so AppProvider reloads with the new session cookie
      // (client router.replace left isAuthenticated=false → "Sign in required" flash).
      window.location.assign(dest);
      return;
    } catch {
      setError("Could not sign in. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <FuturisticBackground />

      {/* Soft vignette so the card reads as one composition */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(56,189,248,0.12),transparent_55%)]"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex flex-col items-center text-center opacity-0 [animation:loginFade_0.55s_ease-out_forwards]">
          <PlasmaOrb density="low" className="h-24 w-24 sm:h-28 sm:w-28 shrink-0 mb-5" />
          <h1 className="text-ink text-3xl font-semibold tracking-[0.04em]">
            Valliani Athena
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted tracking-wide">
            Executive assistance
          </p>
        </div>

        <div className="w-full max-w-[400px] rounded-[1.75rem] bg-black/35 backdrop-blur-xl ring-1 ring-white/12 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)] p-7 sm:p-8 opacity-0 [animation:loginFade_0.65s_ease-out_0.06s_forwards]">
          <div className="mb-6">
            <h2 className="text-ink text-lg font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-[13px] text-white/45">
              Sign in with your Valliani account
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" autoComplete="on">
            <label className="block group">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
                Username
              </span>
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3 text-[15px] text-ink placeholder:text-white/25 outline-none transition-[box-shadow,background-color] focus:bg-white/[0.06] focus:ring-2 focus:ring-sky-400/35"
                placeholder="Enter username"
                required
              />
            </label>

            <label className="block group">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
                Password
              </span>
              <div className="relative mt-2">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3 pr-12 text-[15px] text-ink placeholder:text-white/25 outline-none transition-[box-shadow,background-color] focus:bg-white/[0.06] focus:ring-2 focus:ring-sky-400/35"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && (
              <p
                className="rounded-xl bg-rose-500/10 ring-1 ring-rose-400/25 px-3.5 py-2.5 text-sm text-rose-200"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3.5 text-[15px] font-semibold text-slate-950 shadow-[0_12px_40px_-12px_rgba(56,189,248,0.55)] transition-[transform,filter,opacity] hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-8 text-[11px] tracking-wide text-white/25">
          Valliani Jewelers · private access
        </p>
      </div>
    </div>
  );
}
