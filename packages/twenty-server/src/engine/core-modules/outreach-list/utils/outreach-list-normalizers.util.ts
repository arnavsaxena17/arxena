import {
  buildBrightDataCompanyOtherFields,
  buildBrightDataPersonOtherFields,
} from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';
import {
  readHarvestLeadFields,
  readHarvestLocationText,
} from 'src/engine/core-modules/org-chart/utils/harvest-lead-fields.util';
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
    ...(partial.otherFields ? { otherFields: partial.otherFields } : {}),
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

const fromHarvestLead = (item: UnknownRecord) => {
  const lead = readHarvestLeadFields(item);

  return buildOutreachListRow('people', 'harvest', {
    id: lead.id,
    name:
      lead.fullName ||
      [lead.firstName, lead.lastName].filter(Boolean).join(' '),
    title: lead.title,
    companyName: lead.companyName,
    linkedinUrl: lead.linkedinUrl,
    location: lead.location,
  });
};

const fromHarvestAccount = (item: UnknownRecord) =>
  buildOutreachListRow('company', 'harvest', {
    id: pick(item, ['id']),
    name: pick(item, ['name']),
    website: pick(item, ['website']),
    linkedinUrl: pick(item, ['linkedinUrl']),
    industry: pick(item, ['industry']),
    location: readHarvestLocationText(item.location),
    size: pick(item, ['employeeCountRange', 'employeeDisplayCount']),
    about: pick(item, ['description']),
  });

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
  // What the provider billed for these rows, added to the list's spend
  spentUsd?: number;
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
  // Destination only — same search must share one list across projects
  'projectId',
]);

const withoutPaging = (
  args: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(args).filter(([key]) => !PAGING_ARGUMENTS.has(key)),
  );

const compact = (rows: Array<OutreachListRow | null>): OutreachListRow[] =>
  rows.filter((row): row is OutreachListRow => row !== null);

const textOfFilter = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map(textOfFilter)
      .filter((item) => item.length > 0)
      .join(', ');
  }

  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const record = value as Record<string, unknown>;

  return textOfFilter(
    record.keywords ?? record.title ?? record.query ?? record.include ?? '',
  );
};

const labelOf = (args: Record<string, unknown>): string => {
  const searchParameters = isRecord(args.searchParameters)
    ? args.searchParameters
    : undefined;
  const value =
    args.organizationName ??
    args.q_keywords ??
    args.keywords ??
    args.query ??
    args.search ??
    args.currentJobTitles ??
    args.companyName ??
    args.jobTitle;
  const fromParameters =
    searchParameters?.keywords ??
    searchParameters?.advanced_keywords ??
    searchParameters?.role;

  return textOfFilter(value ?? fromParameters ?? '');
};

// A search that returns no rows still ran. Without a zero-row list the
// frontier cannot tell it from a query that was never attempted, so the
// exhaustive loop would ask for it again.
const EMPTY_LIST_SHAPES: Record<
  string,
  { source: OutreachListSource; entity: OutreachListEntity }
> = {
  search_apollo_companies: { source: 'apollo', entity: 'company' },
  search_apollo_people: { source: 'apollo', entity: 'people' },
  search_linkedin_companies: { source: 'linkedin', entity: 'company' },
  search_linkedin_people: { source: 'linkedin', entity: 'people' },
  search_linkedin_from_url: { source: 'linkedin', entity: 'people' },
  search_harvest_leads: { source: 'harvest', entity: 'people' },
  search_harvest_accounts: { source: 'harvest', entity: 'company' },
  search_people_index: { source: 'other', entity: 'people' },
  search_companies_index: { source: 'other', entity: 'company' },
  search_wikidata_companies: { source: 'other', entity: 'company' },
};

// A shape the normalizer does not recognise must not be turned into an empty
// list: only a response that actually holds no array items is a zero result
// Request metadata can hold non-empty arrays on a zero-result response, so it
// must not be mistaken for rows
const NON_RESULT_KEYS = new Set([
  'config',
  'params',
  'paging',
  'pagination',
  'searchParameters',
  'filters',
  'query',
  'metadata',
]);

const hasNonEmptyArray = (value: unknown, depth = 0): boolean => {
  if (depth > 4) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.entries(value).some(
    ([key, item]) =>
      !NON_RESULT_KEYS.has(key) && hasNonEmptyArray(item, depth + 1),
  );
};

export const buildEmptyListShape = (
  toolName: string,
  args: Record<string, unknown>,
  output: unknown,
): NormalizedToolOutput | undefined => {
  if (hasNonEmptyArray(output)) {
    return undefined;
  }

  const shape =
    toolName === 'exa_web_search' || toolName === 'app_exa_web_search'
      ? {
          source: 'exa' as const,
          entity:
            args.category === 'people'
              ? ('people' as const)
              : ('company' as const),
        }
      : EMPTY_LIST_SHAPES[toolName];

  return shape === undefined
    ? undefined
    : {
        ...shape,
        rows: [],
        signatureArgs: withoutPaging(args),
        label: labelOf(args),
      };
};

// Tools whose results are routed into a list instead of the conversation
export const OUTREACH_LIST_SOURCE_TOOLS = [
  'search_apollo_companies',
  'search_apollo_people',
  'search_linkedin_companies',
  'search_linkedin_people',
  'search_linkedin_from_url',
  'search_linkedin_continue',
  'search_harvest_leads',
  'search_harvest_accounts',
  'exa_web_search',
  'app_exa_web_search',
  'search_people_index',
  'search_companies_index',
  'search_wikidata_companies',
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
  const label = labelOf(args);

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

  if (
    toolName === 'search_harvest_leads' ||
    toolName === 'search_harvest_accounts'
  ) {
    const items = isRecord(root) ? arrayAt(root, ['items']) : [];
    const isCompany = toolName === 'search_harvest_accounts';
    const rows = compact(
      items
        .filter(isRecord)
        .map(isCompany ? fromHarvestAccount : fromHarvestLead),
    );
    const costUsd =
      isRecord(root) && typeof root.costUsd === 'number' ? root.costUsd : 0;
    const filters = Object.fromEntries(
      Object.entries(
        isRecord(args.searchParameters) ? args.searchParameters : {},
      ).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(asText).join(', ') : value,
      ]),
    );

    return rows.length > 0
      ? {
          entity: isCompany ? 'company' : 'people',
          source: 'harvest',
          rows,
          signatureArgs,
          label:
            label ||
            asText(
              filters.search ??
                filters.currentJobTitles ??
                filters.headquarterLocations ??
                filters.locations ??
                '',
            ),
          spentUsd: costUsd,
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

  if (toolName === 'search_people_index') {
    const items = isRecord(root) ? arrayAt(root, ['items']) : [];
    const rows = compact(items.filter(isRecord).map(fromPeopleIndexItem));

    return rows.length > 0
      ? {
          entity: 'people',
          source: 'other',
          rows,
          signatureArgs,
          label: label || asText(args.personName ?? args.jobTitle ?? ''),
        }
      : null;
  }

  if (toolName === 'search_companies_index') {
    const items = isRecord(root) ? arrayAt(root, ['items']) : [];
    const rows = compact(items.filter(isRecord).map(fromCompaniesIndexItem));

    return rows.length > 0
      ? {
          entity: 'company',
          source: 'other',
          rows,
          signatureArgs,
          label: label || asText(args.companyName ?? args.query ?? ''),
        }
      : null;
  }

  if (toolName === 'search_wikidata_companies') {
    const companies = isRecord(root) ? arrayAt(root, ['companies']) : [];
    const rows = compact(companies.filter(isRecord).map(fromWikidataCompany));

    return rows.length > 0
      ? {
          entity: 'company',
          source: 'other',
          rows,
          signatureArgs,
          label: label || asText(args.name ?? args.domain ?? ''),
        }
      : null;
  }

  return null;
};

const fromPeopleIndexItem = (item: UnknownRecord) =>
  buildOutreachListRow('people', 'other', {
    id: pick(item, ['id', '_id']),
    name: pick(item, ['full_name', 'name']),
    title: pick(item, ['job_title', 'title']),
    companyName: pick(item, ['job_company_name', 'company_name']),
    linkedinUrl: pick(item, ['linkedin_url', 'linkedinUrl']),
    location: pick(item, ['location_name', 'location']),
    country: pick(item, ['country']),
  });

const fromCompaniesIndexItem = (item: UnknownRecord) =>
  buildOutreachListRow('company', 'other', {
    id: pick(item, ['id']),
    name: pick(item, ['name']),
    website: pick(item, ['website']),
    domain: pick(item, ['website']),
    linkedinUrl: pick(item, ['linkedin_url']),
    industry: pick(item, ['industry']),
    location: pick(item, ['location_name', 'locality']),
    country: pick(item, ['country']),
    size: pick(item, ['size']),
  });

const fromWikidataCompany = (company: UnknownRecord) => {
  const headquarters = isRecord(company.headquarters)
    ? company.headquarters
    : {};

  return buildOutreachListRow('company', 'other', {
    id: pick(company, ['wikidataId']),
    name: pick(company, ['companyName', 'legalName']),
    website: pick(company, ['website']),
    domain: pick(company, ['companyDomain', 'website']),
    industry: pick(company, ['industry']),
    location: pick(headquarters, ['label', 'city']),
    country: pick(company, ['country']) || pick(headquarters, ['country']),
    size:
      typeof company.employeeCount === 'number'
        ? String(company.employeeCount)
        : '',
    about: pick(company, ['description']),
  });
};

const text = (value: unknown): string => asText(value);

// Bright Data business search documents (company and people views)
const brightDataOtherFields = (
  entity: OutreachListEntity,
  document: {
    data: Record<string, unknown>;
    relevant?: boolean;
  },
): { otherFields?: Record<string, unknown> } => {
  const otherFields = {
    ...(entity === 'people'
      ? buildBrightDataPersonOtherFields(document.data)
      : buildBrightDataCompanyOtherFields(document.data)),
    ...(typeof document.relevant === 'boolean'
      ? { relevant: document.relevant }
      : {}),
  };

  return Object.keys(otherFields).length > 0 ? { otherFields } : {};
};

export const fromBrightDataDocument = (
  entity: OutreachListEntity,
  document: {
    brightId: string;
    data: Record<string, unknown>;
    relevant?: boolean;
  },
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
      ...brightDataOtherFields('people', document),
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
    ...brightDataOtherFields('company', document),
  });
};
