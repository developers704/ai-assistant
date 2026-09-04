/**
 * Timecard payroll names look like "Acosta, Jesus A".
 * August schedule names look like "Acosta Jesus" (no comma, often no middle initial).
 * Match last name + overlapping first-name tokens; do not invent a schedule
 * when last/first disagree (those rows stay "schedule missing").
 */
export function employeeNameTokens(name: string): string[] {
  return name
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 || /^\d+$/.test(t));
}

export function normalizeEmployeeName(name: string): string {
  return employeeNameTokens(name).join(" ");
}

export function namesMatch(a: string, b: string): boolean {
  const ta = employeeNameTokens(a);
  const tb = employeeNameTokens(b);
  if (!ta.length || !tb.length) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  if (ta[0] !== tb[0]) return false;
  const restA = new Set(ta.slice(1));
  const restB = new Set(tb.slice(1));
  if (restA.size === 0 || restB.size === 0) return false;
  const [small, big] = restA.size <= restB.size ? [restA, restB] : [restB, restA];
  for (const token of small) {
    if (!big.has(token)) return false;
  }
  return true;
}
