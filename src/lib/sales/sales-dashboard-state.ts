import type { SalesDashboardState, SalesEntityType, SalesQueryFilters, SalesResolvedDateRange } from "./sales-types";
import { saveSalesDashboardState, salesDashboardToQuery } from "./sales-working-memory";

export function buildDashboardState(opts: {
  dateRange: SalesResolvedDateRange;
  filters: SalesQueryFilters;
  selectedDetail?: { type: SalesEntityType; value: string } | null;
}): SalesDashboardState {
  const singleDate =
    opts.dateRange.startDate &&
    opts.dateRange.endDate &&
    opts.dateRange.startDate === opts.dateRange.endDate
      ? opts.dateRange.startDate
      : undefined;

  return {
    route: "/sales",
    date: singleDate,
    dateFrom: opts.dateRange.startDate ?? undefined,
    dateTo: opts.dateRange.endDate ?? undefined,
    stores: opts.filters.stores,
    departments: opts.filters.departments,
    designs: opts.filters.designs,
    vendors: opts.filters.vendors,
    classes: opts.filters.classes,
    selectedDetail: opts.selectedDetail ?? null,
  };
}

export function applyAndPersistDashboardState(state: SalesDashboardState): {
  state: SalesDashboardState;
  path: string;
} {
  saveSalesDashboardState(state);
  return { state, path: salesDashboardToQuery(state) };
}

export { salesDashboardToQuery, getSalesDashboardState, saveSalesDashboardState } from "./sales-working-memory";
