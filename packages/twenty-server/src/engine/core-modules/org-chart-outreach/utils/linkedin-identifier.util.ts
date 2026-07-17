import { extractLinkedinSlugFromUrl } from 'twenty-shared';

/**
 * Accepts either a LinkedIn public identifier ("varunchojhar"), a provider id,
 * or a full profile URL (any subdomain, e.g. "https://in.linkedin.com/in/varunchojhar")
 * and returns the identifier Unipile expects.
 */
export const normalizeLinkedinIdentifier = (
  raw: string | undefined | null,
): string => {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (!trimmed.includes('linkedin.com')) {
    return trimmed.replace(/^\/+|\/+$/g, '');
  }
  return extractLinkedinSlugFromUrl(trimmed);
};

/**
 * Resolves the canonical profile URL for contact-enrichment providers, which
 * key off the full LinkedIn URL. Full URLs are passed through as-is (stripped
 * of query/hash); identifiers are expanded to www.linkedin.com/in/{id}.
 */
export const resolveLinkedinProfileUrl = (
  raw: string | undefined | null,
): string => {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (trimmed.includes('linkedin.com')) {
    const withoutQuery = trimmed.split(/[?#]/)[0].replace(/\/+$/, '');
    return withoutQuery.includes('://')
      ? withoutQuery
      : `https://${withoutQuery}`;
  }
  const identifier = normalizeLinkedinIdentifier(trimmed);
  return identifier ? `https://www.linkedin.com/in/${identifier}` : '';
};
