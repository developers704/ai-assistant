"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HrEmployeeDay, HrViolation, HrWarningNotice } from "@/lib/hr/types";
import { MISSING_PUNCH_LABEL } from "@/lib/hr/window";
import {
  isEligibleForHrNotice,
  noticeDescriptionForEmployee,
} from "@/lib/hr/warning-notice";
import {
  isWarningMailSessionReady,
  replyOnWarningThread,
  sendLateWarningNotice,
  sendWriteUpNotice,
  syncWarningRemarks,
} from "@/lib/hr/send-warning-mail";
import { stripQuotedReply } from "@/lib/hr/remark-text";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Reply,
} from "lucide-react";

const AVATAR_TONES = [
  { bg: "#f1eeff", fg: "#6c4dff" },
  { bg: "#e7f7f4", fg: "#0e9f90" },
  { bg: "#eef4ff", fg: "#2563eb" },
  { bg: "#fff4eb", fg: "#c2410c" },
  { bg: "#fff1f3", fg: "#e11d48" },
] as const;

function employeeInitials(name: string): string {
  const cleaned = name.replace(/^\d+\s*,\s*/, "").trim() || name.trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase() || "?";
}

function avatarTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
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

function violationLabel(v: HrViolation): string {
  return v.message;
}

function RemarksPanel({
  warning,
  label,
  onSynced,
}: {
  warning: HrWarningNotice;
  label: string;
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
      const ready = await isWarningMailSessionReady();
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
      const ready = await isWarningMailSessionReady();
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
    <div className="hr-thread">
      <div className="hr-thread-head">
        <div>
          <div className="hr-thread-title">{label} remarks</div>
          <div className="hr-thread-sub">Employee replies to {warning.subject}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" className="hr-btn hr-btn-outline hr-btn-sm" onClick={() => void sync()} disabled={syncing}>
            {syncing ? <Loader2 size={14} className="animate-spin" /> : null}
            Sync replies
          </button>
          <button
            type="button"
            className="hr-btn hr-btn-primary hr-btn-sm"
            onClick={() => {
              setReplyOpen((o) => !o);
              setError(null);
            }}
          >
            <Reply size={14} />
            Reply
          </button>
        </div>
      </div>
      {error && (
        <p className="hr-alert hr-alert-err" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
          {error}{" "}
          {/e-mails/i.test(error) && (
            <Link href="/valliani-mail" className="hr-link">
              Open E-Mails
            </Link>
          )}
        </p>
      )}
      {status && (
        <p className="hr-alert hr-alert-ok" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
          {status}
        </p>
      )}
      {warning.remarks.length === 0 ? (
        <p className="hr-footnote" style={{ marginTop: "0.75rem" }}>
          No employee reply yet.
        </p>
      ) : (
        <div className="hr-bubbles">
          {warning.remarks.map((r) => {
            const body = stripQuotedReply(r.body);
            if (!body) return null;
            const fromHr =
              r.fromEmail.toLowerCase() === (warning.from || "").toLowerCase();
            return (
              <div key={r.id} className={cn("hr-bubble", fromHr ? "hr-bubble-out" : "hr-bubble-in")}>
                <div className="hr-bubble-meta">
                  {fromHr ? "You" : r.fromName || r.fromEmail || "Employee"} · {formatStamp(r.sentAt)}
                </div>
                <div className="hr-bubble-body">{body}</div>
              </div>
            );
          })}
        </div>
      )}
      {replyOpen && (
        <div className="space-y-2 pt-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={4}
            placeholder="Write a reply — sent on the same email thread"
            className="hr-textarea"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="hr-btn hr-btn-ghost hr-btn-sm" onClick={() => setReplyOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="hr-btn hr-btn-primary hr-btn-sm"
              onClick={() => void sendReply()}
              disabled={sendingReply || !replyText.trim()}
            >
              {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Reply size={14} />}
              Send reply
            </button>
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
  const [writeUpRemarksOpen, setWriteUpRemarksOpen] = useState(false);
  const [writeUpOpen, setWriteUpOpen] = useState(false);
  const [writeUpText, setWriteUpText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingWriteUp, setSendingWriteUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<HrWarningNotice | null>(emp.warning ?? null);
  const [writeUp, setWriteUp] = useState<HrWarningNotice | null>(emp.writeUp ?? null);
  useEffect(() => {
    setWarning(emp.warning ?? null);
    setWriteUp(emp.writeUp ?? null);
  }, [emp.warning, emp.writeUp]);
  const hasError = emp.violations.some((v) => v.severity === "error");
  const missingSchedule = emp.violations.some((v) => v.type === "no_schedule");
  const isAbsent = emp.violations.some((v) => v.type === "absent");
  const canSendNotice = isEligibleForHrNotice(emp);
  const tone = avatarTone(emp.employeeName);
  const late = emp.lateMinutes != null && emp.lateMinutes >= 12;
  const early = emp.earlyInMinutes != null && emp.earlyInMinutes >= 10;
  const mealFlag = emp.violations.some(
    (v) =>
      v.type === "long_meal" ||
      v.type === "excessive_meal_total" ||
      v.type === "short_meal_total" ||
      v.type === "meal_count"
  );

  const sendWarning = async (event: MouseEvent) => {
    event.stopPropagation();
    setSending(true);
    setError(null);
    try {
      const ready = await isWarningMailSessionReady();
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

  const openWriteUp = (event: MouseEvent) => {
    event.stopPropagation();
    setError(null);
    setWriteUpOpen(true);
    setOpen(true);
    if (!writeUpText.trim()) {
      setWriteUpText(noticeDescriptionForEmployee(emp));
    }
  };

  const sendWriteUp = async () => {
    setSendingWriteUp(true);
    setError(null);
    try {
      const ready = await isWarningMailSessionReady();
      if (!ready.ok) throw new Error(ready.reason);
      if (!writeUpText.trim()) throw new Error("Write a description before sending the write-up");
      const next = await sendWriteUpNotice(emp, writeUpText);
      setWriteUp(next);
      setWriteUpOpen(false);
      setWriteUpRemarksOpen(true);
      setOpen(true);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send write-up");
      setOpen(true);
    } finally {
      setSendingWriteUp(false);
    }
  };

  const roleLine = [emp.jobTitle, emp.store].filter((s) => s?.trim()).join(" · ");

  return (
    <div className={cn("hr-emp", hasError && "hr-emp-error", missingSchedule && "hr-emp-no-schedule")}>
      <div className="hr-emp-head">
        <button type="button" onClick={() => setOpen((o) => !o)} className="hr-emp-main">
          {open ? (
            <ChevronDown size={16} className="shrink-0 mt-1.5" style={{ color: "#8b95a5" }} />
          ) : (
            <ChevronRight size={16} className="shrink-0 mt-1.5" style={{ color: "#8b95a5" }} />
          )}
          <span className="hr-avatar" style={{ background: tone.bg, color: tone.fg }}>
            {employeeInitials(emp.employeeName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="hr-emp-name block truncate">{emp.employeeName}</span>
            <span className="hr-emp-meta block truncate">
              {emp.schedule ? (
                `${roleLine ? `${roleLine} · ` : ""}Scheduled ${emp.schedule.start} – ${emp.schedule.end}`
              ) : (
                <>
                  {roleLine ? `${roleLine} · ` : ""}
                  <span className="hr-emp-meta-miss">Schedule missing</span>
                </>
              )}
            </span>
            <span className="hr-stat-row">
              <span>
                Worked <strong>{emp.totalWorkLabel}</strong>
              </span>
              <span>
                Meal{" "}
                <strong>
                  {emp.totalMealMinutes}m
                  {emp.expectedMealMinutes > 0 ? ` / ${emp.expectedMealMinutes}` : ""}
                </strong>
              </span>
              {emp.schedule && (
                <span>
                  Shift <strong>{emp.schedule.scheduledLabel}</strong>
                </span>
              )}
            </span>
            <span className="hr-pills">
              {missingSchedule && <span className="hr-pill hr-pill-miss">Schedule missing</span>}
              {isAbsent && <span className="hr-pill hr-pill-warn">Absent</span>}
              {late && <span className="hr-pill hr-pill-warn">Late {emp.lateMinutes} min</span>}
              {early && <span className="hr-pill hr-pill-info">Early {emp.earlyInMinutes} min</span>}
              {mealFlag && <span className="hr-pill hr-pill-warn">Meal break</span>}
              {warning && <span className="hr-pill hr-pill-sent">Warning sent</span>}
              {writeUp && <span className="hr-pill hr-pill-gold">Write-up sent</span>}
            </span>
          </span>
        </button>
        <div className="hr-emp-actions">
          {canSendNotice && !warning && (
            <button
              type="button"
              className="hr-btn hr-btn-primary hr-btn-sm"
              data-action="send-warning"
              onClick={(e) => void sendWarning(e)}
              disabled={sending || sendingWriteUp}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Send warning
            </button>
          )}
          {canSendNotice && !writeUp && (
            <button
              type="button"
              className="hr-btn hr-btn-outline hr-btn-sm"
              data-action="send-write-up"
              onClick={openWriteUp}
              disabled={sending || sendingWriteUp}
            >
              <FileText size={14} />
              Write up
            </button>
          )}
          {warning && (
            <button
              type="button"
              className="hr-btn hr-btn-outline hr-btn-sm"
              data-action="warning-remarks"
              onClick={() => {
                setRemarksOpen((o) => !o);
                setOpen(true);
              }}
            >
              <MessageSquare size={14} />
              Warning remarks{warning.remarks.length ? ` (${warning.remarks.length})` : ""}
            </button>
          )}
          {writeUp && (
            <button
              type="button"
              className="hr-btn hr-btn-outline hr-btn-sm"
              data-action="write-up-remarks"
              onClick={() => {
                setWriteUpRemarksOpen((o) => !o);
                setOpen(true);
              }}
            >
              <MessageSquare size={14} />
              Write-up remarks{writeUp.remarks.length ? ` (${writeUp.remarks.length})` : ""}
            </button>
          )}
          {emp.violations.length > 0 && (
            <AlertTriangle size={16} style={{ color: hasError ? "#e11d48" : "#c2410c" }} />
          )}
        </div>
      </div>

      {open && (
        <div className="hr-emp-body">
          {error && (
            <div className="hr-alert hr-alert-err">
              {error}{" "}
              {/e-mails/i.test(error) && (
                <Link href="/valliani-mail" className="hr-link">
                  Open E-Mails
                </Link>
              )}
            </div>
          )}
          {emp.violations.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {emp.violations.map((v) => (
                <div
                  key={`${v.type}-${v.message}`}
                  className={v.severity === "error" ? "hr-alert hr-alert-err" : "hr-callout"}
                  style={{ marginBottom: 0 }}
                >
                  {violationLabel(v)}
                </div>
              ))}
            </div>
          )}

          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Gap</th>
                  <th>Work</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {emp.segments.map((seg, i) => (
                  <tr key={i} className={cn(seg.violations.length > 0 && "hr-row-flag")}>
                    <td className={cn(!seg.timeIn?.trim() && "hr-missing")}>
                      {seg.timeIn?.trim() ? seg.timeIn : MISSING_PUNCH_LABEL}
                    </td>
                    <td className={cn(!seg.timeOut?.trim() && "hr-missing")}>
                      {seg.timeOut?.trim() ? seg.timeOut : MISSING_PUNCH_LABEL}
                    </td>
                    <td>
                      {seg.gapMinutes != null ? (
                        <span
                          className={cn(
                            seg.gapKind === "meal_break" && "hr-gap-meal",
                            seg.gapKind === "short_break" && "hr-gap-rest"
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
                    <td>{seg.workLabel}</td>
                    <td>
                      {seg.violations.length
                        ? seg.violations.map((v) => v.message).join(" · ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {emp.shiftTier && (
            <p className="hr-footnote">
              Shift tier: {emp.shiftTier === "ten" ? "≤10h" : emp.shiftTier === "eleven" ? "11h" : "≥12h"}
              {" · "}Expected {emp.expectedMealCount} meal(s), {emp.expectedMealMinutes} min total
              {" · "}Short/rest breaks: {emp.shortBreaks.length}
            </p>
          )}

          <div className="hr-metric-grid">
            <div className="hr-metric">
              <div className="hr-metric-label">Worked hrs</div>
              <div className="hr-metric-value">{emp.totalWorkLabel}</div>
            </div>
            <div className="hr-metric">
              <div className="hr-metric-label">Total meal break</div>
              <div className="hr-metric-value">{emp.totalMealMinutes} min</div>
            </div>
            {emp.schedule ? (
              <div className="hr-metric">
                <div className="hr-metric-label">Scheduled</div>
                <div className="hr-metric-value" style={{ fontSize: "0.92rem" }}>
                  {emp.schedule.start} – {emp.schedule.end}{" "}
                  <span style={{ color: "#8b95a5", fontWeight: 600 }}>({emp.schedule.scheduledLabel})</span>
                </div>
              </div>
            ) : (
              <div className="hr-metric">
                <div className="hr-metric-label">Scheduled</div>
                <div className="hr-metric-value hr-emp-meta-miss" style={{ fontSize: "0.92rem" }}>
                  Schedule missing
                </div>
              </div>
            )}
          </div>

          {writeUpOpen && !writeUp && (
            <div className="hr-composer" onClick={(e) => e.stopPropagation()}>
              <div className="hr-thread-title">Write-up description</div>
              <div className="hr-thread-sub" style={{ marginBottom: "0.65rem" }}>
                Typed here for this employee only — it goes on the Disciplinary Action Form PDF when you send.
              </div>
              <textarea
                value={writeUpText}
                onChange={(e) => setWriteUpText(e.target.value)}
                rows={5}
                placeholder="Describe the incident for this employee…"
                className="hr-textarea"
              />
              <div className="flex justify-end gap-2" style={{ marginTop: "0.65rem" }}>
                <button type="button" className="hr-btn hr-btn-ghost hr-btn-sm" onClick={() => setWriteUpOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="hr-btn hr-btn-primary hr-btn-sm"
                  onClick={() => void sendWriteUp()}
                  disabled={sendingWriteUp || !writeUpText.trim()}
                >
                  {sendingWriteUp ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  Send write-up
                </button>
              </div>
            </div>
          )}

          {remarksOpen && warning && (
            <RemarksPanel
              warning={warning}
              label="Warning"
              onSynced={(next) => {
                setWarning(next);
                onChanged();
              }}
            />
          )}
          {writeUpRemarksOpen && writeUp && (
            <RemarksPanel
              warning={writeUp}
              label="Write-up"
              onSynced={(next) => {
                setWriteUp(next);
                onChanged();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
