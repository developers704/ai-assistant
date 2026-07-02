import { NextRequest, NextResponse } from "next/server";
import { updatePendingEmailDraft } from "@/lib/actions/confirmation";
import { applyGoogleCacheToState, getEnrichedState, getIntegrationsMeta } from "@/lib/google/sync";

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

  const cached = applyGoogleCacheToState(await getEnrichedState({ quick: true }));
  const meta = getIntegrationsMeta();

  return NextResponse.json({
    pending: updated,
    state: {
      ...cached,
      integrations: {
        ...meta,
        google: cached.integrations?.google ?? meta!.google,
      },
    },
  });
}
