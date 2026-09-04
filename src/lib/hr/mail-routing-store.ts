import fs from "fs";
import path from "path";
import {
  defaultHrMailRouting,
  normalizeHrMailRouting,
  type HrMailRouting,
} from "./mail-routing";

const DATA_DIR = path.join(process.cwd(), ".data", "hr");
const STORE_PATH = path.join(DATA_DIR, "mail-routing.json");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readHrMailRouting(): HrMailRouting {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) return defaultHrMailRouting();
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as {
      from?: string;
      to?: string | string[];
    };
    return normalizeHrMailRouting(parsed);
  } catch {
    return defaultHrMailRouting();
  }
}

export function writeHrMailRouting(routing: HrMailRouting): HrMailRouting {
  ensureDir();
  const next = normalizeHrMailRouting(routing);
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}
