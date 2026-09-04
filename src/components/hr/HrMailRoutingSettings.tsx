"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Settings } from "lucide-react";
import { getSavedEmail } from "@/lib/valliani-mail/session";
import {
  defaultHrMailRouting,
  formatHrMailTo,
  normalizeHrMailRouting,
  type HrMailRouting,
} from "@/lib/hr/mail-routing";

export function HrMailRoutingSettings() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultHrMailRouting().from);
  const [toText, setToText] = useState(formatHrMailTo(defaultHrMailRouting().to));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const apply = (routing: HrMailRouting) => {
    setFrom(routing.from);
    setToText(routing.to.join("\n"));
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/hr/mail-routing", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as HrMailRouting & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not load mail routing");
      apply(normalizeHrMailRouting(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load mail routing");
      apply(defaultHrMailRouting());
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/hr/mail-routing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: toText }),
      });
      const json = (await res.json().catch(() => ({}))) as HrMailRouting & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save mail routing");
      const saved = normalizeHrMailRouting(json);
      apply(saved);
      setStatus(`Saved. Send from ${saved.from} to ${saved.to.length} inbox${saved.to.length === 1 ? "" : "es"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save mail routing");
    } finally {
      setSaving(false);
    }
  };

  const signedIn = getSavedEmail();

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="hr-lock-gear"
        aria-label="Test mail routing"
        aria-expanded={open}
        title="Test mail routing"
        onClick={toggle}
      >
        <Settings size={13} />
      </button>
      {open && (
        <div className="hr-mail-panel" role="dialog" aria-label="Test mail routing">
          <div className="hr-mail-panel-head">
            <div>
              <div className="hr-mail-panel-title">Test mail routing</div>
              <p className="hr-mail-panel-sub">
                Warnings and write-ups send from one mailbox. Recipients can be several test
                inboxes.
              </p>
            </div>
          </div>
          <label className="hr-field">
            <span className="hr-field-label">From (one)</span>
            <input
              className="hr-input"
              type="email"
              autoComplete="email"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="umairj@valliani.app"
              disabled={saving}
            />
          </label>
          <label className="hr-field">
            <span className="hr-field-label">To (one or more)</span>
            <textarea
              className="hr-textarea"
              rows={4}
              value={toText}
              onChange={(e) => setToText(e.target.value)}
              placeholder={"one@example.com\ntwo@example.com"}
              disabled={saving}
            />
          </label>
          <p className="hr-mail-panel-hint">
            Separate To addresses with commas or new lines. Sign in to E-Mails as the From
            address before sending.
            {signedIn ? ` Currently signed in as ${signedIn}.` : ""}
          </p>
          {error && <p className="hr-mail-panel-error">{error}</p>}
          {status && <p className="hr-mail-panel-ok">{status}</p>}
          <div className="hr-mail-panel-actions">
            <button
              type="button"
              className="hr-btn hr-btn-outline hr-btn-sm"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="hr-btn hr-btn-primary hr-btn-sm"
              onClick={() => void save()}
              disabled={saving || loading}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
