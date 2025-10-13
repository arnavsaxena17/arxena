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

// LinkedIn Search Parameter Types
export interface LinkedInSearchParameters {
  // Base parameters
  keywords?: string;
  
  // Classic People Search Parameters
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
  
  // Classic Jobs Search Parameters
  sort_by?: 'relevance' | 'date';
  date_posted?: number;
  region?: string;
  location_within_area?: number;
  seniority?: string[];
  function?: string[];
  role?: string[];
  job_type?: ('full_time' | 'part_time' | 'contract' | 'temporary' | 'volunteer' | 'internship' | 'other')[];
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
  
  // Sales Navigator Parameters
  last_viewed_at?: number;
  saved_search_id?: string;
  recent_search_id?: string;
  location_by_postal_code?: {
    include?: string[];
    exclude?: string[];
    within_area?: number;
  };
  industry_include?: string[];
  industry_exclude?: string[];
  first_name?: string;
  last_name?: string;
  tenure?: Array<{ min?: number; max?: number }>;
  groups?: string[];
  school_include?: string[];
  school_exclude?: string[];
  company_include?: string[];
  company_exclude?: string[];
  company_headcount?: Array<{ min?: number; max?: number }>;
  company_type?: ('public_company' | 'privately_held' | 'non_profit' | 'educational_institution' | 'partnership' | 'self_employed' | 'self_owned' | 'government_agency')[];
  company_location_include?: string[];
  company_location_exclude?: string[];
  tenure_at_company?: Array<{ min?: number; max?: number }>;
  past_company_include?: string[];
  past_company_exclude?: string[];
  function_include?: string[];
  function_exclude?: string[];
  role_include?: string[];
  role_exclude?: string[];
  tenure_at_role?: Array<{ min?: number; max?: number }>;
  seniority_include?: ('owner/partner' | 'cxo' | 'vice_president' | 'director' | 'experienced_manager' | 'entry_level_manager' | 'strategic' | 'senior' | 'entry_level' | 'in_training')[];
  seniority_exclude?: ('owner/partner' | 'cxo' | 'vice_president' | 'director' | 'experienced_manager' | 'entry_level_manager' | 'strategic' | 'senior' | 'entry_level' | 'in_training')[];
  past_role_include?: string[];
  past_role_exclude?: string[];
  following_your_company?: boolean;
  viewed_your_profile_recently?: boolean;
  network_distance_sales?: (1 | 2 | 3 | 'GROUP')[];
  connections_of_sales?: string[];
  past_colleague?: boolean;
  shared_experiences?: boolean;
  changed_jobs?: boolean;
  posted_on_linkedin?: boolean;
  mentionned_in_news?: boolean;
  persona?: string[];
  account_lists_include?: string[];
  account_lists_exclude?: string[];
  lead_lists_include?: string[];
  lead_lists_exclude?: string[];
  viewed_profile_recently?: boolean;
  messaged_recently?: boolean;
  include_saved_leads?: boolean;
  include_saved_accounts?: boolean;
  
  // Recruiter Parameters
  locale?: ('arabic' | 'bangla' | 'czech' | 'danish' | 'german' | 'greek' | 'english' | 'spanish' | 'persian' | 'finnish' | 'french' | 'hindi' | 'hungarian' | 'indonesian' | 'italian' | 'hebrew' | 'japanese' | 'korean' | 'marathi' | 'malay' | 'dutch' | 'norwegian' | 'punjabi' | 'polish' | 'portuguese' | 'romanian' | 'russian' | 'swedish' | 'telugu' | 'thai' | 'tagalog' | 'turkish' | 'ukrainian' | 'vietnamese' | 'chinese_simplified' | 'chinese_traditional');
  saved_search?: {
    id: string;
    project_id: string;
  };
  saved_filter?: string;
  location_recruiter?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    scope?: 'CURRENT' | 'OPEN_TO_RELOCATE_ONLY' | 'CURRENT_OR_OPEN_TO_RELOCATE';
    title?: string;
  }>;
  location_within_area_recruiter?: number;
  industry_recruiter_include?: string[];
  industry_recruiter_exclude?: string[];
  role_recruiter?: Array<{
    id?: string;
    is_selection?: boolean;
    keywords?: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    scope?: 'CURRENT_OR_PAST' | 'CURRENT' | 'PAST' | 'PAST_NOT_CURRENT' | 'OPEN_TO_WORK';
  }>;
  skills_recruiter?: Array<{
    id?: string;
    keywords?: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
  }>;
  company_recruiter?: Array<{
    id?: string;
    name?: string;
    keywords?: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    scope?: 'CURRENT_OR_PAST' | 'CURRENT' | 'PAST' | 'PAST_NOT_CURRENT';
  }>;
  company_headcount_recruiter?: Array<{ min?: number; max?: number }>;
  current_company?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
  }>;
  past_company_recruiter?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
  }>;
  school_recruiter?: Array<{
    id: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
  }>;
  groups_recruiter?: string[];
  graduation_year?: {
    min?: number;
    max?: number;
  };
  tenure_recruiter?: {
    min?: number;
    max?: number;
  };
  seniority_recruiter_include?: ('owner' | 'partner' | 'cxo' | 'vp' | 'director' | 'manager' | 'senior' | 'entry' | 'training' | 'unpaid')[];
  seniority_recruiter_exclude?: ('owner' | 'partner' | 'cxo' | 'vp' | 'director' | 'manager' | 'senior' | 'entry' | 'training' | 'unpaid')[];
  function_recruiter?: string[];
  network_distance_recruiter?: (1 | 2 | 3 | 'GROUP')[];
  spoken_languages?: Array<{
    language: string;
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    scope?: 'ELEMENTARY' | 'LIMITED_WORKING' | 'PROFESSIONAL_WORKING' | 'FULL_PROFESSIONAL' | 'NATIVE_OR_BILINGUAL';
  }>;
  hide_previously_viewed?: {
    timespan: number;
  };
  profile_language_recruiter?: string[];
  recently_joined?: Array<{ min?: number; max?: number }>;
  spotlights?: ('OPEN_TO_WORK' | 'ACTIVE_TALENT' | 'REDISCOVERED_CANDIDATES' | 'INTERNAL_CANDIDATES' | 'INTERESTED_IN_YOUR_COMPANY' | 'HAVE_COMPANY_CONNECTIONS')[];
  first_name_recruiter?: string[];
  last_name_recruiter?: string[];
  has_military_background?: boolean;
  past_applicants?: boolean;
  hiring_projects_include?: string[];
  hiring_projects_exclude?: string[];
  recruiting_activity?: Array<{
    id: 'messages' | 'tags' | 'notes' | 'projects' | 'resumes' | 'reviews';
    priority?: 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';
    timespan?: number;
  }>;
  notes?: string[];
}

// Unified data structure for filtering
export interface FilterableCandidate {
  id: string;
  [key: string]: any; // Dynamic fields from enrichments or LinkedIn data
}
