import { type UnipileCompanyProfileDto } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';

export type CompanyDetailsRecord = {
  id: string;
  name: string;
  website: string;
  linkedinUrl: string;
  industry: string;
  description: string;
  tagline: string;
  employeeCount: number | null;
  followersCount: number | null;
  publicIdentifier: string;
};

export const emptyCompanyDetails = (): CompanyDetailsRecord => ({
  id: '',
  name: '',
  website: '',
  linkedinUrl: '',
  industry: '',
  description: '',
  tagline: '',
  employeeCount: null,
  followersCount: null,
  publicIdentifier: '',
});

export const mapSearchHitToCompanyDetails = (hit: {
  id?: string;
  name?: string;
  website?: string;
  linkedinUrl?: string;
  industry?: string;
}): CompanyDetailsRecord => ({
  ...emptyCompanyDetails(),
  id: hit.id ?? '',
  name: hit.name ?? '',
  website: hit.website ?? '',
  linkedinUrl: hit.linkedinUrl ?? '',
  industry: hit.industry ?? '',
});

export const mapUnipileCompanyProfileToDetails = (
  profile: UnipileCompanyProfileDto,
  fallback?: Partial<CompanyDetailsRecord>,
): CompanyDetailsRecord => {
  const industry = Array.isArray(profile.industry)
    ? profile.industry.filter(Boolean).join(', ')
    : fallback?.industry ?? '';

  return {
    id: profile.id ?? fallback?.id ?? '',
    name: profile.name ?? fallback?.name ?? '',
    website: profile.website ?? fallback?.website ?? '',
    linkedinUrl: profile.profile_url ?? fallback?.linkedinUrl ?? '',
    industry,
    description: profile.description ?? fallback?.description ?? '',
    tagline: profile.tagline ?? fallback?.tagline ?? '',
    employeeCount:
      typeof profile.employee_count === 'number'
        ? profile.employee_count
        : (fallback?.employeeCount ?? null),
    followersCount:
      typeof profile.followers_count === 'number'
        ? profile.followers_count
        : (fallback?.followersCount ?? null),
    publicIdentifier:
      profile.public_identifier ?? fallback?.publicIdentifier ?? '',
  };
};
