"use client";



import { useEffect, useState, Suspense } from "react";

import { useSearchParams } from "next/navigation";

import { useApp } from "@/lib/store/app-context";

import { PageHeader } from "@/components/layout/Sidebar";

import { Button } from "@/components/ui/Button";

import { Input } from "@/components/ui/Input";

import { Badge } from "@/components/ui/Badge";

import { cn } from "@/lib/utils";

import { Save, Brain, Shield, Link2, Unlink, Loader2, User, Plug } from "lucide-react";

import { PlaidConnectButton } from "@/components/settings/PlaidConnectButton";



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

    <div className={cn("glass-panel rounded-2xl p-5 ring-1 ring-white/10", className)}>

      <div className="flex items-center gap-2 mb-4">

        {Icon && (

          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/25 ring-1 ring-slate-400/20">

            <Icon size={16} className="text-slate-300" />

          </span>

        )}

        <h3 className="text-sm font-semibold text-ink">{title}</h3>

      </div>

      {children}

    </div>

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

    dailyBriefingTime: "08:00",

    voiceEnabled: true,

  });



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

        dailyBriefingTime: state.user.preferences.dailyBriefingTime,

        voiceEnabled: state.user.preferences.voiceEnabled,

      });

    }

  }, [state?.user]);



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



  if (!state?.user) return null;



  const googleConnected = state.integrations?.google?.connected ?? false;

  const googleEmail = state.integrations?.google?.email;

  const googleSyncError = state.integrations?.google?.syncError;

  const plaidConnected = state.integrations?.plaid?.connected ?? false;

  const plaidConfigured = state.integrations?.plaid?.configured ?? false;

  const plaidInstitution = state.integrations?.plaid?.institutionName;

  const plaidEnv = state.integrations?.plaid?.env ?? "sandbox";



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

    {

      name: "Investments (Plaid)",

      status: plaidConnected

        ? `Connected${plaidInstitution ? ` · ${plaidInstitution}` : ""}`

        : plaidConfigured

          ? `Not connected (${plaidEnv})`

          : "Not configured",

      variant: plaidConnected ? ("success" as const) : ("warning" as const),

    },

    { name: "WhatsApp Business", status: "Mock", variant: "warning" as const },

    { name: "Phone (Twilio)", status: "Mock", variant: "warning" as const },

    { name: "Sales Data (POS/ERP)", status: "Mock", variant: "warning" as const },

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

        dailyBriefingTime: profile.dailyBriefingTime,

        voiceEnabled: profile.voiceEnabled,

      },

    });

    setSaved(true);

    setTimeout(() => setSaved(false), 2000);

  };



  return (

    <div className="flex flex-col min-h-0">

      <div className="glass-panel-strong rounded-3xl ring-1 ring-white/10 overflow-hidden">

        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">

          <PageHeader

            title="Settings & Profile"

            subtitle="Configure your assistant and business context"

            action={

              <Button size="sm" onClick={handleSave}>

                <Save size={16} /> {saved ? "Saved!" : "Save Changes"}

              </Button>

            }

          />

        </div>



        <div className="px-5 sm:px-6 py-5">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

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

                    The assistant uses these priorities to personalize briefings and recommendations.

                  </p>

                </div>

              </SectionCard>



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

                  <Input

                    label="Daily Briefing Time"

                    type="time"

                    value={profile.dailyBriefingTime}

                    onChange={(e) => setProfile({ ...profile, dailyBriefingTime: e.target.value })}

                  />

                </div>

              </SectionCard>



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

                </div>

                <div className="mt-4 pt-4 border-t border-white/10">

                  <p className="text-sm font-medium text-ink mb-2">Google (Gmail + Calendar)</p>

                  {googleConnected ? (

                    <div className="flex flex-wrap items-center gap-2">

                      <p className="text-xs text-ink-muted flex-1 min-w-[200px]">

                        Connected as {googleEmail ?? "your Google account"}

                      </p>

                      <Button size="sm" variant="outline" onClick={handleDisconnectGoogle} disabled={disconnecting}>

                        {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}{" "}

                        Disconnect

                      </Button>

                    </div>

                  ) : (

                    <Button size="sm" onClick={() => { window.location.href = "/api/auth/google"; }}>

                      <Link2 size={14} /> Connect Gmail & Calendar

                    </Button>

                  )}

                </div>

                <div className="mt-4 pt-4 border-t border-white/10">

                  <p className="text-sm font-medium text-ink mb-2">Investments (Vanguard via Plaid)</p>

                  <PlaidConnectButton

                    connected={plaidConnected}

                    institutionName={plaidInstitution}

                    configured={plaidConfigured}

                    onConnected={refresh}

                  />

                </div>

                <p className="text-xs text-ink-muted mt-3">

                  Connect Google for inbox and calendar. Connect investments via Plaid (Sandbox test bank first, then Vanguard in Production).

                </p>

              </SectionCard>

            </div>

          </div>

        </div>

      </div>

    </div>

  );

}


