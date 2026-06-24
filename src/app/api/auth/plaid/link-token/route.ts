import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { getPlaidClient } from "@/lib/plaid/client";
import { isPlaidConfigured } from "@/lib/plaid/config";

export async function POST() {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env.local." },
      { status: 500 }
    );
  }

  const client = getPlaidClient();
  if (!client) {
    return NextResponse.json({ error: "Plaid client unavailable." }, { status: 500 });
  }

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: "alex-executive-assistant" },
      client_name: "Alexa",
      products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("Plaid link token create failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create link token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
