import { NextResponse } from "next/server";
import { executeConfirmedPending } from "@/lib/tools/registry";
import { clearPendingActions } from "@/lib/actions/confirmation";
import {
  confirmPendingAction,
  rejectPendingAction,
} from "@/lib/actions/action-manager";
import { AlexaFlags } from "@/lib/alexa/flags";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String((body as { action?: string }).action ?? "confirm");

  if (action === "reject") {
    if (AlexaFlags.unifiedConfirmations()) {
      rejectPendingAction("voice-main");
    } else {
      clearPendingActions();
    }
    return NextResponse.json({
      script: "Cancelled.",
      spokenAnswer: "Cancelled.",
    });
  }

  if (AlexaFlags.unifiedConfirmations()) {
    const result = await confirmPendingAction("voice-main");
    if (!result) {
      return NextResponse.json({
        script: "Nothing is waiting for confirmation.",
        spokenAnswer: "Nothing is waiting for confirmation.",
      });
    }
    return NextResponse.json({
      script: result.spokenAnswer ?? "Done.",
      spokenAnswer: result.spokenAnswer,
      navigateTo: result.navigateTo,
    });
  }

  const result = await executeConfirmedPending({ source: "voice" });
  if (!result) {
    return NextResponse.json({
      script: "Nothing is waiting for confirmation.",
      spokenAnswer: "Nothing is waiting for confirmation.",
    });
  }

  return NextResponse.json({
    script: result.spokenAnswer ?? "Done.",
    spokenAnswer: result.spokenAnswer,
    navigateTo: result.navigateTo,
  });
}
