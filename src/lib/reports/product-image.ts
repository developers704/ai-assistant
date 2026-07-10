/**
 * Resolve POS "Image Dir." filenames (e.g. `\229149.jpg`) to a browser URL.
 * Set NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL on the VPS `.env`, then rebuild.
 * Example: https://backend.vallianimarketplace.com/uploads/products
 */

export function normalizeImageDirFilename(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  // Keep nested paths when present (e.g. RADO/R12161643-0.jpg)
  if (!/\.(jpe?g|png|webp|gif)$/i.test(cleaned)) return null;
  return cleaned
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

export function getProductImageBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL?.trim().replace(/\/+$/, "") ||
    process.env.PRODUCT_IMAGE_BASE_URL?.trim().replace(/\/+$/, "") ||
    ""
  );
}

export function resolveProductImageUrl(imageDir?: string | null): string | null {
  const filename = normalizeImageDirFilename(imageDir);
  if (!filename) return null;
  const base = getProductImageBaseUrl();
  const encoded = filename
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  if (base) return `${base}/${encoded}`;
  return `/product-images/${encoded}`;
}
