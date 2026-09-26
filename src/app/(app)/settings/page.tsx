"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { PageShell, PageShellHeader, PageShellBody, LushSection } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";

const fieldClass =
  "w-full px-4 py-2.5 rounded-2xl border border-white/25 bg-white/10 text-ink text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400/40";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangeOwnPassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match");
      setPasswordNotice(null);
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordNotice(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change",
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Password update failed");
        return;
      }
      setPasswordNotice(data.message || "Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Password update failed");
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <PageShell accent="violet">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Account"
          title="Settings"
          subtitle="Change the password for this account"
        />
      </PageShellHeader>

      <PageShellBody>
        <LushSection title="Change password" icon={KeyRound} className="max-w-xl">
          <div className="space-y-4">
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              shown={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((v) => !v)}
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              shown={showNewPassword}
              onToggle={() => setShowNewPassword((v) => !v)}
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              shown={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((v) => !v)}
            />

            <Button size="sm" onClick={() => void handleChangeOwnPassword()} disabled={passwordBusy}>
              {passwordBusy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              Change password
            </Button>

            {passwordError && <p className="text-sm text-rose-200">{passwordError}</p>}
            {passwordNotice && !passwordError && (
              <p className="text-sm text-emerald-200/90">{passwordNotice}</p>
            )}
          </div>
        </LushSection>
      </PageShellBody>
    </PageShell>
  );
}

function PasswordField({
  label,
  autoComplete,
  value,
  onChange,
  shown,
  onToggle,
}: {
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-secondary mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldClass} pr-12`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 hover:text-white/75 hover:bg-white/5 transition-colors"
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
