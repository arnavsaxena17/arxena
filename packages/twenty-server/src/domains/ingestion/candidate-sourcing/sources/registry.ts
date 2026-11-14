import { DEFAULT_SERP_COST_USD } from 'src/domains/discovery/providers/web-evidence/arx-web-search.service';
import { type SourceDescriptor } from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import { BRIGHT_DATA_COST_PER_RECORD_USD } from 'src/domains/discovery/providers/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { HARVEST_COST_PER_RECORD_USD } from 'src/domains/org-graph/org-chart/utils/harvest-search-params.util';

// LinkedIn stops serving a search at this many rows, whichever product
const LINKEDIN_MAX_ROWS_PER_SEARCH = 2500;

// The one place a people-search source is described. What a source accepts,
// what it costs, whether its count can be trusted and how it may be retried
// live here and nowhere else.
export const SOURCE_ALIASES = [
  'index',
  'apollo',
  'contactout',
  'pdl',
  'harvest',
  'linkedin',
  'linkedin_pool',
  'recruiter',
  'bright_data',
  'serp',
  'xray',
  'apify',
  'exa',
  'wikidata',
] as const;

export type SourceAlias = (typeof SOURCE_ALIASES)[number];

// Names a subset of the registry; a name the registry does not have does not
// compile
export type PickSource<TAlias extends SourceAlias> = TAlias;

// Which LinkedIn product a LinkedIn source is searched through. It is the
// request's searchType, not a source: one account can reach more than one.
export type LinkedInSearchType = 'classic' | 'sales_navigator' | 'recruiter';

export const SOURCE_REGISTRY: Readonly<
  Record<SourceAlias, SourceDescriptor<SourceAlias>>
> = {
  index: {
    alias: 'index',
    label: 'Index',
    kinds: ['facets'],
    costModel: { unit: 'free' },
    countReliability: 'reliable',
    retryPolicy: 'free',
  },
  apollo: {
    alias: 'apollo',
    label: 'Apollo',
    kinds: ['facets'],
    costModel: { unit: 'unpriced' },
    countReliability: 'unreliable',
    retryPolicy: 'free',
  },
  contactout: {
    alias: 'contactout',
    label: 'ContactOut',
    kinds: ['facets'],
    costModel: { unit: 'unpriced' },
    countReliability: 'unreliable',
    retryPolicy: 'free',
  },
  // Listed so the alias has one home; no search adapter exists for it yet
  pdl: {
    alias: 'pdl',
    label: 'PDL',
    kinds: ['facets'],
    costModel: { unit: 'unpriced' },
    countReliability: 'unreliable',
    retryPolicy: 'free',
  },
  harvest: {
    alias: 'harvest',
    label: 'Harvest',
    kinds: ['boolean'],
    costModel: { unit: 'row', usd: HARVEST_COST_PER_RECORD_USD },
    countReliability: 'reliable',
    retryPolicy: 'paid',
  },
  // The LinkedIn sources run on a connected account: no charge per call, and
  // a rate limit is waited out, never retried
  linkedin: {
    alias: 'linkedin',
    label: 'LinkedIn (your account)',
    kinds: ['boolean'],
    costModel: { unit: 'free' },
    countReliability: 'by_search_type',
    retryPolicy: 'never',
    maxRowsPerSearch: LINKEDIN_MAX_ROWS_PER_SEARCH,
  },
  linkedin_pool: {
    alias: 'linkedin_pool',
    label: 'Sales Nav pool',
    kinds: ['boolean'],
    costModel: { unit: 'free' },
    countReliability: 'by_search_type',
    retryPolicy: 'never',
    maxRowsPerSearch: LINKEDIN_MAX_ROWS_PER_SEARCH,
  },
  recruiter: {
    alias: 'recruiter',
    label: 'Recruiter',
    kinds: ['boolean'],
    costModel: { unit: 'free' },
    countReliability: 'reliable',
    retryPolicy: 'never',
    maxRowsPerSearch: LINKEDIN_MAX_ROWS_PER_SEARCH,
  },
  bright_data: {
    alias: 'bright_data',
    label: 'Bright Data',
    kinds: ['string'],
    costModel: { unit: 'row', usd: BRIGHT_DATA_COST_PER_RECORD_USD },
    countReliability: 'reliable',
    retryPolicy: 'paid',
  },
  serp: {
    alias: 'serp',
    label: 'Google search',
    kinds: ['string'],
    costModel: { unit: 'page', usd: DEFAULT_SERP_COST_USD },
    countReliability: 'unreliable',
    retryPolicy: 'backoff',
  },
  xray: {
    alias: 'xray',
    label: 'LinkedIn X-Ray',
    kinds: ['string'],
    costModel: { unit: 'unpriced' },
    countReliability: 'unreliable',
    retryPolicy: 'backoff',
  },
  apify: {
    alias: 'apify',
    label: 'Apify',
    kinds: ['string'],
    costModel: { unit: 'unpriced' },
    countReliability: 'unreliable',
    retryPolicy: 'backoff',
  },
  // Web search through the Exa marketplace app
  exa: {
    alias: 'exa',
    label: 'Exa',
    kinds: ['string'],
    costModel: { unit: 'unpriced' },
    countReliability: 'unreliable',
    retryPolicy: 'backoff',
  },
  wikidata: {
    alias: 'wikidata',
    label: 'Wikidata',
    kinds: ['string'],
    costModel: { unit: 'free' },
    countReliability: 'unreliable',
    retryPolicy: 'free',
  },
};

// The raw classic endpoint only knows the count of the current page, so a
// LinkedIn source's count is trusted on Sales Navigator and Recruiter only
export const isSourceCountReliable = (
  alias: SourceAlias,
  searchType?: LinkedInSearchType,
): boolean => {
  const reliability = SOURCE_REGISTRY[alias].countReliability;

  return reliability === 'by_search_type'
    ? searchType === 'sales_navigator' || searchType === 'recruiter'
    : reliability === 'reliable';
};

// A subset of the registry's aliases, in the order given, with their labels:
// what an API offers as its dataSource values
export const pickSources = <TAlias extends SourceAlias>(
  aliases: readonly TAlias[],
): Array<{ alias: TAlias; label: string }> =>
  aliases.map((alias) => ({ alias, label: SOURCE_REGISTRY[alias].label }));

// Spellings from other tables that still reach the loop: DataSourceType
// values, capability keys and ledger strings. 'unipile' and 'pool' are not
// here on purpose: they were renamed to 'linkedin' and 'linkedin_pool', and
// the old names no longer resolve.
const OTHER_NAMES: Readonly<Record<string, SourceAlias>> = {
  es: 'index',
  internalindex: 'index',
  google: 'serp',
  linkedinxray: 'xray',
  linkedinrecruiterlite: 'recruiter',
  linkedinrecruiter: 'recruiter',
};

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, '');

const BY_NORMALIZED_NAME: ReadonlyMap<string, SourceAlias> = new Map<
  string,
  SourceAlias
>([
  ...SOURCE_ALIASES.map((alias): [string, SourceAlias] => [
    normalize(alias),
    alias,
  ]),
  ...Object.entries(OTHER_NAMES),
]);

// undefined for a name the registry does not know: the caller reports it,
// rather than falling through to a default source
export const resolveSource = (
  name: string,
): SourceDescriptor<SourceAlias> | undefined => {
  const alias = BY_NORMALIZED_NAME.get(normalize(name));

  return alias === undefined ? undefined : SOURCE_REGISTRY[alias];
};
