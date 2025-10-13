/**
 * Frontend types for filter response formats for both Handsontable and Candidate Search Results Table
 */

// Handsontable Filter Types (based on Handsontable's built-in filter functionality)
export type HandsontableFilterType = 
  | 'text'
  | 'numeric'
  | 'date'
  | 'dropdown'
  | 'checkbox'
  | 'autocomplete';

export type HandsontableFilterCondition = 
  | 'eq'           // equals
  | 'neq'          // not equal
  | 'lt'           // less than
  | 'lte'          // less than or equal
  | 'gt'           // greater than
  | 'gte'          // greater than or equal
  | 'contains'     // contains
  | 'not_contains' // does not contain
  | 'begins_with'  // begins with
  | 'ends_with'    // ends with
  | 'empty'        // is empty
  | 'not_empty'    // is not empty
  | 'between'      // between (for numeric/date)
  | 'by_value';    // by value (for dropdown)

export type HandsontableFilter = {
  column: string;
  type: HandsontableFilterType;
  condition: HandsontableFilterCondition;
  value?: any;
  value2?: any; // for 'between' condition
  options?: string[]; // for dropdown/autocomplete
};

// Candidate Search Results Table Filter Types
export type CandidateSearchFilterType = 
  | 'text_search'
  | 'dropdown_selection'
  | 'date_range'
  | 'numeric_range'
  | 'boolean'
  | 'multi_select'
  | 'location'
  | 'company'
  | 'industry'
  | 'seniority'
  | 'network_distance'
  | 'experience_range'
  | 'salary_range';

export type CandidateSearchFilter = {
  field: string;
  type: CandidateSearchFilterType;
  label: string;
  value?: any;
  values?: any[]; // for multi-select
  min?: number;   // for range filters
  max?: number;   // for range filters
  options?: string[]; // for dropdown/multi-select
  placeholder?: string;
};

// Filter Response Format Options
export type FilterResponseFormatOption = {
  id: string;
  name: string;
  description: string;
  category: 'handsontable' | 'candidate_search' | 'unified';
  examples: {
    handsontable?: HandsontableFilter[];
    candidateSearch?: CandidateSearchFilter[];
    unified?: {
      handsontable: HandsontableFilter[];
      candidateSearch: CandidateSearchFilter[];
    };
  };
};

// Available filter fields for Handsontable (based on DataTable columns)
export const HANDSONTABLE_FILTER_FIELDS = [
  'name',
  'jobTitle',
  'jobCompanyName',
  'locationName',
  'remarks',
  'candConversationStatus',
  'status',
  'email',
  'phone',
  'lastMessage',
  // Enrichment fields (dynamic)
  'primarySkills',
  'secondarySkills',
  'culturalFitScore',
  'expectedSalary',
  'totalExperience',
  'highestDegree',
  // Add more as needed
];

// Available filter fields for Candidate Search Results Table
export const CANDIDATE_SEARCH_FILTER_FIELDS = [
  'name',
  'headline',
  'location',
  'industry',
  'company',
  'jobTitle',
  'network_distance',
  'profile_url',
  'can_send_inmail',
  'current_positions',
  'experience',
  'education',
  'skills',
  'followers_count',
  'headcount',
  'job_offers_count',
  'posted_at',
  'easy_apply',
  'benefits',
  'reaction_counter',
  'comment_counter',
  'repost_counter',
  'impressions_counter',
];
