import {
    extractLinkedinProfileUrlFromOrgChartCandidateRow,
    extractProfilePictureUrlFromOrgChartCandidateRow,
} from './orgchart-candidate-linkedin-url.util';

/**
 * Python OrgStructure.create_org_charts_json_from_std_people_array (org_chart_list.py)
 * builds a fixed string from each person using explicit x['field'] lookups — every key
 * below must be present. This matches StandardizedOrgChartPerson in orgchart-search.service.ts.
 */
export function normalizePersonForPythonOrgChartBuild(
  partial: Record<string, unknown>,
  context: {
    companyId: string;
    companyName: string;
    defaultCountry?: string;
  },
): Record<string, unknown> {
  const { companyId, companyName, defaultCountry } = context;

  const str = (value: unknown): string => {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  };

  const fullName =
    str(partial.full_name) ||
    str(partial.fullName) ||
    str(partial.name) ||
    [str(partial.first_name), str(partial.last_name)]
      .filter((segment) => segment.trim().length > 0)
      .join(' ');
  const linkedinUrl =
    extractLinkedinProfileUrlFromOrgChartCandidateRow(partial) ||
    str(partial.linkedin_url) ||
    str(partial.std_linkedin_url);
  const id =
    str(partial.id) ||
    str(partial.org_node_id) ||
    `${fullName}|${companyId}`;

  const country =
    str(partial.country) ||
    str(partial.location_country) ||
    (defaultCountry?.trim() ? defaultCountry.trim() : 'global');

  const base: Record<string, unknown> = {
    full_name: fullName,
    job_title: str(partial.job_title),
    job_company_linkedin_url: str(partial.job_company_linkedin_url),
    job_company_id: str(partial.job_company_id) || companyId,
    job_company_name: str(partial.job_company_name) || companyName,
    industry: str(partial.industry),
    country,
    job_company_website: str(partial.job_company_website),
    linkedin_url: linkedinUrl,
    facebook_url: str(partial.facebook_url),
    twitter_url: str(partial.twitter_url),
    gender: str(partial.gender),
    location_country: str(partial.location_country),
    location_region: str(partial.location_region),
    location_locality: str(partial.location_locality),
    location_metro: str(partial.location_metro),
    location_name: str(partial.location_name),
    inferred_salary: str(partial.inferred_salary),
    inferred_years_experience: str(partial.inferred_years_experience),
    emails: str(partial.emails),
    phone_numbers: str(partial.phone_numbers),
    profile_picture_url:
      extractProfilePictureUrlFromOrgChartCandidateRow(partial) ||
      str(partial.profile_picture_url ?? partial.image ?? ''),
    id,
  };

  const extras: Record<string, unknown> = {};
  const unipileExtraKeys = new Set([
    'network_distance',
    'networkDistance',
    'shared_connections_count',
    'sharedConnectionsCount',
    'premium',
    'verified',
    'open_profile',
    'openProfile',
    'followers_count',
    'followersCount',
    'connections_count',
    'connectionsCount',
  ]);
  for (const key of Object.keys(partial)) {
    if (
      key.startsWith('org_') ||
      key === 'source' ||
      key === 'category' ||
      key === 'section' ||
      key === 'report_count' ||
      key === 'profile_url' ||
      unipileExtraKeys.has(key)
    ) {
      extras[key] = partial[key];
    }
  }

  return { ...base, ...extras };
}
