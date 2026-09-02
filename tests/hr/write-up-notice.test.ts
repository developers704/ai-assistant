import { inflateSync } from "zlib";
import { describe, expect, it } from "vitest";
import { extractWarningCaseId } from "@/lib/hr/warning-notice";
import { buildWarningNoticePdf } from "@/lib/hr/warning-notice-pdf";
import {
  draftWriteUpNotice,
  requireWriteUpDescription,
  writeUpCaseId,
  writeUpPdfFilename,
} from "@/lib/hr/write-up-notice";
import { buildWriteUpPdf } from "@/lib/hr/write-up-pdf";

const shazia = {
  employeeName: "Ahmed, Shazia",
  date: "2026-06-07",
  employeeCode: "SA2",
  jobTitle: "Corporate Manager",
  manager: "AJ",
  store: "Admin",
  lateMinutes: 29,
};

function pdfHaystack(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const chunks: Buffer[] = [raw];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const latin = raw.toString("latin1");
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin))) {
    try {
      chunks.push(inflateSync(Buffer.from(m[1]!, "latin1")));
    } catch {
      /* not a deflate stream */
    }
  }
  const combined = Buffer.concat(chunks).toString("latin1");
  const decodedHex = combined.replace(/<([0-9A-Fa-f]+)>/g, (_full, hex: string) => {
    try {
      return Buffer.from(hex, "hex").toString("latin1");
    } catch {
      return "";
    }
  });
  return combined + decodedHex;
}

describe("disciplinary write-up", () => {
  it("requires a per-employee description at send time", () => {
    expect(() => requireWriteUpDescription("   ")).toThrow(/description/i);
    expect(() => draftWriteUpNotice(shazia, "")).toThrow(/description/i);
    const draft = draftWriteUpNotice(
      shazia,
      "  Showed up 29 minutes late after traffic.\nPlease be on time.  "
    );
    expect(draft.kind).toBe("writeup");
    expect(draft.description).toBe("Showed up 29 minutes late after traffic.\nPlease be on time.");
    expect(draft.caseId).toBe("HR-WRITEUP-SA2-2026-06-07");
    expect(draft.subject).toBe(
      "[HR-WRITEUP-SA2-2026-06-07] Disciplinary Action Form — Ahmed, Shazia"
    );
    expect(draft.pdfFilename).toBe("Disciplinary-Action-Form-SA2-2026-06-07.pdf");
    expect(draft.text).toContain("attached PDF");
    expect(draft.text).toContain("Showed up 29 minutes late after traffic.");
    expect(draft.text).not.toContain("Type of Offenses");
    expect(draft.html).not.toContain("Type of Offenses");
    expect(draft.html).not.toContain("Employee Warning Notice");
    expect(writeUpCaseId("SA2", "2026-06-07", "Ahmed, Shazia")).toBe(
      "HR-WRITEUP-SA2-2026-06-07"
    );
    expect(writeUpPdfFilename("SA2", "2026-06-07", "Ahmed, Shazia")).toBe(
      "Disciplinary-Action-Form-SA2-2026-06-07.pdf"
    );
    expect(extractWarningCaseId(draft.subject)).toBe("HR-WRITEUP-SA2-2026-06-07");
  });

  it("keeps a different description per employee", () => {
    const a = draftWriteUpNotice(shazia, "Late to the Admin office by 29 minutes.");
    const b = draftWriteUpNotice(
      { ...shazia, employeeName: "Acosta, Jesus A", employeeCode: "JA4", lateMinutes: 32 },
      "Clocked in 32 minutes after scheduled start."
    );
    expect(a.description).not.toBe(b.description);
    expect(a.caseId).not.toBe(b.caseId);
  });

  it("builds the Disciplinary Action Form PDF with the typed description", async () => {
    const custom = "Arrived at 11:29 AM versus an 11:00 AM schedule (29 minutes late).";
    const pdf = await buildWriteUpPdf({
      ...shazia,
      description: custom,
    });
    const { PDFDocument } = await import("pdf-lib");
    expect(Buffer.from(pdf.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPageCount()).toBe(1);
    const hay = pdfHaystack(pdf);
    expect(hay).toContain("DISCIPLINARY ACTION FORM");
    expect(hay).toContain("Written Warning");
    expect(hay).toContain("Tardiness");
    expect(hay).toContain("Employee ID");
    expect(hay).toContain("Department");
    expect(hay).toContain("SA2");
    expect(hay).toContain("AJ");
    expect(hay).toContain("Admin");
    expect(hay).toContain("Corporate Manager");
    expect(hay).toContain(custom);
    expect(hay).not.toContain("Employee Warning Notice");
    expect(hay).not.toContain("Type of Offenses");
  });

  it("allows a write-up for early arrival or a long meal break", () => {
    const early = draftWriteUpNotice(
      { ...shazia, lateMinutes: null, earlyInMinutes: 18 },
      "Clocked in 18 minutes before schedule."
    );
    expect(early.description).toContain("18 minutes");
    const meal = draftWriteUpNotice(
      {
        ...shazia,
        lateMinutes: null,
        shiftTier: "ten",
        mealBreaks: [{ gapMinutes: 82, gapLabel: "1:22" }],
        violations: [
          {
            type: "long_meal",
            message: "Meal break 1:22 exceeds 75 min limit",
            severity: "error",
          },
        ],
      },
      "Took a long meal break of 82 minutes (exceeds 75 min limit)."
    );
    expect(meal.caseId).toBe("HR-WRITEUP-SA2-2026-06-07");
    expect(meal.description).toContain("long meal break of 82 minutes");
  });

  it("does not change the warning notice PDF format", async () => {
    const pdf = await buildWarningNoticePdf(shazia);
    const hay = pdfHaystack(pdf);
    expect(hay).toContain("Employee Warning Notice");
    expect(hay).toContain("Type of Offenses");
    expect(hay).toContain("Late Arrival by 29 minutes.");
    expect(hay).not.toContain("DISCIPLINARY ACTION FORM");
  });
});
