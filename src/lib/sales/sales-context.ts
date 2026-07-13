import type {
  SalesGroupBy,
  SalesQueryFilters,
  SalesQueryInput,
  SalesWorkingMemoryState,
} from "./sales-types";
import { emptyFilters } from "./sales-schema";
import { getSalesWorkingMemory } from "./sales-working-memory";

const RESET =
  /\b(reset|start over|clear filters|clear sales|show all|sab dikhao|filters? hatao)\b/i;

const FOLLOW_UP =
  /\b(now by|by department|by store|by vendor|by design|by class|what about|same for|ab |hisaab|hisab se|top vendor models?|top models?|break it down|lowest five|top five|show more|open details|remove |clear )\b/i;

export function isSalesReset(message: string): boolean {
  return RESET.test(message);
}

export function isSalesFollowUp(message: string): boolean {
  return FOLLOW_UP.test(message);
}

/**
 * Merge a new partial query with prior sales memory.
 * Follow-ups keep prior filters; fresh entity questions replace them
 * so stale filters (from earlier bugs/sessions) cannot zero out results.
 */
export function mergeWithSalesMemory(
  input: SalesQueryInput,
  memory: SalesWorkingMemoryState = getSalesWorkingMemory()
): SalesQueryInput {
  if (input.resetContext || (input.userMessage && isSalesReset(input.userMessage))) {
    return { ...input, resetContext: true };
  }

  // Never inherit entity filters onto a compare — operands are OR slices.
  if (input.comparison?.entities?.length) {
    return {
      ...input,
      stores: [],
      departments: [],
      designs: [],
      vendors: [],
      classes: [],
      products: [],
      skus: [],
      vendorModels: [],
      dateRange: input.dateRange?.type || input.dateRange?.startDate
        ? input.dateRange
        : memory.lastDateRange
          ? {
              type:
                memory.lastDateRange.type === "report_all"
                  ? "all_dates"
                  : memory.lastDateRange.type,
              startDate: memory.lastDateRange.startDate ?? undefined,
              endDate: memory.lastDateRange.endDate ?? undefined,
            }
          : input.dateRange,
    };
  }

  const msg = input.userMessage ?? "";
  // "top vendor models for X" is a fresh vendor query, not a follow-up
  const freshVendorModels = /\btop\s+vendor\s+models?\b/i.test(msg) && /\bfor\b/i.test(msg);
  const followUp = Boolean(msg && isSalesFollowUp(msg) && !freshVendorModels);

  const hasExplicitFilters =
    (input.stores?.length ?? 0) > 0 ||
    (input.departments?.length ?? 0) > 0 ||
    (input.designs?.length ?? 0) > 0 ||
    (input.vendors?.length ?? 0) > 0 ||
    (input.classes?.length ?? 0) > 0 ||
    (input.products?.length ?? 0) > 0 ||
    (input.skus?.length ?? 0) > 0 ||
    (input.vendorModels?.length ?? 0) > 0;

  const hasDate = Boolean(input.dateRange?.type || input.dateRange?.startDate);
  const hasGroupBy = Boolean(input.groupBy?.length);

  // Fresh standalone query with its own entities — do not inherit other dimensions
  if ((hasExplicitFilters || freshVendorModels) && !followUp) {
    return {
      ...input,
      dateRange: hasDate
        ? input.dateRange
        : memory.lastDateRange
          ? {
              type:
                memory.lastDateRange.type === "report_all"
                  ? "all_dates"
                  : memory.lastDateRange.type,
              startDate: memory.lastDateRange.startDate ?? undefined,
              endDate: memory.lastDateRange.endDate ?? undefined,
            }
          : input.dateRange,
      // Keep only what this message set — clear other dimensions
      stores: input.stores ?? [],
      departments: input.departments ?? [],
      designs: input.designs ?? [],
      vendors: input.vendors ?? [],
      classes: input.classes ?? [],
      metrics: input.metrics?.length ? input.metrics : memory.lastMetrics,
      groupBy: hasGroupBy ? input.groupBy : undefined,
      comparison: input.comparison,
    };
  }

  // Follow-up / no new entities — inherit prior filters
  return {
    ...input,
    dateRange: hasDate
      ? input.dateRange
      : memory.lastDateRange
        ? {
            type:
              memory.lastDateRange.type === "report_all"
                ? "all_dates"
                : memory.lastDateRange.type,
            startDate: memory.lastDateRange.startDate ?? undefined,
            endDate: memory.lastDateRange.endDate ?? undefined,
          }
        : input.dateRange,
    stores: input.stores?.length ? input.stores : memory.lastStores,
    departments: input.departments?.length ? input.departments : memory.lastDepartments,
    designs: input.designs?.length ? input.designs : memory.lastDesigns,
    vendors: input.vendors?.length ? input.vendors : memory.lastVendors,
    classes: input.classes?.length ? input.classes : memory.lastClasses,
    metrics: input.metrics?.length ? input.metrics : memory.lastMetrics,
    groupBy: hasGroupBy ? input.groupBy : memory.lastGroupBy,
    comparison: input.comparison ?? (followUp ? memory.lastComparison : undefined),
  };
}

export function detectGroupByFromMessage(message: string): SalesGroupBy[] {
  const lower = message.toLowerCase();
  const out: SalesGroupBy[] = [];
  if (
    /\b(by|according to|hisaab|hisab)\s+(stores?|store)\b/i.test(lower) ||
    /\bstore ke hisaab\b/i.test(lower) ||
    /\btop\s+\d*\s*stores?\b/i.test(lower)
  ) {
    out.push("store");
  }
  if (/\b(by|according to)\s+departments?\b/i.test(lower) || /\bdepartment ke hisaab\b/i.test(lower) || /\bdepartment\s+breakdown\b/i.test(lower)) {
    out.push("department");
  }
  if (/\b(by|according to)\s+(designs?|design lines?)\b/i.test(lower) || /\bdesign ke hisaab\b/i.test(lower)) {
    out.push("design");
  }
  if (/\b(by|according to)\s+vendors?\b/i.test(lower) || /\bvendor ke hisaab\b/i.test(lower)) {
    out.push("vendor");
  }
  if (/\b(by|according to)\s+(class|metal|classes)\b/i.test(lower) || /\bclass ke hisaab\b/i.test(lower)) {
    out.push("class");
  }
  if (/\b(by|according to)\s+date\b/i.test(lower) || /\bdaily\b/i.test(lower)) {
    out.push("date");
  }
  if (/\b(by|according to)\s+skus?\b/i.test(lower) || /\bsales\s+by\s+sku\b/i.test(lower)) {
    out.push("sku");
  }
  if (/\b(vendor models?|top models?|top products?)\b/i.test(lower)) {
    out.push("vendor_model");
  }
  return out;
}

/** Parse "top N" limit from a message. */
export function detectLimitFromMessage(message: string): number | undefined {
  const m = message.match(/\btop\s+(\d+)\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : undefined;
}

export function detectRemoveFilters(message: string): Partial<SalesQueryFilters> & { clearAll?: boolean } {
  const lower = message.toLowerCase();
  if (/\b(clear|remove|drop)\s+(all\s+)?filters?\b/i.test(lower) || isSalesReset(message)) {
    return { clearAll: true };
  }
  const patch: Partial<SalesQueryFilters> = {};
  if (/\b(remove|clear|drop)\s+vendor\b/i.test(lower)) patch.vendors = [];
  if (/\b(remove|clear|drop)\s+department\b/i.test(lower)) patch.departments = [];
  if (/\b(remove|clear|drop)\s+design\b/i.test(lower)) patch.designs = [];
  if (/\b(remove|clear|drop)\s+store\b/i.test(lower)) patch.stores = [];
  if (/\b(remove|clear|drop)\s+class\b/i.test(lower)) patch.classes = [];
  return patch;
}

export function filtersFromMemory(memory: SalesWorkingMemoryState): SalesQueryFilters {
  return {
    ...emptyFilters(),
    stores: memory.lastStores ?? [],
    departments: memory.lastDepartments ?? [],
    designs: memory.lastDesigns ?? [],
    vendors: memory.lastVendors ?? [],
    classes: memory.lastClasses ?? [],
  };
}
