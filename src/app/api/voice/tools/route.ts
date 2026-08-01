import { NextRequest, NextResponse } from "next/server";
import { executeAppTool } from "@/lib/tools/execute-app-tool";
import { executeTool } from "@/lib/tools/registry";
import { AlexaFlags } from "@/lib/alexa/flags";
import { isVoicePilotConfigured } from "@/lib/voice/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isVoicePilotConfigured()) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
  }

  const body = await req.json();
  const name = String(body.name ?? "");
  const callId = body.call_id ? String(body.call_id) : undefined;
  const args =
    typeof body.arguments === "string"
      ? (JSON.parse(body.arguments || "{}") as Record<string, unknown>)
      : ((body.arguments ?? {}) as Record<string, unknown>);

  if (!name) {
    return NextResponse.json({ error: "Tool name required" }, { status: 400 });
  }

  try {
    if (AlexaFlags.unifiedOrchestrator()) {
      const result = await executeAppTool(name, args, {
        traceId: callId ?? `voice-${Date.now()}`,
        conversationId: "voice-main",
        channel: "voice",
        idempotencyKey: callId ? `voice-call:${callId}` : undefined,
      });
      const data =
        typeof result.data === "object" && result.data
          ? (result.data as Record<string, unknown>)
          : {};
      const compose = data.compose;
      const route = result.uiAction?.route;
      return NextResponse.json({
        output: JSON.stringify({
          success: result.ok,
          spokenAnswer: result.spokenAnswer,
          textAnswer: result.textAnswer,
          ...data,
        }),
        uiAction: route
          ? {
              type: "navigate",
              path: route,
              ...(compose && typeof compose === "object" ? { compose } : {}),
            }
          : undefined,
        alexaResult: result,
      });
    }

    const result = await executeTool(name, args, { source: "voice" });
    const compose = result.data?.compose;
    return NextResponse.json({
      output: JSON.stringify({
        success: result.ok,
        spokenAnswer: result.spokenAnswer,
        ...result.data,
      }),
      uiAction: result.navigateTo
        ? {
            type: "navigate",
            path: result.navigateTo,
            ...(compose && typeof compose === "object" ? { compose } : {}),
          }
        : undefined,
    });
  } catch (err) {
    console.error("Voice tool error:", err);
    const message = err instanceof Error ? err.message : "Tool execution failed";
    return NextResponse.json({ output: JSON.stringify({ error: message }) }, { status: 500 });
  }
}
