import { isNonEmptyString } from '@sniptt/guards';
import { type PersonCandidateDraft } from 'twenty-shared';

import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import {
  type SourcingConstraint,
  type SourcingConstraintField,
  type SourcingSpec,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';
import { findCapability } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-source-capabilities.constant';

// The three shapes a source can be asked in (docs/sourcing-loop.md, Adapter
// contract). A source declares which it accepts in the registry.
export type SourcingSearchSpec =
  | { kind: 'facets'; filters: Record<string, unknown> }
  | { kind: 'boolean'; query: string; facets: Record<string, unknown> }
  | { kind: 'string'; query: string };

export type SourcingSearchSpecKind = SourcingSearchSpec['kind'];

// One error vocabulary for every source. It drives retry (registry
// retryPolicy), stop (no_results, budget) and the message the user sees,
// replacing thrown strings, AccountRateLimitDeferredError, 502/503 mapping and
// ignoredParameters' silent drop.
export type SourcingSourceError =
  | 'deferred'
  | 'rate_limited'
  | 'no_results'
  | 'unconfigured'
  | 'budget'
  | 'upstream';

export type SourcingSearchResult = {
  rows?: PersonCandidateDraft[];
  // Total the source reports for the query; read only where the registry says
  // its count is reliable
  counts?: number;
  costUsd: number;
  error?: SourcingSourceError;
  errorMessage?: string;
  // False when the source says there are no more pages for this query
  hasMore?: boolean;
  // The spec constraints this source could not express, for triage and the
  // judge to apply to the rows instead of dropping them
  postFilters: SourcingConstraint[];
};

export type SourcingSourceAdapter = {
  key: string;
  search: (
    searchSpec: SourcingSearchSpec,
    spec: SourcingSpec,
  ) => Promise<SourcingSearchResult>;
};

// Spec constraint field -> canonical person capability field
// (sourcing-source-capabilities.constant.ts). A field with no entry has no
// filter on any source and is always a post-filter.
const PERSON_CAPABILITY_FIELD_BY_CONSTRAINT: Partial<
  Record<SourcingConstraintField, string>
> = {
  title: 'currentTitle',
  company: 'currentCompany',
  location: 'location',
  seniority: 'seniority',
  function: 'function',
  industry: 'industry',
  skill: 'skills',
  certification: 'certifications',
  experience_years: 'yearsExperience',
};

// Free text a boolean or string query can carry even without a facet for it
const QUERY_TEXT_FIELDS: readonly SourcingConstraintField[] = [
  'keyword',
  'skill',
  'industry',
];

export type SourcingConstraintSplit = {
  expressed: SourcingConstraint[];
  postFilters: SourcingConstraint[];
};

// Which spec constraints this source can filter on, and which it must hand on.
// Hard constraints and exclusions both need checking; soft ones only rank, so
// a source that cannot express one loses nothing and they are not returned.
export const splitConstraintsForSource = (
  spec: Pick<SourcingSpec, 'hard' | 'exclusions'>,
  sourceKey: string,
  acceptedKinds: readonly SourcingSearchSpecKind[],
): SourcingConstraintSplit => {
  const acceptsQueryText = acceptedKinds.some(
    (kind) => kind === 'boolean' || kind === 'string',
  );
  const searchableFields = new Set(
    (findCapability(sourceKey, 'person')?.searchable ?? []).map(
      (capability) => capability.field,
    ),
  );
  const canExpress = (constraint: SourcingConstraint): boolean => {
    const capabilityField =
      PERSON_CAPABILITY_FIELD_BY_CONSTRAINT[constraint.field];

    if (
      isNonEmptyString(capabilityField) &&
      searchableFields.has(capabilityField)
    ) {
      return true;
    }

    return acceptsQueryText && QUERY_TEXT_FIELDS.includes(constraint.field);
  };

  // An exclusion always needs a row check: a source that can exclude by query
  // still returns near misses (former employees, subsidiaries)
  const expressed = spec.hard.filter(canExpress);
  const postFilters = [
    ...spec.hard.filter((constraint) => !canExpress(constraint)),
    ...spec.exclusions,
  ];

  return { expressed, postFilters };
};

const statusOf = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  const status = record.status ?? record.statusCode ?? record.response?.status;

  return typeof status === 'number' ? status : undefined;
};

const UNCONFIGURED_PATTERN =
  /not configured|missing .*(api[_ ]?key|token|credential)|api[_ ]?key .*(missing|not set)|NOT_IMPLEMENTED/i;
const NO_RESULTS_PATTERN = /no results|NO_RESULTS|nothing found/i;
const BUDGET_PATTERN =
  /budget|over the (run )?cap|cap reached|insufficient credits/i;

export const toSourcingSourceError = (error: unknown): SourcingSourceError => {
  if (error instanceof AccountRateLimitDeferredError) {
    return 'deferred';
  }

  const status = statusOf(error);

  if (status === 429) {
    return 'rate_limited';
  }

  if (status === 401 || status === 403) {
    return 'unconfigured';
  }

  if (status === 404) {
    return 'no_results';
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (UNCONFIGURED_PATTERN.test(message)) {
    return 'unconfigured';
  }

  if (BUDGET_PATTERN.test(message)) {
    return 'budget';
  }

  if (NO_RESULTS_PATTERN.test(message)) {
    return 'no_results';
  }

  return 'upstream';
};

// Wraps a source's raw search so every adapter returns the one shape: a thrown
// error becomes an enum value with no spend recorded, and the constraints the
// source could not express ride along as post-filters
export const defineSourceAdapter = ({
  key,
  acceptedKinds,
  search,
}: {
  key: string;
  acceptedKinds: readonly SourcingSearchSpecKind[];
  search: (
    searchSpec: SourcingSearchSpec,
    spec: SourcingSpec,
  ) => Promise<Omit<SourcingSearchResult, 'postFilters'>>;
}): SourcingSourceAdapter => ({
  key,
  search: async (searchSpec, spec) => {
    if (!acceptedKinds.includes(searchSpec.kind)) {
      throw new Error(
        `Source ${key} does not accept a ${searchSpec.kind} spec (accepts ${acceptedKinds.join(', ')})`,
      );
    }

    const { postFilters } = splitConstraintsForSource(spec, key, acceptedKinds);

    try {
      return { ...(await search(searchSpec, spec)), postFilters };
    } catch (error) {
      return {
        costUsd: 0,
        error: toSourcingSourceError(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        postFilters,
      };
    }
  },
});
