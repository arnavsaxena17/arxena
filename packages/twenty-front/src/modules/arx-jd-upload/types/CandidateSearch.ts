export type LinkedInSearchType = 'classic' | 'sales_navigator' | 'recruiter';
export type LinkedInSearchCategory = 'people' | 'companies' | 'jobs' | 'posts';

export type LinkedInSearchParameters = {
  api: LinkedInSearchType;
  category: LinkedInSearchCategory;
  keywords?: string;
  industry?: string[] | { include?: string[]; exclude?: string[] };
  location?: string[] | { include?: string[]; exclude?: string[] };
  company?: string[] | { include?: string[]; exclude?: string[] };
  past_company?: string[] | { include?: string[]; exclude?: string[] };
  school?: string[] | { include?: string[]; exclude?: string[] };
  network_distance?: number[];
  profile_language?: string[];
  seniority?: string[];
  function?: string[];
  role?: string[];
  skills?: Array<{
    id: string;
    priority: 'MUST_HAVE' | 'NICE_TO_HAVE' | 'DOESNT_HAVE';
  }>;
  tenure?: Array<{ min?: number; max?: number }>;
  headcount?: Array<{ min?: number; max?: number }>;
  has_job_offers?: boolean;
  job_type?: string[];
  presence?: string[];
  easy_apply?: boolean;
  in_your_network?: boolean;
  fair_chance_employer?: boolean;
  benefits?: string[];
  commitments?: string[];
  minimum_salary?: {
    currency: string;
    value: number;
  };
  sort_by?: 'relevance' | 'date';
  date_posted?: number;
  region?: string;
  location_within_area?: number;
  under_10_applicants?: boolean;
  has_verifications?: boolean;
  followers_of?: string[];
  connections_of?: string[];
  open_to?: string[];
  service?: string[];
  advanced_keywords?: {
    first_name?: string;
    last_name?: string;
    title?: string;
    company?: string;
    school?: string;
  };
};

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
