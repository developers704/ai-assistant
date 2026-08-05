import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import {
  changeUserPassword,
  listPasswordRevealsForKash,
  regenerateUserPassword,
} from "@/lib/auth/password-store";
import { findAuthUser, listAuthUsers } from "@/lib/auth/users";

export const runtime = "nodejs";

/** Kash: list last-issued passwords. Others: 403. */
export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = listPasswordRevealsForKash(session.username);
  if (!rows) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    users: rows,
    directory: listAuthUsers().map((u) => ({
      username: u.username,
      name: u.name,
      role: u.role,
      title: u.title,
    })),
  });
}

/**
 * Body:
 * - action: "change" | "regenerate"
 * - username?: target (default self; Kash may target anyone)
 * - currentPassword?: required for self change
 * - newPassword?: required for change
 */
export async function POST(req: NextRequest) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    username?: string;
    currentPassword?: string;
    newPassword?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = (body.action ?? "").trim().toLowerCase();
  const targetRaw = (body.username ?? session.username).trim();
  const targetUser = findAuthUser(targetRaw);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (action === "change") {
    const result = await changeUserPassword({
      actorUsername: session.username,
      targetUsername: targetUser.username,
      newPassword: body.newPassword ?? "",
      currentPassword: body.currentPassword,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      username: targetUser.username,
      password: result.password,
      message: "Password updated",
    });
  }

  if (action === "regenerate") {
    const result = await regenerateUserPassword({
      actorUsername: session.username,
      targetUsername: targetUser.username,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      username: targetUser.username,
      password: result.password,
      message: "New password generated — copy it now",
    });
  }

  return NextResponse.json(
    { error: 'action must be "change" or "regenerate"' },
    { status: 400 }
  );
}

