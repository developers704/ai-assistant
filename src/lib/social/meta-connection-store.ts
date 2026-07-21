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
