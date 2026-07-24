export type OrgChartCompanyAliasGroup = {
  /** Canonical URL slug and primary `job_company_id` for ES/S3. */
  canonicalId: string;
  /** LinkedIn company slug (e.g. vista-rooms). */
  linkedinSlug: string;
  /** Alternate slugs that should resolve to this company. */
  aliases: readonly string[];
  /** Preferred S3 sub-folder under `org-charts/{id}/` (e.g. apify_org_intelligence). */
  preferredS3Variant?: string;
};

/**
 * Curated alias groups for companies whose PDL/LinkedIn slug, website domain slug,
 * and build-time companyId diverge (e.g. StayVista: stay-vista vs vista-rooms).
 */
export const ORG_CHART_COMPANY_ALIAS_GROUPS: readonly OrgChartCompanyAliasGroup[] =
  [
    {
      canonicalId: 'facebook',
      linkedinSlug: 'facebook',
      aliases: ['meta', 'facebook'],
    },
    {
      canonicalId: 'tesla-motors',
      linkedinSlug: 'tesla-motors',
      aliases: ['tesla', 'tesla-motors'],
    },
    {
      canonicalId: 'samsung-electronics',
      linkedinSlug: 'samsung-electronics',
      aliases: ['samsung', 'samsung-electronics'],
    },
    {
      canonicalId: 'vista-rooms',
      linkedinSlug: 'vista-rooms',
      aliases: ['stay-vista', 'vista-rooms', 'stayvista'],
      preferredS3Variant: 'apify_org_intelligence',
    },
  ];

/** Normalize URL slug: lowercase, underscores → hyphens. */
export const normalizeOrgChartCompanySlug = (raw: string): string => {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/_/g, '-');
};

const slugKey = (raw: string): string => normalizeOrgChartCompanySlug(raw);

const buildAliasIndex = (): Map<string, OrgChartCompanyAliasGroup> => {
  const index = new Map<string, OrgChartCompanyAliasGroup>();

  for (const group of ORG_CHART_COMPANY_ALIAS_GROUPS) {
    const keys = new Set<string>([
      slugKey(group.canonicalId),
      slugKey(group.linkedinSlug),
      ...group.aliases.map(slugKey),
    ]);

    for (const key of keys) {
      if (key) {
        index.set(key, group);
      }
    }
  }

  return index;
};

const ALIAS_INDEX = buildAliasIndex();

export const resolveOrgChartCompanyAliasGroup = (
  companyId: string,
): OrgChartCompanyAliasGroup | null => {
  const key = slugKey(companyId);
  if (!key) {
    return null;
  }
  return ALIAS_INDEX.get(key) ?? null;
};

/** Canonical slug for URLs/API, or the normalized input when no alias group exists. */
export const resolveOrgChartCanonicalCompanyId = (companyId: string): string => {
  const group = resolveOrgChartCompanyAliasGroup(companyId);
  if (group) {
    return group.canonicalId;
  }
  return normalizeOrgChartCompanySlug(companyId) || companyId.trim().toLowerCase();
};

/** Company IDs to query (canonical first, then aliases). */
export const collectOrgChartCompanyIdsForLookup = (
  companyId: string,
): string[] => {
  const group = resolveOrgChartCompanyAliasGroup(companyId);
  const normalizedInput = normalizeOrgChartCompanySlug(companyId);

  if (!group) {
    return normalizedInput ? [normalizedInput] : [];
  }

  const ordered = [
    group.canonicalId,
    group.linkedinSlug,
    ...group.aliases,
    normalizedInput,
  ];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of ordered) {
    const key = slugKey(id);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }

  return result;
};

export type OrgChartS3LookupEntry = {
  companyId: string;
  s3Variant?: string;
};

/**
 * Ordered S3 load plan: preferred variant on canonical ID first, then defaults,
 * then alias IDs with the same variant ordering.
 */
export const buildOrgChartS3LookupPlan = (
  companyId: string,
): OrgChartS3LookupEntry[] => {
  const group = resolveOrgChartCompanyAliasGroup(companyId);
  const companyIds = collectOrgChartCompanyIdsForLookup(companyId);

  const variants: (string | undefined)[] = [];
  if (group?.preferredS3Variant?.trim()) {
    variants.push(group.preferredS3Variant.trim());
  }
  variants.push(undefined);

  const plan: OrgChartS3LookupEntry[] = [];
  const seen = new Set<string>();

  for (const id of companyIds) {
    for (const s3Variant of variants) {
      const dedupeKey = `${slugKey(id)}|${s3Variant ?? ''}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      plan.push({
        companyId: id,
        ...(s3Variant ? { s3Variant } : {}),
      });
    }
  }

  return plan;
};

/** True when the URL slug should 308/redirect to the canonical company id. */
export const shouldRedirectOrgChartCompanySlug = (companyId: string): boolean => {
  const normalized = normalizeOrgChartCompanySlug(companyId);
  if (!normalized) {
    return false;
  }
  const canonical = resolveOrgChartCanonicalCompanyId(normalized);
  return slugKey(normalized) !== slugKey(canonical);
};

/**
 * Canonical `/org-chart/{companyId}` path, preserving country/function tail segments.
 * `tailSegments` are passed through as-is (already URL-encoded slugs from the route).
 */
export const buildCanonicalOrgChartPath = (input: {
  companyId: string;
  tailSegments?: string[];
}): string => {
  const canonicalCompanyId = resolveOrgChartCanonicalCompanyId(input.companyId);
  const tail =
    input.tailSegments && input.tailSegments.length > 0
      ? `/${input.tailSegments.join('/')}`
      : '';

  return `/org-chart/${encodeURIComponent(canonicalCompanyId)}${tail}`;
};
