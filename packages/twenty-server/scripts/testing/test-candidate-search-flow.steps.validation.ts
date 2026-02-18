import axios from 'axios';
import { getCacheFilePath, readCache, writeCache } from './test-candidate-search-flow.cache';
import {
  API_TOKEN,
  SEARCH_TYPES,
  SERVER_URL,
  USE_CACHE_SCORING_RESULTS,
  USE_CACHE_SEARCH_RESULTS,
  USE_CACHE_VALIDATION_RESULTS,
} from './test-candidate-search-flow.config';
import type {
  CandidateRelevanceScoring,
  ResultValidationResult,
  ScoringStepOutput,
  SearchExecutionResult,
  TestResult,
  ValidationStepOutput,
} from './test-candidate-search-flow.types';

export async function validateParameterResultsStep(
  rawQuery: string,
  index: number,
  searchResults: TestResult['searchResults'],
  booleanQueryResponse: unknown,
): Promise<ValidationStepOutput> {
  console.log(`[${index}] Step 7: Validating parameter results...`);
  const validationStart = Date.now();

  const validationResults: ValidationStepOutput['validationResults'] = {};
  const overallValidation: ValidationStepOutput['overallValidation'] = {};

  let effectiveSearchResults = searchResults;
  let effectiveBooleanQueryResponse = booleanQueryResponse;

  for (const searchType of SEARCH_TYPES) {
    const cacheFilePath = getCacheFilePath(index, `validation-results-${searchType}`);

    if (USE_CACHE_VALIDATION_RESULTS) {
      const cached = readCache<{
        validationResults?: Array<{ page: number; validation: ResultValidationResult }>;
        overallValidation?: ResultValidationResult;
      }>(cacheFilePath);
      if (cached) {
        validationResults[searchType] = cached.validationResults;
        overallValidation[searchType] = cached.overallValidation;
        console.log(`[${index}]   ✓ ${searchType} validation results loaded from cache`);
        continue;
      }
    }

    if (!effectiveSearchResults?.[searchType]) {
      if (USE_CACHE_SEARCH_RESULTS) {
        const searchResultsCachePath = getCacheFilePath(index, `search-results-${searchType}`);
        const cachedSearchResult = readCache<SearchExecutionResult | null>(searchResultsCachePath);
        if (cachedSearchResult) {
          if (!effectiveSearchResults) {
            effectiveSearchResults = {};
          }
          effectiveSearchResults = { ...effectiveSearchResults, [searchType]: cachedSearchResult };
          console.log(
            `[${index}]   ✓ ${searchType} search results loaded from cache for validation`,
          );
        }
      }

      if (!effectiveSearchResults?.[searchType]) {
        console.log(
          `[${index}]   Skipping ${searchType} validation (no search results available)`,
        );
        continue;
      }
    }

    const searchResult = effectiveSearchResults[searchType];
    if (!searchResult || !searchResult.searchResults) {
      console.log(`[${index}]   Skipping ${searchType} validation (invalid search results)`);
      continue;
    }

    try {
      console.log(`[${index}]   Validating ${searchType} search results...`);
      const validationTypeStart = Date.now();

      if (!effectiveBooleanQueryResponse) {
        const booleanQueryCachePath = getCacheFilePath(index, 'boolean-query');
        const cachedBooleanQuery = readCache<{
          finalBooleanQuery: string;
          booleanQueryResponse: unknown;
        }>(booleanQueryCachePath);
        if (cachedBooleanQuery) {
          effectiveBooleanQueryResponse = cachedBooleanQuery.booleanQueryResponse;
          console.log(
            `[${index}]     Loaded booleanQueryResponse from cache for validation`,
          );
        }
      }

      if (!effectiveBooleanQueryResponse) {
        console.log(
          `[${index}]     ⚠ Skipping ${searchType} validation (no query understanding available - would need booleanQueryResponse)`,
        );
        continue;
      }

      const validationResponse = await axios.post(
        `${SERVER_URL}/candidate-search/pipeline/validate-parameter-results`,
        {
          searchResults: {
            searchResults: searchResult.searchResults,
            transformedCandidates: searchResult.transformedCandidates,
          },
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
          timeout: 300000,
          validateStatus: (status) => status < 500,
        },
      );

      if (validationResponse.status >= 400) {
        throw new Error(
          `HTTP ${validationResponse.status}: ${validationResponse.data?.message || validationResponse.statusText || 'Request failed'}`,
        );
      }

      const validationData = validationResponse.data;
      const pageValidationResults = validationData.validationResults || [];
      const pageOverallValidation = validationData.overallValidation;
      validationResults[searchType] = pageValidationResults;
      overallValidation[searchType] = pageOverallValidation;

      const validationTypeTime = Date.now() - validationTypeStart;
      console.log(
        `[${index}]     ✓ ${searchType} validation completed (${validationTypeTime}ms) - ${pageValidationResults.length} page(s) validated`,
      );
      if (pageOverallValidation) {
        console.log(
          `[${index}]       Overall validation: ${(pageOverallValidation.relevanceScore * 100).toFixed(0)}% relevance, ${pageOverallValidation.qualityAssessment} quality`,
        );
      }

      writeCache(cacheFilePath, {
        validationResults: pageValidationResults,
        overallValidation: pageOverallValidation,
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

  const timingMs = Date.now() - validationStart;
  console.log(`[${index}] ✓ Result validation completed (${timingMs}ms)`);

  return { validationResults, overallValidation, timingMs };
}

export async function scoreParameterResultsStep(
  rawQuery: string,
  index: number,
  searchResults: TestResult['searchResults'],
  booleanQueryResponse: unknown,
): Promise<ScoringStepOutput> {
  console.log(`[${index}] Step 8: Scoring parameter results...`);
  const scoringStart = Date.now();

  const candidateScores: ScoringStepOutput['candidateScores'] = {};

  let effectiveSearchResults = searchResults;
  let effectiveBooleanQueryResponse = booleanQueryResponse;

  for (const searchType of SEARCH_TYPES) {
    const cacheFilePath = getCacheFilePath(index, `scoring-results-${searchType}`);

    if (USE_CACHE_SCORING_RESULTS) {
      const cached = readCache<Array<{
        candidateId: string;
        candidateName: string;
        score: CandidateRelevanceScoring;
      }>>(cacheFilePath);
      if (cached) {
        candidateScores[searchType] = cached;
        console.log(
          `[${index}]   ✓ ${searchType} scoring results loaded from cache (${cached.length} candidates)`,
        );
        continue;
      }
    }

    if (!effectiveSearchResults?.[searchType]) {
      if (USE_CACHE_SEARCH_RESULTS) {
        const searchResultsCachePath = getCacheFilePath(index, `search-results-${searchType}`);
        const cachedSearchResult = readCache<SearchExecutionResult | null>(searchResultsCachePath);
        if (cachedSearchResult) {
          if (!effectiveSearchResults) {
            effectiveSearchResults = {};
          }
          effectiveSearchResults = { ...effectiveSearchResults, [searchType]: cachedSearchResult };
          console.log(
            `[${index}]   ✓ ${searchType} search results loaded from cache for scoring`,
          );
        }
      }

      if (!effectiveSearchResults?.[searchType]) {
        console.log(
          `[${index}]   Skipping ${searchType} scoring (no search results available)`,
        );
        continue;
      }
    }

    const searchResult = effectiveSearchResults[searchType];
    if (!searchResult || !searchResult.searchResults) {
      console.log(`[${index}]   Skipping ${searchType} scoring (invalid search results)`);
      continue;
    }

    try {
      console.log(`[${index}]   Scoring ${searchType} search results...`);
      const scoringTypeStart = Date.now();

      if (!effectiveBooleanQueryResponse) {
        const booleanQueryCachePath = getCacheFilePath(index, 'boolean-query');
        const cachedBooleanQuery = readCache<{
          finalBooleanQuery: string;
          booleanQueryResponse: unknown;
        }>(booleanQueryCachePath);
        if (cachedBooleanQuery) {
          effectiveBooleanQueryResponse = cachedBooleanQuery.booleanQueryResponse;
          console.log(
            `[${index}]     Loaded booleanQueryResponse from cache for scoring`,
          );
        }
      }

      if (!effectiveBooleanQueryResponse) {
        console.log(
          `[${index}]     ⚠ Skipping ${searchType} scoring (no query understanding available - would need booleanQueryResponse)`,
        );
        continue;
      }

      const scoringResponse = await axios.post(
        `${SERVER_URL}/candidate-search/pipeline/score-parameter-results`,
        {
          searchResults: {
            searchResults: searchResult.searchResults,
            transformedCandidates: searchResult.transformedCandidates,
          },
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
          timeout: 300000,
          validateStatus: (status) => status < 500,
        },
      );

      if (scoringResponse.status >= 400) {
        throw new Error(
          `HTTP ${scoringResponse.status}: ${scoringResponse.data?.message || scoringResponse.statusText || 'Request failed'}`,
        );
      }

      const scoringData = scoringResponse.data;
      const scores = scoringData.scores || [];
      candidateScores[searchType] = scores;

      const scoringTypeTime = Date.now() - scoringTypeStart;
      console.log(
        `[${index}]     ✓ ${searchType} scoring completed (${scoringTypeTime}ms) - ${scores.length} candidates scored across ${scoringData.scoresByPage?.length || 0} page(s)`,
      );

      writeCache(cacheFilePath, scores);
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

  const timingMs = Date.now() - scoringStart;
  console.log(`[${index}] ✓ Candidate scoring completed (${timingMs}ms)`);

  return { candidateScores, timingMs };
}
