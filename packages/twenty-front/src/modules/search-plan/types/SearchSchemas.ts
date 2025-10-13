/**
 * Frontend types that match the backend Zod schemas for LinkedIn search parameters
 */

// Sales Navigator People Search
export type SalesNavigatorPeopleSearch = {
  keywords?: string | null;
  last_viewed_at?: number | null;
  saved_search_id?: string | null;
  recent_search_id?: string | null;
  location?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  location_by_postal_code?: {
    include?: string[] | null;
    exclude?: string[] | null;
    within_area?: number | null;
  } | null;
  industry?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  first_name?: string | null;
  last_name?: string | null;
  tenure?: Array<{
    min: 0 | 1 | 3 | 6 | 10;
    max: 1 | 2 | 5 | 10;
  }> | null;
  groups?: string[] | null;
  school?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  profile_language?: string[] | null;
  company?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  company_headcount?: Array<{
    min: 1 | 11 | 51 | 201 | 501 | 1001 | 5001 | 10001;
    max: 10 | 50 | 200 | 500 | 1000 | 5000 | 10000;
  }> | null;
  company_type?: Array<
    | 'public_company'
    | 'privately_held'
    | 'non_profit'
    | 'educational_institution'
    | 'partnership'
    | 'self_employed'
    | 'self_owned'
    | 'government_agency'
  > | null;
  company_location?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  tenure_at_company?: Array<{
    min: 0 | 1 | 3 | 6 | 10;
    max: 1 | 2 | 5 | 10;
  }> | null;
  past_company?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  function?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  role?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  tenure_at_role?: Array<{
    min: 0 | 1 | 3 | 6 | 10;
    max: 1 | 2 | 5 | 10;
  }> | null;
  seniority?: {
    include?: Array<
      | 'owner/partner'
      | 'cxo'
      | 'vice_president'
      | 'director'
      | 'experienced_manager'
      | 'entry_level_manager'
      | 'strategic'
      | 'senior'
      | 'entry_level'
      | 'in_training'
    > | null;
    exclude?: Array<
      | 'owner/partner'
      | 'cxo'
      | 'vice_president'
      | 'director'
      | 'experienced_manager'
      | 'entry_level_manager'
      | 'strategic'
      | 'senior'
      | 'entry_level'
      | 'in_training'
    > | null;
  } | null;
  past_role?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  following_your_company?: boolean | null;
  viewed_your_profile_recently?: boolean | null;
  network_distance?: Array<1 | 2 | 3 | 'GROUP'> | null;
  connections_of?: string[] | null;
  past_colleague?: boolean | null;
  shared_experiences?: boolean | null;
  changed_jobs?: boolean | null;
  posted_on_linkedin?: boolean | null;
  mentionned_in_news?: boolean | null;
  persona?: string[] | null;
  account_lists?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  lead_lists?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  viewed_profile_recently?: boolean | null;
  messaged_recently?: boolean | null;
  include_saved_leads?: boolean | null;
  include_saved_accounts?: boolean | null;
};

// Sales Navigator Companies Search
export type SalesNavigatorCompaniesSearch = {
  keywords?: string | null;
  last_viewed_at?: number | null;
  saved_search_id?: string | null;
  recent_search_id?: string | null;
  industry?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  location?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  location_by_postal_code?: {
    include?: string[] | null;
    exclude?: string[] | null;
    within_area?: number | null;
  } | null;
  has_job_offers?: boolean | null;
  headcount?: Array<{
    min: 1 | 11 | 51 | 201 | 501 | 1001 | 5001 | 10001;
    max: 10 | 50 | 200 | 500 | 1000 | 5000 | 10000;
  }> | null;
  headcount_growth?: {
    min?: number | null;
    max?: number | null;
  } | null;
  department_headcount?: {
    department: string[];
    min?: number | null;
    max?: number | null;
  } | null;
  department_headcount_growth?: {
    department: string[];
    min?: number | null;
    max?: number | null;
  } | null;
  network_distance?: Array<1 | 2 | 3> | null;
  annual_revenue?: {
    currency: string;
    min: 0 | 0.2 | 1 | 2.5 | 5 | 10 | 20 | 50 | 100 | 500 | 1000 | 1001;
    max: 0 | 0.2 | 1 | 2.5 | 5 | 10 | 20 | 50 | 100 | 500 | 1000 | 1001;
  } | null;
  followers_count?: Array<{
    min: 1 | 51 | 101 | 1001 | 5001;
    max: 50 | 100 | 1000 | 5000;
  }> | null;
  fortune?: Array<{
    min: 0 | 51 | 101 | 251;
    max: 50 | 100 | 250 | 500;
  }> | null;
  technologies?: string[] | null;
  recent_activities?: Array<'senior_leadership_changes' | 'funding_events'> | null;
  saved_accounts?: string[] | null;
  account_lists?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
};

// Recruiter People Search
export type RecruiterPeopleSearch = {
  keywords?: string | null;
  locale?: 
    | 'arabic'
    | 'bangla'
    | 'czech'
    | 'danish'
    | 'german'
    | 'greek'
    | 'english'
    | 'spanish'
    | 'persian'
    | 'finnish'
    | 'french'
    | 'hindi'
    | 'hungarian'
    | 'indonesian'
    | 'italian'
    | 'hebrew'
    | 'japanese'
    | 'korean'
    | 'marathi'
    | 'malay'
    | 'dutch'
    | 'norwegian'
    | 'punjabi'
    | 'polish'
    | 'portuguese'
    | 'romanian'
    | 'russian'
    | 'swedish'
    | 'telugu'
    | 'thai'
    | 'tagalog'
    | 'turkish'
    | 'ukrainian'
    | 'vietnamese'
    | 'chinese_simplified'
    | 'chinese_traditional'
    | null;
  saved_search?: {
    id: string;
    project_id: string;
  } | null;
  saved_filter?: string | null;
  location?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
    scope?: 'CURRENT' | 'OPEN_TO_RELOCATE_ONLY' | 'CURRENT_OR_OPEN_TO_RELOCATE' | null;
    title?: string | null;
  }> | null;
  location_within_area?: number | null;
  industry?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  role?: Array<
    | {
        id: string;
        is_selection: boolean;
        priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
        scope?: 'CURRENT_OR_PAST' | 'CURRENT' | 'PAST' | 'PAST_NOT_CURRENT' | 'OPEN_TO_WORK' | null;
      }
    | {
        keywords: string;
        priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
        scope?: 'CURRENT_OR_PAST' | 'CURRENT' | 'PAST' | 'PAST_NOT_CURRENT' | 'OPEN_TO_WORK' | null;
      }
  > | null;
  skills?: Array<
    | {
        id: string;
        priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
      }
    | {
        keywords: string;
        priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
      }
  > | null;
  company?: Array<
    | {
        id: string;
        name?: string | null;
        priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
        scope?: 'CURRENT_OR_PAST' | 'CURRENT' | 'PAST' | 'PAST_NOT_CURRENT' | null;
      }
    | {
        keywords: string;
        priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
        scope?: 'CURRENT_OR_PAST' | 'CURRENT' | 'PAST' | 'PAST_NOT_CURRENT' | null;
      }
  > | null;
  company_headcount?: Array<{
    min: 1 | 11 | 51 | 201 | 501 | 1001 | 5001 | 10001;
    max: 10 | 50 | 200 | 500 | 1000 | 5000 | 10000;
  }> | null;
  current_company?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
  }> | null;
  past_company?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
  }> | null;
  school?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
  }> | null;
  groups?: string[] | null;
  graduation_year?: {
    min?: number | null;
    max?: number | null;
  } | null;
  tenure?: {
    min?: number | null;
    max?: number | null;
  } | null;
  seniority?: {
    include?: Array<
      | 'owner'
      | 'partner'
      | 'cxo'
      | 'vp'
      | 'director'
      | 'manager'
      | 'senior'
      | 'entry'
      | 'training'
      | 'unpaid'
    > | null;
    exclude?: Array<
      | 'owner'
      | 'partner'
      | 'cxo'
      | 'vp'
      | 'director'
      | 'manager'
      | 'senior'
      | 'entry'
      | 'training'
      | 'unpaid'
    > | null;
  } | null;
  function?: string[] | null;
  network_distance?: Array<1 | 2 | 3 | 'GROUP'> | null;
  spoken_languages?: Array<{
    language: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
    scope?: 'ELEMENTARY' | 'LIMITED_WORKING' | 'PROFESSIONAL_WORKING' | 'FULL_PROFESSIONAL' | 'NATIVE_OR_BILINGUAL' | null;
  }> | null;
  hide_previously_viewed?: {
    timespan: number;
  } | null;
  profile_language?: string[] | null;
  recently_joined?: Array<{
    min: 2 | 8 | 15 | 31;
    max: 1 | 7 | 14 | 30 | 90;
  }> | null;
  spotlights?: Array<
    | 'OPEN_TO_WORK'
    | 'ACTIVE_TALENT'
    | 'REDISCOVERED_CANDIDATES'
    | 'INTERNAL_CANDIDATES'
    | 'INTERESTED_IN_YOUR_COMPANY'
    | 'HAVE_COMPANY_CONNECTIONS'
  > | null;
  first_name?: string[] | null;
  last_name?: string[] | null;
  has_military_background?: boolean | null;
  past_applicants?: boolean | null;
  hiring_projects?: {
    include?: string[] | null;
    exclude?: string[] | null;
  } | null;
  recruiting_activity?: Array<{
    id: 'messages' | 'tags' | 'notes' | 'projects' | 'resumes' | 'reviews';
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE' | null;
    timespan?: number | null;
  }> | null;
  notes?: string[] | null;
};

// Job Description
export type JobDescription = {
  jobTitle: string;
  company: string;
  location: string;
  industry: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: 'entry_level' | 'mid_level' | 'senior_level' | 'executive';
  education: string[];
  keywords: string[];
  responsibilities: string[];
  qualifications: string[];
  benefits: string[];
  employmentType: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship';
  remoteWork: boolean;
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  } | null;
};

// Classic People Search
export type ClassicPeopleSearch = {
  keywords?: string | null;
  industry?: string[] | null;
  location?: string[] | null;
  profile_language?: string[] | null;
  network_distance?: Array<1 | 2 | 3> | null;
  company?: string[] | null;
  past_company?: string[] | null;
  school?: string[] | null;
  service?: string[] | null;
  connections_of?: string[] | null;
  followers_of?: string[] | null;
  open_to?: Array<'proBono' | 'boardMember'> | null;
  advanced_keywords?: {
    first_name?: string | null;
    last_name?: string | null;
    title?: string | null;
    company?: string | null;
    school?: string | null;
  } | null;
};

// Classic Companies Search
export type ClassicCompaniesSearch = {
  keywords?: string | null;
  industry?: string[] | null;
  location?: string[] | null;
  has_job_offers?: boolean | null;
  headcount?: Array<{
    min: number;
    max: number;
  }> | null;
  network_distance?: Array<1 | 2 | 3> | null;
};

// Classic Jobs Search
export type ClassicJobsSearch = {
  keywords?: string | null;
  sort_by?: 'relevance' | 'date' | null;
  date_posted?: number | null;
  region?: string | null;
  location?: string[] | null;
  location_within_area?: number | null;
  industry?: string[] | null;
  seniority?: string[] | null;
  function?: string[] | null;
  role?: string[] | null;
  job_type?: Array<
    | 'full_time'
    | 'part_time'
    | 'contract'
    | 'temporary'
    | 'volunteer'
    | 'internship'
    | 'other'
  > | null;
  company?: string[] | null;
  presence?: Array<'on_site' | 'hybrid' | 'remote'> | null;
  easy_apply?: boolean | null;
  has_verifications?: boolean | null;
  under_10_applicants?: boolean | null;
  in_your_network?: boolean | null;
  fair_chance_employer?: boolean | null;
  benefits?: string[] | null;
  commitments?: string[] | null;
  minimum_salary?: {
    currency: string;
    value: number;
  } | null;
};

// Union type for all search schemas
export type SearchSchema = 
  | SalesNavigatorPeopleSearch
  | SalesNavigatorCompaniesSearch
  | RecruiterPeopleSearch
  | JobDescription
  | ClassicPeopleSearch
  | ClassicCompaniesSearch
  | ClassicJobsSearch;

// Response format options
export type ResponseFormatOption = {
  id: string;
  name: string;
  description: string;
  schema: SearchSchema;
  example: Record<string, any>;
};
