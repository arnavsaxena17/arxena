import { toSlug } from '../strings/slug';

export const ORG_PUBLISHED_SLUG_MIN_LENGTH = 2;
export const ORG_PUBLISHED_SLUG_MAX_LENGTH = 64;

export const ORG_PUBLISHED_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ORG_PUBLISHED_RESERVED_SLUGS = new Set([
  'api',
  'autocomplete',
  'companies',
  'company-logo',
  'fullcompany',
  'global',
  'image-proxy',
  'manual',
  'org',
  'org-chart',
  'publish',
  'published',
  'sample-company',
  'share',
]);

const ORG_CHART_TITLE_SUFFIX = /\s*[—–-]\s*org\s*chart\s*$/i;

export const sanitizePublishSlug = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const isValidPublishSlug = (slug: string): boolean =>
  slug.length >= ORG_PUBLISHED_SLUG_MIN_LENGTH &&
  slug.length <= ORG_PUBLISHED_SLUG_MAX_LENGTH &&
  ORG_PUBLISHED_SLUG_PATTERN.test(slug) &&
  !ORG_PUBLISHED_RESERVED_SLUGS.has(slug);

/**
 * Resolves a public /org/{slug} brand URL from company id and optional display name.
 * Strips UI suffixes like "— Org chart" and falls back to company id when name slugs are invalid.
 */
export const resolveBrandPublishSlug = (input: {
  companyId: string;
  companyName?: string;
}): string => {
  const idSlug = sanitizePublishSlug(input.companyId.replace(/_/g, '-'));
  const trimmedName = input.companyName
    ?.trim()
    .replace(ORG_CHART_TITLE_SUFFIX, '')
    .trim();
  const nameSlug = trimmedName ? sanitizePublishSlug(trimmedName) : '';
  const legacyNameSlug = trimmedName
    ? sanitizePublishSlug(toSlug(trimmedName))
    : '';

  const candidates = [nameSlug, legacyNameSlug, idSlug].filter(Boolean);

  for (const candidate of candidates) {
    if (isValidPublishSlug(candidate)) {
      return candidate;
    }
  }

  if (isValidPublishSlug(idSlug)) {
    return idSlug;
  }

  return idSlug.length >= ORG_PUBLISHED_SLUG_MIN_LENGTH
    ? idSlug.slice(0, ORG_PUBLISHED_SLUG_MAX_LENGTH)
    : 'company';
};

export const buildDefaultPublishSlug = (input: {
  companyName?: string;
  companyId: string;
}): string => resolveBrandPublishSlug(input);

export const normalizePublishSlug = (raw: string): string =>
  raw.trim().toLowerCase();

export type PublishSlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; message: string };

export const validatePublishSlug = (raw: string): PublishSlugValidationResult => {
  const slug = normalizePublishSlug(raw);

  if (
    slug.length < ORG_PUBLISHED_SLUG_MIN_LENGTH ||
    slug.length > ORG_PUBLISHED_SLUG_MAX_LENGTH
  ) {
    return { ok: false, message: 'Publish slug must be 2–64 characters' };
  }

  if (!ORG_PUBLISHED_SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      message:
        'Publish slug may only contain lowercase letters, numbers, and hyphens',
    };
  }

  if (ORG_PUBLISHED_RESERVED_SLUGS.has(slug)) {
    return { ok: false, message: 'Publish slug is reserved' };
  }

  return { ok: true, slug };
};
