"use client";

import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { PageHeader } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { DataPreview } from "@/components/analyst/DataPreview";
import { SavedReportsPanel } from "@/components/analyst/SavedReportsPanel";
import { ResultTable } from "@/components/analyst/ResultTable";
import { ResultChart, ForecastChart } from "@/components/analyst/ResultChart";
import { loadCSV, loadCSVFromText, runQuery, validateReadOnlySQL } from "@/lib/analyst/duckdb";
import { isEmptyAggregateResult, repairAnalystSql } from "@/lib/analyst/sql-repair";
import { computeForecast } from "@/lib/analyst/forecast";
import { toSchemaForLLM } from "@/lib/analyst/types";
import type { AnalystMessage, AnalystPlan, QueryResult, TableSchema } from "@/lib/analyst/types";
import type { ReportCategory, ReportPeriod, StoredReportMeta } from "@/lib/reports/types";
import {
  Upload,
  Send,
  Sparkles,
  Bot,
  User,
  Code2,
  AlertTriangle,
  Loader2,
  BarChart3,
  Save,
  ChevronDown,
} from "lucide-react";

function buildSuggestions(schema: TableSchema): string[] {
  const colNames = schema.columns.map((c) => c.name.toLowerCase());
  const isStoreSales =
    colNames.some((c) => c.includes("transaction") && c.includes("#")) &&
    colNames.some((c) => c.includes("sku") || (c.includes("item") && c.includes("#"))) &&
    colNames.some((c) => c.includes("vendor name")) &&
    colNames.some((c) => c === "total");

  if (isStoreSales) {
    return [
      "Top 10 stores by net sales (Total)",
      "Sales by Department",
      "Top vendors by revenue (Vendor Name)",
      "Top products by Item # / SKU #",
      "Daily net sales trend by Transaction Date",
    ].slice(0, 5);
  }

  const isFinancing =
    colNames.some((c) => c.includes("pay method")) &&
    colNames.some((c) => c.includes("transaction date")) &&
    colNames.some((c) => c.includes("net amt") || c === "total");

  if (isFinancing) {
    return [
      "Total net sales by Store",
      "Sales by Pay Method (Cash vs Credit Card vs Financing)",
      "Top financing programs by Pay Code",
      "Total profit by Store",
      "Top 10 salespeople by Net Amt",
    ].slice(0, 5);
  }

  const isVendorPos =
    colNames.includes("total") &&
    colNames.some((c) => c.includes("department")) &&
    colNames.some((c) => c.includes("store"));

  if (isVendorPos) {
    return [
      "Top 10 stores by net sales (Total)",
      "Sales by Department",
      "Top Design lines by revenue",
      "Total discounts given (Disc Amt)",
      "Daily net sales trend by Transaction Date",
    ].slice(0, 5);
  }

  const numeric = schema.columns.filter((c) => c.kind === "number");
  const text = schema.columns.filter((c) => c.kind === "text");
  const date = schema.columns.find((c) => c.kind === "date");
  const out: string[] = [];

  const metric =
    numeric.find((c) => /revenue|sales|amount|total|price/i.test(c.name)) ?? numeric[0];
  const dim = text.find((c) => /product|item|name|category/i.test(c.name)) ?? text[0];

  if (metric && dim) {
    out.push(`Top 10 ${dim.name} by ${metric.name}`);
    out.push(`Which ${dim.name} has the lowest ${metric.name}?`);
  }
  if (metric && date) {
    out.push(`Monthly trend of ${metric.name}`);
    out.push(`Forecast ${metric.name} for the next 6 months`);
  }
  out.push("Give me a summary of this data");
  return out.slice(0, 5);
}

/** Deterministic answer line computed from the actual engine results. */
function summarizeResult(plan: AnalystPlan, result: QueryResult): string {
  if (result.rows.length === 1 && result.columns.length === 1) {
    const v = result.rows[0][result.columns[0]];
    if (v == null || v === "") {
      return `${plan.title}: $0 (no matching rows)`;
    }
    const formatted =
      typeof v === "number"
        ? v.toLocaleString("en-US", { maximumFractionDigits: 2 })
        : String(v);
    return `${plan.title}: ${formatted}`;
  }
  return `${plan.title} — ${result.rows.length.toLocaleString()} row${
    result.rows.length === 1 ? "" : "s"
  } computed from your data.`;
}

export default function AnalystPage() {
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [messages, setMessages] = useState<AnalystMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveToServer, setSaveToServer] = useState(true);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("daily");
  const [reportCategory, setReportCategory] = useState<ReportCategory>("sales");
  const [savedReports, setSavedReports] = useState<StoredReportMeta[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [metaExpanded, setMetaExpanded] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasResults = messages.some((m) => m.result || m.forecastData);

  const scrollDown = () =>
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      } else {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, 80);

  useEffect(() => {
    if (hasResults && typeof window !== "undefined" && window.innerWidth < 1024) {
      setMetaExpanded(false);
    }
  }, [hasResults]);

  const welcomeMessage = (fileName: string, rowCount: number, colCount: number, saved?: boolean) =>
    `Loaded "${fileName}" — ${rowCount.toLocaleString()} rows and ${colCount} columns.${
      saved
        ? " Saved as the latest report — Sales Dashboard, chat, and voice will use this data."
        : ""
    } Ask me anything: totals, top/low sellers, trends, breakdowns, or forecasts.`;

  const applySchema = (s: TableSchema, saved?: boolean, reportId?: string | null) => {
    setSchema(s);
    if (reportId !== undefined) setActiveReportId(reportId);
    setMessages([
      {
        id: uuidv4(),
        role: "assistant",
        content: welcomeMessage(s.fileName, s.rowCount, s.columns.length, saved),
      },
    ]);
  };

  const refreshReportList = async () => {
    const res = await fetch("/api/reports");
    if (res.ok) {
      const data = await res.json();
      setSavedReports(data.reports ?? []);
    }
  };

  const loadSavedReport = async (id: string) => {
    setLoadingFile(true);
    setFileError(null);
    try {
      const res = await fetch(`/api/reports/latest?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok || !data.csv) throw new Error(data.error || "Could not load report");
      const s = await loadCSVFromText(data.report.fileName, data.csv);
      applySchema(s, false, id);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to load saved report.");
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshReportList();
        const res = await fetch("/api/reports/latest");
        const data = await res.json();
        if (!cancelled && data.csv && data.report) {
          const s = await loadCSVFromText(data.report.fileName, data.csv);
          applySchema(s, false, data.report.id);
        }
      } catch {
        // no saved reports yet
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveReportToServer = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("label", file.name.replace(/\.csv$/i, ""));
    form.append("reportPeriod", reportPeriod);
    form.append("reportCategory", reportCategory);
    const res = await fetch("/api/reports", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save report");
    await refreshReportList();
    if (data.liveForSales) {
      const { emitSalesReportUpdated } = await import("@/lib/sales/report-updated-client");
      emitSalesReportUpdated({
        reportId: data.report?.id,
        label: data.report?.label,
        dateFrom: data.dateRange?.from ?? null,
        dateTo: data.dateRange?.to ?? null,
        dataVersion: data.dataVersion ?? null,
      });
    }
    return data.report?.id as string | undefined;
  };

  const removeReport = async (id: string) => {
    const target = savedReports.find((r) => r.id === id);
    if (!target) return;
    const confirmed = window.confirm(
      `Remove "${target.label}" from saved reports?\n\nIf this is the latest sales report, Sales Dashboard / chat / voice will fall back to the next newest report.`
    );
    if (!confirmed) return;

    setDeletingReportId(id);
    setFileError(null);
    try {
      const res = await fetch(`/api/reports?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove report");

      const wasActive = activeReportId === id;
      await refreshReportList();

      const { emitSalesReportUpdated } = await import("@/lib/sales/report-updated-client");
      emitSalesReportUpdated({
        dataVersion: data.dataVersion ?? null,
      });

      if (wasActive) {
        const latestRes = await fetch("/api/reports/latest");
        const latestData = await latestRes.json();
        if (latestData.csv && latestData.report) {
          const s = await loadCSVFromText(latestData.report.fileName, latestData.csv);
          applySchema(s, false, latestData.report.id);
        } else {
          setSchema(null);
          setActiveReportId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to remove report.");
    } finally {
      setDeletingReportId(null);
    }
  };

  const handleFile = async (file: File, options?: { save?: boolean }) => {
    setLoadingFile(true);
    setFileError(null);
    const shouldSave = options?.save ?? saveToServer;
    try {
      let reportId: string | null = null;
      if (shouldSave) {
        reportId = (await saveReportToServer(file)) ?? null;
      }
      const s = await loadCSV(file);
      applySchema(s, shouldSave, reportId);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to load the CSV file.");
    } finally {
      setLoadingFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const callAnalystAPI = async (
    question: string,
    failedSql?: string,
    errorMessage?: string
  ): Promise<AnalystPlan> => {
    const history = messages.slice(-6).map((m) => ({
      role: m.role,
      content:
        m.role === "assistant" && m.plan ? `${m.plan.title}\nSQL used: ${m.plan.sql}` : m.content,
    }));
    const res = await fetch("/api/analyst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        schema: toSchemaForLLM(schema!),
        history,
        failedSql,
        errorMessage,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "AI request failed");
    return data.plan as AnalystPlan;
  };

  const executePlan = async (plan: AnalystPlan): Promise<AnalystMessage> => {
    const validationError = validateReadOnlySQL(plan.sql);
    if (validationError) throw new Error(validationError);

    const repairedSql = repairAnalystSql(plan.sql, schema!);
    const planToRun = repairedSql !== plan.sql ? { ...plan, sql: repairedSql } : plan;
    let result = await runQuery(planToRun.sql);

    // If a scalar aggregate came back null/empty, ask the model to fix filters once.
    if (isEmptyAggregateResult(result.rows) && planToRun.sql) {
      try {
        const fixed = await callAnalystAPI(
          // keep original user question context via history; nudge explicitly
          `The previous SQL returned no matching rows (NULL/empty aggregate). Fix date and Design filters for Valliani store sales CSV. Use lower(trim("Design")) and robust Transaction Date casting (US m/d/Y like 7/10/2026 = 10 July). Original SQL:\n${planToRun.sql}`,
          planToRun.sql,
          "Query returned no matching rows (NULL aggregate or 0 rows)."
        );
        if (fixed.sql) {
          const fixedSql = repairAnalystSql(fixed.sql, schema!);
          const retry = await runQuery(fixedSql);
          if (!isEmptyAggregateResult(retry.rows) || retry.rows.length > 1) {
            result = retry;
            return {
              id: uuidv4(),
              role: "assistant",
              content: `${summarizeResult(fixed, result)} ${fixed.explanation}`,
              plan: { ...fixed, sql: fixedSql },
              result,
            };
          }
        }
      } catch {
        // keep first result
      }
    }

    if (planToRun.taskType === "forecast") {
      const forecastData = computeForecast(result, planToRun.forecastPeriods ?? 6);
      return {
        id: uuidv4(),
        role: "assistant",
        content: `${planToRun.title} — forecast for the next ${planToRun.forecastPeriods ?? 6} periods, based on ${result.rows.length.toLocaleString()} historical periods. ${planToRun.explanation}`,
        plan: planToRun,
        result,
        forecastData,
      };
    }

    return {
      id: uuidv4(),
      role: "assistant",
      content: `${summarizeResult(planToRun, result)} ${planToRun.explanation}`,
      plan: planToRun,
      result,
    };
  };

  const ask = async (question: string) => {
    if (!schema || !question.trim() || analyzing) return;
    setInput("");
    setAnalyzing(true);
    setMessages((m) => [...m, { id: uuidv4(), role: "user", content: question.trim() }]);
    scrollDown();

    try {
      let plan = await callAnalystAPI(question.trim());

      if (!plan.sql) {
        setMessages((m) => [
          ...m,
          {
            id: uuidv4(),
            role: "assistant",
            content:
              plan.explanation ||
              "I couldn't answer that from the columns in this file. Try rephrasing or asking about the available columns.",
          },
        ]);
        return;
      }

      let message: AnalystMessage;
      try {
        message = await executePlan(plan);
      } catch (execErr) {
        // One auto-correction round-trip: send the engine error back to the AI.
        const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
        plan = await callAnalystAPI(question.trim(), plan.sql, errMsg);
        if (!plan.sql) throw new Error(plan.explanation || errMsg);
        message = await executePlan(plan);
      }

      setMessages((m) => [...m, message]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: uuidv4(),
          role: "assistant",
          content:
            "I couldn't compute an accurate answer for that question, so I'm not showing a result rather than risking a wrong one.",
          error: err instanceof Error ? err.message : "Unknown error",
        },
      ]);
    } finally {
      setAnalyzing(false);
      scrollDown();
    }
  };

  if (bootstrapping) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-5.5rem)] text-ink-muted">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading saved reports…
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="flex flex-col h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-4rem)]">
        <div className="glass-panel-strong rounded-3xl flex flex-col flex-1 ring-1 ring-white/10 overflow-hidden">
          <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
            <PageHeader
              gradient
              eyebrow="Analytics"
              title="Data Analyst"
              subtitle="Upload a daily CSV report — saved for Dashboard & analysis"
            />
          </div>

          <div className="flex-1 flex flex-col lg:flex-row items-stretch justify-center p-6 sm:p-10 gap-6 max-w-5xl mx-auto w-full">
            <SavedReportsPanel
              reports={savedReports}
              activeId={activeReportId}
              loading={loadingFile}
              deletingId={deletingReportId}
              onOpen={loadSavedReport}
              onDelete={removeReport}
            />

            <div
              className="flex-1 flex flex-col justify-center min-w-0"
            >
            <div
              className="w-full max-w-xl rounded-3xl border-2 border-dashed border-cyan-400/30 bg-cyan-500/5 p-10 sm:p-12 text-center cursor-pointer hover:border-cyan-400/50 hover:bg-cyan-500/10 transition-all ring-1 ring-white/5 mx-auto"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {loadingFile ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={32} className="text-cyan-300 animate-spin" />
                  <p className="text-sm text-ink-secondary">Loading data into the analysis engine…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/20 ring-1 ring-cyan-400/30 shadow-glow">
                    <Upload size={28} className="text-cyan-300" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-ink">Upload a daily CSV report</p>
                    <p className="text-sm text-ink-muted mt-1.5 max-w-sm mx-auto">
                      Sales, inventory, or store exports — saved for the boss Dashboard
                    </p>
                  </div>
                  <label
                    className="flex items-center justify-center gap-2 text-xs text-ink-secondary cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={saveToServer}
                      onChange={(e) => setSaveToServer(e.target.checked)}
                      className="rounded"
                    />
                    <Save size={12} className="text-cyan-300" /> Save to server (updates Dashboard)
                  </label>
                  <div
                    className="flex flex-wrap items-center justify-center gap-2 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value as ReportCategory)}
                      className="select-dark"
                    >
                      <option value="sales">Store sales (SALES-LATEST)</option>
                      <option value="vendor">Vendor report (MHVR)</option>
                      <option value="inventory">Inventory</option>
                      <option value="custom">Other</option>
                    </select>
                    <select
                      value={reportPeriod}
                      onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
                      className="select-dark"
                    >
                      <option value="daily">Daily</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="half_yearly">Half-yearly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom period</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-muted mt-1 px-4 py-2 rounded-full glass-panel">
                    <BarChart3 size={13} className="text-cyan-300" />
                    Top sellers · trends · breakdowns · forecasts · exact numbers
                  </div>
                </div>
              )}
              {fileError && (
                <p className="mt-5 text-sm text-rose-300 flex items-center justify-center gap-1.5">
                  <AlertTriangle size={14} /> {fileError}
                </p>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const suggestions = buildSuggestions(schema);

  return (
    <div className="-mx-3 sm:mx-0 flex flex-col h-[calc(100dvh-3.35rem-1.25rem)] lg:h-[calc(100dvh-5rem)]">
      <div className="glass-panel-strong rounded-none sm:rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10">
        <div className="px-3 sm:px-6 pt-3 sm:pt-5 pb-2 border-b border-white/10 shrink-0">
          <PageHeader
            compact
            gradient
            eyebrow="Analytics"
            title="Data Analyst"
            subtitle={
              <span className="hidden sm:inline">
                Ask questions about your data — every number computed by the engine
              </span>
            }
            action={
              <div className="flex items-center gap-1.5 sm:gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {savedReports.length > 1 && (
                  <select
                    className="select-dark text-[11px] sm:text-xs max-w-[7.5rem] sm:max-w-[140px]"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) loadSavedReport(e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Past reports</option>
                    {savedReports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                )}
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={loadingFile}>
                  <Upload size={15} />
                  <span className="hidden sm:inline ml-1">{loadingFile ? "Loading…" : "Upload"}</span>
                </Button>
              </div>
            }
          />
        </div>

        <div className="shrink-0 border-b border-white/5">
          {!metaExpanded && (
            <button
              type="button"
              onClick={() => setMetaExpanded(true)}
              className="lg:hidden w-full px-3 py-2 flex items-center justify-between text-left text-xs text-ink-secondary hover:bg-white/5"
            >
              <span className="truncate">
                {schema.fileName} · {schema.rowCount.toLocaleString()} rows
              </span>
              <ChevronDown size={14} className="shrink-0 text-ink-muted" />
            </button>
          )}
          <div
            className={`px-3 sm:px-6 pt-2 pb-2 space-y-2 ${
              metaExpanded ? "block" : "hidden lg:block"
            }`}
          >
            <SavedReportsPanel
              reports={savedReports}
              activeId={activeReportId}
              loading={loadingFile}
              deletingId={deletingReportId}
              onOpen={loadSavedReport}
              onDelete={removeReport}
              compact
              collapsible
              defaultCollapsed={hasResults}
            />
            <DataPreview schema={schema} />
            {metaExpanded && (
              <button
                type="button"
                onClick={() => setMetaExpanded(false)}
                className="lg:hidden w-full py-1.5 text-[11px] text-ink-muted hover:text-ink"
              >
                Hide data source
              </button>
            )}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-3 space-y-3 sm:space-y-4 min-h-0 overscroll-contain pb-4"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 sm:gap-3 w-full ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-800 flex items-center justify-center shrink-0 mt-1 shadow-glow">
                  <Bot size={14} className="text-white sm:hidden" />
                  <Bot size={16} className="text-white hidden sm:block" />
                </div>
              )}
              <div
                className={
                  msg.role === "user"
                    ? "btn-futuristic text-white rounded-2xl rounded-br-md px-3.5 sm:px-4 py-2 sm:py-2.5 max-w-[88%] sm:max-w-xl text-sm"
                    : "glass-panel rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3 flex-1 min-w-0 w-full max-w-none text-sm"
                }
              >
                <p className="whitespace-pre-wrap text-[13px] sm:text-sm leading-relaxed">{msg.content}</p>

                {msg.error && (
                  <p className="mt-2 text-xs text-rose-300 flex items-start gap-1.5">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {msg.error}
                  </p>
                )}

                {msg.forecastData && <ForecastChart data={msg.forecastData} />}
                {msg.plan && msg.result && !msg.forecastData && <ResultChart plan={msg.plan} result={msg.result} />}

                {msg.result && (
                  <div className="mt-3">
                    <ResultTable result={msg.result} title={msg.plan?.title} />
                  </div>
                )}

                {msg.plan?.sql && (
                  <details className="mt-2.5">
                    <summary className="text-[11px] text-ink-muted cursor-pointer inline-flex items-center gap-1 hover:text-ink">
                      <Code2 size={11} /> View SQL
                    </summary>
                    <pre className="mt-1.5 text-[10px] sm:text-[11px] bg-black/25 rounded-lg p-2.5 overflow-x-auto text-ink-secondary whitespace-pre-wrap ring-1 ring-white/5">
                      {msg.plan.sql}
                    </pre>
                  </details>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 mt-1 ring-1 ring-white/20">
                  <User size={14} className="text-white sm:hidden" />
                  <User size={16} className="text-white hidden sm:block" />
                </div>
              )}
            </div>
          ))}

          {analyzing && (
            <div className="flex gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-800 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-white" />
              </div>
              <div className="glass-panel rounded-2xl rounded-bl-md px-4 py-3">
                <p className="text-sm text-ink-muted flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-cyan-300" /> Analyzing your data…
                </p>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-1 shrink-0" aria-hidden />
        </div>

        {messages.length <= 1 && (
          <div className="flex gap-2 px-3 sm:px-6 py-2 shrink-0 overflow-x-auto scrollbar-none">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl glass-panel text-xs text-ink-secondary hover:bg-white/12 hover:text-ink ring-1 ring-white/10 transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Sparkles size={11} className="text-cyan-300" /> {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex gap-2 p-3 sm:p-4 border-t border-white/10 shrink-0 bg-black/20 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Ask anything — e.g. "Top 10 stores by sales"'
            className="flex-1 min-w-0 px-3.5 sm:px-4 py-2.5 rounded-2xl border border-white/25 bg-white/10 text-sm text-ink placeholder:text-ink-muted backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/40"
            disabled={analyzing}
          />
          <Button type="submit" disabled={analyzing || !input.trim()} className="shrink-0">
            <Send size={15} /> <span className="hidden sm:inline">Ask</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
