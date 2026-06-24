import fs from "fs";
import path from "path";
import type { Credentials } from "google-auth-library";

export interface StoredGoogleTokens extends Credentials {
  email?: string;
}

const TOKEN_DIR = path.join(process.cwd(), ".data");
const TOKEN_FILE = path.join(TOKEN_DIR, "google-tokens.json");

let memoryTokens: StoredGoogleTokens | null = null;

function readFromDisk(): StoredGoogleTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, "utf-8");
    return JSON.parse(raw) as StoredGoogleTokens;
  } catch {
    return null;
  }
}

function writeToDisk(tokens: StoredGoogleTokens | null) {
  if (!tokens) {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
    return;
  }
  if (!fs.existsSync(TOKEN_DIR)) fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

export function getGoogleTokens(): StoredGoogleTokens | null {
  if (memoryTokens) return memoryTokens;
  memoryTokens = readFromDisk();
  return memoryTokens;
}

export function saveGoogleTokens(tokens: StoredGoogleTokens) {
  memoryTokens = tokens;
  writeToDisk(tokens);
}

export function clearGoogleTokens() {
  memoryTokens = null;
  writeToDisk(null);
}

export function isGoogleConnected(): boolean {
  const tokens = getGoogleTokens();
  return !!(tokens?.refresh_token || tokens?.access_token);
}
