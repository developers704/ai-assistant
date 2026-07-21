import fs from "fs";
import path from "path";

/**
 * Runtime Meta/Instagram connection state (always synced from disk).
 * - disabled: soft off
 * - purged: hard remove — Reconnect must not revive leftover process.env credentials
 */

type MetaConnectionState = {
  disabled: boolean;
  purged: boolean;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "meta-connection.json");

const META_CREDENTIAL_ENV_KEYS = [
  "META_PAGE_ACCESS_TOKEN",
  "META_TEST_ACCESS_TOKEN",
  "META_IG_BUSINESS_ID",
  "META_PAGE_ID",
] as const;

function readFromDisk(): MetaConnectionState {
  try {
    if (!fs.existsSync(STATE_FILE)) return { disabled: false, purged: false };
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<MetaConnectionState>;
    return {
      disabled: Boolean(parsed.disabled),
      purged: Boolean(parsed.purged),
    };
  } catch {
    return { disabled: false, purged: false };
  }
}

function writeToDisk(state: MetaConnectionState) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!state.disabled && !state.purged) {
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
    return;
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

/** Always read disk — never keep a stale in-memory "still connected" flag. */
function getState(): MetaConnectionState {
  return readFromDisk();
}

/** Drop in-process Meta credentials so a running Next server cannot keep serving them. */
export function clearProcessMetaCredentials(): void {
  for (const key of META_CREDENTIAL_ENV_KEYS) {
    delete process.env[key];
  }
}

/** Blank Meta credential lines in .env / .env.local so a restart cannot revive them. */
export function clearMetaCredentialsFromEnvFiles(): void {
  const files = [".env.local", ".env"];
  for (const name of files) {
    const filePath = path.join(process.cwd(), name);
    try {
      if (!fs.existsSync(filePath)) continue;
      const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
      let changed = false;
      const out = lines.map((line) => {
        const eq = line.indexOf("=");
        if (eq < 0) return line;
        const key = line.slice(0, eq).trim();
        if (!(META_CREDENTIAL_ENV_KEYS as readonly string[]).includes(key)) return line;
        if (!line.slice(eq + 1)) return line;
        changed = true;
        return `${key}=`;
      });
      if (changed) fs.writeFileSync(filePath, out.join("\n"), "utf-8");
    } catch {
      // ignore unreadable env files
    }
  }
}

export function isMetaDisconnected(): boolean {
  const s = getState();
  return s.disabled || s.purged;
}

export function isMetaPurged(): boolean {
  return getState().purged;
}

/** Soft disconnect — Reconnect may restore if env keys still exist. */
export function disconnectMeta(): void {
  writeToDisk({ disabled: true, purged: getState().purged });
}

/**
 * Hard remove — wipe in-process credentials and block reconnect until new
 * META_* keys are set for Valliani (and server restarted if env was stale).
 */
export function purgeMetaConnection(): void {
  clearProcessMetaCredentials();
  clearMetaCredentialsFromEnvFiles();
  writeToDisk({ disabled: true, purged: true });
}

export function reconnectMeta(): void {
  if (getState().purged) return;
  writeToDisk({ disabled: false, purged: false });
}

/** Clear purged flag after operator installs new Valliani credentials. */
export function clearMetaPurgeFlag(): void {
  writeToDisk({ disabled: false, purged: false });
}
