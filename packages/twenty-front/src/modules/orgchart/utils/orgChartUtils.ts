import {
    isValidLinkedInProfileUrl,
    toTitleCase,
    type OrgChartNodeData,
} from 'twenty-shared';

import type { ContextResultItem } from '../types';

export const normalizeCandidateItem = (
  raw: Record<string, unknown>,
  index: number,
): ContextResultItem => {
  const rawFullName =
    (raw.full_name as string | undefined) ??
    (raw.fullName as string | undefined) ??
    (raw.name as string | undefined) ??
    (raw.headline as string | undefined) ??
    `Candidate ${index + 1}`;
  const fullName = toTitleCase(rawFullName, { skipIfMasked: true });

  const rawHeadline =
    (raw.job_title as string | undefined) ??
    (raw.headline as string | undefined) ??
    (raw.title as string | undefined) ??
    (raw.jobTitle as string | undefined) ??
    '';
  const headline = toTitleCase(rawHeadline, { skipIfMasked: true });

  const company = toTitleCase(
    (raw.company as string | undefined) ??
      (raw.currentCompany as string | undefined) ??
      (raw.organisation as string | undefined) ??
      '',
  );

  const email =
    (raw.email_address as string | undefined) ??
    (raw.email as string | undefined) ??
    (Array.isArray(raw.emails)
      ? (raw.emails.find((e) => typeof e === 'string') as string | undefined)
      : undefined);

  const phone =
    (raw.phone_number as string | undefined) ??
    (raw.phone as string | undefined) ??
    (Array.isArray(raw.phones)
      ? (raw.phones.find((p) => typeof p === 'string') as string | undefined)
      : undefined);

  const rawLinkedin =
    (raw.linkedin_url as string | undefined) ??
    (raw.linkedinUrl as string | undefined) ??
    (raw.std_linkedin_url as string | undefined) ??
    (raw.profileUrl as string | undefined) ??
    (raw.url as string | undefined);

  const linkedinUrl =
    typeof rawLinkedin === 'string' &&
    isValidLinkedInProfileUrl(rawLinkedin.trim())
      ? rawLinkedin.trim()
      : undefined;

  return {
    id:
      (raw.id as string | undefined) ??
      (raw.profileId as string | undefined) ??
      `${index}`,
    fullName,
    headline,
    company,
    linkedinUrl,
    email: email && typeof email === 'string' ? email : undefined,
    phone: phone && typeof phone === 'string' ? phone : undefined,
    raw,
  };
};

export const buildBooleanKeywordsForNode = (
  node: OrgChartNodeData,
  companyName?: string,
): string => {
  const titles: string[] = [];
  const names: string[] = [];

  for (let i = 0; i < 8; i += 1) {
    const titleKey = `title_${i}` as keyof OrgChartNodeData;
    const nameKey = `name_${i}` as keyof OrgChartNodeData;

    const t = node[titleKey];
    const n = node[nameKey];

    if (typeof t === 'string' && t.trim().length > 0) {
      titles.push(`"${t.trim()}"`);
    }
    if (typeof n === 'string' && n.trim().length > 0) {
      names.push(`"${n.trim()}"`);
    }
  }

  const parts: string[] = [];
  if (titles.length > 0) {
    parts.push(`(${titles.join(' OR ')})`);
  }
  if (names.length > 0) {
    parts.push(`(${names.join(' OR ')})`);
  }

  const companyPart = companyName ? `"${companyName}"` : '';
  if (companyPart) {
    parts.push(companyPart);
  }

  return parts.join(' AND ');
};

export const toLinkedInPremiumCandidate = (
  item: ContextResultItem,
): Record<string, unknown> => {
  const raw = item.raw ?? {};
  const linkedinUrl = item.linkedinUrl ?? '';
  const publicIdentifier = linkedinUrl
    ? linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '').split('/')[0]
    : '';
  return {
    full_name: item.fullName,
    job_title: item.headline,
    linkedin_url: linkedinUrl,
    profile_url: linkedinUrl,
    public_identifier: publicIdentifier || undefined,
    linkedin_profile_id_url: linkedinUrl,
    ...(raw && typeof raw === 'object' ? raw : {}),
    uniqueStringKey: linkedinUrl || `orgchart-${item.id}`,
  };
};

export const getSuggestedJobNameFromContext = (
  companyName: string,
  contextModalMode: string | null,
): string => {
  const label =
    contextModalMode === 'leadership'
      ? 'Leadership'
      : contextModalMode === 'entire_company' || contextModalMode === 'all_people'
        ? 'All employees'
        : contextModalMode === 'function_grade'
          ? 'This function'
          : contextModalMode === 'current_node' || contextModalMode === 'selected_nodes'
            ? 'Selected positions'
            : 'Org chart';
  return `${companyName || 'Company'} – ${label}`;
};

const escapeCsvValue = (value: string): string =>
  `"${String(value).replace(/"/g, '""')}"`;

const CONTEXT_RESULT_CSV_COLUMNS: { key: keyof ContextResultItem; header: string }[] = [
  { key: 'fullName', header: 'Full Name' },
  { key: 'headline', header: 'Headline' },
  { key: 'company', header: 'Company' },
  { key: 'linkedinUrl', header: 'LinkedIn URL' },
];

export const exportContextResultsToCsv = (
  items: ContextResultItem[],
  filename: string,
): void => {
  if (!items.length) return;

  const header = CONTEXT_RESULT_CSV_COLUMNS.map((c) => c.header);
  const rows = items.map((item) =>
    CONTEXT_RESULT_CSV_COLUMNS.map((c) =>
      escapeCsvValue(String(item[c.key] ?? '')),
    ),
  );
  const csv = [header, ...rows].map((cols) => cols.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
