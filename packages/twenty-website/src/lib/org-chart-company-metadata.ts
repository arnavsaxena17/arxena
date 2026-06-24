export type OrgChartCompanyMetadataFields = {
  website?: string;
  locationName?: string;
  industry?: string;
  linkedinUrl?: string;
  profileCount?: number;
};

export const normalizeOptionalCompanyField = (
  value?: string | null,
): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const needsOrgChartCompanyInfoLookup = (
  metadata: Pick<
    OrgChartCompanyMetadataFields,
    'website' | 'linkedinUrl' | 'locationName' | 'industry'
  >,
): boolean =>
  !metadata.website ||
  !metadata.linkedinUrl ||
  !metadata.locationName ||
  !metadata.industry;

export const mergeOrgChartCompanyField = (
  ssrValue?: string,
  fallbackValue?: string,
): string | undefined =>
  normalizeOptionalCompanyField(ssrValue) ??
  normalizeOptionalCompanyField(fallbackValue);

export const extractOrgChartCompanyMetadataFromPayload = (
  rawData: Record<string, unknown> | null,
): OrgChartCompanyMetadataFields => {
  if (!rawData) {
    return {};
  }

  const profileCount =
    typeof rawData.profile_count === 'number'
      ? rawData.profile_count
      : undefined;

  const locationRaw =
    typeof rawData.location_name === 'string'
      ? rawData.location_name
      : undefined;

  const industryRaw =
    typeof rawData.industry === 'string' ? rawData.industry : undefined;

  const websiteRaw =
    typeof rawData.job_company_website === 'string'
      ? rawData.job_company_website
      : typeof rawData.website === 'string'
        ? rawData.website
        : undefined;

  const linkedinRaw =
    typeof rawData.job_company_linkedin_url === 'string'
      ? rawData.job_company_linkedin_url
      : typeof rawData.linkedin_url === 'string'
        ? rawData.linkedin_url
        : undefined;

  return {
    profileCount,
    locationName: normalizeOptionalCompanyField(locationRaw),
    industry: normalizeOptionalCompanyField(industryRaw),
    website: normalizeOptionalCompanyField(websiteRaw),
    linkedinUrl: normalizeOptionalCompanyField(linkedinRaw),
  };
};
