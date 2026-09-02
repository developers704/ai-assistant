import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatNoticeDate } from "./warning-notice";

export type WriteUpPdfInput = {
  employeeName: string;
  date: string;
  employeeCode: string | null;
  jobTitle: string | null;
  manager: string | null;
  store: string | null;
  description: string;
  /** Defaults to Written Warning + Tardiness for late attendance write-ups. */
  writtenWarning?: boolean;
  tardiness?: boolean;
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

function toWinAnsi(text: string): string {
  return text.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, (ch) => {
    const map: Record<string, string> = {
      "\u2018": "'",
      "\u2019": "'",
      "\u201c": '"',
      "\u201d": '"',
      "\u2013": "-",
      "\u2014": "-",
      "\u2026": "...",
    };
    return map[ch] ?? "?";
  });
}

function drawCentered(page: PDFPage, text: string, y: number, size: number, font: PDFFont) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (PAGE_W - width) / 2,
    y,
    size,
    font,
    color: BLACK,
  });
}

function drawBar(page: PDFPage, title: string, y: number, font: PDFFont): number {
  const h = 22;
  page.drawRectangle({
    x: MARGIN,
    y: y - 6,
    width: CONTENT_W,
    height: h,
    color: BLACK,
  });
  const size = 11;
  const width = font.widthOfTextAtSize(title, size);
  page.drawText(title, {
    x: (PAGE_W - width) / 2,
    y,
    size,
    font,
    color: WHITE,
  });
  return y - 34;
}

function drawLabeledLine(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  colWidth: number,
  bold: PDFFont,
  regular: PDFFont
) {
  const labelText = `${label}:`;
  const size = 11;
  page.drawText(labelText, { x, y, size, font: bold, color: BLACK });
  const labelW = bold.widthOfTextAtSize(labelText, size);
  const lineStart = x + labelW + 6;
  const lineEnd = x + colWidth - 6;
  page.drawLine({
    start: { x: lineStart, y: y - 2 },
    end: { x: Math.max(lineStart + 20, lineEnd), y: y - 2 },
    thickness: 0.6,
    color: BLACK,
  });
  const filled = toWinAnsi(value || "");
  if (filled) {
    page.drawText(filled, {
      x: lineStart,
      y,
      size,
      font: regular,
      color: BLACK,
      maxWidth: Math.max(20, lineEnd - lineStart),
    });
  }
}

function drawCheckboxAt(
  page: PDFPage,
  checked: boolean,
  label: string,
  x: number,
  y: number,
  font: PDFFont,
  bold: PDFFont,
  otherLine = false
) {
  const box = 11;
  page.drawRectangle({
    x,
    y: y - 1,
    width: box,
    height: box,
    borderColor: BLACK,
    borderWidth: 1,
    color: WHITE,
  });
  if (checked) {
    page.drawText("X", {
      x: x + 2.2,
      y,
      size: 9,
      font: bold,
      color: BLACK,
    });
  }
  page.drawText(label, {
    x: x + 18,
    y,
    size: 11,
    font,
    color: BLACK,
  });
  if (otherLine) {
    const labelW = font.widthOfTextAtSize(label, 11);
    const lineStart = x + 18 + labelW + 6;
    page.drawLine({
      start: { x: lineStart, y: y - 1 },
      end: { x: lineStart + 90, y: y - 1 },
      thickness: 0.6,
      color: BLACK,
    });
  }
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = toWinAnsi(text).replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        const trial = chunk + ch;
        if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
          chunk = trial;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      current = chunk;
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function buildWriteUpPdf(input: WriteUpPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);

  const writtenWarning = input.writtenWarning !== false;
  const tardiness = input.tardiness !== false;
  const left = MARGIN + 8;
  const colW = CONTENT_W / 2;
  const right = MARGIN + colW + 8;
  const colInner = colW - 16;

  let y = 730;
  drawCentered(page, "DISCIPLINARY ACTION FORM", y, 18, timesBold);
  y -= 36;

  y = drawBar(page, "Employee Information", y, helvBold);
  drawLabeledLine(page, "Employee Name", input.employeeName, left, y, colInner, helvBold, helv);
  drawLabeledLine(page, "Date", formatNoticeDate(input.date), right, y, colInner, helvBold, helv);
  y -= 22;
  drawLabeledLine(page, "Employee ID", input.employeeCode ?? "", left, y, colInner, helvBold, helv);
  drawLabeledLine(page, "Job Title", input.jobTitle ?? "", right, y, colInner, helvBold, helv);
  y -= 22;
  drawLabeledLine(page, "Manager", input.manager ?? "", left, y, colInner, helvBold, helv);
  drawLabeledLine(page, "Department", input.store ?? "", right, y, colInner, helvBold, helv);
  y -= 32;

  y = drawBar(page, "Disciplinary Action (check all that apply)", y, helvBold);
  drawCheckboxAt(page, false, "Verbal Warning", left, y, helv, helvBold);
  drawCheckboxAt(page, false, "Final Warning", right, y, helv, helvBold);
  y -= 20;
  drawCheckboxAt(page, writtenWarning, "Written Warning", left, y, helv, helvBold);
  drawCheckboxAt(page, false, "Suspension", right, y, helv, helvBold);
  y -= 20;
  drawCheckboxAt(page, false, "Other:", left, y, helv, helvBold, true);
  drawCheckboxAt(page, false, "Termination", right, y, helv, helvBold);
  y -= 32;

  y = drawBar(page, "Violation Type (check all that apply)", y, helvBold);
  drawCheckboxAt(page, tardiness, "Tardiness", left, y, helv, helvBold);
  drawCheckboxAt(page, false, "Conduct", right, y, helv, helvBold);
  y -= 20;
  drawCheckboxAt(page, false, "Unexcused Absence", left, y, helv, helvBold);
  drawCheckboxAt(page, false, "Poor Performance", right, y, helv, helvBold);
  y -= 20;
  drawCheckboxAt(page, false, "Other:", left, y, helv, helvBold, true);
  drawCheckboxAt(page, false, "Insubordination", right, y, helv, helvBold);
  y -= 32;

  y = drawBar(page, "Details – Attach Additional Sheets if Necessary", y, helvBold);
  page.drawText("Description:", {
    x: left,
    y,
    size: 11,
    font: helvBold,
    color: BLACK,
  });
  y -= 20;

  const boxTop = y + 12;
  const boxBottom = 72;
  const boxH = Math.max(120, boxTop - boxBottom);
  page.drawRectangle({
    x: MARGIN,
    y: boxBottom,
    width: CONTENT_W,
    height: boxH,
    borderColor: BLACK,
    borderWidth: 0.8,
    color: WHITE,
  });

  const lines = wrapLines(input.description, helv, 11, CONTENT_W - 20);
  let textY = boxTop - 6;
  let current = page;
  for (const line of lines) {
    if (textY < boxBottom + 10) {
      current = doc.addPage([PAGE_W, PAGE_H]);
      textY = PAGE_H - 72;
      current.drawText("Description (continued):", {
        x: left,
        y: textY,
        size: 11,
        font: helvBold,
        color: BLACK,
      });
      textY -= 20;
    }
    if (line) {
      current.drawText(line, {
        x: MARGIN + 10,
        y: textY,
        size: 11,
        font: helv,
        color: BLACK,
      });
    }
    textY -= 15;
  }

  return doc.save();
}
