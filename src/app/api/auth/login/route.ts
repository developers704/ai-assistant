import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findAuthUser, getAllowedStoreCodes } from "@/lib/auth/users";
import {
  applySessionCookie,
  createSessionToken,
} from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  let body: { username?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body.username || body.email || "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 }
    );
  }

  const user = findAuthUser(username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken({
    sub: user.username,
    username: user.username,
    name: user.name,
    role: user.role,
    title: user.title,
    storeCodes: getAllowedStoreCodes(user),
  });

  const res = NextResponse.json({
    success: true,
    user: {
      username: user.username,
      name: user.name,
      role: user.role,
      title: user.title,
      storeCodes: getAllowedStoreCodes(user),
    },
  });
  applySessionCookie(res, token);
  return res;
}
