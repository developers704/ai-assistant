import fs from "fs";
import path from "path";

/**
 * Runtime override for Meta/Instagram connection.
 * Env vars stay in place; disconnect flips `disabled` so the app stops using them
 * until the user reconnects (without needing a redeploy).
 */

type MetaConnectionState = {
  disabled: boolean;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "meta-connection.json");

let memoryState: MetaConnectionState | null = null;

function readFromDisk(): MetaConnectionState {
  try {
    if (!fs.existsSync(STATE_FILE)) return { disabled: false };
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<MetaConnectionState>;
    return { disabled: Boolean(parsed.disabled) };
  } catch {
    return { disabled: false };
  }
}

function writeToDisk(state: MetaConnectionState) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!state.disabled) {
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

export function isMetaDisconnected(): boolean {
  return getState().disabled;
}

export function disconnectMeta(): void {
  memoryState = { disabled: true };
  writeToDisk(memoryState);
}

export function reconnectMeta(): void {
  memoryState = { disabled: false };
  writeToDisk(memoryState);
}
