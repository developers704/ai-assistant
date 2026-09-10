import { NextResponse } from "next/server";
import {
  canManageDmPermissions,
  USER_PERMISSION_SECTIONS,
  type UserPermissionKey,
  type UserPermissionMap,
} from "@/lib/auth/user-permissions";
import {
  getPermissionMapForUser,
  loadPermissionOverrides,
  setPermissionMapForUser,
  syncPermissionsCookie,
} from "@/lib/auth/user-permissions-store";
import { readSessionFromCookies } from "@/lib/auth/session";
import {
  AUTH_ROLE_LABEL,
  findAuthUser,
  isPermissionMatrixUser,
  listPermissionMatrixUsers,
} from "@/lib/auth/users";

export const runtime = "nodejs";

export async function GET() {
  const session = await readSessionFromCookies();
  if (!session || !canManageDmPermissions(session.username)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = listPermissionMatrixUsers().map((user) => ({
    username: user.username,
    name: user.name,
    role: user.role,
    title: user.title,
    roleLabel: AUTH_ROLE_LABEL[user.role],
    permissions: getPermissionMapForUser(user.username, user.role),
  }));

  const res = NextResponse.json({
    sections: USER_PERMISSION_SECTIONS,
    users,
    overrides: loadPermissionOverrides(),
  });
  syncPermissionsCookie(res);
  return res;
}

export async function PUT(req: Request) {
  const session = await readSessionFromCookies();
  if (!session || !canManageDmPermissions(session.username)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    username?: string;
    permissions?: Partial<UserPermissionMap>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target = findAuthUser(body.username ?? "");
  if (!target || !isPermissionMatrixUser(target)) {
    return NextResponse.json({ error: "Unknown user" }, { status: 400 });
  }

  const permissions = body.permissions ?? {};
  const allowedKeys = new Set(USER_PERMISSION_SECTIONS.map((s) => s.key));
  const clean: Partial<UserPermissionMap> = {};
  for (const [k, v] of Object.entries(permissions)) {
    if (allowedKeys.has(k as UserPermissionKey) && typeof v === "boolean") {
      clean[k as UserPermissionKey] = v;
    }
  }

  const next = setPermissionMapForUser(target.username, clean);
  const res = NextResponse.json({
    username: target.username,
    name: target.name,
    role: target.role,
    permissions: next,
  });
  syncPermissionsCookie(res);
  return res;
}
