"use client";

import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CameraModal } from "@/components/CameraModal";
import { cn } from "@/lib/utils";
import type { ScanDocKind, ScanResult } from "@/types/scan";
import {
  ScanLine,
  Upload,
  Camera,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  FileText,
  CreditCard,
  Receipt,
  Sparkles,
  X,
} from "lucide-react";

const MAX_BYTES = 20 * 1024 * 1024;

const chipActive = "bg-teal-500/20 text-ink ring-1 ring-teal-400/40";
const chipIdle = "text-ink-muted hover:text-ink hover:bg-white/5";
const KINDS: { id: ScanDocKind; label: string; icon: typeof FileText }[] = [
  { id: "auto", label: "Auto detect", icon: Sparkles },
  { id: "id", label: "Government ID", icon: CreditCard },
  { id: "receipt", label: "Receipt / Invoice", icon: Receipt },
];

const DOC_LABELS: Record<ScanResult["documentType"], string> = {
  government_id: "Government ID",
  receipt: "Receipt",
  invoice: "Invoice",
  business_card: "Business Card",
  other: "Document",
};

function formatResultText(result: ScanResult): string {
  const lines: string[] = [
    `Document type: ${DOC_LABELS[result.documentType]}`,
    `Summary: ${result.summary}`,
    "",
    "— Extracted fields —",
  ];
  for (const f of result.fields) {
    lines.push(`${f.label}: ${f.value}${f.confidence !== "high" ? ` (${f.confidence} confidence)` : ""}`);
  }
  if (result.lineItems.length > 0) {
    lines.push("", "— Line items —");
    for (const item of result.lineItems) {
      const parts = [item.description];
      if (item.quantity) parts.push(`qty ${item.quantity}`);
      if (item.unitPrice) parts.push(`@ ${item.unitPrice}`);
      if (item.amount) parts.push(`= ${item.amount}`);
      lines.push(parts.join(" | "));
    }
  }
  if (result.warnings.length > 0) {
    lines.push("", "— Warnings —", ...result.warnings);
  }
  lines.push("", "— Raw text —", result.rawText);
  return lines.join("\n");
}

export default function ScanPage() {
  const [kind, setKind] = useState<ScanDocKind>("auto");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("Image is too large. Use a file under 20MB.");
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const scan = async () => {
    if (!file) {
      setError("Capture or upload an image first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("kind", kind);
      const res = await fetch("/api/scan-document", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed.");
      setResult(json.result as ScanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  };

  const copyText = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(formatResultText(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="glass-panel-strong rounded-3xl ring-1 ring-white/10 overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
          <PageHeader
            title="ID & Receipt Scanner"
            subtitle="Capture or upload a photo — AI reads the document and returns structured text (names, numbers, totals, dates)."
          />
        </div>

        <div className="px-5 sm:px-6 py-5">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Input */}
            <div className="glass-panel rounded-2xl p-5 ring-1 ring-white/10">
              <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 ring-1 ring-teal-400/20">
                  <ScanLine size={14} className="text-teal-300" />
                </span>
                Document type
              </h2>
              <div className="flex flex-wrap gap-2 mb-5">
                {KINDS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setKind(id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                      kind === id ? chipActive : chipIdle
                    )}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />

              {!preview ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    className={cn(
                      "w-full flex flex-col items-center justify-center gap-3 py-10 rounded-3xl border-2 border-dashed transition-all ring-1 ring-white/5",
                      dragOver
                        ? "border-teal-400/50 bg-teal-500/10"
                        : "border-teal-400/30 bg-teal-500/5 hover:border-teal-400/50 hover:bg-teal-500/10"
                    )}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/20 ring-1 ring-teal-400/30">
                      <Upload size={26} className="text-teal-300" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink">Upload ID or receipt</p>
                      <p className="text-xs text-ink-muted mt-1">PNG, JPG, WEBP — up to 20MB</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-ink-muted uppercase tracking-wide">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <Button type="button" variant="outline" className="w-full" onClick={() => setShowCamera(true)}>
                    <Camera size={16} /> Take photo with camera
                  </Button>
                  <p className="text-xs text-ink-muted text-center">
                    Hold the document flat, good lighting, all corners visible for best accuracy.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-white/5 ring-1 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Document preview" className="w-full max-h-72 object-contain" />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-ink/70 hover:bg-ink/90 text-white flex items-center justify-center ring-1 ring-white/20"
                      aria-label="Remove image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-ink-secondary hover:text-teal-300 transition-colors"
                    >
                      Choose different file
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="text-xs text-ink-secondary hover:text-teal-300 inline-flex items-center gap-1 transition-colors"
                    >
                      <Camera size={12} /> Retake with camera
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 text-sm text-accent-rose bg-red-500/10 rounded-xl px-3 py-2 ring-1 ring-red-400/20">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <Button type="button" className="w-full mt-5" onClick={scan} disabled={!file || loading}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Reading document…
                  </>
                ) : (
                  <>
                    <ScanLine size={16} /> Extract structured text
                  </>
                )}
              </Button>
            </div>

            {/* Output */}
            <div className="glass-panel rounded-2xl p-5 ring-1 ring-white/10 min-h-[420px] flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 ring-1 ring-teal-400/20">
                    <FileText size={14} className="text-teal-300" />
                  </span>
                  Structured output
                </h2>
                {result && (
                  <Button type="button" variant="outline" size="sm" onClick={copyText}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy all"}
                  </Button>
                )}
              </div>

              {!result && !loading && (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/20 ring-1 ring-teal-400/30 mb-4">
                    <ScanLine size={28} className="text-teal-300" />
                  </span>
                  <p className="text-ink-secondary text-sm font-medium">No scan yet</p>
                  <p className="text-xs text-ink-muted mt-1 max-w-xs">
                    Capture an ID, driver&apos;s license, passport, or receipt — fields and full text appear here.
                  </p>
                </div>
              )}

              {loading && (
                <div className="flex flex-1 flex-col items-center justify-center py-12">
                  <Loader2 size={32} className="text-teal-300 animate-spin mb-3" />
                  <p className="text-sm text-ink-secondary">Analyzing document with GPT-4o vision…</p>
                  <p className="text-xs text-ink-muted mt-1">Usually 5–15 seconds</p>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-5 overflow-y-auto max-h-[calc(100dvh-16rem)] pr-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">{DOC_LABELS[result.documentType]}</Badge>
                    <span className="text-xs text-ink-muted">
                      {new Date(result.processedAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm text-ink-secondary leading-relaxed">{result.summary}</p>

                  {result.warnings.length > 0 && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-400/25 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-400/15">
                      <p className="font-medium mb-1 text-amber-100">Notes</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        {result.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.fields.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
                        Extracted fields
                      </h3>
                      <dl className="divide-y divide-white/10 rounded-xl border border-white/15 overflow-hidden ring-1 ring-white/5">
                        {result.fields.map((field, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3 px-3 py-2.5 bg-white/[0.03] even:bg-white/[0.06]"
                          >
                            <dt className="text-xs font-medium text-ink-muted">{field.label}</dt>
                            <dd className="text-sm text-ink break-words">
                              {field.value || "—"}
                              {field.confidence !== "high" && (
                                <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-300/90">
                                  {field.confidence}
                                </span>
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {result.lineItems.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
                        Line items
                      </h3>
                      <div className="rounded-xl border border-white/15 overflow-x-auto ring-1 ring-white/5">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white/5 text-left text-xs text-ink-muted">
                              <th className="px-3 py-2 font-medium">Item</th>
                              <th className="px-3 py-2 font-medium">Qty</th>
                              <th className="px-3 py-2 font-medium">Price</th>
                              <th className="px-3 py-2 font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10">
                            {result.lineItems.map((item, i) => (
                              <tr key={i} className="hover:bg-white/[0.03]">
                                <td className="px-3 py-2 text-ink">{item.description}</td>
                                <td className="px-3 py-2 text-ink-muted">{item.quantity || "—"}</td>
                                <td className="px-3 py-2 text-ink-muted">{item.unitPrice || "—"}</td>
                                <td className="px-3 py-2 text-ink font-medium">{item.amount || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
                      Full text (OCR)
                    </h3>
                    <pre className="text-xs text-ink-secondary whitespace-pre-wrap break-words rounded-xl border border-white/15 bg-white/5 p-3 max-h-64 overflow-y-auto font-mono leading-relaxed ring-1 ring-white/5">
                      {result.rawText || "No text detected."}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CameraModal
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={pickFile}
        title="Capture ID or receipt"
      />
    </div>
  );
}
