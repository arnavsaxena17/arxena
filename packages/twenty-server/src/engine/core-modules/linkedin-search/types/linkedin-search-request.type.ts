import {
  LinkedInBenefitType,
  LinkedInCommitmentType,
  LinkedInCompanyType,
  LinkedInContentType,
  LinkedInDatePostedType,
  LinkedInJobType,
  LinkedInLanguageScopeType,
  LinkedInLocaleType,
  LinkedInNetworkDistanceType,
  LinkedInOpenToType,
  LinkedInPresenceType,
  LinkedInPriorityType,
  LinkedInRecentActivityType,
  LinkedInRecruitingActivityType,
  LinkedInScopeType,
  LinkedInSeniorityType,
  LinkedInSortByType,
  LinkedInSpotlightType
} from './linkedin-search-parameter.type';

// Base interfaces
export interface LinkedInHeadcountRange {
  min: number;
  max: number;
}

export interface LinkedInTenureRange {
  min: number;
  max: number;
}

export interface LinkedInSalaryRange {
  currency: string;
  value: number;
}

export interface LinkedInRevenueRange {
  currency: string;
  min: number;
  max: number;
}

export interface LinkedInFollowersRange {
  min: number;
  max: number;
}

export interface LinkedInFortuneRange {
  min: number;
  max: number;
}

export interface LinkedInGraduationYearRange {
  min: number;
  max: number;
}

export interface LinkedInRecentlyJoinedRange {
  min: number;
  max: number;
}

export interface LinkedInLocationFilter {
  id: string;
  priority?: LinkedInPriorityType;
  scope?: LinkedInScopeType;
  title?: string;
}

export interface LinkedInIndustryFilter {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInLocationFilterWithIncludeExclude {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInLocationByPostalCodeFilter {
  include?: string[];
  exclude?: string[];
  within_area?: number;
}

export interface LinkedInCompanyFilter {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInSchoolFilter {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInFunctionFilter {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInRoleFilter {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInSeniorityFilter {
  include?: LinkedInSeniorityType[];
  exclude?: LinkedInSeniorityType[];
}

export interface LinkedInPastRoleFilter {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInAccountListsFilter {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInLeadListsFilter {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInDepartmentHeadcountFilter {
  department: string[];
  min?: number;
  max?: number;
}

export interface LinkedInDepartmentHeadcountGrowthFilter {
  department: string[];
  min?: number;
  max?: number;
}

export interface LinkedInHeadcountGrowthFilter {
  min?: number;
  max?: number;
}

export interface LinkedInPostedByFilter {
  member?: string[];
  company?: string[];
  me?: boolean;
  first_connections?: boolean;
  people_you_follow?: boolean;
}

export interface LinkedInMentioningFilter {
  member?: string[];
  company?: string[];
}

export interface LinkedInAuthorFilter {
  industry?: string[];
  company?: string[];
  keywords?: string;
}

export interface LinkedInAdvancedKeywordsFilter {
  first_name?: string;
  last_name?: string;
  title?: string;
  company?: string;
  school?: string;
}

export interface LinkedInSavedSearchFilter {
  id: string;
  project_id: string;
}

export interface LinkedInRoleFilterWithId {
  id: string;
  is_selection: boolean;
  priority?: LinkedInPriorityType;
  scope?: LinkedInScopeType;
}

export interface LinkedInRoleFilterWithKeywords {
  keywords: string;
  priority?: LinkedInPriorityType;
  scope?: LinkedInScopeType;
}

export interface LinkedInSkillFilterWithId {
  id: string;
  priority?: LinkedInPriorityType;
}

export interface LinkedInSkillFilterWithKeywords {
  keywords: string;
  priority?: LinkedInPriorityType;
}

export interface LinkedInCompanyFilterWithId {
  id: string;
  name?: string;
  priority?: LinkedInPriorityType;
  scope?: LinkedInScopeType;
}

export interface LinkedInCompanyFilterWithKeywords {
  keywords: string;
  priority?: LinkedInPriorityType;
  scope?: LinkedInScopeType;
}

export interface LinkedInCurrentCompanyFilter {
  id: string;
  priority?: LinkedInPriorityType;
}

export interface LinkedInPastCompanyFilter {
  id: string;
  priority?: LinkedInPriorityType;
}

export interface LinkedInSchoolFilterWithId {
  id: string;
  priority?: LinkedInPriorityType;
}

export interface LinkedInSpokenLanguageFilter {
  language: string;
  priority?: LinkedInPriorityType;
  scope?: LinkedInLanguageScopeType;
}

export interface LinkedInHidePreviouslyViewedFilter {
  timespan: number;
}

export interface LinkedInHiringProjectsFilter {
  include?: string[];
  exclude?: string[];
}

export interface LinkedInRecruitingActivityFilter {
  id: LinkedInRecruitingActivityType;
  priority?: LinkedInPriorityType;
  timespan?: number;
}

// Raw search request interfaces for Unipile raw endpoint
export interface LinkedInRawSearchFilterState {
  key: string;
  namespace: string;
  value: string | string[];
  originalProtoCase: string;
}

export interface LinkedInRawClassicPeopleSearchRequest {
  account_id: string;
  method: 'POST';
  request_url: string;
  body: {
    url: string;
    requestedArguments: {
      states: LinkedInRawSearchFilterState[];
    };
  };
  encoding: boolean;
}

// Main search request interfaces
export interface LinkedInClassicPeopleSearchRequest {
  api: 'classic';
  category: 'people';
  keywords?: string;
  industry?: string[];
  location?: string[];
  profile_language?: string[];
  network_distance?: LinkedInNetworkDistanceType[];
  company?: string[];
  past_company?: string[];
  school?: string[];
  service?: string[];
  connections_of?: string[];
  followers_of?: string[];
  open_to?: LinkedInOpenToType[];
  advanced_keywords?: LinkedInAdvancedKeywordsFilter;
  useRawEndpoint?: boolean;
}

export interface LinkedInClassicCompaniesSearchRequest {
  api: 'classic';
  category: 'companies';
  keywords?: string;
  industry?: string[];
  location?: string[];
  has_job_offers?: boolean;
  headcount?: LinkedInHeadcountRange[];
  network_distance?: LinkedInNetworkDistanceType[];
}

export interface LinkedInClassicPostsSearchRequest {
  api: 'classic';
  category: 'posts';
  keywords?: string;
  sort_by?: LinkedInSortByType;
  date_posted?: LinkedInDatePostedType;
  content_type?: LinkedInContentType;
  posted_by?: LinkedInPostedByFilter;
  mentioning?: LinkedInMentioningFilter;
  author?: LinkedInAuthorFilter;
}

export interface LinkedInClassicJobsSearchRequest {
  api: 'classic';
  category: 'jobs';
  keywords?: string;
  sort_by?: LinkedInSortByType;
  date_posted?: number;
  region?: string;
  location?: string[];
  location_within_area?: number;
  industry?: string[];
  seniority?: string[];
  function?: string[];
  role?: string[];
  job_type?: LinkedInJobType[];
  company?: string[];
  presence?: LinkedInPresenceType[];
  easy_apply?: boolean;
  has_verifications?: boolean;
  under_10_applicants?: boolean;
  in_your_network?: boolean;
  fair_chance_employer?: boolean;
  benefits?: LinkedInBenefitType[];
  commitments?: LinkedInCommitmentType[];
  minimum_salary?: LinkedInSalaryRange;
}

export interface LinkedInSalesNavigatorPeopleSearchRequest {
  api: 'sales_navigator';
  category: 'people';
  keywords?: string;
  last_viewed_at?: number;
  saved_search_id?: string;
  recent_search_id?: string;
  location?: LinkedInLocationFilterWithIncludeExclude;
  location_by_postal_code?: LinkedInLocationByPostalCodeFilter;
  industry?: LinkedInIndustryFilter;
  first_name?: string;
  last_name?: string;
  tenure?: LinkedInTenureRange[];
  groups?: string[];
  school?: LinkedInSchoolFilter;
  profile_language?: string[];
  company?: LinkedInCompanyFilter;
  company_headcount?: LinkedInHeadcountRange[];
  company_type?: LinkedInCompanyType[];
  company_location?: LinkedInLocationFilterWithIncludeExclude;
  tenure_at_company?: LinkedInTenureRange[];
  past_company?: LinkedInCompanyFilter;
  function?: LinkedInFunctionFilter;
  role?: LinkedInRoleFilter;
  tenure_at_role?: LinkedInTenureRange[];
  seniority?: LinkedInSeniorityFilter;
  past_role?: LinkedInPastRoleFilter;
  following_your_company?: boolean;
  viewed_your_profile_recently?: boolean;
  network_distance?: (LinkedInNetworkDistanceType | 'GROUP')[];
  connections_of?: string[];
  past_colleague?: boolean;
  shared_experiences?: boolean;
  changed_jobs?: boolean;
  posted_on_linkedin?: boolean;
  mentionned_in_news?: boolean;
  persona?: string[];
  account_lists?: LinkedInAccountListsFilter;
  lead_lists?: LinkedInLeadListsFilter;
  viewed_profile_recently?: boolean;
  messaged_recently?: boolean;
  include_saved_leads?: boolean;
  include_saved_accounts?: boolean;
}

export interface LinkedInSalesNavigatorCompaniesSearchRequest {
  api: 'sales_navigator';
  category: 'companies';
  keywords?: string;
  last_viewed_at?: number;
  saved_search_id?: string;
  recent_search_id?: string;
  industry?: LinkedInIndustryFilter;
  location?: LinkedInLocationFilterWithIncludeExclude;
  location_by_postal_code?: LinkedInLocationByPostalCodeFilter;
  has_job_offers?: boolean;
  headcount?: LinkedInHeadcountRange[];
  headcount_growth?: LinkedInHeadcountGrowthFilter;
  department_headcount?: LinkedInDepartmentHeadcountFilter;
  department_headcount_growth?: LinkedInDepartmentHeadcountGrowthFilter;
  network_distance?: LinkedInNetworkDistanceType[];
  annual_revenue?: LinkedInRevenueRange;
  followers_count?: LinkedInFollowersRange[];
  fortune?: LinkedInFortuneRange[];
  technologies?: string[];
  recent_activities?: LinkedInRecentActivityType[];
  saved_accounts?: string[];
  account_lists?: LinkedInAccountListsFilter;
}

export interface LinkedInRecruiterPeopleSearchRequest {
  api: 'recruiter';
  category: 'people';
  keywords?: string;
  locale?: LinkedInLocaleType;
  saved_search?: LinkedInSavedSearchFilter;
  saved_filter?: string;
  location?: LinkedInLocationFilter[];
  location_within_area?: number;
  industry?: LinkedInIndustryFilter;
  role?: (LinkedInRoleFilterWithId | LinkedInRoleFilterWithKeywords)[];
  skills?: (LinkedInSkillFilterWithId | LinkedInSkillFilterWithKeywords)[];
  company?: (LinkedInCompanyFilterWithId | LinkedInCompanyFilterWithKeywords)[];
  company_headcount?: LinkedInHeadcountRange[];
  current_company?: LinkedInCurrentCompanyFilter[];
  past_company?: LinkedInPastCompanyFilter[];
  school?: LinkedInSchoolFilterWithId[];
  groups?: string[];
  graduation_year?: LinkedInGraduationYearRange;
  tenure?: LinkedInTenureRange;
  seniority?: LinkedInSeniorityFilter;
  function?: string[];
  network_distance?: (LinkedInNetworkDistanceType | 'GROUP')[];
  spoken_languages?: LinkedInSpokenLanguageFilter[];
  hide_previously_viewed?: LinkedInHidePreviouslyViewedFilter;
  profile_language?: string[];
  recently_joined?: LinkedInRecentlyJoinedRange[];
  spotlights?: LinkedInSpotlightType[];
  first_name?: string[];
  last_name?: string[];
  has_military_background?: boolean;
  past_applicants?: boolean;
  hiring_projects?: LinkedInHiringProjectsFilter;
  recruiting_activity?: LinkedInRecruitingActivityFilter[];
  notes?: string[];
}

export interface LinkedInSearchFromUrlRequest {
  url: string;
}

export interface LinkedInSearchWithCursorRequest {
  cursor: string;
}

export type LinkedInSearchRequest = 
  | LinkedInClassicPeopleSearchRequest
  | LinkedInClassicCompaniesSearchRequest
  | LinkedInClassicPostsSearchRequest
  | LinkedInClassicJobsSearchRequest
  | LinkedInSalesNavigatorPeopleSearchRequest
  | LinkedInSalesNavigatorCompaniesSearchRequest
  | LinkedInRecruiterPeopleSearchRequest
  | LinkedInSearchFromUrlRequest
  | LinkedInSearchWithCursorRequest;
