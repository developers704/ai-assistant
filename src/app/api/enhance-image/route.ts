import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

const SIZES = ["1024x1024", "1536x1024", "1024x1536", "auto"] as const;
type Size = (typeof SIZES)[number];

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload. Please attach an image file." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please upload a jewellery photo to enhance." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large. Please use a file under 20MB." }, { status: 400 });
  }
  if (file.type && !ALLOWED.includes(file.type.toLowerCase())) {
    return NextResponse.json({ error: "Unsupported file type. Use PNG, JPG or WEBP." }, { status: 400 });
  }

  const instructions = (form.get("instructions") as string | null)?.trim() || "";
  const sizeRaw = (form.get("size") as string | null) || "1024x1024";
  const qualityRaw = (form.get("quality") as string | null) || "medium";
  const size: Size = SIZES.includes(sizeRaw as Size) ? (sizeRaw as Size) : "1024x1024";
  const quality = qualityRaw === "high" || qualityRaw === "low" ? qualityRaw : "medium";

  const prompt = [
    "Transform this photo into a premium e-commerce jewellery product image.",
    "Place the piece on a clean, seamless white/neutral studio background with soft, even, professional lighting and gentle reflections.",
    "Remove background clutter, hands, price tags, dust and distractions. Sharpen focus, enhance the metal shine and gemstone sparkle, and keep colours accurate.",
    "IMPORTANT: keep the exact same jewellery piece — same design, metal colour, gemstones, engravings and proportions. Do not invent, add or remove any part of the product.",
    "Output luxury catalog quality suitable for an online store listing.",
    instructions ? `Additional requirements: ${instructions}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const client = new OpenAI({ apiKey });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadable = await toFile(buffer, file.name || "upload.png", {
      type: file.type || "image/png",
    });

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: uploadable,
      prompt,
      size,
      quality: quality as "low" | "medium" | "high",
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "The model did not return an image." }, { status: 502 });
    }
    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Image enhancement failed: ${message}` }, { status: 502 });
  }
}
