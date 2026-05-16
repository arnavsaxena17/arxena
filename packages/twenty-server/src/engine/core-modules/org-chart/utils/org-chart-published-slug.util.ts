import { toSlug } from 'twenty-shared';

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

export const buildDefaultPublishSlug = (input: {
  companyName?: string;
  companyId: string;
}): string => {
  const fromName = input.companyName?.trim();
  if (fromName) {
    return toSlug(fromName);
  }

  return toSlug(input.companyId.replace(/_/g, '-'));
};

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

export const orgPublishedSlugCacheKey = (slug: string): string =>
  `org-published:${slug}`;

export const orgPublishedCompanyCacheKey = (companyId: string): string =>
  `org-published-company:${companyId}`;

export type OrgPublishedSlugMapping = {
  companyId: string;
  companyName?: string;
  workspaceId: string;
  publishedAt: string;
};
