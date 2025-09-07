// src/utils/products.js
import { STORE_API_BASE } from "../config";

/**
 * Returns an absolute URL for the product's cover image.
 * Uses primary photo if present, otherwise the first by position.
 * Backend returns photo.url as a relative path like /brands/{b}/products/{p}/photos/{photoId}
 */
export function getCoverPhotoUrl(product) {
  if (!product?.photos?.length) return null;
  const primary = product.photos.find((p) => p.primary);
  const first = primary || product.photos[0];
  if (!first?.url) return null;
  // Ensure absolute URL for the <img src>
  return first.url.startsWith("http")
    ? first.url
    : `${STORE_API_BASE}${first.url}`;
}
