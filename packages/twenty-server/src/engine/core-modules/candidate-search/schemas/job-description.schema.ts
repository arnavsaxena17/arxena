import { z } from 'zod';

/**
 * Zod schema for job description parsing
 */
export const parsedJobDescriptionSchema = z.object({
  jobTitle: z.string().describe('The primary job title'),
  company: z.string().describe('The company name'),
  location: z.string().describe('The job location'),
  industry: z.string().describe('The industry or sector'),
  requiredSkills: z.array(z.string()).describe('Required skills and technologies'),
  preferredSkills: z.array(z.string()).describe('Preferred skills and technologies'),
  experienceLevel: z.enum(['entry_level', 'mid_level', 'senior_level', 'executive']).describe('Experience level required'),
  education: z.array(z.string()).describe('Education requirements'),
  keywords: z.array(z.string()).describe('Key terms and keywords from the job description'),
  responsibilities: z.array(z.string()).describe('Key responsibilities and duties'),
  qualifications: z.array(z.string()).describe('Required qualifications'),
  benefits: z.array(z.string()).describe('Benefits and perks mentioned'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'temporary', 'internship']).describe('Type of employment'),
  remoteWork: z.boolean().describe('Whether remote work is allowed'),
  salaryRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
  }).nullable().describe('Salary range if mentioned'),
});
