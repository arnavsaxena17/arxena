import { z } from 'zod';

/**
 * Zod schema for LinkedIn Classic Jobs Search parameters
 */
export const classicJobsSearchSchema = z.object({
  keywords: z.string().nullable(),
  sort_by: z.union([z.literal('relevance'), z.literal('date')]).nullable(),
  date_posted: z.number().nullable(),
  region: z.string().nullable(),
  location: z.array(z.string()).nullable(),
  location_within_area: z.number().nullable(),
  industry: z.array(z.string()).nullable(),
  seniority: z.array(z.string()).nullable(),
  function: z.array(z.string()).nullable(),
  role: z.array(z.string()).nullable(),
  job_type: z.array(z.union([
    z.literal('full_time'),
    z.literal('part_time'),
    z.literal('contract'),
    z.literal('temporary'),
    z.literal('volunteer'),
    z.literal('internship'),
    z.literal('other'),
  ])).nullable(),
  company: z.array(z.string()).nullable(),
  presence: z.array(z.union([
    z.literal('on_site'),
    z.literal('hybrid'),
    z.literal('remote'),
  ])).nullable(),
  easy_apply: z.boolean().nullable(),
  has_verifications: z.boolean().nullable(),
  under_10_applicants: z.boolean().nullable(),
  in_your_network: z.boolean().nullable(),
  fair_chance_employer: z.boolean().nullable(),
  benefits: z.array(z.string()).nullable(),
  commitments: z.array(z.string()).nullable(),
  minimum_salary: z.object({
    currency: z.string(),
    value: z.number(),
  }).nullable(),
});
