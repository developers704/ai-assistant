import { NextRequest, NextResponse } from "next/server";
import { requireHrNoticeSettings } from "@/lib/auth/hr-guard";
import {
  publicHrNoticeSettings,
  readHrNoticeSettings,
  validateHrNoticeSettingsInput,
  writeHrNoticeSettings,
} from "@/lib/hr/notice-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireHrNoticeSettings();
  if (denied) return denied;
  return NextResponse.json(publicHrNoticeSettings(readHrNoticeSettings()));
}

export async function PUT(req: NextRequest) {
  const denied = await requireHrNoticeSettings();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const checked = validateHrNoticeSettingsInput(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  return NextResponse.json(writeHrNoticeSettings(checked.settings));
}
