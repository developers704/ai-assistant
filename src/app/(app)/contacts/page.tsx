"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { syncUiSelection } from "@/components/layout/UiContextSync";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import {
  getContactPhoneNumber,
  getContactWhatsAppNumber,
  openEmailDraft,
  openPhoneCall,
  openWhatsAppChat,
} from "@/lib/contact-links";
import type { Contact } from "@/types";
import { Mail, Phone, MessageCircle, Star, Users } from "lucide-react";

export default function ContactsPage() {
  const { state, sendChat } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionHint, setActionHint] = useState<string | null>(null);

  useEffect(() => {
    void syncUiSelection({
      selectedContactId: selectedId ?? undefined,
    });
  }, [selectedId]);

  if (!state) return null;

  const selected = state.contacts.find((c) => c.id === selectedId);
  const googleConnected = state.integrations?.google?.connected ?? false;
  const contactsSynced = state.integrations?.google?.contactsSynced;
  const importantCount = state.contacts.filter((c) => c.isImportant).length;
  const contactsSubtitle = googleConnected
    ? contactsSynced != null
      ? `${state.contacts.length} Google contacts synced · ${importantCount} starred in app`
      : `${state.contacts.length} contacts · syncing from Google…`
    : `${state.contacts.length} team contacts · ${importantCount} key · demo data`;
  const callMode = state.user?.preferences?.defaultCallApp ?? "magicapp";

  const showHint = (msg: string) => {
    setActionHint(msg);
    setTimeout(() => setActionHint(null), 5000);
  };

  const handleWhatsApp = (contact: Contact) => {
    const number = getContactWhatsAppNumber(contact);
    if (!number) {
      showHint(`No WhatsApp number for ${contact.name}. Add a phone number in contacts.`);
      return;
    }
    openWhatsAppChat(number);
  };

  const handleCall = async (contact: Contact, mode: "sim" | "magicapp") => {
    const number = getContactPhoneNumber(contact);
    if (!number) {
      showHint(`No phone number for ${contact.name}.`);
      return;
    }
    const result = await openPhoneCall(number, mode);
    if (result.message) showHint(result.message);
  };

  const handleEmail = (contact: Contact) => {
    if (contact.email) {
      openEmailDraft(contact.email, `Message for ${contact.name}`);
      return;
    }
    void sendChat(`Draft an email to ${contact.name}`);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-4rem)]">
      <div className="glass-panel-strong rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10 shrink-0">
          <PageHeader
            title="Contacts"
            subtitle={contactsSubtitle}
          />
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(240px,320px)_1fr] min-h-0">
          <div className="border-b lg:border-b-0 lg:border-r border-white/10 overflow-y-auto p-3 sm:p-4 space-y-2">
            {state.contacts.map((contact) => {
              const active = selectedId === contact.id;
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setSelectedId(contact.id)}
                  className={cn(
                    "w-full text-left rounded-2xl p-3 transition-all ring-1",
                    active
                      ? "bg-indigo-500/15 ring-indigo-400/35 shadow-glow"
                      : "glass-panel ring-white/10 hover:bg-white/10 hover:ring-white/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={contact.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink truncate">{contact.name}</p>
                        {contact.isImportant && (
                          <Star size={12} className="text-amber-300 flex-shrink-0 fill-amber-300/30" />
                        )}
                      </div>
                      <p className="text-xs text-ink-muted truncate">{contact.role}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="overflow-y-auto p-4 sm:p-5 min-h-0">
            {selected ? (
              <div className="glass-panel rounded-2xl p-5 ring-1 ring-white/10 h-full">
                <div className="flex items-start gap-4 mb-6">
                  <Avatar name={selected.name} size="lg" />
                  <div>
                    <h2 className="text-xl font-semibold text-ink">{selected.name}</h2>
                    <p className="text-ink-secondary">{selected.role}</p>
                    <p className="text-sm text-ink-muted">{selected.company}</p>
                    {selected.isImportant && (
                      <Badge variant="warning" className="mt-2">
                        Key Contact
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {selected.email ? (
                    <div className="flex items-center gap-3 text-sm rounded-xl px-3 py-2 bg-white/[0.04] ring-1 ring-white/10">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 ring-1 ring-indigo-400/20">
                        <Mail size={14} className="text-indigo-300" />
                      </span>
                      <span className="text-ink break-all">{selected.email}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted italic">
                      No email on file — use AI chat to draft a message by name.
                    </p>
                  )}

                  {selected.phone && (
                    <div className="flex items-center gap-3 text-sm rounded-xl px-3 py-2 bg-white/[0.04] ring-1 ring-white/10">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 ring-1 ring-indigo-400/20">
                        <Phone size={14} className="text-indigo-300" />
                      </span>
                      <span className="text-ink">{selected.phone}</span>
                    </div>
                  )}

                  {selected.whatsapp && (
                    <div className="flex items-center gap-3 text-sm rounded-xl px-3 py-2 bg-white/[0.04] ring-1 ring-white/10">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/20">
                        <MessageCircle size={14} className="text-emerald-300" />
                      </span>
                      <span className="text-ink">{selected.whatsapp}</span>
                    </div>
                  )}
                </div>

                {selected.notes && (
                  <div className="mb-6 p-4 rounded-xl bg-white/[0.04] ring-1 ring-white/10">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
                      Notes
                    </p>
                    <p className="text-sm text-ink-secondary leading-relaxed">{selected.notes}</p>
                  </div>
                )}

                {actionHint && (
                  <p className="text-xs text-emerald-200/90 mb-3 px-3 py-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/20">
                    {actionHint}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <Button size="sm" onClick={() => handleEmail(selected)}>
                    <Mail size={14} /> Email
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!getContactWhatsAppNumber(selected)}
                    onClick={() => handleWhatsApp(selected)}
                    title="Opens WhatsApp app on your phone"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!getContactPhoneNumber(selected)}
                    onClick={() => void handleCall(selected, callMode)}
                    title={
                      callMode === "magicapp"
                        ? "Opens magicApp — number copied for international calls"
                        : "Opens your phone dialer (SIM)"
                    }
                  >
                    <Phone size={14} />
                    {callMode === "magicapp" ? "Call (magicApp)" : "Call (SIM)"}
                  </Button>

                  {getContactPhoneNumber(selected) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleCall(selected, callMode === "magicapp" ? "sim" : "magicapp")}
                      title="Use the other calling method"
                    >
                      <Phone size={14} />
                      {callMode === "magicapp" ? "SIM call" : "magicApp"}
                    </Button>
                  )}
                </div>

                <p className="text-[10px] text-ink-muted mt-3">
                  On mobile: WhatsApp opens the app directly. Calls use{" "}
                  {callMode === "magicapp" ? "magicApp (intl)" : "your SIM"} by default — change in Settings.
                </p>
              </div>
            ) : (
              <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center rounded-2xl border border-white/10 bg-white/[0.03] ring-1 ring-white/5">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 ring-1 ring-indigo-400/30 mb-4">
                  <Users size={28} className="text-indigo-300" />
                </span>
                <p className="text-ink-secondary font-medium">Select a contact to view details</p>
                <p className="text-sm text-ink-muted mt-1">
                  Tap WhatsApp or Call to open apps on your phone
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
