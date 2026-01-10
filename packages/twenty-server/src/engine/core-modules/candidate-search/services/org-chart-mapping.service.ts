import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { KnowledgeBaseService } from './knowledge-base.service';
import { StreamProcessingService } from './stream-processing.service';

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

export type OrgStructure = z.infer<typeof orgStructureSchema>;

interface RoleEquivalence {
  sourceRole: string;
  targetRole: string;
  sourceCompanySize: { min?: number; max?: number };
  targetCompanySize: { min?: number; max?: number };
  confidence: number;
  reasoning: string;
}

interface OrgStructureMatch {
  match: boolean;
  score: number;
  reasoning: string;
  roleEquivalence?: RoleEquivalence;
}

@Injectable()
export class OrgChartMappingService {
  private readonly logger = new Logger(OrgChartMappingService.name);

  constructor(
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
  ) {}

  /**
   * Extract reporting structure from a candidate profile
   */
  async extractReportingStructure(
    profile: any,
    apiToken?: string,
  ): Promise<OrgStructure | null> {
    // Try to extract from profile data
    const currentRole = profile.currentRole || profile.jobTitle || '';
    const company = profile.currentCompany || profile.company || '';
    const companySize = this.estimateCompanySize(profile);

    if (!currentRole) {
      return null;
    }

    // Check knowledge base first
    const patterns = this.knowledgeBase.getOrgStructurePattern(
      currentRole,
      companySize,
      profile.industry || '',
    );

    if (patterns.length > 0) {
      // Use the most relevant pattern
      const pattern = patterns[0];
      return {
        reportingTo: pattern.reportingTo || null,
        manages: pattern.manages,
        level: pattern.level,
        equivalentRoles: pattern.equivalentRoles,
        companySizeContext: { min: pattern.companySize.min || 0, max: pattern.companySize.max || 0 } as any ,
      };
    }

    // If no pattern found and we have API token, use LLM
    if (apiToken) {
      return await this.extractReportingStructureWithLLM(
        currentRole,
        companySize,
        profile.industry || '',
        apiToken,
      );
    }

    // Fallback to heuristics
    return this.extractReportingStructureHeuristic(currentRole, companySize);
  }

  /**
   * Extract reporting structure using LLM
   */
  private async extractReportingStructureWithLLM(
    role: string,
    companySize: { min?: number; max?: number },
    industry: string,
    apiToken: string,
  ): Promise<OrgStructure | null> {
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
        return this.extractReportingStructureHeuristic(role, companySize);
      }

      const parsed = JSON.parse(fullContent);
      const validated = orgStructureSchema.parse(parsed);

      // Store in knowledge base
      this.knowledgeBase.storeOrgStructurePattern({
        role,
        companySize,
        industry,
        reportingTo: validated.reportingTo || undefined,
        manages: validated.manages,
        level: validated.level,
        equivalentRoles: validated.equivalentRoles,
      });

      return validated;
    } catch (error) {
      this.logger.error(`Failed to extract reporting structure with LLM: ${error}`);
      return this.extractReportingStructureHeuristic(role, companySize);
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
        companySizeContext: { min: companySize.min || 0, max: companySize.max || 0 } as any ,
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
        companySizeContext: { min: companySize.min || 0, max: companySize.max || 0 } as any ,
      };
    }

    // VP level
    if (roleLower.includes('vp') || roleLower.includes('vice president')) {
      return {
        reportingTo: 'C-suite',
        manages: ['Director', 'Head of', 'Manager'],
        level: 2,
        equivalentRoles: ['Senior Director', 'General Manager'],
        companySizeContext: { min: companySize.min || 0, max: companySize.max || 0 } as any ,
      };
    }

    // Director level
    if (roleLower.includes('director')) {
      return {
        reportingTo: 'VP',
        manages: ['Manager', 'Senior Manager'],
        level: 3,
        equivalentRoles: ['Senior Manager', 'Head of'],
        companySizeContext: { min: companySize.min || 0, max: companySize.max || 0 } as any ,
      };
    }

    // Default
    return {
      reportingTo: 'Manager',
      manages: [],
      level: 4,
      equivalentRoles: [],
      companySizeContext: { min: companySize.min || 0, max: companySize.max || 0 } as any ,
    };
  }

  /**
   * Map role equivalence between different company sizes
   */
  async mapRoleEquivalence(
    role: string,
    sourceCompanySize: { min?: number; max?: number },
    targetCompanySize: { min?: number; max?: number },
    industry: string,
  ): Promise<RoleEquivalence> {
    // Get patterns for both sizes
    const sourcePatterns = this.knowledgeBase.getOrgStructurePattern(
      role,
      sourceCompanySize,
      industry,
    );
    const targetPatterns = this.knowledgeBase.getOrgStructurePattern(
      role,
      targetCompanySize,
      industry,
    );

    // If we have patterns, use them
    if (sourcePatterns.length > 0 && targetPatterns.length > 0) {
      const sourcePattern = sourcePatterns[0];
      const targetPattern = targetPatterns[0];

      // Find equivalent role
      const equivalentRole =
        targetPattern.equivalentRoles.find((er) =>
          sourcePattern.equivalentRoles.includes(er),
        ) || role;

      return {
        sourceRole: role,
        targetRole: equivalentRole,
        sourceCompanySize,
        targetCompanySize,
        confidence: 0.8,
        reasoning: `Role equivalence based on org structure patterns: ${role} in ${this.formatCompanySize(sourceCompanySize)} company ≈ ${equivalentRole} in ${this.formatCompanySize(targetCompanySize)} company`,
      };
    }

    // Heuristic-based equivalence
    return this.mapRoleEquivalenceHeuristic(
      role,
      sourceCompanySize,
      targetCompanySize,
    );
  }

  /**
   * Heuristic-based role equivalence
   */
  private mapRoleEquivalenceHeuristic(
    role: string,
    sourceCompanySize: { min?: number; max?: number },
    targetCompanySize: { min?: number; max?: number },
  ): RoleEquivalence {
    const sourceSize = (sourceCompanySize.min || 0) + (sourceCompanySize.max || 0) / 2;
    const targetSize = (targetCompanySize.min || 0) + (targetCompanySize.max || 0) / 2;

    const roleLower = role.toLowerCase();
    let targetRole = role;
    let confidence = 0.6;

    // If source is much larger, role might be equivalent to higher role in target
    if (sourceSize > targetSize * 2) {
      if (roleLower.includes('vp') || roleLower.includes('vice president')) {
        targetRole = 'Director';
        confidence = 0.7;
      } else if (roleLower.includes('director')) {
        targetRole = 'Senior Manager';
        confidence = 0.7;
      } else if (roleLower.includes('executive director')) {
        targetRole = 'CEO';
        confidence = 0.8;
      }
    }

    // If target is much larger, role might be equivalent to lower role in target
    if (targetSize > sourceSize * 2) {
      if (roleLower.includes('director')) {
        targetRole = 'VP';
        confidence = 0.7;
      } else if (roleLower.includes('manager')) {
        targetRole = 'Director';
        confidence = 0.7;
      }
    }

    return {
      sourceRole: role,
      targetRole,
      sourceCompanySize,
      targetCompanySize,
      confidence,
      reasoning: `Heuristic role equivalence: ${role} in ${this.formatCompanySize(sourceCompanySize)} company ≈ ${targetRole} in ${this.formatCompanySize(targetCompanySize)} company`,
    };
  }

  /**
   * Find org structure matches between candidate and target
   */
  async findOrgStructureMatches(
    candidate: { role: string; companySize: { min?: number; max?: number } },
    target: {
      role: string;
      companySize: { min?: number; max?: number };
      industry: string;
    },
  ): Promise<OrgStructureMatch> {
    // Get role equivalence
    const equivalence = await this.mapRoleEquivalence(
      candidate.role,
      candidate.companySize,
      target.companySize,
      target.industry,
    );

    // Check if roles are equivalent
    if (equivalence.targetRole.toLowerCase() === target.role.toLowerCase()) {
      return {
        match: true,
        score: equivalence.confidence,
        reasoning: equivalence.reasoning,
        roleEquivalence: equivalence,
      };
    }

    // Check level equivalence
    const candidateStructure = this.extractReportingStructureHeuristic(
      candidate.role,
      candidate.companySize,
    );
    const targetStructure = this.extractReportingStructureHeuristic(
      target.role,
      target.companySize,
    );

    const levelDiff = Math.abs(candidateStructure.level - targetStructure.level);
    if (levelDiff <= 1) {
      return {
        match: true,
        score: 0.7 - levelDiff * 0.1,
        reasoning: `Level equivalence: ${candidate.role} (level ${candidateStructure.level}) ≈ ${target.role} (level ${targetStructure.level})`,
        roleEquivalence: equivalence,
      };
    }

    return {
      match: false,
      score: 0.3,
      reasoning: `Level mismatch: ${candidate.role} (level ${candidateStructure.level}) vs ${target.role} (level ${targetStructure.level})`,
      roleEquivalence: equivalence,
    };
  }

  /**
   * Get reporting level for a role
   */
  async getReportingLevel(
    role: string,
    companySize: { min?: number; max?: number },
    industry: string,
  ): Promise<OrgStructure> {
    const patterns = this.knowledgeBase.getOrgStructurePattern(
      role,
      companySize,
      industry,
    );

    if (patterns.length > 0) {
      const pattern = patterns[0];
      return {
        reportingTo: pattern.reportingTo || null,
        manages: pattern.manages,
        level: pattern.level,
        equivalentRoles: pattern.equivalentRoles,
        companySizeContext: { min: pattern.companySize.min || 0, max: pattern.companySize.max || 0 } as any ,
      };
    }

    return this.extractReportingStructureHeuristic(role, companySize);
  }

  /**
   * Get org structure pattern
   */
  async getOrgStructurePattern(
    role: string,
    companySize: { min?: number; max?: number },
    industry: string,
  ): Promise<OrgStructure[]> {
    const patterns = this.knowledgeBase.getOrgStructurePattern(
      role,
      companySize,
      industry,
    );
    return patterns.map((p) => ({
      reportingTo: p.reportingTo || null,
      manages: p.manages,
      level: p.level,
      equivalentRoles: p.equivalentRoles,
      companySizeContext: { min: p.companySize.min || 0, max: p.companySize.max || 0 } as any ,
    }));
  }

  /**
   * Estimate company size from profile
   */
  private estimateCompanySize(profile: any): { min?: number; max?: number } {
    // Try to extract from profile data
    if (profile.companySize) {
      return profile.companySize;
    }

    // Heuristic based on role and company name
    // This is a simplified estimation
    return { min: 100, max: 1000 };
  }

  /**
   * Format company size for display
   */
  private formatCompanySize(size: { min?: number; max?: number }): string {
    if (size.min && size.max) {
      return `${size.min}-${size.max}`;
    }
    if (size.min) {
      return `${size.min}+`;
    }
    if (size.max) {
      return `up to ${size.max}`;
    }
    return 'unknown size';
  }
}

