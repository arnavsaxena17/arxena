import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
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

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  // In-memory storage
  private readonly searchPerformanceMap = new Map<string, SearchPerformance[]>();
  private readonly companyCultureMap = new Map<string, CompanyCulture>();
  private readonly orgStructurePatternMap = new Map<string, OrgStructurePattern[]>();
  private readonly locationClusterMap = new Map<string, LocationCluster>();
  private readonly competitorTierMap = new Map<string, CompetitorTier>();

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
   * Store company culture classification
   */
  storeCompanyCulture(culture: CompanyCulture): void {
    const key = `${culture.companyName.toLowerCase()}_${culture.industry?.toLowerCase() || ''}`;
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

