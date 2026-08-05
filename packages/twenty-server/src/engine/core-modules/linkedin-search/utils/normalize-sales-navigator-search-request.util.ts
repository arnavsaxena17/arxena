type IncludeExcludeFilter = {
  include?: string[];
  exclude?: string[];
};

const SALES_NAVIGATOR_INCLUDE_EXCLUDE_FIELDS = [
  'location',
  'industry',
  'company',
  'school',
  'function',
  'role',
  'past_company',
  'past_role',
  'company_location',
  'seniority',
  'account_lists',
  'lead_lists',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const toIncludeExcludeFilter = (
  value: unknown,
): IncludeExcludeFilter | undefined => {
  if (isStringArray(value) && value.length > 0) {
    return { include: value };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const include = isStringArray(value.include) ? value.include : undefined;
  const exclude = isStringArray(value.exclude) ? value.exclude : undefined;

  if (!include && !exclude) {
    return undefined;
  }

  return {
    ...(include ? { include } : {}),
    ...(exclude ? { exclude } : {}),
  };
};

// Agents often emit classic flat arrays (and job_title) for Sales Navigator.
// Unipile expects include/exclude objects and role (not job_title).
export const normalizeSalesNavigatorPeopleSearchRequest = (
  request: Record<string, unknown>,
): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...request };

  if (normalized.job_title !== undefined && normalized.role === undefined) {
    normalized.role = normalized.job_title;
  }
  delete normalized.job_title;

  for (const fieldName of SALES_NAVIGATOR_INCLUDE_EXCLUDE_FIELDS) {
    if (normalized[fieldName] === undefined) {
      continue;
    }

    const filter = toIncludeExcludeFilter(normalized[fieldName]);

    if (filter) {
      normalized[fieldName] = filter;
    }
  }

  return normalized;
};

export const normalizeSalesNavigatorCompaniesSearchRequest = (
  request: Record<string, unknown>,
): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...request };

  for (const fieldName of [
    'location',
    'industry',
    'account_lists',
  ] as const) {
    if (normalized[fieldName] === undefined) {
      continue;
    }

    const filter = toIncludeExcludeFilter(normalized[fieldName]);

    if (filter) {
      normalized[fieldName] = filter;
    }
  }

  return normalized;
};
