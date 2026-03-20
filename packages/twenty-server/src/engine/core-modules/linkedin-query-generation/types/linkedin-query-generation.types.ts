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

export type IterativeGenerationMode = 'offline' | 'live';

export type QueryActionType =
  | 'drop_job_title'
  | 'drop_keywords'
  | 'split_mixed_query'
  | 'relax_company_filter'
  | 'preserve_location'
  | 'enforce_limits'
  | 'add_broader_variant';

export interface QueryVerificationFinding {
  code:
    | 'linkedin_limit_error'
    | 'empty_field_warning'
    | 'duplicate_query_warning'
    | 'overlapping_title_keywords'
    | 'constraint_load_high'
    | 'company_filter_too_strict'
    | 'low_breadth'
    | 'family_overlap_high'
    | 'live_preview_unavailable'
    | 'live_preview_low_volume'
    | 'live_preview_low_diversity';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface QueryVerificationResult {
  valid: boolean;
  score: number;
  overlap_score: number;
  breadth_score: number;
  constraint_load_score: number;
  role_signal_score: number;
  expected_candidate_volume_score: number;
  live_preview_score: number | null;
  relevance_score: number | null;
  findings: QueryVerificationFinding[];
  recommended_actions: QueryActionType[];
  summary: string;
}

export interface LivePreviewQueryResult {
  query_index: number;
  item_count: number;
  unique_company_count: number;
  unique_title_count: number;
  relevance_score: number | null;
  quality_assessment: 'high' | 'medium' | 'low' | null;
  reasoning: string | null;
}

export interface LivePreviewResult {
  attempted: boolean;
  succeeded: boolean;
  fallback_reason?: string | null;
  preview_score: number | null;
  queries: LivePreviewQueryResult[];
}

export interface IterativeQueryCandidate {
  candidate_id: string;
  source: 'seed' | 'refined';
  label: string;
  query_set: SearchQuerySet;
  score: number;
  summary: string;
  verification_result: QueryVerificationResult;
  live_preview?: LivePreviewResult | null;
  rejection_reason?: string | null;
}

export interface QueryIteration {
  round: number;
  candidates: IterativeQueryCandidate[];
  winner_candidate_id: string;
  winner_score: number;
  improvement_from_previous: number | null;
}

export interface RankedAlternativeQuerySet {
  query_set: SearchQuerySet;
  score: number;
  summary: string;
  rejection_reason?: string | null;
}

export interface IterativeVerificationSummary {
  mode: IterativeGenerationMode;
  final_score: number;
  termination_reason:
    | 'max_iterations_reached'
    | 'good_enough'
    | 'no_meaningful_improvement';
  live_preview_used: boolean;
  live_preview_fallback_reason?: string | null;
}

export interface TargetProfilePreviewItem {
  archetype: string;
  sample_profile: string;
  retrieval_focus: 'title' | 'keywords' | 'mixed';
}

export interface TargetProfileValidationPreview {
  recruiter_validation_question: string;
  positive_examples: TargetProfilePreviewItem[];
  negative_examples: TargetProfilePreviewItem[];
}

export interface IterativeQuerySetResult {
  final_query_set: SearchQuerySet;
  ranked_alternatives: RankedAlternativeQuerySet[];
  iterations: QueryIteration[];
  verification_summary: IterativeVerificationSummary;
  target_profile_preview?: TargetProfileValidationPreview;
}
