export type HrSelfSalesperson = {
  code: string;
  label: string;
  storeCode: string | null;
  storeName: string | null;
};

export type HrSalesScopePayload =
  | { mode: "all" }
  | { mode: "self"; self: HrSelfSalesperson | null };
