/**
 * Frontend types for enrichment response formats based on AIFilterModelSchema
 */

// Filter Field Schema (matches backend)
export type FilterField = {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'enum';
  description: string;
  enumValues: string[];
};

// AI Filter Model Schema (matches backend)
export type AIFilterModel = {
  fields: FilterField[];
  modelName: string;
  prompt: string;
  selectedMetadataFields: string[];
};

// Enrichment Response Format Options
export type EnrichmentResponseFormatOption = {
  id: string;
  name: string;
  description: string;
  examples: AIFilterModel[];
  category: 'skills' | 'cultural_fit' | 'salary' | 'experience' | 'education' | 'custom';
};

// Available metadata fields (from backend)
export const AVAILABLE_METADATA_FIELDS = [
  'first_name',
  'last_name', 
  'full_name',
  'job_company_name',
  'location_name',
  'jobTitle',
  'profile_title',
  'inferred_salary',
  'inferred_years_experience',
  'uniqueStringKey',
  'email_address',
  'industries',
  'profiles',
  'phone_numbers',
  'job_process',
  'locations',
  'experience',
  'experience_stats',
  'last_updated',
  'education',
  'interests',
  'skills',
  'data_sources',
  'queryId',
  'profile_url',
  'all_numbers',
  'data_source',
  'job_name',
  'upload_id',
  'all_mails',
  'ug_education_institute',
  'ug_degree',
  'socialprofiles',
  'tables',
  'std_function',
  'std_grade',
  'std_function_root',
];
