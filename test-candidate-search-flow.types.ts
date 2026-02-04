import type {
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from './packages/twenty-server/src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';

export type ClassicPeopleSearchParams = Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
export type SalesNavigatorPeopleSearchParams = Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
export type RecruiterPeopleSearchParams = Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;

export type PeopleSearchParameters =
  | ClassicPeopleSearchParams
  | SalesNavigatorPeopleSearchParams
  | RecruiterPeopleSearchParams;

export type ResultValidationResult = {
  isRelevant: boolean;
  relevanceScore: number;
  falsePositives: string[];
  qualityAssessment: 'high' | 'medium' | 'low';
  shouldContinuePagination: boolean;
  reasoning?: string | null;
};

export interface SearchExecutionResult {
  itemCount: number;
  searchResults: unknown;
  transformedCandidates?: unknown;
  searchMetadata?: unknown;
  validationResults?: Array<{
    page: number;
    validation: ResultValidationResult;
    timestamp: string;
  }>;
  overallValidation?: ResultValidationResult;
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
}

export interface CandidateRelevanceScoring {
  relevanceScore: number;
  relevanceLabel: string;
  matchReasons: string[];
  roleMatch: boolean;
  companyMatch: boolean;
  locationMatch: boolean;
  educationMatch: boolean | null;
  reasoning: string;
}

export interface TestResult {
  booleanQueryResponse: unknown;
  rawQuery: string;
  cleanedQuery?: string;
  parsedRequirement?: unknown;
  titleAnalysis?: unknown;
  companyAnalysis?: unknown;
  queryConstructorResult?: unknown;
  finalBooleanQuery?: string;
  unresolvedParameters?: {
    classic?: ClassicPeopleSearchParams | ClassicPeopleSearchParams[];
    sales_navigator?: SalesNavigatorPeopleSearchParams | SalesNavigatorPeopleSearchParams[];
    recruiter?: RecruiterPeopleSearchParams | RecruiterPeopleSearchParams[];
  };
  resolvedParameters?: {
    classic?: ClassicPeopleSearchParams | ClassicPeopleSearchParams[];
    sales_navigator?: SalesNavigatorPeopleSearchParams | SalesNavigatorPeopleSearchParams[];
    recruiter?: RecruiterPeopleSearchParams | RecruiterPeopleSearchParams[];
  };
  linkedInUrls?: {
    classic?: string | null | (string | null)[];
    sales_navigator?: string | null | (string | null)[];
    recruiter?: string | null | (string | null)[];
  };
  searchResults?: {
    classic?: SearchExecutionResult | null;
    sales_navigator?: SearchExecutionResult | null;
    recruiter?: SearchExecutionResult | null;
  };
  validationResults?: {
    classic?: Array<{ page: number; validation: ResultValidationResult }>;
    sales_navigator?: Array<{ page: number; validation: ResultValidationResult }>;
    recruiter?: Array<{ page: number; validation: ResultValidationResult }>;
  };
  overallValidation?: {
    classic?: ResultValidationResult;
    sales_navigator?: ResultValidationResult;
    recruiter?: ResultValidationResult;
  };
  candidateScores?: {
    classic?: Array<{ candidateId: string; candidateName: string; score: CandidateRelevanceScoring }>;
    sales_navigator?: Array<{ candidateId: string; candidateName: string; score: CandidateRelevanceScoring }>;
    recruiter?: Array<{ candidateId: string; candidateName: string; score: CandidateRelevanceScoring }>;
  };
  error?: string;
  timing: {
    booleanQueryGeneration: number;
    parameterGeneration: number;
    parameterResolution: number;
    urlGeneration: number;
    searchExecution: number;
    resultValidation: number;
    candidateScoring: number;
    total: number;
  };
}

/** Context for ensureQueryUnderstanding: cleanedQuery and optional booleanQueryResponse. */
export type QueryUnderstandingContext = {
  cleanedQuery?: string;
  booleanQueryResponse?: unknown;
};

/** Output of ensureQueryUnderstanding. */
export type QueryUnderstandingOutput = {
  queryUnderstanding?: unknown;
  booleanQueryResponse?: unknown;
};

/** Context for generateFinalBooleanQueryStep. */
export type BooleanQueryContext = {
  queryUnderstanding?: unknown;
};

/** Output of generateFinalBooleanQueryStep. */
export type BooleanQueryStepOutput = {
  finalBooleanQuery: string;
  booleanQueryResponse: unknown;
  timingMs: number;
};

/** Context for generateUnresolvedParametersStep. */
export type UnresolvedParametersContext = {
  booleanQueryResponse?: unknown;
  finalBooleanQuery?: string;
  queryUnderstanding?: unknown;
  cleanedQuery?: string;
};

/** Output of generateUnresolvedParametersStep. */
export type UnresolvedParametersStepOutput = {
  unresolvedParameters: NonNullable<TestResult['unresolvedParameters']>;
  timingMs: number;
};

/** Output of resolveParametersStep. */
export type ResolvedParametersStepOutput = {
  resolvedParameters: NonNullable<TestResult['resolvedParameters']>;
  timingMs: number;
};

/** Output of generateLinkedInUrlsStep. */
export type LinkedInUrlsStepOutput = {
  linkedInUrls: NonNullable<TestResult['linkedInUrls']>;
  timingMs: number;
};

/** Output of executeParameterSearchStep. */
export type SearchExecutionStepOutput = {
  searchResults: NonNullable<TestResult['searchResults']>;
  timingMs: number;
};

/** Context for validateParameterResultsStep and scoreParameterResultsStep. */
export type ValidationScoringContext = {
  searchResults?: TestResult['searchResults'];
  booleanQueryResponse?: unknown;
  queryUnderstanding?: unknown;
};

/** Output of validateParameterResultsStep. */
export type ValidationStepOutput = {
  validationResults: NonNullable<TestResult['validationResults']>;
  overallValidation: NonNullable<TestResult['overallValidation']>;
  timingMs: number;
};

/** Output of scoreParameterResultsStep. */
export type ScoringStepOutput = {
  candidateScores: NonNullable<TestResult['candidateScores']>;
  timingMs: number;
};
