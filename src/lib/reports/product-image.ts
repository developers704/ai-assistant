/**
 * Resolve POS "Image Dir." filenames (e.g. `\229149.jpg`) to a browser URL.
 * Set NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL to your image host / CDN / share path
 * that serves these files (no trailing slash), e.g. https://cdn.example.com/products
 */

export function normalizeImageDirFilename(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const base = cleaned.split("/").pop()?.trim();
  if (!base || !/\.(jpe?g|png|webp|gif)$/i.test(base)) return null;
  return base;
}

export function resolveProductImageUrl(imageDir?: string | null): string | null {
  const filename = normalizeImageDirFilename(imageDir);
  if (!filename) return null;
  const base =
    process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL?.trim().replace(/\/+$/, "") ||
    process.env.PRODUCT_IMAGE_BASE_URL?.trim().replace(/\/+$/, "") ||
    "";
  // Prefer configured CDN/host; otherwise serve from public/product-images/{file}
  if (base) return `${base}/${encodeURIComponent(filename)}`;
  return `/product-images/${encodeURIComponent(filename)}`;
}
