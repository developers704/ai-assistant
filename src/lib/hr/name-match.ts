export function normalizeEmployeeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeEmployeeName(a) === normalizeEmployeeName(b);
}
