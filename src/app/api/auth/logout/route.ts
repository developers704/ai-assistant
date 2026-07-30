import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { logout as clearServerAuthFlag } from "@/lib/store/server-store";

export async function POST() {
  clearServerAuthFlag();
  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}
