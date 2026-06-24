import { NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid/client";
import { clearPlaidTokens, getPlaidTokens } from "@/lib/plaid/token-store";

export async function POST() {
  const tokens = getPlaidTokens();
  const client = getPlaidClient();

  if (tokens?.access_token && client) {
    try {
      await client.itemRemove({ access_token: tokens.access_token });
    } catch (err) {
      console.warn("Plaid item remove failed (clearing local tokens anyway):", err);
    }
  }

  clearPlaidTokens();
  return NextResponse.json({ success: true });
}
