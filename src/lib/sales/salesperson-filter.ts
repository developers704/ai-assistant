/** Accept `CODE` or `Name (CODE)`. Safe for client bundles (no fs). */
export function resolveSalespersonFilterCode(value: string): string {
  const raw = value.trim();
  const paren = raw.match(/\(([A-Za-z0-9_.-]+)\)\s*$/);
  if (paren) return paren[1].toUpperCase();
  return raw.toUpperCase();
}

/**
 * Keep dashboard / HR employee selections that still exist.
 * Accepts POS `CODE` or `Name (CODE)` and maps onto available labels.
 */
export function pruneSalespersonSelection(
  selected: string[],
  availableLabels: string[]
): string[] {
  if (!selected.length) return selected;
  if (!availableLabels.length) return selected;
  const availableSet = new Set(availableLabels);
  const byCode = new Map<string, string>();
  for (const label of availableLabels) {
    const code = resolveSalespersonFilterCode(label);
    if (code && !byCode.has(code)) byCode.set(code, label);
  }
  const next: string[] = [];
  const seen = new Set<string>();
  for (const v of selected) {
    const mapped = availableSet.has(v)
      ? v
      : byCode.get(resolveSalespersonFilterCode(v));
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    next.push(mapped);
  }
  if (
    next.length === selected.length &&
    next.every((v, i) => v === selected[i])
  ) {
    return selected;
  }
  return next;
}
