import fs from "fs";
import path from "path";
import { isLikelyEmail } from "./mail-routing";
import {
  DEFAULT_HR_WARNING_TEMPLATES,
  HR_WARNING_TEMPLATE_KEYS,
  type HrWarningTemplates,
} from "./notice-settings-shared";

export { DEFAULT_HR_WARNING_TEMPLATES, HR_WARNING_TEMPLATE_KEYS } from "./notice-settings-shared";
export type { HrWarningTemplateKey, HrWarningTemplates } from "./notice-settings-shared";

export type HrNoticeSettings = {
  writeUpFrom: string;
  writeUpPasswordConfigured: boolean;
  warningFrom: string;
  templates: HrWarningTemplates;
};

export type StoredHrNoticeSettings = HrNoticeSettings & { writeUpPassword?: string };

const DATA_DIR = path.join(process.cwd(), ".data", "hr");
const STORE_PATH = path.join(DATA_DIR, "notice-settings.json");

function fallbackFrom(): string {
  return process.env.HR_SMTP_FROM?.trim() || process.env.HR_SMTP_USER?.trim() || "";
}

export function defaultHrNoticeSettings(): StoredHrNoticeSettings {
  return {
    writeUpFrom: fallbackFrom(),
    writeUpPasswordConfigured: Boolean(process.env.HR_SMTP_PASS?.trim()),
    warningFrom: fallbackFrom(),
    templates: { ...DEFAULT_HR_WARNING_TEMPLATES },
    writeUpPassword: "",
  };
}

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readHrNoticeSettings(): StoredHrNoticeSettings {
  ensureDir();
  const defaults = defaultHrNoticeSettings();
  if (!fs.existsSync(STORE_PATH)) return defaults;
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Partial<StoredHrNoticeSettings>;
    return {
      ...defaults,
      ...raw,
      writeUpFrom: String(raw.writeUpFrom ?? defaults.writeUpFrom).trim(),
      warningFrom: String(raw.warningFrom ?? defaults.warningFrom).trim(),
      writeUpPassword: String(raw.writeUpPassword ?? ""),
      writeUpPasswordConfigured: Boolean(raw.writeUpPassword || defaults.writeUpPasswordConfigured),
      templates: { ...defaults.templates, ...(raw.templates ?? {}) },
    };
  } catch {
    return defaults;
  }
}

export function publicHrNoticeSettings(settings = readHrNoticeSettings()): HrNoticeSettings {
  const safe = { ...settings };
  delete safe.writeUpPassword;
  return safe;
}

export function validateHrNoticeSettingsInput(input: {
  writeUpFrom?: unknown;
  writeUpPassword?: unknown;
  warningFrom?: unknown;
  templates?: unknown;
}): { ok: true; settings: StoredHrNoticeSettings } | { ok: false; error: string } {
  const current = readHrNoticeSettings();
  const writeUpFrom = String(input.writeUpFrom ?? current.writeUpFrom).trim();
  const warningFrom = String(input.warningFrom ?? current.warningFrom).trim();
  if (!isLikelyEmail(writeUpFrom) || !isLikelyEmail(warningFrom)) {
    return { ok: false, error: "Enter valid write-up and warning sender email addresses" };
  }
  const templates = { ...current.templates };
  if (input.templates && typeof input.templates === "object") {
    for (const key of HR_WARNING_TEMPLATE_KEYS) {
      const value = (input.templates as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) templates[key] = value.trim();
    }
  }
  const password = String(input.writeUpPassword ?? "");
  return {
    ok: true,
    settings: {
      ...current,
      writeUpFrom,
      warningFrom,
      templates,
      writeUpPassword: password || current.writeUpPassword || "",
      writeUpPasswordConfigured: Boolean(password || current.writeUpPassword || process.env.HR_SMTP_PASS?.trim()),
    },
  };
}

export function writeHrNoticeSettings(settings: StoredHrNoticeSettings): HrNoticeSettings {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(settings, null, 2), { encoding: "utf8", mode: 0o600 });
  try { fs.chmodSync(STORE_PATH, 0o600); } catch { /* best effort on non-POSIX filesystems */ }
  return publicHrNoticeSettings(settings);
}

export function hrSmtpPassword(settings = readHrNoticeSettings()): string {
  return settings.writeUpPassword?.trim() || process.env.HR_SMTP_PASS?.trim() || "";
}
