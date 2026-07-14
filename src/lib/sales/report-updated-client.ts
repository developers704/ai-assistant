/**
 * Cross-tab / same-tab signal when a sales CSV is uploaded or replaced
 * (Data Analyst → POST /api/reports). Sales Dashboard & Visualizations listen
 * and reset filters to match the new report's dates and dimensions.
 */

export const SALES_REPORT_UPDATED_EVENT = "sales-report-updated";
export const SALES_REPORT_UPDATED_STORAGE_KEY = "sales-report-updated-at";

export type SalesReportUpdatedDetail = {
  reportId?: string;
  label?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  dataVersion?: string | null;
  at: string;
};

export function emitSalesReportUpdated(detail: Omit<SalesReportUpdatedDetail, "at"> & { at?: string }) {
  if (typeof window === "undefined") return;
  const payload: SalesReportUpdatedDetail = {
    ...detail,
    at: detail.at ?? new Date().toISOString(),
  };
  try {
    window.dispatchEvent(
      new CustomEvent(SALES_REPORT_UPDATED_EVENT, { detail: payload })
    );
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(SALES_REPORT_UPDATED_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore private mode */
  }
  try {
    const bc = new BroadcastChannel("sales-report");
    bc.postMessage({ type: SALES_REPORT_UPDATED_EVENT, ...payload });
    bc.close();
  } catch {
    /* BroadcastChannel unsupported */
  }
}

export function subscribeSalesReportUpdated(
  handler: (detail: SalesReportUpdatedDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const onCustom = (e: Event) => {
    const ce = e as CustomEvent<SalesReportUpdatedDetail>;
    if (ce.detail) handler(ce.detail);
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== SALES_REPORT_UPDATED_STORAGE_KEY || !e.newValue) return;
    try {
      handler(JSON.parse(e.newValue) as SalesReportUpdatedDetail);
    } catch {
      /* ignore */
    }
  };

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel("sales-report");
    bc.onmessage = (e) => {
      const data = e.data as SalesReportUpdatedDetail & { type?: string };
      if (data?.type === SALES_REPORT_UPDATED_EVENT || data?.at) {
        handler(data);
      }
    };
  } catch {
    bc = null;
  }

  window.addEventListener(SALES_REPORT_UPDATED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(SALES_REPORT_UPDATED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
  };
}
