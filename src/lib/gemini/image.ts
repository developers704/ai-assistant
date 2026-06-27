import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_IMAGE_MODEL_FALLBACKS,
  type ImageQuality,
  isGeminiConfigured,
  resolveImageSize,
  sizeToAspectRatio,
} from "@/lib/gemini/config";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenAI({ apiKey });
}

function extractImageDataUrl(response: Awaited<
  ReturnType<GoogleGenAI["models"]["generateContent"]>
>): string | null {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts?.length) return null;

  // Pro models may return draft/thought images — use the last real output.
  let lastImage: string | null = null;
  for (const part of parts) {
    if ((part as { thought?: boolean }).thought) continue;
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? "image/png";
      lastImage = `data:${mime};base64,${part.inlineData.data}`;
    }
  }
  return lastImage;
}

async function generateWithModel(
  model: string,
  contents: string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  aspectRatio: string,
  imageSize: string
): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  });

  const image = extractImageDataUrl(response);
  if (!image) {
    throw new Error("Gemini did not return an image.");
  }
  return image;
}

export async function generateGeminiImage(
  prompt: string,
  size = "1024x1024",
  quality: ImageQuality = "medium"
): Promise<{ image: string; model: string; imageSize: string }> {
  if (!isGeminiConfigured()) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const aspectRatio = sizeToAspectRatio(size);
  const imageSize = resolveImageSize(quality);
  let lastError: unknown;

  for (const model of GEMINI_IMAGE_MODEL_FALLBACKS) {
    try {
      const image = await generateWithModel(model, prompt, aspectRatio, imageSize);
      return { image, model, imageSize };
    } catch (err) {
      lastError = err;
      console.warn(`Gemini image generation failed for model ${model}:`, err);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Unknown error";
  throw new Error(`Gemini image generation failed: ${message}`);
}

export async function editGeminiImage(
  prompt: string,
  imageBuffer: Buffer,
  mimeType: string,
  size = "1024x1024",
  quality: ImageQuality = "medium"
): Promise<{ image: string; model: string; imageSize: string }> {
  if (!isGeminiConfigured()) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const contents = [
    {
      inlineData: {
        mimeType: mimeType || "image/png",
        data: imageBuffer.toString("base64"),
      },
    },
    { text: prompt },
  ];

  const aspectRatio = sizeToAspectRatio(size);
  const imageSize = resolveImageSize(quality);
  let lastError: unknown;

  for (const model of GEMINI_IMAGE_MODEL_FALLBACKS) {
    try {
      const image = await generateWithModel(model, contents, aspectRatio, imageSize);
      return { image, model, imageSize };
    } catch (err) {
      lastError = err;
      console.warn(`Gemini image edit failed for model ${model}:`, err);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Unknown error";
  throw new Error(`Gemini image edit failed: ${message}`);
}
