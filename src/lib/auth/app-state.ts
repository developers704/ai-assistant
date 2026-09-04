import type { AppState, UserProfile } from "@/types";
import { defaultUser } from "@/lib/mock-data";
import type { SessionPayload } from "@/lib/auth/session-token";
import { findAuthUser } from "@/lib/auth/users";
import { getPermissionMapForUser } from "@/lib/auth/user-permissions-store";

export function appStateForSession(
  base: AppState,
  session: SessionPayload | null
): AppState {
  if (!session) {
    return { ...base, user: null, isAuthenticated: false };
  }

  // Prefer live directory so name/title updates without forcing re-login
  const live = findAuthUser(session.username);
  const isAdmin = (live?.role ?? session.role) === "admin";
  const baseUser = isAdmin ? defaultUser : base.user ?? defaultUser;
  const authRole = live?.role ?? session.role;

  const user: UserProfile = {
    ...baseUser,
    id: session.sub,
    name: live?.name ?? session.name,
    username: session.username,
    email: live?.email || (isAdmin ? defaultUser.email : `${session.username}@valliani.local`),
    role:
      session.username === "rozina"
        ? (live?.title ?? "")
        : (live?.title ?? session.title),
    authRole,
    storeCodes:
      live != null
        ? live.role === "admin"
          ? null
          : live.storeCodes
        : session.storeCodes,
    permissions: getPermissionMapForUser(session.username, authRole),
    preferences: {
      ...(baseUser.preferences ?? defaultUser.preferences),
      voiceEnabled: isAdmin,
    },
  };

  return { ...base, user, isAuthenticated: true };
}
