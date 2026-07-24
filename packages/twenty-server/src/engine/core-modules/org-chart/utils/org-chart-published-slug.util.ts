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

/** S3 folder for durable global /org/{slug} publish manifests. */
export const ORG_CHART_PUBLISHED_S3_FOLDER = 'org-charts/_published';

export const ORG_CHART_PUBLISHED_INDEX_FILENAME = 'index.json';

export const orgPublishedSlugS3Filename = (slug: string): string =>
  `${slug}.json`;

export type OrgPublishedSlugMapping = {
  companyId: string;
  companyName?: string;
  workspaceId: string;
  publishedAt: string;
  expiresAt?: string | null;
};

export type OrgPublishedSlugManifest = OrgPublishedSlugMapping & {
  publishSlug: string;
};

export type OrgPublishedSlugIndex = {
  slugs: string[];
  updatedAt: string;
};
