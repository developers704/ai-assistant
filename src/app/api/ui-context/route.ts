import { NextRequest, NextResponse } from "next/server";
import { updateUiContext, getUiContext } from "@/lib/store/ui-context";
import { updateWorkingMemory } from "@/lib/memory/store";
import { getState } from "@/lib/store/server-store";

export async function GET() {
  return NextResponse.json({ uiContext: getUiContext() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const patch = body as Record<string, unknown>;
  const uiContext = updateUiContext({
    currentPath: typeof patch.currentPath === "string" ? patch.currentPath : undefined,
    selectedEmailId: typeof patch.selectedEmailId === "string" ? patch.selectedEmailId : undefined,
    selectedMeetingId:
      typeof patch.selectedMeetingId === "string" ? patch.selectedMeetingId : undefined,
    selectedReportId:
      typeof patch.selectedReportId === "string" ? patch.selectedReportId : undefined,
    selectedContactId:
      typeof patch.selectedContactId === "string" ? patch.selectedContactId : undefined,
    lastOpenedPage: typeof patch.lastOpenedPage === "string" ? patch.lastOpenedPage : undefined,
    lastUserIntent: typeof patch.lastUserIntent === "string" ? patch.lastUserIntent : undefined,
  });

  void updateWorkingMemory({
    lastPath: uiContext.currentPath,
    selectedEmailId: uiContext.selectedEmailId,
    selectedMeetingId: uiContext.selectedMeetingId,
    selectedReportId: uiContext.selectedReportId,
    selectedContactId: uiContext.selectedContactId,
    selectedEmailFrom: uiContext.selectedEmailId
      ? getState().emails.find((e) => e.id === uiContext.selectedEmailId)?.from
      : undefined,
    selectedEmailSubject: uiContext.selectedEmailId
      ? getState().emails.find((e) => e.id === uiContext.selectedEmailId)?.subject
      : undefined,
    selectedMeetingTitle: uiContext.selectedMeetingId
      ? getState().events.find((e) => e.id === uiContext.selectedMeetingId)?.title
      : undefined,
  });

  return NextResponse.json({ ok: true, uiContext });
}
