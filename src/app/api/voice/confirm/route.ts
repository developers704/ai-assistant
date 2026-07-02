import { NextResponse } from "next/server";
import { executeConfirmedPending } from "@/lib/tools/registry";
import { clearPendingActions } from "@/lib/actions/confirmation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String((body as { action?: string }).action ?? "confirm");

  if (action === "reject") {
    clearPendingActions();
    return NextResponse.json({
      script: "Cancelled.",
      spokenAnswer: "Cancelled.",
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
