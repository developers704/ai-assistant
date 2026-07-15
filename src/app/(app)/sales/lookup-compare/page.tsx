"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PageShell,
  PageShellHeader,
  PageShellBody,
} from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import {
  SalesDateRangePicker,
  type SalesDateRangeValue,
} from "@/components/sales/SalesDateRangePicker";
import { SalesSkuLookup } from "@/components/sales/SalesSkuLookup";
import { SalesComparePanel } from "@/components/sales/SalesComparePanel";
import { subscribeSalesReportUpdated } from "@/lib/sales/report-updated-client";
import { isValidIsoDate } from "@/lib/reports/date-utils";
import { ArrowLeft, GitCompareArrows } from "lucide-react";

function rangeFromSearchParams(sp: {
  get: (key: string) => string | null;
}): SalesDateRangeValue | null {
  const from = sp.get("from")?.trim() ?? "";
  const to = sp.get("to")?.trim() ?? "";
  const date = sp.get("date")?.trim() ?? "";
  if (from && to && isValidIsoDate(from) && isValidIsoDate(to)) {
    return from <= to ? { from, to } : { from: to, to: from };
  }
  if (date && isValidIsoDate(date)) return { from: date, to: date };
  if (from && isValidIsoDate(from)) return { from, to: from };
  return null;
}

function appendDateParams(params: URLSearchParams, range: SalesDateRangeValue | null) {
  if (!range) return;
  if (range.from === range.to) {
    params.set("date", range.from);
  } else {
    params.set("from", range.from);
    params.set("to", range.to);
  }
}

export default function SalesLookupComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64 text-ink-muted animate-pulse">
          Loading lookup & compare…
        </div>
      }
    >
      <SalesLookupCompareContent />
    </Suspense>
  );
}

function SalesLookupCompareContent() {
  const searchParams = useSearchParams();
  const [dateRange, setDateRange] = useState<SalesDateRangeValue | null>(() =>
    rangeFromSearchParams(searchParams)
  );
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [reportRange, setReportRange] = useState<{ from: string; to: string } | null>(
    null
  );
  const [options, setOptions] = useState({
    stores: [] as string[],
    departments: [] as string[],
    designs: [] as string[],
    vendors: [] as string[],
    classes: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    return subscribeSalesReportUpdated(() => {
      setDateRange(null);
      setRefreshNonce((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    setDateRange(rangeFromSearchParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    appendDateParams(params, dateRange);
    const qs = params.toString() ? `?${params}` : "";
    fetch(`/api/sales${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setAvailableDates(d.availableDates ?? []);
        setReportRange(d.summary?.dateRange ?? d.report?.dateRange ?? null);
        setOptions({
          stores: d.availableStores ?? [],
          departments: d.availableDepartments ?? [],
          designs: d.availableDesigns ?? [],
          vendors: d.availableVendors ?? [],
          classes: d.availableClasses ?? [],
        });
        const dates: string[] = d.availableDates ?? [];
        if (
          dateRange &&
          dates.length &&
          (!dates.includes(dateRange.from) || !dates.includes(dateRange.to))
        ) {
          setDateRange(null);
        }
      })
      .finally(() => setLoading(false));
  }, [dateRange?.from, dateRange?.to, refreshNonce]);

  const backHref = (() => {
    const params = new URLSearchParams();
    appendDateParams(params, dateRange);
    const qs = params.toString();
    return qs ? `/sales?${qs}` : "/sales";
  })();

  return (
    <PageShell accent="emerald">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Sales"
          title="Lookup & Compare"
          subtitle="SKU detail lookup and side-by-side sales slices"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link href={backHref}>
                <Button size="sm" variant="ghost" className="gap-1.5">
                  <ArrowLeft size={14} />
                  Sales
                </Button>
              </Link>
            </div>
          }
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SalesDateRangePicker
            availableDates={availableDates}
            reportRange={reportRange}
            value={dateRange}
            onChange={setDateRange}
          />
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <GitCompareArrows size={13} className="text-amber-300/80" />
            Date applies to SKU lookup and comparison
          </span>
        </div>
      </PageShellHeader>

      <PageShellBody>
        {loading && availableDates.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-ink-muted animate-pulse">
            Loading report dimensions…
          </div>
        ) : (
          <div className="flex flex-col gap-5 w-full max-w-5xl">
            <SalesSkuLookup dateRange={dateRange} />
            <SalesComparePanel
              availableDates={availableDates}
              reportRange={reportRange}
              defaultDateRange={dateRange}
              hideDatePicker
              options={options}
            />
          </div>
        )}
      </PageShellBody>
    </PageShell>
  );
}
