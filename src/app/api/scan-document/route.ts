import { NextRequest, NextResponse } from "next/server";
import { scanDocumentImage } from "@/lib/ocr/scan-document";
import type { ScanDocKind } from "@/types/scan";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const KINDS: ScanDocKind[] = ["auto", "id", "receipt"];

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("REPLACE")) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart." },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please attach an image of the ID or receipt." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large. Use a file under 20MB." }, { status: 400 });
  }

  const mime = (file.type || "image/jpeg").toLowerCase();
  if (!ALLOWED.includes(mime)) {
    return NextResponse.json({ error: "Unsupported file type. Use PNG, JPG, or WEBP." }, { status: 400 });
  }

  const kindRaw = (form.get("kind") as string | null) || "auto";
  const kind: ScanDocKind = KINDS.includes(kindRaw as ScanDocKind) ? (kindRaw as ScanDocKind) : "auto";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const result = await scanDocumentImage(base64, mime, kind);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
