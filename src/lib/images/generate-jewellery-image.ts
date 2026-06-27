import OpenAI from "openai";
import { isGeminiConfigured } from "@/lib/gemini/config";
import { generateGeminiImage } from "@/lib/gemini/image";

const JEWELLERY_PREFIX =
  "Professional high-end jewellery product photography. Studio lighting, sharp focus, fine detail on metal and gemstones, elegant clean background, photorealistic, luxury catalog quality.";

function buildFullPrompt(prompt: string): string {
  return `${JEWELLERY_PREFIX} ${prompt.trim()}.`;
}

async function generateWithOpenAI(fullPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    throw new Error("OpenAI API key is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt: fullPrompt,
    size: "1024x1024",
    quality: "medium",
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI did not return an image.");
  return `data:image/png;base64,${b64}`;
}

export function isImageGenerateRequest(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return (
    /(?:generate|create|make)\s+(?:an?\s+)?(?:image|photo|picture)/i.test(lower) ||
    /(?:generate|create|make)\s+(?:an?\s+)?(?:gold|diamond|silver|platinum)?\s*(?:ring|necklace|earring|bracelet|pendant|bangle|jewel)/i.test(
      lower
    ) ||
    /image generation.*(?:generate|create|make)/i.test(lower)
  );
}

export async function generateJewelleryImage(prompt: string): Promise<{
  image: string;
  provider: string;
  model: string;
}> {
  const fullPrompt = buildFullPrompt(prompt);

  if (isGeminiConfigured()) {
    try {
      const { image, model } = await generateGeminiImage(fullPrompt, "1024x1024", "high");
      return { image, provider: "gemini", model };
    } catch (err) {
      console.error("Gemini image generation failed, trying OpenAI fallback:", err);
    }
  }

  const image = await generateWithOpenAI(fullPrompt);
  return { image, provider: "openai", model: "gpt-image-1" };
}
