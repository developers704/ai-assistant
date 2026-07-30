import type { AuthRole } from "@/lib/auth/users";

/**
 * UI label is always "Cost" / "Cost Price".
 * Kash (admin) → Inventory Cost.
 * DMs → Wholesale Cost, falling back to Inventory Cost when wholesale is blank/0.
 */
export function costPriceForRole(
  row: { inventoryCost?: number | null; wholesaleCost?: number | null },
  role: AuthRole | null | undefined
): number {
  const inventory = Number(row.inventoryCost) || 0;
  if (role !== "dm") return inventory;
  const wholesale = Number(row.wholesaleCost) || 0;
  return wholesale > 0 ? wholesale : inventory;
}

export function sumCostPriceForRole<T extends { inventoryCost?: number | null; wholesaleCost?: number | null }>(
  rows: T[],
  role: AuthRole | null | undefined,
  weight: (row: T) => number = () => 1
): number {
  let sum = 0;
  for (const r of rows) sum += costPriceForRole(r, role) * weight(r);
  return sum;
}
