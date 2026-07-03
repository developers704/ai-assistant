"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type { StoredReportMeta } from "@/lib/reports/types";
import { periodLabel } from "@/lib/reports/detect-report";
import { FolderOpen, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

function formatReportDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface SavedReportsPanelProps {
  reports: StoredReportMeta[];
  activeId?: string | null;
  loading?: boolean;
  deletingId?: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
  /** Mobile: collapse to a single row to save vertical space */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function SavedReportsPanel({
  reports,
  activeId,
  loading,
  deletingId,
  onOpen,
  onDelete,
  compact,
  collapsible,
  defaultCollapsed = false,
}: SavedReportsPanelProps) {
  const [open, setOpen] = useState(!defaultCollapsed);

  if (reports.length === 0) {
    return (
      <div
        className={`glass-panel rounded-2xl ring-1 ring-white/10 ${
          compact ? "p-3" : "p-4 w-full max-w-xl"
        }`}
      >
        <p className="text-sm font-medium text-ink flex items-center gap-2 mb-2">
          <FolderOpen size={16} className="text-cyan-300" />
          Saved reports
        </p>
        <p className="text-xs text-ink-muted leading-relaxed">
          No reports saved on this server yet. Upload a CSV with &quot;Save to server&quot; checked — files stay
          here (not copied from your laptop).
        </p>
      </div>
    );
  }

  const activeReport = reports.find((r) => r.id === activeId) ?? reports[0];

  if (collapsible && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full glass-panel rounded-xl ring-1 ring-white/10 px-3 py-2.5 flex items-center justify-between gap-2 text-left lg:hidden"
      >
        <span className="text-xs font-medium text-ink flex items-center gap-2 min-w-0">
          <FolderOpen size={14} className="text-cyan-300 shrink-0" />
          <span className="truncate">
            {activeReport?.label ?? "Saved reports"} · {reports.length} file
            {reports.length !== 1 ? "s" : ""}
          </span>
        </span>
        <ChevronDown size={16} className="text-ink-muted shrink-0" />
      </button>
    );
  }

  return (
    <div
      className={`glass-panel rounded-2xl ring-1 ring-white/10 ${
        compact ? "p-3" : "p-4 w-full max-w-xl"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-medium text-ink flex items-center gap-2">
          <FolderOpen size={16} className="text-cyan-300" />
          Saved reports
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">{reports.length} file{reports.length !== 1 ? "s" : ""}</span>
          {collapsible && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="lg:hidden p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-white/10"
              aria-label="Collapse saved reports"
            >
              <ChevronUp size={16} />
            </button>
          )}
        </div>
      </div>

      <div className={`space-y-1.5 ${compact ? "max-h-28 sm:max-h-32" : "max-h-48"} overflow-y-auto`}>
        {reports.map((r, index) => {
          const isActive = activeId === r.id;
          const isDeleting = deletingId === r.id;
          return (
            <div
              key={r.id}
              className={`flex items-center gap-1 rounded-xl ring-1 transition-colors ${
                isActive
                  ? "bg-cyan-500/15 ring-cyan-400/30"
                  : "bg-white/5 ring-white/5 hover:bg-white/10"
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(r.id)}
                disabled={loading || isDeleting}
                className="flex-1 min-w-0 text-left px-3 py-2.5 text-sm disabled:opacity-50"
              >
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-ink truncate font-medium">{r.label}</span>
                  {index === 0 && (
                    <Badge variant="success" className="text-[9px] px-1.5 py-0 shrink-0">
                      Latest
                    </Badge>
                  )}
                  {r.vendorCode && (
                    <Badge variant="info" className="text-[9px] px-1.5 py-0 shrink-0">
                      {r.vendorCode}
                    </Badge>
                  )}
                  {r.reportCategory === "financing" && (
                    <Badge variant="info" className="text-[9px] px-1.5 py-0 shrink-0">
                      Financing
                    </Badge>
                  )}
                  {r.reportPeriod && (
                    <Badge variant="default" className="text-[9px] px-1.5 py-0 shrink-0">
                      {periodLabel(r.reportPeriod)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-muted">
                  <span>{r.rowCount.toLocaleString()} rows</span>
                  <span>·</span>
                  <span>{formatReportDate(r.uploadedAt)}</span>
                  {r.reportDate && (
                    <>
                      <span>·</span>
                      <span>Data: {r.reportDate}</span>
                    </>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(r.id);
                }}
                disabled={loading || isDeleting}
                aria-label={`Remove ${r.label}`}
                className="shrink-0 p-2 mr-1 rounded-lg text-ink-muted hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
              >
                {isDeleting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-muted mt-3 leading-relaxed hidden sm:block">
        Latest report powers the Dashboard. Remove old store exports you no longer need.
      </p>
    </div>
  );
}
