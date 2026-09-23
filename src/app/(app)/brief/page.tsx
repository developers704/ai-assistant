"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductLightbox } from "@/components/reports/ProductImagePreview";
import {
  briefPriorYear,
  briefWindowRange,
  buildBriefEdition,
  formatSignedPct,
  type BriefEdition,
  type BriefModel,
  type BriefPay,
  type BriefRank,
  type BriefSection,
  type BriefStory,
  type BriefWindow,
} from "@/lib/brief/edition";
import { formatCurrency, formatPieceCount, cn } from "@/lib/utils";
import "./brief.css";

type SalesPayload = {
  summary?: {
    totalRevenue?: number;
    totalTransactions?: number;
    topProducts?: BriefModel[];
    topStores?: BriefRank[];
    topVendors?: BriefRank[];
    topSalesPeople?: Array<BriefRank & { units?: number }>;
    paymentMethods?: BriefPay[];
  };
  dataThrough?: string | null;
  error?: string;
};

const WINDOWS: { id: BriefWindow; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "season", label: "Season" },
];

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

async function loadSlice(from: string, to: string): Promise<SalesPayload> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/sales?${params}`);
  const json = (await res.json()) as SalesPayload;
  if (!res.ok) throw new Error(json.error || "Could not load the edition");
  return json;
}

export default function BriefPage() {
  const [dataThrough, setDataThrough] = useState("2026-09-21");
  const [windowId, setWindowId] = useState<BriefWindow>("week");
  const [edition, setEdition] = useState<BriefEdition | null>(null);
  const [sectionId, setSectionId] = useState<BriefSection["id"]>("models");
  const [storyId, setStoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; alt: string; subtitle?: string } | null>(null);

  const range = useMemo(() => briefWindowRange(windowId, dataThrough), [windowId, dataThrough]);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    const ly = briefPriorYear(range.from, range.to);
    Promise.all([
      loadSlice(range.from, range.to),
      ly ? loadSlice(ly.from, ly.to) : Promise.resolve(null),
    ])
      .then(([now, prior]) => {
        if (ac.signal.aborted) return;
        if (now.dataThrough && now.dataThrough < dataThrough) {
          setDataThrough(now.dataThrough);
        }
        const summary = now.summary;
        const lySummary = prior?.summary;
        const models = summary?.topProducts ?? [];
        const showKash = models.some((m) => m.kashCost != null && Number(m.kashCost) > 0);
        const next = buildBriefEdition({
          from: range.from,
          to: range.to,
          net: summary?.totalRevenue ?? 0,
          lyNet: lySummary?.totalRevenue ?? 0,
          units: summary?.totalTransactions ?? 0,
          models,
          lyModels: lySummary?.topProducts ?? [],
          stores: summary?.topStores ?? [],
          lyStores: lySummary?.topStores ?? [],
          vendors: summary?.topVendors ?? [],
          lyVendors: lySummary?.topVendors ?? [],
          people: summary?.topSalesPeople ?? [],
          lyPeople: lySummary?.topSalesPeople ?? [],
          pay: summary?.paymentMethods ?? [],
          lyPay: lySummary?.paymentMethods ?? [],
          showKash,
        });
        setEdition(next);
        setStoryId(null);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load the edition");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [range.from, range.to, dataThrough]);

  const section = edition?.sections.find((s) => s.id === sectionId) ?? edition?.sections[0];
  const story = section?.stories.find((s) => s.id === storyId) ?? section?.stories[0] ?? null;

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
          <div className="brief-sans flex items-center gap-1 text-[13px]">
            {WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setWindowId(w.id);
                  setSectionId("models");
                  setStoryId(null);
                }}
                className={cn(
                  "px-2 py-1",
                  windowId === w.id ? "text-[var(--ink)] underline decoration-[var(--oxblood)] decoration-2 underline-offset-[6px]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <p className="brief-sans text-[12px] tracking-wide text-[var(--muted)]">
            {formatSpan(range.from, range.to)}
            {edition?.lyFrom && edition.lyTo ? `  ·  compared with ${formatSpan(edition.lyFrom, edition.lyTo)}` : ""}
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
                {story ? <Article story={story} onOpen={setPreview} /> : null}
                <ol className="lg:border-l lg:border-[var(--rule)] lg:pl-8">
                  {section.stories.map((s, i) => {
                    const active = story?.id === s.id;
                    return (
                      <li key={s.id} className="border-b border-[var(--rule)] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setStoryId(s.id)}
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
  onOpen,
}: {
  story: BriefStory;
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
    </article>
  );
}
