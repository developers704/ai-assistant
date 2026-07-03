/** Resolve @img1, @img2 … tags in user prompt to numbered reference labels. */
export function resolveImageTags(prompt: string, count: number): string {
  let out = prompt;
  for (let i = 1; i <= count; i++) {
    out = out.replace(new RegExp(`@img${i}\\b`, "gi"), `reference image ${i}`);
  }
  return out;
}

export function buildComposeInstruction(userPrompt: string, referenceCount: number): string {
  const resolved = resolveImageTags(userPrompt.trim(), referenceCount);

  const refLines =
    referenceCount === 1
      ? "You are given 1 reference image above."
      : `You are given ${referenceCount} reference images above, numbered reference image 1 through reference image ${referenceCount}.`;

  return [
    "Task: Create ONE new photorealistic jewelry / product image by combining elements from the reference images according to the instructions below.",
    refLines,
    "Preserve product accuracy — metal color, stone shape, and design details from each reference unless the user asks to change them.",
    "Use professional e-commerce studio lighting, sharp focus, clean composition.",
    "",
    "Instructions:",
    resolved,
  ].join("\n");
}
