"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import type { AppState, ChatMessage, Reminder, CalendarEvent, Document, ImageAnalysis } from "@/types";

interface AppContextType {
  state: AppState | null;
  loading: boolean;
  refresh: () => Promise<void>;
  sendChat: (message: string) => Promise<ChatMessage | null>;
  clearChat: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<AppState["user"]>) => Promise<void>;
  addReminder: (reminder: Omit<Reminder, "id" | "createdAt" | "completed"> & { completed?: boolean }) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, "id">) => Promise<void>;
  uploadDocument: (file: File) => Promise<Document | null>;
  uploadImage: (file: File) => Promise<ImageAnalysis | null>;
  confirmAction: () => Promise<void>;
  rejectAction: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef<AppState | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const fetchState = useCallback(async (quick = false) => {
    const controller = new AbortController();
    const timeoutMs = quick ? 8000 : 20000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`/api/state${quick ? "?quick=1" : ""}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        return true;
      }
    } catch {
      console.error("Failed to fetch state");
    } finally {
      clearTimeout(timer);
    }
    return false;
  }, []);

  const refresh = useCallback(async () => {
    const hadState = stateRef.current !== null;
    if (!hadState) setLoading(true);

    const quickLoaded = await fetchState(true);
    if (!hadState) setLoading(false);

    if (!quickLoaded && !hadState) {
      await fetchState(false);
      return;
    }

    void fetchState(false);
  }, [fetchState]);

  useEffect(() => {
    const init = async () => {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (nav?.type === "reload" || nav?.type === "navigate") {
        await fetch("/api/chat", { method: "DELETE" });
      }
      await refresh();
    };
    void init();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      await refresh();
      return true;
    }
    return false;
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
  };

  const sendChat = async (message: string): Promise<ChatMessage | null> => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (res.ok) {
      const data = await res.json();
      setState(data.state);
      return data.message;
    }
    return null;
  };

  const clearChat = async () => {
    await fetch("/api/chat", { method: "DELETE" });
    setState((prev) => (prev ? { ...prev, chatHistory: [] } : prev));
  };

  const updateProfile = async (profile: Partial<AppState["user"]>) => {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (res.ok) await refresh();
  };

  const addReminder = async (reminder: Omit<Reminder, "id" | "createdAt" | "completed"> & { completed?: boolean }) => {
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reminder),
    });
    await refresh();
  };

  const toggleReminder = async (id: string) => {
    await fetch(`/api/reminders/${id}`, { method: "PATCH" });
    await refresh();
  };

  const deleteReminder = async (id: string) => {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    await refresh();
  };

  const addEvent = async (event: Omit<CalendarEvent, "id">) => {
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    await refresh();
  };

  const uploadDocument = async (file: File): Promise<Document | null> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      await refresh();
      return data.document;
    }
    return null;
  };

  const uploadImage = async (file: File): Promise<ImageAnalysis | null> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/images", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      await refresh();
      return data.analysis;
    }
    return null;
  };

  const confirmAction = async () => {
    await sendChat("yes, confirm");
  };

  const rejectAction = async () => {
    await sendChat("no, cancel");
  };

  return (
    <AppContext.Provider
      value={{
        state,
        loading,
        refresh,
        sendChat,
        clearChat,
        login,
        logout,
        updateProfile,
        addReminder,
        toggleReminder,
        deleteReminder,
        addEvent,
        uploadDocument,
        uploadImage,
        confirmAction,
        rejectAction,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
