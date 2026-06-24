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
  isAuthenticated: true,
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
    isAuthenticated: true,
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
  };
}

export function login(email: string, password: string): boolean {
  if (email === defaultUser.email && password === "demo123") {
    serverState = { ...serverState, isAuthenticated: true };
    return true;
  }
  return false;
}

export function logout(): void {
  serverState = { ...serverState, isAuthenticated: false };
}
