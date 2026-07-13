import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refreshSalesData } from "@/lib/sales/refresh/service";

const bodySchema = z.object({
  force: z.boolean().optional(),
  clearMemory: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_BODY", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const result = await refreshSalesData({
    force: parsed.data.force ?? true,
    clearMemory: parsed.data.clearMemory ?? true,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
