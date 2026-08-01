import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import { findAuthUser, getAllowedStoreCodes } from "@/lib/auth/users";

export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const live = findAuthUser(session.username);
  return NextResponse.json({
    authenticated: true,
    user: {
      username: session.username,
      name: live?.name ?? session.name,
      role: live?.role ?? session.role,
      title: live?.title ?? session.title,
      storeCodes: live ? getAllowedStoreCodes(live) : session.storeCodes,
    },
  });
}
