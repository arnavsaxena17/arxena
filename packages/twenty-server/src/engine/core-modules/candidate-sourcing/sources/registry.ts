import {
  BRIGHT_DATA_COST_PER_RECORD_USD,
  BRIGHT_DATA_MAPS_COST_PER_RECORD_USD,
  BRIGHT_DATA_SERP_COST_PER_REQUEST_USD,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import {
  type SourcingSearchSpecKind,
  type SourcingSourceAdapter,
  type SourcingSourceError,
} from 'src/engine/core-modules/candidate-sourcing/sources/adapter';
import { HARVEST_COST_PER_RECORD_USD } from 'src/engine/core-modules/org-chart/utils/harvest-search-params.util';
import {
  findCapability,
  type SourceCapability,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-source-capabilities.constant';

// The one source enum. The values are the SOURCING_SOURCES keys the skill text,
// the source pick (brief.sources) and the capability matrix already use; the
// other encodings fold into it through sourcingSourceKeyOf.
export const SOURCING_SOURCE_KEYS = [
  'bright-data',
  'serp',
  'linkedin',
  'harvest',
  'apollo',
  'exa',
  'wikidata',
  'internal-index',
  'google-maps',
  'raw-name-resolver',
  'naukri',
] as const;

export type SourcingSourceKey = (typeof SOURCING_SOURCE_KEYS)[number];

export type SourcingCostModel =
  | { kind: 'per_record'; usd: number }
  | { kind: 'per_request'; usd: number }
  | { kind: 'free' }
  // Billed by the provider in credits we do not price yet
  | { kind: 'unknown' };

// exact: the reported total can drive SELECT and the exhausted rule.
// estimate: a planner's guess, fine for ranking, never for stopping.
// none: ignore the total.
export type SourcingCountReliability = 'exact' | 'estimate' | 'none';

// never: a deferral or limit means wait, retrying burns the seat (Unipile).
// backoff: transient errors retry with backoff (SERP).
// once_paid: a re-fetch bills again, so at most one retry (Harvest, Bright Data).
// free: retry freely (Apollo, ES).
export type SourcingRetryPolicy = 'never' | 'backoff' | 'once_paid' | 'free';

// snapshot: a search row (name, headline, company); a full profile is a
// separate paid step. full_record: the row already carries the profile.
export type SourcingResultMode = 'snapshot' | 'full_record';

export type SourcingSourceManifest = {
  key: SourcingSourceKey;
  kinds: readonly SourcingSearchSpecKind[];
  costModel: SourcingCostModel;
  countReliability: SourcingCountReliability;
  // LinkedIn's count is exact on Sales Navigator and Recruiter, never on
  // classic (search-execution.service.ts already ignores it there)
  countReliabilityBySearchType?: Partial<
    Record<
      'classic' | 'sales_navigator' | 'recruiter',
      SourcingCountReliability
    >
  >;
  retryPolicy: SourcingRetryPolicy;
  resultMode: SourcingResultMode;
  // The adapter the FETCH round calls; set when the loop wires the source in
  adapter?: SourcingSourceAdapter;
};

export const SOURCING_SOURCE_REGISTRY: Readonly<
  Record<SourcingSourceKey, SourcingSourceManifest>
> = {
  'bright-data': {
    key: 'bright-data',
    kinds: ['facets', 'string'],
    costModel: { kind: 'per_record', usd: BRIGHT_DATA_COST_PER_RECORD_USD },
    countReliability: 'estimate',
    retryPolicy: 'once_paid',
    resultMode: 'full_record',
  },
  serp: {
    key: 'serp',
    kinds: ['string'],
    costModel: {
      kind: 'per_request',
      usd: BRIGHT_DATA_SERP_COST_PER_REQUEST_USD,
    },
    countReliability: 'none',
    retryPolicy: 'backoff',
    resultMode: 'snapshot',
  },
  linkedin: {
    key: 'linkedin',
    kinds: ['boolean'],
    costModel: { kind: 'free' },
    countReliability: 'none',
    countReliabilityBySearchType: {
      classic: 'none',
      sales_navigator: 'exact',
      recruiter: 'exact',
    },
    retryPolicy: 'never',
    resultMode: 'snapshot',
  },
  harvest: {
    key: 'harvest',
    kinds: ['boolean'],
    costModel: { kind: 'per_record', usd: HARVEST_COST_PER_RECORD_USD },
    countReliability: 'exact',
    retryPolicy: 'once_paid',
    resultMode: 'snapshot',
  },
  apollo: {
    key: 'apollo',
    kinds: ['facets'],
    costModel: { kind: 'unknown' },
    countReliability: 'estimate',
    retryPolicy: 'free',
    resultMode: 'snapshot',
  },
  exa: {
    key: 'exa',
    kinds: ['string'],
    costModel: { kind: 'unknown' },
    countReliability: 'none',
    retryPolicy: 'backoff',
    resultMode: 'snapshot',
  },
  wikidata: {
    key: 'wikidata',
    kinds: ['string'],
    costModel: { kind: 'free' },
    countReliability: 'none',
    retryPolicy: 'backoff',
    resultMode: 'snapshot',
  },
  'internal-index': {
    key: 'internal-index',
    kinds: ['facets'],
    costModel: { kind: 'free' },
    countReliability: 'exact',
    retryPolicy: 'free',
    resultMode: 'full_record',
  },
  'google-maps': {
    key: 'google-maps',
    kinds: ['string'],
    costModel: {
      kind: 'per_record',
      usd: BRIGHT_DATA_MAPS_COST_PER_RECORD_USD,
    },
    countReliability: 'estimate',
    retryPolicy: 'once_paid',
    resultMode: 'snapshot',
  },
  'raw-name-resolver': {
    key: 'raw-name-resolver',
    kinds: ['string'],
    costModel: { kind: 'free' },
    countReliability: 'none',
    retryPolicy: 'free',
    resultMode: 'snapshot',
  },
  // Rows arrive only through the browser extension; there is no search to call
  naukri: {
    key: 'naukri',
    kinds: [],
    costModel: { kind: 'free' },
    countReliability: 'none',
    retryPolicy: 'never',
    resultMode: 'full_record',
  },
};

// The other encodings of a source: PeopleDataSourceAlias (People API),
// DataSourceType (upload transformers), candidateSource (Unipile account kind)
// and the tab/ledger `source` strings. Unlisted values have no source key.
const SOURCE_KEY_BY_ALIAS: Readonly<Record<string, SourcingSourceKey>> = {
  // PeopleDataSourceAlias
  index: 'internal-index',
  apollo: 'apollo',
  harvest: 'harvest',
  unipile: 'linkedin',
  pool: 'linkedin',
  bright_data: 'bright-data',
  // DataSourceType
  linkedin_premium: 'linkedin',
  linkedin_premium_jobs: 'linkedin',
  linkedin_recruiter_jobs: 'linkedin',
  linkedin_recruiter_lite: 'linkedin',
  linkedin_sales_navigator: 'linkedin',
  linkedin_search: 'linkedin',
  linkedin_xray: 'serp',
  hiring_naukri: 'naukri',
  rms_naukri: 'naukri',
  resdex_naukri: 'naukri',
  profile_data_naukri: 'naukri',
  // candidateSource / Unipile search types
  classic: 'linkedin',
  sales_navigator: 'linkedin',
  recruiter: 'linkedin',
  // Tab and ledger source strings
  linkedin: 'linkedin',
  exa: 'exa',
  'bright-data': 'bright-data',
  brightdata: 'bright-data',
  serp: 'serp',
  google: 'serp',
  google_serp: 'serp',
  wikidata: 'wikidata',
  es: 'internal-index',
  elasticsearch: 'internal-index',
  'internal-index': 'internal-index',
  'google-maps': 'google-maps',
  naukri: 'naukri',
};

export const isSourcingSourceKey = (
  value: string,
): value is SourcingSourceKey =>
  (SOURCING_SOURCE_KEYS as readonly string[]).includes(value);

export const sourcingSourceKeyOf = (
  alias: string | null | undefined,
): SourcingSourceKey | undefined => {
  if (alias === null || alias === undefined) {
    return undefined;
  }

  const normalized = alias.trim().toLowerCase();

  return isSourcingSourceKey(normalized)
    ? normalized
    : SOURCE_KEY_BY_ALIAS[normalized];
};

export const getSourcingSource = (
  key: SourcingSourceKey,
): SourcingSourceManifest => SOURCING_SOURCE_REGISTRY[key];

export const getSourcingSourceCapability = (
  key: SourcingSourceKey,
  entity: 'company' | 'person',
): SourceCapability | undefined => findCapability(key, entity);

export const countReliabilityOf = (
  key: SourcingSourceKey,
  searchType?: 'classic' | 'sales_navigator' | 'recruiter',
): SourcingCountReliability => {
  const manifest = SOURCING_SOURCE_REGISTRY[key];

  return (
    (searchType !== undefined
      ? manifest.countReliabilityBySearchType?.[searchType]
      : undefined) ?? manifest.countReliability
  );
};

// Whether a failed call may be tried again under the source's policy; an
// error that is not transient is never retried
export const shouldRetrySourceError = (
  key: SourcingSourceKey,
  error: SourcingSourceError,
  attempt: number,
): boolean => {
  if (error !== 'rate_limited' && error !== 'upstream') {
    return false;
  }

  switch (SOURCING_SOURCE_REGISTRY[key].retryPolicy) {
    case 'never':
      return false;
    case 'once_paid':
      return attempt < 1;
    case 'backoff':
      return attempt < 3;
    case 'free':
      return attempt < 5;
  }
};

// One rounding rule for money: whole micro-dollars, so sums of per-record
// prices do not drift
export const roundUsd = (usd: number): number =>
  Math.round(usd * 1_000_000) / 1_000_000;

export const estimateSourceCostUsd = (
  key: SourcingSourceKey,
  { records, requests }: { records?: number; requests?: number },
): number | undefined => {
  const { costModel } = SOURCING_SOURCE_REGISTRY[key];

  switch (costModel.kind) {
    case 'free':
      return 0;
    case 'per_record':
      return roundUsd(costModel.usd * (records ?? 0));
    case 'per_request':
      return roundUsd(costModel.usd * (requests ?? 1));
    case 'unknown':
      return undefined;
  }
};
