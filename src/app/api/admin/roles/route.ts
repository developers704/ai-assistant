import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/auth/session";
import {
  AUTH_ROLE_DESCRIPTION,
  AUTH_ROLE_LABEL,
  AUTH_ROLES,
  type AuthRole,
} from "@/lib/auth/users";
import {
  USER_PERMISSION_SECTIONS,
  canManageUsersByRole,
  type UserPermissionKey,
  type UserPermissionMap,
} from "@/lib/auth/user-permissions";
import { getPermissionMapForUser, syncPermissionsCookie } from "@/lib/auth/user-permissions-store";
import {
  getPermissionMapForRole,
  setPermissionMapForRole,
} from "@/lib/auth/role-permissions-store";

export const runtime = "nodejs";

async function requireManager() {
  const session = await readSessionFromCookies();
  if (!session || !canManageUsersByRole(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (!getPermissionMapForUser(session.username, session.role).user_admin && session.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { error: null };
}

export async function GET() {
  const { error } = await requireManager();
  if (error) return error;
  const roles = AUTH_ROLES.map((id) => ({
    id,
    label: AUTH_ROLE_LABEL[id],
    description: AUTH_ROLE_DESCRIPTION[id],
    permissions: getPermissionMapForRole(id),
  }));
  const res = NextResponse.json({
    roles,
    sections: USER_PERMISSION_SECTIONS,
  });
  syncPermissionsCookie(res);
  return res;
}

export async function PUT(req: NextRequest) {
  const { error } = await requireManager();
  if (error) return error;
  let body: { role?: string; permissions?: Partial<UserPermissionMap> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const role = body.role as AuthRole;
  if (!AUTH_ROLES.includes(role)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  if (role === "admin") {
    return NextResponse.json(
      { error: "Admin permissions are always full access" },
      { status: 400 }
    );
  }
  const allowed = new Set(USER_PERMISSION_SECTIONS.map((s) => s.key));
  const clean: Partial<UserPermissionMap> = {};
  for (const [k, v] of Object.entries(body.permissions ?? {})) {
    if (allowed.has(k as UserPermissionKey) && typeof v === "boolean") {
      clean[k as UserPermissionKey] = v;
    }
  }
  const permissions = setPermissionMapForRole(role, clean);
  const res = NextResponse.json({
    role,
    label: AUTH_ROLE_LABEL[role],
    permissions,
  });
  syncPermissionsCookie(res);
  return res;
}
