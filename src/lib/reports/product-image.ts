/**
 * Resolve POS "Image Dir." filenames (e.g. `\229149.jpg`) to a browser URL.
 * Set NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL on the VPS `.env`, then rebuild.
 * Example: https://backend.vallianimarketplace.com/uploads/products
 *
 * Marketplace CDN stores WebP; sales CSVs often list .jpg/.png — we prefer .webp.
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

/** Prefer .webp — Valliani marketplace CDN serves WebP for POS Image Dir names. */
export function preferWebpFilename(filename: string): string {
  return filename.replace(/\.(jpe?g|png|gif)$/i, ".webp");
}

export function getProductImageBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL?.trim().replace(/\/+$/, "") ||
    process.env.PRODUCT_IMAGE_BASE_URL?.trim().replace(/\/+$/, "") ||
    ""
  );
}

function encodePath(filename: string): string {
  return filename
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function toUrl(filename: string): string {
  const base = getProductImageBaseUrl();
  const encoded = encodePath(filename);
  if (base) return `${base}/${encoded}`;
  return `/product-images/${encoded}`;
}

export function resolveProductImageUrl(imageDir?: string | null): string | null {
  const filename = normalizeImageDirFilename(imageDir);
  if (!filename) return null;
  return toUrl(preferWebpFilename(filename));
}

/**
 * Candidate URLs to try in the browser (webp first, then original extension).
 * Used when a single URL 404s so thumbs can fall back.
 */
export function resolveProductImageCandidates(imageDir?: string | null): string[] {
  const filename = normalizeImageDirFilename(imageDir);
  if (!filename) return [];
  const webp = preferWebpFilename(filename);
  const urls = [toUrl(webp)];
  if (webp !== filename) urls.push(toUrl(filename));
  return urls;
}
