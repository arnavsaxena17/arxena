import { Injectable, Logger } from '@nestjs/common';
import type { GeneratedSearchParameters, ResultValidationResult } from '../types/candidate-search-request.type';
import { calculateCost } from '../utils/cost-calculation.util';
import type { PeopleSearchStrategyResult } from '../utils/extract-strategies.util';
import {
    constructSearchParamKey,
    generateLinkedInSearchUrl,
} from '../utils/search-parameter.utils';
import type { TokenUsage } from '../utils/token-tracking.util';

type SearchExecutionResult = {
  itemCount: number;
  searchResults?: unknown;
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
export class SearchResponseBuilderService {
  private readonly logger = new Logger(SearchResponseBuilderService.name);

  buildAndSendResponse(
    searchResult: {
      unresolvedSearchParams: GeneratedSearchParameters;
      resolvedParams: GeneratedSearchParameters;
      strategyResults: StrategyResultItem[];
    },
    tokenAccumulator: TokenUsage,
    model: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people',
    sendEvent?: (event: string, data: unknown) => void,
  ): {
    success: boolean;
    type: string;
    data?: unknown;
    chatMessage: string;
    error?: string;
  } {
    const { unresolvedSearchParams, resolvedParams, strategyResults } =
      searchResult;
    const searchParamKey = constructSearchParamKey(searchType, searchCategory);

    const resolvedSearchParametersResponse = this.buildSearchParametersResponse(
      unresolvedSearchParams,
      resolvedParams,
      searchParamKey,
      strategyResults,
      searchType,
      searchCategory,
    );

    this.logger.log(
      `Resolved search parameters response:: strategyResults:: ${JSON.stringify(resolvedSearchParametersResponse?.strategyResults?.map((s) => s.strategy), null, 2)}`,
    );

    const totalTransformedCandidates =
      this.calculateTotalCandidates(strategyResults);
    const finalCost = this.calculateFinalCost(tokenAccumulator, model);

    const strategyErrors = strategyResults
      .filter((sr) => sr.result?.error)
      .map((sr) => sr.result!.error!.details || sr.result!.error!.message);
    const allStrategiesFailed =
      strategyErrors.length > 0 && totalTransformedCandidates === 0;
    const errorSummary = allStrategiesFailed
      ? strategyErrors.slice(0, 3).join('; ')
      : undefined;

    const chatMessage = allStrategiesFailed
      ? `Search failed: ${errorSummary}`
      : this.buildChatMessage(
          totalTransformedCandidates,
          searchType,
          searchCategory,
        );

    sendEvent?.('message', {
      success: !allStrategiesFailed,
      type: 'search_parameters',
      data: resolvedSearchParametersResponse,
      chatMessage,
      ...(allStrategiesFailed ? { error: errorSummary } : {}),
    });

    this.sendFinalStatusEvents(
      totalTransformedCandidates,
      finalCost,
      tokenAccumulator,
      sendEvent,
    );

    if (totalTransformedCandidates > 0 && sendEvent) {
      const allCandidates = strategyResults.flatMap(
        (sr) => sr.result?.transformedCandidates || [],
      );
      const columns = ['name', 'headline', 'jobTitle', 'jobCompanyName'];
      const rows = allCandidates.filter((candidate: any) => {
        const candidateName = candidate?.name || candidate?.fullName;
        return typeof candidateName === 'string' && candidateName.trim().length > 0;
      });
      if (rows.length > 0) {
        const streamIds = strategyResults
          .map((sr) => sr.result?.streamTableId)
          .filter(
            (id): id is string =>
              typeof id === 'string' && id.length > 0,
          );
        const uniqueStreamIds = [...new Set(streamIds)];
        const tableId =
          uniqueStreamIds.length === 1
            ? uniqueStreamIds[0]
            : crypto.randomUUID();
        const label = `${rows.length} candidate${rows.length !== 1 ? 's' : ''}`;
        sendEvent('table_data', {
          tableId,
          tableType: 'candidates',
          label,
          columns,
          rows,
        });
      }
    }

    return {
      success: !allStrategiesFailed,
      type: 'search_parameters',
      data: resolvedSearchParametersResponse,
      chatMessage,
      ...(allStrategiesFailed ? { error: chatMessage } : {}),
    };
  }

  buildSearchParametersResponse(
    searchParams: GeneratedSearchParameters,
    resolvedParams: GeneratedSearchParameters,
    searchParamKey: string,
    strategyResults: StrategyResultItem[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): {
    generatedSearchParameters: GeneratedSearchParameters;
    resolvedSearchParameters: GeneratedSearchParameters;
    strategyResults?: Array<{
      strategy: PeopleSearchStrategyResult & {
        linkedInUrl?: string | null;
        candidateCount?: number;
      };
      preview: SearchExecutionResult | null;
    }>;
    linkedInUrl: string | null;
  } {
    const primarySearchParameters = resolvedParams[searchParamKey];
    const primaryLinkedInUrl = primarySearchParameters
      ? generateLinkedInSearchUrl(
          primarySearchParameters,
          searchType,
          searchCategory,
        )
      : null;

    const strategyResultsWithUrls = strategyResults.map((strategyResult) => {
      const strategyParams = strategyResult.strategy?.parameters;

      const areParamsResolved =
        this.areStrategyParametersResolved(strategyParams);
      const strategyLinkedInUrl =
        strategyParams && areParamsResolved
          ? generateLinkedInSearchUrl(
              strategyParams,
              searchType,
              searchCategory,
            )
          : null;

      const candidateCount = strategyResult.result?.itemCount || 0;

      return {
        strategy: {
          ...strategyResult.strategy,
          linkedInUrl: strategyLinkedInUrl,
          candidateCount,
        },
        preview: strategyResult.result,
      };
    });

    return {
      generatedSearchParameters: searchParams,
      resolvedSearchParameters: resolvedParams,
      strategyResults:
        strategyResultsWithUrls.length > 0 ? strategyResultsWithUrls : undefined,
      linkedInUrl: primaryLinkedInUrl,
    };
  }

  areStrategyParametersResolved(params: unknown): boolean {
    if (!params || typeof params !== 'object') return false;

    const p = params as Record<string, unknown>;

    const hasUnresolvedStrings = (arr: unknown[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(
        (item) =>
          typeof item === 'string' &&
          !item.match(/^\d+$/) &&
          !item.includes('urn:li:'),
      );
    };

    if (p.location) {
      const loc = p.location as Record<string, unknown> | unknown[];
      if (Array.isArray(loc) && hasUnresolvedStrings(loc)) {
        return false;
      }
      if (
        loc &&
        typeof loc === 'object' &&
        'include' in loc &&
        Array.isArray((loc as { include: unknown[] }).include) &&
        hasUnresolvedStrings((loc as { include: unknown[] }).include)
      ) {
        return false;
      }
    }

    if (p.company) {
      const comp = p.company as Record<string, unknown> | unknown[];
      if (Array.isArray(comp) && hasUnresolvedStrings(comp)) {
        return false;
      }
      if (
        comp &&
        typeof comp === 'object' &&
        'include' in comp &&
        Array.isArray((comp as { include: unknown[] }).include) &&
        hasUnresolvedStrings((comp as { include: unknown[] }).include)
      ) {
        return false;
      }
    }

    return true;
  }

  calculateTotalCandidates(strategyResults: StrategyResultItem[]): number {
    return strategyResults.reduce((total, strategyResult) => {
      const candidates = strategyResult.result?.transformedCandidates || [];
      return total + candidates.length;
    }, 0);
  }

  calculateFinalCost(
    tokenAccumulator: TokenUsage,
    model: string,
  ): ReturnType<typeof calculateCost> | null {
    return tokenAccumulator.totalTokens > 0
      ? calculateCost(
          model,
          tokenAccumulator.promptTokens,
          tokenAccumulator.completionTokens,
          tokenAccumulator.cachedTokens,
        )
      : null;
  }

  buildChatMessage(
    totalTransformedCandidates: number,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): string {
    return totalTransformedCandidates > 0
      ? `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form. Found ${totalTransformedCandidates} candidate${totalTransformedCandidates !== 1 ? 's' : ''}.`
      : `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`;
  }

  sendFinalStatusEvents(
    totalTransformedCandidates: number,
    finalCost: ReturnType<typeof calculateCost> | null,
    tokenAccumulator: TokenUsage,
    sendEvent?: (event: string, data: unknown) => void,
  ): void {
    if (totalTransformedCandidates > 0) {
      sendEvent?.('status', {
        message: `Found ${totalTransformedCandidates} candidate${totalTransformedCandidates !== 1 ? 's' : ''} total`,
      });

      if (finalCost && tokenAccumulator.totalTokens > 0) {
        sendEvent?.('tokenUsage', {
          promptTokens: tokenAccumulator.promptTokens,
          completionTokens: tokenAccumulator.completionTokens,
          totalTokens: tokenAccumulator.totalTokens,
          cachedTokens: tokenAccumulator.cachedTokens,
          cost: finalCost.totalCost,
          inputCost: finalCost.inputCost,
          outputCost: finalCost.outputCost,
          cachedCost: finalCost.cachedCost,
        });
      }
    }
  }
}
