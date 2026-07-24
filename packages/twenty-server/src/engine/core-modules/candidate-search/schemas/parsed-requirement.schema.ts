import { z } from 'zod';

/**
 * Experience range in years (Agent 1 output)
 */
export const experienceRangeSchema = z.object({
  min: z.number().nullable().describe('Minimum years of experience'),
  max: z.number().nullable().describe('Maximum years of experience'),
});

/**
 * Age range in years (Agent 1 output)
 */
export const ageRangeSchema = z.object({
  min: z.number().nullable().describe('Minimum age'),
  max: z.number().nullable().describe('Maximum age'),
});


 /**
  * Salary range in local currency (Agent 1 output)
  */
 export const salaryRangeSchema = z.object({
  min: z.number().nullable().describe('Minimum salary'),
  max: z.number().nullable().describe('Maximum salary'),
  currency: z.string().nullable().describe('Currency'),
 });
/**
 * 
 * Parsed requirement from Agent 1 (Requirement Analyzer)
 */
export const parsedRequirementSchema = z.object({
  // role_function: z.string().nullable().describe('What work is being performed (not the title, but the actual function)'),
  primary_role_name: z.string().nullable().describe('The role name mentioned in requirement'),
  industry: z.string().nullable().describe('Industry mentioned'),
  location: z.string().nullable().describe('Geographic location'),
  experience_range: experienceRangeSchema.nullable().describe('Experience range in years { min, max }'),
  age_range: ageRangeSchema.nullable().describe('Age range in years { min, max }'),
  salary_range: salaryRangeSchema.nullable().describe('Salary range in local currency { min, max, currency }'),
  // seniority_level: z.string().nullable().describe('Junior/Mid/Manager/Senior/Head based on years and title'),
  // must_have_skills: z.array(z.string()).nullable().describe('Explicit skills/tools/domains mentioned'),
  // nice_to_have_skills: z.array(z.string()).nullable().describe('Implied skills based on role'),
  company_type: z.string().nullable().describe('Describe the exact type or category of or segment of companies (ensure that you include sub types) indicated in the requirement (e.g. Listed specialty chemicals companies based in India, Product based companies based in US, Law firms or corporate environments which are family run businesses, Startups)'),
  // specific_companies: z.array(z.string()).nullable().describe('Named companies if mentioned (e.g. Big 4, McKinsey)'),
  // special_requirements: z.string().nullable().describe('Any other specific constraints'),
  requires_job_title_expansion: z
  .boolean()
  .default(false)
  .describe(
    'True if the requirement is about a specific role and we want to expand into similar titles. False for broad/aggregate queries where we should NOT expand into many similar individual job titles (e.g. all leadership positions, all people at ACME Corp, all engineering roles).'
  ),
  requires_company_targeting: z
    .boolean()
    .default(false)
    .describe(
      'True only if the requirement explicitly asks for candidates from a specific category/type of companies (e.g. Big 4, FAANG, product companies, startups) that would need to be expanded into a list of company names. False for generic requirements that can be satisfied with keyword, job title, skills, and location alone.',
    ),
});

export type ParsedRequirement = z.infer<typeof parsedRequirementSchema>;
export type ExperienceRange = z.infer<typeof experienceRangeSchema>;