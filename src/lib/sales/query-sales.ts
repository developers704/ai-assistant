import Papa from "papaparse";
import { filterExcludedSalesRows, SALES_EXCLUSION_RULES_VERSION } from "@/lib/utils";
import {
  getLatestReportMeta,
  readReportCsv,
  getLatestReportWithSummary,
} from "@/lib/reports/store";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import type { VendorPosRow } from "@/lib/reports/types";
import type {
  SalesEntityType,
  SalesGroupBy,
  SalesQueryInput,
  SalesQueryResult,
} from "./sales-types";
import { DEFAULT_INCLUDE, emptyFilters, normalizeGroupBy, normalizeMetrics, wantsShow, wantsTellOnly, wantsSalesExplain, wantsSalesShowOnly } from "./sales-schema";
import { buildEntityIndex, extractEntitiesFromMessage, extractComparisonPair, normalizeFilterInputs, matchEntity } from "./sales-normalizer";
import { resolveDateRange, todayIso } from "./sales-date-resolver";
import { filterRows, groupRows, summarizeRows } from "./sales-aggregate";
import { compareEntitySlices } from "./sales-comparison";
import { getTopVendorModels, getTopProducts } from "./sales-product-analysis";
import {
  attachNavigationHint,
  attachSpokenNav,
  formatSalesOpenSpoken,
  formatSalesSpokenAnswer,
  formatSalesTextAnswer,
} from "./sales-response";
import { mergeWithSalesMemory, detectGroupByFromMessage, detectRemoveFilters, isSalesReset, detectLimitFromMessage } from "./sales-context";
import { updateSalesWorkingMemory, clearSalesWorkingMemory } from "./sales-working-memory";
import { applyAndPersistDashboardState, buildDashboardState } from "./sales-dashboard-state";
import { isSalesUnifiedIntelligenceEnabled } from "./flags";
import { readActivePointer, readNormalizedRows, readVersionMetadata } from "./data/version-store";
import { getActiveSalesContext } from "./active-context";
import { formatReportDateLong } from "@/lib/reports/date-utils";

function loadReportRows(): {
  rows: VendorPosRow[];
  reportName: string | null;
  reportStart: string | null;
  reportEnd: string | null;
  dates: string[];
  dataVersion: string | null;
  refreshedAt: string | null;
} | null {
  if (isSalesUnifiedIntelligenceEnabled()) {
    const pointer = readActivePointer();
    const versionRows = pointer.activeVersion ? readNormalizedRows(pointer.activeVersion) : null;
    if (versionRows?.length) {
      // Always re-apply exclusions (incl. return pairs) — cached versions may predate rule bumps.
      const clean = filterExcludedSalesRows(versionRows);
      const meta = pointer.activeVersion
        ? readVersionMetadata(pointer.activeVersion)
        : null;
      const dates = [...new Set(clean.map((r) => r.date).filter(Boolean))].sort();
      return {
        rows: clean,
        reportName: meta?.fileName ?? "Sales Intelligence",
        reportStart: meta?.dateRange.from ?? dates[0] ?? null,
        reportEnd: meta?.dateRange.to ?? dates[dates.length - 1] ?? null,
        dates,
        dataVersion: pointer.activeVersion,
        refreshedAt: meta?.refreshedAt ?? pointer.activatedAt,
      };
    }
  }

  const latest = getLatestReportWithSummary();
  if (!latest) return null;
  const csv = latest.csv;
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const { rows } = parseVendorPosRows(parsed.data ?? []);
  const clean = filterExcludedSalesRows(rows);
  const dates = [...new Set(clean.map((r) => r.date).filter(Boolean))].sort();
  return {
    rows: clean,
    reportName: latest.meta.label,
    reportStart: latest.meta.dateRange?.from ?? dates[0] ?? null,
    reportEnd: latest.meta.dateRange?.to ?? dates[dates.length - 1] ?? null,
    dates,
    dataVersion: readActivePointer().activeVersion,
    refreshedAt: readActivePointer().activatedAt,
  };
}

function inheritDashboardContext(input: SalesQueryInput): SalesQueryInput {
  if (!isSalesUnifiedIntelligenceEnabled()) return input;
  // Dashboard loads + explicit resets must not pick up stale chat/voice filters.
  if (input.resetContext) return input;
  // Compare queries must not inherit dashboard filters (would AND conflicting entities).
  if (input.comparison?.entities?.length) return input;

  const ctx = getActiveSalesContext();
  const hasEntity =
    (input.stores?.length ?? 0) > 0 ||
    (input.departments?.length ?? 0) > 0 ||
    (input.designs?.length ?? 0) > 0 ||
    (input.vendors?.length ?? 0) > 0 ||
    (input.classes?.length ?? 0) > 0;

  // Fresh entity from the utterance (e.g. "Great Mall sales") — never AND leftover
  // design/dept/vendor/class filters from a prior dashboard/voice turn (e.g. EA).
  if (hasEntity) {
    return {
      ...input,
      stores: input.stores ?? [],
      departments: input.departments ?? [],
      designs: input.designs ?? [],
      vendors: input.vendors ?? [],
      classes: input.classes ?? [],
      dateRange: input.dateRange,
    };
  }

  const hasExplicitDate =
    Boolean(input.dateRange?.type && input.dateRange.type !== "all_dates") ||
    Boolean(input.dateRange?.startDate);

  // Only fill missing filters from dashboard context when this turn named none
  return {
    ...input,
    stores: input.stores?.length ? input.stores : ctx.stores,
    departments: input.departments?.length ? input.departments : ctx.departments,
    designs: input.designs?.length ? input.designs : ctx.designs,
    vendors: input.vendors?.length ? input.vendors : ctx.vendors,
    classes: input.classes?.length ? input.classes : ctx.classes,
    dateRange:
      hasExplicitDate || input.dateRange
        ? input.dateRange
        : ctx.dateRange?.from && ctx.dateRange?.to
          ? {
              type: "custom",
              startDate: ctx.dateRange.from,
              endDate: ctx.dateRange.to,
            }
          : input.dateRange,
  };
}

function enrichInputFromMessage(input: SalesQueryInput, index: ReturnType<typeof buildEntityIndex>): SalesQueryInput {
  const msg = input.userMessage?.trim();
  if (!msg) return input;

  const extracted = extractEntitiesFromMessage(msg, index);
  const groupBy = input.groupBy?.length ? input.groupBy : detectGroupByFromMessage(msg);
  const limitFromMsg = detectLimitFromMessage(msg);

  // Explicit "X design" / "design X" even when unknown to the index
  if (!extracted.designs?.length) {
    const designNamed =
      msg.match(/\b([A-Za-z0-9][A-Za-z0-9\-]{1,40})\s+design\b/i) ||
      msg.match(/\bdesign\s+([A-Za-z0-9][A-Za-z0-9\-]{1,40})\b/i);
    if (designNamed?.[1] && !/^(the|a|an|by|for|of|and|sales?)$/i.test(designNamed[1])) {
      extracted.designs = [designNamed[1].toUpperCase()];
    }
  }

  // Explicit "X department" / "department X"
  if (!extracted.departments?.length) {
    const deptNamed =
      msg.match(/\b([A-Za-z0-9][A-Za-z0-9'\-\s]{1,40}?)\s+departments?\b/i) ||
      msg.match(/\bdepartments?\s+([A-Za-z0-9][A-Za-z0-9'\-\s]{1,40}?)\b/i);
    if (deptNamed?.[1]) {
      const raw = deptNamed[1].trim().replace(/\b(sales?|the|my)$/i, "").trim();
      if (raw && !/^(the|a|an|by|for|of|and)$/i.test(raw)) {
        const asDept = matchEntity(raw, index.departments, "department");
        extracted.departments =
          asDept.status === "exact" || asDept.status === "fuzzy"
            ? [asDept.value]
            : [raw];
      }
    }
  }

  // Explicit "X class" / "class X"
  if (!extracted.classes?.length) {
    const classNamed =
      msg.match(/\b([A-Za-z0-9][A-Za-z0-9'\-\s]{0,30}?)\s+class(?:es)?\b/i) ||
      msg.match(/\bclass(?:es)?\s+([A-Za-z0-9][A-Za-z0-9'\-\s]{0,30}?)\b/i);
    if (classNamed?.[1]) {
      const raw = classNamed[1].trim().replace(/\b(sales?|the|my)$/i, "").trim();
      if (raw && !/^(the|a|an|by|for|of|and)$/i.test(raw)) {
        const asClass = matchEntity(raw, index.classes, "class");
        extracted.classes =
          asClass.status === "exact" || asClass.status === "fuzzy"
            ? [asClass.value]
            : [raw];
      }
    }
  }

  // Explicit "at/in Unknown Mall" when store not resolved from index
  if (!extracted.stores?.length) {
    const atPlace =
      msg.match(
        /\b(?:at|in)\s+((?:[A-Za-z0-9][A-Za-z0-9'\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9'\-]*){0,4})\s*(?:mall|store|plaza|center))\b/i
      ) ||
      msg.match(/\bsales\s+(?:at|in)\s+([A-Za-z0-9][A-Za-z0-9'\-\s]{1,40}?)\s*[.?!]?$/i);
    if (atPlace?.[1] && !/^(this|last|the|a|an)\b/i.test(atPlace[1])) {
      const candidate = atPlace[1].trim();
      if (!/^\d{4}$/.test(candidate) && !/^(july|june|august|today|yesterday)/i.test(candidate)) {
        extracted.stores = [candidate];
      }
    }
  }

  // "top vendor models for MHVR" — prefer vendor over store
  if (/\btop\s+vendor\s+models?\b/i.test(msg) || /\btop\s+models?\s+for\b/i.test(msg)) {
    const forVendor = msg.match(/\bfor\s+([A-Za-z0-9][A-Za-z0-9\-]{1,20})\b/i);
    if (forVendor?.[1]) {
      const asVendor = matchEntity(forVendor[1], index.vendors, "vendor");
      if (asVendor.status === "exact" || asVendor.status === "fuzzy") {
        extracted.vendors = [asVendor.value];
        delete extracted.stores;
      } else if (!extracted.vendors?.length) {
        extracted.vendors = [forVendor[1].toUpperCase()];
        delete extracted.stores;
      }
    }
  }

  // Comparison phrases — entities go into comparison only, not AND filters
  let comparison = input.comparison;
  const pair = !comparison?.entities?.length ? extractComparisonPair(msg) : null;
  if (pair && !comparison) {
    comparison = {
      mode: "compare_entities",
      entities: [pair.left, pair.right],
    };
  }

  // When comparing two entities, never AND them into filters — compare is OR slices.
  if (comparison?.entities?.length === 2) {
    const entityType = inferCompareEntityType(
      comparison.entities[0],
      comparison.entities[1],
      index
    );
    delete extracted.stores;
    delete extracted.departments;
    delete extracted.designs;
    delete extracted.vendors;
    delete extracted.classes;
    comparison = { ...comparison, entityType };
  }

  // "what about X" — replace primary entity of same type if memory had one
  const whatAbout = msg.match(
    /\b(?:what about|ab|isi date ka|same for)\s+([a-z0-9][a-z0-9\s\-']{1,40?}?)(?:\s*[.?!])?\s*$/i
  );
  if (whatAbout) {
    const name = whatAbout[1].trim();
    if (!/^by\s+/i.test(name)) {
      const asDesign = matchEntity(name, index.designs, "design");
      const asDept = matchEntity(name, index.departments, "department");
      const asVendor = matchEntity(name, index.vendors, "vendor");
      const asStore = matchEntity(name, index.stores, "store");
      if (asDesign.status === "exact" || asDesign.status === "fuzzy") {
        extracted.designs = [asDesign.value];
        delete extracted.departments;
        delete extracted.classes;
      } else if (asDept.status === "exact" || asDept.status === "fuzzy") {
        extracted.departments = [asDept.value];
        delete extracted.classes;
        delete extracted.designs;
      } else if (asVendor.status === "exact" || asVendor.status === "fuzzy") {
        extracted.vendors = [asVendor.value];
      } else if (asStore.status === "exact" || asStore.status === "fuzzy") {
        extracted.stores = [asStore.value];
      }
    }
  }

  const display = { ...input.display };
  if (wantsShow(msg) && display.navigateToSales == null) {
    display.navigateToSales = true;
    display.applyDashboardFilters = true;
  }
  // "Explain Novello" / "discuss Great Mall" → open filtered sales + brief spoken overview.
  if (
    wantsSalesExplain(msg) &&
    display.navigateToSales == null &&
    (Boolean(extracted.designs?.length) ||
      Boolean(extracted.departments?.length) ||
      Boolean(extracted.stores?.length) ||
      Boolean(extracted.vendors?.length) ||
      Boolean(extracted.classes?.length) ||
      Boolean(input.designs?.length) ||
      Boolean(input.departments?.length) ||
      Boolean(input.stores?.length) ||
      Boolean(input.vendors?.length) ||
      Boolean(input.classes?.length))
  ) {
    display.navigateToSales = true;
    display.applyDashboardFilters = true;
  }
  if (wantsTellOnly(msg) && !wantsSalesExplain(msg)) {
    display.navigateToSales = false;
  }

  const preferSpokenEntities = Boolean(display.navigateToSales);

  return {
    ...input,
    stores: preferSpokenEntities
      ? extracted.stores ?? []
      : input.stores?.length
        ? input.stores
        : extracted.stores,
    departments: preferSpokenEntities
      ? extracted.departments ?? []
      : input.departments?.length
        ? input.departments
        : extracted.departments,
    designs: preferSpokenEntities
      ? extracted.designs ?? []
      : input.designs?.length
        ? input.designs
        : extracted.designs,
    vendors: preferSpokenEntities
      ? extracted.vendors ?? []
      : input.vendors?.length
        ? input.vendors
        : extracted.vendors,
    classes: preferSpokenEntities
      ? extracted.classes ?? []
      : input.classes?.length
        ? input.classes
        : extracted.classes,
    groupBy,
    limit: input.limit ?? limitFromMsg,
    comparison,
    display,
    // Show/open filtered sales: only the entities named in this turn (no stale design/store mix).
    resetContext:
      input.resetContext ||
      (preferSpokenEntities &&
        Boolean(
          extracted.stores?.length ||
            extracted.departments?.length ||
            extracted.designs?.length ||
            extracted.vendors?.length ||
            extracted.classes?.length
        )),
  };
}

function inferCompareEntityType(
  left: string,
  right: string,
  index: ReturnType<typeof buildEntityIndex>
): SalesEntityType {
  const tryType = (known: string[], t: SalesEntityType): SalesEntityType | null => {
    const a = matchEntity(left, known, t);
    const b = matchEntity(right, known, t);
    if (
      (a.status === "exact" || a.status === "fuzzy") &&
      (b.status === "exact" || b.status === "fuzzy")
    ) {
      return t;
    }
    return null;
  };
  return (
    tryType(index.stores, "store") ??
    tryType(index.designs, "design") ??
    tryType(index.departments, "department") ??
    tryType(index.vendors, "vendor") ??
    tryType(index.classes, "class") ??
    "store"
  );
}

/**
 * Universal Sales Intelligence query — deterministic totals from the loaded report.
 * Never invents figures. Used by chat, voice, dashboard sync, and analyst routing.
 */
export async function querySales(rawInput: SalesQueryInput): Promise<SalesQueryResult> {
  const loaded = loadReportRows();
  if (!loaded) {
    return {
      ok: false,
      query: {
        resolvedDateRange: {
          type: "report_all",
          startDate: null,
          endDate: null,
          label: "n/a",
          dates: [],
        },
        filters: emptyFilters(),
        metrics: normalizeMetrics(rawInput.metrics),
        groupBy: normalizeGroupBy(rawInput.groupBy),
      },
      availability: {
        reportName: null,
        reportStartDate: null,
        reportEndDate: null,
        requestedRangeAvailable: false,
        matchingRowCount: 0,
      },
      summary: null,
      spokenAnswer: "No sales report is currently loaded.",
      textAnswer: "No sales report is currently loaded.",
      error: "No sales report is currently loaded.",
    };
  }

  const index = buildEntityIndex(loaded.rows);

  if (rawInput.userMessage && isSalesReset(rawInput.userMessage)) {
    clearSalesWorkingMemory();
  }

  let input = enrichInputFromMessage(rawInput, index);
  input = inheritDashboardContext(input);
  input = mergeWithSalesMemory(input);

  // Apply remove-filter follow-ups
  if (input.userMessage) {
    const rem = detectRemoveFilters(input.userMessage);
    if (rem.clearAll) {
      input = {
        ...input,
        stores: [],
        departments: [],
        designs: [],
        vendors: [],
        classes: [],
        resetContext: true,
      };
      clearSalesWorkingMemory();
    } else {
      if (rem.vendors) input.vendors = [];
      if (rem.departments) input.departments = [];
      if (rem.designs) input.designs = [];
      if (rem.stores) input.stores = [];
      if (rem.classes) input.classes = [];
    }
  }

  const dateResolved = resolveDateRange(input.dateRange, loaded.dates, input.userMessage);
  const norm = normalizeFilterInputs(
    {
      stores: input.stores,
      departments: input.departments,
      designs: input.designs,
      vendors: input.vendors,
      classes: input.classes,
      products: input.products,
      skus: input.skus,
      vendorModels: input.vendorModels,
    },
    index,
    { exact: Boolean(input.exactFilters) }
  );

  const metrics = normalizeMetrics(input.metrics);
  const groupBy = normalizeGroupBy(input.groupBy);
  const include = { ...DEFAULT_INCLUDE, ...input.include };
  // Top vendor models / products need 20 for the Sales Dashboard ranking table.
  const limit = input.limit ?? (include.topVendorModels || include.topProducts ? 20 : 10);

  const baseQuery = {
    resolvedDateRange: {
      type: dateResolved.type,
      startDate: dateResolved.startDate,
      endDate: dateResolved.endDate,
      label: dateResolved.label,
      dates: dateResolved.dates,
    },
    filters: norm.filters,
    metrics,
    groupBy,
    comparison: input.comparison,
  };

  if (norm.clarification) {
    const partial = {
      ok: false,
      query: baseQuery,
      availability: {
        reportName: loaded.reportName,
        reportStartDate: loaded.reportStart,
        reportEndDate: loaded.reportEnd,
        requestedRangeAvailable: true,
        matchingRowCount: 0,
      },
      summary: null,
      clarification: norm.clarification,
      warnings: norm.warnings,
    };
    return {
      ...partial,
      spokenAnswer: formatSalesSpokenAnswer(partial),
      textAnswer: formatSalesTextAnswer(partial),
    };
  }

  if (dateResolved.unavailableReason) {
    const askedToday =
      dateResolved.type === "today" ||
      (input.userMessage != null && /\b(today|aaj)\b/i.test(input.userMessage));
    const freshnessWarning =
      askedToday && loaded.reportEnd && loaded.reportEnd < todayIso()
        ? `The latest sales report contains data through ${formatReportDateLong(loaded.reportEnd)}. Today's sales have not been loaded yet.`
        : dateResolved.unavailableReason;
    const partial = {
      ok: false,
      query: baseQuery,
      availability: {
        reportName: loaded.reportName,
        reportStartDate: loaded.reportStart,
        reportEndDate: loaded.reportEnd,
        requestedRangeAvailable: false,
        matchingRowCount: 0,
      },
      summary: null,
      warnings: [freshnessWarning, ...norm.warnings],
      freshness: {
        dataVersion: loaded.dataVersion,
        dataThrough: loaded.reportEnd,
        refreshedAt: loaded.refreshedAt,
        source: loaded.reportName,
      },
      coverage: {
        complete: false,
        requestedFrom: dateResolved.startDate,
        requestedTo: dateResolved.endDate,
        availableFrom: loaded.reportStart,
        availableTo: loaded.reportEnd,
        warning: freshnessWarning,
      },
    };
    return {
      ...partial,
      spokenAnswer: formatSalesSpokenAnswer(partial),
      textAnswer: formatSalesTextAnswer(partial),
    };
  }

  let filtered = filterRows(loaded.rows, {
    dates: dateResolved.type === "report_all" ? undefined : dateResolved.dates,
    stores: norm.filters.stores,
    departments: norm.filters.departments,
    designs: norm.filters.designs,
    vendors: norm.filters.vendors,
    classes: norm.filters.classes,
    skus: norm.filters.skus,
    vendorModels: norm.filters.vendorModels,
    products: norm.filters.products,
  });

  const warnings = [...norm.warnings];
  const msgLower = (input.userMessage ?? "").toLowerCase();
  if (
    /\bmargin\b/.test(msgLower) &&
    /\b(missing|absent|null|without|no)\b[\s\S]{0,20}\bcost\b|\bcost\b[\s\S]{0,20}\b(missing|absent|null)\b/.test(
      msgLower
    )
  ) {
    filtered = filtered.filter((r) => !r.inventoryCost || r.inventoryCost === 0);
    warnings.push(
      "Showing lines where estimated cost is missing or zero. Estimated margin is not exact cost-based margin."
    );
  }

  const summary = summarizeRows(filtered);

  // Comparison
  let comparison = undefined as SalesQueryResult["comparison"];
  if (input.comparison?.entities?.length === 2 || (input.comparison?.mode === "compare_entities" && input.comparison.entities?.length === 2)) {
    const [rawL, rawR] = input.comparison.entities!;
    const entityType =
      input.comparison.entityType ??
      inferCompareEntityType(rawL, rawR, index);
    const known =
      entityType === "store"
        ? index.stores
        : entityType === "department"
          ? index.departments
          : entityType === "design"
            ? index.designs
            : entityType === "vendor"
              ? index.vendors
              : entityType === "class"
                ? index.classes
                : index.products;
    const leftM = matchEntity(rawL, known, entityType);
    const rightM = matchEntity(rawR, known, entityType);
    if (
      (leftM.status === "exact" || leftM.status === "fuzzy") &&
      (rightM.status === "exact" || rightM.status === "fuzzy")
    ) {
      comparison = compareEntitySlices(
        loaded.rows,
        entityType,
        leftM.value,
        rightM.value,
        {
          dates: dateResolved.type === "report_all" ? undefined : dateResolved.dates,
          stores: entityType === "store" ? undefined : norm.filters.stores,
          departments: entityType === "department" ? undefined : norm.filters.departments,
          designs: entityType === "design" ? undefined : norm.filters.designs,
          vendors: entityType === "vendor" ? undefined : norm.filters.vendors,
          classes: entityType === "class" ? undefined : norm.filters.classes,
        }
      );
    } else {
      warnings.push(`Could not resolve comparison entities "${rawL}" and "${rawR}".`);
    }
  }

  const breakdowns: NonNullable<SalesQueryResult["breakdowns"]> = {};
  const rankings: NonNullable<SalesQueryResult["rankings"]> = {};

  const ensureGroup = (g: SalesGroupBy) => {
    const rows = groupRows(filtered, g, limit);
    switch (g) {
      case "store":
        breakdowns.byStore = rows;
        break;
      case "department":
        breakdowns.byDepartment = rows;
        break;
      case "design":
        breakdowns.byDesign = rows;
        break;
      case "vendor":
        breakdowns.byVendor = rows;
        break;
      case "class":
        breakdowns.byClass = rows;
        break;
      case "product":
        breakdowns.byProduct = rows;
        break;
      case "sku":
        breakdowns.bySku = rows;
        break;
      case "vendor_model":
        breakdowns.byVendorModel = rows;
        break;
      case "date":
        breakdowns.byDate = rows;
        break;
    }
  };

  for (const g of groupBy) ensureGroup(g);

  if (include.topStores) rankings.topStores = groupRows(filtered, "store", limit);
  if (include.lowestStores) {
    rankings.lowestStores = groupRows(filtered, "store", 50, "netSales", "asc").slice(0, limit);
  }
  if (include.topDepartments) rankings.topDepartments = groupRows(filtered, "department", limit);
  if (include.topDesigns) rankings.topDesigns = groupRows(filtered, "design", limit);
  if (include.topVendors) rankings.topVendors = groupRows(filtered, "vendor", limit);
  if (include.topClasses) rankings.topClasses = groupRows(filtered, "class", limit);
  const productSort =
    input.sortBy === "revenue" || input.sortBy === "netSales"
      ? "revenue"
      : input.sortBy === "margin" || input.sortBy === "estimatedMargin"
        ? "margin"
        : "quantity";

  if (include.topProducts) {
    rankings.topProducts = getTopProducts(filtered, { limit, sortBy: productSort });
  }
  if (include.topVendorModels) {
    rankings.topVendorModels = getTopVendorModels(filtered, {
      limit,
      sortBy: productSort,
    });
    if (!breakdowns.byVendorModel && groupBy.includes("vendor_model")) {
      breakdowns.byVendorModel = rankings.topVendorModels;
    }
  }

  // Detail panel
  let selectedDetail: { type: SalesEntityType; value: string } | null = null;
  if (input.display?.openDetailPanel && input.display.detailType && input.display.detailValue) {
    selectedDetail = { type: input.display.detailType, value: input.display.detailValue };
  } else if (input.display?.openDetailPanel) {
    if (norm.filters.vendors[0]) selectedDetail = { type: "vendor", value: norm.filters.vendors[0] };
    else if (norm.filters.departments[0])
      selectedDetail = { type: "department", value: norm.filters.departments[0] };
    else if (norm.filters.designs[0]) selectedDetail = { type: "design", value: norm.filters.designs[0] };
    else if (norm.filters.stores[0]) selectedDetail = { type: "store", value: norm.filters.stores[0] };
    else if (norm.filters.classes[0]) selectedDetail = { type: "class", value: norm.filters.classes[0] };
  }

  const dashboardState = buildDashboardState({
    dateRange: baseQuery.resolvedDateRange,
    filters: norm.filters,
    selectedDetail,
  });

  const shouldNavigate = Boolean(
    input.display?.navigateToSales || input.display?.applyDashboardFilters
  );
  let navigatePath: string | undefined;
  if (shouldNavigate) {
    navigatePath = applyAndPersistDashboardState(dashboardState).path;
  } else {
    // still persist filters for continuity without forcing navigation
    applyAndPersistDashboardState(dashboardState);
  }

  updateSalesWorkingMemory({
    lastSalesQuery: input,
    lastDateRange: baseQuery.resolvedDateRange,
    lastStores: norm.filters.stores,
    lastDepartments: norm.filters.departments,
    lastDesigns: norm.filters.designs,
    lastVendors: norm.filters.vendors,
    lastClasses: norm.filters.classes,
    lastMetrics: metrics,
    lastGroupBy: groupBy,
    lastComparison: input.comparison,
    lastSelectedEntity: selectedDetail ?? undefined,
    lastSalesResultSummary: `${summary.netSales ?? 0}`,
    lastDashboardState: dashboardState,
  });

  if (filtered.length === 0 && !comparison) {
    warnings.push(
      `I found no matching sales for that filter combination in ${loaded.reportName ?? "the loaded report"}.`
    );
  }

  const partial = {
    ok: filtered.length > 0 || Boolean(comparison),
    query: baseQuery,
    availability: {
      reportName: loaded.reportName,
      reportStartDate: loaded.reportStart,
      reportEndDate: loaded.reportEnd,
      requestedRangeAvailable: true,
      matchingRowCount: filtered.length,
    },
    summary: filtered.length ? summary : null,
    breakdowns,
    rankings,
    comparison,
    dashboardState,
    warnings: warnings.length ? warnings : undefined,
    freshness: {
      dataVersion: loaded.dataVersion,
      dataThrough: loaded.reportEnd,
      refreshedAt: loaded.refreshedAt,
      source: loaded.reportName,
    },
    coverage: {
      complete: true,
      requestedFrom: dateResolved.startDate,
      requestedTo: dateResolved.endDate,
      availableFrom: loaded.reportStart,
      availableTo: loaded.reportEnd,
    },
  };

  let textAnswer = formatSalesTextAnswer(partial);
  let spokenAnswer = formatSalesSpokenAnswer(partial);
  const msg = input.userMessage ?? "";
  const showOnly =
    shouldNavigate &&
    Boolean(msg) &&
    wantsSalesShowOnly(msg) &&
    !wantsSalesExplain(msg);

  if (showOnly) {
    // "Show Novello sales" → open filtered dashboard; speak only the Opening line.
    spokenAnswer = formatSalesOpenSpoken(partial);
    textAnswer = attachNavigationHint(textAnswer, Boolean(navigatePath));
  } else if (shouldNavigate && navigatePath) {
    textAnswer = attachNavigationHint(textAnswer, true);
    // Explain/discuss: brief numbers + note that the filtered view is open.
    if (wantsSalesExplain(msg)) {
      spokenAnswer = attachSpokenNav(spokenAnswer, true);
    } else if (wantsShow(msg) || wantsTellOnly(msg)) {
      spokenAnswer = attachSpokenNav(spokenAnswer, true);
    }
  }

  return {
    ...partial,
    textAnswer,
    spokenAnswer,
  };
}

/** Convenience: parse a natural-language sales question into a query result. */
export async function querySalesFromMessage(
  message: string,
  overrides?: Partial<SalesQueryInput>
): Promise<SalesQueryResult> {
  return querySales({
    userMessage: message,
    ...overrides,
  });
}

export function getLoadedSalesMeta() {
  return getLatestReportMeta();
}

export function peekSalesCsv(): string | null {
  const meta = getLatestReportMeta();
  if (!meta) return null;
  return readReportCsv(meta.id);
}
