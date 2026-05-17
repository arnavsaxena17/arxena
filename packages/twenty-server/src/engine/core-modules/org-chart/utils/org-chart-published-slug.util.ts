export {
    ORG_PUBLISHED_RESERVED_SLUGS,
    ORG_PUBLISHED_SLUG_MAX_LENGTH,
    ORG_PUBLISHED_SLUG_MIN_LENGTH,
    ORG_PUBLISHED_SLUG_PATTERN,
    buildDefaultPublishSlug,
    normalizePublishSlug,
    resolveBrandPublishSlug,
    validatePublishSlug,
    type PublishSlugValidationResult
} from 'twenty-shared';

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
