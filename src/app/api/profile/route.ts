import { NextRequest, NextResponse } from "next/server";
import { setState } from "@/lib/store/server-store";

export async function PUT(req: NextRequest) {
  const updates = await req.json();
  const newState = setState((s) => ({
    ...s,
    user: s.user ? { ...s.user, ...updates } : null,
  }));
  return NextResponse.json({ state: newState });
}
