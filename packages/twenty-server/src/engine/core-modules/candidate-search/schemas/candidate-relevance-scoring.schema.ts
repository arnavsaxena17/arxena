import { z } from 'zod';

/**
 * Simple, clean schema for candidate relevance scoring that converts cleanly to JSON Schema
 * All normalization is handled in post-processing via normalizeCandidateRelevanceScoring()
 * 
 * Note: All fields are nullable to satisfy OpenAI structured outputs API requirements.
 * The API requires that optional fields be nullable. The normalization function handles
 * null/undefined values and provides appropriate defaults.
 */
export const candidateRelevanceScoringSchema = z.object({
  relevanceScore: z.number().min(0).max(1).nullable(),
  relevanceLabel: z.enum(['highly_relevant', 'somewhat_relevant', 'less_relevant']).nullable(),
  matchReasons: z.array(z.string()).nullable(),
  mismatchReasons: z.array(z.string()).nullable(),
  roleMatch: z.boolean().nullable(),
  companyMatch: z.boolean().nullable(),
  locationMatch: z.boolean().nullable(),
  educationMatch: z.boolean().nullable(),
  // Enhanced match fields
  certificationMatch: z.boolean().nullable().describe('Whether candidate meets certification requirements'),
  regulatoryExperienceMatch: z.boolean().nullable().describe('Whether candidate has required regulatory experience'),
  companySizeMatch: z.boolean().nullable().describe('Whether candidate\'s company matches size requirements'),
  fundingStageMatch: z.boolean().nullable().describe('Whether candidate\'s company matches funding stage requirements'),
  ageMatch: z.boolean().nullable().describe('Whether candidate meets age constraints (inferred from graduation year)'),
  hierarchicalMatchLevel: z.number().nullable().optional().describe('Hierarchical match level (0 = exact match, 1 = one level down, etc.)'),
  likeToLikeMatch: z.boolean().nullable().describe('Whether candidate is exact like-to-like match (role + company type + size)'),
  reasoning: z.string().nullable(),
});

export type CandidateRelevanceScoring = z.infer<typeof candidateRelevanceScoringSchema>;

/**
 * Normalizes a candidate relevance scoring result to ensure all fields have proper values
 * Handles edge cases like null, undefined, invalid types, etc.
 */
export function normalizeCandidateRelevanceScoring(
  raw: Partial<CandidateRelevanceScoring> | null | undefined,
): {
  relevanceScore: number;
  relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
  matchReasons: string[];
  mismatchReasons?: string[];
  roleMatch: boolean;
  companyMatch: boolean;
  locationMatch: boolean;
  educationMatch?: boolean | null;
  certificationMatch?: boolean | null;
  regulatoryExperienceMatch?: boolean | null;
  companySizeMatch?: boolean | null;
  fundingStageMatch?: boolean | null;
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
      companyMatch: false,
      locationMatch: false,
      educationMatch: null,
      reasoning: 'No reasoning provided',
    };
  }

  // Normalize relevanceScore
  let relevanceScore = 0.5;
  if (typeof raw.relevanceScore === 'number') {
    relevanceScore = Math.max(0, Math.min(1, raw.relevanceScore));
  } else if (typeof raw.relevanceScore === 'string') {
    const parsed = parseFloat(raw.relevanceScore);
    if (!isNaN(parsed)) {
      relevanceScore = Math.max(0, Math.min(1, parsed));
    }
  }

  // Normalize relevanceLabel
  let relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant' = 'somewhat_relevant';
  if (
    raw.relevanceLabel === 'highly_relevant' ||
    raw.relevanceLabel === 'somewhat_relevant' ||
    raw.relevanceLabel === 'less_relevant'
  ) {
    relevanceLabel = raw.relevanceLabel;
  }

  // Normalize matchReasons
  let matchReasons: string[] = [];
  if (Array.isArray(raw.matchReasons)) {
    matchReasons = raw.matchReasons.filter((r): r is string => typeof r === 'string' && r.trim().length > 0);
  } else if (typeof raw.matchReasons === 'string') {
    matchReasons = [raw.matchReasons];
  }

  // Normalize mismatchReasons (convert null to undefined to match return type)
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

  // Normalize boolean fields
  const roleMatch = Boolean(raw.roleMatch);
  const companyMatch = Boolean(raw.companyMatch);
  const locationMatch = Boolean(raw.locationMatch);

  // Normalize educationMatch (can be boolean or null)
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

  // Normalize enhanced boolean fields
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
  const companySizeMatch = normalizeBooleanField(raw.companySizeMatch);
  const fundingStageMatch = normalizeBooleanField(raw.fundingStageMatch);
  const ageMatch = normalizeBooleanField(raw.ageMatch);
  const likeToLikeMatch = normalizeBooleanField(raw.likeToLikeMatch);

  // Normalize hierarchicalMatchLevel
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

  // Normalize reasoning
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
    companyMatch: boolean;
    locationMatch: boolean;
    educationMatch?: boolean | null;
    certificationMatch?: boolean | null;
    regulatoryExperienceMatch?: boolean | null;
    companySizeMatch?: boolean | null;
    fundingStageMatch?: boolean | null;
    ageMatch?: boolean | null;
    hierarchicalMatchLevel?: number | null;
    likeToLikeMatch?: boolean | null;
    reasoning: string;
  } = {
    relevanceScore,
    relevanceLabel,
    matchReasons,
    roleMatch,
    companyMatch,
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

  if (companySizeMatch !== undefined) {
    result.companySizeMatch = companySizeMatch;
  }

  if (fundingStageMatch !== undefined) {
    result.fundingStageMatch = fundingStageMatch;
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

