import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
    ClassicPeopleSearchStrategyResult, QueryUnderstanding, RecruiterPeopleSearchStrategyResult,
    ResultValidationResult,
    SalesNavigatorPeopleSearchStrategyResult
} from '../types/candidate-search-request.type';
import { StreamProcessingService } from './stream-processing.service';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

interface SearchPerformance {
  queryHash: string;
  queryUnderstanding: QueryUnderstanding;
  strategyResults: Array<{
    strategyId: string;
    strategyLabel: string;
    validationResult?: ResultValidationResult;
    candidateCount: number;
    successRate: number;
  }>;
  timestamp: string;
  overallSuccess: boolean;
}

interface CompanyCulture {
  companyName: string;
  cultureType: 'promoter_driven' | 'family_run' | 'mnc' | 'startup' | 'psu' | 'pe_backed' | 'listed';
  confidence: number;
  indicators: string[];
  similarCompanies: string[];
}

interface OrgStructurePattern {
  role: string;
  companySize: { min?: number; max?: number };
  industry: string;
  reportingTo?: string;
  manages: string[];
  level: number;
  equivalentRoles: string[];
}

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

interface CompetitorTier {
  companyName: string;
  industry: string;
  tier: 'tier_1' | 'tier_2' | 'tier_3';
  similarCompanies: string[];
}

// Schemas for LLM responses
const companyCultureSchema = z.object({
  cultureType: z.enum(['promoter_driven', 'family_run', 'mnc', 'startup', 'psu', 'pe_backed', 'listed']),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.string()),
  similarCompanies: z.array(z.string()),
});

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

const orgStructureSchema = z.object({
  reportingTo: z.string().nullable().describe('Who this role reports to (e.g., "CEO", "MD", "VP Operations")'),
  manages: z.array(z.string()).describe('Roles that report to this position'),
  level: z.number().describe('Hierarchy level (0 = CEO, 1 = C-suite, 2 = VP, 3 = Director, etc.)'),
  equivalentRoles: z.array(z.string()).describe('Equivalent roles at different company sizes'),
  companySizeContext: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
  }).describe('Company size range this structure applies to'),
});

export type CompanyCultureType = z.infer<typeof companyCultureSchema>;
export type LocationFallbackStrategy = z.infer<typeof locationFallbackStrategySchema>;
export type OrgStructure = z.infer<typeof orgStructureSchema>;

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  // In-memory storage
  private readonly searchPerformanceMap = new Map<string, SearchPerformance[]>();
  private readonly companyCultureMap = new Map<string, CompanyCulture>();
  private readonly orgStructurePatternMap = new Map<string, OrgStructurePattern[]>();
  private readonly locationClusterMap = new Map<string, LocationCluster>();
  private readonly competitorTierMap = new Map<string, CompetitorTier>();

  // Industrial cluster knowledge base (hardcoded)
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
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
  ) {}

  /**
   * Generate a hash for a query understanding to use as a key
   */
  private generateQueryHash(queryUnderstanding: QueryUnderstanding): string {
    const keyData = {
      primaryRole: queryUnderstanding.primaryRole,
      industry: queryUnderstanding.industry,
      location: queryUnderstanding.locationHierarchy?.primary,
      seniority: queryUnderstanding.seniorityLevel,
      domain: queryUnderstanding.domainContext,
    };
    const keyString = JSON.stringify(keyData);
    return createHash('sha256').update(keyString).digest('hex').substring(0, 16);
  }

  /**
   * Store search performance for learning
   */
  storeSearchPerformance(
    queryUnderstanding: QueryUnderstanding,
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      preview: {
        itemCount: number;
        validation?: ResultValidationResult;
      } | null;
    }>,
  ): void {
    try {
      const queryHash = this.generateQueryHash(queryUnderstanding);
      const performance: SearchPerformance = {
        queryHash,
        queryUnderstanding: { ...queryUnderstanding },
        strategyResults: strategyResults.map((sr) => ({
          strategyId: sr.strategy.id,
          strategyLabel: sr.strategy.label,
          validationResult: sr.preview?.validation,
          candidateCount: sr.preview?.itemCount || 0,
          successRate: sr.preview?.validation
            ? sr.preview.validation.relevanceScore
            : 0,
        })),
        timestamp: new Date().toISOString(),
        overallSuccess:
          strategyResults.some(
            (sr) =>
              sr.preview?.validation &&
              sr.preview.validation.qualityAssessment === 'high' &&
              sr.preview.validation.relevanceScore > 0.7,
          ) || false,
      };

      const existing = this.searchPerformanceMap.get(queryHash) || [];
      existing.push(performance);
      // Keep only last 50 searches per query hash
      if (existing.length > 50) {
        existing.shift();
      }
      this.searchPerformanceMap.set(queryHash, existing);

      this.logger.log(
        `Stored search performance for query hash: ${queryHash}, strategies: ${strategyResults.length}`,
      );
    } catch (error) {
      this.logger.error(`Failed to store search performance: ${error}`);
    }
  }

  /**
   * Find similar searches based on query understanding
   */
  findSimilarSearches(
    queryUnderstanding: QueryUnderstanding,
    limit: number = 5,
  ): SearchPerformance[] {
    try {
      const queryHash = this.generateQueryHash(queryUnderstanding);
      const exactMatches = this.searchPerformanceMap.get(queryHash) || [];

      // Also search for similar queries (same role, similar industry/location)
      const similar: SearchPerformance[] = [];
      for (const [hash, performances] of this.searchPerformanceMap.entries()) {
        if (hash === queryHash) continue;

        for (const perf of performances) {
          const q = perf.queryUnderstanding;
          // Check similarity
          if (
            q.primaryRole === queryUnderstanding.primaryRole &&
            q.seniorityLevel === queryUnderstanding.seniorityLevel
          ) {
            similar.push(perf);
          }
        }
      }

      // Combine and sort by success rate
      const all = [...exactMatches, ...similar]
        .filter((p) => p.overallSuccess)
        .sort((a, b) => {
          const avgA =
            a.strategyResults.reduce((sum, s) => sum + s.successRate, 0) /
            a.strategyResults.length;
          const avgB =
            b.strategyResults.reduce((sum, s) => sum + s.successRate, 0) /
            b.strategyResults.length;
          return avgB - avgA;
        })
        .slice(0, limit);

      this.logger.log(
        `Found ${all.length} similar searches for query: ${queryUnderstanding.primaryRole}`,
      );
      return all;
    } catch (error) {
      this.logger.error(`Failed to find similar searches: ${error}`);
      return [];
    }
  }

  /**
   * Get or classify company culture
   */
  getCompanyCulture(
    companyName: string,
    industry?: string,
  ): CompanyCulture | null {
    const key = `${companyName.toLowerCase()}_${industry?.toLowerCase() || ''}`;
    return this.companyCultureMap.get(key) || null;
  }

  /**
   * Classify company culture using LLM (merged from CompanyCultureService)
   */
  async classifyCompanyCulture(
    companyName: string,
    industry?: string,
    context?: string,
    apiToken?: string,
  ): Promise<CompanyCultureType> {
    // Check knowledge base first
    const cached = this.getCompanyCulture(companyName, industry);
    if (cached) {
      this.logger.log(`Using cached culture classification for: ${companyName}`);
      return cached;
    }

    // If no API token, use heuristics
    if (!apiToken) {
      return this.classifyCompanyCultureHeuristic(companyName, industry, context);
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const prompt = this.searchParametersPrompts.getCultureClassificationPrompt(
        companyName,
        industry,
        context,
      );

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          {
            role: 'system' as const,
            content:
              'You are an expert at classifying company cultures. Analyze companies to determine their culture type: promoter-driven, family-run, MNC, startup, PSU, PE-backed, or listed.',
          },
          { role: 'user' as const, content: prompt },
        ],
        zodResponseFormat(companyCultureSchema, 'companyCulture'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream);

      if (!fullContent) {
        this.logger.warn('Culture classification returned empty content, using heuristics');
        return this.classifyCompanyCultureHeuristic(companyName, industry, context);
      }

      const parsed = JSON.parse(fullContent);
      const validated = companyCultureSchema.parse(parsed);

      // Store in knowledge base
      this.storeCompanyCulture({
        companyName,
        ...validated,
      });

      return validated;
    } catch (error) {
      this.logger.error(`Failed to classify company culture: ${error}`);
      return this.classifyCompanyCultureHeuristic(companyName, industry, context);
    }
  }

  /**
   * Heuristic-based culture classification (fallback)
   */
  private classifyCompanyCultureHeuristic(
    companyName: string,
    industry?: string,
    context?: string,
  ): CompanyCultureType {
    const nameLower = companyName.toLowerCase();
    const contextLower = (context || '').toLowerCase();

    // Check context for explicit mentions
    if (contextLower.includes('promoter') || contextLower.includes('promoter-driven')) {
      return {
        cultureType: 'promoter_driven',
        confidence: 0.8,
        indicators: ['promoter-driven mentioned in context'],
        similarCompanies: [],
      };
    }

    if (contextLower.includes('family') || contextLower.includes('family-run')) {
      return {
        cultureType: 'family_run',
        confidence: 0.8,
        indicators: ['family-run mentioned in context'],
        similarCompanies: [],
      };
    }

    // Heuristic patterns
    if (nameLower.includes('group') || nameLower.includes('holdings')) {
      return {
        cultureType: 'promoter_driven',
        confidence: 0.6,
        indicators: ['Company name suggests group structure'],
        similarCompanies: [],
      };
    }

    // Default to MNC for unknown
    return {
      cultureType: 'mnc',
      confidence: 0.5,
      indicators: ['Default classification'],
      similarCompanies: [],
    };
  }

  /**
   * Store company culture classification
   */
  storeCompanyCulture(culture: CompanyCulture): void {
    const key = `${culture.companyName.toLowerCase()}_${culture.cultureType?.toLowerCase() || ''}`;
    this.companyCultureMap.set(key, culture);
    this.logger.log(`Stored company culture for: ${culture.companyName}`);
  }

  /**
   * Get location clusters for a location
   */
  getLocationClusters(
    location: string,
    industry?: string,
  ): LocationCluster | null {
    const key = `${location.toLowerCase()}_${industry?.toLowerCase() || ''}`;
    return this.locationClusterMap.get(key) || null;
  }

  /**
   * Get industrial clusters for a location (merged from LocationClusterService)
   * This method extends the existing getLocationClusters with LLM support
   */
  async getLocationClustersAsync(
    location: string,
    industry?: string,
    apiToken?: string,
  ): Promise<LocationCluster | null> {
    // Check knowledge base first
    const cached = this.getLocationClusters(location, industry);
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
      this.storeLocationClusters(cluster);
      return cluster;
    }

    // If we have API token, use LLM to determine clusters
    if (apiToken) {
      return await this.getLocationClustersWithLLMInternal(location, industry, apiToken);
    }

    // Fallback: return empty clusters
    return {
      location,
      clusters: [],
      industry,
    };
  }

  /**
   * Get location clusters using LLM (internal method)
   */
  private async getLocationClustersWithLLMInternal(
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
      this.storeLocationClusters(cluster);

      return cluster;
    } catch (error) {
      this.logger.error(`Failed to get location clusters with LLM: ${error}`);
      return null;
    }
  }

  /**
   * Store location cluster information
   */
  storeLocationClusters(cluster: LocationCluster): void {
    const key = `${cluster.location.toLowerCase()}_${cluster.industry?.toLowerCase() || ''}`;
    this.locationClusterMap.set(key, cluster);
    this.logger.log(`Stored location clusters for: ${cluster.location}`);
  }

  /**
   * Get org structure pattern for a role/company size/industry combination
   */
  getOrgStructurePattern(
    role: string,
    companySize: { min?: number; max?: number },
    industry: string,
  ): OrgStructurePattern[] {
    const patterns: OrgStructurePattern[] = [];
    for (const [key, patternList] of this.orgStructurePatternMap.entries()) {
      for (const pattern of patternList) {
        if (
          pattern.role.toLowerCase() === role.toLowerCase() &&
          pattern.industry.toLowerCase() === industry.toLowerCase()
        ) {
          // Check company size overlap
          const sizeMatch =
            (!companySize.min ||
              !pattern.companySize.max ||
              companySize.min <= pattern.companySize.max) &&
            (!companySize.max ||
              !pattern.companySize.min ||
              companySize.max >= pattern.companySize.min);
          if (sizeMatch) {
            patterns.push(pattern);
          }
        }
      }
    }
    return patterns;
  }

  /**
   * Get org structure pattern using LLM (merged from OrgChartMappingService)
   * This method extends the existing getOrgStructurePattern with LLM support
   */
  async getOrgStructurePatternAsync(
    role: string,
    companySize: { min?: number; max?: number },
    industry: string,
    apiToken?: string,
  ): Promise<OrgStructure[]> {
    // Check knowledge base first
    const patterns = this.getOrgStructurePattern(role, companySize, industry);
    if (patterns.length > 0) {
      // Convert to OrgStructure format
      return patterns.map((p) => ({
        reportingTo: p.reportingTo || null,
        manages: p.manages,
        level: p.level,
        equivalentRoles: p.equivalentRoles,
        companySizeContext: { min: p.companySize.min || null, max: p.companySize.max || null },
      }));
    }

    // If no pattern found and we have API token, use LLM
    if (apiToken) {
      return await this.getOrgStructurePatternWithLLMInternal(role, companySize, industry, apiToken);
    }

    // Fallback to heuristics
    return [this.extractReportingStructureHeuristic(role, companySize)];
  }

  /**
   * Get org structure pattern using LLM (internal method)
   */
  private async getOrgStructurePatternWithLLMInternal(
    role: string,
    companySize: { min?: number; max?: number },
    industry: string,
    apiToken: string,
  ): Promise<OrgStructure[]> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const prompt = this.searchParametersPrompts.getOrgStructureKnowledgePrompt(
        role,
        companySize,
        industry,
      );

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          {
            role: 'system' as const,
            content:
              'You are an expert at analyzing organizational structures. Extract reporting relationships and hierarchy levels for roles based on company size and industry.',
          },
          { role: 'user' as const, content: prompt },
        ],
        zodResponseFormat(orgStructureSchema, 'orgStructure'),
      );

      const fullContent = await this.streamProcessingService.processStreamChunks(stream);

      if (!fullContent) {
        return [this.extractReportingStructureHeuristic(role, companySize)];
      }

      const parsed = JSON.parse(fullContent);
      const validated = orgStructureSchema.parse(parsed);

      // Store in knowledge base
      this.storeOrgStructurePattern({
        role,
        companySize,
        industry,
        reportingTo: validated.reportingTo || undefined,
        manages: validated.manages,
        level: validated.level,
        equivalentRoles: validated.equivalentRoles,
      });

      return [validated];
    } catch (error) {
      this.logger.error(`Failed to extract reporting structure with LLM: ${error}`);
      return [this.extractReportingStructureHeuristic(role, companySize)];
    }
  }

  /**
   * Heuristic-based reporting structure extraction
   */
  private extractReportingStructureHeuristic(
    role: string,
    companySize: { min?: number; max?: number },
  ): OrgStructure {
    const roleLower = role.toLowerCase();

    // CEO level
    if (roleLower.includes('ceo') || roleLower.includes('chief executive')) {
      return {
        reportingTo: null,
        manages: ['COO', 'CFO', 'CTO', 'CHRO', 'CMO'],
        level: 0,
        equivalentRoles: ['Managing Director', 'President', 'Founder'],
        companySizeContext: { min: companySize.min || null, max: companySize.max || null },
      };
    }

    // C-suite level
    if (
      roleLower.includes('chief') ||
      roleLower.includes('cfo') ||
      roleLower.includes('cto') ||
      roleLower.includes('chro') ||
      roleLower.includes('cmo') ||
      roleLower.includes('coo')
    ) {
      return {
        reportingTo: 'CEO',
        manages: ['VP', 'Head of', 'Director'],
        level: 1,
        equivalentRoles: ['Executive Director', 'President'],
        companySizeContext: { min: companySize.min || null, max: companySize.max || null },
      };
    }

    // VP level
    if (roleLower.includes('vp') || roleLower.includes('vice president')) {
      return {
        reportingTo: 'C-suite',
        manages: ['Director', 'Head of', 'Manager'],
        level: 2,
        equivalentRoles: ['Senior Director', 'General Manager'],
        companySizeContext: { min: companySize.min || null, max: companySize.max || null },
      };
    }

    // Director level
    if (roleLower.includes('director')) {
      return {
        reportingTo: 'VP',
        manages: ['Manager', 'Senior Manager'],
        level: 3,
        equivalentRoles: ['Senior Manager', 'Head of'],
        companySizeContext: { min: companySize.min || null, max: companySize.max || null },
      };
    }

    // Default
    return {
      reportingTo: 'Manager',
      manages: [],
      level: 4,
      equivalentRoles: [],
      companySizeContext: { min: companySize.min || null, max: companySize.max || null },
    };
  }

  /**
   * Store org structure pattern
   */
  storeOrgStructurePattern(pattern: OrgStructurePattern): void {
    const key = `${pattern.role}_${pattern.industry}_${pattern.companySize.min || 0}_${pattern.companySize.max || 999999}`;
    const existing = this.orgStructurePatternMap.get(key) || [];
    existing.push(pattern);
    this.orgStructurePatternMap.set(key, existing);
    this.logger.log(`Stored org structure pattern for: ${pattern.role}`);
  }

  /**
   * Get competitor tier classification
   */
  getCompetitorTier(
    companyName: string,
    industry: string,
  ): CompetitorTier | null {
    const key = `${companyName.toLowerCase()}_${industry.toLowerCase()}`;
    return this.competitorTierMap.get(key) || null;
  }

  /**
   * Classify competitor tier for a company (merged from CompetitorClassificationService)
   */
  async classifyCompetitorTier(
    companyName: string,
    industry: string,
    apiToken?: string,
  ): Promise<{ tier: 'tier_1' | 'tier_2' | 'tier_3'; confidence: number } | null> {
    // Check knowledge base first
    const cached = this.getCompetitorTier(companyName, industry);
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
        this.storeCompetitorTier({
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
   * Get competitor tiers for an industry (merged from CompetitorClassificationService)
   */
  async getCompetitorTiers(
    industry: string,
    companyType?: string,
    apiToken?: string,
  ): Promise<{ tier: 'tier_1' | 'tier_2' | 'tier_3'; companies: Array<{ name: string; tier: 'tier_1' | 'tier_2' | 'tier_3'; reasoning: string }> } | null> {
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
      const validated = competitorTierSchema.parse(parsed);

      // Store each company in knowledge base
      for (const company of validated.companies) {
        this.storeCompetitorTier({
          companyName: company.name,
          industry,
          tier: company.tier,
          similarCompanies: validated.companies
            .filter((c) => c.tier === company.tier)
            .map((c) => c.name),
        });
      }

      return {
        tier: validated.tier,
        companies: validated.companies,
      };
    } catch (error) {
      this.logger.error(`Failed to get competitor tiers: ${error}`);
      return null;
    }
  }

  /**
   * Store competitor tier classification
   */
  storeCompetitorTier(tier: CompetitorTier): void {
    const key = `${tier.companyName.toLowerCase()}_${tier.industry.toLowerCase()}`;
    this.competitorTierMap.set(key, tier);
    this.logger.log(`Stored competitor tier for: ${tier.companyName}`);
  }

  /**
   * Get all successful strategy patterns for a query type
   */
  getSuccessfulStrategyPatterns(
    queryUnderstanding: QueryUnderstanding,
  ): Array<{
    strategyLabel: string;
    aggressiveness: string;
    successRate: number;
    parameterPattern: any;
  }> {
    const similarSearches = this.findSimilarSearches(queryUnderstanding, 10);
    const patterns: Array<{
      strategyLabel: string;
      aggressiveness: string;
      successRate: number;
      parameterPattern: any;
    }> = [];

    for (const search of similarSearches) {
      for (const strategyResult of search.strategyResults) {
        if (strategyResult.successRate > 0.7) {
          patterns.push({
            strategyLabel: strategyResult.strategyLabel,
            aggressiveness: 'balanced', // Would need to store this
            successRate: strategyResult.successRate,
            parameterPattern: {}, // Would need to store actual parameters
          });
        }
      }
    }

    // Deduplicate and sort by success rate
    const unique = new Map<string, typeof patterns[0]>();
    for (const pattern of patterns) {
      const key = pattern.strategyLabel;
      if (!unique.has(key) || unique.get(key)!.successRate < pattern.successRate) {
        unique.set(key, pattern);
      }
    }

    return Array.from(unique.values()).sort(
      (a, b) => b.successRate - a.successRate,
    );
  }
}

