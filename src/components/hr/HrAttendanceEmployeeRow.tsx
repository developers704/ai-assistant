"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { HrEmployeeDay, HrViolation, HrWarningNotice } from "@/lib/hr/types";
import { MISSING_PUNCH_LABEL } from "@/lib/hr/window";
import { isLateForWarning, HR_WARNING_FROM } from "@/lib/hr/warning-notice";
import {
  isWarningMailSessionReady,
  replyOnWarningThread,
  sendLateWarningNotice,
  syncWarningRemarks,
} from "@/lib/hr/send-warning-mail";
import { stripQuotedReply } from "@/lib/hr/remark-text";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  MessageSquare,
  Reply,
} from "lucide-react";

function violationBadge(v: HrViolation) {
  const colors: Record<string, string> = {
    missing_punch: "bg-rose-500/20 text-rose-200 ring-rose-400/30",
    late: "bg-orange-500/20 text-orange-100 ring-orange-400/30",
    early_in: "bg-sky-500/20 text-sky-100 ring-sky-400/30",
    no_schedule: "bg-amber-500/20 text-amber-100 ring-amber-400/30",
    long_meal: "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/30",
    short_meal_total: "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/30",
    excessive_meal_total: "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/30",
    meal_count: "bg-violet-500/20 text-violet-100 ring-violet-400/30",
  };
  return (
    <span
      key={`${v.type}-${v.message}`}
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-xs ring-1",
        colors[v.type] ?? "bg-white/10 text-white/70 ring-white/20"
      )}
    >
      {v.message}
    </span>
  );
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RemarksPanel({
  warning,
  onSynced,
}: {
  warning: HrWarningNotice;
  onSynced: (next: HrWarningNotice) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    setStatus(null);
    try {
      const ready = isWarningMailSessionReady();
      if (!ready.ok) throw new Error(ready.reason);
      const next = await syncWarningRemarks(warning.caseId);
      if (next) onSynced(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sync replies");
    } finally {
      setSyncing(false);
    }
  };

  const sendReply = async () => {
    setSendingReply(true);
    setError(null);
    setStatus(null);
    try {
      const ready = isWarningMailSessionReady();
      if (!ready.ok) throw new Error(ready.reason);
      const next = await replyOnWarningThread(warning, replyText);
      if (next) onSynced(next);
      setReplyText("");
      setReplyOpen(false);
      setStatus("Reply sent on the warning email thread.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reply");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="rounded-lg bg-white/[0.04] ring-1 ring-white/10 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-white">Remarks</div>
          <div className="text-[11px] text-white/40">
            Employee replies to {warning.subject}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" size="sm" variant="outline" onClick={() => void sync()} disabled={syncing}>
            {syncing ? <Loader2 size={14} className="animate-spin" /> : null}
            Sync replies
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setReplyOpen((o) => !o);
              setError(null);
            }}
          >
            <Reply size={14} />
            Reply
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-xs text-rose-200">
          {error}{" "}
          {/e-mails/i.test(error) && (
            <Link href="/valliani-mail" className="underline text-sky-200">
              Open E-Mails
            </Link>
          )}
        </p>
      )}
      {status && <p className="text-xs text-emerald-200">{status}</p>}
      {warning.remarks.length === 0 ? (
        <p className="text-xs text-white/45">No employee reply yet.</p>
      ) : (
        <div className="space-y-2">
          {warning.remarks.map((r) => {
            const body = stripQuotedReply(r.body);
            if (!body) return null;
            const fromHr = r.fromEmail.toLowerCase() === HR_WARNING_FROM.toLowerCase();
            return (
              <div key={r.id} className="rounded-md bg-black/20 px-3 py-2">
                <div className="text-xs text-white/55">
                  {fromHr ? "You" : r.fromName || r.fromEmail || "Employee"} · {formatStamp(r.sentAt)}
                </div>
                <div className="text-sm text-white/90 whitespace-pre-wrap mt-1">{body}</div>
              </div>
            );
          })}
        </div>
      )}
      {replyOpen && (
        <div className="space-y-2 pt-1">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={4}
            placeholder="Write a reply — sent on the same email thread"
            className="w-full rounded-lg bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35 ring-1 ring-white/15 focus:outline-none focus:ring-indigo-400/50"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setReplyOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void sendReply()}
              disabled={sendingReply || !replyText.trim()}
            >
              {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Reply size={14} />}
              Send reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function HrAttendanceEmployeeRow({
  emp,
  onChanged,
}: {
  emp: HrEmployeeDay;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<HrWarningNotice | null>(emp.warning ?? null);
  useEffect(() => {
    setWarning(emp.warning ?? null);
  }, [emp.warning]);
  const hasError = emp.violations.some((v) => v.severity === "error");
  const late = isLateForWarning(emp.lateMinutes);
  const identityBits = [emp.employeeCode, emp.jobTitle, emp.manager ? `Mgr ${emp.manager}` : null]
    .filter(Boolean)
    .join(" · ");

  const sendWarning = async (event: MouseEvent) => {
    event.stopPropagation();
    setSending(true);
    setError(null);
    try {
      const ready = isWarningMailSessionReady();
      if (!ready.ok) throw new Error(ready.reason);
      const next = await sendLateWarningNotice(emp);
      setWarning(next);
      setRemarksOpen(true);
      setOpen(true);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send warning");
      setOpen(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden",
        hasError && "ring-1 ring-rose-400/40"
      )}
    >
      <div className="flex items-stretch gap-2 px-4 py-3 hover:bg-white/[0.04]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
        {open ? (
          <ChevronDown size={16} className="text-white/40 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-white/40 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white truncate">{emp.employeeName}</div>
          <div className="text-xs text-white/45 mt-0.5">
            {emp.schedule
              ? `Scheduled ${emp.schedule.start} – ${emp.schedule.end} (${emp.schedule.scheduledLabel})`
              : "No schedule on file"}
            {identityBits ? ` · ${identityBits}` : ""}
          </div>
          <div className="flex flex-wrap gap-2 mt-1.5">
            <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-100 ring-1 ring-emerald-400/25">
              Worked Hrs {emp.totalWorkLabel}
            </span>
            <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-100 ring-1 ring-amber-400/25">
              Meal {emp.totalMealMinutes} min
              {emp.expectedMealMinutes > 0 && (
                <span className="text-amber-200/60 font-normal"> / {emp.expectedMealMinutes}</span>
              )}
            </span>
            {emp.schedule && (
              <span className="inline-flex items-center rounded-md bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-100 ring-1 ring-sky-400/25">
                Schedule hrs {emp.schedule.scheduledLabel}
              </span>
            )}
            {emp.lateMinutes != null && emp.lateMinutes >= 12 && (
              <span className="inline-flex items-center rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-100 ring-1 ring-orange-400/25">
                Late {emp.lateMinutes} min
              </span>
            )}
            {emp.earlyInMinutes != null && emp.earlyInMinutes >= 10 && (
              <span className="inline-flex items-center rounded-md bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-100 ring-1 ring-violet-400/30">
                Early {emp.earlyInMinutes} min
              </span>
            )}
            {warning && (
              <Badge variant="info" className="text-[11px]">
                Warning sent
              </Badge>
            )}
          </div>
        </div>
        </button>
        <div className="flex items-center gap-2 shrink-0 self-center">
          {late && !warning && (
            <Button
              type="button"
              size="sm"
              data-action="send-warning"
              onClick={(e) => void sendWarning(e)}
              disabled={sending}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Send warning
            </Button>
          )}
          {warning && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-action="warning-remarks"
              onClick={() => {
                setRemarksOpen((o) => !o);
                setOpen(true);
              }}
            >
              <MessageSquare size={14} />
              Remarks{warning.remarks.length ? ` (${warning.remarks.length})` : ""}
            </Button>
          )}
          {emp.violations.length > 0 && (
            <AlertTriangle size={16} className={hasError ? "text-rose-400" : "text-amber-400"} />
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {error && (
            <div className="rounded-lg bg-rose-500/10 ring-1 ring-rose-400/25 px-3 py-2 text-sm text-rose-100">
              {error}{" "}
              {/e-mails/i.test(error) && (
                <Link href="/valliani-mail" className="underline text-sky-200">
                  Open E-Mails
                </Link>
              )}
            </div>
          )}
          {emp.violations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {emp.violations.map((v) => violationBadge(v))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs">
                  <th className="pb-2 pr-3">Time In</th>
                  <th className="pb-2 pr-3">Time Out</th>
                  <th className="pb-2 pr-3">Gap</th>
                  <th className="pb-2 pr-3">Work</th>
                  <th className="pb-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {emp.segments.map((seg, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "border-t border-white/5",
                      seg.violations.length > 0 && "bg-rose-500/5"
                    )}
                  >
                    <td className={cn("py-2 pr-3 tabular-nums", !seg.timeIn?.trim() && "text-rose-300")}>
                      {seg.timeIn?.trim() ? seg.timeIn : MISSING_PUNCH_LABEL}
                    </td>
                    <td className={cn("py-2 pr-3 tabular-nums", !seg.timeOut?.trim() && "text-rose-300")}>
                      {seg.timeOut?.trim() ? seg.timeOut : MISSING_PUNCH_LABEL}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-white/60">
                      {seg.gapMinutes != null ? (
                        <span
                          className={cn(
                            seg.gapKind === "meal_break" && "text-amber-200",
                            seg.gapKind === "short_break" && "text-white/40"
                          )}
                        >
                          {seg.gapFromPrevious ??
                            `${Math.floor(seg.gapMinutes / 60)}:${String(seg.gapMinutes % 60).padStart(2, "0")}`}
                          {seg.gapKind === "meal_break" && " · meal"}
                          {seg.gapKind === "short_break" && " · rest"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{seg.workLabel}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {seg.violations.map((v) => violationBadge(v))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {emp.shiftTier && (
            <p className="text-xs text-white/40">
              Shift tier: {emp.shiftTier === "ten" ? "≤10h" : emp.shiftTier === "eleven" ? "11h" : "≥12h"}
              {" · "}Expected {emp.expectedMealCount} meal(s), {emp.expectedMealMinutes} min total
              {" · "}Short/rest breaks: {emp.shortBreaks.length}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 ring-1 ring-emerald-400/20">
              <div className="text-[10px] uppercase tracking-wide text-emerald-200/60">Worked Hrs</div>
              <div className="text-lg font-semibold text-emerald-50 tabular-nums">{emp.totalWorkLabel}</div>
            </div>
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 ring-1 ring-amber-400/20">
              <div className="text-[10px] uppercase tracking-wide text-amber-200/60">Total meal break</div>
              <div className="text-lg font-semibold text-amber-50 tabular-nums">
                {emp.totalMealMinutes} min
              </div>
            </div>
            {emp.schedule && (
              <div className="rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/10 col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase tracking-wide text-white/40">Scheduled</div>
                <div className="text-sm font-medium text-white/90">
                  {emp.schedule.start} – {emp.schedule.end}{" "}
                  <span className="text-white/50">({emp.schedule.scheduledLabel})</span>
                </div>
              </div>
            )}
          </div>

          {remarksOpen && warning && (
            <RemarksPanel
              warning={warning}
              onSynced={(next) => {
                setWarning(next);
                onChanged();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
