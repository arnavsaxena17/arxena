import type { OrgChartContactInfo } from '@/orgchart/states/orgChartContactsByKeyState';

import { extractCompanyDomainFromWebsite } from '../../utils/orgChartUtils';

export const hydrateContactsByKeyFromOrgData = ({
  orgData,
  effectiveCompanyWebsite,
  website,
}: {
  orgData: Record<string, unknown> | null;
  effectiveCompanyWebsite: string | undefined;
  website: string | undefined;
}): Record<string, OrgChartContactInfo> => {
  if (!orgData) return {};
  const raw = (orgData as Record<string, unknown>).orgchart;
  let nodes: unknown[] = [];
  if (Array.isArray(raw)) {
    nodes = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      nodes = Array.isArray(parsed) ? parsed : [];
    } catch {
      nodes = [];
    }
  }
  if (nodes.length === 0) return {};

  const websiteToUse =
    (orgData as Record<string, unknown>).job_company_website ??
    (orgData as Record<string, unknown>).company_website ??
    effectiveCompanyWebsite ??
    website;
  const domain =
    typeof websiteToUse === 'string'
      ? extractCompanyDomainFromWebsite(websiteToUse)
      : undefined;

  const next: Record<string, OrgChartContactInfo> = {};

  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue;
    const candidatesRaw = (n as Record<string, unknown>).candidates;
    const candidates = Array.isArray(candidatesRaw)
      ? candidatesRaw
      : candidatesRaw && typeof candidatesRaw === 'object'
        ? [candidatesRaw]
        : [];
    for (const c of candidates) {
      if (!c || typeof c !== 'object') continue;
      const row = c as Record<string, unknown>;
      const rawId = typeof row.id === 'string' ? row.id.trim() : '';
      const li =
        typeof row.std_linkedin_url === 'string'
          ? row.std_linkedin_url.trim()
          : typeof row.linkedin_url === 'string'
            ? row.linkedin_url.trim()
            : '';
      const email =
        typeof row.email === 'string' && row.email.trim()
          ? row.email.trim()
          : Array.isArray(row.emails) && typeof row.emails[0] === 'string'
            ? (row.emails[0] as string).trim()
            : '';
      const phone =
        typeof row.phone === 'string' && row.phone.trim()
          ? row.phone.trim()
          : Array.isArray(row.phones) && typeof row.phones[0] === 'string'
            ? (row.phones[0] as string).trim()
            : '';
      const fullName =
        typeof row.full_name === 'string' && row.full_name.trim()
          ? row.full_name.trim()
          : typeof row.fullName === 'string' && row.fullName.trim()
            ? row.fullName.trim()
            : '';

      const hasAny = Boolean(email || phone || li || fullName);
      if (!hasAny) continue;

      const key =
        domain && rawId
          ? `m7kq:${domain.trim().toLowerCase()}:${rawId}`
          : li
            ? `li:${li}`
            : rawId
              ? `id:${rawId}`
              : null;
      if (!key) continue;

      next[key] = {
        fetched: true,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(li ? { linkedinUrl: li } : {}),
        ...(fullName ? { fullName } : {}),
      };
    }
  }

  return next;
};

