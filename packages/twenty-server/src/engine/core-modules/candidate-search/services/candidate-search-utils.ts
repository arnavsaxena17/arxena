import {
  LinkedInClassicPeopleSearchRequest
} from '../../linkedin-search/types/linkedin-search-request.type';
import {
  ClassicPeopleParameterName
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
  network_distance: undefined,
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
    case 'school': {
      target.school = sanitizeStringArray(value);
      break;
    }

  }
};


