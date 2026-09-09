"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DEFAULT_HR_WARNING_TEMPLATES,
  HR_WARNING_TEMPLATE_KEYS,
  type HrWarningTemplateKey,
} from "@/lib/hr/notice-settings-shared";
import type { HrNoticeSettings } from "@/lib/hr/notice-settings";

const labels: Record<HrWarningTemplateKey, string> = {
  late: "Late arrival",
  earlyOut: "Late out / left early",
  missingSchedule: "Missing schedule",
  absent: "Absent",
  missingPunch: "Missing punch",
  meal: "Meal break",
  other: "Other attendance issue",
};

export function HrNoticeSettings() {
  const [settings, setSettings] = useState<HrNoticeSettings | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/hr/notice-settings", { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not load HR notice settings");
        setSettings(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load HR notice settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/hr/notice-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, writeUpPassword: password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save HR notice settings");
      setSettings(body);
      setPassword("");
      setNotice("HR notice settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save HR notice settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-ink-muted">Loading HR notice settings…</p>;
  if (!settings) return <p className="text-sm text-rose-200">{error}</p>;

  return (
    <Section title="HR Notice Settings" description="Only users granted HR Notice Settings in Roles & Permissions can see or change these values.">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-ink-secondary">Write-up sender email<input className={fieldClass} type="email" value={settings.writeUpFrom} onChange={(e) => setSettings({ ...settings, writeUpFrom: e.target.value })} /></label>
          <label className="block text-sm font-medium text-ink-secondary">SMTP password<input className={fieldClass} type="password" placeholder={settings.writeUpPasswordConfigured ? "Saved — enter to replace" : "Enter SMTP password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label className="block text-sm font-medium text-ink-secondary">Warning chat sender email<input className={fieldClass} type="email" value={settings.warningFrom} onChange={(e) => setSettings({ ...settings, warningFrom: e.target.value })} /></label>
        </div>
        <p className="text-xs text-ink-muted">SMTP host, port, TLS, and security remain in the server environment. The password is never returned to the browser.</p>
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">Warning text templates</p>
          <p className="text-xs text-ink-muted">Available placeholders: <code>{"{{employeeName}}"}</code>, <code>{"{{date}}"}</code>, <code>{"{{lateMinutes}}"}</code>, <code>{"{{earlyOutMinutes}}"}</code>, <code>{"{{scheduledStart}}"}</code>, <code>{"{{scheduledEnd}}"}</code>.</p>
          {HR_WARNING_TEMPLATE_KEYS.map((key) => (
            <label key={key} className="block text-sm font-medium text-ink-secondary">{labels[key]}<textarea className={fieldClass} rows={2} value={settings.templates[key] || DEFAULT_HR_WARNING_TEMPLATES[key]} onChange={(e) => setSettings({ ...settings, templates: { ...settings.templates, [key]: e.target.value } })} /></label>
          ))}
        </div>
        {error && <p className="text-sm text-rose-200">{error}</p>}
        {notice && <p className="text-sm text-emerald-200">{notice}</p>}
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save HR notice settings
        </Button>
      </div>
    </Section>
  );
}

const fieldClass = "w-full mt-1 px-4 py-2.5 rounded-2xl border border-white/25 bg-white/10 text-ink text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400/40";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-2 mb-1 text-ink"><Shield size={16} /><p className="font-semibold">{title}</p></div><p className="text-xs text-ink-muted mb-4">{description}</p>{children}</div>;
}
