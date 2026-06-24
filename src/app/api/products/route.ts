import { NextResponse } from "next/server";
import {
  mockProducts,
  mockCustomerReviews,
  brandPillars,
  productCategories,
  houseOfBrands,
  companyHighlights,
  getTrendingProducts,
} from "@/lib/mock-data/products";

export async function GET() {
  return NextResponse.json({
    products: mockProducts,
    trending: getTrendingProducts(),
    categories: productCategories,
    brands: houseOfBrands,
    pillars: brandPillars,
    reviews: mockCustomerReviews,
    highlights: companyHighlights,
  });
}
