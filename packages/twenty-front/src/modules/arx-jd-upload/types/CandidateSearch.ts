export type LinkedInSearchType = 'classic' | 'sales_navigator' | 'recruiter';
export type LinkedInSearchCategory = 'people' | 'companies' | 'jobs' | 'posts';

// Base search parameters that are common across all search types
export type BaseLinkedInSearchParameters = {
  keywords?: string;
};

// Classic People Search Parameters
export type ClassicPeopleSearchParameters = BaseLinkedInSearchParameters & {
  industry?: string[];
  location?: string[];
  profile_language?: string[];
  network_distance?: number[];
  company?: string[];
  past_company?: string[];
  school?: string[];
  service?: string[];
  connections_of?: string[];
  followers_of?: string[];
  open_to?: ('proBono' | 'boardMember')[];
  advanced_keywords?: {
    first_name?: string;
    last_name?: string;
    title?: string;
    company?: string;
    school?: string;
  };
};

// Classic Companies Search Parameters
export type ClassicCompaniesSearchParameters = BaseLinkedInSearchParameters & {
  industry?: string[];
  location?: string[];
  has_job_offers?: boolean;
  headcount?: Array<{ min: number; max: number }>;
  network_distance?: number[];
};

// Classic Jobs Search Parameters
export type ClassicJobsSearchParameters = BaseLinkedInSearchParameters & {
  sort_by?: 'relevance' | 'date';
  date_posted?: number;
  region?: string;
  location?: string[];
  location_within_area?: number;
  industry?: string[];
  seniority?: string[];
  function?: string[];
  role?: string[];
  job_type?: ('full_time' | 'part_time' | 'contract' | 'temporary' | 'volunteer' | 'internship' | 'other')[];
  company?: string[];
  presence?: ('on_site' | 'hybrid' | 'remote')[];
  easy_apply?: boolean;
  has_verifications?: boolean;
  under_10_applicants?: boolean;
  in_your_network?: boolean;
  fair_chance_employer?: boolean;
  benefits?: string[];
  commitments?: string[];
  minimum_salary?: {
    currency: string;
    value: number;
  };
};

// Sales Navigator People Search Parameters
export type SalesNavigatorPeopleSearchParameters = BaseLinkedInSearchParameters & {
  last_viewed_at?: number;
  saved_search_id?: string;
  recent_search_id?: string;
  location?: {
    include?: string[];
    exclude?: string[];
  };
  location_by_postal_code?: {
    include?: string[];
    exclude?: string[];
    within_area?: number;
  };
  industry?: {
    include?: string[];
    exclude?: string[];
  };
  first_name?: string;
  last_name?: string;
  tenure?: Array<{ min?: number; max?: number }>;
  groups?: string[];
  school?: {
    include?: string[];
    exclude?: string[];
  };
  profile_language?: string[];
  company?: {
    include?: string[];
    exclude?: string[];
  };
  company_headcount?: Array<{ min?: number; max?: number }>;
  company_type?: ('public_company' | 'privately_held' | 'non_profit' | 'educational_institution' | 'partnership' | 'self_employed' | 'self_owned' | 'government_agency')[];
  company_location?: {
    include?: string[];
    exclude?: string[];
  };
  tenure_at_company?: Array<{ min?: number; max?: number }>;
  past_company?: {
    include?: string[];
    exclude?: string[];
  };
  function?: {
    include?: string[];
    exclude?: string[];
  };
  role?: {
    include?: string[];
    exclude?: string[];
  };
  tenure_at_role?: Array<{ min?: number; max?: number }>;
  seniority?: {
    include?: ('owner/partner' | 'cxo' | 'vice_president' | 'director' | 'experienced_manager' | 'entry_level_manager' | 'strategic' | 'senior' | 'entry_level' | 'in_training')[];
    exclude?: ('owner/partner' | 'cxo' | 'vice_president' | 'director' | 'experienced_manager' | 'entry_level_manager' | 'strategic' | 'senior' | 'entry_level' | 'in_training')[];
  };
  past_role?: {
    include?: string[];
    exclude?: string[];
  };
  following_your_company?: boolean;
  viewed_your_profile_recently?: boolean;
  network_distance?: (1 | 2 | 3 | 'GROUP')[];
  connections_of?: string[];
  past_colleague?: boolean;
  shared_experiences?: boolean;
  changed_jobs?: boolean;
  posted_on_linkedin?: boolean;
  mentionned_in_news?: boolean;
  persona?: string[];
  account_lists?: {
    include?: string[];
    exclude?: string[];
  };
  lead_lists?: {
    include?: string[];
    exclude?: string[];
  };
  viewed_profile_recently?: boolean;
  messaged_recently?: boolean;
  include_saved_leads?: boolean;
  include_saved_accounts?: boolean;
};

// Sales Navigator Companies Search Parameters
export type SalesNavigatorCompaniesSearchParameters = BaseLinkedInSearchParameters & {
  last_viewed_at?: number;
  saved_search_id?: string;
  recent_search_id?: string;
  industry?: {
    include?: string[];
    exclude?: string[];
  };
  location?: {
    include?: string[];
    exclude?: string[];
  };
  location_by_postal_code?: {
    include?: string[];
    exclude?: string[];
    within_area?: number;
  };
  has_job_offers?: boolean;
  headcount?: Array<{ min?: number; max?: number }>;
  headcount_growth?: {
    min?: number;
    max?: number;
  };
  department_headcount?: {
    department?: string[];
    min?: number;
    max?: number;
  };
  department_headcount_growth?: {
    department?: string[];
    min?: number;
    max?: number;
  };
  network_distance?: (1 | 2 | 3)[];
  annual_revenue?: {
    currency: string;
    min?: number;
    max?: number;
  };
  followers_count?: Array<{ min?: number; max?: number }>;
  fortune?: Array<{ min?: number; max?: number }>;
  technologies?: string[];
  recent_activities?: ('senior_leadership_changes' | 'funding_events')[];
  saved_accounts?: string[];
  account_lists?: {
    include?: string[];
    exclude?: string[];
  };
};

// LinkedIn Recruiter People Search Parameters
export type RecruiterPeopleSearchParameters = BaseLinkedInSearchParameters & {
  locale?: ('arabic' | 'bangla' | 'czech' | 'danish' | 'german' | 'greek' | 'english' | 'spanish' | 'persian' | 'finnish' | 'french' | 'hindi' | 'hungarian' | 'indonesian' | 'italian' | 'hebrew' | 'japanese' | 'korean' | 'marathi' | 'malay' | 'dutch' | 'norwegian' | 'punjabi' | 'polish' | 'portuguese' | 'romanian' | 'russian' | 'swedish' | 'telugu' | 'thai' | 'tagalog' | 'turkish' | 'ukrainian' | 'vietnamese' | 'chinese_simplified' | 'chinese_traditional');
  saved_search?: {
    id: string;
    project_id: string;
  };
  saved_filter?: string;
  location?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    scope?: 'CURRENT' | 'OPEN_TO_RELOCATE_ONLY' | 'CURRENT_OR_OPEN_TO_RELOCATE';
    title?: string;
  }>;
  location_within_area?: number;
  industry?: {
    include?: string[];
    exclude?: string[];
  };
  role?: Array<{
    id?: string;
    is_selection?: boolean;
    keywords?: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    scope?: 'CURRENT_OR_PAST' | 'CURRENT' | 'PAST' | 'PAST_NOT_CURRENT' | 'OPEN_TO_WORK';
  }>;
  skills?: Array<{
    id?: string;
    keywords?: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
  }>;
  company?: Array<{
    id?: string;
    name?: string;
    keywords?: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    scope?: 'CURRENT_OR_PAST' | 'CURRENT' | 'PAST' | 'PAST_NOT_CURRENT';
  }>;
  company_headcount?: Array<{ min?: number; max?: number }>;
  current_company?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
  }>;
  past_company?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
  }>;
  school?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
  }>;
  groups?: string[];
  graduation_year?: {
    min?: number;
    max?: number;
  };
  tenure?: {
    min?: number;
    max?: number;
  };
  seniority?: {
    include?: ('owner' | 'partner' | 'cxo' | 'vp' | 'director' | 'manager' | 'senior' | 'entry' | 'training' | 'unpaid')[];
    exclude?: ('owner' | 'partner' | 'cxo' | 'vp' | 'director' | 'manager' | 'senior' | 'entry' | 'training' | 'unpaid')[];
  };
  function?: string[];
  network_distance?: (1 | 2 | 3 | 'GROUP')[];
  spoken_languages?: Array<{
    language: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    scope?: 'ELEMENTARY' | 'LIMITED_WORKING' | 'PROFESSIONAL_WORKING' | 'FULL_PROFESSIONAL' | 'NATIVE_OR_BILINGUAL';
  }>;
  hide_previously_viewed?: {
    timespan: number;
  };
  profile_language?: string[];
  recently_joined?: Array<{ min?: number; max?: number }>;
  spotlights?: ('OPEN_TO_WORK' | 'ACTIVE_TALENT' | 'REDISCOVERED_CANDIDATES' | 'INTERNAL_CANDIDATES' | 'INTERESTED_IN_YOUR_COMPANY' | 'HAVE_COMPANY_CONNECTIONS')[];
  first_name?: string[];
  last_name?: string[];
  has_military_background?: boolean;
  past_applicants?: boolean;
  hiring_projects?: {
    include?: string[];
    exclude?: string[];
  };
  recruiting_activity?: Array<{
    id: 'messages' | 'tags' | 'notes' | 'projects' | 'resumes' | 'reviews';
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    timespan?: number;
  }>;
  notes?: string[];
};

// Union type for all search parameters
export type LinkedInSearchParameters = 
  | ClassicPeopleSearchParameters
  | ClassicCompaniesSearchParameters
  | ClassicJobsSearchParameters
  | SalesNavigatorPeopleSearchParameters
  | SalesNavigatorCompaniesSearchParameters
  | RecruiterPeopleSearchParameters;

export type LinkedInSearchResult = {
  type: 'PEOPLE' | 'COMPANY' | 'POST' | 'JOB';
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  location?: string;
  industry?: string;
  profile_url?: string;
  public_profile_url?: string;
  profile_picture_url?: string;
  network_distance?: string;
  member_urn?: string;
  public_identifier?: string;
  premium?: boolean;
  open_profile?: boolean;
  pending_invitation?: boolean;
  can_send_inmail?: boolean;
  recruiter_candidate_id?: string;
  current_positions?: Array<{
    company: string;
    company_id?: string;
    role: string;
    description?: string;
    location?: string;
    start?: { month: number; year: number };
    tenure_at_company?: { years: number };
    tenure_at_role?: { years: number };
  }>;
  summary?: string;
  followers_count?: number;
  job_offers_count?: number;
  headcount?: string;
  share_url?: string;
  date?: string;
  parsed_datetime?: string;
  comment_counter?: number;
  impressions_counter?: number;
  reaction_counter?: number;
  repost_counter?: number;
  text?: string;
  attachments?: Array<{
    id: string;
    type: string;
    url: string;
    size?: { height: number; width: number };
  }>;
  author?: {
    name: string;
    public_identifier: string;
    headline?: string;
    is_company: boolean;
  };
  is_repost?: boolean;
};

export type LinkedInSearchResponse = {
  object: string;
  items: LinkedInSearchResult[];
  config: {
    params: LinkedInSearchParameters;
  };
  paging: {
    start: number;
    page_count: number;
    total_count: number;
    cursor?: string;
  };
};

export type CandidateSearchRequest = {
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  industry?: string;
  searchType: LinkedInSearchType;
  searchCategory: LinkedInSearchCategory;
  accountId: string;
  options?: {
    cursor?: string;
    limit?: number;
  };
};

export type CandidateSearchResponse = {
  parsedJobDescription: any;
  generatedSearchParameters: any;
  searchResults?: LinkedInSearchResponse;
  searchMetadata: {
    searchType: LinkedInSearchType;
    searchCategory: LinkedInSearchCategory;
    timestamp: string;
    processingTime: number;
  };
};

export type CandidateSearchState = {
  isSearching: boolean;
  searchResults: LinkedInSearchResult[];
  selectedCandidates: LinkedInSearchResult[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  cursor?: string;
  searchParameters?: LinkedInSearchParameters;
  searchType?: LinkedInSearchType;
  searchCategory?: LinkedInSearchCategory;
  error?: string;
};
