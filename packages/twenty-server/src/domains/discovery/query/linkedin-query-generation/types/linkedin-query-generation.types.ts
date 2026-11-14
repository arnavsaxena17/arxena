import type { LinkedInSeniorityType } from 'src/domains/discovery/transport/linkedin-search/types/linkedin-search-parameter.type';

export type QueryType = 'A' | 'B' | 'C' | 'D';

// The company types a LinkedIn facet accepts, in the API's spelling
export type LinkedInCompanyTypeValue =
  | 'public_company'
  | 'privately_held'
  | 'non_profit'
  | 'educational_institution'
  | 'partnership'
  | 'self_employed'
  | 'self_owned'
  | 'government_agency';

export interface SearchQuery {
  keywords: string | null;
  job_title: string | null;
  company: string[] | null;
  location: string[] | null;
  years_of_experience: string | null;
  // Carried from ParsedRequirement so the requirement is not lost between the
  // parse and the query: these are the constraints the user actually stated
  industry_terms?: string[] | null;
  certifications?: string[] | null;
  company_type?: LinkedInCompanyTypeValue | null;
  company_type_raw?: string | null;
  seniority?: LinkedInSeniorityType | null;
  function?: string | null;
  years_min?: number | null;
  years_max?: number | null;
  exclude_companies?: string[] | null;
  exclude_industries?: string[] | null;
  exclude_locations?: string[] | null;
}

export interface SearchQuerySet {
  search_query_set: SearchQuery[];
}

export interface ParsedRequirement {
  original_requirement: string;
  query_type: QueryType;
  query_type_description: string;
  position_title?: string;
  seniority_level?: string;
  domain_expertise: string[];
  technical_skills: string[];
  industry_terms: string[];
  certifications: string[];
  target_companies: string[];
  company_type?: string;
  location: string[];
  experience_range?: string;
  years_min?: number;
  years_max?: number;
  salary_range?: string;
  age_range?: string;
  special_notes?: string;
  precision_vs_recall: 'high_precision' | 'high_recall' | 'balanced';
}

export type OrchestratorResult = {
  parsed_requirement: ParsedRequirement;
  final_query_set: SearchQuerySet;
  // Industry and certification terms that did not fit the keyword budget
  dropped_requirement_terms: string[];
  metadata: {
    processing_time_ms: number;
    agent1_time_ms: number;
    total_queries_generated: number;
  };
};
