import { z } from 'zod';

/**
 * Zod schema for LinkedIn Sales Navigator People Search parameters
 */
export const salesNavigatorPeopleSearchSchema = z.object({
  keywords: z.string().nullable().describe('Search keywords to match against profiles'),
  last_viewed_at: z.number().nullable().describe('Unix timestamp for last viewed date'),
  saved_search_id: z.string().nullable().describe('ID of a saved search to retrieve'),
  recent_search_id: z.string().nullable().describe('ID of a recent search to retrieve'),
  location: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by current location (country/region/city). Use include to only show results in listed locations, exclude to hide results from listed locations'),
  location_by_postal_code: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
    within_area: z.number().nullable(),
  }).nullable().describe('Filter by postal code with optional radius in miles (within_area)'),
  industry: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by the industry of their current company. Use include to only show results in listed industries, exclude to hide results from listed industries'),
  first_name: z.string().nullable().describe('First name of the person'),
  last_name: z.string().nullable().describe('Last name of the person'),
  tenure: z.array(z.object({
    min: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(6), z.literal(10)]),
    max: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  })).nullable().describe('Filter by years at current company (min and max in years, 0 or 1 for <1 year, 10+ for 10+ years)'),
  groups: z.array(z.string()).nullable().describe('Filter by LinkedIn groups they belong to'),
  school: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by schools attended. Use include to only show results who attended listed schools, exclude to hide results who attended listed schools'),
  profile_language: z.array(z.string()).nullable().describe('Filter by profile language (e.g., "en", "fr", "es")'),
  company: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by current company name. Use include to only show results working at listed companies, exclude to hide results working at listed companies'),
  company_headcount: z.array(z.object({
    min: z.union([z.literal(1), z.literal(11), z.literal(51), z.literal(201), z.literal(501), z.literal(1001), z.literal(5001), z.literal(10001)]),
    max: z.union([z.literal(10), z.literal(50), z.literal(200), z.literal(500), z.literal(1000), z.literal(5000), z.literal(10000)]),
  })).nullable().describe('Filter by company size (employee count). Values in thousands'),
  company_type: z.array(z.union([
    z.literal('public_company'),
    z.literal('privately_held'),
    z.literal('non_profit'),
    z.literal('educational_institution'),
    z.literal('partnership'),
    z.literal('self_employed'),
    z.literal('self_owned'),
    z.literal('government_agency'),
  ])).nullable().describe('Filter by company type'),
  company_location: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by location of their current company (not their personal location). Use include to only show results whose companies are in listed locations, exclude to hide results whose companies are in listed locations'),
  tenure_at_company: z.array(z.object({
    min: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(6), z.literal(10)]),
    max: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  })).nullable().describe('Filter by years at current company (min and max in years, 0 or 1 for <1 year, 10+ for 10+ years)'),
  past_company: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by past companies worked at. Use include to only show results who worked at listed companies, exclude to hide results who worked at listed companies'),
  function: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by function (department/area). Use include to only show results in listed functions, exclude to hide results in listed functions'),
  role: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by specific job titles. Use include to only show results with listed titles, exclude to hide results with listed titles'),
  tenure_at_role: z.array(z.object({
    min: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(6), z.literal(10)]),
    max: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  })).nullable().describe('Filter by years in current role (min and max in years, 0 or 1 for <1 year, 10+ for 10+ years)'),
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
  }).nullable().describe('Filter by seniority level. Use include to only show specified seniority levels, exclude to hide specified seniority levels'),
  past_role: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by past job titles. Use include to only show results who held listed titles, exclude to hide results who held listed titles'),
  following_your_company: z.boolean().nullable().describe('Only show people who follow your company on LinkedIn'),
  viewed_your_profile_recently: z.boolean().nullable().describe('Only show people who viewed your profile recently'),
  network_distance: z.array(z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal('GROUP'),
  ])).nullable().describe('Filter by degree of connection (1st connections, 2nd connections, 3rd+ connections, or same group members)'),
  connections_of: z.array(z.string()).nullable().describe('Filter to only show connections of specific profile URLs'),
  past_colleague: z.boolean().nullable().describe('Only show people who were colleagues at past companies'),
  shared_experiences: z.boolean().nullable().describe('Only show people with shared experiences (same company, school, etc.)'),
  changed_jobs: z.boolean().nullable().describe('Only show people who changed jobs recently'),
  posted_on_linkedin: z.boolean().nullable().describe('Only show people who posted on LinkedIn recently'),
  mentionned_in_news: z.boolean().nullable().describe('Only show people who were mentioned in news recently'),
  persona: z.array(z.string()).nullable().describe('Filter by saved personas/target audiences'),
  account_lists: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by Sales Navigator account lists. Use include to only show results in listed lists, exclude to hide results in listed lists'),
  lead_lists: z.object({
    include: z.array(z.string()).nullable(),
    exclude: z.array(z.string()).nullable(),
  }).nullable().describe('Filter by Sales Navigator lead lists. Use include to only show results in listed lists, exclude to hide results in listed lists'),
  viewed_profile_recently: z.boolean().nullable().describe('Only show people who viewed your profile recently'),
  messaged_recently: z.boolean().nullable().describe('Only show people you messaged recently'),
  include_saved_leads: z.boolean().nullable().describe('Include your saved leads in results'),
  include_saved_accounts: z.boolean().nullable().describe('Include people from your saved accounts in results'),
});

