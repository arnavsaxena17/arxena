import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { DiscoveryService } from './discovery.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { StreamProcessingService } from './stream-processing.service';

const competitorTierSchema = z.object({
  tier: z.enum(['tier_1', 'tier_2', 'tier_3']).describe('Competitor tier classification'),
  companies: z.array(
    z.object({
      name: z.string(),
      tier: z.enum(['tier_1', 'tier_2', 'tier_3']),
      reasoning: z.string(),
    }),
  ).describe('List of companies with their tier classifications'),
});

export type CompetitorTier = z.infer<typeof competitorTierSchema>;

@Injectable()
export class CompetitorClassificationService {
  private readonly logger = new Logger(CompetitorClassificationService.name);

  constructor(
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly discoveryService: DiscoveryService,
  ) {}

  /**
   * Classify competitor tier for a company
   */
  async classifyCompetitorTier(
    companyName: string,
    industry: string,
    apiToken?: string,
  ): Promise<{ tier: 'tier_1' | 'tier_2' | 'tier_3'; confidence: number } | null> {
    // Check knowledge base first
    const cached = this.knowledgeBase.getCompetitorTier(companyName, industry);
    if (cached) {
      this.logger.log(`Using cached competitor tier for: ${companyName}`);
      return { tier: cached.tier, confidence: 0.8 };
    }

    // If no API token, return null
    if (!apiToken) {
      return null;
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const prompt = this.searchParametersPrompts.getCompetitorMatchingPrompt(companyName, industry);

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          {
            role: 'system' as const,
            content:
              'You are an expert at classifying companies into competitor tiers (Tier 1, Tier 2, Tier 3) based on market position, size, and industry leadership.',
          },
          { role: 'user' as const, content: prompt },
        ],
        zodResponseFormat(competitorTierSchema, 'competitorTier'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream);

      if (!fullContent) {
        return null;
      }

      const parsed = JSON.parse(fullContent);
      const validated = competitorTierSchema.parse(parsed);

      // Find the company in the list
      const company = validated.companies.find((c) =>
        c.name.toLowerCase() === companyName.toLowerCase(),
      );

      if (company) {
        // Store in knowledge base
        this.knowledgeBase.storeCompetitorTier({
          companyName,
          industry,
          tier: company.tier,
          similarCompanies: validated.companies
            .filter((c) => c.tier === company.tier)
            .map((c) => c.name),
        });

        return { tier: company.tier, confidence: 0.8 };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to classify competitor tier: ${error}`);
      return null;
    }
  }

  /**
   * Get competitor tiers for an industry
   */
  async getCompetitorTiers(
    industry: string,
    companyType?: string,
    apiToken?: string,
  ): Promise<CompetitorTier | null> {
    if (!apiToken) {
      return null;
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const prompt = this.searchParametersPrompts.getCompetitorMatchingPrompt(
        undefined,
        industry,
        companyType,
      );

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          {
            role: 'system' as const,
            content:
              'You are an expert at classifying companies into competitor tiers. Return a comprehensive list of companies in the industry classified by tier.',
          },
          { role: 'user' as const, content: prompt },
        ],
        zodResponseFormat(competitorTierSchema, 'competitorTier'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream);

      if (!fullContent) {
        return null;
      }

      const parsed = JSON.parse(fullContent);
      return competitorTierSchema.parse(parsed);
    } catch (error) {
      this.logger.error(`Failed to get competitor tiers: ${error}`);
      return null;
    }
  }

  /**
   * Expand company group to all subsidiaries
   */
  async expandCompanyGroup(groupName: string, apiToken: string): Promise<string[]> {
    // Use discovery service to find group members
    try {
      const result = await this.discoveryService.discoverCompanyGroupMembers(
        groupName,
        apiToken,
      );
      return result.companies.map((c) => c.name);
    } catch (error) {
      this.logger.error(`Failed to expand company group: ${error}`);
      return [];
    }
  }

  /**
   * Prioritize competitors for search
   */
  prioritizeCompetitors(
    companies: string[],
    industry: string,
    apiToken?: string,
  ): Array<{ company: string; priority: number; tier: 'tier_1' | 'tier_2' | 'tier_3' | 'unknown' }> {
    // Classify each company and prioritize by tier
    const prioritized = companies.map((company) => {
      const tier = this.knowledgeBase.getCompetitorTier(company, industry);
      const tierValue: 'tier_1' | 'tier_2' | 'tier_3' | 'unknown' = tier?.tier || 'unknown';
      return {
        company,
        priority: tierValue === 'tier_1' ? 1 : tierValue === 'tier_2' ? 2 : tierValue === 'tier_3' ? 3 : 4,
        tier: tierValue,
      };
    });

    // Sort by priority (lower number = higher priority)
    return prioritized.sort((a, b) => a.priority - b.priority);
  }
}

