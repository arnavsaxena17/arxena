import type { CompanySearchHit } from 'src/engine/core-modules/company-api/company-api.types';
import type { OutreachEphemeralCompany } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import type { OutreachEphemeralPerson } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';

export type BrightDataBusinessSearchEntity = 'company' | 'people';

export type BrightDataBusinessSearchMode = 'smart' | 'instant' | 'ludicrous';

export type BrightDataBusinessSearchView = 'full' | 'summary' | 'id_only';

export type BrightDataBusinessSearchDocument = {
  brightId: string;
  data: Record<string, unknown>;
  // Jev verdict for this row. Omitted when the row was not scored.
  relevant?: boolean;
};

export const BRIGHT_DATA_BUSINESS_SEARCH_MAX_QUERY_LENGTH = 200;

export const BRIGHT_DATA_BUSINESS_SEARCH_PAGE_SIZE: Record<
  BrightDataBusinessSearchMode,
  number
> = {
  smart: 10,
  instant: 100,
  ludicrous: 100,
};

export const BRIGHT_DATA_BUSINESS_SEARCH_MAX_RESULTS: Record<
  BrightDataBusinessSearchMode,
  number
> = {
  // Verified live: smart and instant 500 (backend_search_failed) whenever
  // offset + limit goes past 100. Only ludicrous can page deeper.
  smart: 100,
  instant: 100,
  // offset is capped at 1000 and limit at 100, so a single query tops out here
  ludicrous: 1100,
};

export const normalizeBrightDataBusinessSearchMode = (
  mode?: string,
): BrightDataBusinessSearchMode => {
  const normalized = mode?.trim().toLowerCase();

  if (!normalized || normalized === 'ludicrous') {
    return 'ludicrous';
  }

  if (normalized === 'smart' || normalized === 'instant') {
    return normalized;
  }

  throw new Error(
    'Bright Data business search mode must be ludicrous, smart or instant',
  );
};

export const planBrightDataBusinessSearchPages = ({
  mode,
  limit,
  offset,
}: {
  mode: BrightDataBusinessSearchMode;
  limit?: number;
  offset?: number;
}): Array<{ offset: number; limit: number }> => {
  const pageSize = BRIGHT_DATA_BUSINESS_SEARCH_PAGE_SIZE[mode];
  const maxResults = BRIGHT_DATA_BUSINESS_SEARCH_MAX_RESULTS[mode];

  if (mode !== 'ludicrous' && Math.max(0, offset ?? 0) >= maxResults) {
    throw new Error(
      `${mode} mode only returns the first ${maxResults} results (offset + limit <= ${maxResults}). Use ludicrous mode (estimate, then planId and maxBudgetUsd) to fetch more.`,
    );
  }

  const requested = Math.min(
    Math.max(1, limit ?? pageSize),
    // ludicrous: offset must stay <= 1000, so the last page starts there.
    // smart/instant: the whole window is offset + limit <= 100.
    Math.max(1, maxResults - Math.max(0, offset ?? 0)),
  );
  const pages: Array<{ offset: number; limit: number }> = [];
  let collected = 0;
  let nextOffset = Math.max(0, offset ?? 0);

  while (collected < requested) {
    const pageLimit = Math.min(pageSize, requested - collected);

    pages.push({ offset: nextOffset, limit: pageLimit });
    collected += pageLimit;
    nextOffset += pageLimit;
  }

  return pages;
};

const readString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
};

const websiteHost = (website: string): string => {
  if (!website) {
    return '';
  }

  try {
    const withProtocol = /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`;

    return new URL(withProtocol).hostname.replace(/^www\./, '');
  } catch {
    return website
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }
};

export const mapBrightDataCompanyToSearchHit = (
  document: BrightDataBusinessSearchDocument,
): CompanySearchHit => {
  const data = document.data;
  const website = readString(data, 'website') || readString(data, 'domain');
  const employees = readString(data, 'employees_in_linkedin');
  const sizeFrom = readString(data, 'company_size_from');
  const sizeTo = readString(data, 'company_size_to');

  return {
    id: document.brightId,
    name: readString(data, 'name'),
    website,
    linkedinUrl: readString(data, 'url'),
    industry: readString(data, 'industry'),
    country: readString(data, 'headquarters_country_code') || undefined,
    locality: readString(data, 'headquarters_city') || undefined,
    size:
      employees ||
      (sizeFrom && sizeTo ? `${sizeFrom}-${sizeTo}` : sizeFrom || sizeTo) ||
      undefined,
    founded: readString(data, 'founded_year') || undefined,
  };
};

const readList = (record: Record<string, unknown>, key: string): string[] => {
  const value = record[key];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
};

const readNumber = (
  record: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = record[key];

  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

// The table builds one column per otherFields key, so every queryable
// Bright Data company field is kept here, readable by name. Long lists of ids
// and image urls are left out.
const ABOUT_MAX_LENGTH = 1500;

export const buildBrightDataCompanyOtherFields = (
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const sizeFrom = readString(data, 'company_size_from');
  const sizeTo = readString(data, 'company_size_to');
  const officeAddresses = readList(data, 'offices_addresses');
  const officeCities = readList(data, 'offices_cities');
  const candidates: Record<string, unknown> = {
    linkedinUrl: readString(data, 'url'),
    website: readString(data, 'website'),
    about: readString(data, 'about').slice(0, ABOUT_MAX_LENGTH),
    slogan: readString(data, 'slogan'),
    specialties: readString(data, 'specialties'),
    headquartersCountry: readString(data, 'headquarters_country_code'),
    headquartersCity: readString(data, 'headquarters_city'),
    headquartersLocation: readString(data, 'headquarters_location'),
    officeCities: officeCities.join(', '),
    // LinkedIn lists a company's office addresses; for store brands this is a
    // rough hint of how many locations it has, never an exact store count.
    officeAddressCount:
      officeAddresses.length > 0 ? officeAddresses.length : undefined,
    employeesOnLinkedin: readNumber(data, 'employees_in_linkedin'),
    sizeBand: sizeFrom && sizeTo ? `${sizeFrom}-${sizeTo}` : sizeFrom || sizeTo,
    foundedYear: readNumber(data, 'founded_year'),
    linkedinFollowers: readNumber(data, 'linkedin_followers'),
    fundingStage: readString(data, 'funding_stage'),
    fundingRaisedUsd: readNumber(data, 'funding_raised'),
    investors: readString(data, 'investor_names'),
  };

  return Object.fromEntries(
    Object.entries(candidates).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
};

const mergeBrightDataOtherFields = (
  base: Record<string, unknown>,
  document: Pick<BrightDataBusinessSearchDocument, 'relevant'>,
): Record<string, unknown> | undefined => {
  const otherFields = {
    ...base,
    ...(typeof document.relevant === 'boolean'
      ? { relevant: document.relevant }
      : {}),
  };

  return Object.keys(otherFields).length > 0 ? otherFields : undefined;
};

export const mapBrightDataCompanyToEphemeral = (
  document: BrightDataBusinessSearchDocument,
): OutreachEphemeralCompany | null => {
  const hit = mapBrightDataCompanyToSearchHit(document);

  if (!hit.name) {
    return null;
  }

  const otherFields = mergeBrightDataOtherFields(
    buildBrightDataCompanyOtherFields(document.data),
    document,
  );

  return {
    id: hit.id,
    name: hit.name,
    domain: websiteHost(hit.website),
    industry: hit.industry,
    employees: hit.size ?? '',
    segment: readString(document.data, 'organization_type'),
    icpFit: '',
    status: 'new',
    ...(otherFields ? { otherFields } : {}),
  };
};

// Semicolon-separated Bright Data bags → paired title/company rows
const splitBrightDataBag = (value: string): string[] =>
  value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

const buildPastWorkExperience = (
  data: Record<string, unknown>,
): Array<{ role: string; company: string }> => {
  const titles = splitBrightDataBag(readString(data, 'past_job_titles'));
  const companies = splitBrightDataBag(readString(data, 'past_company_names'));
  const length = Math.max(titles.length, companies.length);

  return Array.from({ length }, (_, index) => ({
    role: titles[index] ?? '',
    company: companies[index] ?? '',
  })).filter((entry) => entry.role || entry.company);
};

const buildEducationEntries = (
  data: Record<string, unknown>,
): Array<{ school: string; degree: string }> => {
  const schools = splitBrightDataBag(readString(data, 'education_schools'));
  const details = splitBrightDataBag(readString(data, 'education_details'));
  const length = Math.max(schools.length, details.length);

  return Array.from({ length }, (_, index) => ({
    school: schools[index] ?? '',
    degree: details[index] ?? '',
  })).filter((entry) => entry.school || entry.degree);
};

// Same idea as company otherFields: one table column per queryable people field
export const buildBrightDataPersonOtherFields = (
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const workExperience = buildPastWorkExperience(data);
  const education = buildEducationEntries(data);
  const candidates: Record<string, unknown> = {
    linkedinUrl: readString(data, 'url'),
    about: readString(data, 'about').slice(0, ABOUT_MAX_LENGTH),
    avatar: readString(data, 'avatar'),
    firstName: readString(data, 'first_name'),
    city: readString(data, 'city'),
    countryCode: readString(data, 'country_code'),
    location: readString(data, 'location') || readString(data, 'city'),
    connections: readNumber(data, 'connections'),
    followers: readNumber(data, 'followers'),
    experienceYears: readNumber(data, 'experience_years'),
    currentTenureMonths: readNumber(data, 'current_tenure_months'),
    pastJobTitles: readString(data, 'past_job_titles'),
    pastCompanyNames: readString(data, 'past_company_names'),
    educationSchools: readString(data, 'education_schools'),
    educationDetails: readString(data, 'education_details'),
    currentCompanyId: readString(data, 'current_company_id'),
    currentCompanyIndustry: readString(data, 'current_company_industry'),
    currentCompanyDescription: readString(
      data,
      'current_company_description',
    ).slice(0, ABOUT_MAX_LENGTH),
    currentCompanyHeadquarters: readString(
      data,
      'current_company_headquarters',
    ),
    currentCompanyCountryCode: readString(data, 'current_company_country_code'),
    workExperience: workExperience.length > 0 ? workExperience : undefined,
    education: education.length > 0 ? education : undefined,
  };

  return Object.fromEntries(
    Object.entries(candidates).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
};

export const mapBrightDataPersonToSearchItem = (
  document: BrightDataBusinessSearchDocument,
): Record<string, unknown> => {
  const data = document.data;
  // current_title is often missing while position (the headline role) is set
  const title =
    readString(data, 'current_title') || readString(data, 'position');
  const location = readString(data, 'location') || readString(data, 'city');
  const workExperience = buildPastWorkExperience(data);
  const education = buildEducationEntries(data);
  const connections = readNumber(data, 'connections');
  const followers = readNumber(data, 'followers');

  const experienceYears = readNumber(data, 'experience_years');
  const avatar = readString(data, 'avatar');
  const pastJobTitles = readString(data, 'past_job_titles');
  const pastCompanyNames = readString(data, 'past_company_names');
  const educationSchools = readString(data, 'education_schools');
  const educationDetails = readString(data, 'education_details');

  return {
    name: readString(data, 'name'),
    first_name: readString(data, 'first_name'),
    title,
    headline: title,
    about: readString(data, 'about'),
    companyName: readString(data, 'current_company_name'),
    url: readString(data, 'url'),
    location,
    source: 'bright_data',
    brightId: document.brightId,
    ...(connections !== undefined
      ? { connections_count: connections, connections }
      : {}),
    ...(followers !== undefined
      ? { followers_count: followers, followers }
      : {}),
    ...(workExperience.length > 0
      ? { work_experience: workExperience, experience: workExperience }
      : {}),
    ...(education.length > 0 ? { education } : {}),
    ...(pastJobTitles ? { past_job_titles: pastJobTitles } : {}),
    ...(pastCompanyNames ? { past_company_names: pastCompanyNames } : {}),
    ...(educationSchools ? { education_schools: educationSchools } : {}),
    ...(educationDetails ? { education_details: educationDetails } : {}),
    ...(experienceYears !== undefined
      ? { experience_years: experienceYears }
      : {}),
    ...(avatar ? { avatar } : {}),
  };
};

export const mapBrightDataPersonToEphemeral = (
  document: BrightDataBusinessSearchDocument,
): OutreachEphemeralPerson | null => {
  const item = mapBrightDataPersonToSearchItem(document);
  const name = typeof item.name === 'string' ? item.name : '';

  if (!name) {
    return null;
  }

  const otherFields = mergeBrightDataOtherFields(
    buildBrightDataPersonOtherFields(document.data),
    document,
  );

  return {
    id: document.brightId,
    name,
    title: typeof item.title === 'string' ? item.title : '',
    headline: typeof item.headline === 'string' ? item.headline : '',
    summary: typeof item.about === 'string' ? item.about : '',
    companyId: '',
    companyName: typeof item.companyName === 'string' ? item.companyName : '',
    linkedinUrl: typeof item.url === 'string' ? item.url : '',
    warmPath: '—',
    stage: 'queued',
    email: '',
    ...(otherFields ? { otherFields } : {}),
  };
};

export type BrightDataRunAggregate = {
  total: number;
  topIndustries: Array<{ name: string; count: number }>;
  topCountries: Array<{ name: string; count: number }>;
};

const topCounts = (
  values: string[],
  limit: number,
): Array<{ name: string; count: number }> => {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
};

// What the model may see about a fetched set: counts only, never the rows. The
// rows live in the dataset store and the project tab, so they cannot pile up in
// the conversation or be truncated out of it.
export const aggregateBrightDataDocuments = (
  entity: BrightDataBusinessSearchEntity,
  documents: BrightDataBusinessSearchDocument[],
): BrightDataRunAggregate => ({
  total: documents.length,
  topIndustries: topCounts(
    documents.map((document) =>
      readString(
        document.data,
        entity === 'company' ? 'industry' : 'current_company_industry',
      ),
    ),
    5,
  ),
  topCountries: topCounts(
    documents.map((document) =>
      readString(
        document.data,
        entity === 'company' ? 'headquarters_country_code' : 'country_code',
      ),
    ),
    5,
  ),
});
