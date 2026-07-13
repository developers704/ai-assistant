import { listTraces, getTrace } from "@/lib/alexa/trace-store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AiTracesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; id?: string }>;
}) {
  const params = await searchParams;
  const expected = process.env.ALEXA_ADMIN_TRACE_TOKEN;
  const allowed =
    process.env.NODE_ENV === "development" ||
    (!!expected && params.token === expected);

  if (!allowed) {
    redirect("/chat");
  }

  const selected = params.id ? getTrace(params.id) : undefined;
  const rows = listTraces(100);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4 text-ink">
      <h1 className="text-2xl font-semibold">Alexa AI Traces</h1>
      <p className="text-sm text-ink-secondary">
        Admin-only debug view. Enable with ALEXA_TRACE_LOGGING=true. Protect with
        ALEXA_ADMIN_TRACE_TOKEN.
      </p>
      <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted border-b border-white/10">
              <th className="p-2">Trace</th>
              <th className="p-2">Channel</th>
              <th className="p-2">Input</th>
              <th className="p-2">Tool</th>
              <th className="p-2">Status</th>
              <th className="p-2">ms</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.traceId} className="border-b border-white/5">
                <td className="p-2 font-mono text-xs">
                  <a
                    className="underline"
                    href={`?id=${t.traceId}${params.token ? `&token=${params.token}` : ""}`}
                  >
                    {t.traceId.slice(0, 8)}
                  </a>
                </td>
                <td className="p-2">{t.channel}</td>
                <td className="p-2 max-w-xs truncate">{t.normalizedInput}</td>
                <td className="p-2">{t.selectedTool ?? "—"}</td>
                <td className="p-2">{t.toolStatus ?? "—"}</td>
                <td className="p-2">{t.toolDurationMs ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <pre className="text-xs whitespace-pre-wrap rounded-xl bg-black/30 p-4 ring-1 ring-white/10 overflow-auto max-h-[480px]">
          {JSON.stringify(selected, null, 2)}
        </pre>
      )}
    </div>
  );
}
