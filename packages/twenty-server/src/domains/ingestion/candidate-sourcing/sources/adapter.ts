// One shape, three kinds. A source declares which kinds it accepts; callers
// build a spec and nothing else.
export type SourceSpec =
  | { kind: 'facets'; filters: Record<string, unknown> }
  | { kind: 'boolean'; query: string; facets: Record<string, unknown> }
  | { kind: 'string'; query: string };

export type SourceSpecKind = SourceSpec['kind'];

// Every way a search can fail, so retry, stop and the message read one value
export type SourceErrorCode =
  | 'deferred'
  | 'rate_limited'
  | 'no_results'
  | 'unconfigured'
  | 'budget'
  | 'upstream';

// One page of one search. The rows themselves are written to the project
// tab by the adapter, in the tab's own row shape: the loop only ever needs
// how many came back and how many of them the project did not already have.
export type SourceSearchResult = {
  fetched: number;
  newUnique: number;
  // How many rows the source says match; read it only when the source's
  // countReliability is 'reliable'
  counts?: number;
  costUsd: number;
  error?: SourceErrorCode;
  // Opaque to the loop: handed back to the same adapter for the next page.
  // Absent means the source has no more pages.
  nextCursor?: string;
};

export type SourceAdapter = {
  search: (
    spec: SourceSpec,
    options: { cursor?: string; pageSize: number },
  ) => Promise<SourceSearchResult>;
  // Why this source cannot run the spec, when it cannot. Asked at PLAN, so a
  // filter the source cannot express is reported, never silently dropped.
  rejects?: (spec: SourceSpec) => string | undefined;
};

export type SourceCostModel =
  | { unit: 'free' }
  | { unit: 'page' | 'row'; usd: number }
  // Paid, but the price is not recorded in code yet. The loop must not spend
  // on it until it is.
  | { unit: 'unpriced' };

// by_search_type: a LinkedIn account, where it depends on the product searched
export type SourceCountReliability =
  | 'reliable'
  | 'unreliable'
  | 'by_search_type';

// never: the account is rate limited, wait for it (Unipile)
// backoff: retry a few times, slower each time (SERP)
// paid: a retry is a new charge, so it needs budget (Harvest)
// free: retry at will (Apollo, the index)
export type SourceRetryPolicy = 'never' | 'backoff' | 'paid' | 'free';

export type SourceDescriptor<TAlias extends string = string> = {
  alias: TAlias;
  label: string;
  kinds: SourceSpecKind[];
  costModel: SourceCostModel;
  countReliability: SourceCountReliability;
  retryPolicy: SourceRetryPolicy;
  // The most rows one search can return, when the source has a ceiling. A
  // candidate above it is split into smaller ones.
  maxRowsPerSearch?: number;
};

// The one rounding rule for money
export const roundUsd = (value: number): number => Number(value.toFixed(4));

// null when the price is not known, so a caller cannot mistake it for free
export const pageCostUsd = (
  costModel: SourceCostModel,
  pageSize: number,
): number | null => {
  switch (costModel.unit) {
    case 'free':
      return 0;
    case 'page':
      return roundUsd(costModel.usd);
    case 'row':
      return roundUsd(costModel.usd * pageSize);
    case 'unpriced':
      return null;
  }
};

export type SourceErrorAction =
  // Try the same call again
  | 'retry'
  // Leave the candidate for a later round; the run goes on with the others
  | 'defer'
  // This candidate has nothing more to give
  | 'drop'
  // Nothing more can be bought
  | 'stop';

export const actionForSourceError = (
  error: SourceErrorCode,
  retryPolicy: SourceRetryPolicy,
): SourceErrorAction => {
  switch (error) {
    case 'budget':
      return 'stop';
    case 'no_results':
    case 'unconfigured':
      return 'drop';
    case 'deferred':
      return 'defer';
    case 'rate_limited':
    case 'upstream':
      return retryPolicy === 'backoff' || retryPolicy === 'free'
        ? 'retry'
        : 'defer';
  }
};
