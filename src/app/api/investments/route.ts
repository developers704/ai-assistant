import { NextResponse } from "next/server";
import { fetchInvestmentSummary } from "@/lib/plaid/investments";
import { isPlaidConnected } from "@/lib/plaid/token-store";
import { isPlaidConfigured } from "@/lib/plaid/config";

export async function GET() {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured.", configured: false },
      { status: 503 }
    );
  }

  if (!isPlaidConnected()) {
    return NextResponse.json(
      { error: "No investment account connected.", connected: false },
      { status: 404 }
    );
  }

  try {
    const summary = await fetchInvestmentSummary();
    if (!summary) {
      return NextResponse.json({ error: "Could not fetch holdings." }, { status: 500 });
    }
    return NextResponse.json({ connected: true, ...summary });
  } catch (err) {
    console.error("Investments fetch failed:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch investments";
    return NextResponse.json({ error: message, connected: true }, { status: 500 });
  }
}
