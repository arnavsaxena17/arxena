import { z } from 'zod';

/**
 * Zod schema for query understanding
 */
export const queryUnderstandingSchema = z.object({
  primaryRole: z.string().describe('The primary job title or role being searched'),
  roleVariations: z.array(z.string()).describe('List of 5-10 common variations, synonyms, and related titles'),
  industry: z.array(z.string()).nullable().optional().describe('Specific industries mentioned (use exact LinkedIn industry names)'),
  locationHierarchy: z.object({
    primary: z.string().describe('Most specific location mentioned (city/state)'),
    secondary: z.array(z.string()).nullable().optional().describe('Additional locations mentioned'),
    regional: z.string().nullable().optional().describe('Regional context (e.g., "NCR" includes Noida, Gurgaon)'),
  }).describe('Location hierarchy from most specific to broadest'),
  companyPreferences: z.object({
    current: z.array(z.string()).nullable().optional().describe('Current companies explicitly mentioned'),
    past: z.array(z.string()).nullable().optional().describe('Past companies if relevant'),
    types: z.array(z.string()).nullable().optional().describe('Company types (startup, MNC, etc.)'),
  }).nullable().optional().describe('Company preferences and requirements'),
  seniorityLevel: z.enum(['entry', 'mid', 'senior', 'executive', 'c_level']).nullable().optional().describe('Seniority level required'),
  domainContext: z.string().nullable().optional().describe('Domain context (SaaS, FMCG, Pharma, BFSI, etc.)'),
  skills: z.array(z.string()).nullable().optional().describe('Specific skills or technologies mentioned'),
  experienceRequirements: z.string().nullable().optional().describe('Experience requirements (years, specific experience types)'),
  explicitRequirements: z.array(z.string()).describe('Explicit requirements that must be met'),
  preferredRequirements: z.array(z.string()).describe('Preferred requirements (nice-to-have)'),
  needsClarification: z.boolean().describe('Whether the query needs clarification from the user before generating search parameters'),
  clarificationQuestions: z.array(z.string()).nullable().optional().describe('Array of specific questions to ask the user to clarify ambiguous requirements'),
  ambiguityReasons: z.array(z.string()).nullable().optional().describe('Reasons why clarification is needed (e.g., missing location, vague role description, conflicting requirements)'),
});

export type QueryUnderstanding = z.infer<typeof queryUnderstandingSchema>;

