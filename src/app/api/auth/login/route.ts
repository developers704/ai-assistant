import { NextRequest, NextResponse } from "next/server";
import { login } from "@/lib/store/server-store";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const success = login(email, password);
  if (success) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
