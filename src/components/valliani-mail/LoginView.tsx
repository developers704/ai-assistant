"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Inbox, Loader2 } from "lucide-react";
import { PlasmaOrb } from "@/components/ui/PlasmaOrb";
import { GlassIconTile } from "@/components/ui/GlassIconTile";

export function MailLoginView({
  onLogin,
  busy,
  error,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  busy?: boolean;
  error?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await onLogin(email.trim(), password);
  }

  return (
    <div className="relative h-full min-h-0 flex flex-col items-center justify-center px-4 py-8 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(56,189,248,0.10),transparent_55%)]"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[400px] flex flex-col items-center">
        <div className="mb-7 flex flex-col items-center text-center opacity-0 [animation:loginFade_0.55s_ease-out_forwards]">
          <div className="relative mb-4">
            <PlasmaOrb density="low" className="h-20 w-20 sm:h-24 sm:w-24" />
            <div className="absolute -bottom-1 -right-1">
              <GlassIconTile icon={Inbox} palette="sky" size="sm" active />
            </div>
          </div>
          <h1 className="text-ink text-2xl sm:text-[1.65rem] font-semibold tracking-[0.04em]">
            Valliani Mails
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted tracking-wide">
            Connect your mailbox
          </p>
        </div>

        <div className="w-full rounded-[1.75rem] bg-black/35 backdrop-blur-xl ring-1 ring-white/12 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)] p-7 sm:p-8 opacity-0 [animation:loginFade_0.65s_ease-out_0.06s_forwards]">
          <div className="mb-6">
            <h2 className="text-ink text-lg font-semibold tracking-tight">
              Mailbox sign-in
            </h2>
            <p className="mt-1 text-[13px] text-white/45">
              Use your @valliani.app email and password
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5" autoComplete="on">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
                Email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@valliani.app"
                disabled={busy}
                required
                className="mt-2 w-full rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3 text-[15px] text-ink placeholder:text-white/25 outline-none transition-[box-shadow,background-color] focus:bg-white/[0.06] focus:ring-2 focus:ring-sky-400/35 disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
                Password
              </span>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={busy}
                  required
                  className="w-full rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3 pr-12 text-[15px] text-ink placeholder:text-white/25 outline-none transition-[box-shadow,background-color] focus:bg-white/[0.06] focus:ring-2 focus:ring-sky-400/35 disabled:opacity-60"
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

            {error ? (
              <p
                className="rounded-xl bg-rose-500/10 ring-1 ring-rose-400/25 px-3.5 py-2.5 text-sm text-rose-200"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="group mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3.5 text-[15px] font-semibold text-slate-950 shadow-[0_12px_40px_-12px_rgba(56,189,248,0.55)] transition-[transform,filter,opacity] hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  Open mailbox
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-7 text-[11px] tracking-wide text-white/25 text-center">
          Session stays on this device · separate from Google Email
        </p>
      </div>
    </div>
  );
}
