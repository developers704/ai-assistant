import Papa from "papaparse";
import { filterExcludedSalesRows } from "@/lib/utils";
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
import { DEFAULT_INCLUDE, emptyFilters, normalizeGroupBy, normalizeMetrics, wantsShow, wantsTellOnly } from "./sales-schema";
import { buildEntityIndex, extractEntitiesFromMessage, extractComparisonPair, normalizeFilterInputs, matchEntity } from "./sales-normalizer";
import { resolveDateRange } from "./sales-date-resolver";
import { filterRows, groupRows, summarizeRows } from "./sales-aggregate";
import { compareEntitySlices } from "./sales-comparison";
import { getTopVendorModels, getTopProducts } from "./sales-product-analysis";
import {
  attachNavigationHint,
  attachSpokenNav,
  formatSalesSpokenAnswer,
  formatSalesTextAnswer,
} from "./sales-response";
import { mergeWithSalesMemory, detectGroupByFromMessage, detectRemoveFilters, isSalesReset } from "./sales-context";
import { updateSalesWorkingMemory, clearSalesWorkingMemory } from "./sales-working-memory";
import { applyAndPersistDashboardState, buildDashboardState } from "./sales-dashboard-state";

function loadReportRows(): {
  rows: VendorPosRow[];
  reportName: string | null;
  reportStart: string | null;
  reportEnd: string | null;
  dates: string[];
} | null {
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
  };
}

function enrichInputFromMessage(input: SalesQueryInput, index: ReturnType<typeof buildEntityIndex>): SalesQueryInput {
  const msg = input.userMessage?.trim();
  if (!msg) return input;

  const extracted = extractEntitiesFromMessage(msg, index);
  const groupBy = input.groupBy?.length ? input.groupBy : detectGroupByFromMessage(msg);

  // Comparison phrases — entities go into comparison only, not AND filters
  let comparison = input.comparison;
  const pair = !comparison?.entities?.length ? extractComparisonPair(msg) : null;
  if (pair && !comparison) {
    comparison = {
      mode: "compare_entities",
      entities: [pair.left, pair.right],
    };
  }

  // When comparing two entities of the same type, strip those fields from filters
  // so we don't AND "store=Great Mall" onto a Great Mall vs Valley Fair compare.
  if (comparison?.entities?.length === 2) {
    const entityType = inferCompareEntityType(
      comparison.entities[0],
      comparison.entities[1],
      index
    );
    if (entityType === "store") delete extracted.stores;
    if (entityType === "department") delete extracted.departments;
    if (entityType === "design") delete extracted.designs;
    if (entityType === "vendor") delete extracted.vendors;
    if (entityType === "class") delete extracted.classes;
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
  if (wantsTellOnly(msg)) {
    display.navigateToSales = false;
  }

  return {
    ...input,
    stores: input.stores?.length ? input.stores : extracted.stores,
    departments: input.departments?.length ? input.departments : extracted.departments,
    designs: input.designs?.length ? input.designs : extracted.designs,
    vendors: input.vendors?.length ? input.vendors : extracted.vendors,
    classes: input.classes?.length ? input.classes : extracted.classes,
    groupBy,
    comparison,
    display,
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
    index
  );

  const metrics = normalizeMetrics(input.metrics);
  const groupBy = normalizeGroupBy(input.groupBy);
  const include = { ...DEFAULT_INCLUDE, ...input.include };
  const limit = input.limit ?? 10;

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
      warnings: [dateResolved.unavailableReason, ...norm.warnings],
    };
    return {
      ...partial,
      spokenAnswer: formatSalesSpokenAnswer(partial),
      textAnswer: formatSalesTextAnswer(partial),
    };
  }

  const filtered = filterRows(loaded.rows, {
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

  const summary = summarizeRows(filtered);
  const warnings = [...norm.warnings];

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
  if (include.topProducts) rankings.topProducts = getTopProducts(filtered, { limit });
  if (include.topVendorModels) {
    rankings.topVendorModels = getTopVendorModels(filtered, { limit });
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
  };

  let textAnswer = formatSalesTextAnswer(partial);
  let spokenAnswer = formatSalesSpokenAnswer(partial);
  if (shouldNavigate && navigatePath) {
    textAnswer = attachNavigationHint(textAnswer, true);
    spokenAnswer = attachSpokenNav(spokenAnswer, true);
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
