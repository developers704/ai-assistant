/**
 * In-memory HR commission prep (2-minute window map). Cleared on attendance
 * upload and warning/write-up changes so commission does not keep test residue.
 */
const clearFns: Array<() => void> = [];

export function registerHrRuntimeCacheClear(fn: () => void) {
  clearFns.push(fn);
}

export function clearHrRuntimeCache() {
  for (const fn of clearFns) fn();
}
