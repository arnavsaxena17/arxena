
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import {
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from './packages/twenty-server/src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzhkZTU3ZC0xYzM2LTQyZmMtYTEyYy1kY2U4ZTVlM2Y1MWMiLCJ3b3Jrc3BhY2VJZCI6IjA0Nzk2ZWFkLWM0NDktNGJhOC1hY2FlLWM4YzgzNTNkZTM5ZCIsIndvcmtzcGFjZU1lbWJlcklkIjoiODNlMjYxYjYtZjk3Yy00OWI5LWFjMWEtMjM5ZDM2MGNiOTljIiwidXNlcldvcmtzcGFjZUlkIjoiNjJlMGYwN2QtNjhjMi00ZTZmLWJmMTgtYjFiNTI5ZWU0MjE3IiwiaWF0IjoxNzY5NTk4OTIwLCJleHAiOjE3Njk3Nzg5MjB9.0tmgDPxlGSdDSh5U8SK8wNaetVzCX6Wue_iTyW9ards';
// Use process.cwd() to get the project root directory
const REQUIREMENTS_FILE = path.join(process.cwd(), 'leadership_requirements.txt');

// Search types to generate parameters for
// const SEARCH_TYPES: Array<'classic' | 'sales_navigator' | 'recruiter'> = ['classic', 'sales_navigator', 'recruiter'];
const SEARCH_TYPES: Array<'classic' | 'sales_navigator' | 'recruiter'> = ['classic'];

// ============================================================================
// CACHE CONFIGURATION - Comment/Uncomment to control caching behavior
// ============================================================================
// 
// USE_CACHE_* variables: Set to true to use cached results if available, 
//                        false to always generate new results (and overwrite cache)
// 
// RUN_*_STEP variables: Set to true to run the step, false to skip it entirely
// 
// Examples:
// - To regenerate only LinkedIn URLs using cached resolved parameters:
//   RUN_BOOLEAN_QUERY_STEP = false
//   RUN_UNRESOLVED_PARAMETERS_STEP = false
//   RUN_RESOLVED_PARAMETERS_STEP = false
//   RUN_LINKEDIN_URLS_STEP = true
//   USE_CACHE_RESOLVED_PARAMETERS = true
// 
// - To execute search and validate/score using cached resolved parameters:
//   RUN_BOOLEAN_QUERY_STEP = false
//   RUN_UNRESOLVED_PARAMETERS_STEP = false
//   RUN_RESOLVED_PARAMETERS_STEP = false
//   RUN_LINKEDIN_URLS_STEP = false
//   RUN_SEARCH_EXECUTION_STEP = true
//   RUN_RESULT_VALIDATION_STEP = true
//   RUN_CANDIDATE_SCORING_STEP = true
//   USE_CACHE_RESOLVED_PARAMETERS = true
// 
// - To force regenerate everything (ignore cache):
//   USE_CACHE_BOOLEAN_QUERY = false
//   USE_CACHE_UNRESOLVED_PARAMETERS = false
//   USE_CACHE_RESOLVED_PARAMETERS = false
//   USE_CACHE_LINKEDIN_URLS = false
//   USE_CACHE_SEARCH_RESULTS = false
//   USE_CACHE_VALIDATION_RESULTS = false
//   USE_CACHE_SCORING_RESULTS = false
//
const USE_CACHE_CLEANUP = false;
const USE_CACHE_BOOLEAN_QUERY = true;
const USE_CACHE_UNRESOLVED_PARAMETERS = false;
const USE_CACHE_RESOLVED_PARAMETERS = false;
const USE_CACHE_LINKEDIN_URLS = false;
const USE_CACHE_SEARCH_RESULTS = false;
const USE_CACHE_VALIDATION_RESULTS = false;
const USE_CACHE_SCORING_RESULTS = false;

const RUN_CLEANUP_STEP = true;
const RUN_BOOLEAN_QUERY_STEP = false;
const RUN_UNRESOLVED_PARAMETERS_STEP = true;
const RUN_RESOLVED_PARAMETERS_STEP = false;
const RUN_LINKEDIN_URLS_STEP = false;
const RUN_SEARCH_EXECUTION_STEP = false;
const RUN_RESULT_VALIDATION_STEP = false;
const RUN_CANDIDATE_SCORING_STEP = false;

// Cache directory (cache files are stored as: query-{index}-{step}.json)
const CACHE_DIR = path.join(process.cwd(), 'test-cache');

// Type definitions
type ClassicPeopleSearchParams = Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
type SalesNavigatorPeopleSearchParams = Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
type RecruiterPeopleSearchParams = Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;

type PeopleSearchParameters = ClassicPeopleSearchParams | SalesNavigatorPeopleSearchParams | RecruiterPeopleSearchParams;

// Cache helper functions
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheFilePath(index: number, step: string): string {
  return path.join(CACHE_DIR, `query-${index}-${step}.json`);
}

function readCache<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (error) {
    console.log(`Warning: Failed to read cache file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  return null;
}

function writeCache<T>(filePath: string, data: T): void {
  try {
    ensureCacheDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.log(`Warning: Failed to write cache file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

type ResultValidationResult = {
  isRelevant: boolean;
  relevanceScore: number;
  falsePositives: string[];
  qualityAssessment: 'high' | 'medium' | 'low';
  shouldContinuePagination: boolean;
  reasoning?: string | null;
};

interface SearchExecutionResult {
  itemCount: number;
  searchResults: any;
  transformedCandidates?: any;
  searchMetadata?: any;
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

interface CandidateRelevanceScoring {
  relevanceScore: number;
  relevanceLabel: string;
  matchReasons: string[];
  roleMatch: boolean;
  companyMatch: boolean;
  locationMatch: boolean;
  educationMatch: boolean | null;
  reasoning: string;
}

interface TestResult {
  booleanQueryResponse: any;
  rawQuery: string;
  cleanedQuery?: string;
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

async function cleanupQueryStep(rawQuery: string, index: number, result: TestResult): Promise<string> {
  console.log(`[${index}] Pre-step: Cleaning up raw query...`);
  const cleanupStart = Date.now();

  const cacheFilePath = getCacheFilePath(index, 'cleanup-query');

  if (USE_CACHE_CLEANUP) {
    const cached = readCache<{ cleanedQuery: string }>(cacheFilePath);
    if (cached?.cleanedQuery) {
      result.cleanedQuery = cached.cleanedQuery;
      const elapsed = Date.now() - cleanupStart;
      console.log(`[${index}] ✓ Cleaned query loaded from cache (${elapsed}ms)`);
      console.log(`[${index}]   Original: ${rawQuery}`);
      console.log(`[${index}]   Cleaned : ${cached.cleanedQuery}`);
      return cached.cleanedQuery;
    }
  }

  try {
    const response = await axios.post(
      `${SERVER_URL}/candidate-search/test/cleanup-query`,
      {
        rawQuery,
      },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status >= 400) {
      throw new Error(
        `HTTP ${response.status}: ${response.data?.message || response.statusText || 'Request failed'}`
      );
    }

    const cleanedQuery = response.data.cleanedQuery || rawQuery;
    result.cleanedQuery = cleanedQuery;

    writeCache(cacheFilePath, { cleanedQuery });

    const elapsed = Date.now() - cleanupStart;
    console.log(`[${index}] ✓ Query cleaned up (${elapsed}ms)`);
    console.log(`[${index}]   Original: ${rawQuery}`);
    console.log(`[${index}]   Cleaned : ${cleanedQuery}`);

    return cleanedQuery;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(
      `[${index}] ⚠ Query cleanup failed (${errorMessage}), falling back to original query`,
    );
    result.cleanedQuery = rawQuery;
    return rawQuery;
  }
}

async function generateFinalBooleanQueryStep(rawQuery: string, index: number, result: TestResult): Promise<void> {
  console.log(`[${index}] Step 1: Generating final boolean query...`);
  const booleanQueryStart = Date.now();
  
  const cacheFilePath = getCacheFilePath(index, 'boolean-query');
  
  // Try to load from cache if enabled
  if (USE_CACHE_BOOLEAN_QUERY) {
    const cached = readCache<{ finalBooleanQuery: string; booleanQueryResponse: any }>(cacheFilePath);
    if (cached) {
      result.finalBooleanQuery = cached.finalBooleanQuery;
      result.booleanQueryResponse = cached.booleanQueryResponse;
      result.timing.booleanQueryGeneration = Date.now() - booleanQueryStart;
      console.log(`[${index}] ✓ Boolean query loaded from cache (${result.timing.booleanQueryGeneration}ms)`);
      console.log(`[${index}]   Final Boolean Query: ${result.finalBooleanQuery}`);
      return;
    }
  }
  
  try {
    const booleanQueryResponse = await axios.post(
      `${SERVER_URL}/candidate-search/test/generate-boolean-query`,
      {
        rawQuery,
      },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
        validateStatus: (status) => status < 500,
      }
    );

    if (booleanQueryResponse.status >= 400) {
      throw new Error(
        `HTTP ${booleanQueryResponse.status}: ${booleanQueryResponse.data?.message || booleanQueryResponse.statusText || 'Request failed'}`
      );
    }

    result.finalBooleanQuery = booleanQueryResponse.data.final_boolean_string;
    result.booleanQueryResponse = booleanQueryResponse.data.booleanQueryResponse;
    result.timing.booleanQueryGeneration = Date.now() - booleanQueryStart;
    
    // Save to cache
    writeCache(cacheFilePath, {
      finalBooleanQuery: result.finalBooleanQuery,
      booleanQueryResponse: result.booleanQueryResponse,
    });
    
    console.log(`[${index}] ✓ Boolean query generated (${result.timing.booleanQueryGeneration}ms)`);
    console.log(`[${index}]   Final Boolean Query: ${result.finalBooleanQuery}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.error = `Boolean query generation failed: ${errorMessage}`;
    result.timing.booleanQueryGeneration = Date.now() - booleanQueryStart;
    console.log(`[${index}] ✗ Boolean query generation failed: ${result.error}`);
    throw error;
  }

  if (!result.finalBooleanQuery) {
    throw new Error('Failed to generate boolean query');
  }
}

async function generateUnresolvedParametersStep(rawQuery: string, index: number, result: TestResult): Promise<void> {
  console.log(`[${index}] Step 2: Generating unresolved parameters for all search types (in parallel)...`);
  const parameterStart = Date.now();
  result.unresolvedParameters = {};

  const cacheFilePath = getCacheFilePath(index, 'unresolved-parameters');
  
  // Try to load from cache if enabled
  if (USE_CACHE_UNRESOLVED_PARAMETERS) {
    const cached = readCache<{
      classic?: ClassicPeopleSearchParams | ClassicPeopleSearchParams[];
      sales_navigator?: SalesNavigatorPeopleSearchParams | SalesNavigatorPeopleSearchParams[];
      recruiter?: RecruiterPeopleSearchParams | RecruiterPeopleSearchParams[];
    }>(cacheFilePath);
    if (cached) {
      result.unresolvedParameters = cached;
      result.timing.parameterGeneration = Date.now() - parameterStart;
      console.log(`[${index}] ✓ Unresolved parameters loaded from cache (${result.timing.parameterGeneration}ms)`);
      return;
    }
  }

  // If we need to generate new parameters, ensure we have booleanQueryResponse
  // Try to load from cache if not already available
  if (!result.booleanQueryResponse) {
    const booleanQueryCachePath = getCacheFilePath(index, 'boolean-query');
    const cachedBooleanQuery = readCache<{ finalBooleanQuery: string; booleanQueryResponse: any }>(booleanQueryCachePath);
    if (cachedBooleanQuery) {
      result.booleanQueryResponse = cachedBooleanQuery.booleanQueryResponse;
      result.finalBooleanQuery = cachedBooleanQuery.finalBooleanQuery;
      console.log(`[${index}]   Loaded booleanQueryResponse from cache for parameter generation`);
    }
  }

  if (!result.booleanQueryResponse) {
    throw new Error('booleanQueryResponse is required for generating unresolved parameters. Run boolean query step first or enable USE_CACHE_BOOLEAN_QUERY.');
  }

  const parameterPromises = SEARCH_TYPES.map(async (searchType) => {
    try {
      console.log(`[${index}]   Generating ${searchType} parameters...`);
      const searchTypeStart = Date.now();
      
      // Create a copy of booleanQueryResponse for this search type to avoid mutating the shared object
      const booleanQueryResponseCopy = JSON.parse(JSON.stringify(result.booleanQueryResponse));
      
      // Safely delete properties using optional chaining
      if (booleanQueryResponseCopy.boolean_components?.final_boolean_string !== undefined) {
        delete booleanQueryResponseCopy.boolean_components.final_boolean_string;
      }
      if (booleanQueryResponseCopy.boolean_components !== undefined) {
        delete booleanQueryResponseCopy.boolean_components;
      }
      if (booleanQueryResponseCopy.keyword_expansion !== undefined) {
        delete booleanQueryResponseCopy.keyword_expansion;
      }
      if (booleanQueryResponseCopy.requirement !== undefined) {
        delete booleanQueryResponseCopy.requirement;
      }


      const parameterResponse = await axios.post(
        `${SERVER_URL}/candidate-search/test/generate-unresolved-parameters`,
        {
          booleanQueryResponse: booleanQueryResponseCopy,
          rawInput: rawQuery,
          searchType,
        },
        {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
          validateStatus: (status) => status < 500,
        }
      );

      if (parameterResponse.status >= 400) {
        throw new Error(
          `HTTP ${parameterResponse.status}: ${parameterResponse.data?.message || parameterResponse.statusText || 'Request failed'}`
        );
      }

      const searchTypeTime = Date.now() - searchTypeStart;
      const allParameters =
        parameterResponse.data.results || (parameterResponse.data.parameters ? [parameterResponse.data.parameters] : []);
      console.log(
        `[${index}]     ✓ ${searchType} parameters generated (${searchTypeTime}ms) - ${allParameters.length} parameter set(s)`
      );

      return {
        searchType,
        parameters: allParameters as PeopleSearchParameters[], // Store all parameter sets, not just the first
        error: null,
      };
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.log(`[${index}]     ✗ ${searchType} parameters failed: ${errorMessage}`);
      return {
        searchType,
        parameters: null,
        error: errorMessage,
      };
    }
  });

  const parameterResults = await Promise.all(parameterPromises);

  // Store results - parameters is now an array of all parameter sets
  for (const { searchType, parameters, error } of parameterResults) {
    if (error) {
      console.log(`[${index}]   Error for ${searchType}: ${error}`);
      continue;
    }

    if (!parameters) {
      continue;
    }

    if (Array.isArray(parameters)) {
      if (searchType === 'classic') {
        result.unresolvedParameters.classic =
          parameters.length === 1 ? (parameters[0] as ClassicPeopleSearchParams) : (parameters as ClassicPeopleSearchParams[]);
      } else if (searchType === 'sales_navigator') {
        result.unresolvedParameters.sales_navigator =
          parameters.length === 1
            ? (parameters[0] as SalesNavigatorPeopleSearchParams)
            : (parameters as SalesNavigatorPeopleSearchParams[]);
      } else if (searchType === 'recruiter') {
        result.unresolvedParameters.recruiter =
          parameters.length === 1
            ? (parameters[0] as RecruiterPeopleSearchParams)
            : (parameters as RecruiterPeopleSearchParams[]);
      }
    } else {
      if (searchType === 'classic') {
        result.unresolvedParameters.classic = parameters as ClassicPeopleSearchParams;
      } else if (searchType === 'sales_navigator') {
        result.unresolvedParameters.sales_navigator = parameters as SalesNavigatorPeopleSearchParams;
      } else if (searchType === 'recruiter') {
        result.unresolvedParameters.recruiter = parameters as RecruiterPeopleSearchParams;
      }
    }
  }

  result.timing.parameterGeneration = Date.now() - parameterStart;
  
  // Save to cache
  writeCache(cacheFilePath, result.unresolvedParameters);
  
  console.log(`[${index}] ✓ Parameter generation completed (${result.timing.parameterGeneration}ms)`);
}

async function resolveParametersStep(index: number, result: TestResult): Promise<void> {
  console.log(`[${index}] Step 3: Resolving parameters (checking cache first)...`);
  const resolutionStart = Date.now();
  result.resolvedParameters = {};

  const cacheFilePath = getCacheFilePath(index, 'resolved-parameters');
  
  // Try to load from cache if enabled
  if (USE_CACHE_RESOLVED_PARAMETERS) {
    const cached = readCache<{
      classic?: ClassicPeopleSearchParams | ClassicPeopleSearchParams[];
      sales_navigator?: SalesNavigatorPeopleSearchParams | SalesNavigatorPeopleSearchParams[];
      recruiter?: RecruiterPeopleSearchParams | RecruiterPeopleSearchParams[];
    }>(cacheFilePath);
    if (cached) {
      result.resolvedParameters = cached;
      result.timing.parameterResolution = Date.now() - resolutionStart;
      console.log(`[${index}] ✓ Resolved parameters loaded from cache (${result.timing.parameterResolution}ms)`);
      // Log all resolved parameters together
      console.log(`[${index}] All resolved parameters for all search types:`);
      console.log(JSON.stringify(result.resolvedParameters, null, 2));
      return;
    }
  }

  // If we need to resolve parameters, ensure we have unresolved parameters
  // Try to load from cache if not already available
  if (!result.unresolvedParameters) {
    const unresolvedCachePath = getCacheFilePath(index, 'unresolved-parameters');
    const cachedUnresolved = readCache<{
      classic?: ClassicPeopleSearchParams | ClassicPeopleSearchParams[];
      sales_navigator?: SalesNavigatorPeopleSearchParams | SalesNavigatorPeopleSearchParams[];
      recruiter?: RecruiterPeopleSearchParams | RecruiterPeopleSearchParams[];
    }>(unresolvedCachePath);
    if (cachedUnresolved) {
      result.unresolvedParameters = cachedUnresolved;
      console.log(`[${index}]   Loaded unresolved parameters from cache for resolution`);
    }
  }

  for (const searchType of SEARCH_TYPES) {
    if (!result.unresolvedParameters || !result.unresolvedParameters[searchType]) {
      console.log(`[${index}]   Skipping ${searchType} resolution (no unresolved parameters)`);
      continue;
    }

    try {
      // Check if we have multiple parameter sets (array) or a single one
      const unresolvedParams = result.unresolvedParameters[searchType];
      const paramSets = Array.isArray(unresolvedParams) ? unresolvedParams : [unresolvedParams];

      console.log(
        `[${index}]   Resolving ${searchType} parameters (${paramSets.length} parameter set(s))...`
      );
      const resolveStart = Date.now();

      // Resolve all parameter sets
      const resolvedSets: PeopleSearchParameters[] = [];
      for (let i = 0; i < paramSets.length; i++) {
        const paramSet = paramSets[i];
        try {
          const resolveResponse = await axios.post<{
            resolvedParameters: PeopleSearchParameters;
          }>(
            `${SERVER_URL}/candidate-search/test/resolve-parameters`,
            {
              unresolvedParameters: paramSet,
              searchType,
              searchCategory: 'people',
            },
            {
              headers: {
                Authorization: `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
              },
              timeout: 120000,
              validateStatus: (status) => status < 500,
            }
          );

          if (resolveResponse.status >= 400) {
            const errorData = resolveResponse.data as { message?: string };
            throw new Error(
              `HTTP ${resolveResponse.status}: ${errorData?.message || resolveResponse.statusText || 'Request failed'}`
            );
          }

          resolvedSets.push(resolveResponse.data.resolvedParameters);
          console.log(`[${index}]     ✓ ${searchType} parameter set ${i + 1}/${paramSets.length} resolved`);
        } catch (error: unknown) {
          let errorMessage = 'Unknown error';
          if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.message || error.message || 'Unknown error';
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          console.log(
            `[${index}]     ✗ ${searchType} parameter set ${i + 1}/${paramSets.length} resolution failed: ${errorMessage}`
          );
          // If resolution fails, use unresolved parameters
          resolvedSets.push(paramSet as PeopleSearchParameters);
        }
      }

      // Store resolved parameters (single object if only one set, array if multiple)
      if (searchType === 'classic') {
        result.resolvedParameters.classic =
          resolvedSets.length === 1
            ? (resolvedSets[0] as ClassicPeopleSearchParams)
            : (resolvedSets as ClassicPeopleSearchParams[]);
      } else if (searchType === 'sales_navigator') {
        result.resolvedParameters.sales_navigator =
          resolvedSets.length === 1
            ? (resolvedSets[0] as SalesNavigatorPeopleSearchParams)
            : (resolvedSets as SalesNavigatorPeopleSearchParams[]);
      } else if (searchType === 'recruiter') {
        result.resolvedParameters.recruiter =
          resolvedSets.length === 1
            ? (resolvedSets[0] as RecruiterPeopleSearchParams)
            : (resolvedSets as RecruiterPeopleSearchParams[]);
      }

      const resolveTime = Date.now() - resolveStart;
      console.log(`[${index}]     ✓ ${searchType} all parameters resolved (${resolveTime}ms)`);

      // Log all resolved parameter sets
      if (resolvedSets.length === 1) {
        console.log(
          `[${index}]     Final resolved ${searchType} parameters:`,
          JSON.stringify(resolvedSets[0], null, 2)
        );
      } else {
        console.log(
          `[${index}]     Final resolved ${searchType} parameters (${resolvedSets.length} sets):`
        );
        resolvedSets.forEach((params, idx) => {
          console.log(`[${index}]       Set ${idx + 1}:`, JSON.stringify(params, null, 2));
        });
      }
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.log(`[${index}]     ✗ ${searchType} resolution failed: ${errorMessage}`);
      // If resolution fails, use unresolved parameters
      const unresolvedParams = result.unresolvedParameters?.[searchType];
      if (unresolvedParams) {
        if (searchType === 'classic') {
          result.resolvedParameters.classic = unresolvedParams as
            | ClassicPeopleSearchParams
            | ClassicPeopleSearchParams[];
        } else if (searchType === 'sales_navigator') {
          result.resolvedParameters.sales_navigator = unresolvedParams as
            | SalesNavigatorPeopleSearchParams
            | SalesNavigatorPeopleSearchParams[];
        } else if (searchType === 'recruiter') {
          result.resolvedParameters.recruiter = unresolvedParams as
            | RecruiterPeopleSearchParams
            | RecruiterPeopleSearchParams[];
        }
      }
    }
  }

  result.timing.parameterResolution = Date.now() - resolutionStart;
  
  // Save to cache
  writeCache(cacheFilePath, result.resolvedParameters);
  
  console.log(`[${index}] ✓ Parameter resolution completed (${result.timing.parameterResolution}ms)`);

  // Log all resolved parameters together
  console.log(`[${index}] All resolved parameters for all search types:`);
  console.log(JSON.stringify(result.resolvedParameters, null, 2));
}

async function generateLinkedInUrlsStep(index: number, result: TestResult): Promise<void> {
  console.log(`[${index}] Step 4: Generating LinkedIn URLs...`);
  const urlStart = Date.now();
  result.linkedInUrls = {};

  const cacheFilePath = getCacheFilePath(index, 'linkedin-urls');
  
  // Try to load from cache if enabled
  if (USE_CACHE_LINKEDIN_URLS) {
    const cached = readCache<{
      classic?: string | null | (string | null)[];
      sales_navigator?: string | null | (string | null)[];
      recruiter?: string | null | (string | null)[];
    }>(cacheFilePath);
    if (cached) {
      result.linkedInUrls = cached;
      result.timing.urlGeneration = Date.now() - urlStart;
      console.log(`[${index}] ✓ LinkedIn URLs loaded from cache (${result.timing.urlGeneration}ms)`);
      return;
    }
  }

  // If we need to generate URLs, ensure we have resolved parameters
  // Try to load from cache if not already available
  if (!result.resolvedParameters) {
    const resolvedCachePath = getCacheFilePath(index, 'resolved-parameters');
    const cachedResolved = readCache<{
      classic?: ClassicPeopleSearchParams | ClassicPeopleSearchParams[];
      sales_navigator?: SalesNavigatorPeopleSearchParams | SalesNavigatorPeopleSearchParams[];
      recruiter?: RecruiterPeopleSearchParams | RecruiterPeopleSearchParams[];
    }>(resolvedCachePath);
    if (cachedResolved) {
      result.resolvedParameters = cachedResolved;
      console.log(`[${index}]   Loaded resolved parameters from cache for URL generation`);
    }
  }

  for (const searchType of SEARCH_TYPES) {
    if (!result.resolvedParameters || !result.resolvedParameters[searchType]) {
      console.log(`[${index}]   Skipping ${searchType} URL generation (no resolved parameters)`);
      result.linkedInUrls[searchType] = null;
      continue;
    }

    try {
      // Handle both single parameter set and multiple parameter sets
      const resolvedParams = result.resolvedParameters[searchType];
      const paramSets = Array.isArray(resolvedParams) ? resolvedParams : [resolvedParams];

      // Generate URLs for all parameter sets
      const urls: (string | null)[] = [];
      for (let i = 0; i < paramSets.length; i++) {
        const paramSet = paramSets[i];
        try {
          const urlResponse = await axios.post(
            `${SERVER_URL}/candidate-search/test/generate-linkedin-url`,
            {
              resolvedParameters: paramSet,
              searchType,
              searchCategory: 'people',
            },
            {
              headers: {
                Authorization: `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
              },
              timeout: 30000,
              validateStatus: (status) => status < 500,
            }
          );

          if (urlResponse.status >= 400) {
            throw new Error(
              `HTTP ${urlResponse.status}: ${urlResponse.data?.message || urlResponse.statusText || 'Request failed'}`
            );
          }

          const url = urlResponse.data.linkedInUrl || null;
          urls.push(url);
          if (paramSets.length === 1) {
            console.log(`[${index}]     ✓ ${searchType} URL: ${url || 'null'}`);
          } else {
            console.log(
              `[${index}]     ✓ ${searchType} URL ${i + 1}/${paramSets.length}: ${url || 'null'}`
            );
          }
        } catch (error: unknown) {
          let errorMessage = 'Unknown error';
          if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.message || error.message || 'Unknown error';
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          console.log(
            `[${index}]     ✗ ${searchType} URL ${i + 1}/${paramSets.length} generation failed: ${errorMessage}`
          );
          urls.push(null);
        }
      }

      // Store URLs (single string if only one set, array if multiple)
      result.linkedInUrls[searchType] = (urls.length === 1 ? urls[0] : urls) as
        | string
        | null
        | (string | null)[];
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.log(`[${index}]     ✗ ${searchType} URL generation failed: ${errorMessage}`);
      result.linkedInUrls[searchType] = null;
    }
  }

  result.timing.urlGeneration = Date.now() - urlStart;
  
  // Save to cache
  writeCache(cacheFilePath, result.linkedInUrls);
  
  console.log(`[${index}] ✓ URL generation completed (${result.timing.urlGeneration}ms)`);
}

async function executeParameterSearchStep(
  rawQuery: string,
  index: number,
  result: TestResult,
): Promise<void> {
  console.log(`[${index}] Step 5: Executing parameter searches (without validation/scoring)...`);
  const searchStart = Date.now();
  result.searchResults = {};

  // Try to load from cache if enabled
  for (const searchType of SEARCH_TYPES) {
    const cacheFilePath = getCacheFilePath(index, `search-results-${searchType}`);
    
    if (USE_CACHE_SEARCH_RESULTS) {
      const cached = readCache<SearchExecutionResult | null>(cacheFilePath);
      if (cached !== null) {
        result.searchResults[searchType] = cached;
        console.log(`[${index}]   ✓ ${searchType} search results loaded from cache`);
        continue;
      }
    }

    // If we need to execute search, ensure we have resolved parameters
    if (!result.resolvedParameters || !result.resolvedParameters[searchType]) {
      console.log(`[${index}]   Skipping ${searchType} search execution (no resolved parameters)`);
      result.searchResults[searchType] = null;
      continue;
    }

    try {
      const resolvedParams = result.resolvedParameters[searchType];
      const paramSets = Array.isArray(resolvedParams) ? resolvedParams : [resolvedParams];

      // Execute search for the first parameter set (primary strategy)
      const paramSet = paramSets[0];
      
      console.log(`[${index}]   Executing ${searchType} search...`);
      const searchTypeStart = Date.now();

      const searchResponse = await axios.post(
        `${SERVER_URL}/candidate-search/test/execute-parameter-search`,
        {
          resolvedParameters: paramSet,
          searchType,
          searchCategory: 'people',
          maxPages: 7, // Default max pages
        },
        {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000, // 5 minutes for search execution
          validateStatus: (status) => status < 500,
        }
      );

      if (searchResponse.status >= 400) {
        throw new Error(
          `HTTP ${searchResponse.status}: ${searchResponse.data?.message || searchResponse.statusText || 'Request failed'}`
        );
      }

      const searchResult = searchResponse.data.searchResult as SearchExecutionResult | null;
      result.searchResults[searchType] = searchResult;

      const searchTypeTime = Date.now() - searchTypeStart;
      if (searchResult) {
        console.log(
          `[${index}]     ✓ ${searchType} search completed (${searchTypeTime}ms) - ${searchResult.itemCount} candidates found`
        );
      } else {
        console.log(`[${index}]     ✓ ${searchType} search completed (${searchTypeTime}ms) - no results`);
      }

      // Save to cache
      writeCache(cacheFilePath, searchResult);
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.log(`[${index}]     ✗ ${searchType} search execution failed: ${errorMessage}`);
      result.searchResults[searchType] = null;
    }
  }

  result.timing.searchExecution = Date.now() - searchStart;
  console.log(`[${index}] ✓ Search execution completed (${result.timing.searchExecution}ms)`);
}

async function validateParameterResultsStep(
  rawQuery: string,
  index: number,
  result: TestResult,
): Promise<void> {
  console.log(`[${index}] Step 6: Validating parameter results...`);
  const validationStart = Date.now();
  result.validationResults = {};
  result.overallValidation = {};

  // Try to load from cache if enabled
  for (const searchType of SEARCH_TYPES) {
    const cacheFilePath = getCacheFilePath(index, `validation-results-${searchType}`);
    
    if (USE_CACHE_VALIDATION_RESULTS) {
      const cached = readCache<{
        validationResults?: Array<{ page: number; validation: ResultValidationResult }>;
        overallValidation?: ResultValidationResult;
      }>(cacheFilePath);
      if (cached) {
        result.validationResults[searchType] = cached.validationResults;
        result.overallValidation[searchType] = cached.overallValidation;
        console.log(`[${index}]   ✓ ${searchType} validation results loaded from cache`);
        continue;
      }
    }

    // If we need to validate, ensure we have search results
    if (!result.searchResults || !result.searchResults[searchType]) {
      console.log(`[${index}]   Skipping ${searchType} validation (no search results available)`);
      continue;
    }

    const searchResult = result.searchResults[searchType];
    if (!searchResult || !searchResult.searchResults) {
      console.log(`[${index}]   Skipping ${searchType} validation (invalid search results)`);
      continue;
    }

    try {
      console.log(`[${index}]   Validating ${searchType} search results...`);
      const validationTypeStart = Date.now();

      // We need queryUnderstanding and userMessage for validation
      // For now, we'll skip if we don't have them (they would come from boolean query step)
      // In a full implementation, we'd need to pass these through the flow
      if (!result.booleanQueryResponse) {
        console.log(`[${index}]     ⚠ Skipping ${searchType} validation (no query understanding available - would need booleanQueryResponse)`);
        continue;
      }

      // Call validation endpoint with search results
      const validationResponse = await axios.post(
        `${SERVER_URL}/candidate-search/test/validate-parameter-results`,
        {
          searchResults: {
            searchResults: searchResult.searchResults,
            transformedCandidates: searchResult.transformedCandidates,
          },
          queryUnderstanding: result.booleanQueryResponse.queryUnderstanding || {}, // Would need proper queryUnderstanding
          userMessage: rawQuery,
          searchType,
          searchCategory: 'people',
          pageSize: 25,
        },
        {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000, // 5 minutes for validation
          validateStatus: (status) => status < 500,
        }
      );

      if (validationResponse.status >= 400) {
        throw new Error(
          `HTTP ${validationResponse.status}: ${validationResponse.data?.message || validationResponse.statusText || 'Request failed'}`
        );
      }

      const validationData = validationResponse.data;
      result.validationResults[searchType] = validationData.validationResults || [];
      result.overallValidation[searchType] = validationData.overallValidation;

      const validationTypeTime = Date.now() - validationTypeStart;
      console.log(
        `[${index}]     ✓ ${searchType} validation completed (${validationTypeTime}ms) - ${validationData.validationResults?.length || 0} page(s) validated`
      );
      if (validationData.overallValidation) {
        console.log(
          `[${index}]       Overall validation: ${(validationData.overallValidation.relevanceScore * 100).toFixed(0)}% relevance, ${validationData.overallValidation.qualityAssessment} quality`
        );
      }

      // Save to cache
      writeCache(cacheFilePath, {
        validationResults: result.validationResults[searchType],
        overallValidation: result.overallValidation[searchType],
      });
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.log(`[${index}]     ✗ ${searchType} validation failed: ${errorMessage}`);
    }
  }

  result.timing.resultValidation = Date.now() - validationStart;
  console.log(`[${index}] ✓ Result validation completed (${result.timing.resultValidation}ms)`);
}

async function scoreParameterResultsStep(
  rawQuery: string,
  index: number,
  result: TestResult,
): Promise<void> {
  console.log(`[${index}] Step 7: Scoring parameter results...`);
  const scoringStart = Date.now();
  result.candidateScores = {};

  // Try to load from cache if enabled
  for (const searchType of SEARCH_TYPES) {
    const cacheFilePath = getCacheFilePath(index, `scoring-results-${searchType}`);
    
    if (USE_CACHE_SCORING_RESULTS) {
      const cached = readCache<Array<{ candidateId: string; candidateName: string; score: CandidateRelevanceScoring }>>(cacheFilePath);
      if (cached) {
        result.candidateScores[searchType] = cached;
        console.log(`[${index}]   ✓ ${searchType} scoring results loaded from cache (${cached.length} candidates)`);
        continue;
      }
    }

    // If we need to score, ensure we have search results
    if (!result.searchResults || !result.searchResults[searchType]) {
      console.log(`[${index}]   Skipping ${searchType} scoring (no search results available)`);
      continue;
    }

    const searchResult = result.searchResults[searchType];
    if (!searchResult || !searchResult.searchResults) {
      console.log(`[${index}]   Skipping ${searchType} scoring (invalid search results)`);
      continue;
    }

    try {
      console.log(`[${index}]   Scoring ${searchType} search results...`);
      const scoringTypeStart = Date.now();

      // We need queryUnderstanding and userMessage for scoring
      // For now, we'll skip if we don't have them
      if (!result.booleanQueryResponse) {
        console.log(`[${index}]     ⚠ Skipping ${searchType} scoring (no query understanding available - would need booleanQueryResponse)`);
        continue;
      }

      // Call scoring endpoint with search results
      const scoringResponse = await axios.post(
        `${SERVER_URL}/candidate-search/test/score-parameter-results`,
        {
          searchResults: {
            searchResults: searchResult.searchResults,
            transformedCandidates: searchResult.transformedCandidates,
          },
          queryUnderstanding: result.booleanQueryResponse.queryUnderstanding || {}, // Would need proper queryUnderstanding
          userMessage: rawQuery,
          searchType,
          searchCategory: 'people',
          pageSize: 25,
        },
        {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000, // 5 minutes for scoring
          validateStatus: (status) => status < 500,
        }
      );

      if (scoringResponse.status >= 400) {
        throw new Error(
          `HTTP ${scoringResponse.status}: ${scoringResponse.data?.message || scoringResponse.statusText || 'Request failed'}`
        );
      }

      const scoringData = scoringResponse.data;
      result.candidateScores[searchType] = scoringData.scores || [];

      const scoringTypeTime = Date.now() - scoringTypeStart;
      console.log(
        `[${index}]     ✓ ${searchType} scoring completed (${scoringTypeTime}ms) - ${scoringData.scores?.length || 0} candidates scored across ${scoringData.scoresByPage?.length || 0} page(s)`
      );

      // Save to cache
      writeCache(cacheFilePath, scoringData.scores || []);
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.log(`[${index}]     ✗ ${searchType} scoring failed: ${errorMessage}`);
    }
  }

  result.timing.candidateScoring = Date.now() - scoringStart;
  console.log(`[${index}] ✓ Candidate scoring completed (${result.timing.candidateScoring}ms)`);
}

async function processRawQuery(rawQuery: string, index: number): Promise<TestResult> {
  const startTime = Date.now();

  const result: TestResult = {
    booleanQueryResponse: null,
    rawQuery,
    timing: {
      booleanQueryGeneration: 0,
      parameterGeneration: 0,
      parameterResolution: 0,
      urlGeneration: 0,
      searchExecution: 0,
      resultValidation: 0,
      candidateScoring: 0,
      total: 0,
    },
  };

  console.log(`\n[${index}] Processing: ${rawQuery.substring(0, 80)}...`);

  try {
    // Pre-step: Clean up query to make it realistic for profile text
    const effectiveQuery = RUN_CLEANUP_STEP
      ? await cleanupQueryStep(rawQuery, index, result)
      : rawQuery;

    // Step 1: Generate final boolean query
    if (RUN_BOOLEAN_QUERY_STEP) {
      await generateFinalBooleanQueryStep(effectiveQuery, index, result);
    } else {
      console.log(`[${index}] Step 1: Skipped (RUN_BOOLEAN_QUERY_STEP = false)`);
    }

    // Step 2: Generate unresolved parameters for all search types (in parallel)
    if (RUN_UNRESOLVED_PARAMETERS_STEP) {
      await generateUnresolvedParametersStep(effectiveQuery, index, result);
    } else {
      console.log(`[${index}] Step 2: Skipped (RUN_UNRESOLVED_PARAMETERS_STEP = false)`);
    }

    // Step 3: Resolve parameters (check cache first, then resolve if needed)
    if (RUN_RESOLVED_PARAMETERS_STEP) {
      await resolveParametersStep(index, result);
    } else {
      console.log(`[${index}] Step 3: Skipped (RUN_RESOLVED_PARAMETERS_STEP = false)`);
    }

    // Step 4: Generate LinkedIn URLs
    if (RUN_LINKEDIN_URLS_STEP) {
      await generateLinkedInUrlsStep(index, result);
    } else {
      console.log(`[${index}] Step 4: Skipped (RUN_LINKEDIN_URLS_STEP = false)`);
    }

    // Step 5: Execute parameter searches
    if (RUN_SEARCH_EXECUTION_STEP) {
      await executeParameterSearchStep(rawQuery, index, result);
    } else {
      console.log(`[${index}] Step 5: Skipped (RUN_SEARCH_EXECUTION_STEP = false)`);
    }

    // Step 6: Validate parameter results
    if (RUN_RESULT_VALIDATION_STEP) {
      await validateParameterResultsStep(rawQuery, index, result);
    } else {
      console.log(`[${index}] Step 6: Skipped (RUN_RESULT_VALIDATION_STEP = false)`);
    }

    // Step 7: Score parameter results
    if (RUN_CANDIDATE_SCORING_STEP) {
      await scoreParameterResultsStep(rawQuery, index, result);
    } else {
      console.log(`[${index}] Step 7: Skipped (RUN_CANDIDATE_SCORING_STEP = false)`);
    }

    result.timing.total = Date.now() - startTime;
    console.log(`[${index}] ✓ Processing completed in ${result.timing.total}ms`);

    return result;
  } catch (error: unknown) {
    result.timing.total = Date.now() - startTime;

    let errorMessage = 'Unknown error';
    if (axios.isAxiosError(error)) {
      if (error.response) {
        errorMessage =
          error.response.data?.message ||
          (error.response.data as { error?: string })?.error ||
          error.response.statusText ||
          `HTTP ${error.response.status}`;
      } else if (error.request) {
        errorMessage = `No response from server: ${error.message || 'Network error'}`;
      } else {
        errorMessage = error.message || 'Unknown error';
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    result.error = errorMessage;
    console.log(`[${index}] ✗ Failed after ${result.timing.total}ms: ${result.error}`);
    if (error instanceof Error && error.stack && process.env.DEBUG) {
      console.log(`[${index}] Error stack:`, error.stack);
    }
    return result;
  }
}

/**
 * Read requirements from file and extract 10-15 requirements
 */
function extractRequirements(): string[] {
  const content = fs.readFileSync(REQUIREMENTS_FILE, 'utf-8');
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Filter out section headers (lines that are just category names with numbers)
  const requirements = lines.filter(line => {
    // Skip lines that look like headers: "Category Name (number)" or just "Category Name"
    if (/^[A-Z][a-z\s&]+(\s+\(\d+\))?$/.test(line) && !line.includes('for') && !line.includes('Looking')) {
      return false;
    }
    // Skip empty lines and very short lines
    if (line.length < 20) {
      return false;
    }
    return true;
  });

  // Take 10-15 requirements (let's take 12)
  return requirements.slice(0,1);
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Candidate Search Flow Test');
  console.log('='.repeat(80));
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`API Token: ${API_TOKEN ? '***' + API_TOKEN.slice(-4) : 'NOT SET'}`);
  console.log(`Requirements File: ${REQUIREMENTS_FILE}`);
  console.log('='.repeat(80));

  if (!API_TOKEN) {
    console.error('\n❌ ERROR: API_TOKEN environment variable is required');
    console.error('   Set it with: export API_TOKEN=your_token_here');
    process.exit(1);
  }

  if (!fs.existsSync(REQUIREMENTS_FILE)) {
    console.error(`\n❌ ERROR: Requirements file not found: ${REQUIREMENTS_FILE}`);
    process.exit(1);
  }

  // Test server connectivity
  console.log('\n🔍 Testing server connectivity...');
  try {
    const healthCheck = await axios.get(`${SERVER_URL}/health`, {
      timeout: 5000,
      validateStatus: () => true, // Don't throw on any status
    });
    if (healthCheck.status === 200) {
      console.log('✓ Server is reachable');
    } else {
      console.log(`⚠ Server responded with status ${healthCheck.status} (this is OK if health endpoint doesn't exist)`);
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`\n❌ ERROR: Cannot connect to server at ${SERVER_URL}`);
        console.error('   Make sure the server is running and accessible');
        process.exit(1);
      } else if (error.code === 'ENOTFOUND') {
        console.error(`\n❌ ERROR: Server hostname not found: ${SERVER_URL}`);
        console.error('   Check your SERVER_URL environment variable');
        process.exit(1);
      } else {
        const errorMessage = error.message || 'Unknown error';
        console.log(`⚠ Connectivity check failed: ${errorMessage} (continuing anyway)`);
      }
    } else if (error instanceof Error) {
      console.log(`⚠ Connectivity check failed: ${error.message} (continuing anyway)`);
    } else {
      console.log(`⚠ Connectivity check failed: Unknown error (continuing anyway)`);
    }
  }

  const requirements = extractRequirements();
  console.log(`\n📋 Found ${requirements.length} requirements to process\n`);

  // Process all raw queries in parallel
  console.log('🚀 Starting parallel processing...\n');
  const startTime = Date.now();
  
  const results = await Promise.all(
    requirements.map((req, index) => processRawQuery(req, index + 1))
  );

  const totalTime = Date.now() - startTime;
 
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Raw Queries: ${requirements.length}`);
  console.log(`Total Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
  console.log(`Average Time per Query: ${(totalTime / requirements.length).toFixed(0)}ms`);

  const successful = results.filter(r => !r.error && r.finalBooleanQuery && r.resolvedParameters);
  const failed = results.filter(r => r.error || !r.finalBooleanQuery);

  console.log(`\n✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  // Count URLs generated
  const urlsGenerated = results.reduce((count, r) => {
    if (r.linkedInUrls) {
      return count + Object.values(r.linkedInUrls).reduce((urlCount, url) => {
        if (url === null) return urlCount;
        if (Array.isArray(url)) {
          return urlCount + url.filter(u => u !== null).length;
        }
        return urlCount + 1;
      }, 0);
    }
    return count;
  }, 0);
  console.log(`🔗 LinkedIn URLs Generated: ${urlsGenerated}`);

  // Count search results
  const searchResultsCount = results.reduce((count, r) => {
    if (r.searchResults) {
      return count + Object.values(r.searchResults).reduce((resultCount, result) => {
        if (result && result.itemCount) {
          return resultCount + result.itemCount;
        }
        return resultCount;
      }, 0);
    }
    return count;
  }, 0);
  console.log(`🔍 Candidates Found: ${searchResultsCount}`);

  // Count validation results
  const validationResultsCount = results.reduce((count, r) => {
    if (r.validationResults) {
      return count + Object.values(r.validationResults).reduce((validationCount, validations) => {
        if (validations && Array.isArray(validations)) {
          return validationCount + validations.length;
        }
        return validationCount;
      }, 0);
    }
    return count;
  }, 0);
  console.log(`✅ Validation Results: ${validationResultsCount} page(s)`);

  // Count scored candidates
  const scoredCandidatesCount = results.reduce((count, r) => {
    if (r.candidateScores) {
      return count + Object.values(r.candidateScores).reduce((scoreCount, scores) => {
        if (scores && Array.isArray(scores)) {
          return scoreCount + scores.length;
        }
        return scoreCount;
      }, 0);
    }
    return count;
  }, 0);
  console.log(`⭐ Candidates Scored: ${scoredCandidatesCount}`);

  // Detailed results
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(80));

  console.log(JSON.stringify(results, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('Test completed!');
  console.log('='.repeat(80));
}



// Run the test
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
