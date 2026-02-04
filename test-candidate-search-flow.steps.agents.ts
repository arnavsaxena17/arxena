import axios from 'axios';
import { getCacheFilePath, readCache, writeCache } from './test-candidate-search-flow.cache';
import {
  API_TOKEN,
  SERVER_URL,
  USE_CACHE_COMPANY_EXPANDER,
  USE_CACHE_JOB_TITLE_EXPANDER,
  USE_CACHE_QUERY_CONSTRUCTOR,
  USE_CACHE_REQUIREMENT_ANALYZER,
} from './test-candidate-search-flow.config';

export async function requirementAnalyzerStep(
  rawQuery: string,
  index: number,
  cleanedQuery: string | undefined,
): Promise<{ parsedRequirement: unknown; timingMs: number }> {
  console.log(`[${index}] Step: Requirement Analyzer (Agent 1)...`);
  const start = Date.now();
  const cacheFilePath = getCacheFilePath(index, 'requirement-analyzer');

  if (USE_CACHE_REQUIREMENT_ANALYZER) {
    const cached = readCache<{ parsedRequirement: unknown }>(cacheFilePath);
    if (cached?.parsedRequirement) {
      const timingMs = Date.now() - start;
      console.log(`[${index}] ✓ Parsed requirement loaded from cache (${timingMs}ms)`);
      return { parsedRequirement: cached.parsedRequirement, timingMs };
    }
  }

  const input = cleanedQuery ?? rawQuery;
  const response = await axios.post<{ parsedRequirement: unknown }>(
    `${SERVER_URL}/candidate-search/test/requirement-analyzer`,
    { rawRequirement: rawQuery, cleanedQuery: cleanedQuery ?? input },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
      validateStatus: (s) => s < 500,
    },
  );
  if (response.status >= 400) {
    throw new Error(
      `HTTP ${response.status}: ${(response.data as { message?: string })?.message || response.statusText}`,
    );
  }
  const parsedRequirement = response.data?.parsedRequirement;
  writeCache(cacheFilePath, { parsedRequirement });
  const timingMs = Date.now() - start;
  console.log(`[${index}] ✓ Requirement analyzer completed (${timingMs}ms)`);
  return { parsedRequirement, timingMs };
}

export async function jobTitleExpanderStep(
  index: number,
  parsedRequirement: unknown,
): Promise<{ titleAnalysis: unknown; timingMs: number }> {
  console.log(`[${index}] Step: Job Title Expander (Agent 2)...`);
  const start = Date.now();
  const cacheFilePath = getCacheFilePath(index, 'job-title-expander');

  if (USE_CACHE_JOB_TITLE_EXPANDER) {
    const cached = readCache<{ titleAnalysis: unknown }>(cacheFilePath);
    if (cached?.titleAnalysis) {
      const timingMs = Date.now() - start;
      console.log(`[${index}] ✓ Title analysis loaded from cache (${timingMs}ms)`);
      return { titleAnalysis: cached.titleAnalysis, timingMs };
    }
  }

  const response = await axios.post<{ titleAnalysis: unknown }>(
    `${SERVER_URL}/candidate-search/test/job-title-expander`,
    { parsedRequirement },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
      validateStatus: (s) => s < 500,
    },
  );
  if (response.status >= 400) {
    throw new Error(
      `HTTP ${response.status}: ${(response.data as { message?: string })?.message || response.statusText}`,
    );
  }
  const titleAnalysis = response.data?.titleAnalysis;
  writeCache(cacheFilePath, { titleAnalysis });
  const timingMs = Date.now() - start;
  console.log(`[${index}] ✓ Job title expander completed (${timingMs}ms)`);
  return { titleAnalysis, timingMs };
}

export async function companyExpanderStep(
  index: number,
  parsedRequirement: unknown,
): Promise<{ companyAnalysis: unknown; timingMs: number }> {
  console.log(`[${index}] Step: Company Expander (Agent 3)...`);
  const start = Date.now();
  const cacheFilePath = getCacheFilePath(index, 'company-expander');

  if (USE_CACHE_COMPANY_EXPANDER) {
    const cached = readCache<{ companyAnalysis: unknown }>(cacheFilePath);
    if (cached?.companyAnalysis) {
      const timingMs = Date.now() - start;
      console.log(`[${index}] ✓ Company analysis loaded from cache (${timingMs}ms)`);
      return { companyAnalysis: cached.companyAnalysis, timingMs };
    }
  }

  const response = await axios.post<{ companyAnalysis: unknown }>(
    `${SERVER_URL}/candidate-search/test/company-expander`,
    { parsedRequirement },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
      validateStatus: (s) => s < 500,
    },
  );
  if (response.status >= 400) {
    throw new Error(
      `HTTP ${response.status}: ${(response.data as { message?: string })?.message || response.statusText}`,
    );
  }
  const companyAnalysis = response.data?.companyAnalysis;
  writeCache(cacheFilePath, { companyAnalysis });
  const timingMs = Date.now() - start;
  console.log(`[${index}] ✓ Company expander completed (${timingMs}ms)`);
  return { companyAnalysis, timingMs };
}

export async function queryConstructorStep(
  index: number,
  parsedRequirement: unknown,
  titleAnalysis: unknown,
  companyAnalysis: unknown,
): Promise<{ queryConstructorResult: unknown; timingMs: number }> {
  console.log(`[${index}] Step: Query Constructor (Agent 4)...`);
  const start = Date.now();
  const cacheFilePath = getCacheFilePath(index, 'query-constructor');

  if (USE_CACHE_QUERY_CONSTRUCTOR) {
    const cached = readCache<{ queryConstructorResult: unknown }>(cacheFilePath);
    if (cached?.queryConstructorResult) {
      const timingMs = Date.now() - start;
      console.log(`[${index}] ✓ Query constructor result loaded from cache (${timingMs}ms)`);
      return { queryConstructorResult: cached.queryConstructorResult, timingMs };
    }
  }

  const response = await axios.post<{
    linkedin_searches: unknown[];
    search_strategy?: unknown;
    total_queries?: number;
    coverage_assessment?: string;
  }>(
    `${SERVER_URL}/candidate-search/test/query-constructor`,
    { parsedRequirement, titleAnalysis, companyAnalysis },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 180000,
      validateStatus: (s) => s < 500,
    },
  );
  if (response.status >= 400) {
    throw new Error(
      `HTTP ${response.status}: ${(response.data as { message?: string })?.message || response.statusText}`,
    );
  }
  const queryConstructorResult = {
    linkedin_searches: response.data?.linkedin_searches ?? [],
    search_strategy: response.data?.search_strategy,
    total_queries: response.data?.total_queries,
    coverage_assessment: response.data?.coverage_assessment,
  };
  writeCache(cacheFilePath, { queryConstructorResult });
  const timingMs = Date.now() - start;
  console.log(`[${index}] ✓ Query constructor completed (${timingMs}ms)`);
  return { queryConstructorResult, timingMs };
}

export async function buildUnresolvedFromQueryConstructorStep(
  index: number,
  queryConstructorResult: unknown,
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
): Promise<{
  unresolvedParameters: {
    classic?: unknown;
    sales_navigator?: unknown;
    recruiter?: unknown;
  };
  timingMs: number;
}> {
  console.log(`[${index}] Step: Build unresolved from query constructor...`);
  const start = Date.now();
  const response = await axios.post<{ unresolvedParameters: unknown }>(
    `${SERVER_URL}/candidate-search/test/build-unresolved-from-query-constructor`,
    { queryConstructorResult, searchType },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
      validateStatus: (s) => s < 500,
    },
  );
  if (response.status >= 400) {
    throw new Error(
      `HTTP ${response.status}: ${(response.data as { message?: string })?.message || response.statusText}`,
    );
  }
  const unresolvedParameters = response.data?.unresolvedParameters as {
    classic?: unknown;
    sales_navigator?: unknown;
    recruiter?: unknown;
  };
  const timingMs = Date.now() - start;
  console.log(`[${index}] ✓ Unresolved from query constructor (${timingMs}ms)`);
  return { unresolvedParameters, timingMs };
}
