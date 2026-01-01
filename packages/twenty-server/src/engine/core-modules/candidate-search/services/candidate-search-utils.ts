import { z } from 'zod';
import {
    LinkedInAdvancedKeywordsFilter,
    LinkedInClassicPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import {
    ClassicPeopleParameterName,
    ClassicPeopleParameterSelection,
    classicPeopleSearchSchema,
} from '../schemas/classic-people-search.schema';

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

