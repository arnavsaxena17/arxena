import {
  type OutreachListEntity,
  type OutreachListRow,
  type OutreachListSource,
} from 'src/engine/core-modules/outreach-list/outreach-list.types';
import {
  buildOutreachListRowKey,
  normalizeDomain,
} from 'src/engine/core-modules/outreach-list/utils/outreach-list-keys.util';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
};

// First non-empty string among the candidate keys
const pick = (record: UnknownRecord, keys: string[]): string => {
  for (const key of keys) {
    const text = asText(record[key]);

    if (text) {
      return text;
    }
  }

  return '';
};

const firstRecord = (value: unknown): UnknownRecord =>
  Array.isArray(value) && isRecord(value[0]) ? value[0] : {};

const arrayAt = (value: unknown, path: string[]): unknown[] => {
  let current: unknown = value;

  for (const key of path) {
    current = isRecord(current) ? current[key] : undefined;
  }

  return Array.isArray(current) ? current : [];
};

export const buildOutreachListRow = (
  entity: OutreachListEntity,
  source: OutreachListSource,
  partial: Partial<Omit<OutreachListRow, 'key' | 'source' | 'addedAt'>>,
): OutreachListRow | null => {
  const row: OutreachListRow = {
    key: '',
    id: partial.id ?? '',
    name: partial.name ?? '',
    domain: partial.domain ?? '',
    website: partial.website ?? '',
    linkedinUrl: partial.linkedinUrl ?? '',
    title: partial.title ?? '',
    companyName: partial.companyName ?? '',
    email: partial.email ?? '',
    industry: partial.industry ?? '',
    location: partial.location ?? '',
    country: partial.country ?? '',
    size: partial.size ?? '',
    about: (partial.about ?? '').slice(0, 500),
    source,
    addedAt: new Date().toISOString(),
  };

  if (!row.name) {
    return null;
  }

  if (entity === 'company' && !row.domain) {
    row.domain = normalizeDomain(row.website);
  }

  row.key = buildOutreachListRowKey(entity, row);

  return row;
};

const fromApolloOrganization = (organization: UnknownRecord) =>
  buildOutreachListRow('company', 'apollo', {
    id: pick(organization, ['id']),
    name: pick(organization, ['name']),
    website: pick(organization, ['website_url', 'primary_domain']),
    domain: pick(organization, ['primary_domain']),
    linkedinUrl: pick(organization, ['linkedin_url']),
    industry: pick(organization, ['industry']),
    location: [pick(organization, ['city']), pick(organization, ['state'])]
      .filter(Boolean)
      .join(', '),
    country: pick(organization, ['country']),
    size: pick(organization, ['estimated_num_employees', 'employee_count']),
    about: pick(organization, ['short_description', 'seo_description']),
  });

const fromApolloPerson = (person: UnknownRecord) => {
  const organization = isRecord(person.organization) ? person.organization : {};
  const name =
    pick(person, ['name']) ||
    [pick(person, ['first_name']), pick(person, ['last_name'])]
      .filter(Boolean)
      .join(' ');

  return buildOutreachListRow('people', 'apollo', {
    id: pick(person, ['id']),
    name,
    title: pick(person, ['title', 'jobTitle', 'headline']),
    companyName:
      pick(person, ['organization_name', 'companyName', 'company']) ||
      pick(organization, ['name']),
    linkedinUrl: pick(person, ['linkedin_url', 'linkedinUrl']),
    email: pick(person, ['email']),
    location: [pick(person, ['city']), pick(person, ['state'])]
      .filter(Boolean)
      .join(', '),
    country: pick(person, ['country']),
  });
};

const fromLinkedinCompany = (item: UnknownRecord) =>
  buildOutreachListRow('company', 'linkedin', {
    id: pick(item, ['id']),
    name: pick(item, ['name']),
    website: pick(item, ['website', 'website_url']),
    linkedinUrl: pick(item, ['profile_url', 'public_profile_url', 'url']),
    industry: Array.isArray(item.industry)
      ? item.industry.map(asText).filter(Boolean).join(', ')
      : pick(item, ['industry']),
    location: pick(item, ['location', 'headquarters']),
    size: pick(item, ['headcount', 'employee_count', 'staff_count']),
    about: pick(item, ['summary', 'description']),
  });

const fromLinkedinPerson = (item: UnknownRecord) => {
  const position = firstRecord(item.current_positions);

  return buildOutreachListRow('people', 'linkedin', {
    id: pick(item, ['id', 'member_urn']),
    name:
      pick(item, ['name']) ||
      [pick(item, ['first_name']), pick(item, ['last_name'])]
        .filter(Boolean)
        .join(' '),
    title: pick(position, ['role']) || pick(item, ['headline']),
    companyName: pick(position, ['company']),
    // Sales Navigator "profile_url" is a search-scoped lead link; the public
    // URL is the stable one
    linkedinUrl: pick(item, ['public_profile_url', 'profile_url']),
    location: pick(item, ['location']),
    about: pick(item, ['summary']),
  });
};

const fromExaResult = (
  entity: OutreachListEntity,
  result: UnknownRecord,
): OutreachListRow | null => {
  const url = pick(result, ['url']);
  const title = pick(result, ['title']);

  if (entity === 'company') {
    const host = normalizeDomain(url);

    return buildOutreachListRow('company', 'exa', {
      id: pick(result, ['id']) || url,
      // Page titles read "Name | tagline"; the part before the separator is the name
      name: title.split(/\s[|\-–—]\s/)[0] || host,
      website: url,
      domain: host,
      about: pick(result, ['text', 'snippet', 'summary']),
    });
  }

  return buildOutreachListRow('people', 'exa', {
    id: pick(result, ['id']) || url,
    name: title.split(/\s[|\-–—]\s/)[0],
    linkedinUrl: url.includes('linkedin.com/in/') ? url : '',
    about: pick(result, ['text', 'snippet', 'summary']),
  });
};

export type NormalizedToolOutput = {
  entity: OutreachListEntity;
  source: OutreachListSource;
  rows: OutreachListRow[];
  // Arguments that identify the search; paging arguments are left out so
  // every page of one search lands in the same list
  signatureArgs: Record<string, unknown>;
  label: string;
};

const PAGING_ARGUMENTS = new Set([
  'page',
  'perPage',
  'per_page',
  'limit',
  'offset',
  'cursor',
  'start',
  'numResults',
]);

const withoutPaging = (
  args: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(args).filter(([key]) => !PAGING_ARGUMENTS.has(key)),
  );

const compact = (rows: Array<OutreachListRow | null>): OutreachListRow[] =>
  rows.filter((row): row is OutreachListRow => row !== null);

// Tools whose results are routed into a list instead of the conversation
export const OUTREACH_LIST_SOURCE_TOOLS = [
  'search_apollo_companies',
  'search_apollo_people',
  'search_linkedin_companies',
  'search_linkedin_people',
  'search_linkedin_from_url',
  'search_linkedin_continue',
  'exa_web_search',
  'app_exa_web_search',
] as const;

export const isOutreachListSourceTool = (toolName: string): boolean =>
  (OUTREACH_LIST_SOURCE_TOOLS as readonly string[]).includes(toolName);

// `output` is the parsed JSON the tool returned. Returns null when the shape
// is not recognised, so the caller leaves the original output untouched.
export const normalizeToolOutputToListRows = (
  toolName: string,
  args: Record<string, unknown>,
  output: unknown,
): NormalizedToolOutput | null => {
  const root =
    isRecord(output) && isRecord(output.result) ? output.result : output;
  const signatureArgs = withoutPaging(args);
  const label = asText(
    args.organizationName ??
      args.q_keywords ??
      args.keywords ??
      args.query ??
      '',
  );

  if (toolName === 'search_apollo_companies') {
    const organizations = isRecord(root)
      ? [
          ...arrayAt(root, ['organizations', 'organizations']),
          ...arrayAt(root, ['organizations', 'accounts']),
          ...arrayAt(root, ['organizations']),
        ]
      : [];
    const rows = compact(
      organizations.filter(isRecord).map(fromApolloOrganization),
    );

    return rows.length > 0
      ? { entity: 'company', source: 'apollo', rows, signatureArgs, label }
      : null;
  }

  if (toolName === 'search_apollo_people') {
    const people = isRecord(root)
      ? [
          ...arrayAt(root, ['transformedCandidates']),
          ...arrayAt(root, ['rawApolloResponse', 'people']),
        ]
      : [];
    const rows = compact(people.filter(isRecord).map(fromApolloPerson));

    return rows.length > 0
      ? { entity: 'people', source: 'apollo', rows, signatureArgs, label }
      : null;
  }

  if (
    toolName === 'search_linkedin_companies' ||
    toolName === 'search_linkedin_people' ||
    toolName === 'search_linkedin_from_url' ||
    toolName === 'search_linkedin_continue'
  ) {
    const items = isRecord(root) ? arrayAt(root, ['items']) : [];
    const records = items.filter(isRecord);
    // A pasted search URL can be a people or a company search, so the result
    // items decide
    const isCompany =
      toolName === 'search_linkedin_companies' ||
      records.some((record) => record.type === 'COMPANY');
    const rows = compact(
      records.map(isCompany ? fromLinkedinCompany : fromLinkedinPerson),
    );
    // Both the first page and every continuation echo the search params, so
    // all pages of one search share a list
    const configParams =
      isRecord(root) && isRecord(root.config) && isRecord(root.config.params)
        ? root.config.params
        : undefined;

    return rows.length > 0
      ? {
          entity: isCompany ? 'company' : 'people',
          source: 'linkedin',
          rows,
          signatureArgs: configParams ?? signatureArgs,
          label,
        }
      : null;
  }

  if (toolName === 'exa_web_search' || toolName === 'app_exa_web_search') {
    const results = isRecord(root) ? arrayAt(root, ['results']) : [];
    const entity: OutreachListEntity =
      args.category === 'people' ? 'people' : 'company';
    const rows = compact(
      results.filter(isRecord).map((result) => fromExaResult(entity, result)),
    );

    return rows.length > 0
      ? { entity, source: 'exa', rows, signatureArgs, label }
      : null;
  }

  return null;
};

const text = (value: unknown): string => asText(value);

// Bright Data business search documents (company and people views)
export const fromBrightDataDocument = (
  entity: OutreachListEntity,
  document: { brightId: string; data: Record<string, unknown> },
): OutreachListRow | null => {
  const data = document.data;

  if (entity === 'people') {
    return buildOutreachListRow('people', 'bright_data', {
      id: document.brightId,
      name: text(data.name),
      title: text(data.current_title),
      companyName: text(data.current_company_name),
      linkedinUrl: text(data.url),
      location: text(data.location) || text(data.city),
      country: text(data.country_code),
      industry: text(data.current_company_industry),
      about: text(data.about),
    });
  }

  const sizeFrom = text(data.company_size_from);
  const sizeTo = text(data.company_size_to);

  return buildOutreachListRow('company', 'bright_data', {
    id: document.brightId,
    name: text(data.name),
    website: text(data.website) || text(data.domain),
    domain: text(data.domain),
    linkedinUrl: text(data.url),
    industry: text(data.industry),
    location: text(data.headquarters_city) || text(data.headquarters_location),
    country: text(data.headquarters_country_code),
    size:
      text(data.employees_in_linkedin) ||
      (sizeFrom && sizeTo ? `${sizeFrom}-${sizeTo}` : sizeFrom || sizeTo),
    about: text(data.about) || text(data.specialties),
  });
};
