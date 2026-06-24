import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

const SIZES = ["1024x1024", "1536x1024", "1024x1536"] as const;
type Size = (typeof SIZES)[number];

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  let body: { prompt?: string; size?: string; quality?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Please describe the jewellery piece you want to generate." }, { status: 400 });
  }

  const size: Size = SIZES.includes(body.size as Size) ? (body.size as Size) : "1024x1024";
  const quality = body.quality === "high" || body.quality === "low" ? body.quality : "medium";

  // Frame the user's description as a professional jewellery product render.
  const fullPrompt = `Professional high-end jewellery product photography. ${prompt}. Studio lighting, sharp focus, fine detail on metal and gemstones, elegant clean background, photorealistic, luxury catalog quality.`;

  const client = new OpenAI({ apiKey });

  try {
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      size,
      quality: quality as "low" | "medium" | "high",
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "The model did not return an image." }, { status: 502 });
    }
    return NextResponse.json({ image: `data:image/png;base64,${b64}`, prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 502 });
  }
}
