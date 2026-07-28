/** Annualized inventory turn + per-store velocity for vendor models. */

/** Inclusive calendar days between ISO dates (min 1). */
export function inclusivePeriodDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): number {
  if (!startDate || !endDate) return 1;
  const from = startDate.slice(0, 10);
  const to = endDate.slice(0, 10);
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  const days = Math.floor(Math.abs(b - a) / 86_400_000) + 1;
  return Math.max(1, days);
}

export function annualizedUnitsSold(unitsSold: number, periodDays: number): number {
  if (!(unitsSold > 0) || !(periodDays > 0)) return 0;
  return (unitsSold * 365) / periodDays;
}

/** (sold × 365 / days) / on-hand — null when on-hand missing or zero. */
export function inventoryTurn(
  unitsSold: number,
  periodDays: number,
  onHandTotal: number | null | undefined
): number | null {
  if (onHandTotal == null || !(onHandTotal > 0)) return null;
  const annualized = annualizedUnitsSold(unitsSold, periodDays);
  if (!(annualized > 0)) return 0;
  return annualized / onHandTotal;
}

/** (sold × 365 / days) / store count — null when store count missing or zero. */
export function velocityPerStore(
  unitsSold: number,
  periodDays: number,
  storeCount: number | null | undefined
): number | null {
  if (storeCount == null || !(storeCount > 0)) return null;
  const annualized = annualizedUnitsSold(unitsSold, periodDays);
  if (!(annualized > 0)) return 0;
  return annualized / storeCount;
}

export function formatInventoryTurn(turn: number | null | undefined): string {
  if (turn == null || !Number.isFinite(turn)) return "—";
  if (turn >= 100) return `${turn.toFixed(0)}×`;
  if (turn >= 10) return `${turn.toFixed(1)}×`;
  return `${turn.toFixed(2)}×`;
}

export function formatVelocityPerStore(velocity: number | null | undefined): string {
  if (velocity == null || !Number.isFinite(velocity)) return "—";
  if (velocity >= 100) return velocity.toFixed(0);
  if (velocity >= 10) return velocity.toFixed(1);
  return velocity.toFixed(2);
}
