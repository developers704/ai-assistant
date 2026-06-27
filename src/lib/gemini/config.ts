export type ImageQuality = "low" | "medium" | "high";

export const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image-preview";

export const GEMINI_IMAGE_MODEL_FALLBACKS = [
  process.env.GEMINI_IMAGE_MODEL,
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!key && !key.includes("REPLACE");
}

export function sizeToAspectRatio(size: string): string {
  switch (size) {
    case "1536x1024":
      return "3:2";
    case "1024x1536":
      return "2:3";
    default:
      return "1:1";
  }
}

/** Gemini imageSize must use uppercase K (1K, 2K, 4K). */
export function resolveImageSize(quality: ImageQuality = "medium"): string {
  const envSize = process.env.GEMINI_IMAGE_SIZE?.toUpperCase();
  if (envSize === "1K" || envSize === "2K" || envSize === "4K") {
    return envSize;
  }
  if (quality === "high") return "2K";
  return "1K";
}
