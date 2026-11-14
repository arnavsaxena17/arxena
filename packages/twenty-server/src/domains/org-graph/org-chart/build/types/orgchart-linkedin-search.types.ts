import { type PeopleSearchStrategyResult } from 'src/domains/org-graph/org-chart/build/utils/extract-strategies.util';
import { type OrgChartData } from 'twenty-shared';

// The org-chart LinkedIn path keeps the fetch round's preview whole so the
// chart builder can read the raw items and the transformed rows together.
export type OrgchartSearchExecutionResult = {
  itemCount: number;
  searchResults: unknown;
  transformedCandidates?: unknown[];
  searchMetadata?: unknown;
  validationResults?: unknown[];
  overallValidation?: unknown;
  error?: { message: string; code?: string; details?: string };
};

export type OrgchartStrategyResult = {
  strategy: PeopleSearchStrategyResult;
  result: OrgchartSearchExecutionResult | null;
};

export type OrgchartFunctionGradeCacheMeta = {
  strategyCap: number;
  keywordsHash: string;
  functionRoot: string;
  country: string;
};

// What runOrgchartLinkedInSearch answers. Public: the org-chart build and
// super-impose services take their return types from it.
export type OrgchartLinkedInSearchResult = {
  items: unknown[];
  itemCount: number;
  isCached?: boolean;
  cacheSource?: 'none' | 'function_grade';
  orgChart?: OrgChartData;
  functionGradeCacheMeta?: OrgchartFunctionGradeCacheMeta;
  // Merged filters after the business-division LLM (for org-chart build)
  effectiveCountry?: string;
  effectiveFunctionRoot?: string;
  strategyResults: OrgchartStrategyResult[];
};

// Reported progress is also how a cancelled run is detected: false means the
// user cancelled, and every phase treats it as a reason to stop.
export type OrgchartProgressEmitter = (
  event: string,
  data: Record<string, unknown>,
) => Promise<boolean | void>;

export type OrgchartSyncProgressEmitter = (
  event: string,
  data: Record<string, unknown>,
) => boolean | void;

// What the run and the estimate both read off an org-chart request
export type OrgchartLinkedInRequestOptions = {
  mode?: string;
  companyName?: string;
  companyNames?: string[];
  companyId?: string;
  jobTitles?: string[];
  country?: string;
  functionRoot?: string;
  /** Org-chart node scope (current_node / selected_nodes): keep this standardized function. */
  stdFunction?: string;
  /** Org-chart node scope: keep this standardized grade. */
  stdGrade?: string;
  /** `selected_nodes` only: each selected node's std labels; a row must match any scope (OR). */
  selectedNodeStdScopes?: Array<{
    stdFunction?: string;
    stdGrade?: string;
  }>;
  /** Natural-language business division query; triggers structured LLM + keyword strategy */
  businessDivisionRawQuery?: string;
  /** Unipile LinkedIn account id (same as linkedin-search ?account_id) */
  linkedinUnipileAccountId?: string;
  linkedinLocationId?: string;
  linkedinLocationName?: string;
  linkedinCompanyParameterId?: string;
  /** Multiple LinkedIn company facet ids (super-impose multi-company). Takes precedence over singular id. */
  linkedinCompanyParameterIds?: string[];
  /** Pre-computed boolean keyword clause (e.g. super-impose mergedKeywords). */
  linkedinKeywords?: string;
  /** Pre-computed current-title boolean (e.g. super-impose mergedJobTitle → role.include). */
  linkedinJobTitle?: string;
  /** When true, counts as a LinkedIn subset scope filter for threshold gating. */
  leadershipOnly?: boolean;
};

// The run adds what only it does: a resumable request id, the validated path,
// unlimited mode and the company URL the shard planner reads
export type OrgchartLinkedInRunOptions = OrgchartLinkedInRequestOptions & {
  requestId?: string;
  /** Canonical LinkedIn company URL for Python org-chart (e.g. https://www.linkedin.com/company/briskpe/) */
  linkedinCompanyUrl?: string;
  /** When true, run validated/scored multi-page search (LLM). Default false (fast path). */
  validateAndScoreLinkedInResults?: boolean;
  /**
   * Fetch beyond the normal ~1000 cap via LLM location/facet shards (2500 per
   * shard, slow 30–120s pacing). Bypasses scopeRequired.
   */
  unlimited?: boolean;
  industry?: string;
};

// An org-chart request once every default is applied. Parsed only: the scope
// flags below are derived after the business-division step, because that step
// can narrow the country and the function.
export type OrgchartNormalisedRequest = {
  mode?: string;
  primaryCompanyName: string;
  primaryCompanyId: string;
  companyNames: string[];
  rawCountryFromOptions: string;
  rawFunctionFromOptions: string;
  country: string;
  functionRoot: string;
  linkedinLocationId: string;
  linkedinLocationName: string;
  linkedinCompanyParameterIds: string[];
  businessDivisionRaw?: string;
};

// What the request narrows, in the two forms the pipeline reads. Both entry
// points derive these from the same request, so they cannot disagree.
export type OrgchartRequestFilters = {
  // Country, function, location or leadership narrows the search
  hasAdditionalFilters: boolean;
  // The same, in the form the LinkedIn threshold gate reads
  hasSubsetScopeFilters: boolean;
  // Everyone in the company: a classic entire-company search with no filters
  isAllPeopleInCompanyMode: boolean;
};

export type OrgchartUnlimitedPlanArgs = {
  requestId?: string;
  apiToken: string;
  companyName: string;
  linkedinCompanyUrl?: string;
  country?: string;
  industry?: string;
  totalCount: number;
  linkedInAccountId: string;
  emitProgress: OrgchartProgressEmitter;
};
