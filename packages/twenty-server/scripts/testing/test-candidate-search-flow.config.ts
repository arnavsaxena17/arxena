import * as path from 'path';

export const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
export const API_TOKEN =
  process.env.API_TOKEN ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzhkZTU3ZC0xYzM2LTQyZmMtYTEyYy1kY2U4ZTVlM2Y1MWMiLCJ3b3Jrc3BhY2VJZCI6IjA0Nzk2ZWFkLWM0NDktNGJhOC1hY2FlLWM4YzgzNTNkZTM5ZCIsIndvcmtzcGFjZU1lbWJlcklkIjoiODNlMjYxYjYtZjk3Yy00OWI5LWFjMWEtMjM5ZDM2MGNiOTljIiwidXNlcldvcmtzcGFjZUlkIjoiNjJlMGYwN2QtNjhjMi00ZTZmLWJmMTgtYjFiNTI5ZWU0MjE3IiwiaWF0IjoxNzcwMzgxNzUxLCJleHAiOjE3NzA1NjE3NTF9.AhoT8wnJOW0NRVKMR6wxa52_K2n4Omh4iEbFpOPf5Zo';

export const REQUIREMENTS_FILE = path.join(
  process.cwd(),
  'test-cache/random10-requirements.txt',
);

export const SEARCH_TYPES: Array<'classic' | 'sales_navigator' | 'recruiter'> = ['classic'];

type StepFlagName =
  | 'RUN_CLEANUP_STEP'
  | 'RUN_QUERY_UNDERSTANDING_STEP'
  | 'RUN_REQUIREMENT_ANALYZER_STEP'
  | 'RUN_JOB_TITLE_EXPANDER_STEP'
  | 'RUN_COMPANY_EXPANDER_STEP'
  | 'RUN_QUERY_CONSTRUCTOR_STEP'
  | 'RUN_BOOLTREE_HINTS_STEP'
  | 'RUN_UNRESOLVED_PARAMETERS_STEP'
  | 'RUN_RESOLVED_PARAMETERS_STEP'
  | 'RUN_LINKEDIN_URLS_STEP'
  | 'RUN_SEARCH_EXECUTION_STEP'
  | 'RUN_RESULT_VALIDATION_STEP'
  | 'RUN_CANDIDATE_SCORING_STEP';

const ALL_STEP_FLAGS: StepFlagName[] = [
  'RUN_CLEANUP_STEP',
  'RUN_QUERY_UNDERSTANDING_STEP',
  'RUN_REQUIREMENT_ANALYZER_STEP',
  'RUN_JOB_TITLE_EXPANDER_STEP',
  'RUN_COMPANY_EXPANDER_STEP',
  'RUN_QUERY_CONSTRUCTOR_STEP',
  'RUN_BOOLTREE_HINTS_STEP',
  'RUN_UNRESOLVED_PARAMETERS_STEP',
  'RUN_RESOLVED_PARAMETERS_STEP',
  'RUN_LINKEDIN_URLS_STEP',
  'RUN_SEARCH_EXECUTION_STEP',
  'RUN_RESULT_VALIDATION_STEP',
  'RUN_CANDIDATE_SCORING_STEP',
];

const defaultStepFlags: Record<StepFlagName, boolean> = {
  RUN_CLEANUP_STEP: true,
  RUN_QUERY_UNDERSTANDING_STEP: false,
  RUN_REQUIREMENT_ANALYZER_STEP: true,
  RUN_JOB_TITLE_EXPANDER_STEP: false,
  RUN_COMPANY_EXPANDER_STEP: false,
  RUN_QUERY_CONSTRUCTOR_STEP: true,
  RUN_BOOLTREE_HINTS_STEP: false,
  RUN_UNRESOLVED_PARAMETERS_STEP: true,
  RUN_RESOLVED_PARAMETERS_STEP: false,
  RUN_LINKEDIN_URLS_STEP: false,
  RUN_SEARCH_EXECUTION_STEP: false,
  RUN_RESULT_VALIDATION_STEP: false,
  RUN_CANDIDATE_SCORING_STEP: false,
};

function getCliSelectedSteps(): StepFlagName[] | null {
  const argv = process.argv ?? [];
  const paramsIndex = argv.indexOf('--params');

  if (paramsIndex === -1 || paramsIndex === argv.length - 1) {
    return null;
  }

  let raw = argv[paramsIndex + 1];

  if (!raw) {
    return null;
  }

  // Be forgiving:
  // - allow newlines
  // - allow a trailing comma before the closing ]
  raw = raw.trim();
  raw = raw.replace(/,\s*]/g, ']');

  // Expect JSON array, e.g. '["RUN_CLEANUP_STEP","RUN_QUERY_CONSTRUCTOR_STEP"]'
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value): value is StepFlagName =>
          (ALL_STEP_FLAGS as string[]).includes(value),
        );

      return normalized.length > 0 ? normalized : null;
    }
  } catch {
    // Ignore parse errors and fall back to defaults.
  }

  return null;
}

const cliSelectedSteps = getCliSelectedSteps();

const effectiveStepFlags: Record<StepFlagName, boolean> = { ...defaultStepFlags };

if (cliSelectedSteps && cliSelectedSteps.length > 0) {
  // When --params is provided, start with everything disabled and
  // enable only the explicitly requested steps.
  ALL_STEP_FLAGS.forEach((flag) => {
    effectiveStepFlags[flag] = false;
  });

  cliSelectedSteps.forEach((flag) => {
    effectiveStepFlags[flag] = true;
  });
}

/** Optional: where to write full JSON test results for inspection. */
export const RESULTS_FILE =
  process.env.CANDIDATE_SEARCH_RESULTS_FILE ||
  path.join(process.cwd(), 'test-results.unresolved.json');

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
export const USE_CACHE_BOOLTREE_HINTS = false;

export const RUN_CLEANUP_STEP = effectiveStepFlags.RUN_CLEANUP_STEP;
export const RUN_QUERY_UNDERSTANDING_STEP =
  effectiveStepFlags.RUN_QUERY_UNDERSTANDING_STEP;
export const RUN_REQUIREMENT_ANALYZER_STEP =
  effectiveStepFlags.RUN_REQUIREMENT_ANALYZER_STEP;
export const RUN_JOB_TITLE_EXPANDER_STEP =
  effectiveStepFlags.RUN_JOB_TITLE_EXPANDER_STEP;
export const RUN_COMPANY_EXPANDER_STEP =
  effectiveStepFlags.RUN_COMPANY_EXPANDER_STEP;
export const RUN_QUERY_CONSTRUCTOR_STEP =
  effectiveStepFlags.RUN_QUERY_CONSTRUCTOR_STEP;
export const RUN_BOOLTREE_HINTS_STEP = effectiveStepFlags.RUN_BOOLTREE_HINTS_STEP;
export const RUN_UNRESOLVED_PARAMETERS_STEP =
  effectiveStepFlags.RUN_UNRESOLVED_PARAMETERS_STEP;
export const RUN_RESOLVED_PARAMETERS_STEP =
  effectiveStepFlags.RUN_RESOLVED_PARAMETERS_STEP;
export const RUN_LINKEDIN_URLS_STEP = effectiveStepFlags.RUN_LINKEDIN_URLS_STEP;
export const RUN_SEARCH_EXECUTION_STEP =
  effectiveStepFlags.RUN_SEARCH_EXECUTION_STEP;
export const RUN_RESULT_VALIDATION_STEP =
  effectiveStepFlags.RUN_RESULT_VALIDATION_STEP;
export const RUN_CANDIDATE_SCORING_STEP =
  effectiveStepFlags.RUN_CANDIDATE_SCORING_STEP;

export const CACHE_DIR = path.join(process.cwd(), 'test-cache');
