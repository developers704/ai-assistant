import type { AuthRole } from "@/lib/auth/users";
import { seesWholesaleCostOnly } from "@/lib/auth/user-permissions";

/**
 * UI label is always "Cost" / "Cost Price".
 * Kash (admin) → Inventory Cost.
 * Other DMs → Wholesale Cost, falling back to Inventory Cost when wholesale is blank/0.
 * AJ, Adeel, Shaun, Rozina → Wholesale Cost only (shown as Cost Price). Blank stays 0.
 */
export function costPriceForRole(
  row: { inventoryCost?: number | null; wholesaleCost?: number | null },
  role: AuthRole | null | undefined,
  username?: string | null
): number {
  const inventory = Number(row.inventoryCost) || 0;
  const wholesale = Number(row.wholesaleCost) || 0;
  if (seesWholesaleCostOnly(username)) return wholesale;
  if (role !== "dm" && role !== "employee" && role !== "hr") {
    return inventory;
  }
  return wholesale > 0 ? wholesale : inventory;
}

export function sumCostPriceForRole<T extends { inventoryCost?: number | null; wholesaleCost?: number | null }>(
  rows: T[],
  role: AuthRole | null | undefined,
  weight: (row: T) => number = () => 1,
  username?: string | null
): number {
  let sum = 0;
  for (const r of rows) sum += costPriceForRole(r, role, username) * weight(r);
  return sum;
}
