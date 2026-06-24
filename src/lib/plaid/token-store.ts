import fs from "fs";
import path from "path";

export interface StoredPlaidTokens {
  access_token: string;
  item_id: string;
  institution_name?: string;
  connected_at: string;
}

const TOKEN_DIR = path.join(process.cwd(), ".data");
const TOKEN_FILE = path.join(TOKEN_DIR, "plaid-tokens.json");

let memoryTokens: StoredPlaidTokens | null = null;

function readFromDisk(): StoredPlaidTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, "utf-8");
    return JSON.parse(raw) as StoredPlaidTokens;
  } catch {
    return null;
  }
}

function writeToDisk(tokens: StoredPlaidTokens | null) {
  if (!tokens) {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
    return;
  }
  if (!fs.existsSync(TOKEN_DIR)) fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

export function getPlaidTokens(): StoredPlaidTokens | null {
  if (memoryTokens) return memoryTokens;
  memoryTokens = readFromDisk();
  return memoryTokens;
}

export function savePlaidTokens(tokens: StoredPlaidTokens) {
  memoryTokens = tokens;
  writeToDisk(tokens);
}

export function clearPlaidTokens() {
  memoryTokens = null;
  writeToDisk(null);
}

export function isPlaidConnected(): boolean {
  return !!getPlaidTokens()?.access_token;
}
