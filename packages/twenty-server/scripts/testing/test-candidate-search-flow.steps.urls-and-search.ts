import axios from 'axios';
import {
  API_TOKEN,
  SEARCH_TYPES,
  SERVER_URL,
  USE_CACHE_LINKEDIN_URLS,
  USE_CACHE_SEARCH_RESULTS,
} from './test-candidate-search-flow.config';
import { getCacheFilePath, readCache, writeCache } from './test-candidate-search-flow.cache';
import type {
  ClassicPeopleSearchParams,
  LinkedInUrlsStepOutput,
  RecruiterPeopleSearchParams,
  SalesNavigatorPeopleSearchParams,
  SearchExecutionResult,
  SearchExecutionStepOutput,
  TestResult,
} from './test-candidate-search-flow.types';

type ResolvedParametersForSteps = NonNullable<TestResult['resolvedParameters']>;

export async function generateLinkedInUrlsStep(
  index: number,
  resolvedParameters: ResolvedParametersForSteps | undefined,
): Promise<LinkedInUrlsStepOutput> {
  console.log(`[${index}] Step 5: Generating LinkedIn URLs...`);
  const urlStart = Date.now();

  const cacheFilePath = getCacheFilePath(index, 'linkedin-urls');

  if (USE_CACHE_LINKEDIN_URLS) {
    const cached = readCache<{
      classic?: string | null | (string | null)[];
      sales_navigator?: string | null | (string | null)[];
      recruiter?: string | null | (string | null)[];
    }>(cacheFilePath);
    if (cached) {
      const timingMs = Date.now() - urlStart;
      console.log(`[${index}] ✓ LinkedIn URLs loaded from cache (${timingMs}ms)`);
      return { linkedInUrls: cached, timingMs };
    }
  }

  let effectiveResolved = resolvedParameters;
  if (!effectiveResolved) {
    const resolvedCachePath = getCacheFilePath(index, 'resolved-parameters');
    const cachedResolved = readCache<{
      classic?: ClassicPeopleSearchParams | ClassicPeopleSearchParams[];
      sales_navigator?: SalesNavigatorPeopleSearchParams | SalesNavigatorPeopleSearchParams[];
      recruiter?: RecruiterPeopleSearchParams | RecruiterPeopleSearchParams[];
    }>(resolvedCachePath);
    if (cachedResolved) {
      effectiveResolved = cachedResolved;
      console.log(`[${index}]   Loaded resolved parameters from cache for URL generation`);
    }
  }

  const linkedInUrls: LinkedInUrlsStepOutput['linkedInUrls'] = {};

  for (const searchType of SEARCH_TYPES) {
    if (!effectiveResolved || !effectiveResolved[searchType]) {
      console.log(`[${index}]   Skipping ${searchType} URL generation (no resolved parameters)`);
      linkedInUrls[searchType] = null;
      continue;
    }

    try {
      const resolvedParams = effectiveResolved[searchType];
      const paramSets = Array.isArray(resolvedParams) ? resolvedParams : [resolvedParams];

      const urls: (string | null)[] = [];
      for (let i = 0; i < paramSets.length; i++) {
        const paramSet = paramSets[i];
        try {
          const urlResponse = await axios.post(
            `${SERVER_URL}/candidate-search/pipeline/generate-linkedin-url`,
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
            },
          );

          if (urlResponse.status >= 400) {
            throw new Error(
              `HTTP ${urlResponse.status}: ${urlResponse.data?.message || urlResponse.statusText || 'Request failed'}`,
            );
          }

          const url = urlResponse.data.linkedInUrl || null;
          urls.push(url);
          if (paramSets.length === 1) {
            console.log(`[${index}]     ✓ ${searchType} URL: ${url || 'null'}`);
          } else {
            console.log(
              `[${index}]     ✓ ${searchType} URL ${i + 1}/${paramSets.length}: ${url || 'null'}`,
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
            `[${index}]     ✗ ${searchType} URL ${i + 1}/${paramSets.length} generation failed: ${errorMessage}`,
          );
          urls.push(null);
        }
      }

      linkedInUrls[searchType] = (urls.length === 1 ? urls[0] : urls) as
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
      linkedInUrls[searchType] = null;
    }
  }

  const timingMs = Date.now() - urlStart;

  writeCache(cacheFilePath, linkedInUrls);

  console.log(`[${index}] ✓ URL generation completed (${timingMs}ms)`);

  return { linkedInUrls, timingMs };
}

export async function executeParameterSearchStep(
  _rawQuery: string,
  index: number,
  resolvedParameters: ResolvedParametersForSteps | undefined,
): Promise<SearchExecutionStepOutput> {
  console.log(`[${index}] Step 6: Executing parameter searches (without validation/scoring)...`);
  const searchStart = Date.now();

  const searchResults: SearchExecutionStepOutput['searchResults'] = {};

  for (const searchType of SEARCH_TYPES) {
    const cacheFilePath = getCacheFilePath(index, `search-results-${searchType}`);

    if (USE_CACHE_SEARCH_RESULTS) {
      const cached = readCache<SearchExecutionResult | null>(cacheFilePath);
      if (cached !== null) {
        searchResults[searchType] = cached;
        console.log(`[${index}]   ✓ ${searchType} search results loaded from cache`);
        continue;
      }
    }

    if (!resolvedParameters || !resolvedParameters[searchType]) {
      console.log(`[${index}]   Skipping ${searchType} search execution (no resolved parameters)`);
      searchResults[searchType] = null;
      continue;
    }

    try {
      const resolvedParams = resolvedParameters[searchType];
      const paramSets = Array.isArray(resolvedParams) ? resolvedParams : [resolvedParams];

      const paramSet = paramSets[0];

      console.log(`[${index}]   Executing ${searchType} search...`);
      const searchTypeStart = Date.now();

      const searchResponse = await axios.post(
        `${SERVER_URL}/candidate-search/pipeline/execute-parameter-search`,
        {
          resolvedParameters: paramSet,
          searchType,
          searchCategory: 'people',
          maxPages: 7,
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

      if (searchResponse.status >= 400) {
        throw new Error(
          `HTTP ${searchResponse.status}: ${searchResponse.data?.message || searchResponse.statusText || 'Request failed'}`,
        );
      }

      const searchResult = searchResponse.data.searchResult as SearchExecutionResult | null;
      searchResults[searchType] = searchResult;

      const searchTypeTime = Date.now() - searchTypeStart;
      if (searchResult) {
        console.log(
          `[${index}]     ✓ ${searchType} search completed (${searchTypeTime}ms) - ${searchResult.itemCount} candidates found`,
        );
      } else {
        console.log(`[${index}]     ✓ ${searchType} search completed (${searchTypeTime}ms) - no results`);
      }

      writeCache(cacheFilePath, searchResult);
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.log(`[${index}]     ✗ ${searchType} search execution failed: ${errorMessage}`);
      searchResults[searchType] = null;
    }
  }

  const timingMs = Date.now() - searchStart;
  console.log(`[${index}] ✓ Search execution completed (${timingMs}ms)`);

  return { searchResults, timingMs };
}
