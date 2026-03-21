import { Injectable, Logger } from '@nestjs/common';
import { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import type { GeneratedSearchParameters, ParsedJobDescription, ResultValidationResult } from '../types/candidate-search-request.type';
import type { PeopleSearchStrategyResult } from '../utils/extract-strategies.util';
import { extractStrategiesFromGeneratedParams } from '../utils/extract-strategies.util';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { SearchExecutionService } from './search-execution.service';
import { SearchResponseBuilderService } from './search-response-builder.service';

type SearchExecutionResult = {
  itemCount: number;
  searchResults?: {
    items?: unknown[];
    paging?: { total_count?: number; page_count?: number };
  } | null;
  transformedCandidates?: unknown[];
  streamTableId?: string;
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
};

type StrategyResultItem = {
  strategy: PeopleSearchStrategyResult;
  result: SearchExecutionResult | null;
};

@Injectable()
export class StrategyExecutionService {
  private readonly logger = new Logger(StrategyExecutionService.name);

  constructor(
    private readonly searchExecutionService: SearchExecutionService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly searchResponseBuilderService: SearchResponseBuilderService,
  ) {}

  extractStrategiesFromGeneratedParams(
    searchParams: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): PeopleSearchStrategyResult[] {
    return extractStrategiesFromGeneratedParams(
      searchParams,
      searchType,
      searchCategory,
    );
  }

  async executeStrategySearches(
    parsedJobDescription: ParsedJobDescription,
    strategies: PeopleSearchStrategyResult[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    userMessage: string,
    sendEvent?: (event: string, data: unknown) => void,
  ): Promise<StrategyResultItem[]> {
    this.logger.log(
      `Found ${strategies.length} strategies to execute searches for ${searchType} ${searchCategory}`,
    );

    const strategyLimit = 1;
    const strategiesToRun =
      strategies.length > strategyLimit
        ? strategies.slice(0, strategyLimit)
        : strategies;
    if (strategies.length > strategyLimit) {
      this.logger.log(`Limited to ${strategyLimit} strategy for debugging`);
    }

    if (strategiesToRun.length === 0) {
      this.logger.log(
        `No strategies found for ${searchType} ${searchCategory}`,
      );
      return [];
    }

    this.logger.log(`Executing searches for ${strategiesToRun.length} strategies...`);
    sendEvent?.('status', {
      message: `Executing searches for ${strategiesToRun.length} strategies...`,
    });

    const strategyResults: StrategyResultItem[] = [];

    for (const strategy of strategiesToRun) {
      const result = await this.executeStrategySearch(
        parsedJobDescription,
        strategy,
        searchType,
        searchCategory,
        parameterKey,
        apiToken,
        userMessage,
        sendEvent,
      );
      strategyResults.push({ strategy, result });

      if (this.shouldStopAfterStrategyFailure(result)) {
        this.logger.warn(
          `[Strategy: ${strategy.id}] LinkedIn search failed, stopping execution of remaining generated strategies`,
        );
        sendEvent?.('status', {
          message:
            'LinkedIn search failed. Stopping remaining generated queries.',
        });
        break;
      }
    }

    const successfulResults = strategyResults.filter(
      (sr) => sr.result && !sr.result.error,
    ).length;
    const failedResults = strategyResults.filter(
      (sr) => sr.result?.error,
    ).length;
    const noResults = strategyResults.filter((sr) => !sr.result).length;

    this.logger.log(
      `Completed searches for ${strategiesToRun.length} strategies: ${successfulResults} successful, ${failedResults} failed, ${noResults} no results`,
    );

    this.logParameterResultsMetrics(strategyResults);
    sendEvent?.('status', {
      message: `Completed searches for ${strategiesToRun.length} strategies${failedResults > 0 ? ` (${failedResults} failed)` : ''}`,
    });

    return strategyResults;
  }

  private shouldStopAfterStrategyFailure(
    result: SearchExecutionResult | null,
  ): boolean {
    const errorText = [
      result?.error?.message,
      result?.error?.details,
      result?.error?.code,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase();

    return errorText.includes('linkedin search failed');
  }

  async executeStrategySearch(
    parsedJobDescription: ParsedJobDescription,
    strategy: PeopleSearchStrategyResult,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    userMessage: string,
    sendEvent?: (event: string, data: unknown) => void,
  ): Promise<SearchExecutionResult | null> {
    const strategyId = strategy.id;
    try {
      if (!strategy.parameters) {
        this.logger.warn(
          `[Strategy: ${strategyId}] Strategy has no parameters, skipping search preview`,
        );
        return null;
      }

      const strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

      this.logger.log(
        `[Strategy: ${strategyId}] Executing search preview for strategy (${strategy.label || 'unnamed'})`,
      );
      this.logger.log(
        `[Strategy: ${strategyId}] Parameters before resolution: ${JSON.stringify(strategy.parameters, null, 2)}`,
      );

      const accountId =
        await this.candidateSearchBaseService.getLinkedInAccountId(apiToken);
      const originalCompanyNames =
        Array.isArray(strategy.parameters?.company) &&
        strategy.parameters.company.length > 0
          ? (strategy.parameters.company as string[]).filter(
              (c): c is string => typeof c === 'string' && c.trim().length > 0,
            )
          : [];
      const needsResolution =
        !this.searchResponseBuilderService.areStrategyParametersResolved(
          strategy.parameters,
        );

      if (needsResolution) {
        this.logger.log(
          `[Strategy: ${strategyId}] Resolving parameter IDs for strategy parameters`,
        );
        const resolvedParams =
          await this.linkedinParameterResolver.resolveParameterIds(
            strategy.parameters,
            accountId,
            strategyId,
          );
        strategyResolvedParams[parameterKey] = resolvedParams;
        strategy.parameters = resolvedParams;
        this.logger.log(
          `[Strategy: ${strategyId}] Completed resolving strategy parameters`,
        );

        const resolvedCompanyIds = Array.isArray(resolvedParams.company)
          ? resolvedParams.company
          : [];
        const hasResolvedCompanyIds = resolvedCompanyIds.some(
          (id) =>
            typeof id === 'string' &&
            (/^\d+$/.test(id) || id.includes('urn:li:')),
        );
        if (
          originalCompanyNames.length > 0 &&
          !hasResolvedCompanyIds &&
          parameterKey === 'classicPeopleSearch'
        ) {
          const companyFallback = originalCompanyNames[0].trim();
          const classicParams = resolvedParams as {
            advanced_keywords?: {
              company?: string;
              title?: string;
              [k: string]: unknown;
            };
            [k: string]: unknown;
          };
          const paramsWithCompanyFallback = {
            ...resolvedParams,
            advanced_keywords: {
              ...(classicParams.advanced_keywords ?? {}),
              company: companyFallback,
            },
          };
          strategy.parameters =
            paramsWithCompanyFallback as typeof strategy.parameters;
          strategyResolvedParams[parameterKey] =
            paramsWithCompanyFallback as (typeof strategyResolvedParams)[typeof parameterKey];
          this.logger.log(
            `[Strategy: ${strategyId}] Company not resolved to IDs; using advanced_keywords.company="${companyFallback}"`,
          );
        }
      } else {
        this.logger.log(
          `[Strategy: ${strategyId}] Parameters already resolved, skipping resolution`,
        );
      }

      const searchResult: SearchExecutionResult | null =
        await this.searchExecutionService.executeMultiPageStrategySearch(
          parsedJobDescription,
          strategy,
          searchType,
          searchCategory,
          parameterKey,
          apiToken,
          userMessage,
          sendEvent,
        );

      if (searchResult) {
        const totalCount =
          searchResult.searchResults?.paging?.total_count ??
          searchResult.itemCount;
        const totalPages = searchResult.searchResults?.paging?.total_count
          ? Math.ceil(
              searchResult.searchResults.paging.total_count / 25,
            )
          : undefined;

        this.logger.log(
          `Strategy ${strategy.id} (${strategy.label || 'unnamed'}) results: ` +
            `${searchResult.itemCount} candidates fetched, ` +
            `Total available: ${totalCount}, ` +
            `Total pages available: ${totalPages ?? 'unknown'}`,
        );
      }

      this.logger.log(
        `searchResult from multi page search for strategy: ${strategy.label} :: ` +
          JSON.stringify(
            searchResult?.transformedCandidates?.map((item: unknown) => {
              const i = item as Record<string, unknown>;
              let name: string;
              let jobTitle: string | undefined;
              if ('name' in i && typeof i.name === 'string') {
                name = i.name;
                jobTitle = i.jobTitle as string | undefined;
              } else {
                const typed = i as unknown as LinkedInPeopleSearchResult;
                name = (typed.first_name ?? '') + ' ' + (typed.last_name ?? '');
                jobTitle = typed?.headline;
              }
              return {
                name: name || 'Unknown',
                jobTitle: jobTitle || 'Unknown',
              };
            }),
            null,
            2,
          ),
      );

      return searchResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode =
        error instanceof Error && 'code' in error
          ? String((error as Error & { code: unknown }).code)
          : undefined;

      this.logger.error(
        `[Strategy: ${strategyId}] Failed to execute search preview for strategy (${strategy.label || 'unnamed'}):`,
        error,
      );

      let errorDetails: string | undefined;
      if (errorMessage.includes('Content too large')) {
        errorDetails =
          'The search parameters are too complex. Try simplifying the search criteria.';
      } else if (errorMessage.includes('LinkedIn search failed')) {
        errorDetails = errorMessage.replace('LinkedIn search failed: ', '');
      }

      return {
        itemCount: 0,
        searchResults: null,
        transformedCandidates: undefined,
        searchMetadata: undefined,
        error: {
          message: errorMessage,
          code: errorCode,
          details: errorDetails || errorMessage,
        },
      };
    }
  }

  private logParameterResultsMetrics(
    strategyResults: StrategyResultItem[],
  ): void {
    this.logger.log(
      `\n========== ParameterResults Execution Metrics ==========`,
    );
    this.logger.log(`Total strategies executed: ${strategyResults.length}`);

    let totalCandidates = 0;
    let totalPages = 0;
    let totalResults = 0;
    const strategyMetrics: Array<{
      strategyId: string;
      strategyLabel: string;
      candidateCount: number;
      pageCount: number;
      resultCount: number;
      validationScores: number[];
      averageValidationScore: number;
      averageCandidateScore: number;
      candidateScores: number[];
    }> = [];

    for (const { strategy, result } of strategyResults) {
      if (!result) {
        this.logger.log(
          `[Strategy: ${strategy.id}] ${strategy.label || 'Unnamed'}: No execution result`,
        );
        continue;
      }

      if (result.error) {
        this.logger.log(
          `[Strategy: ${strategy.id}] ${strategy.label || 'Unnamed'}: Error - ${result.error.message}`,
        );
        continue;
      }

      const candidateCount = result.itemCount || 0;
      const resultCount =
        result.searchResults?.items?.length || candidateCount;
      const totalCountFromAPI = result.searchResults?.paging?.total_count;

      let pagesRan = 0;
      if (result.searchResults?.paging?.page_count !== undefined) {
        pagesRan = result.searchResults.paging.page_count;
      } else if (
        result.validationResults &&
        result.validationResults.length > 0
      ) {
        pagesRan = result.validationResults.length;
      } else if (candidateCount > 0) {
        pagesRan = Math.ceil(candidateCount / 25);
      }

      const validationScores: number[] = [];
      if (result.validationResults && result.validationResults.length > 0) {
        result.validationResults.forEach((vr) => {
          if (vr.validation?.relevanceScore !== undefined) {
            validationScores.push(vr.validation.relevanceScore);
          }
        });
      }
      if (result.overallValidation?.relevanceScore !== undefined) {
        validationScores.push(result.overallValidation.relevanceScore);
      }

      const candidateScores: number[] = [];
      if (
        result.transformedCandidates &&
        result.transformedCandidates.length > 0
      ) {
        result.transformedCandidates.forEach((candidate: unknown) => {
          const c = candidate as { relevanceScore?: number | null };
          if (
            c.relevanceScore !== undefined &&
            c.relevanceScore !== null
          ) {
            candidateScores.push(c.relevanceScore);
          }
        });
      }

      const averageValidationScore =
        validationScores.length > 0
          ? validationScores.reduce((sum, score) => sum + score, 0) /
            validationScores.length
          : 0;

      const averageCandidateScore =
        candidateScores.length > 0
          ? candidateScores.reduce((sum, score) => sum + score, 0) /
            candidateScores.length
          : 0;

      strategyMetrics.push({
        strategyId: strategy.id,
        strategyLabel: strategy.label || 'Unnamed',
        candidateCount,
        pageCount: pagesRan,
        resultCount,
        validationScores,
        averageValidationScore,
        averageCandidateScore,
        candidateScores,
      });

      totalCandidates += candidateCount;
      totalPages += pagesRan;
      totalResults += resultCount;

      this.logger.log(
        `\n[Strategy: ${strategy.id}] ${strategy.label || 'Unnamed'}:`,
      );
      this.logger.log(`  - Candidates: ${candidateCount}`);
      this.logger.log(
        `  - Results: ${resultCount}${totalCountFromAPI ? ` (Total available: ${totalCountFromAPI})` : ''}`,
      );
      this.logger.log(`  - Pages ran: ${pagesRan}`);

      if (validationScores.length > 0) {
        this.logger.log(
          `  - Validation scores: ${validationScores.map((s) => (s * 100).toFixed(2) + '%').join(', ')}`,
        );
        this.logger.log(
          `  - Average validation score: ${(averageValidationScore * 100).toFixed(2)}%`,
        );
      } else {
        this.logger.log(`  - Validation scores: None`);
      }

      if (candidateScores.length > 0) {
        const minScore = Math.min(...candidateScores);
        const maxScore = Math.max(...candidateScores);
        this.logger.log(
          `  - Candidate scores: ${candidateScores.length} scored, ` +
            `Average: ${(averageCandidateScore * 100).toFixed(2)}%, ` +
            `Min: ${(minScore * 100).toFixed(2)}%, ` +
            `Max: ${(maxScore * 100).toFixed(2)}%`,
        );
      } else {
        this.logger.log(`  - Candidate scores: None`);
      }

      if (result.validationResults && result.validationResults.length > 0) {
        this.logger.log(`  - Page-by-page validation:`);
        result.validationResults.forEach((vr) => {
          const score = vr.validation?.relevanceScore;
          const quality = vr.validation?.qualityAssessment || 'N/A';
          const shouldContinue = vr.validation?.shouldContinuePagination;
          this.logger.log(
            `    Page ${vr.page}: Score ${score !== undefined ? (score * 100).toFixed(2) + '%' : 'N/A'}, ` +
              `Quality: ${quality}, Continue: ${shouldContinue !== undefined ? shouldContinue : 'N/A'}`,
          );
        });
      }
    }

    this.logger.log(`\n========== Summary Statistics ==========`);
    this.logger.log(
      `Total candidates across all strategies: ${totalCandidates}`,
    );
    this.logger.log(
      `Total pages ran across all strategies: ${totalPages}`,
    );
    this.logger.log(
      `Total results across all strategies: ${totalResults}`,
    );

    if (strategyMetrics.length > 0) {
      const avgCandidatesPerStrategy =
        totalCandidates / strategyMetrics.length;
      const avgPagesPerStrategy = totalPages / strategyMetrics.length;
      const avgResultsPerStrategy = totalResults / strategyMetrics.length;

      const allValidationScores = strategyMetrics.flatMap(
        (m) => m.validationScores,
      );
      const avgValidationScoreAcrossStrategies =
        allValidationScores.length > 0
          ? allValidationScores.reduce((sum, score) => sum + score, 0) /
            allValidationScores.length
          : 0;

      const allCandidateScores = strategyMetrics.flatMap(
        (m) => m.candidateScores,
      );
      const avgCandidateScoreAcrossStrategies =
        allCandidateScores.length > 0
          ? allCandidateScores.reduce((sum, score) => sum + score, 0) /
            allCandidateScores.length
          : 0;

      this.logger.log(`\nAverage per strategy:`);
      this.logger.log(`  - Candidates: ${avgCandidatesPerStrategy.toFixed(2)}`);
      this.logger.log(`  - Pages: ${avgPagesPerStrategy.toFixed(2)}`);
      this.logger.log(`  - Results: ${avgResultsPerStrategy.toFixed(2)}`);
      this.logger.log(
        `  - Average validation score: ${(avgValidationScoreAcrossStrategies * 100).toFixed(2)}%`,
      );
      this.logger.log(
        `  - Average candidate score: ${(avgCandidateScoreAcrossStrategies * 100).toFixed(2)}%`,
      );

      this.logger.log(`\nPer-strategy breakdown:`);
      strategyMetrics.forEach((metrics) => {
        this.logger.log(
          `  ${metrics.strategyLabel} (${metrics.strategyId}): ` +
            `${metrics.candidateCount} candidates, ` +
            `${metrics.pageCount} pages, ` +
            `${metrics.resultCount} results, ` +
            `Avg validation: ${(metrics.averageValidationScore * 100).toFixed(2)}%, ` +
            `Avg candidate score: ${(metrics.averageCandidateScore * 100).toFixed(2)}%`,
        );
      });
    }

    this.logger.log(`\n==========================================\n`);
  }
}
