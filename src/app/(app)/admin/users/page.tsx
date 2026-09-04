"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Shield, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/Sidebar";
import { PageShell, PageShellBody, PageShellHeader } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type RoleId = "admin" | "employee" | "hr" | "dm";

type DirectoryUser = {
  username: string;
  name: string;
  email: string;
  role: RoleId;
  roleLabel: string;
  title: string;
  storeCodes: string[];
  employeeCode: string;
  designation: string;
  protected: boolean;
};

type StoreOption = { code: string; label: string };

const fieldClass =
  "w-full px-3 py-2.5 rounded-xl border border-white/20 bg-white/10 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30";

const emptyForm = {
  username: "",
  email: "",
  name: "",
  password: "",
  role: "employee" as RoleId,
  employeeCode: "",
  designation: "",
  storeCodes: [] as string[],
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [roles, setRoles] = useState<{ id: RoleId; label: string }[]>([]);
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<DirectoryUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load users");
      setUsers(json.users ?? []);
      setRoles(json.roles ?? []);
      setStoreOptions(json.storeOptions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.employeeCode.toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowPassword(false);
    setModal("create");
  };

  const openEdit = (user: DirectoryUser) => {
    setEditing(user);
    setForm({
      username: user.username,
      email: user.email,
      name: user.name,
      password: "",
      role: user.role,
      employeeCode: user.employeeCode,
      designation: user.designation,
      storeCodes: user.storeCodes,
    });
    setShowPassword(false);
    setModal("edit");
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        name: form.name.trim(),
        role: form.role,
        employeeCode: form.employeeCode,
        designation: form.designation,
        storeCodes: form.storeCodes,
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
      };
      const res = await fetch("/api/admin/users", {
        method: modal === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save user");
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save user");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (user: DirectoryUser) => {
    if (user.protected) return;
    if (!window.confirm(`Delete ${user.name} (@${user.username})? This cannot be undone.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/users?username=${encodeURIComponent(user.username)}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not delete user");
      return;
    }
    await load();
  };

  const initials = (name: string) => {
    const parts = name.replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    return (name.slice(0, 2) || "?").toUpperCase();
  };

  return (
    <PageShell>
      <PageShellHeader>
        <PageHeader
          title="Users"
          subtitle="Manage user accounts and permissions."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} /> Create User
            </Button>
          }
        />
      </PageShellHeader>
      <PageShellBody>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-ink">All Users</p>
            <p className="text-xs text-ink-muted">{users.length} total users</p>
          </div>
          <div className="flex flex-1 sm:max-w-xl gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, username…"
                className={`${fieldClass} pl-9`}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={`${fieldClass} sm:w-44`}
            >
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20">
          <div className="grid grid-cols-[1fr_8rem_7rem] sm:grid-cols-[1fr_10rem_8rem] gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wide text-ink-muted border-b border-white/10">
            <span>User</span>
            <span>Role</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <p className="px-4 py-8 text-sm text-ink-muted">Loading users…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm text-ink-muted">No users match this search.</p>
          ) : (
            filtered.map((user) => (
              <div
                key={user.username}
                className="grid grid-cols-[1fr_8rem_7rem] sm:grid-cols-[1fr_10rem_8rem] gap-2 items-center px-4 py-3 border-t border-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-9 w-9 shrink-0 rounded-full bg-violet-500/20 text-violet-100 text-xs font-semibold inline-flex items-center justify-center">
                    {initials(user.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">{user.name}</div>
                    <div className="text-[11px] text-ink-muted truncate">{user.email || "—"}</div>
                    <div className="text-[11px] text-ink-muted">@{user.username}</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                  <Shield size={12} /> {user.roleLabel}
                </span>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-white/10 text-ink-secondary"
                    aria-label={`Edit ${user.name}`}
                    onClick={() => openEdit(user)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-rose-500/15 text-rose-300 disabled:opacity-30"
                    aria-label={`Delete ${user.name}`}
                    disabled={user.protected}
                    onClick={() => void remove(user)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </PageShellBody>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0b1220] p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {modal === "create" ? "Create User" : "Edit User"}
                </h2>
                <p className="text-xs text-ink-muted">
                  {modal === "create"
                    ? "Add a new user account to the platform."
                    : "Update this account. Leave password blank to keep the current one."}
                </p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="p-1 text-ink-muted">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Username"
                value={form.username}
                disabled={modal === "edit"}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
              <Input
                label="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Full Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  placeholder={modal === "edit" ? "Leave blank to keep" : ""}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                  />
                  Show password
                </label>
              </div>
              <label className="block text-sm">
                <span className="block text-ink-secondary mb-1.5">Role</span>
                <select
                  className={fieldClass}
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RoleId }))}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Code"
                value={form.employeeCode}
                onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
              />
              <Input
                label="Designation"
                value={form.designation}
                onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              />
              <label className="sm:col-span-2 block text-sm">
                <span className="block text-ink-secondary mb-1.5">Store</span>
                {form.role === "dm" ? (
                  <select
                    multiple
                    className={`${fieldClass} min-h-[7.5rem]`}
                    value={form.storeCodes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        storeCodes: Array.from(e.target.selectedOptions).map((o) => o.value),
                      }))
                    }
                  >
                    {storeOptions.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className={fieldClass}
                    value={form.storeCodes[0] ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        storeCodes: e.target.value ? [e.target.value] : [],
                      }))
                    }
                  >
                    <option value="">Select store</option>
                    {storeOptions.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                {modal === "create" ? "Create User" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
