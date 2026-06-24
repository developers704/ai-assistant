import { NextRequest, NextResponse } from "next/server";
import { CountryCode } from "plaid";
import { getPlaidClient } from "@/lib/plaid/client";
import { isPlaidConfigured } from "@/lib/plaid/config";
import { savePlaidTokens } from "@/lib/plaid/token-store";

export async function POST(req: NextRequest) {
  if (!isPlaidConfigured()) {
    return NextResponse.json({ error: "Plaid is not configured." }, { status: 500 });
  }

  const client = getPlaidClient();
  if (!client) {
    return NextResponse.json({ error: "Plaid client unavailable." }, { status: 500 });
  }

  let public_token: string;
  let institution_name: string | undefined;

  try {
    const body = await req.json();
    public_token = body.public_token;
    institution_name = body.institution_name;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!public_token) {
    return NextResponse.json({ error: "Missing public_token." }, { status: 400 });
  }

  try {
    const exchange = await client.itemPublicTokenExchange({ public_token });

    let resolvedInstitution = institution_name;
    if (!resolvedInstitution) {
      try {
        const item = await client.itemGet({ access_token: exchange.data.access_token });
        if (item.data.item.institution_id) {
          const inst = await client.institutionsGetById({
            institution_id: item.data.item.institution_id,
            country_codes: [CountryCode.Us],
          });
          resolvedInstitution = inst.data.institution.name;
        }
      } catch {
        // institution name is optional
      }
    }

    savePlaidTokens({
      access_token: exchange.data.access_token,
      item_id: exchange.data.item_id,
      institution_name: resolvedInstitution,
      connected_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      institution_name: resolvedInstitution,
    });
  } catch (err) {
    console.error("Plaid token exchange failed:", err);
    const message = err instanceof Error ? err.message : "Failed to exchange token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
