import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";

export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      username: session.username,
      name: session.name,
      role: session.role,
      title: session.title,
      storeCodes: session.storeCodes,
    },
  });
}
