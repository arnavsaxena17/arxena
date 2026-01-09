import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
    candidateRelevanceScoringSchema,
    normalizeCandidateRelevanceScoring,
} from '../schemas/candidate-relevance-scoring.schema';
import { ParsedJobDescription, QueryUnderstanding } from '../types/candidate-search-request.type';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class CandidateScoringService {
  private readonly logger = new Logger(CandidateScoringService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  /**
   * Score individual candidate relevance against query understanding
   */
  async scoreCandidateRelevance(
    candidate: any,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    apiToken: string,
    parsedJobDescription?: ParsedJobDescription,
    sendEvent?: (event: string, data: any) => boolean | void,
    candidateIndex?: number,
    totalCandidates?: number,
  ): Promise<{
    relevanceScore: number;
    relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
    matchReasons: string[];
    mismatchReasons?: string[];
    roleMatch: boolean;
    companyMatch: boolean;
    locationMatch: boolean;
    educationMatch?: boolean | null;
    certificationMatch?: boolean | null;
    regulatoryExperienceMatch?: boolean | null;
    companySizeMatch?: boolean | null;
    fundingStageMatch?: boolean | null;
    ageMatch?: boolean | null;
    hierarchicalMatchLevel?: number | null;
    likeToLikeMatch?: boolean | null;
    reasoning: string;
  }> {
    const candidateName = candidate.name || candidate.first_name || 'Unknown';
    const candidateTitle = candidate.headline || candidate.current_positions?.[0]?.role || 'N/A';
    const candidateCompany = candidate.current_positions?.[0]?.company || 'N/A';
    
    try {
      // Send progress event for candidate being scored
      if (sendEvent && candidateIndex !== undefined && totalCandidates !== undefined) {
        sendEvent('candidateScoring', {
          candidateIndex: candidateIndex + 1,
          totalCandidates,
          candidateName,
          candidateTitle,
          candidateCompany,
          status: 'analyzing',
          message: `Analyzing candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName}`,
        });
      }

      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );

      const scoringPrompt = this.searchParametersPrompts.buildCandidateRelevanceScoringPrompt(
        candidate,
        queryUnderstanding,
        userMessage,
        parsedJobDescription,
      );

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: 'You are an expert at scoring candidate relevance for LinkedIn search results. Provide accurate relevance scores and detailed reasoning.' 
          },
          { role: 'user' as const, content: scoringPrompt },
        ],
        zodResponseFormat(candidateRelevanceScoringSchema, 'candidateRelevanceScoring'),
      );

      // Use candidate-specific streaming to show reasoning per candidate in parallel
      // Reduced timeout to 30s to prevent long hangs
      const fullContent = candidateIndex !== undefined && totalCandidates !== undefined && sendEvent
        ? await this.streamProcessingService.processStreamChunksForCandidate(stream, candidateIndex, totalCandidates, candidateName, sendEvent, 30000)
        : await this.streamProcessingService.processStreamChunks(stream, sendEvent, 30000);

      if (!fullContent || fullContent.trim().length === 0) {
        this.logger.warn('Candidate scoring returned empty content, using default score.');
        const defaultScore = {
          relevanceScore: 0.5,
          relevanceLabel: 'somewhat_relevant' as const,
          matchReasons: [],
          roleMatch: false,
          companyMatch: false,
          locationMatch: false,
          educationMatch: null,
          certificationMatch: null,
          regulatoryExperienceMatch: null,
          companySizeMatch: null,
          fundingStageMatch: null,
          ageMatch: null,
          hierarchicalMatchLevel: null,
          likeToLikeMatch: null,
          reasoning: 'Scoring failed, defaulting to medium relevance',
        };
        
        // Send completion event with default score
        if (sendEvent && candidateIndex !== undefined && totalCandidates !== undefined) {
          sendEvent('candidateScoring', {
            candidateIndex: candidateIndex + 1,
            totalCandidates,
            candidateName,
            candidateTitle,
            candidateCompany,
            status: 'completed',
            score: defaultScore,
            message: `Scored candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName} (${(defaultScore.relevanceScore * 100).toFixed(0)}% relevant)`,
          });
        }
        
        return defaultScore;
      }

      // Clean up the content - extract JSON if embedded in text
      let cleanedContent = fullContent.trim();
      
      // Try to extract JSON if it's embedded in text
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleanedContent);
      } catch (parseError) {
        this.logger.error(`Failed to parse candidate scoring JSON for ${candidateName}: ${parseError}. Content preview: ${cleanedContent.substring(0, 500)}`);
        // Schema will handle this with .catch() and return defaults
        parsed = {};
      }

      // Parse with schema (which is now simple and JSON Schema compatible)
      let parsedResult: any;
      try {
        parsedResult = candidateRelevanceScoringSchema.parse(parsed);
      } catch (validationError) {
        // If validation fails, use safeParse
        const safeResult = candidateRelevanceScoringSchema.safeParse(parsed);
        if (safeResult.success) {
          parsedResult = safeResult.data;
        } else {
          // If both fail, parsedResult will be undefined and normalization will use defaults
          this.logger.warn(`Schema validation failed for candidate ${candidateName}, using normalization defaults`);
          parsedResult = undefined;
        }
      }

      // Normalize the result to ensure all fields have proper values and handle edge cases
      const result = normalizeCandidateRelevanceScoring(parsedResult);
      
      // Send completion event with score
      if (sendEvent && candidateIndex !== undefined && totalCandidates !== undefined) {
        sendEvent('candidateScoring', {
          candidateIndex: candidateIndex + 1,
          totalCandidates,
          candidateName,
          candidateTitle,
          candidateCompany,
          status: 'completed',
          score: result,
          message: `Scored candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName} (${(result.relevanceScore * 100).toFixed(0)}% relevant)`,
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to score candidate relevance: ${error}`);
      const errorScore = {
        relevanceScore: 0.5,
        relevanceLabel: 'somewhat_relevant' as const,
        matchReasons: [],
        roleMatch: false,
        companyMatch: false,
        locationMatch: false,
        educationMatch: null,
        reasoning: 'Scoring error, defaulting to medium relevance',
      };
      
      // Send error event
      if (sendEvent && candidateIndex !== undefined && totalCandidates !== undefined) {
        sendEvent('candidateScoring', {
          candidateIndex: candidateIndex + 1,
          totalCandidates,
          candidateName,
          candidateTitle,
          candidateCompany,
          status: 'error',
          score: errorScore,
          message: `Error scoring candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName}`,
        });
      }
      
      return errorScore;
    }
  }

  /**
   * Score multiple candidates in batch (more efficient than individual calls)
   * All requests are sent in parallel for maximum efficiency
   */
  async scoreCandidatesBatch(
    candidates: any[],
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    apiToken: string,
    parsedJobDescription?: ParsedJobDescription,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<Map<string, {
    relevanceScore: number;
    relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
    matchReasons: string[];
    mismatchReasons?: string[];
    roleMatch: boolean;
    companyMatch: boolean;
    locationMatch: boolean;
    educationMatch?: boolean | null;
    reasoning: string;
  }>> {
    const scores = new Map();
    
    if (candidates.length === 0) {
      return scores;
    }

    // Send initial batch scoring event
    if (sendEvent) {
      sendEvent('candidateScoringBatch', {
        totalCandidates: candidates.length,
        status: 'started',
        message: `Starting to score ${candidates.length} candidates...`,
      });
    }

    // Score all candidates in parallel (no batching - all requests go out simultaneously)
    // This maximizes efficiency and minimizes wait time for the user
    const allPromises = candidates.map(async (candidate, index) => {
      try {
        // Use id, urn, or a combination of name and index as unique identifier
        const candidateId = candidate.id || candidate.urn || `${candidate.name || 'unknown'}-${index}`;
        const score = await this.scoreCandidateRelevance(
          candidate,
          queryUnderstanding,
          userMessage,
          apiToken,
          parsedJobDescription,
          sendEvent,
          index,
          candidates.length,
        );
        return { candidateId, score, candidate };
      } catch (error) {
        this.logger.error(`Failed to score candidate ${index}: ${error}`);
        // Return default score on error
        const candidateId = candidate.id || candidate.urn || `${candidate.name || 'unknown'}-${index}`;
        const candidateName = candidate.name || candidate.first_name || 'Unknown';
        const errorScore = {
          relevanceScore: 0.5,
          relevanceLabel: 'somewhat_relevant' as const,
          matchReasons: [],
          roleMatch: false,
          companyMatch: false,
          locationMatch: false,
          educationMatch: null,
          reasoning: 'Scoring failed, defaulting to medium relevance',
        };
        
        // Send error event
        if (sendEvent) {
          sendEvent('candidateScoring', {
            candidateIndex: index + 1,
            totalCandidates: candidates.length,
            candidateName,
            status: 'error',
            score: errorScore,
            message: `Error scoring candidate ${index + 1}/${candidates.length}: ${candidateName}`,
          });
        }
        
        return {
          candidateId,
          score: errorScore,
          candidate,
        };
      }
    });
    
    // Wait for all scoring requests to complete in parallel
    const allResults = await Promise.all(allPromises);
    
    // Store all scores with multiple keys for flexible lookup
    allResults.forEach(({ candidateId, score, candidate }) => {
      // Store score with primary ID
      scores.set(candidateId, score);
      // Also store by urn if available
      if (candidate.urn) {
        scores.set(candidate.urn, score);
      }
      // Store by name as fallback
      if (candidate.name) {
        scores.set(candidate.name, score);
      }
    });
    
    // Send batch completion event
    if (sendEvent) {
      const completedCount = allResults.length;
      const avgScore = completedCount > 0
        ? Array.from(scores.values()).reduce((sum, s) => sum + s.relevanceScore, 0) / completedCount
        : 0;
      
      sendEvent('candidateScoringBatch', {
        totalCandidates: candidates.length,
        completedCount,
        status: 'completed',
        averageScore: avgScore,
        message: `Completed scoring ${completedCount} candidates (average relevance: ${(avgScore * 100).toFixed(0)}%)`,
      });
    }
    
    return scores;
  }
}

