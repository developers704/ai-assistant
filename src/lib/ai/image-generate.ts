import type { AIResponse } from "@/types";
import { extractImagePrompt } from "@/lib/voice/intent";
import { generateJewelleryImage } from "@/lib/images/generate-jewellery-image";

function resolvePrompt(message: string): string {
  const extracted = extractImagePrompt(message);
  if (extracted) return extracted;

  const cleaned = message
    .replace(/^(?:please\s+)?(?:generate|create|make)\s+(?:an?\s+)?(?:gold\s+)?(?:ring|image|photo|picture)\s+(?:in\s+image\s+generation\s+)?(?:of\s+)?/i, "")
    .replace(/\s+in\s+image\s+generation\s*$/i, "")
    .trim();

  return cleaned || message.trim();
}

export async function processImageGenerate(message: string): Promise<AIResponse> {
  const prompt = resolvePrompt(message);
  if (!prompt) {
    return {
      intent: "image_generate",
      message:
        "Please describe the jewellery piece you'd like me to generate — for example, *a 22K gold bridal ring with diamonds*.",
      speak: true,
    };
  }

  try {
    const { image, provider, model } = await generateJewelleryImage(prompt);
    return {
      intent: "image_generate",
      message: `Here's your generated jewellery image:\n\n**${prompt}**\n\n_Generated with ${provider} (${model}). You can also refine designs on the Image Generation page._`,
      speak: true,
      data: { generatedImage: image, prompt, provider, model },
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return {
      intent: "image_generate",
      message: `I couldn't generate that image right now. Open **Image Generation** from the sidebar to try again, or check that GEMINI_API_KEY or OPENAI_API_KEY is configured.\n\n_${detail}_`,
      speak: true,
    };
  }
}
