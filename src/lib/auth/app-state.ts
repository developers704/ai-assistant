import type { AppState, UserProfile } from "@/types";
import { defaultUser } from "@/lib/mock-data";
import type { SessionPayload } from "@/lib/auth/session-token";

export function appStateForSession(
  base: AppState,
  session: SessionPayload | null
): AppState {
  if (!session) {
    return { ...base, user: null, isAuthenticated: false };
  }

  const isAdmin = session.role === "admin";
  const baseUser = isAdmin ? defaultUser : base.user ?? defaultUser;

  const user: UserProfile = {
    ...baseUser,
    id: session.sub,
    name: session.name,
    email: isAdmin ? defaultUser.email : `${session.username}@valliani.local`,
    role: session.title,
    authRole: session.role,
    storeCodes: session.storeCodes,
    preferences: {
      ...(baseUser.preferences ?? defaultUser.preferences),
      voiceEnabled: isAdmin,
    },
  };

  return { ...base, user, isAuthenticated: true };
}
