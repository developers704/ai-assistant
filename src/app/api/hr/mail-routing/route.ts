import { NextRequest, NextResponse } from "next/server";
import { requireHrManagement } from "@/lib/auth/hr-guard";
import { validateHrMailRoutingInput } from "@/lib/hr/mail-routing";
import { readHrMailRouting, writeHrMailRouting } from "@/lib/hr/mail-routing-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminOnly() {
  return requireHrManagement();
}

export async function GET() {
  const denied = await adminOnly();
  if (denied) return denied;
  return NextResponse.json(readHrMailRouting());
}

export async function PUT(req: NextRequest) {
  const denied = await adminOnly();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    from?: string;
    to?: string | string[];
  };
  const checked = validateHrMailRoutingInput(body);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }
  return NextResponse.json(writeHrMailRouting(checked.routing));
}
