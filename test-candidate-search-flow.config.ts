import * as path from 'path';

export const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
export const API_TOKEN =
process.env.API_TOKEN ||
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzhkZTU3ZC0xYzM2LTQyZmMtYTEyYy1kY2U4ZTVlM2Y1MWMiLCJ3b3Jrc3BhY2VJZCI6IjA0Nzk2ZWFkLWM0NDktNGJhOC1hY2FlLWM4YzgzNTNkZTM5ZCIsIndvcmtzcGFjZU1lbWJlcklkIjoiODNlMjYxYjYtZjk3Yy00OWI5LWFjMWEtMjM5ZDM2MGNiOTljIiwidXNlcldvcmtzcGFjZUlkIjoiNjJlMGYwN2QtNjhjMi00ZTZmLWJmMTgtYjFiNTI5ZWU0MjE3IiwiaWF0IjoxNzcwMDE3NjYyLCJleHAiOjE3NzAxOTc2NjJ9.fui6m4PrG0NWvPIW0P4IuKMQAziQncI-lN3yt3P0T08';

export const REQUIREMENTS_FILE = path.join(process.cwd(), 'leadership_requirements.txt');

export const SEARCH_TYPES: Array<'classic' | 'sales_navigator' | 'recruiter'> = ['classic'];

/** Use multi-agent flow (Requirement Analyzer → Job Title + Company Expander → Query Constructor → unresolved). Boolean query and create-searches steps are removed. */

export const USE_CACHE_CLEANUP = false;
export const USE_CACHE_REQUIREMENT_ANALYZER = false;
export const USE_CACHE_JOB_TITLE_EXPANDER = false;
export const USE_CACHE_COMPANY_EXPANDER = false;
export const USE_CACHE_QUERY_CONSTRUCTOR = false;
export const USE_CACHE_UNRESOLVED_PARAMETERS = false;
export const USE_CACHE_RESOLVED_PARAMETERS = false;
export const USE_CACHE_LINKEDIN_URLS = false;
export const USE_CACHE_SEARCH_RESULTS = false;
export const USE_CACHE_VALIDATION_RESULTS = false;
export const USE_CACHE_SCORING_RESULTS = false;




export const RUN_CLEANUP_STEP = true;
export const RUN_QUERY_UNDERSTANDING_STEP = true;
export const RUN_REQUIREMENT_ANALYZER_STEP = true;
export const RUN_JOB_TITLE_EXPANDER_STEP = true;
export const RUN_COMPANY_EXPANDER_STEP = true;
export const RUN_QUERY_CONSTRUCTOR_STEP = true;
export const RUN_UNRESOLVED_PARAMETERS_STEP = true;
export const RUN_RESOLVED_PARAMETERS_STEP = false;
export const RUN_LINKEDIN_URLS_STEP = false;
export const RUN_SEARCH_EXECUTION_STEP = false;
export const RUN_RESULT_VALIDATION_STEP = false;
export const RUN_CANDIDATE_SCORING_STEP = false;

export const CACHE_DIR = path.join(process.cwd(), 'test-cache');
