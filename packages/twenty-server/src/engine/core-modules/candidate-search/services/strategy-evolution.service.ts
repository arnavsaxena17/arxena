import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { StreamProcessingService } from './stream-processing.service';
import { RecruitingKnowledgePrompts } from '../prompts/recruiting-knowledge-prompts';
import { QueryUnderstanding } from '../types/candidate-search-request.type';
import {
  ClassicPeopleSearchStrategyResult,
  RecruiterPeopleSearchStrategyResult,
  ResultValidationResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

const strategyFailureAnalysisSchema = z.object({
  failedStrategies: z.array(z.string()).describe('List of strategy IDs that failed'),
  failureReasons: z.array(z.string()).describe('Reasons why strategies failed'),
  suggestedImprovements: z.array(z.string()).describe('Suggested improvements for strategies'),
  alternativeApproaches: z.array(
    z.object({
      approach: z.string().describe('Alternative approach description'),
      reasoning: z.string().describe('Why this approach might work'),
      estimatedSuccess: z.number().min(0).max(1).describe('Estimated success probability'),
    }),
  ).describe('Alternative approaches to try'),
});

export type StrategyFailureAnalysis = z.infer<typeof strategyFailureAnalysisSchema>;

interface StrategyResult {
  strategy: PeopleSearchStrategyResult;
  preview: {
    itemCount: number;
    validation?: ResultValidationResult;
  } | null;
}

@Injectable()
export class StrategyEvolutionService {
  private readonly logger = new Logger(StrategyEvolutionService.name);

  constructor(
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly recruitingKnowledgePrompts: RecruitingKnowledgePrompts,
  ) {}

  /**
   * Analyze strategy failures and generate insights
   */
  async analyzeStrategyFailures(
    queryUnderstanding: QueryUnderstanding,
    strategyResults: StrategyResult[],
    apiToken: string,
  ): Promise<StrategyFailureAnalysis> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      // Identify failed strategies
      const failedStrategies = strategyResults
        .filter(
          (sr) =>
            !sr.preview?.validation ||
            sr.preview.validation.qualityAssessment === 'low' ||
            sr.preview.validation.relevanceScore < 0.5 ||
            sr.preview.itemCount === 0,
        )
        .map((sr) => sr.strategy.id);

      const failureReasons = strategyResults
        .filter((sr) => failedStrategies.includes(sr.strategy.id))
        .map((sr) => {
          if (sr.preview?.itemCount === 0) {
            return `Strategy ${sr.strategy.id}: No candidates found`;
          }
          if (sr.preview?.validation) {
            return `Strategy ${sr.strategy.id}: Low relevance (${sr.preview.validation.relevanceScore}) - ${sr.preview.validation.qualityAssessment} quality`;
          }
          return `Strategy ${sr.strategy.id}: Validation failed`;
        });

      const prompt = this.recruitingKnowledgePrompts.getStrategyEvolutionPrompt(
        queryUnderstanding,
        strategyResults.map((sr) => ({
          strategyId: sr.strategy.id,
          validation: sr.preview?.validation,
          candidateCount: sr.preview?.itemCount || 0,
        })),
        failureReasons,
      );

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          {
            role: 'system' as const,
            content:
              'You are an expert recruiter analyzing search strategy failures and evolving strategies. Analyze why strategies failed and suggest improvements.',
          },
          { role: 'user' as const, content: prompt },
        ],
        zodResponseFormat(strategyFailureAnalysisSchema, 'strategyFailureAnalysis'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream);

      if (!fullContent) {
        return this.generateDefaultFailureAnalysis(failedStrategies, failureReasons);
      }

      const parsed = JSON.parse(fullContent);
      return strategyFailureAnalysisSchema.parse(parsed);
    } catch (error) {
      this.logger.error(`Failed to analyze strategy failures: ${error}`);
      return this.generateDefaultFailureAnalysis(
        strategyResults
          .filter(
            (sr) =>
              !sr.preview?.validation ||
              sr.preview.validation.qualityAssessment === 'low' ||
              sr.preview.itemCount === 0,
          )
          .map((sr) => sr.strategy.id),
        ['Strategy validation failed or returned low quality results'],
      );
    }
  }

  /**
   * Generate default failure analysis when LLM fails
   */
  private generateDefaultFailureAnalysis(
    failedStrategies: string[],
    failureReasons: string[],
  ): StrategyFailureAnalysis {
    return {
      failedStrategies,
      failureReasons,
      suggestedImprovements: [
        'Broaden search parameters (remove restrictive filters)',
        'Try alternative role variations',
        'Expand location scope',
        'Reduce company filter restrictions',
      ],
      alternativeApproaches: [
        {
          approach: 'Broad search strategy',
          reasoning: 'Start with broader parameters and narrow down based on results',
          estimatedSuccess: 0.6,
        },
        {
          approach: 'Alternative role titles',
          reasoning: 'Try different role title variations that might match candidates',
          estimatedSuccess: 0.5,
        },
      ],
    };
  }

  /**
   * Generate alternative strategies based on failure analysis
   */
  async generateAlternativeStrategies(
    queryUnderstanding: QueryUnderstanding,
    failureAnalysis: StrategyFailureAnalysis,
    previousStrategies: PeopleSearchStrategyResult[],
    apiToken: string,
  ): Promise<Array<{
    strategy: Partial<PeopleSearchStrategyResult>;
    reasoning: string;
    estimatedSuccess: number;
  }>> {
    // Use knowledge base to find similar successful searches
    const similarSearches = this.knowledgeBase.findSimilarSearches(queryUnderstanding, 5);

    // Extract successful patterns
    const successfulPatterns = this.knowledgeBase.getSuccessfulStrategyPatterns(queryUnderstanding);

    // Generate alternative strategies based on:
    // 1. Failure analysis suggestions
    // 2. Similar successful searches
    // 3. Successful patterns

    const alternatives: Array<{
      strategy: Partial<PeopleSearchStrategyResult>;
      reasoning: string;
      estimatedSuccess: number;
    }> = [];

    // Add strategies from failure analysis
    for (const approach of failureAnalysis.alternativeApproaches) {
      alternatives.push({
        strategy: {
          id: `alternative-${Date.now()}-${Math.random()}`,
          label: approach.approach,
          aggressiveness: 'balanced',
        },
        reasoning: approach.reasoning,
        estimatedSuccess: approach.estimatedSuccess,
      });
    }

    // Add strategies from similar successful searches
    for (const similarSearch of similarSearches) {
      for (const strategyResult of similarSearch.strategyResults) {
        if (strategyResult.successRate > 0.7) {
          alternatives.push({
            strategy: {
              id: `similar-${Date.now()}-${Math.random()}`,
              label: strategyResult.strategyLabel,
              aggressiveness: 'balanced',
            },
            reasoning: `Based on similar successful search: ${similarSearch.queryUnderstanding.primaryRole}`,
            estimatedSuccess: strategyResult.successRate,
          });
        }
      }
    }

    // Sort by estimated success
    return alternatives.sort((a, b) => b.estimatedSuccess - a.estimatedSuccess);
  }

  /**
   * Rank strategies by performance
   */
  rankStrategiesByPerformance(
    strategyResults: StrategyResult[],
    validationResults: ResultValidationResult[],
  ): Array<{
    strategyId: string;
    score: number;
    ranking: number;
  }> {
    const rankings = strategyResults.map((sr, idx) => {
      const validation = sr.preview?.validation || validationResults[idx];
      const score =
        (validation?.relevanceScore || 0) * 0.6 +
        (sr.preview?.itemCount || 0 > 0 ? 0.4 : 0);

      return {
        strategyId: sr.strategy.id,
        score,
        ranking: 0, // Will be set after sorting
      };
    });

    // Sort by score descending
    rankings.sort((a, b) => b.score - a.score);

    // Assign rankings
    rankings.forEach((r, idx) => {
      r.ranking = idx + 1;
    });

    return rankings;
  }

  /**
   * Extract successful patterns from strategy rankings
   */
  extractSuccessfulPatterns(
    strategyRanking: Array<{
      strategyId: string;
      score: number;
      ranking: number;
    }>,
  ): Array<{
    pattern: string;
    successRate: number;
  }> {
    // Top 3 strategies are considered successful
    const topStrategies = strategyRanking.slice(0, 3);

    return topStrategies.map((s) => ({
      pattern: `Strategy ${s.strategyId}`,
      successRate: s.score,
    }));
  }
}

