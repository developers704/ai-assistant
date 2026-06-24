import { NextRequest, NextResponse } from "next/server";
import { setState } from "@/lib/store/server-store";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const newState = setState((s) => ({
    ...s,
    reminders: s.reminders.map((r) =>
      r.id === id ? { ...r, completed: !r.completed } : r
    ),
  }));
  return NextResponse.json({ state: newState });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const newState = setState((s) => ({
    ...s,
    reminders: s.reminders.filter((r) => r.id !== id),
  }));
  return NextResponse.json({ state: newState });
}
