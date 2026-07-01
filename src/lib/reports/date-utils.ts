/** ISO date YYYY-MM-DD → display MM/DD/YY */
export function formatReportDateDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${m}/${d}/${y.slice(-2)}`;
}

export function formatReportDateRange(from: string, to: string): string {
  if (from === to) return formatReportDateDisplay(from);
  return `${formatReportDateDisplay(from)} – ${formatReportDateDisplay(to)}`;
}

/** Parse MM/DD/YY, MM/DD/YYYY, or YYYY-MM-DD to ISO date. */
export function parseReportFilterDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${y}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

export function isValidIsoDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(new Date(`${iso}T12:00:00`).getTime());
}
