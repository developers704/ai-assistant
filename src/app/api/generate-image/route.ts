import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { isGeminiConfigured } from "@/lib/gemini/config";
import { generateGeminiImage } from "@/lib/gemini/image";

export const runtime = "nodejs";
export const maxDuration = 120;

const SIZES = ["1024x1024", "1536x1024", "1024x1536", "1792x1024"] as const;
type Size = (typeof SIZES)[number];

async function generateWithOpenAI(
  fullPrompt: string,
  size: Size,
  quality: "low" | "medium" | "high"
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    throw new Error("OpenAI API key is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt: fullPrompt,
    size,
    quality,
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI did not return an image.");
  }
  return `data:image/png;base64,${b64}`;
}

export async function POST(req: NextRequest) {
  let body: { prompt?: string; size?: string; quality?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "Please describe the jewelry piece you want to generate." },
      { status: 400 }
    );
  }

  const size: Size = SIZES.includes(body.size as Size) ? (body.size as Size) : "1024x1024";
  const quality = body.quality === "high" || body.quality === "low" ? body.quality : "medium";

  const fullPrompt = `Professional high-end jewelry product photography. ${prompt}. Studio lighting, sharp focus, fine detail on metal and gemstones, elegant clean background, photorealistic, luxury catalog quality.`;

  if (isGeminiConfigured()) {
    try {
      const { image, model, imageSize } = await generateGeminiImage(fullPrompt, size, quality);
      return NextResponse.json({ image, prompt, provider: "gemini", model, imageSize });
    } catch (err) {
      console.error("Gemini image generation failed, trying OpenAI fallback:", err);
    }
  }

  try {
    const image = await generateWithOpenAI(fullPrompt, size, quality);
    return NextResponse.json({ image, prompt, provider: "openai", model: "gpt-image-1" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          error:
            "Image generation is not configured. Add GEMINI_API_KEY (recommended) or OPENAI_API_KEY to .env.local and restart the server.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 502 });
  }
}
