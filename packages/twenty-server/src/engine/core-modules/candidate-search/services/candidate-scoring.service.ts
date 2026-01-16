import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
  CandidateRelevanceScoring,
  candidateRelevanceScoringSchema
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
  ): Promise<CandidateRelevanceScoring> {
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

      const scoringSystemPrompt = this.searchParametersPrompts.getCandidateRelevanceScoringSystemPrompt();
      const scoringPrompt = this.searchParametersPrompts.buildCandidateRelevanceScoringUserPrompt(
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
            content: scoringSystemPrompt
          },
          { role: 'user' as const, content: scoringPrompt },
        ],
        zodResponseFormat(candidateRelevanceScoringSchema, 'candidateRelevanceScoring'),
      );

      // Use candidate-specific streaming to show reasoning per candidate in parallel
      // Timeout set to 60s to allow sufficient time for complete responses
      const fullContent = candidateIndex !== undefined && totalCandidates !== undefined && sendEvent
        ? await this.streamProcessingService.processStreamChunksForCandidate(stream, candidateIndex, totalCandidates, candidateName, sendEvent, 60000)
        : await this.streamProcessingService.processStreamChunks(stream, sendEvent, 60000);

      if (!fullContent || !fullContent.content || fullContent.content.trim().length === 0) {
        this.logger.warn('Candidate scoring returned empty content, using default score.');
        const defaultScore: CandidateRelevanceScoring = {
          relevanceScore: 0.5,
          relevanceLabel: 'somewhat_relevant' as const,
          matchReasons: [],
          mismatchReasons: [],
          roleMatch: false,
          companyTypeMatch: false,
          industryMatch: false,
          locationMatch: false,
          educationMatch: null,
          certificationMatch: null,
          regulatoryExperienceMatch: null,
          companySizeRangeMatch: null,
          functionalMatch: null,
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
            message: `Scored candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName} (${defaultScore.relevanceScore !== null && defaultScore.relevanceScore !== undefined ? (defaultScore.relevanceScore * 100).toFixed(0) : 'N/A'}% relevant)`,
          });
        }

        return defaultScore;
      }

      // Clean up the content - extract JSON if embedded in text
      let cleanedContent = fullContent.content.trim();
      
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

      
      // Send completion event with score
      if (sendEvent && candidateIndex !== undefined && totalCandidates !== undefined) {
        sendEvent('candidateScoring', {
          candidateIndex: candidateIndex + 1,
          totalCandidates,
          candidateName,
          candidateTitle,
          candidateCompany,
          status: 'completed',
          score: parsedResult,
          message: `Scored candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName} (${(parsedResult?.relevanceScore !== null && parsedResult?.relevanceScore !== undefined ? (parsedResult.relevanceScore * 100).toFixed(0) : 'N/A')}% relevant)`,
        });
      }
      
      return parsedResult
    } catch (error) {
      this.logger.error(`Failed to score candidate relevance: ${error}`);
      const errorScore = {
        relevanceScore: 0.5,
        relevanceLabel: 'somewhat_relevant' as const,
        matchReasons: [],
        mismatchReasons: [],
        roleMatch: false,
        companyTypeMatch: false,
        industryMatch: false,
        locationMatch: false,
        educationMatch: null,
        certificationMatch: null,
        regulatoryExperienceMatch: null,
        companySizeRangeMatch: null,
        functionalMatch: null,
        ageMatch: null,
        hierarchicalMatchLevel: null,
        likeToLikeMatch: null,
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
  ): Promise<Map<string, CandidateRelevanceScoring>> {
    const scores = new Map<string, CandidateRelevanceScoring>();
    
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
        const errorScore: CandidateRelevanceScoring = {
          relevanceScore: 0.5,
          relevanceLabel: 'somewhat_relevant' as const,
          matchReasons: [],
          mismatchReasons: [],
          roleMatch: null,
          companyTypeMatch: null,
          industryMatch: null,
          locationMatch: null,
          educationMatch: null,
          certificationMatch: null,
          regulatoryExperienceMatch: null,
          companySizeRangeMatch: null,
          functionalMatch: null,
          ageMatch: null,
          hierarchicalMatchLevel: null,
          likeToLikeMatch: null,
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
        ? allResults.reduce((sum, r) => sum + (r.score.relevanceScore ?? 0), 0) / completedCount
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


