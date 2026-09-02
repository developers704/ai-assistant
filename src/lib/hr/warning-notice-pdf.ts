import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  formatNoticeDate,
  warningDescription,
} from "./warning-notice";

export type WarningPdfInput = {
  employeeName: string;
  date: string;
  employeeCode: string | null;
  jobTitle: string | null;
  manager: string | null;
  lateMinutes: number;
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const GOLD = rgb(0.79, 0.635, 0.15);

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  size: number,
  font: PDFFont,
  color = BLACK
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (PAGE_W - width) / 2,
    y,
    size,
    font,
    color,
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
  const size = 12;
  const width = font.widthOfTextAtSize(title, size);
  page.drawText(title, {
    x: (PAGE_W - width) / 2,
    y: y,
    size,
    font,
    color: WHITE,
  });
  return y - 36;
}

function drawField(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  bold: PDFFont,
  regular: PDFFont
) {
  const labelText = `${label} :-`;
  page.drawText(labelText, { x, y, size: 11, font: bold, color: BLACK });
  const labelW = bold.widthOfTextAtSize(labelText, 11);
  page.drawText(value || "—", {
    x: x + labelW + 8,
    y,
    size: 11,
    font: regular,
    color: BLACK,
    maxWidth: 210,
  });
}

function drawCheckbox(
  page: PDFPage,
  checked: boolean,
  label: string,
  y: number,
  font: PDFFont,
  bold: PDFFont
): number {
  const box = 11;
  page.drawRectangle({
    x: MARGIN + 8,
    y: y - 1,
    width: box,
    height: box,
    borderColor: BLACK,
    borderWidth: 1,
    color: WHITE,
  });
  if (checked) {
    page.drawText("X", {
      x: MARGIN + 10.2,
      y: y,
      size: 9,
      font: bold,
      color: BLACK,
    });
  }
  page.drawText(label, {
    x: MARGIN + 28,
    y: y,
    size: 11,
    font,
    color: BLACK,
  });
  return y - 18;
}

export async function buildWarningNoticePdf(input: WarningPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const description = warningDescription(input.lateMinutes);

  const cx = PAGE_W / 2;
  let y = 730;
  page.drawCircle({ x: cx, y: y + 8, size: 22, color: BLACK });
  page.drawCircle({
    x: cx,
    y: y + 8,
    size: 11,
    borderColor: GOLD,
    borderWidth: 2.5,
    color: BLACK,
  });
  y -= 36;
  drawCentered(page, "VALLIANI JEWELERS", y, 22, timesBold);
  y -= 28;
  drawCentered(page, "Employee Warning Notice", y, 16, helvBold);
  y -= 36;

  y = drawBar(page, "Employee Information", y, helvBold);
  const left = MARGIN + 8;
  const right = MARGIN + CONTENT_W / 2 + 8;
  drawField(page, "Employee Name", input.employeeName, left, y, helvBold, helv);
  drawField(page, "Date", formatNoticeDate(input.date), right, y, helvBold, helv);
  y -= 22;
  drawField(page, "Employee Code", input.employeeCode ?? "", left, y, helvBold, helv);
  drawField(page, "Job Title", input.jobTitle ?? "", right, y, helvBold, helv);
  y -= 22;
  drawField(page, "Manager", input.manager ?? "", left, y, helvBold, helv);
  y -= 32;

  y = drawBar(page, "Type of Offenses", y, helvBold);
  y = drawCheckbox(page, false, "Tardiness/Leaving Early", y, helv, helvBold);
  y = drawCheckbox(page, false, "Absenteeism", y, helv, helvBold);
  y = drawCheckbox(page, true, "Violation of Company Policies", y, helv, helvBold);
  y = drawCheckbox(page, false, "Substandard Work", y, helv, helvBold);
  y = drawCheckbox(page, false, "Violation of Safety Rules", y, helv, helvBold);
  y = drawCheckbox(page, false, "Rudeness to Customers / Co workers", y, helv, helvBold);
  y = drawCheckbox(page, true, "Other :- Schedule Violation", y, helv, helvBold);
  y -= 16;

  y = drawBar(page, "Details", y, helvBold);
  page.drawText("Description of infraction :-", {
    x: MARGIN + 8,
    y,
    size: 11,
    font: helvBold,
    color: BLACK,
  });
  const underlineW = helvBold.widthOfTextAtSize("Description of infraction :-", 11);
  page.drawLine({
    start: { x: MARGIN + 8, y: y - 2 },
    end: { x: MARGIN + 8 + underlineW, y: y - 2 },
    thickness: 0.8,
    color: BLACK,
  });
  y -= 22;
  page.drawText(description, {
    x: MARGIN + 8,
    y,
    size: 12,
    font: helv,
    color: BLACK,
  });

  return doc.save();
}

export function pdfBytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
