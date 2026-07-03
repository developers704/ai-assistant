import { NextRequest, NextResponse } from "next/server";
import { isGeminiConfigured } from "@/lib/gemini/config";
import { composeGeminiImage } from "@/lib/gemini/image";

export const runtime = "nodejs";
export const maxDuration = 120;

const SIZES = ["1024x1024", "1536x1024", "1024x1536", "1792x1024"] as const;
type Size = (typeof SIZES)[number];

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_REFS = 8;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export async function POST(req: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      {
        error:
          "Multi-reference compose requires GEMINI_API_KEY in .env.local. Restart the server after adding it.",
      },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const prompt = (form.get("prompt") as string | null)?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "Describe how to combine your reference images (use @img1, @img2, etc.)." },
      { status: 400 }
    );
  }

  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Upload at least one reference image." }, { status: 400 });
  }
  if (files.length > MAX_REFS) {
    return NextResponse.json({ error: `Maximum ${MAX_REFS} reference images.` }, { status: 400 });
  }

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Each image must be under 20MB." }, { status: 400 });
    }
    if (file.type && !ALLOWED.includes(file.type.toLowerCase())) {
      return NextResponse.json({ error: "Use PNG, JPG or WEBP for references." }, { status: 400 });
    }
  }

  const sizeRaw = (form.get("size") as string | null) || "1792x1024";
  const qualityRaw = (form.get("quality") as string | null) || "high";
  const size: Size = SIZES.includes(sizeRaw as Size) ? (sizeRaw as Size) : "1792x1024";
  const quality = qualityRaw === "high" || qualityRaw === "low" ? qualityRaw : "medium";

  try {
    const references = await Promise.all(
      files.map(async (file) => ({
        buffer: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type || "image/png",
      }))
    );

    const { image, model, imageSize } = await composeGeminiImage(prompt, references, size, quality);
    return NextResponse.json({
      image,
      prompt,
      provider: "gemini",
      model,
      imageSize,
      referenceCount: files.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Compose image error:", err);
    return NextResponse.json({ error: `Compose failed: ${message}` }, { status: 502 });
  }
}
