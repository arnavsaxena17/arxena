import {
    isValidLinkedInProfileUrl,
    toTitleCase,
    type OrgChartNodeData,
} from 'twenty-shared';

import type { ContextResultItem } from '../types';

/**
 * Extract a bare domain (e.g. "litify.com") from a website URL/string.
 *
 * Mirrors {@link OrgChartCompanyInfo}'s display helper so the value rendered in
 * the company header and the value sent to the server (`companyDomain` on
 * `/org-chart/search`) always match.
 *
 * Returns undefined when the input cannot be parsed into a hostname.
 */
export const extractCompanyDomainFromWebsite = (
  site?: string | null,
): string | undefined => {
  if (!site?.trim()) return undefined;
  try {
    const withProtocol = site.startsWith('http') ? site : `https://${site}`;
    const { hostname } = new URL(withProtocol);
    const bare = hostname.replace(/^www\./u, '').trim().toLowerCase();
    return bare.length > 0 ? bare : undefined;
  } catch {
    const trimmed = site.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : undefined;
  }
};

/** True when header metadata should be enriched via PDL autocomplete / domain resolve. */
export const needsOrgChartCompanyInfoLookup = (metadata: {
  website?: string;
  locationName?: string;
  industry?: string;
  linkedinUrl?: string;
  profileCount?: number;
}): boolean =>
  !metadata.website?.trim() ||
  !metadata.locationName?.trim() ||
  !metadata.industry?.trim() ||
  !metadata.linkedinUrl?.trim() ||
  typeof metadata.profileCount !== 'number';

/** Query string for `/org-chart/:companyId` so refresh preserves Apollo domain hints. */
export const orgChartSelectionSearch = (company: {
  companyName: string;
  website?: string;
  companyDomain?: string;
}): string => {
  const params = new URLSearchParams();
  if (company.companyName?.trim()) {
    params.set('companyName', company.companyName.trim());
  }
  if (company.website?.trim()) {
    params.set('website', company.website.trim());
  }
  if (company.companyDomain?.trim()) {
    params.set('companyDomain', company.companyDomain.trim());
  }
  const q = params.toString();
  return q ? `?${q}` : '';
};

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

export type UploadOrgChartProfilesParams = {
  baseUrl: string;
  accessToken: string;
  items: ContextResultItem[];
  jobId: string;
  jobName: string;
  recruiterId?: string;
  queueStartChatAfter: boolean;
  orgChartSelectedNodes?: { std_function?: string; std_grade?: string };
};

export type UploadOrgChartProfilesResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * POST /candidate-sourcing/upload-profiles — shared by Add-to-job modals and org-chart outreach.
 */
export const uploadOrgChartCandidatesToJob = async (
  params: UploadOrgChartProfilesParams,
): Promise<UploadOrgChartProfilesResult> => {
  const {
    baseUrl,
    accessToken,
    items,
    jobId,
    jobName,
    recruiterId,
    queueStartChatAfter,
    orgChartSelectedNodes,
  } = params;
  if (items.length === 0) {
    return { ok: false, message: 'No candidates to upload' };
  }
  const candidatesPayload = items.map(toLinkedInPremiumCandidate);
  const body: Record<string, unknown> = {
    candidates: candidatesPayload,
    data_source: 'linkedin_premium',
    job_id: jobId,
    job_name: jobName,
    recruiterId,
    job: {
      id: jobId,
      name: jobName,
      recruiterId,
    },
    queue_start_chat_after: queueStartChatAfter,
  };
  if (orgChartSelectedNodes?.std_function ?? orgChartSelectedNodes?.std_grade) {
    body.org_chart_selected_nodes = {
      ...(orgChartSelectedNodes.std_function && {
        std_function: orgChartSelectedNodes.std_function,
      }),
      ...(orgChartSelectedNodes.std_grade && {
        std_grade: orgChartSelectedNodes.std_grade,
      }),
    };
  }
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/candidate-sourcing/upload-profiles`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
  );
  const result = (await response.json()) as {
    status?: string;
    message?: string;
    error?: string;
  };
  if (result.status === 'ok' || result.status === 'success') {
    return { ok: true };
  }
  return {
    ok: false,
    message: result.message || result.error || 'Upload failed',
  };
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export type PollCandidateOnJobParams = {
  baseUrl: string;
  accessToken: string;
  linkedinUrl: string;
  jobId: string;
  maxAttempts?: number;
  delayMs?: number;
};

/**
 * Poll GET /candidate-sourcing/candidates/by-linkedin-urls until candidate exists on job.
 */
export const pollCandidateIdOnJob = async (
  params: PollCandidateOnJobParams,
): Promise<string | null> => {
  const {
    baseUrl,
    accessToken,
    linkedinUrl,
    jobId,
    maxAttempts = 30,
    delayMs = 1000,
  } = params;
  const root = baseUrl.replace(/\/$/, '');
  const encoded = encodeURIComponent(linkedinUrl);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const url = `${root}/candidate-sourcing/candidates/by-linkedin-urls?linkedinUrls=${encoded}&jobId=${encodeURIComponent(jobId)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Avoid 304 + cached bodies that omit or mismatch `results` while polling after upload.
      cache: 'no-store',
    });
    const json = (await response.json()) as {
      results?: Record<
        string,
        { saved?: boolean; candidateIds?: string[] }
      >;
    };
    const row = json.results?.[linkedinUrl];
    if (row?.saved && row.candidateIds?.[0]) {
      return row.candidateIds[0];
    }
    await sleep(delayMs);
  }
  return null;
};

export const contextResultItemFromNodePersonSlot = (
  node: OrgChartNodeData,
  personSlot: number,
  companyName?: string,
): ContextResultItem | null => {
  const i = Math.min(Math.max(personSlot, 0), 3);
  const nameKey = `name_${i}` as keyof OrgChartNodeData;
  const name = node[nameKey];
  if (typeof name !== 'string' || !name.trim()) {
    return null;
  }
  const titleKey = `title_${i}` as keyof OrgChartNodeData;
  const linkedinKey = `linkedin_url_${i}` as keyof OrgChartNodeData;
  const emailKey = `email_${i}` as keyof OrgChartNodeData;
  const phoneKey = `phone_${i}` as keyof OrgChartNodeData;
  const imageKey = `image_${i}` as keyof OrgChartNodeData;
  const rawLi =
    typeof node[linkedinKey] === 'string' ? node[linkedinKey] : '';
  const linkedinUrl = isValidLinkedInProfileUrl(rawLi)
    ? (rawLi as string).trim()
    : undefined;
  const emailRaw = node[emailKey];
  const phoneRaw = node[phoneKey];
  const image = node[imageKey];
  const tenureKey = `org_chart_company_tenure_${i}` as keyof OrgChartNodeData;
  const tenureRaw = node[tenureKey];
  const tenureAtCompany =
    tenureRaw === 'current' || tenureRaw === 'past' ? tenureRaw : undefined;
  return {
    id: `${node.key}-${i}`,
    fullName: name.trim(),
    headline: (typeof node[titleKey] === 'string' ? node[titleKey] : '') as string,
    company: companyName ?? '',
    linkedinUrl,
    email:
      typeof emailRaw === 'string' && emailRaw.trim()
        ? emailRaw.trim()
        : undefined,
    phone:
      typeof phoneRaw === 'string' && phoneRaw.trim()
        ? phoneRaw.trim()
        : undefined,
    raw: {
      ...(typeof image === 'string'
        ? { image, profile_picture_url: image }
        : {}),
      ...(tenureAtCompany
        ? { org_chart_company_tenure: tenureAtCompany }
        : {}),
    },
  };
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
      : contextModalMode === 'entire_company'
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
