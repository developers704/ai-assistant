import { SignJWT, jwtVerify } from "jose";
import type { AuthRole } from "@/lib/auth/users";

export const AUTH_COOKIE = "alexa_session";

export type SessionPayload = {
  sub: string;
  username: string;
  name: string;
  role: AuthRole;
  title: string;
  /** null = admin all stores */
  storeCodes: string[] | null;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    return new TextEncoder().encode(
      "dev-only-alexa-auth-secret-change-me"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    username: payload.username,
    name: payload.name,
    role: payload.role,
    title: payload.title,
    storeCodes: payload.storeCodes,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const username = String(payload.username ?? "");
    const role =
      payload.role === "admin" || payload.role === "dm" || payload.role === "hr_access"
        ? payload.role
        : null;
    if (!username || !role || !payload.sub) return null;
    const storeCodes = Array.isArray(payload.storeCodes)
      ? (payload.storeCodes as string[])
      : payload.storeCodes === null
        ? null
        : role === "admin"
          ? null
          : [];
    return {
      sub: String(payload.sub),
      username,
      name: String(payload.name ?? username),
      role,
      title: String(
        payload.title ??
          (role === "admin" ? "Admin" : role === "hr_access" ? "Hr access" : "District Manager")
      ),
      storeCodes,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSec = 60 * 60 * 24 * 14) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
