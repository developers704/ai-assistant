"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Button } from "@/components/ui/Button";
import { Link2, Unlink, Loader2 } from "lucide-react";

interface PlaidConnectButtonProps {
  connected: boolean;
  institutionName?: string;
  configured: boolean;
  onConnected: () => void;
}

export function PlaidConnectButton({
  connected,
  institutionName,
  configured,
  onConnected,
}: PlaidConnectButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || connected) return;

    let cancelled = false;

    fetch("/api/auth/plaid/link-token", { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to initialize Plaid");
        if (!cancelled) setLinkToken(data.link_token);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to initialize Plaid");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [configured, connected]);

  const onSuccess = useCallback(
    async (public_token: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token,
            institution_name: metadata.institution?.name,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Connection failed");
        onConnected();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
      } finally {
        setLoading(false);
      }
    },
    [onConnected]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/auth/plaid/disconnect", { method: "POST" });
      setLinkToken(null);
      onConnected();
    } catch {
      setError("Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  if (!configured) {
    return (
      <p className="text-xs text-ink-muted">
        Add PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV to .env.local to enable investments.
      </p>
    );
  }

  if (connected) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-ink-muted flex-1 min-w-[200px]">
            Connected to {institutionName ?? "investment account"}
          </p>
          <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}{" "}
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-accent-rose bg-red-500/10 border border-red-400/25 rounded-lg px-2 py-1.5">
          {error}
        </p>
      )}
      <Button size="sm" onClick={() => open()} disabled={!ready || loading || !linkToken}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}{" "}
        Connect Vanguard
      </Button>
      <p className="text-xs text-ink-muted">
        Sandbox: search for a test bank and use user_good / pass_good. Production: select Vanguard.
      </p>
    </div>
  );
}
