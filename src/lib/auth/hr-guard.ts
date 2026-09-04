import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import { getPermissionMapForUser } from "@/lib/auth/user-permissions-store";

/** Attendance / warnings / mail routing — Admin or anyone with HR Management. */
export async function requireHrManagement() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "admin") return null;
  const map = getPermissionMapForUser(session.username, session.role);
  if (!map.hr_management) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
