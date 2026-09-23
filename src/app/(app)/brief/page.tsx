"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductLightbox } from "@/components/reports/ProductImagePreview";
import {
  briefSameDatesLastYear,
  buildBriefEdition,
  designLines,
  formatSignedPct,
  storeLines,
  type BriefEdition,
  type BriefLine,
  type BriefModel,
  type BriefPay,
  type BriefRank,
  type BriefSection,
  type BriefStoreHouse,
  type BriefStory,
} from "@/lib/brief/edition";
import { formatCurrency, formatPieceCount, cn } from "@/lib/utils";
import { useApp } from "@/lib/store/app-context";
import "./brief.css";

type SalesPayload = {
  summary?: {
    totalRevenue?: number;
    totalTransactions?: number;
    topProducts?: BriefModel[];
    topStores?: BriefRank[];
    topVendors?: BriefRank[];
    topDepartments?: BriefRank[];
    topDesigns?: BriefRank[];
    topSalesPeople?: Array<BriefRank & { units?: number }>;
    paymentMethods?: BriefPay[];
  };
  error?: string;
};

/** One issue: September 1–21, 2026 against the same dates in 2025. */
const ISSUE = { from: "2026-09-01", to: "2026-09-21" };
const ISSUE_LY = briefSameDatesLastYear(ISSUE.from, ISSUE.to) ?? { from: "2025-09-01", to: "2025-09-21" };

function formatEditionDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatSpan(from: string, to: string): string {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (from === to) return formatEditionDate(from);
  if (sameMonth) {
    return `${a.toLocaleDateString("en-US", { month: "long", day: "numeric" })}–${b.getDate()}`;
  }
  return `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${b.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

async function loadSlice(from: string, to: string, department?: string): Promise<SalesPayload> {
  const params = new URLSearchParams({ from, to });
  if (department) params.set("department", department);
  const res = await fetch(`/api/sales?${params}`);
  const json = (await res.json()) as SalesPayload;
  if (!res.ok) throw new Error(json.error || "Could not load the edition");
  return json;
}

function asRanks(rows: BriefRank[] | undefined): BriefRank[] {
  return (rows ?? []).map((r) => ({ name: r.name, revenue: r.revenue, units: r.units }));
}

export default function BriefPage() {
  const router = useRouter();
  const { state } = useApp();
  const isAdmin = state?.user?.authRole === "admin";
  const [edition, setEdition] = useState<BriefEdition | null>(null);
  const [sectionId, setSectionId] = useState<BriefSection["id"]>("departments");
  const [storyId, setStoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; alt: string; subtitle?: string } | null>(null);
  const [linesByDept, setLinesByDept] = useState<Record<string, BriefLine[]>>({});
  const [linesFailed, setLinesFailed] = useState<Record<string, string>>({});
  const [linesError, setLinesError] = useState<string | null>(null);
  const [linesLoading, setLinesLoading] = useState<string | null>(null);
  const [lineYear, setLineYear] = useState<"now" | "ly">("now");
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [storeNow, setStoreNow] = useState<BriefRank[]>([]);
  const [storeLy, setStoreLy] = useState<BriefRank[]>([]);

  const range = ISSUE;

  useEffect(() => {
    if (state && !isAdmin) router.replace("/sales");
  }, [state, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([loadSlice(ISSUE.from, ISSUE.to), loadSlice(ISSUE_LY.from, ISSUE_LY.to)])
      .then(([now, prior]) => {
        if (ac.signal.aborted) return;
        const summary = now.summary;
        const lySummary = prior.summary;
        const models = summary?.topProducts ?? [];
        const showKash = models.some((m) => m.kashCost != null && Number(m.kashCost) > 0);
        const next = buildBriefEdition({
          from: ISSUE.from,
          to: ISSUE.to,
          compareFrom: ISSUE_LY.from,
          compareTo: ISSUE_LY.to,
          net: summary?.totalRevenue ?? 0,
          lyNet: lySummary?.totalRevenue ?? 0,
          units: summary?.totalTransactions ?? 0,
          models,
          lyModels: lySummary?.topProducts ?? [],
          stores: asRanks(summary?.topStores),
          lyStores: asRanks(lySummary?.topStores),
          vendors: summary?.topVendors ?? [],
          lyVendors: lySummary?.topVendors ?? [],
          departments: asRanks(summary?.topDepartments),
          lyDepartments: asRanks(lySummary?.topDepartments),
          designs: asRanks(summary?.topDesigns),
          lyDesigns: asRanks(lySummary?.topDesigns),
          people: summary?.topSalesPeople ?? [],
          lyPeople: lySummary?.topSalesPeople ?? [],
          pay: summary?.paymentMethods ?? [],
          lyPay: lySummary?.paymentMethods ?? [],
          showKash,
        });
        setEdition(next);
        setStoreNow(asRanks(summary?.topStores));
        setStoreLy(asRanks(lySummary?.topStores));
        setStoryId(null);
        setOpenLine(null);
        setLinesByDept({});
        setLinesFailed({});
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load the edition");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [isAdmin]);

  const section = edition?.sections.find((s) => s.id === sectionId) ?? edition?.sections[0];
  const story = section?.stories.find((s) => s.id === storyId) ?? section?.stories[0] ?? null;
  const departmentTitle = section?.id === "departments" ? story?.title ?? null : null;
  const departmentLines = departmentTitle ? linesByDept[departmentTitle] : undefined;
  const houseId =
    story?.id === "house:AJ" ? "aj" : story?.id === "house:Shaun" ? "shaun" : story?.id === "house:New" ? "new" : null;
  const houseLines = houseId ? storeLines(storeNow, storeLy, houseId as BriefStoreHouse) : undefined;
  const articleLines = houseLines ?? departmentLines;
  const linesLabel = houseId ? "Stores inside" : "Designs inside";
  const linesEmpty = houseId ? "No selling stores in this house." : "No named designs in this department.";
  const linesLoadingLabel = houseId ? "Opening stores…" : "Opening designs…";

  useEffect(() => {
    if (!isAdmin || !departmentTitle || linesByDept[departmentTitle] || linesFailed[departmentTitle]) return;
    let cancelled = false;
    setLinesLoading(departmentTitle);
    setLinesError(null);
    Promise.all([
      loadSlice(ISSUE.from, ISSUE.to, departmentTitle),
      loadSlice(ISSUE_LY.from, ISSUE_LY.to, departmentTitle),
    ])
      .then(([now, prior]) => {
        if (cancelled) return;
        setLinesByDept((prev) => ({
          ...prev,
          [departmentTitle]: designLines(asRanks(now.summary?.topDesigns), asRanks(prior.summary?.topDesigns)),
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not load designs";
        setLinesError(message);
        setLinesFailed((prev) => ({ ...prev, [departmentTitle]: message }));
      })
      .finally(() => {
        if (!cancelled) setLinesLoading((current) => (current === departmentTitle ? null : current));
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, departmentTitle, linesByDept, linesFailed]);

  if (!isAdmin) return null;

  return (
    <div className="brief-root -mx-3 -my-4 px-4 py-8 sm:-mx-5 sm:px-8 lg:-mx-6 lg:-my-6 lg:px-10 lg:py-10">
      <header className="mx-auto max-w-5xl">
        <div className="flex items-end justify-between gap-6">
          <p className="brief-kicker text-[var(--muted)]">Valliani Athena</p>
          <p className="brief-kicker text-[var(--muted)]">{formatEditionDate(range.to)}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-y border-[var(--ink)] py-3">
          <h1 className="text-[2.6rem] leading-none tracking-[-0.03em] sm:text-5xl">
            The Edition
          </h1>
          <p className="max-w-[14rem] text-right text-[15px] italic leading-snug text-[var(--muted)]">
            A morning brief for the floor
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="brief-sans text-[13px] text-[var(--ink)]">September 1–21</p>
          <p className="brief-sans text-[12px] tracking-wide text-[var(--muted)]">
            {formatSpan(range.from, range.to)}
            {edition?.lyFrom && edition.lyTo ? `  ·  compared with ${formatSpan(edition.lyFrom, edition.lyTo)}, ${edition.lyFrom.slice(0, 4)}` : ""}
          </p>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-5xl">
        {loading && !edition ? (
          <p className="py-24 text-center text-lg italic text-[var(--muted)]">Setting the edition…</p>
        ) : error && !edition ? (
          <p className="py-24 text-center text-[var(--oxblood)]">{error}</p>
        ) : edition && section ? (
          <>
            <section className="border-b border-[var(--rule)] pb-6">
              <h2 className="max-w-3xl text-[1.7rem] leading-[1.15] tracking-[-0.02em] sm:text-[2.15rem]">
                {edition.headline}
              </h2>
              <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-[var(--muted)]">{edition.deck}</p>
              <dl className="brief-sans mt-6 grid grid-cols-3 gap-4 border-t border-[var(--rule)] pt-4 text-[13px]">
                <div>
                  <dt className="brief-kicker text-[var(--muted)]">Net</dt>
                  <dd className="mt-1 text-xl text-[var(--ink)]">{formatCurrency(edition.net)}</dd>
                </div>
                <div>
                  <dt className="brief-kicker text-[var(--muted)]">Vs last year</dt>
                  <dd className={cn("mt-1 text-xl", edition.delta != null && edition.delta >= 5 && "text-[var(--pine)]", edition.delta != null && edition.delta <= -5 && "text-[var(--oxblood)]")}>
                    {edition.delta == null ? "—" : formatSignedPct(edition.delta)}
                  </dd>
                </div>
                <div>
                  <dt className="brief-kicker text-[var(--muted)]">Units</dt>
                  <dd className="mt-1 text-xl">{formatPieceCount(edition.units)}</dd>
                </div>
              </dl>
            </section>

            <nav className="brief-sans mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--rule)]">
              {edition.sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSectionId(s.id);
                    setStoryId(null);
                    setOpenLine(null);
                  }}
                  className={cn(
                    "pb-2 text-[13px] tracking-wide",
                    section.id === s.id
                      ? "border-b-2 border-[var(--ink)] text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            {section.stories.length === 0 ? (
              <p className="py-16 text-center italic text-[var(--muted)]">Nothing sold in this window.</p>
            ) : (
              <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)] lg:gap-14">
                {story ? (
                  <Article
                    story={story}
                    lines={articleLines}
                    linesLabel={linesLabel}
                    linesEmpty={linesEmpty}
                    linesLoadingLabel={linesLoadingLabel}
                    linesLoading={!houseId && linesLoading === departmentTitle}
                    linesError={!houseId && departmentTitle ? linesError : null}
                    showAllLink={!houseId && Boolean(departmentTitle)}
                    lineYear={lineYear}
                    openLine={openLine}
                    onYear={(year) => setLineYear(year)}
                    onToggleLine={(id) => setOpenLine((current) => (current === id ? null : id))}
                    onOpenDesigns={() => {
                      setSectionId("designs");
                      setStoryId(null);
                      setOpenLine(null);
                    }}
                    onOpen={setPreview}
                  />
                ) : null}
                <ol className="lg:border-l lg:border-[var(--rule)] lg:pl-8">
                  {section.stories.map((s, i) => {
                    const active = story?.id === s.id;
                    return (
                      <li key={s.id} className="border-b border-[var(--rule)] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => {
                            setStoryId(s.id);
                            setOpenLine(null);
                          }}
                          className={cn(
                            "flex w-full items-baseline gap-3 py-3 text-left",
                            active ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                          )}
                        >
                          <span className="brief-sans w-6 shrink-0 text-[11px] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                          <span className={cn("min-w-0 flex-1 text-[17px] leading-snug", active && "underline decoration-[var(--oxblood)] decoration-1 underline-offset-4")}>
                            {s.title}
                          </span>
                          <span className={cn("brief-sans shrink-0 text-[12px] tabular-nums", s.tone === "up" && "text-[var(--pine)]", s.tone === "down" && "text-[var(--oxblood)]")}>
                            {s.figure}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            {loading ? <p className="brief-sans mt-8 text-[12px] text-[var(--muted)]">Updating the edition…</p> : null}
          </>
        ) : null}
      </main>
      {preview ? (
        <ProductLightbox src={preview.src} alt={preview.alt} subtitle={preview.subtitle} onClose={() => setPreview(null)} />
      ) : null}
    </div>
  );
}

function Article({
  story,
  lines,
  linesLabel,
  linesEmpty,
  linesLoadingLabel,
  linesLoading,
  linesError,
  showAllLink,
  lineYear,
  openLine,
  onYear,
  onToggleLine,
  onOpenDesigns,
  onOpen,
}: {
  story: BriefStory;
  lines?: BriefLine[];
  linesLabel: string;
  linesEmpty: string;
  linesLoadingLabel: string;
  linesLoading?: boolean;
  linesError?: string | null;
  showAllLink?: boolean;
  lineYear: "now" | "ly";
  openLine: string | null;
  onYear: (year: "now" | "ly") => void;
  onToggleLine: (id: string) => void;
  onOpenDesigns: () => void;
  onOpen: (preview: { src: string; alt: string; subtitle?: string }) => void;
}) {
  return (
    <article>
      <p className="brief-kicker text-[var(--oxblood)]">{story.kicker}</p>
      <h3 className="mt-2 text-[2rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.6rem]">{story.title}</h3>
      {story.imageUrl ? (
        <button
          type="button"
          onClick={() => onOpen({ src: story.imageUrl!, alt: story.title, subtitle: story.kicker })}
          className="mt-5 block w-full max-w-sm overflow-hidden border border-[var(--rule)] bg-[var(--paper-2)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={story.imageUrl} alt="" className="aspect-[4/3] w-full object-cover" />
        </button>
      ) : null}
      <p className="mt-5 max-w-xl text-[18px] leading-[1.55] text-[var(--ink)]">{story.deck}</p>
      <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-4 border-t border-[var(--rule)] pt-4">
        {story.facts.map((f) => (
          <div key={f.label} className="min-w-[5.5rem]">
            <dt className="brief-kicker text-[var(--muted)]">{f.label}</dt>
            <dd className="mt-1 text-[15px]">{f.value}</dd>
          </div>
        ))}
      </dl>
      {lines || linesLoading || linesError ? (
        <div className="mt-8 border-t border-[var(--rule)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="brief-kicker text-[var(--muted)]">{linesLabel}</p>
            <div className="brief-sans flex gap-3 text-[12px]">
              <button
                type="button"
                onClick={() => onYear("now")}
                className={cn(lineYear === "now" ? "text-[var(--ink)] underline decoration-[var(--oxblood)] underline-offset-4" : "text-[var(--muted)]")}
              >
                This year
              </button>
              <button
                type="button"
                onClick={() => onYear("ly")}
                className={cn(lineYear === "ly" ? "text-[var(--ink)] underline decoration-[var(--oxblood)] underline-offset-4" : "text-[var(--muted)]")}
              >
                Last year
              </button>
            </div>
          </div>
          {linesLoading && !lines ? <p className="brief-sans mt-4 text-[13px] text-[var(--muted)]">{linesLoadingLabel}</p> : null}
          {linesError && !lines ? <p className="brief-sans mt-4 text-[13px] text-[var(--oxblood)]">{linesError}</p> : null}
          {lines && lines.length === 0 ? <p className="mt-4 italic text-[var(--muted)]">{linesEmpty}</p> : null}
          {lines && lines.length > 0 ? (
            <ol className="mt-2">
              {lines.map((line) => {
                const open = openLine === line.id;
                const amount = lineYear === "ly" ? line.lyRevenue : line.revenue;
                return (
                  <li key={line.id} className="border-b border-[var(--rule)]">
                    <button
                      type="button"
                      onClick={() => onToggleLine(line.id)}
                      className="flex w-full items-baseline gap-3 py-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1 text-[16px] leading-snug">{line.name}</span>
                      <span className={cn("brief-sans shrink-0 text-[12px] tabular-nums", line.tone === "up" && "text-[var(--pine)]", line.tone === "down" && "text-[var(--oxblood)]")}>
                        {formatSignedPct(line.delta)}
                      </span>
                      <span className="brief-sans w-24 shrink-0 text-right text-[13px] tabular-nums">
                        {amount == null ? "—" : formatCurrency(amount)}
                      </span>
                    </button>
                    {open ? (
                      <dl className="brief-sans mb-3 grid grid-cols-2 gap-3 text-[12px] text-[var(--muted)] sm:grid-cols-4">
                        <div>
                          <dt className="brief-kicker">This year</dt>
                          <dd className="mt-1 text-[var(--ink)]">{formatCurrency(line.revenue)}</dd>
                        </div>
                        <div>
                          <dt className="brief-kicker">Last year</dt>
                          <dd className="mt-1 text-[var(--ink)]">{line.lyRevenue == null ? "—" : formatCurrency(line.lyRevenue)}</dd>
                        </div>
                        <div>
                          <dt className="brief-kicker">Units</dt>
                          <dd className="mt-1 text-[var(--ink)]">{formatPieceCount(lineYear === "ly" ? line.lyUnits ?? 0 : line.units)}</dd>
                        </div>
                        <div>
                          <dt className="brief-kicker">Vs last year</dt>
                          <dd className="mt-1 text-[var(--ink)]">{formatSignedPct(line.delta)}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {showAllLink ? (
            <button type="button" onClick={onOpenDesigns} className="brief-sans mt-3 text-[12px] text-[var(--muted)] underline decoration-[var(--rule)] underline-offset-4 hover:text-[var(--ink)]">
              All designs
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
