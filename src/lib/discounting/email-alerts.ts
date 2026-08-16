import fs from "fs";
import path from "path";
import { sendGmailMessage } from "@/lib/google/gmail";
import {
  detectHighDiscounts,
  type HighDiscountHit,
} from "@/lib/discounting/detect-high-discounts";

type AlertRecipient = {
  key: string;
  name: string;
  email: string;
};

const TEST_RECIPIENTS: AlertRecipient[] = [
  {
    key: "aj",
    name: "Akber Jivani (AJ)",
    email: "umairj@valliani.app",
  },
  {
    key: "shaun",
    name: "Shaun McCullough",
    email: "umairjam.arrakconsulting@gmail.com",
  },
];

type SentLog = {
  fingerprints: string[];
};

function sentLogPath(): string {
  return path.join(
    process.cwd(),
    ".data",
    "discounting",
    "email-alerts-sent.json"
  );
}

function loadSentLog(): Set<string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(sentLogPath(), "utf8")) as SentLog;
    return new Set(parsed.fingerprints ?? []);
  } catch {
    return new Set();
  }
}

function saveSentLog(fingerprints: Set<string>): void {
  const file = sentLogPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify({ fingerprints: [...fingerprints].sort() }, null, 2),
    "utf8"
  );
  fs.renameSync(tmp, file);
}

function recipientForHit(hit: HighDiscountHit): AlertRecipient | null {
  const code = hit.approver.code.trim().toUpperCase();
  const name = hit.approver.name.trim().toUpperCase();
  if (code === "AJ" || code.startsWith("AJ-") || name.includes("AKBER JIVANI")) {
    return TEST_RECIPIENTS[0];
  }
  if (
    code === "SM2" ||
    code.startsWith("SM") ||
    code.startsWith("SHAUN") ||
    name.includes("SHAUN MCCULLOUGH")
  ) {
    return TEST_RECIPIENTS[1];
  }
  return null;
}

function fingerprint(date: string, recipient: AlertRecipient, hit: HighDiscountHit): string {
  return [
    date,
    recipient.key,
    hit.transactionId,
    hit.sku,
    hit.overageDollars.toFixed(2),
  ].join("|");
}

function money(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function bodyFor(
  date: string,
  recipient: AlertRecipient,
  hits: HighDiscountHit[]
): string {
  const lines = [
    `Hi ${recipient.name},`,
    "",
    `Valliani Athena found ${hits.length} Discounting overage${hits.length === 1 ? "" : "s"} for ${date}.`,
    "",
  ];

  for (const hit of hits) {
    lines.push(
      [
        `${hit.store} · Txn ${hit.transactionId}`,
        `SKU: ${hit.sku}`,
        `Calc: ${money(hit.soldTotal)}`,
        `Payment Amt (ceiling): ${money(hit.ceilingAmount)}`,
        `Overage: ${money(hit.overageDollars)}`,
        `Pay: ${hit.payCode || hit.payChannelLabel}${hit.financingMonths ? ` · ${hit.financingMonths}/0` : ""}`,
      ].join("\n"),
      ""
    );
  }

  lines.push(
    "This is an automated test alert from Valliani Athena.",
    "Transactions containing a Qty -1 return leg are excluded."
  );
  return lines.join("\n");
}

export type DiscountingEmailResult = {
  date: string | null;
  recipient: string;
  approver: string;
  hitCount: number;
  sent: boolean;
  skippedDuplicate?: boolean;
  error?: string;
  subject?: string;
  body?: string;
};

export async function sendDiscountingEmailAlerts(options?: {
  filterDate?: string | null;
  dryRun?: boolean;
  transactionId?: string | null;
  sku?: string | null;
}): Promise<DiscountingEmailResult[]> {
  const result = detectHighDiscounts({
    filterDate: options?.filterDate ?? null,
  });
  const date = result.filterDate;
  if (!date) return [];

  const grouped = new Map<string, { recipient: AlertRecipient; hits: HighDiscountHit[] }>();
  for (const hit of result.hits) {
    if (
      options?.transactionId &&
      hit.transactionId !== options.transactionId
    ) {
      continue;
    }
    if (options?.sku && hit.sku !== options.sku) continue;
    const recipient = recipientForHit(hit);
    if (!recipient) continue;
    const group = grouped.get(recipient.key) ?? { recipient, hits: [] };
    group.hits.push(hit);
    grouped.set(recipient.key, group);
  }

  const sentLog = loadSentLog();
  const outcomes: DiscountingEmailResult[] = [];

  for (const { recipient, hits } of grouped.values()) {
    const unsent = hits.filter(
      (hit) => !sentLog.has(fingerprint(date, recipient, hit))
    );
    const subject = `[TEST] Discounting overages — ${date} — ${recipient.name}`;

    if (!unsent.length) {
      outcomes.push({
        date,
        recipient: recipient.email,
        approver: recipient.name,
        hitCount: 0,
        sent: false,
        skippedDuplicate: true,
        subject,
      });
      continue;
    }

    const body = bodyFor(date, recipient, unsent);
    if (options?.dryRun) {
      outcomes.push({
        date,
        recipient: recipient.email,
        approver: recipient.name,
        hitCount: unsent.length,
        sent: false,
        subject,
        body,
      });
      continue;
    }

    const sent = await sendGmailMessage({
      to: recipient.email,
      subject,
      body,
    });
    if (sent.ok) {
      for (const hit of unsent) {
        sentLog.add(fingerprint(date, recipient, hit));
      }
      saveSentLog(sentLog);
    }
    outcomes.push({
      date,
      recipient: recipient.email,
      approver: recipient.name,
      hitCount: unsent.length,
      sent: sent.ok,
      error: sent.error,
      subject,
    });
  }

  return outcomes;
}
