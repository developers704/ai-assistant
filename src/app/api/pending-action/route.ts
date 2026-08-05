import { NextRequest, NextResponse } from "next/server";
import {
  clearPendingActions,
  updatePendingEmailDraft,
} from "@/lib/actions/confirmation";
import { getEnrichedState } from "@/lib/google/sync";
import { clientAppState } from "@/lib/auth/client-state";

export async function DELETE() {
  clearPendingActions();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const preview = typeof body.preview === "string" ? body.preview : undefined;
  const subject = typeof body.subject === "string" ? body.subject : undefined;

  if (!preview?.trim() && !subject?.trim()) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = updatePendingEmailDraft({ preview, subject });
  if (!updated) {
    return NextResponse.json({ error: "No email draft to edit" }, { status: 404 });
  }

  const state = await clientAppState(await getEnrichedState({ quick: true }));

  return NextResponse.json({
    pending: updated,
    state,
  });
}
