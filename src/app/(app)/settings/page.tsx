"use client";



import { useEffect, useState, Suspense } from "react";

import { useSearchParams } from "next/navigation";

import { useApp } from "@/lib/store/app-context";

import { PageHeader } from "@/components/layout/Sidebar";

import { PageShell, PageShellHeader, PageShellBody, LushSection } from "@/components/layout/PageShell";

import { Button } from "@/components/ui/Button";

import { Input } from "@/components/ui/Input";

import { Badge } from "@/components/ui/Badge";

import { Save, Brain, Shield, Link2, Unlink, Loader2, User, Plug, Check, X, KeyRound, RefreshCw, Copy } from "lucide-react";
import {
  USER_PERMISSION_SECTIONS,
  canManageDmPermissions,
  getDefaultPermissionMapForRole,
  type UserPermissionMap,
} from "@/lib/auth/user-permissions";



const fieldClass =

  "w-full px-4 py-2.5 rounded-2xl border border-white/25 bg-white/10 text-ink text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400/40";



function SectionCard({

  title,

  icon: Icon,

  children,

  className,

}: {

  title: string;

  icon?: typeof User;

  children: React.ReactNode;

  className?: string;

}) {

  return (

    <LushSection title={title} icon={Icon} className={className}>

      {children}

    </LushSection>

  );

}



export default function SettingsPage() {

  return (

    <Suspense

      fallback={

        <div className="glass-panel-strong rounded-3xl p-8 text-ink-muted text-sm ring-1 ring-white/10">

          Loading settings…

        </div>

      }

    >

      <SettingsContent />

    </Suspense>

  );

}



function SettingsContent() {

  const { state, updateProfile, refresh } = useApp();

  const searchParams = useSearchParams();

  const [saved, setSaved] = useState(false);

  const [googleNotice, setGoogleNotice] = useState<string | null>(null);

  const [disconnecting, setDisconnecting] = useState(false);

  const [socialDisconnecting, setSocialDisconnecting] = useState(false);

  const [socialNotice, setSocialNotice] = useState<string | null>(null);

  const [socialStatus, setSocialStatus] = useState<{
    connected: boolean;
    hasToken: boolean;
    disconnected?: boolean;
    purged?: boolean;
    canReconnect?: boolean;
  } | null>(null);

  const [socialLoading, setSocialLoading] = useState(true);

  const [profile, setProfile] = useState({

    name: "",

    email: "",

    role: "",

    company: "",

    companyDescription: "",

    communicationStyle: "professional" as "formal" | "professional" | "casual",

    priorities: "",

    confirmBeforeSend: true,

    confirmBeforeCall: true,

    confirmBeforeMeeting: true,

    voiceEnabled: true,

    defaultCallApp: "magicapp" as "sim" | "magicapp",

  });

  const [permissionUser, setPermissionUser] = useState<string>("aj");
  const [permissionDraft, setPermissionDraft] = useState<UserPermissionMap>(
    getDefaultPermissionMapForRole("dm")
  );
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const canEditPermissions = canManageDmPermissions(state?.user?.username);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [adminTarget, setAdminTarget] = useState("aj");
  const [adminReveals, setAdminReveals] = useState<
    Array<{
      username: string;
      name: string;
      role: string;
      title: string;
      password: string | null;
      updatedAt: string | null;
      updatedBy: string | null;
      source: string | null;
    }>
  >([]);



  useEffect(() => {

    if (state?.user) {

      setProfile({

        name: state.user.name,

        email: state.user.email,

        role: state.user.role,

        company: state.user.company,

        companyDescription: state.user.companyDescription,

        communicationStyle: state.user.communicationStyle,

        priorities: state.user.priorities.join("\n"),

        confirmBeforeSend: state.user.preferences.confirmBeforeSend,

        confirmBeforeCall: state.user.preferences.confirmBeforeCall,

        confirmBeforeMeeting: state.user.preferences.confirmBeforeMeeting,

        voiceEnabled: state.user.preferences.voiceEnabled,

        defaultCallApp: state.user.preferences.defaultCallApp ?? "magicapp",

      });

      if (canManageDmPermissions(state.user.username)) {
        setPermissionUser((prev) => prev || "aj");
      }

    }

  }, [state?.user]);

  useEffect(() => {
    if (!canManageDmPermissions(state?.user?.username)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/permissions");
        if (!res.ok) return;
        const data = (await res.json()) as {
          users?: Array<{ username: string; permissions: UserPermissionMap }>;
        };
        const row = data.users?.find((u) => u.username === permissionUser);
        if (!cancelled && row?.permissions) {
          setPermissionDraft(row.permissions);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permissionUser, state?.user?.username]);



  useEffect(() => {

    const google = searchParams.get("google");

    const reason = searchParams.get("reason");

    if (google === "connected") {

      setGoogleNotice("Google account connected successfully.");

      refresh();

    } else if (google === "error") {

      const messages: Record<string, string> = {

        auth_denied: "Google sign-in was cancelled or denied.",

        not_configured: "Google OAuth is not configured on the server.",

        token_exchange: "Could not complete Google sign-in. Try again.",

      };

      setGoogleNotice(messages[reason ?? ""] ?? "Google connection failed.");

    }

  }, [searchParams, refresh]);



  useEffect(() => {

    let cancelled = false;

    (async () => {

      try {

        const res = await fetch("/api/social/instagram/status", { cache: "no-store" });

        if (!res.ok) return;

        const data = (await res.json()) as {
          connected: boolean;
          hasToken: boolean;
          disconnected?: boolean;
          purged?: boolean;
          canReconnect?: boolean;
        };

        if (!cancelled) setSocialStatus(data);

      } finally {

        if (!cancelled) setSocialLoading(false);

      }

    })();

    return () => {

      cancelled = true;

    };

  }, []);

  useEffect(() => {
    if (!canManageDmPermissions(state?.user?.username)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/password");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setAdminReveals(data.users ?? []);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state?.user?.username]);

  if (!state?.user) return null;



  const googleConnected = state.integrations?.google?.connected ?? false;

  const googleEmail = state.integrations?.google?.email;

  const googleSyncError = state.integrations?.google?.syncError;



  const handleDisconnectGoogle = async () => {

    setDisconnecting(true);

    try {

      await fetch("/api/auth/google/disconnect", { method: "POST" });

      await refresh();

      setGoogleNotice("Google account disconnected.");

    } finally {

      setDisconnecting(false);

    }

  };

  const refreshSocialStatus = async () => {
    const res = await fetch("/api/social/instagram/status", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      connected: boolean;
      hasToken: boolean;
      disconnected?: boolean;
      purged?: boolean;
      canReconnect?: boolean;
    };
    setSocialStatus(data);
  };

  const handleDisconnectInstagram = async () => {
    setSocialDisconnecting(true);
    try {
      await fetch("/api/social/instagram/disconnect", { method: "POST" });
      await refreshSocialStatus();
      setSocialNotice("Instagram disconnected. Previous account credentials were removed.");
    } finally {
      setSocialDisconnecting(false);
    }
  };

  const handleReconnectInstagram = async () => {
    setSocialDisconnecting(true);
    try {
      const res = await fetch("/api/social/instagram/reconnect", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSocialNotice(body.error ?? "Could not reconnect Instagram.");
        return;
      }
      await refreshSocialStatus();
      setSocialNotice("Instagram reconnected.");
    } finally {
      setSocialDisconnecting(false);
    }
  };



  const integrations = [

    {

      name: "Email (Gmail)",

      status: googleConnected ? "Connected" : "Not connected",

      variant: googleConnected ? ("success" as const) : ("warning" as const),

    },

    {

      name: "Calendar (Google)",

      status: googleConnected ? "Connected" : "Not connected",

      variant: googleConnected ? ("success" as const) : ("warning" as const),

    },

    {

      name: "OpenAI / LLM",

      status: state.integrations?.llm?.configured ? "Hybrid (GPT + live data)" : "Rules only — add OPENAI_API_KEY",

      variant: state.integrations?.llm?.configured ? ("success" as const) : ("warning" as const),

    },

    {

      name: "Company Knowledge (RAG)",

      status: state.integrations?.rag?.available

        ? `${state.integrations.rag.chunks} chunks · ${state.integrations.rag.faqs} FAQs`

        : "Not loaded",

      variant: state.integrations?.rag?.available ? ("success" as const) : ("warning" as const),

    },

    {

      name: "Industry News (NewsAPI)",

      status: state.integrations?.news?.configured ? "Connected" : "Not configured",

      variant: state.integrations?.news?.configured ? ("success" as const) : ("warning" as const),

    },

    { name: "WhatsApp Business", status: "Mock", variant: "warning" as const },

    {

      name: "Social (Instagram)",

      status: socialLoading

        ? "Checking…"

        : socialStatus?.connected

          ? "Connected"

          : socialStatus?.disconnected

            ? "Disconnected"

            : "Not connected — add Meta env keys",

      variant: socialStatus?.connected ? ("success" as const) : ("warning" as const),

    },

  ];



  const handleSave = async () => {

    await updateProfile({

      name: profile.name,

      email: profile.email,

      role: profile.role,

      company: profile.company,

      companyDescription: profile.companyDescription,

      communicationStyle: profile.communicationStyle as "formal" | "professional" | "casual",

      priorities: profile.priorities.split("\n").filter(Boolean),

      preferences: {

        confirmBeforeSend: profile.confirmBeforeSend,

        confirmBeforeCall: profile.confirmBeforeCall,

        confirmBeforeMeeting: profile.confirmBeforeMeeting,

        voiceEnabled: profile.voiceEnabled,

        defaultCallApp: profile.defaultCallApp,

      },

    });

    setSaved(true);

    setTimeout(() => setSaved(false), 2000);

  };

  const handlePermissionSave = async () => {
    if (!canManageDmPermissions(state?.user?.username)) return;
    setPermissionSaving(true);
    setPermissionNotice(null);
    try {
      const res = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: permissionUser,
          permissions: permissionDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPermissionNotice(data.error || "Could not save permissions");
        return;
      }
      if (data.permissions) setPermissionDraft(data.permissions);
      setPermissionNotice(`Saved permissions for ${permissionUser}`);
      await refresh();
    } catch {
      setPermissionNotice("Could not save permissions");
    } finally {
      setPermissionSaving(false);
      setTimeout(() => setPermissionNotice(null), 2500);
    }
  };

  const refreshAdminReveals = async () => {
    if (!canManageDmPermissions(state?.user?.username)) return;
    try {
      const res = await fetch("/api/auth/password");
      if (!res.ok) return;
      const data = await res.json();
      setAdminReveals(data.users ?? []);
    } catch {
      // ignore
    }
  };

  const runPasswordAction = async (payload: Record<string, string>) => {
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordNotice(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Password update failed");
        return;
      }
      setIssuedPassword(data.password ?? null);
      setPasswordNotice(data.message || "Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (canManageDmPermissions(state?.user?.username)) {
        void refreshAdminReveals();
      }
    } catch {
      setPasswordError("Password update failed");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleChangeOwnPassword = () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match");
      return;
    }
    void runPasswordAction({
      action: "change",
      currentPassword,
      newPassword,
    });
  };

  const handleRegenerateOwnPassword = () => {
    if (
      !window.confirm(
        "Generate a new password? Your current password will stop working immediately."
      )
    ) {
      return;
    }
    void runPasswordAction({ action: "regenerate" });
  };

  const handleKashRegenerate = () => {
    if (
      !window.confirm(
        `Generate a new password for ${adminTarget}? They will need the new password to sign in.`
      )
    ) {
      return;
    }
    void runPasswordAction({ action: "regenerate", username: adminTarget });
  };

  const copyIssued = async () => {
    if (!issuedPassword) return;
    try {
      await navigator.clipboard.writeText(issuedPassword);
      setPasswordNotice("Copied to clipboard");
    } catch {
      setPasswordError("Could not copy — select the password manually");
    }
  };



  return (

    <PageShell accent="violet">

        <PageShellHeader>

          <PageHeader

            gradient

            eyebrow="Preferences"

            title="Settings & Profile"

            subtitle="Configure your assistant and business context"

            action={

              <Button size="sm" onClick={handleSave}>

                <Save size={16} /> {saved ? "Saved!" : "Save Changes"}

              </Button>

            }

          />

        </PageShellHeader>



        <PageShellBody className="space-y-0">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

            <SectionCard title="Profile" icon={User}>

              <div className="space-y-4">

                <Input label="Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />

                <Input label="Email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />

                <Input label="Role" value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })} />

                <Input label="Company" value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} />

                <div>

                  <label className="block text-sm font-medium text-ink-secondary mb-1.5">Company Description</label>

                  <textarea

                    value={profile.companyDescription}

                    onChange={(e) => setProfile({ ...profile, companyDescription: e.target.value })}

                    rows={3}

                    className={fieldClass}

                  />

                </div>

                <div>

                  <label className="block text-sm font-medium text-ink-secondary mb-1.5">Communication Style</label>

                  <select

                    value={profile.communicationStyle}

                    onChange={(e) =>

                      setProfile({

                        ...profile,

                        communicationStyle: e.target.value as "formal" | "professional" | "casual",

                      })

                    }

                    className={fieldClass}

                  >

                    <option value="formal">Formal</option>

                    <option value="professional">Professional</option>

                    <option value="casual">Casual</option>

                  </select>

                </div>

              </div>

            </SectionCard>



            <div className="space-y-5">

              <SectionCard title="Business Memory" icon={Brain}>

                <div>

                  <label className="block text-sm font-medium text-ink-secondary mb-1.5">

                    Business Priorities (one per line)

                  </label>

                  <textarea

                    value={profile.priorities}

                    onChange={(e) => setProfile({ ...profile, priorities: e.target.value })}

                    rows={5}

                    className={fieldClass}

                    placeholder="Ovani bridal growth&#10;Aanika V. gemstone collections&#10;Texas expansion&#10;Link N Lock Father's Day campaign"

                  />

                  <p className="text-xs text-ink-muted mt-2">

                    The assistant uses these priorities to personalize recommendations.

                  </p>

                </div>

              </SectionCard>

              <SectionCard title="Password Portal" icon={KeyRound}>
                <div className="space-y-4">
                  <p className="text-xs text-ink-muted">
                    Change your password, or regenerate a new one if you forgot it. Copy any generated password now — login uses the latest value.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                        Current password (for change)
                      </label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                        New password
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                        Confirm new password
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={handleChangeOwnPassword} disabled={passwordBusy}>
                      {passwordBusy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                      Change password
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerateOwnPassword}
                      disabled={passwordBusy}
                    >
                      <RefreshCw size={14} /> Forget / regenerate
                    </Button>
                  </div>

                  {issuedPassword && (
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5">
                      <p className="text-xs text-emerald-100/90 mb-1">Issued password (copy now)</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm text-white break-all">{issuedPassword}</code>
                        <Button size="sm" variant="outline" onClick={() => void copyIssued()}>
                          <Copy size={14} /> Copy
                        </Button>
                      </div>
                    </div>
                  )}

                  {passwordError && (
                    <p className="text-sm text-rose-200">{passwordError}</p>
                  )}
                  {passwordNotice && !passwordError && (
                    <p className="text-sm text-emerald-200/90">{passwordNotice}</p>
                  )}

                  {canEditPermissions && (
                    <div className="pt-4 mt-2 border-t border-white/10 space-y-3">
                      <p className="text-sm font-medium text-ink">Kash — all users</p>
                      <p className="text-xs text-ink-muted">
                        You can regenerate any account and see the last password issued from this portal (not recoverable from old bcrypt hashes).
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[160px] flex-1">
                          <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                            User
                          </label>
                          <select
                            value={adminTarget}
                            onChange={(e) => setAdminTarget(e.target.value)}
                            className={`${fieldClass} bg-[#0f172a] text-white border-slate-600/80`}
                          >
                            {["kash", "ross", "aj", "shaun", "adeel", "rozina"].map((u) => (
                              <option key={u} value={u} className="bg-slate-900 text-white">
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button size="sm" onClick={handleKashRegenerate} disabled={passwordBusy}>
                          <RefreshCw size={14} /> Regenerate for user
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void refreshAdminReveals()}
                          disabled={passwordBusy}
                        >
                          Refresh list
                        </Button>
                      </div>

                      <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/10">
                        {adminReveals.map((row) => (
                          <div
                            key={row.username}
                            className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 py-2.5 bg-white/[0.02]"
                          >
                            <div className="min-w-[120px]">
                              <div className="text-sm text-ink-secondary">{row.name}</div>
                              <div className="text-[10px] text-ink-muted">
                                {row.username} · {row.title}
                              </div>
                            </div>
                            <code className="flex-1 text-xs text-white/90 break-all">
                              {row.password ?? "(no portal password yet — still using built-in)"}
                            </code>
                            <div className="text-[10px] text-ink-muted sm:text-right">
                              {row.updatedAt
                                ? `${row.source} · ${new Date(row.updatedAt).toLocaleString()}`
                                : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {canEditPermissions && (
                <SectionCard title="Permissions Dashboard" icon={Shield}>
                  <div className="space-y-4">
                    <p className="text-xs text-ink-muted">
                      Grant or remove section access for DMs. Ross cannot edit this matrix. Defaults: Sales, Stores, Calculator (wholesale cost). Rozina has Vendor Info off unless you enable it.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-ink-secondary mb-1.5">User / DM</label>
                      <select
                        value={permissionUser}
                        onChange={(e) => setPermissionUser(e.target.value)}
                        className={`${fieldClass} bg-[#0f172a] text-white border-slate-600/80`}
                      >
                        <option value="aj" className="bg-slate-900 text-white">AJ</option>
                        <option value="shaun" className="bg-slate-900 text-white">Shaun</option>
                        <option value="adeel" className="bg-slate-900 text-white">Adeel</option>
                        <option value="rozina" className="bg-slate-900 text-white">Rozina</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {USER_PERMISSION_SECTIONS.map((section) => (
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
                            onClick={() =>
                              setPermissionDraft((prev) => ({
                                ...prev,
                                [section.key]: !prev[section.key],
                              }))
                            }
                            className={
                              "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors " +
                              (permissionDraft[section.key]
                                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                                : "border-white/10 bg-white/5 text-ink-muted")
                            }
                            aria-label={`${section.label} ${permissionDraft[section.key] ? "enabled" : "disabled"}`}
                          >
                            {permissionDraft[section.key] ? <Check size={15} /> : <X size={15} />}
                          </button>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      {permissionNotice ? (
                        <p className="text-xs text-emerald-200/90">{permissionNotice}</p>
                      ) : (
                        <span />
                      )}
                      <Button size="sm" onClick={() => void handlePermissionSave()} disabled={permissionSaving}>
                        {permissionSaving ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                        {permissionSaving ? "Saving…" : "Save permissions"}
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              )}



              <SectionCard title="Safety & Confirmations" icon={Shield}>

                <div className="space-y-3">

                  {[

                    { key: "confirmBeforeSend" as const, label: "Confirm before sending emails & WhatsApp" },

                    { key: "confirmBeforeCall" as const, label: "Confirm before placing calls" },

                    { key: "confirmBeforeMeeting" as const, label: "Confirm before scheduling meetings" },

                    { key: "voiceEnabled" as const, label: "Enable voice responses" },

                  ].map((pref) => (

                    <label

                      key={pref.key}

                      className="flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2 hover:bg-white/[0.04] transition-colors"

                    >

                      <input

                        type="checkbox"

                        checked={profile[pref.key]}

                        onChange={(e) => setProfile({ ...profile, [pref.key]: e.target.checked })}

                        className="w-4 h-4 rounded border-white/30 bg-white/10 text-slate-400 focus:ring-slate-400/40"

                      />

                      <span className="text-sm text-ink-secondary">{pref.label}</span>

                    </label>

                  ))}

                </div>

              </SectionCard>



              {canEditPermissions && (
              <SectionCard title="Integration Status" icon={Plug}>

                {googleNotice && (

                  <p className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-400/25 rounded-xl px-3 py-2 mb-3 ring-1 ring-emerald-400/15">

                    {googleNotice}

                  </p>

                )}

                {googleSyncError && (

                  <p className="text-sm text-accent-rose bg-red-500/10 border border-red-400/25 rounded-xl px-3 py-2 mb-3 ring-1 ring-red-400/15">

                    {googleSyncError}

                  </p>

                )}

                <div className="divide-y divide-white/10 rounded-xl border border-white/10 overflow-hidden ring-1 ring-white/5">

                  {integrations.map((integration) => (

                    <div

                      key={integration.name}

                      className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white/[0.02] even:bg-white/[0.04]"

                    >

                      <span className="text-sm text-ink-secondary">{integration.name}</span>

                      <Badge variant={integration.variant}>{integration.status}</Badge>

                    </div>

                  ))}

                  <div className="pt-2 border-t border-white/10">
                    <label className="block text-sm text-ink-secondary mb-1.5">
                      Default phone calls
                    </label>
                    <select
                      value={profile.defaultCallApp}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          defaultCallApp: e.target.value as "sim" | "magicapp",
                        }))
                      }
                      className="w-full rounded-xl px-3 py-2 text-sm bg-white/[0.06] ring-1 ring-white/15 text-ink"
                    >
                      <option value="magicapp">magicApp (international — India, Pakistan, etc.)</option>
                      <option value="sim">Phone SIM (regular dialer)</option>
                    </select>
                    <p className="text-xs text-ink-muted mt-1.5">
                      Contacts → Call uses this on your mobile. magicApp opens the app and copies the number.
                    </p>
                  </div>

                </div>

                <div className="mt-4 pt-4 border-t border-white/10">

                  <p className="text-sm font-medium text-ink mb-2">Google (Gmail + Calendar + Contacts)</p>

                  {googleConnected ? (

                    <div className="flex flex-wrap items-center gap-2">

                      <p className="text-xs text-ink-muted flex-1 min-w-[200px]">

                        Connected as {googleEmail ?? "your Google account"}. Reconnect if Close/Drafts or Send asks for more permissions.

                      </p>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          window.location.href = "/api/auth/google";
                        }}
                      >
                        <Link2 size={14} /> Reconnect
                      </Button>

                      <Button size="sm" variant="outline" onClick={handleDisconnectGoogle} disabled={disconnecting}>

                        {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}{" "}

                        Disconnect

                      </Button>

                    </div>

                  ) : (

                    <Button size="sm" onClick={() => { window.location.href = "/api/auth/google"; }}>

                      <Link2 size={14} /> Connect Gmail, Calendar & Contacts

                    </Button>

                  )}

                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-sm font-medium text-ink mb-2">Social (Instagram)</p>
                  {socialNotice && (
                    <p className="text-sm text-ink-secondary bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 mb-3">
                      {socialNotice}
                    </p>
                  )}
                  {socialStatus?.connected ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-ink-muted flex-1 min-w-[200px]">
                        Instagram Business is connected
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDisconnectInstagram()}
                        disabled={socialDisconnecting || socialLoading}
                      >
                        {socialDisconnecting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Unlink size={14} />
                        )}{" "}
                        Disconnect
                      </Button>
                    </div>
                  ) : socialStatus?.canReconnect ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-ink-muted flex-1 min-w-[200px]">
                        Disconnected — Meta keys are still on the server
                      </p>
                      <Button
                        size="sm"
                        onClick={() => void handleReconnectInstagram()}
                        disabled={socialDisconnecting || socialLoading}
                      >
                        {socialDisconnecting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Link2 size={14} />
                        )}{" "}
                        Reconnect
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted">
                      {socialStatus?.purged
                        ? "Credentials removed — add Valliani META_PAGE_ID, META_IG_BUSINESS_ID, and META_TEST_ACCESS_TOKEN, then restart the server."
                        : "Not connected — add Meta env keys on the server, then refresh."}
                    </p>
                  )}
                </div>

                <p className="text-xs text-ink-muted mt-3">

                  Connect Google for inbox, calendar, and contacts sync. Disconnect Instagram anytime from here or Social.

                </p>

              </SectionCard>
              )}

            </div>

          </div>

        </PageShellBody>

    </PageShell>

  );

}


