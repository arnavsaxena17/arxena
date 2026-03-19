import type { ParsedJobDescription } from '../types/candidate-search-request.type';

/**
 * Creates a minimal ParsedJobDescription stub with sensible defaults.
 * Use overrides to fill in specific fields (e.g. company name for org chart search).
 */
export function createMinimalParsedJobDescription(
  overrides?: Partial<ParsedJobDescription>,
): ParsedJobDescription {
  return {
    jobTitle: '',
    company: '',
    location: '',
    industry: '',
    requiredSkills: [],
    preferredSkills: [],
    experienceLevel: 'mid_level',
    education: [],
    keywords: [],
    responsibilities: [],
    qualifications: [],
    benefits: [],
    employmentType: 'full_time',
    remoteWork: false,
    salaryRange: null,
    ...overrides,
  };
}
