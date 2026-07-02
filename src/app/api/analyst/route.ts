import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { AnalystPlan, SchemaForLLM } from "@/lib/analyst/types";
import { OPENAI_ANALYST_MODEL } from "@/lib/openai/config";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert data analyst that translates business questions into DuckDB SQL.

The data lives in a single DuckDB table named "data". You will be given its schema (column names, types, sample values) and the user's question.

Respond ONLY with a JSON object with these exact fields:
{
  "taskType": "query" | "forecast",
  "sql": "<one DuckDB SELECT statement>",
  "chartType": "bar" | "line" | "area" | "pie" | "none",
  "xKey": "<result column for the x-axis / labels, or null>",
  "yKeys": ["<numeric result column(s) to plot>"],
  "title": "<short title for the result>",
  "explanation": "<one or two sentences explaining what the query computes>",
  "forecastPeriods": <number of future periods to forecast, or null>
}

STRICT RULES — accuracy is critical, business decisions depend on it:
1. Output exactly ONE SELECT (or WITH ... SELECT) statement. Never modify data. No semicolons.
2. Use ONLY columns that exist in the schema. Quote every column name with double quotes exactly as given (e.g. "Unit Price").
3. The table name is always: data
4. For "top N" / "best selling" use ORDER BY <metric> DESC LIMIT N. For "lowest/worst" use ASC. If the user asks for a specific count (e.g. top 100), use exactly that LIMIT.
5. "Selling" metrics: prefer a revenue/amount column if one exists, otherwise quantity/units. State which metric you used in "explanation".
6. Aggregate with SUM/COUNT/AVG/MIN/MAX as appropriate and GROUP BY the dimension columns. Give aggregates clear aliases (e.g. SUM("Revenue") AS total_revenue).
7. Dates: if a date-like column is stored as text, convert with try_cast(... AS DATE) or strptime. For monthly grouping use strftime(<date>, '%Y-%m') AS period. For daily use strftime(<date>, '%Y-%m-%d'). Always GROUP BY and ORDER BY the period ascending.
8. Text filters should be robust: use case-insensitive matching, e.g. lower("Category") LIKE '%ring%'.
9. FORECASTING: if the user asks to forecast/predict/project future values, set taskType="forecast". The SQL must return exactly two columns: the period (formatted as in rule 7) and the aggregated numeric value, ordered by period ascending, covering ALL available history. Set forecastPeriods to the number of future periods requested (default 6). Set chartType="line".
10. Chart choice: bar for rankings/comparisons, line/area for trends over time, pie for share-of-total with <= 10 groups, none for single values or wide detail tables. xKey/yKeys must be aliases that appear in the SQL result.
11. If the question cannot be answered from the schema, still return JSON, with sql set to "" and explanation describing what is missing.
12. Round currency averages with ROUND(..., 2). Never round SUMs of integers.
13. The loader already auto-converts currency-formatted text (e.g. "3,600.00", "$799") to numeric columns and m/d/Y text dates to DATE columns, so trust the "kind" field in the schema. If a column that should be numeric still has kind "text" (mixed content), clean it inline and NEVER drop rows silently: TRY_CAST(REPLACE(REPLACE(TRIM("Col"), '$', ''), ',', '') AS DOUBLE). Negative values (returns/refunds) are real business data — always include them in totals unless the user explicitly excludes them.
14. CATEGORY FILTERS — when a text column in the schema includes "allValues" (its complete distinct value list), you MUST filter by picking the matching value(s) from that list with = or IN (e.g. "Department" IN ('GOLD RINGS', 'GOLD BANDS')), NOT with LIKE. Choose every value that matches the user's intent. Only fall back to LIKE when no "allValues" list exists, and then guard against false substring matches: '%ring%' also matches EARRINGS, so add e.g. AND lower("Department") NOT LIKE '%earring%'.
15. RANKING METRIC — rank by exactly the metric the user names: "most times"/"most often"/"how many times" means COUNT(*) of sale rows; "units"/"quantity"/"units sold" means SUM of the quantity column; "revenue"/"sales value" means SUM of the amount column. Always include the ranking metric as a visible result column. If the user says "top/best/most selling" without naming a metric, use revenue and say so in "explanation".
16. VALLIANI VENDOR POS (MHVR-style) — when columns include "Department", "Design", "Store", "Total", "Sales Amount", "Disc Amt", "Qty", "Transaction Date", "Vendor #": use "Total" as net revenue (primary), "Sales Amount" as gross, "Disc Amt" for discounts, "Qty" for units, "Department" for category, "Design" for brand line (NOVELLO, LINKNLOCK, LOVE, etc.), "Store" for location (VJ-NORTH, etc.). Rank by SUM("Total") unless user asks for gross or units.
17. STORE SALES REPORT (SALES-LATEST) — when columns include "Transaction #", "Transaction Date", "SKU #", "Style #", "Description", "Vendor Name", "Store", "Department", "Design", "Class", "Sub-Class", "Qty", "Inventory Cost", "Sales Amount", "Disc Amt", "Total": use "Total" as net revenue, "Sales Amount" as gross, "Disc Amt" for discounts, "Inventory Cost" for cost, margin = SUM("Total") - SUM("Inventory Cost"). "SKU #" identifies products; "Vendor Name" is the supplier; "Class" is metal type (14KT, 10KT, etc.); "Sub-Class" is style detail. Group by "Store", "Department", "Design", "Vendor Name", "Class", or "Transaction Date" as appropriate. Count distinct "Transaction #" for transaction counts.
18. FINANCING REPORT — when columns include "Pay Method", "Pay Code", "Transaction Date", "Store", "Net Amt", "Profit", "Sales Person", "Type": filter sales with lower(trim("Type")) LIKE '%sales%' unless user asks for all transaction types. Use "Net Amt" as primary revenue; fallback "Total" or "Payment Amt". "Pay Method": CA=Cash, CC=Credit Card, OTH=Financing. "Pay Code" identifies program (ACIMA, SYNY/Synchrony, IDDEAL/IDEA, KAFE/Kafene, WELLS, etc.). Use SUM("Profit") for profit questions. Group by "Store", "Pay Method", "Pay Code", or "Sales Person" as appropriate.`;

interface AnalystRequest {
  question: string;
  schema: SchemaForLLM;
  history?: { role: "user" | "assistant"; content: string }[];
  failedSql?: string;
  errorMessage?: string;
}

function validatePlan(raw: unknown): AnalystPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.sql !== "string") return null;
  const chartTypes = ["bar", "line", "area", "pie", "none"];
  return {
    taskType: o.taskType === "forecast" ? "forecast" : "query",
    sql: o.sql.trim().replace(/;+\s*$/, ""),
    chartType: chartTypes.includes(o.chartType as string)
      ? (o.chartType as AnalystPlan["chartType"])
      : "none",
    xKey: typeof o.xKey === "string" && o.xKey ? o.xKey : null,
    yKeys: Array.isArray(o.yKeys) ? o.yKeys.filter((k): k is string => typeof k === "string") : [],
    title: typeof o.title === "string" ? o.title : "Analysis result",
    explanation: typeof o.explanation === "string" ? o.explanation : "",
    forecastPeriods:
      typeof o.forecastPeriods === "number" && o.forecastPeriods > 0
        ? Math.min(Math.round(o.forecastPeriods), 36)
        : null,
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  let body: AnalystRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.question?.trim() || !body.schema?.columns?.length) {
    return NextResponse.json({ error: "question and schema are required" }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Table "data" schema (${body.schema.rowCount} rows):\n${JSON.stringify(
        body.schema.columns,
        null,
        2
      )}`,
    },
  ];

  for (const h of body.history?.slice(-6) ?? []) {
    messages.push({ role: h.role, content: h.content });
  }

  if (body.failedSql && body.errorMessage) {
    messages.push({
      role: "user",
      content: `Question: ${body.question}\n\nYour previous SQL failed:\n${body.failedSql}\n\nDuckDB error:\n${body.errorMessage}\n\nFix the SQL and respond with the corrected JSON.`,
    });
  } else {
    messages.push({ role: "user", content: `Question: ${body.question}` });
  }

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_ANALYST_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Empty response from the AI model" }, { status: 502 });
    }

    const plan = validatePlan(JSON.parse(content));
    if (!plan) {
      return NextResponse.json({ error: "The AI returned an invalid analysis plan" }, { status: 502 });
    }
    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI request failed: ${message}` }, { status: 502 });
  }
}
