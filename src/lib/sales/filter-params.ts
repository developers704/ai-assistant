/** Parse multi-value sales filter query params (Excel-style multi-select). */

export function parseMultiParam(
  sp: { get: (k: string) => string | null; getAll?: (k: string) => string[] },
  key: string,
  pluralKey?: string
): string[] {
  const raw: string[] = [];
  if (pluralKey && sp.getAll) {
    raw.push(...sp.getAll(pluralKey));
  }
  if (sp.getAll) {
    raw.push(...sp.getAll(key));
  } else {
    const single = sp.get(key);
    if (single) raw.push(single);
    if (pluralKey) {
      const p = sp.get(pluralKey);
      if (p) raw.push(p);
    }
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const chunk of raw) {
    for (const part of chunk.split(",")) {
      const v = part.trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

export function appendMultiParam(
  params: URLSearchParams,
  key: string,
  values: string[]
) {
  if (!values.length) return;
  params.set(key, values.join(","));
}

export function pruneUnavailable(selected: string[], available: string[]): string[] {
  if (!available.length || !selected.length) return selected;
  const set = new Set(available);
  const next = selected.filter((v) => set.has(v));
  if (
    next.length === selected.length &&
    next.every((v, i) => v === selected[i])
  ) {
    return selected;
  }
  return next;
}
