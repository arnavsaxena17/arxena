import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { KnowledgeBaseService } from './knowledge-base.service';
import { StreamProcessingService } from './stream-processing.service';

const locationFallbackStrategySchema = z.object({
  primary: z.string().describe('Primary location'),
  fallbackLocations: z.array(
    z.object({
      location: z.string().describe('Fallback location name'),
      priority: z.number().describe('Priority order (lower number = higher priority)'),
      reasoning: z.string().describe('Why this location is a good fallback'),
      clusterType: z.string().nullable().describe('Type of industrial cluster (e.g., "manufacturing", "IT", "pharma")'),
    }),
  ).describe('Ordered list of fallback locations'),
});

export type LocationFallbackStrategy = z.infer<typeof locationFallbackStrategySchema>;

interface LocationCluster {
  location: string;
  clusters: Array<{
    location: string;
    priority: number;
    clusterType: string;
    reasoning: string;
  }>;
  industry?: string;
}

@Injectable()
export class LocationClusterService {
  private readonly logger = new Logger(LocationClusterService.name);

  // Industrial cluster knowledge base
  private readonly clusterKnowledge: Record<string, Array<{ location: string; priority: number; clusterType: string }>> = {
    'mt abu': [
      { location: 'Rajasthan', priority: 1, clusterType: 'manufacturing' },
      { location: 'Gujarat', priority: 2, clusterType: 'manufacturing' },
      { location: 'Ahmedabad', priority: 3, clusterType: 'manufacturing' },
    ],
    'surat': [
      { location: 'Gujarat', priority: 1, clusterType: 'manufacturing' },
      { location: 'Ahmedabad', priority: 2, clusterType: 'manufacturing' },
      { location: 'Vadodara', priority: 3, clusterType: 'manufacturing' },
    ],
    'pune': [
      { location: 'Mumbai', priority: 1, clusterType: 'manufacturing' },
      { location: 'Nashik', priority: 2, clusterType: 'manufacturing' },
      { location: 'Aurangabad', priority: 3, clusterType: 'manufacturing' },
    ],
  };

  constructor(
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
  ) {}

  /**
   * Get industrial clusters for a location
   */
  async getLocationClusters(
    location: string,
    industry?: string,
    apiToken?: string,
  ): Promise<LocationCluster | null> {
    // Check knowledge base first
    const cached = this.knowledgeBase.getLocationClusters(location, industry);
    if (cached) {
      this.logger.log(`Using cached location clusters for: ${location}`);
      return cached;
    }

    // Check hardcoded knowledge
    const locationLower = location.toLowerCase();
    const hardcoded = this.clusterKnowledge[locationLower];
    if (hardcoded) {
      const cluster: LocationCluster = {
        location,
        clusters: hardcoded.map((c) => ({
          ...c,
          reasoning: `Industrial cluster near ${location}`,
        })),
        industry,
      };
      this.knowledgeBase.storeLocationClusters(cluster);
      return cluster;
    }

    
    // If we have API token, use LLM to determine clusters
    if (apiToken) {
      return await this.getLocationClustersWithLLM(location, industry, apiToken);
    }

    // Fallback: return empty clusters
    return {
      location,
      clusters: [],
      industry,
    };
  }

  /**
   * Get location clusters using LLM
   */
  private async getLocationClustersWithLLM(
    location: string,
    industry: string | undefined,
    apiToken: string,
  ): Promise<LocationCluster | null> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const prompt = this.searchParametersPrompts.getLocationStrategyPrompt(location, industry);

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          {
            role: 'system' as const,
            content:
              'You are an expert at identifying industrial clusters and location fallback strategies for recruitment. Identify nearby locations that are industrial clusters or have similar talent pools.',
          },
          { role: 'user' as const, content: prompt },
        ],
        zodResponseFormat(locationFallbackStrategySchema, 'locationFallbackStrategy'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream);

      if (!fullContent) {
        return null;
      }

      const parsed = JSON.parse(fullContent);
      const validated = locationFallbackStrategySchema.parse(parsed);

      const cluster: LocationCluster = {
        location: validated.primary,
        clusters: validated.fallbackLocations.map((fl) => ({
          location: fl.location,
          priority: fl.priority,
          clusterType: fl.clusterType ?? 'unknown',
          reasoning: fl.reasoning,
        })),
        industry,
      };

      // Store in knowledge base
      this.knowledgeBase.storeLocationClusters(cluster);

      return cluster;
    } catch (error) {
      this.logger.error(`Failed to get location clusters with LLM: ${error}`);
      return null;
    }
  }

  /**
   * Get location fallback strategy with priority ordering
   */
  async getLocationFallbackStrategy(
    location: string,
    industry?: string,
    priority?: number[],
    apiToken?: string,
  ): Promise<LocationFallbackStrategy | null> {
    const clusters = await this.getLocationClusters(location, industry, apiToken);
    if (!clusters || clusters.clusters.length === 0) {
      return null;
    }

    // Sort by priority if provided, otherwise use existing priority
    const sortedClusters = [...clusters.clusters].sort((a, b) => {
      if (priority && priority.length > 0) {
        const indexA = priority.indexOf(a.priority);
        const indexB = priority.indexOf(b.priority);
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
      }
      return a.priority - b.priority;
    });

    return {
      primary: clusters.location,
      fallbackLocations: sortedClusters.map((c) => ({
        location: c.location,
        priority: c.priority,
        clusterType: c.clusterType ?? 'unknown',
        reasoning: c.reasoning,
      })),
    };
  }

  /**
   * Get proximity locations within a radius
   */
  getProximityLocations(
    location: string,
    radiusKm: number = 100,
  ): string[] {
    // This would ideally use a geocoding service
    // For now, return empty array - can be enhanced with actual geocoding
    this.logger.log(`Getting proximity locations for ${location} within ${radiusKm}km`);
    return [];
  }
}

