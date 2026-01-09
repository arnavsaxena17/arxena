import { z } from 'zod';

/**
 * Schema for enhanced keyword generation
 * Separates primary keywords (job titles) from certification/technology keywords
 */
export const enhancedKeywordSchema = z.object({
  primaryKeywords: z.array(z.string()).describe('Primary job title keywords (max 6 for classic search, can be more for Sales Navigator/Recruiter)'),
  certificationKeywords: z.array(z.string()).nullable().optional().describe('Certification-related keywords to include (e.g., "ISO", "US GAAP", "FDA")'),
  technologyKeywords: z.array(z.string()).nullable().optional().describe('Technology/skill keywords to prioritize (e.g., "AWS", "Kubernetes", "UPI")'),
  regulatoryKeywords: z.array(z.string()).nullable().optional().describe('Regulatory experience keywords (e.g., "USFDA", "RBI", "RERA")'),
  domainSpecificKeywords: z.array(z.string()).nullable().optional().describe('Domain-specific terminology (e.g., "3PL", "modern trade", "dark store", "PLG")'),
  advancedKeywords: z.array(z.string()).nullable().optional().describe('Additional keywords for advanced_keywords field (classic search) or extended keywords (Sales Navigator/Recruiter)'),
  keywordRationale: z.string().describe('Explanation of keyword selection and prioritization'),
});

export type EnhancedKeywords = z.infer<typeof enhancedKeywordSchema>;

