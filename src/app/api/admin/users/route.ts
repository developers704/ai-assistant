import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { readSessionFromCookies } from "@/lib/auth/session";
import {
  AUTH_ROLE_LABEL,
  AUTH_ROLES,
  findAuthUser,
  listAuthUsers,
  type AuthRole,
  type AuthUserRecord,
} from "@/lib/auth/users";
import { canManageUsersByRole } from "@/lib/auth/user-permissions";
import { getPermissionMapForUser } from "@/lib/auth/user-permissions-store";
import {
  deleteDirectoryUser,
  isProtectedUsername,
  isValidAuthRole,
  patchDirectoryUser,
  writeDirectoryUser,
} from "@/lib/auth/user-directory-store";
import { listUserStoreOptions } from "@/lib/auth/store-options";
import { setDirectoryPassword } from "@/lib/auth/password-store";

export const runtime = "nodejs";

function publicUser(user: AuthUserRecord) {
  return {
    username: user.username,
    name: user.name,
    email: user.email ?? "",
    role: user.role,
    roleLabel: AUTH_ROLE_LABEL[user.role],
    title: user.title,
    storeCodes: user.storeCodes,
    employeeCode: user.employeeCode ?? "",
    designation: user.designation ?? "",
    protected: isProtectedUsername(user.username),
  };
}

async function requireManager() {
  const session = await readSessionFromCookies();
  if (!session || !canManageUsersByRole(session.role)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (!getPermissionMapForUser(session.username, session.role).user_admin && session.role !== "admin") {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function GET() {
  const { error } = await requireManager();
  if (error) return error;
  const users = listAuthUsers()
    .map(publicUser)
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({
    users,
    roles: AUTH_ROLES.map((r) => ({ id: r, label: AUTH_ROLE_LABEL[r] })),
    storeOptions: listUserStoreOptions(),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireManager();
  if (error || !session) return error;

  let body: {
    username?: string;
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    employeeCode?: string;
    designation?: string;
    storeCodes?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body.username ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim() || username;
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const role = body.role ?? "";
  if (!username) return NextResponse.json({ error: "Username is required" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });
  if (!isValidAuthRole(role)) {
    return NextResponse.json({ error: "Role must be Admin, Employee, HR, or DM" }, { status: 400 });
  }
  if (findAuthUser(username) || findAuthUser(email)) {
    return NextResponse.json({ error: "Username or email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user: AuthUserRecord = {
    username,
    name,
    email,
    passwordHash,
    role: role as AuthRole,
    storeCodes: Array.isArray(body.storeCodes) ? body.storeCodes.filter(Boolean) : [],
    title: AUTH_ROLE_LABEL[role as AuthRole],
    employeeCode: (body.employeeCode ?? "").trim() || null,
    designation: (body.designation ?? "").trim() || null,
  };
  writeDirectoryUser(user);
  await setDirectoryPassword(user.username, password, session.username);
  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireManager();
  if (error || !session) return error;

  let body: {
    username?: string;
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    employeeCode?: string;
    designation?: string;
    storeCodes?: string[];
    title?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = findAuthUser(body.username ?? "");
  if (!current) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (isProtectedUsername(current.username) && body.role && body.role !== "admin") {
    return NextResponse.json({ error: "Kash must remain an admin" }, { status: 400 });
  }

  const role = body.role;
  if (role && !isValidAuthRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const next = patchDirectoryUser(current, {
    name: body.name?.trim() || current.name,
    email: body.email?.trim() ?? current.email,
    role: (role as AuthRole | undefined) ?? current.role,
    title: body.title?.trim() || AUTH_ROLE_LABEL[((role as AuthRole) ?? current.role)],
    employeeCode:
      body.employeeCode !== undefined ? body.employeeCode.trim() || null : current.employeeCode,
    designation:
      body.designation !== undefined ? body.designation.trim() || null : current.designation,
    storeCodes: Array.isArray(body.storeCodes) ? body.storeCodes.filter(Boolean) : current.storeCodes,
  });

  if (body.password?.trim()) {
    await setDirectoryPassword(next.username, body.password.trim(), session.username);
  }

  return NextResponse.json({ user: publicUser(findAuthUser(next.username) ?? next) });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireManager();
  if (error || !session) return error;

  const username = req.nextUrl.searchParams.get("username")?.trim() ?? "";
  if (!username) return NextResponse.json({ error: "Username is required" }, { status: 400 });
  if (normalizeSame(username, session.username)) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }
  if (isProtectedUsername(username)) {
    return NextResponse.json({ error: "This account cannot be deleted" }, { status: 400 });
  }
  const existing = findAuthUser(username);
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });
  deleteDirectoryUser(existing.username);
  return NextResponse.json({ ok: true, username: existing.username });
}

function normalizeSame(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
