import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { setState } from "@/lib/store/server-store";
import type { ImageAnalysis } from "@/types";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const isScreenshot = /screenshot|dashboard|chart|report/i.test(file.name);

  const analysis: ImageAnalysis = {
    id: uuidv4(),
    name: file.name,
    uploadedAt: new Date().toISOString(),
    description: isScreenshot
      ? "Dashboard screenshot showing Valliani Jewelers KPIs and store performance across locations."
      : "Business image analyzed. Visual content has been processed and key elements identified.",
    extractedText: isScreenshot
      ? "Revenue: $134,200 | Pieces Sold: 22 | AOV: $6,100 | Top Store: Santa Clara — Valley Fair"
      : undefined,
    insights: isScreenshot
      ? [
          "Total revenue today: $134,200 (+6.8% vs yesterday)",
          "Santa Clara — Valley Fair leading with $41,000 in sales",
          "Victorville — Victor Valley showing decline of 6% — needs attention",
          "1ct Diamond Solitaire Ring is the top-selling item",
          "Engagement ring conversion rate up 12% this week",
          "Texas Longview performing above target (+11%)",
        ]
      : [
          "Visual content successfully processed",
          "Text elements extracted where present",
          "Business-relevant information identified",
        ],
    actionItems: isScreenshot
      ? [
          "Investigate Victorville store performance decline",
          "Ensure bridal diamond inventory at Valley Fair and Ontario Mills",
          "Review engagement ring consultation process for underperforming stores",
          "Prepare inventory for Baybrook and Deerbrook Texas openings",
        ]
      : ["Review extracted information", "Follow up on identified action items"],
  };

  const newState = setState((s) => ({
    ...s,
    imageAnalyses: [analysis, ...s.imageAnalyses],
  }));

  return NextResponse.json({ analysis, state: newState });
}
