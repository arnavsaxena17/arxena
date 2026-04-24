export type OrgChartCandidateSource =
  | 'unipile'
  | 'apollo'
  | 'm7kq'
  | 'theorg'
  | 'officialboard'
  | 'linkedin_xray'
  | 'apify'
  | 'unknown';

const normalizeStringForDedupe = (v: unknown): string => {
  if (typeof v !== 'string') return '';
  return v.trim().toLowerCase();
};

const normalizeLinkedinUrlForDedupe = (url: unknown): string | null => {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    if (!host.includes('linkedin.com')) return null;
    const pathname = u.pathname.replace(/\/+$/, '').toLowerCase();
    return `https://${host}${pathname}`;
  } catch {
    const m = trimmed.match(/linkedin\.com\/(in|company)\/[^?#/]+/i);
    return m ? trimmed.replace(/\/+$/, '').toLowerCase() : null;
  }
};

export const buildOrgChartCandidateDedupeKey = (
  row: Record<string, unknown>,
): string | null => {
  const linkedinUrl =
    normalizeLinkedinUrlForDedupe(
      row.public_profile_url ??
        row.profile_url ??
        row.linkedin_url ??
        row.linkedinUrl ??
        // TheOrg sometimes uses lowercase key
        (row as Record<string, unknown>).linkedinurl ??
        // Some sources use different casing
        (row as Record<string, unknown>).linkedInUrl,
    ) ?? null;
  if (linkedinUrl) {
    return `li:${linkedinUrl}`;
  }

  // Next best: (company-scoped) first name + job title (Apollo may have truncated last name).
  // Important: after normalization for the Python builder, rows often use `full_name` + `job_title`.
  const rawFullName = row.full_name ?? row.name;
  const fullName = normalizeStringForDedupe(rawFullName);
  const firstNameFromFullName = fullName ? fullName.split(/\s+/)[0] ?? '' : '';
  const firstName =
    normalizeStringForDedupe(row.first_name) ||
    normalizeStringForDedupe(row.firstName) ||
    firstNameFromFullName;

  const title =
    normalizeStringForDedupe(row.headline) ||
    normalizeStringForDedupe(row.title) ||
    normalizeStringForDedupe(row.job_title) ||
    // TheOrg / frontend-like payloads
    normalizeStringForDedupe((row as Record<string, unknown>).jobTitle);

  const companyScope =
    normalizeStringForDedupe(row.job_company_id) ||
    normalizeStringForDedupe(row.company_id) ||
    normalizeStringForDedupe(row.job_company_linkedin_url) ||
    normalizeStringForDedupe(row.company) ||
    normalizeStringForDedupe(row.job_company_name) ||
    normalizeStringForDedupe((row as Record<string, unknown>).jobCompanyName);

  if (firstName && title) {
    const scoped = companyScope ? `|${companyScope}` : '';
    return `ft:${firstName}|${title}${scoped}`;
  }

  // Last resort: Apollo person id if available.
  const apolloId =
    typeof row.id === 'string' && row.id.trim()
      ? row.id.trim()
      : typeof row.apollo_id === 'string' && row.apollo_id.trim()
        ? row.apollo_id.trim()
        : null;
  if (apolloId && apolloId.startsWith('apollo_') === false) {
    return `apollo:${apolloId}`;
  }

  return null;
};

export const mergeOrgChartCandidateRow = (
  primary: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...primary, ...incoming };
  const preferPrimaryKeys = [
    'name',
    'full_name',
    'first_name',
    'last_name',
    'headline',
    'job_title',
    'current_positions',
  ] as const;
  for (const key of preferPrimaryKeys) {
    if (
      primary[key] !== undefined &&
      primary[key] !== null &&
      primary[key] !== '' &&
      (incoming[key] === undefined || incoming[key] === null || incoming[key] === '')
    ) {
      merged[key] = primary[key];
    }
  }

  // Prefer contact/enrichment fields when available (often from Apollo/m7kq).
  const preferIncomingIfMissing = [
    'emails',
    'phone_numbers',
    'email',
    'phone',
    'apollo_id',
    'apolloId',
    'contact_availability',
    'profile_picture_url',
    'displayPicture',
    'public_profile_url',
    'profile_url',
    'linkedin_url',
    'linkedinurl',
    'linkedinUrl',
  ] as const;
  for (const key of preferIncomingIfMissing) {
    if (
      (primary[key] === undefined || primary[key] === null || primary[key] === '') &&
      incoming[key] !== undefined &&
      incoming[key] !== null &&
      incoming[key] !== ''
    ) {
      merged[key] = incoming[key];
    }
  }
  const sources = new Set<string>();
  const addSources = (val: unknown) => {
    if (Array.isArray(val)) {
      for (const s of val) {
        if (typeof s === 'string' && s.trim()) sources.add(s.trim());
      }
    } else if (typeof val === 'string' && val.trim()) {
      sources.add(val.trim());
    }
  };
  addSources(primary.sources);
  addSources(incoming.sources);
  addSources(primary.source);
  addSources(incoming.source);
  if (sources.size > 0) {
    merged.sources = Array.from(sources);
  }
  return merged;
};

export const dedupeAndMergeOrgChartCandidates = (
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> => {
  const byKey = new Map<string, Record<string, unknown>>();
  const passthrough: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const key = buildOrgChartCandidateDedupeKey(row);
    if (!key) {
      passthrough.push(row);
      continue;
    }
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeOrgChartCandidateRow(existing, row) : row);
  }
  return [...byKey.values(), ...passthrough];
};

