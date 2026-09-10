import { HR_ATTENDANCE_FROM, HR_ATTENDANCE_TO } from "@/lib/hr/window";
import { HR_LOVE_DESIGN, HR_OTHERS_DESIGN, HR_UV_DESIGN } from "@/lib/hr/hr-sales-design";

/** August 2026 dummy commission window (matches HR attendance). */
export const AUGUST_COMMISSION_FROM = HR_ATTENDANCE_FROM;
export const AUGUST_COMMISSION_TO = HR_ATTENDANCE_TO;

/**
 * Dummy personal goals — five achievers (ZA2, SA4, ZN, SK7, WM).
 * Everyone else gets a generated goal above their August net.
 */
export const AUGUST_PERSONAL_GOALS: Record<string, number> = {
  ZA2: 114_000,
  SA4: 135_000,
  ZN: 105_000,
  SK7: 98_000,
  WM: 90_000,
};

/** Dummy store goals. VJ-VAL hits; other stores default above actual sales. */
export const AUGUST_STORE_GOALS: Record<string, number> = {
  "VJ-VAL": 285_000,
};

/**
 * Zoya (ZA2) August design mix from Commission Structure - AI.xlsx (test fixture).
 * Includes the OVANI return and a pre-baked Others line; `settleHrDesignTotals`
 * drops the return and recomputes Others as Net − named designs.
 */
export const ZOYA_AUGUST_DESIGN_SALES: { design: string; netSales: number }[] = [
  { design: "LINKNLOCK", netSales: 2482 },
  { design: HR_LOVE_DESIGN, netSales: 1140 },
  { design: "OROVENTI", netSales: 3243 },
  { design: HR_UV_DESIGN, netSales: 900 },
  { design: "NOVELLO", netSales: 49761 },
  { design: "GOLD JEWL", netSales: 32345 },
  { design: "WATCH", netSales: 12838 },
  { design: "NATURAL", netSales: 5666 },
  { design: "BELLA OVANI", netSales: 3900 },
  { design: "AANIKA.V", netSales: 3418 },
  { design: "QUINCE", netSales: 751 },
  { design: "PLAIN", netSales: 625 },
  { design: "DIANI", netSales: 591 },
  { design: "OVANI", netSales: -448 },
  { design: HR_OTHERS_DESIGN, netSales: 14600 },
];

export const ZOYA_AUGUST_NET_SALES = 131_812;
export const ZOYA_STORE_POS_CODE = "VJ-VAL";
export const ZOYA_STORE_SALES_TARGET = 311_349;

export function isAugustCommissionWindow(from: string, to: string): boolean {
  return from <= AUGUST_COMMISSION_TO && to >= AUGUST_COMMISSION_FROM;
}

export function isFullAugustWindow(from: string, to: string): boolean {
  return from === AUGUST_COMMISSION_FROM && to === AUGUST_COMMISSION_TO;
}

/** Nice dummy goal above actual so the associate does not hit it. */
export function dummyGoalAboveActual(actual: number): number {
  if (!(actual > 0)) return 5_000;
  const lifted = actual * 1.12;
  const rounded = Math.ceil(lifted / 1_000) * 1_000;
  return Math.max(rounded, Math.ceil(actual) + 1_000);
}
