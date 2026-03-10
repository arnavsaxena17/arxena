/**
 * Returns a same-origin proxy URL for external image URLs so the browser
 * can load them without Cross-Origin-Resource-Policy blocking (e.g. LinkedIn).
 * Same-origin or non-http(s) URLs are returned unchanged.
 */
export function getProxiedImageUrl(
  imageUrl: string | null | undefined,
  apiBaseUrl: string,
): string {
  if (!imageUrl || typeof imageUrl !== 'string') return imageUrl ?? '';
  const trimmed = imageUrl.trim();
  if (!trimmed || (!trimmed.startsWith('http:') && !trimmed.startsWith('https:'))) {
    return imageUrl;
  }
  try {
    const imageOrigin = new URL(trimmed).origin;
    const apiOrigin = new URL(apiBaseUrl).origin;
    if (imageOrigin === apiOrigin) return imageUrl;
    const base = apiBaseUrl.replace(/\/$/, '');
    return `${base}/org-chart/image-proxy?url=${encodeURIComponent(trimmed)}`;
  } catch {
    return imageUrl;
  }
}
