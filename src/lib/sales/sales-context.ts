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

export function isSalesReset(message: string): boolean {
  return RESET.test(message);
}

/** Merge a new partial query with prior sales memory (follow-up retention). */
export function mergeWithSalesMemory(
  input: SalesQueryInput,
  memory: SalesWorkingMemoryState = getSalesWorkingMemory()
): SalesQueryInput {
  if (input.resetContext || (input.userMessage && isSalesReset(input.userMessage))) {
    return { ...input, resetContext: true };
  }

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
    comparison: input.comparison ?? memory.lastComparison,
    // If user only changed groupBy via follow-up, keep filters from memory even when input empty
    ...(hasExplicitFilters
      ? {}
      : {
          stores: input.stores ?? memory.lastStores,
          departments: input.departments ?? memory.lastDepartments,
          designs: input.designs ?? memory.lastDesigns,
          vendors: input.vendors ?? memory.lastVendors,
          classes: input.classes ?? memory.lastClasses,
        }),
  };
}

export function detectGroupByFromMessage(message: string): SalesGroupBy[] {
  const lower = message.toLowerCase();
  const out: SalesGroupBy[] = [];
  if (/\b(by|according to|hisaab|hisab)\s+(stores?|store)\b/i.test(lower) || /\bstore ke hisaab\b/i.test(lower)) {
    out.push("store");
  }
  if (/\b(by|according to)\s+departments?\b/i.test(lower) || /\bdepartment ke hisaab\b/i.test(lower)) {
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
  if (/\b(vendor models?|top models?|top products?)\b/i.test(lower)) {
    out.push("vendor_model");
  }
  return out;
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
  if (/\bshow all dates\b/i.test(lower)) {
    // handled as date reset by caller
  }
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
