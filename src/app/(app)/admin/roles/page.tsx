"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Shield, X } from "lucide-react";
import { PageHeader } from "@/components/layout/Sidebar";
import { PageShell, PageShellBody, PageShellHeader } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import type { UserPermissionKey, UserPermissionMap } from "@/lib/auth/user-permissions";

type RoleRow = {
  id: "admin" | "employee" | "hr" | "dm";
  label: string;
  description: string;
  permissions: UserPermissionMap;
};

type Section = { key: UserPermissionKey; label: string; description: string };

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [draft, setDraft] = useState<UserPermissionMap | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/roles", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load roles");
      setRoles(json.roles ?? []);
      setSections(json.sections ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!editing || !draft) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editing.id, permissions: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save");
      setNotice(`Saved ${editing.label} permissions.`);
      setEditing(null);
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageShellHeader>
        <PageHeader title="Roles & Permissions" subtitle="Manage user roles and their permissions." />
      </PageShellHeader>
      <PageShellBody>
        {error && (
          <p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-emerald-200 mb-3">{notice}</p>}
        <div className="mb-3">
          <p className="text-sm font-semibold text-ink">Roles</p>
          <p className="text-xs text-ink-muted">{roles.length} roles configured.</p>
        </div>
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20">
          <div className="grid grid-cols-[10rem_1fr_11rem] gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wide text-ink-muted border-b border-white/10">
            <span>Role</span>
            <span>Description</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <p className="px-4 py-8 text-sm text-ink-muted">Loading roles…</p>
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                className="grid grid-cols-[10rem_1fr_11rem] gap-2 items-center px-4 py-3 border-t border-white/5"
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <Shield size={14} /> {role.label}
                </span>
                <span className="text-sm text-ink-muted">{role.description}</span>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(role);
                      setDraft(role.permissions);
                    }}
                  >
                    <KeyRound size={14} /> Permissions
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {editing && draft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0b1220] p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-ink">{editing.label} permissions</h2>
              <p className="text-xs text-ink-muted mb-4">
                {editing.id === "admin"
                  ? "Admin always has full access. These switches cannot be turned off."
                  : editing.description}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sections.map((section) => (
                  <label
                    key={section.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-ink-secondary">{section.label}</div>
                      <div className="text-[10px] text-ink-muted">{section.description}</div>
                    </div>
                    <button
                      type="button"
                      disabled={editing.id === "admin"}
                      onClick={() =>
                        setDraft((prev) =>
                          prev ? { ...prev, [section.key]: !prev[section.key] } : prev
                        )
                      }
                      className={
                        "flex h-8 w-8 items-center justify-center rounded-lg border " +
                        (draft[section.key]
                          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                          : "border-white/10 bg-white/5 text-ink-muted") +
                        (editing.id === "admin" ? " opacity-60 cursor-not-allowed" : "")
                      }
                      aria-label={`${section.label} ${draft[section.key] ? "enabled" : "disabled"}`}
                    >
                      {draft[section.key] ? <Check size={15} /> : <X size={15} />}
                    </button>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void save()}
                  disabled={saving || editing.id === "admin"}
                >
                  Save permissions
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageShellBody>
    </PageShell>
  );
}
