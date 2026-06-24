"use client";

import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { PageHeader } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { DataPreview } from "@/components/analyst/DataPreview";
import { ResultTable } from "@/components/analyst/ResultTable";
import { ResultChart, ForecastChart } from "@/components/analyst/ResultChart";
import { loadCSV, runQuery, validateReadOnlySQL } from "@/lib/analyst/duckdb";
import { computeForecast } from "@/lib/analyst/forecast";
import { toSchemaForLLM } from "@/lib/analyst/types";
import type { AnalystMessage, AnalystPlan, QueryResult, TableSchema } from "@/lib/analyst/types";
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
} from "lucide-react";

function buildSuggestions(schema: TableSchema): string[] {
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
    const formatted =
      typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(v);
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
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  const handleFile = async (file: File) => {
    setLoadingFile(true);
    setFileError(null);
    try {
      const s = await loadCSV(file);
      setSchema(s);
      setMessages([
        {
          id: uuidv4(),
          role: "assistant",
          content: `Loaded "${file.name}" — ${s.rowCount.toLocaleString()} rows and ${s.columns.length} columns. Ask me anything about this data: totals, top/low sellers, trends, breakdowns, or forecasts. Every number is computed directly from your file.`,
        },
      ]);
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

    const result = await runQuery(plan.sql);

    if (plan.taskType === "forecast") {
      const forecastData = computeForecast(result, plan.forecastPeriods ?? 6);
      return {
        id: uuidv4(),
        role: "assistant",
        content: `${plan.title} — forecast for the next ${plan.forecastPeriods ?? 6} periods, based on ${result.rows.length.toLocaleString()} historical periods. ${plan.explanation}`,
        plan,
        result,
        forecastData,
      };
    }

    return {
      id: uuidv4(),
      role: "assistant",
      content: `${summarizeResult(plan, result)} ${plan.explanation}`,
      plan,
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

  if (!schema) {
    return (
      <div className="flex flex-col h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-4rem)]">
        <div className="glass-panel-strong rounded-3xl flex flex-col flex-1 ring-1 ring-white/10 overflow-hidden">
          <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
            <PageHeader
              title="Data Analyst"
              subtitle="Upload a CSV and ask questions — exact answers, charts, and forecasts"
            />
          </div>

          <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
            <div
              className="w-full max-w-xl rounded-3xl border-2 border-dashed border-cyan-400/30 bg-cyan-500/5 p-10 sm:p-12 text-center cursor-pointer hover:border-cyan-400/50 hover:bg-cyan-500/10 transition-all ring-1 ring-white/5"
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
                    <p className="text-lg font-semibold text-ink">Upload a CSV file</p>
                    <p className="text-sm text-ink-muted mt-1.5 max-w-sm mx-auto">
                      Drag and drop or click to browse — sales data, inventory, anything tabular
                    </p>
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
    );
  }

  const suggestions = buildSuggestions(schema);

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-4rem)]">
      <div className="glass-panel-strong rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-white/10">
        <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-white/10 shrink-0">
          <PageHeader
            title="Data Analyst"
            subtitle="Ask questions about your data — every number computed by the engine"
            action={
              <>
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
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={loadingFile}>
                  <Upload size={15} /> {loadingFile ? "Loading…" : "New CSV"}
                </Button>
              </>
            }
          />
        </div>

        <div className="px-5 sm:px-6 pt-4 pb-2 shrink-0">
          <DataPreview schema={schema} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 space-y-4 min-h-0">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-800 flex items-center justify-center shrink-0 mt-1 shadow-glow">
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div
                className={
                  msg.role === "user"
                    ? "btn-futuristic text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-xl text-sm"
                    : "glass-panel rounded-2xl rounded-bl-md px-4 py-3 flex-1 max-w-4xl text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

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
                      <Code2 size={11} /> View SQL used (computed from {schema.rowCount.toLocaleString()} rows)
                    </summary>
                    <pre className="mt-1.5 text-[11px] bg-black/25 rounded-lg p-2.5 overflow-x-auto text-ink-secondary whitespace-pre-wrap ring-1 ring-white/5">
                      {msg.plan.sql}
                    </pre>
                  </details>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 mt-1 ring-1 ring-white/20">
                  <User size={16} className="text-white" />
                </div>
              )}
            </div>
          ))}

          {analyzing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-800 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-white" />
              </div>
              <div className="glass-panel rounded-2xl rounded-bl-md px-4 py-3">
                <p className="text-sm text-ink-muted flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-cyan-300" /> Analyzing your data…
                </p>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 px-5 sm:px-6 py-2 shrink-0">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl glass-panel text-xs text-ink-secondary hover:bg-white/12 hover:text-ink ring-1 ring-white/10 transition-all disabled:opacity-50"
              >
                <Sparkles size={11} className="text-cyan-300" /> {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex gap-2 p-4 border-t border-white/10 shrink-0 bg-black/10"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Ask anything — e.g. "Top 10 products by revenue"'
            className="flex-1 px-4 py-2.5 rounded-2xl border border-white/25 bg-white/10 text-sm text-ink placeholder:text-ink-muted backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/40"
            disabled={analyzing}
          />
          <Button type="submit" disabled={analyzing || !input.trim()}>
            <Send size={15} /> Ask
          </Button>
        </form>
      </div>
    </div>
  );
}
