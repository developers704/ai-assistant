import type { AppState } from "@/types";
import {
  defaultUser,
  mockContacts,
  mockEvents,
  mockReminders,
  mockEmails,
  mockDocuments,
  mockRecentActions,
} from "@/lib/mock-data";

let serverState: AppState = {
  user: defaultUser,
  isAuthenticated: false,
  reminders: [...mockReminders],
  events: [...mockEvents],
  emails: [...mockEmails],
  contacts: [...mockContacts],
  documents: [...mockDocuments],
  whatsappMessages: [],
  callLogs: [],
  pendingActions: [],
  chatHistory: [],
  recentActions: [...mockRecentActions],
  imageAnalyses: [],
  uiContext: {
    currentPath: "/chat",
    updatedAt: new Date().toISOString(),
  },
};

export function getState(): AppState {
  return serverState;
}

export function setState(updater: (state: AppState) => AppState): AppState {
  serverState = updater(serverState);
  return serverState;
}

export function resetState(): void {
  serverState = {
    user: defaultUser,
    isAuthenticated: false,
    reminders: [...mockReminders],
    events: [...mockEvents],
    emails: [...mockEmails],
    contacts: [...mockContacts],
    documents: [...mockDocuments],
    whatsappMessages: [],
    callLogs: [],
    pendingActions: [],
    chatHistory: [],
    recentActions: [...mockRecentActions],
    imageAnalyses: [],
    uiContext: {
      currentPath: "/chat",
      updatedAt: new Date().toISOString(),
    },
  };
}

export function login(_email: string, _password: string): boolean {
  // Real auth is cookie-based via /api/auth/login — keep stub for legacy callers.
  return false;
}

export function logout(): void {
  serverState = { ...serverState, isAuthenticated: false, user: null };
}

export function clearChatHistory(): void {
  serverState = { ...serverState, chatHistory: [] };
}
