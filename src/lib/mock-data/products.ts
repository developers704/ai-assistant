import type { Product, CustomerReview, ProductCategory, ProductBrand } from "@/types";

export const brandPillars = ["Value", "Vogue", "Verve", "Variety"] as const;

export const productCategories: { name: ProductCategory; description: string }[] = [
  { name: "Rings", description: "Engagement, bridal, and fashion rings for every occasion" },
  { name: "Bands", description: "Wedding bands and stackable rings" },
  { name: "Earrings", description: "Hoops, studs, and statement earrings" },
  { name: "Necklaces", description: "Pendants, chains, and station necklaces" },
  { name: "Bracelets", description: "Tennis bracelets, chains, and leather styles" },
];

export const houseOfBrands: { name: ProductBrand; tagline: string }[] = [
  { name: "Ovani", tagline: "Lab-grown diamond bridal & fashion" },
  { name: "Bella by Ovani", tagline: "Accessible lab-grown diamond essentials" },
  { name: "Novello", tagline: "Finely cut lab-grown diamonds" },
  { name: "Link N Lock", tagline: "Raw vibes — men's chains & pendants" },
  { name: "Diani Bridal", tagline: "Whispers of Forever" },
  { name: "Aanika V.", tagline: "Yours Purely — gemstone collections" },
  { name: "Ovaris", tagline: "Contemporary diamond fashion" },
];

export const mockProducts: Product[] = [
  // Trending — Ovani lab-grown bridal
  { id: "pr01", name: "Ovani Lab-grown Diamond Pear and Marquise Ring", brand: "Ovani", category: "Rings", price: 2999, caratWeight: "2.67 Ct. T.W.", isNew: true, isTrending: true },
  { id: "pr02", name: "Bella by Ovani Lab-grown Diamond Tennis Bracelet", brand: "Bella by Ovani", category: "Bracelets", price: 3749, caratWeight: "1.5 Ct. T.W.", isTrending: true },
  { id: "pr03", name: "Novello Lab-grown Diamond Flower Marquise Pavé Hoops", brand: "Novello", category: "Earrings", price: 449, caratWeight: "0.50 Ct. T.W.", isTrending: true },
  { id: "pr04", name: "Bella by Ovani Lab-grown Diamond Station Necklace", brand: "Bella by Ovani", category: "Necklaces", price: 1099, isTrending: true },
  { id: "pr05", name: "Bella by Ovani Lab-grown Diamond Evil Eye Pendant", brand: "Bella by Ovani", category: "Necklaces", price: 449, caratWeight: "0.25 Ct. T.W.", isTrending: true },
  { id: "pr06", name: "Ovani Lab-grown Diamond Pear Spiral Wrap Ring", brand: "Ovani", category: "Rings", price: 2629, caratWeight: "2.11 Ct. T.W.", isNew: true, isTrending: true },
  { id: "pr07", name: "Ovani Lab-grown Yellow Diamond Radiant Bridal Ring", brand: "Ovani", category: "Rings", price: 3749, caratWeight: "3.74 Ct. T.W.", isNew: true, isTrending: true },
  { id: "pr08", name: "Ovani Lab-grown Yellow Diamond Pear Bridal Ring", brand: "Ovani", category: "Rings", price: 3749, caratWeight: "3.82 Ct. T.W.", isNew: true, isTrending: true },
  { id: "pr09", name: "Ovani Lab-grown Yellow Diamond Oval Bridal Ring", brand: "Ovani", category: "Rings", price: 5249, caratWeight: "6.58 Ct. T.W.", isNew: true, isTrending: true },
  { id: "pr10", name: "Ovani Lab-grown Pink Diamond Princess Bridal Ring", brand: "Ovani", category: "Rings", price: 4749, caratWeight: "4 Ct. T.W.", isNew: true, isTrending: true },
  { id: "pr11", name: "Ovani Lab-grown Diamond Pear Wave Bridal Set", brand: "Ovani", category: "Rings", price: 3379, caratWeight: "2.57 Ct. T.W.", isNew: true, isTrending: true },
  { id: "pr12", name: "Ovani Lab-grown Yellow Diamond Oval Bridal Ring", brand: "Ovani", category: "Rings", price: 3499, caratWeight: "3.87 Ct. T.W.", isNew: true, isTrending: true },
  // Link N Lock — men's & fashion
  { id: "pr13", name: "Link N Lock Octagon And Textured Rings Pendant with 22.6 inch Round Box Chain", brand: "Link N Lock", category: "Necklaces", price: 79, isTrending: true },
  { id: "pr14", name: "Link N Lock Black Treated Diamond Cuban Men's Ring", brand: "Link N Lock", category: "Rings", price: 369, caratWeight: "0.2 Ct. T.W.", isNew: true, isTrending: true },
  { id: "pr15", name: "Link N Lock Black Acrylic Octagon and Cross Pendant with 24 inch Round Box Chain", brand: "Link N Lock", category: "Necklaces", price: 79, isNew: true },
  { id: "pr16", name: "Link N Lock Black CZ Leather & Stainless Bracelet", brand: "Link N Lock", category: "Bracelets", price: 79 },
  { id: "pr17", name: "Link N Lock Black CZ Stainless Steel Dog Tag Pendant with 24 inch Curb Chain", brand: "Link N Lock", category: "Necklaces", price: 79 },
  // Aanika V. — gemstone collections
  { id: "pr18", name: "Aanika V. Sapphire & Diamond Pear Halo Pendant", brand: "Aanika V.", category: "Necklaces", price: 999, caratWeight: "1.50 Ct. T.W.", isTrending: true },
  { id: "pr19", name: "Aanika V. Sapphire & Diamond Pear Band", brand: "Aanika V.", category: "Bands", price: 729, caratWeight: "2.85 Ct. T.W.", isTrending: true },
  { id: "pr20", name: "Aanika V. Sapphire & Diamond Pear & Marquise Hoops", brand: "Aanika V.", category: "Earrings", price: 699, caratWeight: "1.60 Ct. T.W.", isTrending: true },
  { id: "pr21", name: "Aanika V. Sapphire & Diamond Floral Station Necklace", brand: "Aanika V.", category: "Necklaces", price: 1479, caratWeight: "1.15 Ct. T.W.", isTrending: true },
  { id: "pr22", name: "Aanika V. Ruby & Diamond Floral Station Necklace", brand: "Aanika V.", category: "Necklaces", price: 1449, caratWeight: "1.15 Ct. T.W.", isTrending: true },
  { id: "pr23", name: "Aanika V. Ruby & Diamond Oval Halo Split Shank Ring", brand: "Aanika V.", category: "Rings", price: 1829, isTrending: true },
  { id: "pr24", name: "Aanika V. Ruby & Diamond Pear Halo Pendant", brand: "Aanika V.", category: "Necklaces", price: 679, caratWeight: "1.65 Ct. T.W.", isTrending: true },
  { id: "pr25", name: "Aanika V. Ruby & Diamond Multi Stones Band", brand: "Aanika V.", category: "Bands", price: 929, caratWeight: "1.90 Ct. T.W.", isTrending: true },
  { id: "pr26", name: "Aanika V. Ruby & Diamond Oval Halo Pendant", brand: "Aanika V.", category: "Necklaces", price: 2749, caratWeight: "4.50 Ct. T.W.", isTrending: true },
  { id: "pr27", name: "Aanika V. Emerald & Diamond Floral Station Necklace", brand: "Aanika V.", category: "Necklaces", price: 1479, caratWeight: "1.04 Ct. T.W.", isTrending: true },
];

export const mockCustomerReviews: CustomerReview[] = [
  { id: "rv1", author: "Samantha V.", rating: 5, date: "2025-09-07", title: "Fabulous Jewelry & Service", body: "So fabulous! Jewelry selection is beautiful and payment options are great and realistic. I appreciate the time they took with my husband and I." },
  { id: "rv2", author: "Gina Garcia", rating: 5, date: "2025-09-05", title: "Great Price & Service", body: "Bought my diamond ring in a good price. Ms Carrie helped me pick it up. Friendly staff too." },
  { id: "rv3", author: "Terrence Robinson", rating: 5, date: "2025-09-09", title: "Perfect Engagement Ring", body: "Great place to find a gift for a loved one. Staff is very caring and attentive to their customers. Will definitely purchase there again." },
  { id: "rv4", author: "Karen Guerrero", rating: 5, date: "2025-09-28", title: "Friendly Staff & Great Selection", body: "Great jewelry store with a variety selection of rings. Cecy Hernández was very helpful in showing me different rings. Very happy with my purchase." },
  { id: "rv5", author: "Edgar M.", rating: 5, date: "2025-10-03", title: "Excellent Jewelry Selection", body: "I recommend this service because it is excellent and the quality of the jewelry is superior. They have a lot of variety of high-end watches." },
  { id: "rv6", author: "Jonae J.", rating: 5, date: "2025-10-04", title: "Great Selection & Customer Service", body: "This is my second time purchasing jewelry from here and I love their choices! Brian has great customer service, he is very helpful and nice." },
  { id: "rv7", author: "Huey H.", rating: 5, date: "2025-10-18", title: "Loved My Custom Nose Ring", body: "Got my diamond nose ring custom made here. Jesse and Sunny were great! Beautiful craftsmanship. Highly recommend for any custom works." },
  { id: "rv8", author: "Chau T.", rating: 5, date: "2025-11-26", title: "Wonderful Purchase", body: "Great service and price. These earrings look stunning and I would certainly recommend it." },
  { id: "rv9", author: "Emily R.", rating: 5, date: "2025-12-08", title: "Beautiful and Stunning!", body: "This is the most beautiful piece of jewelry I own. The craftsmanship is impeccable and it sparkles like nothing else. Highly recommend!" },
];

export const companyHighlights = {
  tagline: "Jewelry made for grand celebrations and graceful everyday wear.",
  reviewScore: 4.9,
  reviewCount: 1250,
  shipping: "Free shipping across US",
  returns: "30-day returns (online only)",
  support: "24/7 customer support",
  paymentOptions: ["Affirm", "Acima"],
};

export function getProductById(id: string): Product | undefined {
  return mockProducts.find((p) => p.id === id);
}

export function getTrendingProducts(): Product[] {
  return mockProducts.filter((p) => p.isTrending);
}

export function getProductsByCategory(category: ProductCategory): Product[] {
  return mockProducts.filter((p) => p.category === category);
}

export function getProductsByBrand(brand: ProductBrand): Product[] {
  return mockProducts.filter((p) => p.brand === brand);
}
