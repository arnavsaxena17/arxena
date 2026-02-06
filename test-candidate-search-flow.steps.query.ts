import axios from 'axios';
import { getCacheFilePath, readCache, writeCache } from './test-candidate-search-flow.cache';
import {
  API_TOKEN,
  RUN_QUERY_UNDERSTANDING_STEP,
  SERVER_URL,
  USE_CACHE_CLEANUP,
} from './test-candidate-search-flow.config';

export async function cleanupQueryStep(rawQuery: string, index: number): Promise<string> {
  console.log(`[${index}] Pre-step: Cleaning up raw query...`);
  const cleanupStart = Date.now();

  const cacheFilePath = getCacheFilePath(index, 'cleanup-query');

  if (USE_CACHE_CLEANUP) {
    const cached = readCache<{ cleanedQuery: string }>(cacheFilePath);
    if (cached?.cleanedQuery) {
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
      { rawQuery },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
        validateStatus: (status) => status < 500,
      },
    );

    if (response.status >= 400) {
      throw new Error(
        `HTTP ${response.status}: ${response.data?.message || response.statusText || 'Request failed'}`,
      );
    }

    const cleanedQuery = response.data.cleanedQuery || rawQuery;

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
    return rawQuery;
  }
}

export function mergeQueryUnderstandingIntoBooleanResponse(
  booleanQueryResponse: unknown,
  queryUnderstanding: unknown,
): Record<string, unknown> {
  if (booleanQueryResponse && typeof booleanQueryResponse === 'object') {
    return { ...(booleanQueryResponse as Record<string, unknown>), queryUnderstanding };
  }
  return { queryUnderstanding };
}


export async function getOrComputeQueryUnderstanding(
  rawQuery: string,
  index: number,
  cleanedQuery: string | undefined,
  booleanQueryResponse: unknown,
): Promise<unknown> {
  const existingUnderstanding =
    booleanQueryResponse &&
    typeof booleanQueryResponse === 'object' &&
    'queryUnderstanding' in booleanQueryResponse
      ? (booleanQueryResponse as { queryUnderstanding: unknown }).queryUnderstanding
      : undefined;

  if (existingUnderstanding) {
    return existingUnderstanding;
  }

  const cacheFilePath = getCacheFilePath(index, 'query-understanding');

  const cached = readCache<{
    queryUnderstanding?: unknown;
    enhancedQueryUnderstanding?: unknown;
  }>(cacheFilePath);

  const cachedUnderstanding = cached?.enhancedQueryUnderstanding ?? cached?.queryUnderstanding;
  if (cachedUnderstanding) {
    console.log(`[${index}]   ✓ Query understanding loaded from cache`);
    return cachedUnderstanding;
  }

  if (!RUN_QUERY_UNDERSTANDING_STEP) {
    console.log(
      `[${index}]   ⚠ Query understanding step disabled and no cached result found; continuing without query understanding`,
    );
    return undefined;
  }

  console.log(`[${index}]   Generating query understanding...`);

  try {
    const prompt = cleanedQuery ?? rawQuery;

    const response = await axios.post(
      `${SERVER_URL}/candidate-search/test/understand-query`,
      { prompt },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 180000,
        validateStatus: (status) => status < 500,
      },
    );

    if (response.status >= 400) {
      throw new Error(
        `HTTP ${response.status}: ${response.data?.message || response.statusText || 'Request failed'}`,
      );
    }

    const queryUnderstanding = response.data?.queryUnderstanding;
    if (!queryUnderstanding) {
      console.log(
        `[${index}]     ⚠ Query understanding response did not include queryUnderstanding; continuing without it`,
      );
      return undefined;
    }

    writeCache(cacheFilePath, { queryUnderstanding });

    console.log(`[${index}]     ✓ Query understanding generated`);
    return queryUnderstanding;
  } catch (error: unknown) {
    let errorMessage = 'Unknown error';
    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.log(`[${index}]     ⚠ Failed to generate query understanding: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Ensures we have query understanding (from existing, cache, or API), then merges it
 * into the boolean response and returns both for downstream steps.
 */
// export async function ensureQueryUnderstanding(
//   rawQuery: string,
//   index: number,
//   cleanedQuery: string | undefined,
//   booleanQueryResponse: unknown,
// ): Promise<QueryUnderstandingOutput> {
//   const queryUnderstanding = await getOrComputeQueryUnderstanding(
//     rawQuery,
//     index,
//     cleanedQuery,
//     booleanQueryResponse,
//   );

//   const output: QueryUnderstandingOutput = {};
//   if (queryUnderstanding !== undefined) {
//     output.queryUnderstanding = queryUnderstanding;
//     output.booleanQueryResponse = mergeQueryUnderstandingIntoBooleanResponse(
//       booleanQueryResponse,
//       queryUnderstanding,
//     );
//   }
//   return output;
// }

