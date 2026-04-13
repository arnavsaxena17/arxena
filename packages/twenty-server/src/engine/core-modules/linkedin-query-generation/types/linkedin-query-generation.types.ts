export type QueryType = 'A' | 'B' | 'C' | 'D';

export interface SearchQuery {
  keywords: string | null;
  job_title: string | null;
  company: string[] | null;
  location: string[] | null;
  years_of_experience: string | null;
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

export interface MasterLists {
  keywords: {
    all_terms: string[];
    grouped_concepts: { [concept: string]: string[] };
    selected_terms: string[];
    term_count: number;
  };
  job_titles: {
    all_terms: string[];
    by_seniority: {
      junior: string[] | null;
      mid: string[] | null;
      senior: string[] | null;
      cxo: string[] | null;
    };
    selected_terms: string[];
    term_count: number;
  };
  companies: {
    all_companies: string[];
    use_company_filter: boolean;
    reasoning: string;
    alternative_keywords: string[] | null;
    clusters: string[][] | null;
  };
}

export interface PrimaryQuery {
  query: SearchQuery;
  term_counts: {
    keywords: number;
    job_title: number;
    combined: number;
  };
  needs_splitting: boolean;
  splitting_reason?: string;
  recommended_strategy: 'A' | 'B' | 'C' | 'D';
}

export interface FactoredQuery {
  factored_query: SearchQuery;
  term_counts: {
    keywords: number;
    job_title: number;
    combined: number;
  };
  needs_splitting: boolean;
  splitting_reason?: string;
  recommended_strategy: 'A' | 'B' | 'C' | 'D';
}

export interface SplittingStrategy {
  strategy_type: 'A' | 'B' | 'C' | 'D';
  strategy_description: string;
  number_of_queries: number;
  distribution_logic: string;
}

export interface OrchestratorResult {
  parsed_requirement: ParsedRequirement;
  master_lists: MasterLists;
  primary_query: PrimaryQuery;
  factored_query?: FactoredQuery;
  splitting_strategy: SplittingStrategy;
  final_query_set: SearchQuerySet;
      metadata: {
        processing_time_ms: number;
        agent1_time_ms: number;
        agent2_time_ms: number;
        agent3_time_ms: number;
        agent4_time_ms: number;
        total_queries_generated: number;
      };
}
