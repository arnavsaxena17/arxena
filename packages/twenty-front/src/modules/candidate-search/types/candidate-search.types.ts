// Re-export shared types
import type { AiFiltersResponse, LinkedInSearchCategory, LinkedInSearchType, SearchAiFilterField } from 'twenty-shared/types';

export type { AiFiltersResponse, LinkedInSearchCategory, LinkedInSearchType };
// Re-export with alias for backward compatibility
export type EnrichmentField = SearchAiFilterField;
export type BaseLinkedInSearchParameters = {
  keywords?: string;
};
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
export type ClassicCompaniesSearchParameters = BaseLinkedInSearchParameters & {
  industry?: string[];
  location?: string[];
  has_job_offers?: boolean;
  headcount?: Array<{ min: number; max: number }>;
  network_distance?: number[];
};

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
  profile_picture_url_large?: string;
  network_distance?: string;
  member_urn?: string;
  public_identifier?: string;
  premium?: boolean;
  open_profile?: boolean;
  pending_invitation?: boolean;
  can_send_inmail?: boolean;
  recruiter_candidate_id?: string;
  recruiter_pipeline_category?: string;
  verified?: boolean;
  shared_connections_count?: number;
  recent_posts_count?: number;
  recently_hired?: boolean;
  mentioned_in_the_news?: boolean;
  last_outreach_activity?: {
    type: 'SEND_MESSAGE' | 'ACCEPT_INVITATION';
    performed_at: string;
  };
  current_positions?: Array<{
    company: string;
    company_id?: string;
    role: string;
    description?: string;
    location?: string;
    industry?: string[];
    start?: { month: number; year: number };
    end?: { month: number; year: number };
    tenure_at_company?: { years: number; months: number };
    tenure_at_role?: { years: number; months: number };
    skills?: Array<{
      name: string;
      endorsement_count: number;
    }>;
  }>;
  work_experience?: Array<{
    company: string;
    company_id?: string;
    role: string;
    industry?: string;
    start?: { month: number; year: number };
    end?: { month: number; year: number };
    skills?: Array<{
      name: string;
      endorsement_count: number;
    }>;
  }>;
  education?: Array<{
    degree?: string;
    field_of_study?: string;
    school: string;
    school_id?: string;
    start?: { month: number; year: number };
    end?: { month: number; year: number };
    school_details?: {
      name: string;
      employeeCount: number;
      location: string;
      description: string;
      url: string;
      logo?: string;
    };
  }>;
  certifications?: Array<{
    name: string;
    organization: string;
    organization_id?: string;
    url: string;
    start?: { year: number; month: string };
    end?: { year: number; month: string };
  }>;
  projects?: Array<{
    name: string;
    description: string;
    skills: string[];
    start?: { year: number; month: string };
    end?: { year: number; month: string };
  }>;
  skills?: Array<{
    name: string;
    endorsement_count: number;
  }>;
  interests?: string;
  // Company specific fields
  summary?: string;
  followers_count?: number;
  job_offers_count?: number;
  headcount?: string;
  revenue_range?: {
    min: number;
    max: number;
    currency: string;
  };
  // Post specific fields
  provider?: 'LINKEDIN';
  social_id?: string;
  share_url?: string;
  title?: string;
  text?: string;
  date?: string;
  parsed_datetime?: string;
  reaction_counter?: number;
  comment_counter?: number;
  repost_counter?: number;
  impressions_counter?: number;
  user_reacted?: 'LIKE' | 'PRAISE' | 'APPRECIATION' | 'EMPATHY' | 'INTEREST' | 'ENTERTAINMENT';
  written_by?: {
    id: string;
    public_identifier: string;
    name: string;
  };
  permissions?: {
    can_react: boolean;
    can_share: boolean;
    can_post_comments: boolean;
  };
  is_repost?: boolean;
  repost_id?: string;
  reposted_by?: {
    public_identifier?: string;
    id?: string;
    name?: string;
    is_company: boolean;
    headline?: string;
  };
  repost_content?: {
    id: string;
    date: string;
    parsed_datetime: string;
    author: {
      public_identifier?: string;
      id?: string;
      name?: string;
      is_company: boolean;
      headline?: string;
    };
    text: string;
  };
  mentions?: Array<{
    url: string;
    start: number;
    length: number;
  }>;
  attachments?: Array<{
    id: string;
    file_size?: number;
    unavailable: boolean;
    mimetype?: string;
    url?: string;
    url_expires_at?: number;
    type: 'img' | 'video' | 'audio' | 'file' | 'linkedin_post' | 'video_meeting';
    size?: { width: number; height: number };
    sticker?: boolean;
    gif?: boolean;
    voice_note?: boolean;
    file_name?: string;
    starts_at?: number;
    expires_at?: number;
    time_range?: number;
  }>;
  poll?: {
    id: string;
    total_votes_count: number;
    question: string;
    is_open: boolean;
    options: Array<{
      id: string;
      text: string;
      win: boolean;
      votes_count: number;
    }>;
  };
  group?: {
    id: string;
    name: string;
    private: boolean;
  };
  analytics?: {
    impressions: number;
    engagements: number;
    engagement_rate: number;
    clicks: number;
    clickthrough_rate: number;
    page_viewers_from_this_post?: number;
    followers_gained_from_this_post?: number;
    members_reached?: number;
  };
  // Job specific fields
  reference_id?: string;
  posted_at?: string;
  reposted?: boolean;
  url?: string;
  promoted?: boolean;
  benefits?: string[];
  easy_apply?: boolean;
  company?: {
    id?: string;
    public_identifier?: string;
    name?: string;
    profile_url?: string;
    profile_picture_url?: string;
  };
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
export type SearchParametersManagerProps = {
  searchType: LinkedInSearchType;
  searchCategory: LinkedInSearchCategory;
  onParametersChange: (parameters: any) => void;
  generatedParameters?: any;
  resolvedParameters?: any;
  initialParameters?: any;
  onAssistantThreadUpdate?: (
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>;
  onSearch?: () => void;
  onClear?: () => void;
};

export type ParameterRendererProps = {
  parameters: any;
  updateParameters: (newParams: any) => void;
  handleParameterChange: (key: string, value: any) => void;
  onSearch?: () => void;
  onClear?: () => void;
};

export type ParameterHandlers = {
  handleKeywordsChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeywordsInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNetworkDistanceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleIndustryChange: (values: string[], display?: Array<{ id: string; title: string }>) => void;
  handleLocationChange: (values: string[], display?: Array<{ id: string; title: string }>) => void;
  handleCompanyChange: (values: string[], display?: Array<{ id: string; title: string }>) => void;
  handleSchoolChange: (values: string[], display?: Array<{ id: string; title: string }>) => void;
  handleSeniorityChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleJobTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handlePresenceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleParameterChange: (key: string, value: any) => void;
  handleHeadcountMinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleHeadcountMaxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export type DefaultParameters = {
  keywords: string;
  network_distance: number[];
  industry: string[];
  location: string[];
  company: string[];
  school: string[];
  seniority: any[];
  job_type: string[];
  presence: string[];
  headcount: { min: number; max: number };
  // Sales Navigator specific fields
  tenure: { min?: number; max?: number };
  company_headcount: { min?: number; max?: number } | any[];
  function: { include: string[]; exclude: string[] } | string[];
  role: { include: string[]; exclude: string[] } | any[];
  company_type: string[];
  tenure_at_company: { min?: number; max?: number };
  tenure_at_role: { min?: number; max?: number };
  past_role: { include: string[]; exclude: string[] };
  following_your_company: boolean;
  viewed_your_profile_recently: boolean;
  posted_on_linkedin: boolean;
  changed_jobs: boolean;
  past_colleague: boolean;
  shared_experiences: boolean;
  mentionned_in_news: boolean;
  viewed_profile_recently: boolean;
  messaged_recently: boolean;
  include_saved_leads: boolean;
  include_saved_accounts: boolean;
  // Recruiter specific fields
  skills: any[];
  groups: string[];
  spoken_languages: any[];
  profile_language: string[];
  spotlights: string[];
  recruiting_activity: any[];
  recently_joined: any[];
  first_name: string[];
  last_name: string[];
  notes: string[];
  // Additional LinkedIn search parameters
  past_companies: string[];
  current_companies: string[];
  graduation_year_range: { min?: number; max?: number };
  military_background: boolean;
  past_applicants: boolean;
  hide_previously_viewed: { days?: number };
  locale: string;
  saved_filter: string;
  location_within_area?: number;
  activity_filters: any[];
  time_at_current_company: { min?: number; max?: number };
  past_roles: string[];
  experience_tenure: { min?: number; max?: number };
  search_category: string;
  search_type: string;
  exclude: string[];
  tenure_range: { min?: number; max?: number };
  company_headcount_ranges: any[];
};



export interface SearchStrategyNode {
  id: string;
  name: string;
  prompt: string;
  model: string;
  inputSources: string[];
  outputSchema: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  outputDestination: 'searchParameters' | 'enrichments' | 'filters' | 'intermediate';
  children: string[];
  parent?: string;
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  searchCategory?: 'people' | 'companies' | 'jobs' | 'posts';
}

export interface SearchStrategyTree {
  treeVersion: string;
  rootNodeId: string;
  nodes: Record<string, SearchStrategyNode>;
  edges: Array<{ from: string; to: string }>;
}

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  tree: SearchStrategyTree;
}

export interface StrategyExecutionResult {
  searchParameters: LinkedInSearchParameters;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  searchCategory: 'people' | 'companies' | 'jobs' | 'posts';
  enrichments: Array<{
    modelName: string;
    prompt: string;
    selectedModel: string;
    fields: Array<{ name: string; type: string; description: string; enumValues?: string[] }>;
    selectedMetadataFields: string[];
  }>;
  filters: Array<{
    fieldName: string;
    operator: string;
    value: any;
    fieldType: string;
  }>;
  executionLog: Array<{
    nodeId: string;
    status: 'success' | 'error';
    output?: any;
    error?: string;
    timestamp: string;
  }>;
}

export interface FilterConfig {
  id: string;
  fieldName: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in' | 'notIn';
  value: any;
  fieldType: 'text' | 'number' | 'boolean' | 'enum';
  enumValues?: string[];
  isActive: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterConfig[];
  createdAt: string;
}

// Lin
// Unified data structure for filtering
export interface FilterableCandidate {
  id: string;
  [key: string]: any; // Dynamic fields from enrichments or LinkedIn data
}


// Enrichment and Filter types are now imported from twenty-shared

export interface CandidateSearchFilter {
  field: string;
  type: 'text_search' | 'dropdown_selection' | 'date_range' | 'numeric_range' | 'boolean' | 'multi_select' | 'location' | 'company' | 'industry' | 'seniority' | 'network_distance' | 'experience_range' | 'salary_range';
  label: string;
  value?: any;
  values?: any[];
  min?: number;
  max?: number;
  options?: string[];
  placeholder?: string;
}

// FilterStrategy, FiltersResponse, SortOrder, SortColumn, SortStrategy, and SortsResponse are now imported from twenty-shared

// Frontend-specific filter type (not in shared)
export interface CandidateSearchFilter {
  field: string;
  type: 'text_search' | 'dropdown_selection' | 'date_range' | 'numeric_range' | 'boolean' | 'multi_select' | 'location' | 'company' | 'industry' | 'seniority' | 'network_distance' | 'experience_range' | 'salary_range';
  label: string;
  value?: any;
  values?: any[];
  min?: number;
  max?: number;
  options?: string[];
  placeholder?: string;
}


export interface SearchVariation {
  id: string;
  name: string;
  type: 'broad' | 'narrow' | 'targeted';
  description: string;
  searchParameters: any; // Will be validated based on search type
  resolvedSearchParameters?: any; // LinkedIn IDs + display information
  expectedResultSize: 'small' | 'medium' | 'large';
  reasoning: string;
}

export interface SearchParametersResponse {
  variations: SearchVariation[];
  overallStrategy: string;
  complexity: 'simple' | 'moderate' | 'complex';
  reasoning: string;
  metadata: {
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    searchCategory: 'people' | 'companies' | 'jobs';
    generatedAt: string;
  };
}
