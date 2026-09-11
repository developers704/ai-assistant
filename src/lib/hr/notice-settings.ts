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

function fallbackSmtpFrom(): string {
  return process.env.HR_SMTP_FROM?.trim() || process.env.HR_SMTP_USER?.trim() || "";
}

/** Chat sender must be a Valliani chat user — never default to the SMTP mailbox
 *  (that is often the operator who logged into the app / set up mail). */
export function fallbackWarningChatFrom(): string {
  return (
    process.env.HR_WARNING_CHAT_SENDER_EMAIL?.trim() ||
    process.env.HR_WARNING_FROM_EMAIL?.trim() ||
    "raza@valliani.app"
  );
}

/** Prefer configured warningFrom unless it collides with an employee recipient. */
export function resolveWarningChatFrom(
  configured: string,
  recipientEmails: Iterable<string> = []
): string {
  const dedicated = fallbackWarningChatFrom();
  const from = String(configured || "").trim().toLowerCase() || dedicated.toLowerCase();
  const blocked = new Set(
    [...recipientEmails]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => value.includes("@"))
  );
  if (!from.includes("@") || blocked.has(from)) return dedicated;
  return String(configured || dedicated).trim() || dedicated;
}

export function defaultHrNoticeSettings(): StoredHrNoticeSettings {
  return {
    writeUpFrom: fallbackSmtpFrom(),
    writeUpPasswordConfigured: Boolean(process.env.HR_SMTP_PASS?.trim()),
    warningFrom: fallbackWarningChatFrom(),
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
    const writeUpFrom = String(raw.writeUpFrom ?? defaults.writeUpFrom).trim();
    let warningFrom = String(raw.warningFrom ?? defaults.warningFrom).trim() || defaults.warningFrom;
    // Older defaults copied SMTP into warningFrom. If both still match, prefer the
    // dedicated chat sender (raza@ / HR_WARNING_CHAT_SENDER_EMAIL) so app operators
    // are not used as the Valliani chat sender.
    if (
      warningFrom &&
      writeUpFrom &&
      warningFrom.toLowerCase() === writeUpFrom.toLowerCase()
    ) {
      const dedicated = fallbackWarningChatFrom();
      if (dedicated && dedicated.toLowerCase() !== warningFrom.toLowerCase()) {
        warningFrom = dedicated;
      }
    }
    return {
      ...defaults,
      ...raw,
      writeUpFrom,
      warningFrom,
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
