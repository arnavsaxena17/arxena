import type { LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';

const LINKEDIN_SENIORITY_TYPES = new Set<LinkedInSeniorityType>([
  'owner/partner',
  'cxo',
  'vice_president',
  'director',
  'experienced_manager',
  'entry_level_manager',
  'strategic',
  'senior',
  'entry_level',
  'in_training',
]);

const SENIORITY_TEXT_TO_TYPE: Record<string, LinkedInSeniorityType> = {
  'owner / partner': 'owner/partner',
  'owner/partner': 'owner/partner',
  owner: 'owner/partner',
  partner: 'owner/partner',
  cxo: 'cxo',
  'vice president': 'vice_president',
  director: 'director',
  'experienced manager': 'experienced_manager',
  'entry level manager': 'entry_level_manager',
  strategic: 'strategic',
  senior: 'senior',
  'entry level': 'entry_level',
  'in training': 'in_training',
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' || typeof entry === 'number' ? String(entry).trim() : ''))
    .filter((entry) => entry.length > 0);
};

const unique = (values: string[]): string[] => [...new Set(values)];

export const extractUnipilePeopleSearchIntent = (
  config: unknown,
): {
  companyIds: string[];
  seniorities: LinkedInSeniorityType[];
} => {
  const root = asRecord(config);
  const params = asRecord(root?.params) ?? root;
  const companyInclude = asStringArray(asRecord(params?.company)?.include);
  const seniorityInclude = asStringArray(
    asRecord(params?.seniority)?.include,
  );

  return {
    companyIds: unique(companyInclude),
    seniorities: seniorityInclude.filter((value): value is LinkedInSeniorityType =>
      LINKEDIN_SENIORITY_TYPES.has(value as LinkedInSeniorityType),
    ),
  };
};

export const parseSalesNavUrlSearchIntent = (
  url: string,
): {
  companyIds: string[];
  seniorities: LinkedInSeniorityType[];
} => {
  let decoded = url;

  try {
    decoded = decodeURIComponent(url);
  } catch {
    decoded = url;
  }

  const companyIds = unique([
    ...[...decoded.matchAll(/urn:li:organization:(\d+)/gi)].map(
      (match) => match[1],
    ),
    ...[...decoded.matchAll(/organization:(\d+)/gi)].map((match) => match[1]),
  ]);

  const seniorities: LinkedInSeniorityType[] = [];
  const seniorityBlock = decoded.match(/type:SENIORITY_LEVEL[\s\S]{0,800}/i);

  if (seniorityBlock) {
    for (const match of seniorityBlock[0].matchAll(/text:([^,)]+)/gi)) {
      const mapped = SENIORITY_TEXT_TO_TYPE[match[1].trim().toLowerCase()];

      if (mapped) {
        seniorities.push(mapped);
      }
    }
  }

  return {
    companyIds,
    seniorities: unique(seniorities) as LinkedInSeniorityType[],
  };
};
