"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MailLoginView } from "@/components/valliani-mail/LoginView";
import { MailShell } from "@/components/valliani-mail/MailShell";
import { hasMailSession, login, logoutMail, me } from "@/lib/valliani-mail/api";
import type { MailAuthUser } from "@/lib/valliani-mail/types";

export default function VallianiMailPage() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<MailAuthUser | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  const restore = useCallback(async () => {
    setBooting(true);
    try {
      if (!hasMailSession()) {
        setUser(null);
        return;
      }
      const current = await me();
      setUser(current);
    } catch {
      await logoutMail();
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  async function handleLogin(email: string, password: string) {
    if (!email || !password) {
      setLoginError("Email and password are required");
      return;
    }
    setLoginBusy(true);
    setLoginError("");
    try {
      const auth = await login({ email, password });
      setUser(auth.user);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoginBusy(false);
    }
  }

  if (booting) {
    return (
      <div className="h-full min-h-[50vh] flex items-center justify-center gap-2 text-sm text-white/45">
        <Loader2 size={18} className="animate-spin" />
        Checking mailbox session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <MailLoginView
          onLogin={handleLogin}
          busy={loginBusy}
          error={loginError}
        />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <MailShell user={user} onLogout={() => setUser(null)} />
    </div>
  );
}
