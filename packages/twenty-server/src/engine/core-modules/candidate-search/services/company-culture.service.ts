import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { KnowledgeBaseService } from './knowledge-base.service';
import { StreamProcessingService } from './stream-processing.service';

const companyCultureSchema = z.object({
  cultureType: z.enum(['promoter_driven', 'family_run', 'mnc', 'startup', 'psu', 'pe_backed', 'listed']),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.string()),
  similarCompanies: z.array(z.string()),
});

export type CompanyCulture = z.infer<typeof companyCultureSchema>;

@Injectable()
export class CompanyCultureService {
  private readonly logger = new Logger(CompanyCultureService.name);

  constructor(
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
  ) {}

  /**
   * Classify company culture using LLM
   */
  async classifyCompanyCulture(
    companyName: string,
    industry?: string,
    context?: string,
    apiToken?: string,
  ): Promise<CompanyCulture> {
    // Check knowledge base first
    const cached = this.knowledgeBase.getCompanyCulture(companyName, industry);
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
      this.knowledgeBase.storeCompanyCulture({
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
  ): CompanyCulture {
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
   * Find companies with similar culture
   */
  async findSimilarCultureCompanies(
    cultureType: 'promoter_driven' | 'family_run' | 'mnc' | 'startup' | 'psu' | 'pe_backed' | 'listed',
    industry: string,
    location?: string,
  ): Promise<string[]> {
    // This would ideally query a database or use discovery service
    // For now, return empty array - can be enhanced with actual company discovery
    this.logger.log(`Finding similar ${cultureType} companies in ${industry}${location ? `, ${location}` : ''}`);
    return [];
  }

  /**
   * Match culture fitment between candidate and target
   */
  matchCultureFitment(
    candidateCompanyCulture: CompanyCulture,
    targetCulture: 'promoter_driven' | 'family_run' | 'mnc' | 'startup' | 'psu' | 'pe_backed' | 'listed',
  ): { match: boolean; score: number; reasoning: string } {
    if (candidateCompanyCulture.cultureType === targetCulture) {
      return {
        match: true,
        score: candidateCompanyCulture.confidence,
        reasoning: `Exact culture match: ${targetCulture}`,
      };
    }

    // Compatible cultures
    const compatiblePairs: Array<[string, string]> = [
      ['promoter_driven', 'family_run'],
      ['family_run', 'promoter_driven'],
      ['mnc', 'listed'],
      ['listed', 'mnc'],
      ['startup', 'pe_backed'],
      ['pe_backed', 'startup'],
    ];

    const isCompatible = compatiblePairs.some(
      ([a, b]) =>
        (a === candidateCompanyCulture.cultureType && b === targetCulture) ||
        (b === candidateCompanyCulture.cultureType && a === targetCulture),
    );

    if (isCompatible) {
      return {
        match: true,
        score: candidateCompanyCulture.confidence * 0.7,
        reasoning: `Compatible culture: ${candidateCompanyCulture.cultureType} → ${targetCulture}`,
      };
    }

    return {
      match: false,
      score: 0.3,
      reasoning: `Culture mismatch: ${candidateCompanyCulture.cultureType} vs ${targetCulture}`,
    };
  }
}

