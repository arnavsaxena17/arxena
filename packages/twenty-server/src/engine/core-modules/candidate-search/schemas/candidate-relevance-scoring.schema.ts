import { z } from 'zod';

export const candidateRelevanceScoringSchema = z.object({
  relevanceScore: z.number().min(0).max(1).nullable(),
  relevanceLabel: z.enum(['highly_relevant', 'somewhat_relevant', 'less_relevant']).nullable(),
  matchReasons: z.array(z.string()).nullable(),
  mismatchReasons: z.array(z.string()).nullable(),
  roleMatch: z.boolean().nullable().describe('Whether candidate\'s role matches the query role'),
  companyTypeMatch: z.boolean().nullable().describe('Whether candidate\'s company type matches the query company type'),
  industryMatch: z.boolean().nullable().describe('Whether candidate\'s industry matches the query industry'),
  locationMatch: z.boolean().nullable().describe('Whether candidate\'s location matches the query location'),
  educationMatch: z.boolean().nullable().describe('Whether candidate\'s education matches the query education'),
  certificationMatch: z.boolean().nullable().describe('Whether candidate meets certification requirements'),
  regulatoryExperienceMatch: z.boolean().nullable().describe('Whether candidate has required regulatory experience'),
  companySizeRangeMatch: z.boolean().nullable().describe('Whether candidate\'s company size range matches the query company size range'),
  functionalMatch: z.boolean().nullable().describe('Whether candidate\'s functional role matches the query functional role'),
  // fundingStageMatch: z.boolean().nullable().describe('Whether candidate\'s company funding stage matches the query funding stage'),
  ageMatch: z.boolean().nullable().describe('Whether candidate meets age constraints (inferred from graduation year)'),
  hierarchicalMatchLevel: z.number().nullable().optional().describe('Hierarchical match level (0 = exact match, 1 = one level down, etc.)'),
  likeToLikeMatch: z.boolean().nullable().describe('Whether candidate is exact like-to-like match (role + functional role + hierarchical match level + company type + size)'),
  reasoning: z.string().nullable(),
});

export type CandidateRelevanceScoring = z.infer<typeof candidateRelevanceScoringSchema>;

export function normalizeCandidateRelevanceScoring(
  raw: Partial<CandidateRelevanceScoring> | null | undefined,
): {
  relevanceScore: number;
  relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
  matchReasons: string[];
  mismatchReasons?: string[];
  roleMatch: boolean;
  companyTypeMatch: boolean;
  industryMatch: boolean;
  locationMatch: boolean;
  educationMatch?: boolean | null;
  certificationMatch?: boolean | null;
  regulatoryExperienceMatch?: boolean | null;
  companySizeRangeMatch?: boolean | null;
  functionalMatch?: boolean | null;
  // fundingStageMatch?: boolean | null;
  ageMatch?: boolean | null;
  hierarchicalMatchLevel?: number | null;
  likeToLikeMatch?: boolean | null;
  reasoning: string;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      relevanceScore: 0.5,
      relevanceLabel: 'somewhat_relevant',
      matchReasons: [],
      mismatchReasons: undefined,
      roleMatch: false,
      companyTypeMatch: false,
      industryMatch: false,
      locationMatch: false,
      educationMatch: null,
      reasoning: 'No reasoning provided',
    };
  }

  let relevanceScore = 0.5;
  if (typeof raw.relevanceScore === 'number') {
    relevanceScore = Math.max(0, Math.min(1, raw.relevanceScore));
  } else if (typeof raw.relevanceScore === 'string') {
    const parsed = parseFloat(raw.relevanceScore);
    if (!isNaN(parsed)) {
      relevanceScore = Math.max(0, Math.min(1, parsed));
    }
  }

  let relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant' = 'somewhat_relevant';
  if (
    raw.relevanceLabel === 'highly_relevant' ||
    raw.relevanceLabel === 'somewhat_relevant' ||
    raw.relevanceLabel === 'less_relevant'
  ) {
    relevanceLabel = raw.relevanceLabel;
  }

  let matchReasons: string[] = [];
  if (Array.isArray(raw.matchReasons)) {
    matchReasons = raw.matchReasons.filter((r): r is string => typeof r === 'string' && r.trim().length > 0);
  } else if (typeof raw.matchReasons === 'string') {
    matchReasons = [raw.matchReasons];
  }

  let mismatchReasons: string[] | undefined = undefined;
  const mismatchReasonsValue = raw.mismatchReasons as unknown;
  if (mismatchReasonsValue === null || mismatchReasonsValue === undefined) {
    mismatchReasons = undefined;
  } else if (Array.isArray(mismatchReasonsValue)) {
    const filtered = mismatchReasonsValue.filter((r): r is string => typeof r === 'string' && r.trim().length > 0);
    mismatchReasons = filtered.length > 0 ? filtered : undefined;
  } else if (typeof mismatchReasonsValue === 'string') {
    mismatchReasons = mismatchReasonsValue.trim().length > 0 ? [mismatchReasonsValue] : undefined;
  }

  const roleMatch = Boolean(raw.roleMatch);
  const companyTypeMatch = Boolean(raw.companyTypeMatch);
  const industryMatch = Boolean(raw.industryMatch);
  const locationMatch = Boolean(raw.locationMatch);

  let educationMatch: boolean | null | undefined = undefined;
  const educationMatchValue = raw.educationMatch as unknown;
  if (educationMatchValue === true || educationMatchValue === false) {
    educationMatch = educationMatchValue;
  } else if (educationMatchValue === null) {
    educationMatch = null;
  } else if (typeof educationMatchValue === 'string') {
    const trimmed = educationMatchValue.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes') {
      educationMatch = true;
    } else if (trimmed === 'false' || trimmed === '0' || trimmed === 'no') {
      educationMatch = false;
    }
  }

  const normalizeBooleanField = (value: unknown): boolean | null | undefined => {
    if (value === true || value === false) {
      return value;
    } else if (value === null) {
      return null;
    } else if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes') {
        return true;
      } else if (trimmed === 'false' || trimmed === '0' || trimmed === 'no') {
        return false;
      }
    }
    return undefined;
  };

  const certificationMatch = normalizeBooleanField(raw.certificationMatch);
  const regulatoryExperienceMatch = normalizeBooleanField(raw.regulatoryExperienceMatch);
  const companySizeRangeMatch = normalizeBooleanField(raw.companySizeRangeMatch);
  const functionalMatch = normalizeBooleanField(raw.functionalMatch);
  const ageMatch = normalizeBooleanField(raw.ageMatch);
  const likeToLikeMatch = normalizeBooleanField(raw.likeToLikeMatch);

  let hierarchicalMatchLevel: number | null | undefined = undefined;
  if (typeof raw.hierarchicalMatchLevel === 'number') {
    hierarchicalMatchLevel = raw.hierarchicalMatchLevel;
  } else if (raw.hierarchicalMatchLevel === null) {
    hierarchicalMatchLevel = null;
  } else if (typeof raw.hierarchicalMatchLevel === 'string') {
    const parsed = parseInt(raw.hierarchicalMatchLevel, 10);
    if (!isNaN(parsed)) {
      hierarchicalMatchLevel = parsed;
    }
  }

  let reasoning = 'No reasoning provided';
  if (typeof raw.reasoning === 'string' && raw.reasoning.trim().length > 0) {
    reasoning = raw.reasoning.trim();
  } else if (typeof raw.reasoning === 'number') {
    reasoning = String(raw.reasoning);
  }

  const result: {
    relevanceScore: number;
    relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
    matchReasons: string[];
    mismatchReasons?: string[];
    roleMatch: boolean;
    companyTypeMatch: boolean;
    industryMatch: boolean;
    locationMatch: boolean;
    educationMatch?: boolean | null;
    certificationMatch?: boolean | null;
    regulatoryExperienceMatch?: boolean | null;
    companySizeRangeMatch?: boolean | null;
    functionalMatch?: boolean | null;
    ageMatch?: boolean | null;
    hierarchicalMatchLevel?: number | null;
    likeToLikeMatch?: boolean | null;
    reasoning: string;
  } = {
    relevanceScore,
    relevanceLabel,
    matchReasons,
    roleMatch,
    companyTypeMatch,
    industryMatch,
    locationMatch,
    reasoning,
  };

  if (mismatchReasons !== undefined) {
    result.mismatchReasons = mismatchReasons;
  }

  if (educationMatch !== undefined) {
    result.educationMatch = educationMatch;
  }

  if (certificationMatch !== undefined) {
    result.certificationMatch = certificationMatch;
  }

  if (regulatoryExperienceMatch !== undefined) {
    result.regulatoryExperienceMatch = regulatoryExperienceMatch;
  }

  if (companySizeRangeMatch !== undefined) {
    result.companySizeRangeMatch = companySizeRangeMatch;
  }

  if (functionalMatch !== undefined) {
    result.functionalMatch = functionalMatch;
  }

  if (ageMatch !== undefined) {
    result.ageMatch = ageMatch;
  }

  if (hierarchicalMatchLevel !== undefined) {
    result.hierarchicalMatchLevel = hierarchicalMatchLevel;
  }

  if (likeToLikeMatch !== undefined) {
    result.likeToLikeMatch = likeToLikeMatch;
  }

  return result;
}

