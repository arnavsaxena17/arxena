import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CompanyCultureService } from './company-culture.service';
import { OrgChartMappingService } from './org-chart-mapping.service';

const executiveValidationSchema = z.object({
  orgStructureFitment: z.object({
    match: z.boolean(),
    score: z.number(),
    reasoning: z.string(),
  }),
  cultureMatch: z.object({
    match: z.boolean(),
    score: z.number(),
    reasoning: z.string(),
  }),
  reportingEquivalence: z.object({
    match: z.boolean(),
    score: z.number(),
    reasoning: z.string(),
  }),
});

export type ExecutiveValidation = z.infer<typeof executiveValidationSchema>;

interface CandidateProfile {
  role: string;
  company: string;
  companySize?: { min?: number; max?: number };
  industry?: string;
}

interface TargetRequirements {
  role: string;
  companySize?: { min?: number; max?: number };
  industry?: string;
  companyCulture?: 'promoter_driven' | 'family_run' | 'mnc' | 'startup' | 'psu' | 'pe_backed' | 'listed';
  reportingTo?: string;
  manages?: string[];
}

@Injectable()
export class ExecutiveValidationService {
  private readonly logger = new Logger(ExecutiveValidationService.name);

  constructor(
    private readonly orgChartMapping: OrgChartMappingService,
    private readonly companyCulture: CompanyCultureService,
  ) {}

  /**
   * Validate org structure fitment
   */
  async validateOrgStructureFitment(
    candidate: CandidateProfile,
    targetRequirements: TargetRequirements,
    apiToken?: string,
  ): Promise<{
    match: boolean;
    score: number;
    reasoning: string;
  }> {
    if (!targetRequirements.role || !candidate.role) {
      return {
        match: false,
        score: 0,
        reasoning: 'Missing role information',
      };
    }

    try {
      const match = await this.orgChartMapping.findOrgStructureMatches(
        {
          role: candidate.role,
          companySize: candidate.companySize || {},
        },
        {
          role: targetRequirements.role,
          companySize: targetRequirements.companySize || {},
          industry: targetRequirements.industry || '',
        },
      );

      return {
        match: match.match,
        score: match.score,
        reasoning: match.reasoning,
      };
    } catch (error) {
      this.logger.error(`Failed to validate org structure fitment: ${error}`);
      return {
        match: false,
        score: 0,
        reasoning: `Validation error: ${error}`,
      };
    }
  }

  /**
   * Validate culture match
   */
  async validateCultureMatch(
    candidate: CandidateProfile,
    targetCulture: 'promoter_driven' | 'family_run' | 'mnc' | 'startup' | 'psu' | 'pe_backed' | 'listed',
    apiToken?: string,
  ): Promise<{
    match: boolean;
    score: number;
    reasoning: string;
  }> {
    try {
      const candidateCulture = await this.companyCulture.classifyCompanyCulture(
        candidate.company,
        candidate.industry,
        undefined,
        apiToken,
      );

      const fitment = this.companyCulture.matchCultureFitment(
        candidateCulture,
        targetCulture,
      );

      return fitment;
    } catch (error) {
      this.logger.error(`Failed to validate culture match: ${error}`);
      return {
        match: false,
        score: 0.3,
        reasoning: `Culture validation error: ${error}`,
      };
    }
  }

  /**
   * Validate reporting equivalence
   */
  async validateReportingEquivalence(
    candidate: CandidateProfile,
    targetRequirements: TargetRequirements,
    apiToken?: string,
  ): Promise<{
    match: boolean;
    score: number;
    reasoning: string;
  }> {
    if (!targetRequirements.reportingTo && !targetRequirements.manages) {
      return {
        match: true,
        score: 1.0,
        reasoning: 'No reporting structure requirements specified',
      };
    }

    try {
      const candidateStructure = await this.orgChartMapping.getReportingLevel(
        candidate.role,
        candidate.companySize || {},
    candidate.industry || '',
      );

      // Check reporting to match
      if (targetRequirements.reportingTo) {
        const reportsToMatch =
          candidateStructure.reportingTo?.toLowerCase() ===
          targetRequirements.reportingTo.toLowerCase();
        if (!reportsToMatch) {
          return {
            match: false,
            score: 0.5,
            reasoning: `Reporting mismatch: candidate reports to ${candidateStructure.reportingTo}, target requires ${targetRequirements.reportingTo}`,
          };
        }
      }

      // Check manages match
      if (targetRequirements.manages && targetRequirements.manages.length > 0) {
        const managesMatch = targetRequirements.manages.some((m) =>
          candidateStructure.manages.some(
            (cm) => cm.toLowerCase() === m.toLowerCase(),
          ),
        );
        if (!managesMatch) {
          return {
            match: false,
            score: 0.6,
            reasoning: `Manages mismatch: candidate manages ${candidateStructure.manages.join(', ')}, target requires ${targetRequirements.manages.join(', ')}`,
          };
        }
      }

      return {
        match: true,
        score: 0.9,
        reasoning: 'Reporting structure matches requirements',
      };
    } catch (error) {
      this.logger.error(`Failed to validate reporting equivalence: ${error}`);
      return {
        match: false,
        score: 0.3,
        reasoning: `Reporting validation error: ${error}`,
      };
    }
  }

  /**
   * Perform comprehensive executive validation
   */
  async validateExecutiveCandidate(
    candidate: CandidateProfile,
    targetRequirements: TargetRequirements,
    apiToken?: string,
  ): Promise<ExecutiveValidation> {
    const [orgStructure, culture, reporting] = await Promise.all([
      this.validateOrgStructureFitment(candidate, targetRequirements, apiToken),
      targetRequirements.companyCulture
        ? this.validateCultureMatch(candidate, targetRequirements.companyCulture, apiToken)
        : Promise.resolve({
            match: true,
            score: 1.0,
            reasoning: 'No culture requirement specified',
          }),
      this.validateReportingEquivalence(candidate, targetRequirements, apiToken),
    ]);

    return {
      orgStructureFitment: orgStructure,
      cultureMatch: culture,
      reportingEquivalence: reporting,
    };
  }
}

