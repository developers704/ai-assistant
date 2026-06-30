import { NextRequest, NextResponse } from "next/server";

import { fetchMetalPrices } from "@/lib/markets/metalmetric";
import { fetchLiveNews, fetchRssPoliticsNews, fetchRssSportsNews } from "@/lib/news";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const forceNews = req.nextUrl.searchParams.get("refresh") === "1";

  const [metalResult, newsResult, sportsResult, politicsResult] = await Promise.all([
    fetchMetalPrices(),
    fetchLiveNews(forceNews),
    fetchRssSportsNews(forceNews),
    fetchRssPoliticsNews(forceNews),
  ]);

  const gems = [
    {
      name: "Natural Diamond",
      detail: "1.0 ct, round, G/VS1 (indicative)",
      pricePerCarat: 5800,
      live: false,
    },
    {
      name: "Lab-Grown Diamond",
      detail: "1.0 ct, round, G/VS1 (indicative)",
      pricePerCarat: 900,
      live: false,
    },
  ];

  return NextResponse.json({
    updatedAt: metalResult.metalsFetchedAt ?? new Date().toISOString(),
    metalsLive: metalResult.metalsLive,
    metalsSource: metalResult.metalsSource,
    newsLive: newsResult.live,
    newsError: newsResult.error ?? null,
    metals: metalResult.metals,
    gems,
    news: newsResult.news,
    sportsNews: sportsResult.news,
    sportsLive: sportsResult.live,
    sportsError: sportsResult.error ?? null,
    politicsNews: politicsResult.news,
    politicsLive: politicsResult.live,
    politicsError: politicsResult.error ?? null,
  });
}
