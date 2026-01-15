import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { BooleanQueryBuilderResult, booleanQueryBuilderSchema } from '../schemas/boolean-query-builder.schema';
import { JobTitleDiscoveryResult } from '../schemas/discovery.schemas';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class BooleanQueryBuilderService {
  private readonly logger = new Logger(BooleanQueryBuilderService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  /**
   * Generate sophisticated boolean query for Sales Navigator or Recruiter
   * Creates comprehensive boolean queries that capture different company nomenclatures
   * 
   * Example: For "Head of Operations", generates:
   * (Operations AND (GM OR President OR vp OR agm OR head)) OR ((plant OR unit OR works OR site) AND (head))
   */
  async generateSophisticatedBooleanQuery(
    role: string,
    discoveredTitles: JobTitleDiscoveryResult,
    searchType: 'sales_navigator' | 'recruiter',
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<BooleanQueryBuilderResult | null> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const eventResult = sendEvent?.('status', { message: 'Generating sophisticated boolean query...' });
      if (eventResult === false) {
        this.logger.log('Stream aborted during boolean query generation');
        return null;
      }

      // Extract hierarchical and domain terms from discovered titles
      const hierarchicalTerms: string[] = [];
      const domainTerms: string[] = [];
      const nomenclaturePatterns: string[] = [];

      discoveredTitles.jobTitles.forEach(jobTitle => {
        if (jobTitle.hierarchicalTerms) {
          hierarchicalTerms.push(...jobTitle.hierarchicalTerms);
        }
        if (jobTitle.domainTerms) {
          domainTerms.push(...jobTitle.domainTerms);
        }
        if (jobTitle.nomenclaturePatterns) {
          nomenclaturePatterns.push(...jobTitle.nomenclaturePatterns);
        }
      });

      // Also extract from variations
      const allVariations = discoveredTitles.jobTitles.flatMap(jt => [jt.title, ...jt.variations]);

      const systemPrompt = this.searchParametersPrompts.getBooleanQueryGenerationSystemPrompt(searchType);
      const prompt = this.searchParametersPrompts.getBooleanQueryGenerationUserPrompt(
        role,
        allVariations,
        hierarchicalTerms,
        domainTerms,
        nomenclaturePatterns,
        searchType,
      );

      const completion = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: prompt },
        ],
        zodResponseFormat(booleanQueryBuilderSchema, 'booleanQueryBuilder'),
      );

      const response = await this.streamProcessingService.processStreamChunks(completion, sendEvent);

      if (!response) {
        this.logger.warn('Boolean query generation returned empty content');
        return null;
      }

      const content = typeof response === 'string' ? response : response.content;
      this.logger.log('content created from boolean query generation: ', content);
      if (!content) {
        this.logger.warn('Boolean query generation returned empty content');
        return null;
      }

      const parsed = JSON.parse(content);
      const result = booleanQueryBuilderSchema.parse(parsed);
      // this.logger.log('result created from boolean query generation: ', JSON.stringify(result, null, 2));
      this.logger.log(`Generated sophisticated boolean query: ${result.booleanQuery}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to generate sophisticated boolean query: ${error}`);
      return null;
    }
  }
}
