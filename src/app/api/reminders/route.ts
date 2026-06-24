import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getState, setState } from "@/lib/store/server-store";
import type { Reminder } from "@/types";

export async function GET() {
  const state = getState();
  return NextResponse.json({ reminders: state.reminders });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const reminder: Reminder = {
    id: uuidv4(),
    ...body,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  const newState = setState((s) => ({
    ...s,
    reminders: [...s.reminders, reminder],
  }));

  return NextResponse.json({ reminder, state: newState });
}
