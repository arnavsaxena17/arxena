import axios from 'axios';
import { getCacheFilePath, readCache } from './test-candidate-search-flow.cache';
import {
  RUN_CANDIDATE_SCORING_STEP,
  RUN_CLEANUP_STEP,
  RUN_COMPANY_EXPANDER_STEP,
  RUN_JOB_TITLE_EXPANDER_STEP,
  RUN_LINKEDIN_URLS_STEP,
  RUN_QUERY_CONSTRUCTOR_STEP,
  RUN_REQUIREMENT_ANALYZER_STEP,
  RUN_RESOLVED_PARAMETERS_STEP,
  RUN_RESULT_VALIDATION_STEP,
  RUN_SEARCH_EXECUTION_STEP,
  RUN_UNRESOLVED_PARAMETERS_STEP,
  SEARCH_TYPES,
  USE_CACHE_CLEANUP,
} from './test-candidate-search-flow.config';
import {
  buildUnresolvedFromQueryConstructorStep,
  companyExpanderStep,
  jobTitleExpanderStep,
  queryConstructorStep,
  requirementAnalyzerStep,
} from './test-candidate-search-flow.steps.agents';
import { resolveParametersStep } from './test-candidate-search-flow.steps.parameters';
import { cleanupQueryStep } from './test-candidate-search-flow.steps.query';
import {
  executeParameterSearchStep,
  generateLinkedInUrlsStep,
} from './test-candidate-search-flow.steps.urls-and-search';
import {
  scoreParameterResultsStep,
  validateParameterResultsStep,
} from './test-candidate-search-flow.steps.validation';
import type { TestResult } from './test-candidate-search-flow.types';

function buildTestResult(
  rawQuery: string,
  vars: {
    cleanedQuery?: string;
    parsedRequirement?: unknown;
    titleAnalysis?: unknown;
    companyAnalysis?: unknown;
    queryConstructorResult?: unknown;
    booleanQueryResponse?: unknown;
    finalBooleanQuery?: string;
    unresolvedParameters?: TestResult['unresolvedParameters'];
    resolvedParameters?: TestResult['resolvedParameters'];
    linkedInUrls?: TestResult['linkedInUrls'];
    searchResults?: TestResult['searchResults'];
    validationResults?: TestResult['validationResults'];
    overallValidation?: TestResult['overallValidation'];
    candidateScores?: TestResult['candidateScores'];
    error?: string;
  },
  timing: {
    booleanQueryGeneration: number;
    parameterGeneration: number;
    parameterResolution: number;
    urlGeneration: number;
    searchExecution: number;
    resultValidation: number;
    candidateScoring: number;
    total: number;
  },
): TestResult {
  return {
    booleanQueryResponse: vars.booleanQueryResponse ?? null,
    rawQuery,
    cleanedQuery: vars.cleanedQuery,
    parsedRequirement: vars.parsedRequirement,
    titleAnalysis: vars.titleAnalysis,
    companyAnalysis: vars.companyAnalysis,
    queryConstructorResult: vars.queryConstructorResult,
    finalBooleanQuery: vars.finalBooleanQuery,
    unresolvedParameters: vars.unresolvedParameters,
    resolvedParameters: vars.resolvedParameters,
    linkedInUrls: vars.linkedInUrls,
    searchResults: vars.searchResults,
    validationResults: vars.validationResults,
    overallValidation: vars.overallValidation,
    candidateScores: vars.candidateScores,
    error: vars.error,
    timing,
  };
}

export async function processRawQuery(
  rawQuery: string,
  index: number,
): Promise<TestResult> {
  const startTime = Date.now();

  let cleanedQuery: string = rawQuery;
  let parsedRequirement: unknown;
  let titleAnalysis: unknown;
  let companyAnalysis: unknown;
  let queryConstructorResult: unknown;
  let booleanQueryResponse: unknown;
  let finalBooleanQuery: string | undefined;
  let unresolvedParameters: TestResult['unresolvedParameters'];
  let resolvedParameters: TestResult['resolvedParameters'];
  let linkedInUrls: TestResult['linkedInUrls'];
  let searchResults: TestResult['searchResults'];
  let validationResults: TestResult['validationResults'];
  let overallValidation: TestResult['overallValidation'];
  let candidateScores: TestResult['candidateScores'];

  const timing = {
    booleanQueryGeneration: 0,
    parameterGeneration: 0,
    parameterResolution: 0,
    urlGeneration: 0,
    searchExecution: 0,
    resultValidation: 0,
    candidateScoring: 0,
    total: 0,
  };

  console.log(`\n[${index}] Processing rawQuery: ${rawQuery.substring(0, 80)}...`);

  try {
    if (RUN_CLEANUP_STEP) {
      cleanedQuery = await cleanupQueryStep(rawQuery, index);
    } else if (USE_CACHE_CLEANUP) {
      const cacheFilePath = getCacheFilePath(index, 'cleanup-query');
      const cached = readCache<{ cleanedQuery: string }>(cacheFilePath);
      if (cached?.cleanedQuery) {
        cleanedQuery = cached.cleanedQuery;
        console.log(
          `[${index}] ✓ Cleaned query loaded from cache (cleanup step disabled)`,
        );
        console.log(`[${index}]   Original: ${rawQuery}`);
        console.log(`[${index}]   Cleaned : ${cached.cleanedQuery}`);
      }
    }

    console.log(`[${index}] Multi-agent flow: Requirement Analyzer → Job Title + Company Expander → Query Constructor → Unresolved`);
    if (RUN_REQUIREMENT_ANALYZER_STEP) {
      const reqOut = await requirementAnalyzerStep(rawQuery, index, cleanedQuery);
      parsedRequirement = reqOut.parsedRequirement;
    }
    if (RUN_JOB_TITLE_EXPANDER_STEP) {
      const titleOut = await jobTitleExpanderStep(index, parsedRequirement!);
      titleAnalysis = titleOut.titleAnalysis;
    }
    if (RUN_COMPANY_EXPANDER_STEP) {
      const companyOut = await companyExpanderStep(index, parsedRequirement!);
      companyAnalysis = companyOut.companyAnalysis;
    }
    if (RUN_QUERY_CONSTRUCTOR_STEP) {
      const qcOut = await queryConstructorStep(
        index,
        parsedRequirement!,
        titleAnalysis!,
        companyAnalysis!,
      );
      queryConstructorResult = qcOut.queryConstructorResult;
    }
    if (RUN_UNRESOLVED_PARAMETERS_STEP && queryConstructorResult) {
      const searchType = SEARCH_TYPES[0] ?? 'classic';
      const buildOut = await buildUnresolvedFromQueryConstructorStep(
        index,
        queryConstructorResult,
        searchType,
      );
      unresolvedParameters = buildOut.unresolvedParameters as TestResult['unresolvedParameters'];
      timing.parameterGeneration = buildOut.timingMs;
    }

    if (RUN_RESOLVED_PARAMETERS_STEP) {
      const resOutput = await resolveParametersStep(index, unresolvedParameters);
      resolvedParameters = resOutput.resolvedParameters;
      timing.parameterResolution = resOutput.timingMs;
    } else {
      console.log(
        `[${index}] Step 4: Skipped (RUN_RESOLVED_PARAMETERS_STEP = false)`,
      );
    }

    if (RUN_LINKEDIN_URLS_STEP) {
      const urlsOutput = await generateLinkedInUrlsStep(index, resolvedParameters);
      linkedInUrls = urlsOutput.linkedInUrls;
      timing.urlGeneration = urlsOutput.timingMs;
    } else {
      console.log(`[${index}] Step 5: Skipped (RUN_LINKEDIN_URLS_STEP = false)`);
    }

    if (RUN_SEARCH_EXECUTION_STEP) {
      const searchOutput = await executeParameterSearchStep(
        rawQuery,
        index,
        resolvedParameters,
      );
      searchResults = searchOutput.searchResults;
      timing.searchExecution = searchOutput.timingMs;
    } else {
      console.log(
        `[${index}] Step 6: Skipped (RUN_SEARCH_EXECUTION_STEP = false)`,
      );
    }

    if (RUN_RESULT_VALIDATION_STEP) {
      const validOutput = await validateParameterResultsStep(
        rawQuery,
        index,
        searchResults,
        booleanQueryResponse,
      );
      validationResults = validOutput.validationResults;
      overallValidation = validOutput.overallValidation;
      timing.resultValidation = validOutput.timingMs;
    } else {
      console.log(
        `[${index}] Step 7: Skipped (RUN_RESULT_VALIDATION_STEP = false)`,
      );
    }

    if (RUN_CANDIDATE_SCORING_STEP) {
      const scoreOutput = await scoreParameterResultsStep(
        rawQuery,
        index,
        searchResults,
        booleanQueryResponse,
      );
      candidateScores = scoreOutput.candidateScores;
      timing.candidateScoring = scoreOutput.timingMs;
    } else {
      console.log(
        `[${index}] Step 8: Skipped (RUN_CANDIDATE_SCORING_STEP = false)`,
      );
    }

    timing.total = Date.now() - startTime;
    console.log(`[${index}] ✓ Processing completed in ${timing.total}ms`);

    return buildTestResult(
      rawQuery,
      {
        cleanedQuery,
        parsedRequirement,
        titleAnalysis,
        companyAnalysis,
        queryConstructorResult,
        booleanQueryResponse,
        finalBooleanQuery,
        unresolvedParameters,
        resolvedParameters,
        linkedInUrls,
        searchResults,
        validationResults,
        overallValidation,
        candidateScores,
      },
      timing,
    );
  } catch (error: unknown) {
    timing.total = Date.now() - startTime;

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

    console.log(`[${index}] ✗ Failed after ${timing.total}ms: ${errorMessage}`);
    if (error instanceof Error && error.stack && process.env.DEBUG) {
      console.log(`[${index}] Error stack:`, error.stack);
    }

    return buildTestResult(
      rawQuery,
      {
        cleanedQuery,
        parsedRequirement,
        titleAnalysis,
        companyAnalysis,
        queryConstructorResult,
        booleanQueryResponse,
        finalBooleanQuery,
        unresolvedParameters,
        resolvedParameters,
        linkedInUrls,
        searchResults,
        validationResults,
        overallValidation,
        candidateScores,
        error: errorMessage,
      },
      timing,
    );
  }
}

export async function runPipeline(requirements: string[]): Promise<TestResult[]> {
  return Promise.all(
    requirements.map((req, index) => processRawQuery(req, index + 1)),
  );
}
