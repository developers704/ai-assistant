import { NextRequest, NextResponse } from "next/server";

import { fetchLiveNews, fetchRssPoliticsNews, fetchRssSportsNews } from "@/lib/news";



export const runtime = "nodejs";

export const revalidate = 0;



const TROY_OUNCE_GRAMS = 31.1035;

const KARAT_PURITY: Record<string, number> = {

  "24K": 1,

  "22K": 0.9167,

  "18K": 0.75,

  "14K": 0.5833,

};



interface MetalPrice {

  symbol: string;

  name: string;

  pricePerOunce: number;

  pricePerGram: number;

  live: boolean;

  derived?: { label: string; pricePerGram: number }[];

}



async function fetchSpot(symbol: string): Promise<number | null> {

  try {

    const res = await fetch(`https://api.gold-api.com/price/${symbol}`, {

      cache: "no-store",

      signal: AbortSignal.timeout(8000),

    });

    if (!res.ok) return null;

    const data = await res.json();

    return typeof data.price === "number" ? data.price : null;

  } catch {

    return null;

  }

}



function buildMetal(

  symbol: string,

  name: string,

  liveOunce: number | null,

  fallbackOunce: number,

  withKarats = false

): MetalPrice {

  const live = liveOunce != null;

  const pricePerOunce = liveOunce ?? fallbackOunce;

  const pricePerGram = pricePerOunce / TROY_OUNCE_GRAMS;

  const metal: MetalPrice = {

    symbol,

    name,

    pricePerOunce: Math.round(pricePerOunce * 100) / 100,

    pricePerGram: Math.round(pricePerGram * 100) / 100,

    live,

  };

  if (withKarats) {

    metal.derived = Object.entries(KARAT_PURITY).map(([label, purity]) => ({

      label,

      pricePerGram: Math.round(pricePerGram * purity * 100) / 100,

    }));

  }

  return metal;

}



export async function GET(req: NextRequest) {
  const forceNews = req.nextUrl.searchParams.get("refresh") === "1";

  const [goldOz, silverOz, platinumOz, newsResult, sportsResult, politicsResult] = await Promise.all([
    fetchSpot("XAU"),
    fetchSpot("XAG"),
    fetchSpot("XPT"),
    fetchLiveNews(forceNews),
    fetchRssSportsNews(forceNews),
    fetchRssPoliticsNews(forceNews),
  ]);



  const metals: MetalPrice[] = [

    buildMetal("XAU", "Gold", goldOz, 4332, true),

    buildMetal("XAG", "Silver", silverOz, 70),

    buildMetal("XPT", "Platinum", platinumOz, 1050),

  ];



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



  const anyLive = metals.some((m) => m.live);



  return NextResponse.json({

    updatedAt: new Date().toISOString(),

    metalsLive: anyLive,

    newsLive: newsResult.live,

    newsError: newsResult.error ?? null,

    metals,

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

