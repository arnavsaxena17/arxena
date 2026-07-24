import { z } from 'zod';

/**
 * Zod schema for LinkedIn Sales Navigator Companies Search parameters
 */
export const salesNavigatorCompaniesSearchSchema = z.object({
  keywords: z.string().nullable(),
  last_viewed_at: z.number().nullable(),
  saved_search_id: z.string().nullable(),
  recent_search_id: z.string().nullable(),
  industry: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  location: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  location_by_postal_code: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
    within_area: z.number().nullable(),
  }).nullable(),
  has_job_offers: z.boolean().nullable(),
  headcount: z.array(z.object({
    min: z.union([z.literal(1), z.literal(11), z.literal(51), z.literal(201), z.literal(501), z.literal(1001), z.literal(5001), z.literal(10001)]),
    max: z.union([z.literal(10), z.literal(50), z.literal(200), z.literal(500), z.literal(1000), z.literal(5000), z.literal(10000)]),
  })).nullable(),
  headcount_growth: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
  }).nullable(),
  department_headcount: z.object({
    department: z.array(z.string()),
    min: z.number().nullable(),
    max: z.number().nullable(),
  }).nullable(),
  department_headcount_growth: z.object({
    department: z.array(z.string()),
    min: z.number().nullable(),
    max: z.number().nullable(),
  }).nullable(),
  network_distance: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).nullable(),
  annual_revenue: z.object({
    currency: z.string(),
    min: z.union([z.literal(0), z.literal(0.2), z.literal(1), z.literal(2.5), z.literal(5), z.literal(10), z.literal(20), z.literal(50), z.literal(100), z.literal(500), z.literal(1000), z.literal(1001)]),
    max: z.union([z.literal(0), z.literal(0.2), z.literal(1), z.literal(2.5), z.literal(5), z.literal(10), z.literal(20), z.literal(50), z.literal(100), z.literal(500), z.literal(1000), z.literal(1001)]),
  }).nullable(),
  followers_count: z.array(z.object({
    min: z.union([z.literal(1), z.literal(51), z.literal(101), z.literal(1001), z.literal(5001)]),
    max: z.union([z.literal(50), z.literal(100), z.literal(1000), z.literal(5000)]),
  })).nullable(),
  fortune: z.array(z.object({
    min: z.union([z.literal(0), z.literal(51), z.literal(101), z.literal(251)]),
    max: z.union([z.literal(50), z.literal(100), z.literal(250), z.literal(500)]),
  })).nullable(),
  technologies: z.array(z.string()).nullable(),
  recent_activities: z.array(z.union([
    z.literal('senior_leadership_changes'),
    z.literal('funding_events'),
  ])).nullable(),
  saved_accounts: z.array(z.string()).nullable(),
  account_lists: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
});
