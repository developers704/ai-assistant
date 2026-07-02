import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "@/lib/tools/registry";
import { isVoicePilotConfigured } from "@/lib/voice/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isVoicePilotConfigured()) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
  }

  const body = await req.json();
  const name = String(body.name ?? "");
  const args =
    typeof body.arguments === "string"
      ? (JSON.parse(body.arguments || "{}") as Record<string, unknown>)
      : ((body.arguments ?? {}) as Record<string, unknown>);

  if (!name) {
    return NextResponse.json({ error: "Tool name required" }, { status: 400 });
  }

  try {
    const result = await executeTool(name, args, { source: "voice" });
  return NextResponse.json({
    output: JSON.stringify({
      success: result.ok,
      spokenAnswer: result.spokenAnswer,
      ...result.data,
    }),
    uiAction: result.navigateTo ? { type: "navigate", path: result.navigateTo } : undefined,
  });
  } catch (err) {
    console.error("Voice tool error:", err);
    const message = err instanceof Error ? err.message : "Tool execution failed";
    return NextResponse.json({ output: JSON.stringify({ error: message }) }, { status: 500 });
  }
}
