import { z } from 'zod';

/**
 * Zod schema for LinkedIn Sales Navigator People Search parameters
 */
export const salesNavigatorPeopleSearchSchema = z.object({
  keywords: z.string().nullable(),
  last_viewed_at: z.number().nullable(),
  saved_search_id: z.string().nullable(),
  recent_search_id: z.string().nullable(),
  location: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  location_by_postal_code: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
    within_area: z.number().nullable(),
  }).nullable(),
  industry: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  tenure: z.array(z.object({
    min: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(6), z.literal(10)]),
    max: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  })).nullable(),
  groups: z.array(z.string()).nullable(),
  school: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  profile_language: z.array(z.string()).nullable(),
  company: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  company_headcount: z.array(z.object({
    min: z.union([z.literal(1), z.literal(11), z.literal(51), z.literal(201), z.literal(501), z.literal(1001), z.literal(5001), z.literal(10001)]),
    max: z.union([z.literal(10), z.literal(50), z.literal(200), z.literal(500), z.literal(1000), z.literal(5000), z.literal(10000)]),
  })).nullable(),
  company_type: z.array(z.union([
    z.literal('public_company'),
    z.literal('privately_held'),
    z.literal('non_profit'),
    z.literal('educational_institution'),
    z.literal('partnership'),
    z.literal('self_employed'),
    z.literal('self_owned'),
    z.literal('government_agency'),
  ])).nullable(),
  company_location: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  tenure_at_company: z.array(z.object({
    min: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(6), z.literal(10)]),
    max: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  })).nullable(),
  past_company: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  function: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  role: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  tenure_at_role: z.array(z.object({
    min: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(6), z.literal(10)]),
    max: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  })).nullable(),
  seniority: z.object({
    include: z.array(z.union([
      z.literal('owner/partner'),
      z.literal('cxo'),
      z.literal('vice_president'),
      z.literal('director'),
      z.literal('experienced_manager'),
      z.literal('entry_level_manager'),
      z.literal('strategic'),
      z.literal('senior'),
      z.literal('entry_level'),
      z.literal('in_training'),
    ])).nullable(),
    exclude: z.array(z.union([
      z.literal('owner/partner'),
      z.literal('cxo'),
      z.literal('vice_president'),
      z.literal('director'),
      z.literal('experienced_manager'),
      z.literal('entry_level_manager'),
      z.literal('strategic'),
      z.literal('senior'),
      z.literal('entry_level'),
      z.literal('in_training'),
    ])).nullable(),
  }).nullable(),
  past_role: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  following_your_company: z.boolean().nullable(),
  viewed_your_profile_recently: z.boolean().nullable(),
  network_distance: z.array(z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal('GROUP'),
  ])).nullable(),
  connections_of: z.array(z.string()).nullable(),
  past_colleague: z.boolean().nullable(),
  shared_experiences: z.boolean().nullable(),
  changed_jobs: z.boolean().nullable(),
  posted_on_linkedin: z.boolean().nullable(),
  mentionned_in_news: z.boolean().nullable(),
  persona: z.array(z.string()).nullable(),
  account_lists: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  lead_lists: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable(),
  viewed_profile_recently: z.boolean().nullable(),
  messaged_recently: z.boolean().nullable(),
  include_saved_leads: z.boolean().nullable(),
  include_saved_accounts: z.boolean().nullable(),
});
