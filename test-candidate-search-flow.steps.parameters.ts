import axios from 'axios';
import { getCacheFilePath, readCache, writeCache } from './test-candidate-search-flow.cache';
import {
  API_TOKEN,
  SEARCH_TYPES,
  SERVER_URL,
  USE_CACHE_RESOLVED_PARAMETERS
} from './test-candidate-search-flow.config';
import type {
  ClassicPeopleSearchParams,
  PeopleSearchParameters,
  RecruiterPeopleSearchParams,
  ResolvedParametersStepOutput,
  SalesNavigatorPeopleSearchParams,
  UnresolvedParametersStepOutput,
} from './test-candidate-search-flow.types';


export async function resolveParametersStep(
  index: number,
  unresolvedParameters: UnresolvedParametersStepOutput['unresolvedParameters'] | undefined,
): Promise<ResolvedParametersStepOutput> {
  console.log(`[${index}] Step 4: Resolving parameters (checking cache first)...`);
  const resolutionStart = Date.now();

  const cacheFilePath = getCacheFilePath(index, 'resolved-parameters');

  if (USE_CACHE_RESOLVED_PARAMETERS) {
    const cached = readCache<{
      classic?: ClassicPeopleSearchParams | ClassicPeopleSearchParams[];
      sales_navigator?: SalesNavigatorPeopleSearchParams | SalesNavigatorPeopleSearchParams[];
      recruiter?: RecruiterPeopleSearchParams | RecruiterPeopleSearchParams[];
    }>(cacheFilePath);
    if (cached) {
      const timingMs = Date.now() - resolutionStart;
      console.log(`[${index}] ✓ Resolved parameters loaded from cache (${timingMs}ms)`);
      console.log(`[${index}] All resolved parameters for all search types:`);
      console.log(JSON.stringify(cached, null, 2));
      return { resolvedParameters: cached, timingMs };
    }
  }

  let effectiveUnresolved = unresolvedParameters;
  if (!effectiveUnresolved) {
    const unresolvedCachePath = getCacheFilePath(index, 'unresolved-parameters');
    const cachedUnresolved = readCache<{
      classic?: ClassicPeopleSearchParams | ClassicPeopleSearchParams[];
      sales_navigator?: SalesNavigatorPeopleSearchParams | SalesNavigatorPeopleSearchParams[];
      recruiter?: RecruiterPeopleSearchParams | RecruiterPeopleSearchParams[];
    }>(unresolvedCachePath);
    if (cachedUnresolved) {
      effectiveUnresolved = cachedUnresolved;
      console.log(`[${index}]   Loaded unresolved parameters from cache for resolution`);
    }
  }

  const resolvedParameters: ResolvedParametersStepOutput['resolvedParameters'] = {};

  for (const searchType of SEARCH_TYPES) {
    if (!effectiveUnresolved || !effectiveUnresolved[searchType]) {
      console.log(`[${index}]   Skipping ${searchType} resolution (no unresolved parameters)`);
      continue;
    }

    try {
      const unresolvedParams = effectiveUnresolved[searchType];
      const paramSets = Array.isArray(unresolvedParams) ? unresolvedParams : [unresolvedParams];

      console.log(
        `[${index}]   Resolving ${searchType} parameters (${paramSets.length} parameter set(s))...`,
      );
      const resolveStart = Date.now();

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
            },
          );

          if (resolveResponse.status >= 400) {
            const errorData = resolveResponse.data as { message?: string };
            throw new Error(
              `HTTP ${resolveResponse.status}: ${errorData?.message || resolveResponse.statusText || 'Request failed'}`,
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
            `[${index}]     ✗ ${searchType} parameter set ${i + 1}/${paramSets.length} resolution failed: ${errorMessage}`,
          );
          resolvedSets.push(paramSet as PeopleSearchParameters);
        }
      }

      if (searchType === 'classic') {
        resolvedParameters.classic =
          resolvedSets.length === 1
            ? (resolvedSets[0] as ClassicPeopleSearchParams)
            : (resolvedSets as ClassicPeopleSearchParams[]);
      } else if (searchType === 'sales_navigator') {
        resolvedParameters.sales_navigator =
          resolvedSets.length === 1
            ? (resolvedSets[0] as SalesNavigatorPeopleSearchParams)
            : (resolvedSets as SalesNavigatorPeopleSearchParams[]);
      } else if (searchType === 'recruiter') {
        resolvedParameters.recruiter =
          resolvedSets.length === 1
            ? (resolvedSets[0] as RecruiterPeopleSearchParams)
            : (resolvedSets as RecruiterPeopleSearchParams[]);
      }

      const resolveTime = Date.now() - resolveStart;
      console.log(`[${index}]     ✓ ${searchType} all parameters resolved (${resolveTime}ms)`);

      if (resolvedSets.length === 1) {
        console.log(
          `[${index}]     Final resolved ${searchType} parameters:`,
          JSON.stringify(resolvedSets[0], null, 2),
        );
      } else {
        console.log(
          `[${index}]     Final resolved ${searchType} parameters (${resolvedSets.length} sets):`,
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
      const unresolvedParams = effectiveUnresolved[searchType];
      if (unresolvedParams) {
        if (searchType === 'classic') {
          resolvedParameters.classic = unresolvedParams as
            | ClassicPeopleSearchParams
            | ClassicPeopleSearchParams[];
        } else if (searchType === 'sales_navigator') {
          resolvedParameters.sales_navigator = unresolvedParams as
            | SalesNavigatorPeopleSearchParams
            | SalesNavigatorPeopleSearchParams[];
        } else if (searchType === 'recruiter') {
          resolvedParameters.recruiter = unresolvedParams as
            | RecruiterPeopleSearchParams
            | RecruiterPeopleSearchParams[];
        }
      }
    }
  }

  const timingMs = Date.now() - resolutionStart;

  writeCache(cacheFilePath, resolvedParameters);

  console.log(`[${index}] ✓ Parameter resolution completed (${timingMs}ms)`);

  console.log(`[${index}] All resolved parameters for all search types:`);
  console.log(JSON.stringify(resolvedParameters, null, 2));

  return { resolvedParameters, timingMs };
}
