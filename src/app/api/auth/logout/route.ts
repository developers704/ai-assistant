import { NextResponse } from "next/server";
import { logout } from "@/lib/store/server-store";

export async function POST() {
  logout();
  return NextResponse.json({ success: true });
}
