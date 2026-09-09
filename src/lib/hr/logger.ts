type HrLogLevel = "info" | "warn" | "error";

const MAX_VALUE_LENGTH = 4000;

function safeValue(value: unknown): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return String(value);
    return json.length > MAX_VALUE_LENGTH ? `${json.slice(0, MAX_VALUE_LENGTH)}…` : JSON.parse(json);
  } catch {
    return String(value);
  }
}

function write(level: HrLogLevel, event: string, data: Record<string, unknown>) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    module: "hr",
    level,
    event,
    ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, safeValue(value)])),
  });
  if (level === "error") console.error(`[HR] ${line}`);
  else if (level === "warn") console.warn(`[HR] ${line}`);
  else console.log(`[HR] ${line}`);
}

export const hrLog = {
  info: (event: string, data: Record<string, unknown> = {}) => write("info", event, data),
  warn: (event: string, data: Record<string, unknown> = {}) => write("warn", event, data),
  error: (event: string, data: Record<string, unknown> = {}) => write("error", event, data),
};

export function routeLog(route: string, operation: string, data: Record<string, unknown> = {}) {
  hrLog.info("route", { route, operation, ...data });
}
