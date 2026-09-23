"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductLightbox } from "@/components/reports/ProductImagePreview";
import {
  buildBriefEdition,
  costLines,
  designLines,
  formatSignedPct,
  modelLines,
  payLines,
  storeLines,
  watchLines,
  type BriefEdition,
  type BriefLine,
  type BriefModel,
  type BriefModelStack,
  type BriefPacket,
  type BriefPayGroup,
  type BriefSection,
  type BriefStoreHouse,
  type BriefStory,
  type CostPile,
} from "@/lib/brief/edition";
import { formatCurrency, formatPieceCount, cn } from "@/lib/utils";
import { useApp } from "@/lib/store/app-context";
import "./brief.css";

/** One issue: September 1–21, 2026 against the same dates in 2025. */
const ISSUE = { from: "2026-09-01", to: "2026-09-21" };

function sameName(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

function modelsIn(models: BriefModel[], department: string | null): BriefModel[] {
  if (!department) return models;
  return models.filter((model) => model.department && sameName(model.department, department));
}

function departmentSlice(packet: BriefPacket, name: string) {
  if (packet.byDepartment[name]) return packet.byDepartment[name];
  const key = Object.keys(packet.byDepartment).find((dept) => sameName(dept, name));
  return key ? packet.byDepartment[key] : undefined;
}

function editionFrom(packet: BriefPacket, scope: string | null): BriefEdition {
  const slice = scope ? departmentSlice(packet, scope) : undefined;
  const scoped = Boolean(scope && slice);
  const now = slice?.now ?? packet.now;
  const ly = slice?.ly ?? packet.ly;
  return buildBriefEdition({
    from: packet.from,
    to: packet.to,
    compareFrom: packet.lyFrom,
    compareTo: packet.lyTo,
    net: now.net,
    lyNet: ly.net,
    units: now.units,
    models: modelsIn(packet.models, scoped ? scope : null),
    lyModels: modelsIn(packet.lyModels, scoped ? scope : null),
    stores: now.stores,
    lyStores: ly.stores,
    vendors: now.vendors,
    lyVendors: ly.vendors,
    departments: now.departments,
    lyDepartments: ly.departments,
    designs: now.designs,
    lyDesigns: ly.designs,
    people: now.people,
    lyPeople: ly.people,
    pay: now.pay,
    lyPay: ly.pay,
    showKash: packet.showKash,
    scopeLabel: scoped ? scope : null,
    watches: scoped ? undefined : packet.watches,
    lyWatches: scoped ? undefined : packet.lyWatches,
    expertise: packet.expertise,
    daily: now.daily,
    hotDay: now.hotDay,
  });
}

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

async function loadPacket(): Promise<BriefPacket> {
  const res = await fetch("/api/brief");
  const json = (await res.json()) as BriefPacket & { error?: string };
  if (!res.ok) throw new Error(json.error || "Could not load the edition");
  return json;
}

export default function BriefPage() {
  const router = useRouter();
  const { state } = useApp();
  const isAdmin = state?.user?.authRole === "admin";
  const [packet, setPacket] = useState<BriefPacket | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<BriefSection["id"]>("departments");
  const [storyId, setStoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; alt: string; subtitle?: string } | null>(null);
  const [lineYear, setLineYear] = useState<"now" | "ly">("now");
  const [openLine, setOpenLine] = useState<string | null>(null);

  const range = ISSUE;

  useEffect(() => {
    if (state && !isAdmin) router.replace("/sales");
  }, [state, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    loadPacket()
      .then((next) => {
        if (ac.signal.aborted) return;
        setPacket(next);
        setScope(null);
        setStoryId(null);
        setOpenLine(null);
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

  const company = useMemo(() => (packet ? editionFrom(packet, null) : null), [packet]);
  const scoped = useMemo(() => (packet && scope ? editionFrom(packet, scope) : null), [packet, scope]);
  const edition = useMemo(() => {
    if (!company) return null;
    if (!scope || !scoped) return company;
    const departments = company.sections.find((section) => section.id === "departments");
    if (!departments) return scoped;
    return {
      ...scoped,
      sections: scoped.sections.map((section) => (section.id === "departments" ? departments : section)),
    };
  }, [company, scoped, scope]);

  const section = edition?.sections.find((s) => s.id === sectionId) ?? edition?.sections[0];
  const story = section?.stories.find((s) => s.id === storyId) ?? section?.stories[0] ?? null;
  const activeSlice = (scope && packet ? departmentSlice(packet, scope) : undefined) ?? (packet ? { now: packet.now, ly: packet.ly } : undefined);
  const departmentTitle = section?.id === "departments" ? story?.title ?? null : null;
  const departmentPack = departmentTitle && packet ? departmentSlice(packet, departmentTitle) : undefined;
  const departmentLines = departmentPack ? designLines(departmentPack.now.designs, departmentPack.ly.designs) : undefined;
  const houseId =
    story?.id === "house:AJ" ? "aj" : story?.id === "house:Shaun" ? "shaun" : story?.id === "house:New" ? "new" : null;
  const houseLines =
    houseId && activeSlice ? storeLines(activeSlice.now.stores, activeSlice.ly.stores, houseId as BriefStoreHouse) : undefined;
  const modelNow = packet ? modelsIn(packet.models, scope) : [];
  const modelLy = packet ? modelsIn(packet.lyModels, scope) : [];
  const showKash = packet?.showKash === true;
  const modelStack: BriefModelStack | null =
    story?.id === "model:returning" ? "returning" : story?.id === "model:fresh" ? "fresh" : null;
  const stackLines = modelStack ? modelLines(modelNow, modelLy, modelStack, { showKash }) : undefined;
  const payGroup: BriefPayGroup | null =
    story?.id === "pay:Cash" ? "cash" : story?.id === "pay:Card" ? "card" : story?.id === "pay:Financing" ? "financing" : null;
  const methodLines = payGroup && activeSlice ? payLines(activeSlice.now.pay, activeSlice.ly.pay, payGroup) : undefined;
  const watchOpen = story?.id === "watch:all" && packet && !scope;
  const openedWatchLines = watchOpen ? watchLines(packet.watches, packet.lyWatches) : undefined;
  const costPile: CostPile | null = story?.id === "cost:under" ? "under" : story?.id === "cost:near" ? "near" : null;
  const openedCostLines = costPile ? costLines(modelNow, costPile) : undefined;
  const articleLines = methodLines ?? stackLines ?? houseLines ?? openedWatchLines ?? openedCostLines ?? departmentLines;
  const linesLabel = payGroup
    ? "Methods inside"
    : modelStack || costPile
      ? "Models inside"
      : houseId || watchOpen
        ? "Stores inside"
        : "Designs inside";
  const linesEmpty = payGroup
    ? "No methods in this group."
    : modelStack || costPile
      ? "No jewelry models in this stack."
      : houseId || watchOpen
        ? "No selling stores in this house."
        : "No named designs in this department.";
  const blankDelta = modelStack === "fresh" || Boolean(payGroup) || Boolean(watchOpen) || Boolean(costPile);

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
          <div className="brief-sans flex flex-wrap items-center gap-3 text-[13px]">
            <button
              type="button"
              onClick={() => {
                setScope(null);
                setStoryId(null);
                setOpenLine(null);
                setSectionId("departments");
              }}
              className={cn(
                scope ? "text-[var(--muted)] hover:text-[var(--ink)]" : "text-[var(--ink)] underline decoration-[var(--oxblood)] underline-offset-4"
              )}
            >
              All
            </button>
            {scope ? <span className="text-[var(--ink)]">{scope}</span> : <span className="text-[var(--muted)]">September 1–21</span>}
          </div>
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
                    showAllLink={Boolean(departmentTitle)}
                    blankDelta={blankDelta}
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
                            if (section.id === "departments" && packet && departmentSlice(packet, s.title)) {
                              setScope(s.title);
                              setSectionId("departments");
                            }
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
  showAllLink,
  blankDelta,
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
  showAllLink?: boolean;
  blankDelta?: boolean;
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
      {lines ? (
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
          {lines.length === 0 ? <p className="mt-4 italic text-[var(--muted)]">{linesEmpty}</p> : null}
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
                        {line.delta == null && blankDelta ? "—" : formatSignedPct(line.delta)}
                      </span>
                      <span className="brief-sans w-24 shrink-0 text-right text-[13px] tabular-nums">
                        {amount == null ? "—" : formatCurrency(amount)}
                      </span>
                    </button>
                    {open ? (
                      <>
                      <dl className="brief-sans mb-3 grid grid-cols-2 gap-3 text-[12px] text-[var(--muted)] sm:grid-cols-4">
                        <div>
                          <dt className="brief-kicker">This year</dt>
                          <dd className="mt-1 text-[var(--ink)]">{formatCurrency(line.revenue)}</dd>
                        </div>
                        <div>
                          <dt className="brief-kicker">Last year</dt>
                          <dd className="mt-1 text-[var(--ink)]">{line.lyRevenue == null ? "—" : formatCurrency(line.lyRevenue)}</dd>
                        </div>
                        {line.units !== 0 || line.lyUnits != null ? (
                          <div>
                            <dt className="brief-kicker">Units</dt>
                            <dd className="mt-1 text-[var(--ink)]">{formatPieceCount(lineYear === "ly" ? line.lyUnits ?? 0 : line.units)}</dd>
                          </div>
                        ) : null}
                        <div>
                          <dt className="brief-kicker">Vs last year</dt>
                          <dd className="mt-1 text-[var(--ink)]">{line.delta == null && blankDelta ? "—" : formatSignedPct(line.delta)}</dd>
                        </div>
                        {line.onHand != null ? (
                          <div>
                            <dt className="brief-kicker">On hand</dt>
                            <dd className="mt-1 text-[var(--ink)]">{formatPieceCount(line.onHand)}</dd>
                          </div>
                        ) : null}
                        {line.kashCost != null ? (
                          <div>
                            <dt className="brief-kicker">Kash CP</dt>
                            <dd className="mt-1 text-[var(--ink)]">{formatCurrency(line.kashCost)}</dd>
                          </div>
                        ) : null}
                      </dl>
                      {line.note ? <p className="mb-3 text-[14px] leading-snug text-[var(--ink)]">{line.note}</p> : null}
                      </>
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
