export { querySales, querySalesFromMessage } from "./query-sales";
export type * from "./sales-types";
export { resolveDateRange, detectRelativeDate } from "./sales-date-resolver";
export { buildEntityIndex, matchEntity, normalizeFilterInputs } from "./sales-normalizer";
export {
  getSalesWorkingMemory,
  updateSalesWorkingMemory,
  clearSalesWorkingMemory,
  salesDashboardToQuery,
} from "./sales-working-memory";
export { buildDashboardState, applyAndPersistDashboardState } from "./sales-dashboard-state";
export { isSalesUnifiedIntelligenceEnabled } from "./flags";
export { SALES_METRICS } from "./metrics/definitions";
export { refreshSalesData, ensureActiveSalesVersion } from "./refresh/service";
export { getActiveSalesContext, setActiveSalesContext } from "./active-context";
export { readActiveSnapshot, getActiveSalesStatus } from "./data/version-store";
export { compactSnapshotSummary, buildSalesDashboardSnapshot } from "./snapshot/builder";
