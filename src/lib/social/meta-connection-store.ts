import fs from "fs";
import path from "path";

/**
 * Runtime Meta/Instagram connection state.
 * - disabled: soft off (Reconnect can restore if env still has keys)
 * - purged: hard remove — credentials must be re-entered; Reconnect will not revive
 *   a previous account from leftover process.env
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

let memoryState: MetaConnectionState | null = null;

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

function getState(): MetaConnectionState {
  if (memoryState) return memoryState;
  memoryState = readFromDisk();
  return memoryState;
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
  memoryState = { disabled: true, purged: getState().purged };
  writeToDisk(memoryState);
}

/**
 * Hard remove — wipe in-process credentials and block reconnect until new
 * META_PAGE_ID / META_IG_BUSINESS_ID / META_TEST_ACCESS_TOKEN are set (and server restarted).
 */
export function purgeMetaConnection(): void {
  clearProcessMetaCredentials();
  memoryState = { disabled: true, purged: true };
  writeToDisk(memoryState);
}

export function reconnectMeta(): void {
  if (getState().purged) {
    return;
  }
  memoryState = { disabled: false, purged: false };
  writeToDisk(memoryState);
}

/** Clear purged flag after operator installs new Valliani credentials. */
export function clearMetaPurgeFlag(): void {
  memoryState = { disabled: false, purged: false };
  writeToDisk(memoryState);
}
