import { z } from 'zod';
import {
  LinkedInAdvancedKeywordsFilter,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import {
  ClassicPeopleParameterName,
  ClassicPeopleParameterSelection,
  classicPeopleSearchSchema,
} from '../schemas/classic-people-search.schema';
import {
  RecruiterPeopleParameterName,
  RecruiterPeopleParameterSelection,
  recruiterPeopleSearchSchema,
} from '../schemas/recruiter-people-search.schema';
import {
  SalesNavigatorPeopleParameterName,
  SalesNavigatorPeopleParameterSelection,
  salesNavigatorPeopleSearchSchema,
} from '../schemas/sales-navigator-people-search.schema';

export const sanitizeStringValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export const sanitizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const cleanedValues = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  return cleanedValues.length > 0 ? cleanedValues : undefined;
};

export const createClassicPeopleBaseResult = (): Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> => ({
  keywords: undefined,
  industry: undefined,
  location: undefined,
  profile_language: undefined,
  network_distance: [2] as Array<1 | 2 | 3>,
  company: undefined,
  past_company: undefined,
  school: undefined,
  service: undefined,
  connections_of: undefined,
  followers_of: undefined,
  open_to: undefined,
  advanced_keywords: undefined,
});

export const assignClassicPeopleParameterValue = (
  target: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
  parameter: ClassicPeopleParameterName,
  value: unknown,
): void => {
  switch (parameter) {
    case 'keywords': {
      target.keywords = sanitizeStringValue(value);
      break;
    }
    case 'industry': {
      target.industry = sanitizeStringArray(value);
      break;
    }
    case 'location': {
      target.location = sanitizeStringArray(value);
      break;
    }
    case 'company': {
      target.company = sanitizeStringArray(value);
      break;
    }
    case 'past_company': {
      target.past_company = sanitizeStringArray(value);
      break;
    }
    case 'school': {
      target.school = sanitizeStringArray(value);
      break;
    }
    case 'advanced_keywords': {
      if (value && typeof value === 'object') {
        const advancedValue = value as LinkedInAdvancedKeywordsFilter;
        const normalizedAdvancedKeywords = {
          first_name: sanitizeStringValue(advancedValue.first_name),
          last_name: sanitizeStringValue(advancedValue.last_name),
          title: sanitizeStringValue(advancedValue.title),
          company: sanitizeStringValue(advancedValue.company),
          school: sanitizeStringValue(advancedValue.school),
        };
        const hasAnyValue = Object.values(normalizedAdvancedKeywords).some((entry) => !!entry);
        target.advanced_keywords = hasAnyValue ? normalizedAdvancedKeywords : undefined;
      } else {
        target.advanced_keywords = undefined;
      }
      break;
    }
  }
};

export const buildDefaultParameterSelection = (): ClassicPeopleParameterSelection => ({
  keywords: {
    shouldGenerate: true,
    reasoning: 'Default fallback when selection fails: keywords are always required to anchor the search.',
  },
  industry: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  location: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  company: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  past_company: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  school: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  advanced_keywords: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
});

export const classicPeopleParameterSchemaMap: Record<ClassicPeopleParameterName, z.ZodTypeAny> = {
  keywords: z.object({
    keywords: classicPeopleSearchSchema.shape.keywords,
  }),
  industry: z.object({
    industry: classicPeopleSearchSchema.shape.industry,
  }),
  location: z.object({
    location: classicPeopleSearchSchema.shape.location,
  }),
  company: z.object({
    company: classicPeopleSearchSchema.shape.company,
  }),
  past_company: z.object({
    past_company: classicPeopleSearchSchema.shape.past_company,
  }),
  school: z.object({
    school: classicPeopleSearchSchema.shape.school,
  }),
  advanced_keywords: z.object({
    advanced_keywords: classicPeopleSearchSchema.shape.advanced_keywords,
  }),
};

// Sales Navigator People Search utilities
export const createSalesNavigatorPeopleBaseResult = (): Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> => ({
  keywords: undefined,
  last_viewed_at: undefined,
  saved_search_id: undefined,
  recent_search_id: undefined,
  location: undefined,
  location_by_postal_code: undefined,
  industry: undefined,
  first_name: undefined,
  last_name: undefined,
  tenure: undefined,
  groups: undefined,
  school: undefined,
  profile_language: undefined,
  company: undefined,
  company_headcount: undefined,
  company_type: undefined,
  company_location: undefined,
  tenure_at_company: undefined,
  past_company: undefined,
  function: undefined,
  role: undefined,
  tenure_at_role: undefined,
  seniority: undefined,
  past_role: undefined,
  following_your_company: undefined,
  viewed_your_profile_recently: undefined,
  network_distance: undefined,
  connections_of: undefined,
  past_colleague: undefined,
  shared_experiences: undefined,
  changed_jobs: undefined,
  posted_on_linkedin: undefined,
  mentionned_in_news: undefined,
  persona: undefined,
  account_lists: undefined,
  lead_lists: undefined,
  viewed_profile_recently: undefined,
  messaged_recently: undefined,
  include_saved_leads: undefined,
  include_saved_accounts: undefined,
});

export const assignSalesNavigatorPeopleParameterValue = (
  target: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
  parameter: SalesNavigatorPeopleParameterName,
  value: unknown,
): void => {
  switch (parameter) {
    case 'keywords': {
      target.keywords = sanitizeStringValue(value);
      break;
    }
    case 'location': {
      if (value && typeof value === 'object' && 'include' in value) {
        const locationValue = value as { include?: string[] | null; exclude?: string[] | null };
        const include = sanitizeStringArray(locationValue.include);
        const exclude = sanitizeStringArray(locationValue.exclude);
        target.location = (include || exclude) ? { include: include ?? undefined, exclude: exclude ?? undefined } : undefined;
      } else {
        target.location = undefined;
      }
      break;
    }
    case 'industry': {
      if (value && typeof value === 'object' && 'include' in value) {
        const industryValue = value as { include?: string[] | null; exclude?: string[] | null };
        const include = sanitizeStringArray(industryValue.include);
        const exclude = sanitizeStringArray(industryValue.exclude);
        target.industry = (include || exclude) ? { include: include ?? undefined, exclude: exclude ?? undefined } : undefined;
      } else {
        target.industry = undefined;
      }
      break;
    }
    case 'company': {
      if (value && typeof value === 'object' && 'include' in value) {
        const companyValue = value as { include?: string[] | null; exclude?: string[] | null };
        const include = sanitizeStringArray(companyValue.include);
        const exclude = sanitizeStringArray(companyValue.exclude);
        target.company = (include || exclude) ? { include: include ?? undefined, exclude: exclude ?? undefined } : undefined;
      } else {
        target.company = undefined;
      }
      break;
    }
    case 'past_company': {
      if (value && typeof value === 'object' && 'include' in value) {
        const pastCompanyValue = value as { include?: string[] | null; exclude?: string[] | null };
        const include = sanitizeStringArray(pastCompanyValue.include);
        const exclude = sanitizeStringArray(pastCompanyValue.exclude);
        target.past_company = (include || exclude) ? { include: include ?? undefined, exclude: exclude ?? undefined } : undefined;
      } else {
        target.past_company = undefined;
      }
      break;
    }
    case 'role': {
      if (value && typeof value === 'object' && 'include' in value) {
        const roleValue = value as { include?: string[] | null; exclude?: string[] | null };
        const include = sanitizeStringArray(roleValue.include);
        const exclude = sanitizeStringArray(roleValue.exclude);
        target.role = (include || exclude) ? { include: include ?? undefined, exclude: exclude ?? undefined } : undefined;
      } else {
        target.role = undefined;
      }
      break;
    }
    case 'function': {
      if (value && typeof value === 'object' && 'include' in value) {
        const functionValue = value as { include?: string[] | null; exclude?: string[] | null };
        const include = sanitizeStringArray(functionValue.include);
        const exclude = sanitizeStringArray(functionValue.exclude);
        target.function = (include || exclude) ? { include: include ?? undefined, exclude: exclude ?? undefined } : undefined;
      } else {
        target.function = undefined;
      }
      break;
    }
    case 'seniority': {
      if (value && typeof value === 'object' && ('include' in value || 'exclude' in value)) {
        const seniorityValue = value as { include?: string[] | null; exclude?: string[] | null };
        target.seniority = {
          include: seniorityValue.include ? (seniorityValue.include as any) : undefined,
          exclude: seniorityValue.exclude ? (seniorityValue.exclude as any) : undefined,
        };
      } else {
        target.seniority = undefined;
      }
      break;
    }
    case 'school': {
      if (value && typeof value === 'object' && 'include' in value) {
        const schoolValue = value as { include?: string[] | null; exclude?: string[] | null };
        const include = sanitizeStringArray(schoolValue.include);
        const exclude = sanitizeStringArray(schoolValue.exclude);
        target.school = (include || exclude) ? { include: include ?? undefined, exclude: exclude ?? undefined } : undefined;
      } else {
        target.school = undefined;
      }
      break;
    }
  }
};

export const buildDefaultSalesNavigatorPeopleParameterSelection = (): SalesNavigatorPeopleParameterSelection => ({
  keywords: {
    shouldGenerate: true,
    reasoning: 'Default fallback when selection fails: keywords are always required to anchor the search.',
  },
  location: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  industry: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  company: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  past_company: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  role: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  function: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  seniority: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  school: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
});

export const salesNavigatorPeopleParameterSchemaMap: Record<SalesNavigatorPeopleParameterName, z.ZodTypeAny> = {
  keywords: z.object({
    keywords: salesNavigatorPeopleSearchSchema.shape.keywords,
  }),
  location: z.object({
    location: salesNavigatorPeopleSearchSchema.shape.location,
  }),
  industry: z.object({
    industry: salesNavigatorPeopleSearchSchema.shape.industry,
  }),
  company: z.object({
    company: salesNavigatorPeopleSearchSchema.shape.company,
  }),
  past_company: z.object({
    past_company: salesNavigatorPeopleSearchSchema.shape.past_company,
  }),
  role: z.object({
    role: salesNavigatorPeopleSearchSchema.shape.role,
  }),
  function: z.object({
    function: salesNavigatorPeopleSearchSchema.shape.function,
  }),
  seniority: z.object({
    seniority: salesNavigatorPeopleSearchSchema.shape.seniority,
  }),
  school: z.object({
    school: salesNavigatorPeopleSearchSchema.shape.school,
  }),
};

// Recruiter People Search utilities
export const createRecruiterPeopleBaseResult = (): Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'> => ({
  keywords: undefined,
  locale: undefined,
  saved_search: undefined,
  saved_filter: undefined,
  location: undefined,
  location_within_area: undefined,
  industry: undefined,
  role: undefined,
  skills: undefined,
  company: undefined,
  company_headcount: undefined,
  current_company: undefined,
  past_company: undefined,
  school: undefined,
  groups: undefined,
  graduation_year: undefined,
  tenure: undefined,
  seniority: undefined,
  function: undefined,
  network_distance: undefined,
  spoken_languages: undefined,
  hide_previously_viewed: undefined,
  profile_language: undefined,
  recently_joined: undefined,
  spotlights: undefined,
  first_name: undefined,
  last_name: undefined,
  has_military_background: undefined,
  past_applicants: undefined,
  hiring_projects: undefined,
  recruiting_activity: undefined,
  notes: undefined,
});

export const assignRecruiterPeopleParameterValue = (
  target: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
  parameter: RecruiterPeopleParameterName,
  value: unknown,
): void => {
  switch (parameter) {
    case 'keywords': {
      target.keywords = sanitizeStringValue(value);
      break;
    }
    case 'location': {
      if (Array.isArray(value)) {
        target.location = value.length > 0 ? value as any : undefined;
      } else {
        target.location = undefined;
      }
      break;
    }
    case 'industry': {
      if (value && typeof value === 'object' && 'include' in value) {
        const industryValue = value as { include?: string[] | null; exclude?: string[] | null };
        const include = sanitizeStringArray(industryValue.include);
        const exclude = sanitizeStringArray(industryValue.exclude);
        target.industry = (include || exclude) ? { include: include ?? undefined, exclude: exclude ?? undefined } : undefined;
      } else {
        target.industry = undefined;
      }
      break;
    }
    case 'role': {
      if (Array.isArray(value)) {
        target.role = value.length > 0 ? value as any : undefined;
      } else {
        target.role = undefined;
      }
      break;
    }
    case 'company': {
      if (Array.isArray(value)) {
        target.company = value.length > 0 ? value as any : undefined;
      } else {
        target.company = undefined;
      }
      break;
    }
    case 'past_company': {
      if (Array.isArray(value)) {
        target.past_company = value.length > 0 ? value as any : undefined;
      } else {
        target.past_company = undefined;
      }
      break;
    }
    case 'school': {
      if (Array.isArray(value)) {
        target.school = value.length > 0 ? value as any : undefined;
      } else {
        target.school = undefined;
      }
      break;
    }
    case 'skills': {
      if (Array.isArray(value)) {
        target.skills = value.length > 0 ? value as any : undefined;
      } else {
        target.skills = undefined;
      }
      break;
    }
    case 'seniority': {
      if (value && typeof value === 'object' && ('include' in value || 'exclude' in value)) {
        const seniorityValue = value as { include?: string[] | null; exclude?: string[] | null };
        target.seniority = {
          include: seniorityValue.include ? (seniorityValue.include as any) : undefined,
          exclude: seniorityValue.exclude ? (seniorityValue.exclude as any) : undefined,
        };
      } else {
        target.seniority = undefined;
      }
      break;
    }
  }
};

export const buildDefaultRecruiterPeopleParameterSelection = (): RecruiterPeopleParameterSelection => ({
  keywords: {
    shouldGenerate: true,
    reasoning: 'Default fallback when selection fails: keywords are always required to anchor the search.',
  },
  location: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  industry: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  role: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  company: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  past_company: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  school: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  skills: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  seniority: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
});

export const recruiterPeopleParameterSchemaMap: Record<RecruiterPeopleParameterName, z.ZodTypeAny> = {
  keywords: z.object({
    keywords: recruiterPeopleSearchSchema.shape.keywords,
  }),
  location: z.object({
    location: recruiterPeopleSearchSchema.shape.location,
  }),
  industry: z.object({
    industry: recruiterPeopleSearchSchema.shape.industry,
  }),
  role: z.object({
    role: recruiterPeopleSearchSchema.shape.role,
  }),
  company: z.object({
    company: recruiterPeopleSearchSchema.shape.company,
  }),
  past_company: z.object({
    past_company: recruiterPeopleSearchSchema.shape.past_company,
  }),
  school: z.object({
    school: recruiterPeopleSearchSchema.shape.school,
  }),
  skills: z.object({
    skills: recruiterPeopleSearchSchema.shape.skills,
  }),
  seniority: z.object({
    seniority: recruiterPeopleSearchSchema.shape.seniority,
  }),
};

