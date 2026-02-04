import { z } from 'zod';
import { parsedRequirementSchema } from './parsed-requirement.schema';
import { jobTitleExpanderSchema } from './job-title-expander.schema';
import { companyExpanderSchema } from './company-expander.schema';

/**
 * Years of experience range in LinkedIn boolean search (Agent 4 output)
 */
export const yearsOfExperienceSchema = z.object({
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
});

/**
 * Single LinkedIn boolean search from Agent 4
 */
export const linkedinBooleanSearchSchema = z.object({
  keywords: z.string().describe('Boolean keywords string'),
  job_title: z.string().nullable().optional().describe('Boolean job title string'),
  company: z.string().nullable().optional().describe('Company filter string or empty'),
  location: z.string().nullable().optional().describe('Location string'),
  years_of_experience: yearsOfExperienceSchema.nullable().optional(),
});

/**
 * Single LinkedIn search query from Agent 4
 */
export const linkedinSearchQuerySchema = z.object({
  query_id: z.number(),
  query_name: z.string(),
  reasoning: z.string().nullable().optional(),
  primary_filter: z.string().describe('keywords, job_title, or company'),
  linkedin_boolean_search: linkedinBooleanSearchSchema,
  expected_profiles: z.string().nullable().optional(),
  estimated_reach: z.string().nullable().optional(),
});

/**
 * Search strategy summary from Agent 4
 */
export const searchStrategySchema = z.object({
  primary_filter_type: z.string().nullable().optional(),
  reasoning: z.string().nullable().optional(),
  number_of_queries: z.number().nullable().optional(),
  coverage_approach: z.string().nullable().optional(),
});

/**
 * Full Query Constructor (Agent 4) output
 */
export const queryConstructorSchema = z.object({
  requirement: z.string().nullable().optional().describe('Original requirement string'),
  parsed_requirement: parsedRequirementSchema.nullable().optional(),
  title_analysis: jobTitleExpanderSchema.nullable().optional(),
  company_analysis: companyExpanderSchema.nullable().optional(),
  search_strategy: searchStrategySchema.nullable().optional(),
  linkedin_searches: z.array(linkedinSearchQuerySchema).describe('Array of LinkedIn search queries'),
  total_queries: z.number().nullable().optional(),
  coverage_assessment: z.string().nullable().optional(),
});

export type QueryConstructorResult = z.infer<typeof queryConstructorSchema>;
export type LinkedInSearchQuery = z.infer<typeof linkedinSearchQuerySchema>;
export type LinkedInBooleanSearch = z.infer<typeof linkedinBooleanSearchSchema>;
export type YearsOfExperience = z.infer<typeof yearsOfExperienceSchema>;
export type SearchStrategy = z.infer<typeof searchStrategySchema>;
