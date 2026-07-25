import { isValidLinkedInProfileUrl, toTitleCase, type OrgChartNodeData } from 'twenty-shared/utils';

import { ContextResultItem } from '../types';

const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const readOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
};

/** Compact degree label for UI (e.g. DISTANCE_2 → "2°"). */
export const formatNetworkDistanceDegree = (
  raw: string | null | undefined,
): string | null => {
  if (!raw) {
    return null;
  }
  const upper = raw.toUpperCase();
  if (upper === 'SELF' || upper.includes('1') || upper === 'FIRST_DEGREE') {
    return '1°';
  }
  if (upper.includes('2') || upper === 'SECOND_DEGREE') {
    return '2°';
  }
  if (upper.includes('3') || upper === 'THIRD_DEGREE') {
    return '3°';
  }
  if (upper.includes('OUT')) {
    return 'Out of network';
  }
  if (upper === 'UNKNOWN') {
    return null;
  }
  return (
    raw.replace(/^DISTANCE_/i, '') + (raw.includes('DISTANCE_') ? '°' : '')
  );
};

const extractPromotedProfileFields = (
  raw: Record<string, unknown>,
): Pick<
  ContextResultItem,
  | 'networkDistance'
  | 'sharedConnectionsCount'
  | 'premium'
  | 'verified'
  | 'openProfile'
  | 'followersCount'
  | 'connectionsCount'
  | 'locationName'
  | 'locationCountry'
  | 'locationRegion'
> => {
  const linkedinSpecific =
    raw.linkedinSpecificData && typeof raw.linkedinSpecificData === 'object'
      ? (raw.linkedinSpecificData as Record<string, unknown>)
      : undefined;

  const networkDistance =
    readOptionalString(raw.networkDistance) ??
    readOptionalString(raw.network_distance) ??
    readOptionalString(linkedinSpecific?.networkDistance);

  const locationName =
    readOptionalString(raw.location_name) ??
    readOptionalString(raw.locationName) ??
    (typeof raw.location === 'string'
      ? readOptionalString(raw.location)
      : undefined);

  return {
    networkDistance:
      networkDistance && networkDistance !== 'UNKNOWN'
        ? networkDistance
        : undefined,
    sharedConnectionsCount: readOptionalNumber(
      raw.sharedConnectionsCount ?? raw.shared_connections_count,
    ),
    premium: readOptionalBoolean(raw.premium),
    verified: readOptionalBoolean(raw.verified),
    openProfile: readOptionalBoolean(
      raw.openProfile ?? raw.open_profile ?? linkedinSpecific?.isOpenProfile,
    ),
    followersCount: readOptionalNumber(
      raw.followersCount ?? raw.followers_count,
    ),
    connectionsCount: readOptionalNumber(
      raw.connectionsCount ?? raw.connections_count,
    ),
    locationName,
    locationCountry:
      readOptionalString(raw.location_country) ??
      readOptionalString(raw.locationCountry) ??
      readOptionalString(raw.country),
    locationRegion:
      readOptionalString(raw.location_region) ??
      readOptionalString(raw.locationRegion),
  };
};

/**
 * Extract a bare domain (e.g. "litify.com") from a website URL/string.
 *
 * Mirrors {@link OrgChartCompanyInfo}'s display helper so the value rendered in
 * the company header and the value sent to the server (`companyDomain` on
 * `/org-chart/search`) always match.
 *
 * Returns undefined when the input cannot be parsed into a hostname.
 */
/** First-letter fallback when `/org-chart/company-logo` returns 404. */
export const getCompanyLogoAbbreviation = (
  website?: string,
  companyName?: string,
): string => {
  if (website?.trim()) {
    const domain = website.replace(/^https?:\/\//, '').split('.')[0];
    const letter = domain?.[0];
    return letter
      ? letter.toUpperCase()
      : (companyName?.charAt(0)?.toUpperCase() ?? '?');
  }
  return companyName?.charAt(0)?.toUpperCase() ?? '?';
};

export const extractCompanyDomainFromWebsite = (
  site?: string | null,
): string | undefined => {
  if (!site?.trim()) return undefined;
  try {
    const withProtocol = site.startsWith('http') ? site : `https://${site}`;
    const { hostname } = new URL(withProtocol);
    const bare = hostname
      .replace(/^www\./u, '')
      .trim()
      .toLowerCase();
    return bare.length > 0 ? bare : undefined;
  } catch {
    const trimmed = site.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : undefined;
  }
};

export type OrgChartSavedCompanyMetadata = {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
};

const pickTrimmedStringField = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined => {
  const value = record?.[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
};

/** Company fields persisted on org chart payloads (S3 / GET /org-chart/:companyId). */
export const extractOrgChartSavedCompanyMetadata = (
  orgData: Record<string, unknown> | null | undefined,
): OrgChartSavedCompanyMetadata => ({
  companyName: pickTrimmedStringField(orgData, 'job_company_name'),
  website:
    pickTrimmedStringField(orgData, 'job_company_website') ??
    pickTrimmedStringField(orgData, 'company_website'),
  linkedinUrl: pickTrimmedStringField(orgData, 'job_company_linkedin_url'),
});

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
    ...extractPromotedProfileFields(raw),
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
  projectId: string;
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
    projectId,
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
    job_id: projectId,
    job_name: jobName,
    recruiterId,
    job: {
      id: projectId,
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
  projectId: string;
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
    projectId,
    maxAttempts = 30,
    delayMs = 1000,
  } = params;
  const root = baseUrl.replace(/\/$/, '');
  const encoded = encodeURIComponent(linkedinUrl);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const url = `${root}/candidate-sourcing/candidates/by-linkedin-urls?linkedinUrls=${encoded}&projectId=${encodeURIComponent(projectId)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Avoid 304 + cached bodies that omit or mismatch `results` while polling after upload.
      cache: 'no-store',
    });
    const json = (await response.json()) as {
      results?: Record<string, { saved?: boolean; candidateIds?: string[] }>;
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
  const rawLi = typeof node[linkedinKey] === 'string' ? node[linkedinKey] : '';
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

  const allCandidates = (node as Record<string, unknown>).allCandidates;
  const slotCandidate =
    Array.isArray(allCandidates) &&
    allCandidates[i] &&
    typeof allCandidates[i] === 'object'
      ? (allCandidates[i] as Record<string, unknown>)
      : undefined;
  const profileFields = extractPromotedProfileFields(slotCandidate ?? {});

  return {
    id: `${node.key}-${i}`,
    fullName: name.trim(),
    headline: (typeof node[titleKey] === 'string'
      ? node[titleKey]
      : '') as string,
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
    ...profileFields,
    raw: {
      ...(slotCandidate ?? {}),
      ...(typeof image === 'string'
        ? { image, profile_picture_url: image }
        : {}),
      ...(tenureAtCompany ? { org_chart_company_tenure: tenureAtCompany } : {}),
    },
  };
};

export const toLinkedInPremiumCandidate = (
  item: ContextResultItem,
): Record<string, unknown> => {
  const raw = item.raw ?? {};
  const linkedinUrl = item.linkedinUrl ?? '';
  const publicIdentifier = linkedinUrl
    ? linkedinUrl
        .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
        .split('/')[0]
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

export type OrgChartDrawerCandidateSeed = {
  id: string;
  name: string;
  fullName: string;
  headline: string;
  jobTitle: string;
  company: string;
  linkedin?: string;
  linkedinUrl?: { primaryLinkUrl: string };
  email?: { primaryEmail: string };
  phone?: string;
  networkDistance?: string;
  sharedConnectionsCount?: number;
  otherFields?: Record<string, unknown>;
};

type DrawerExperienceEntry = {
  title: { name: string };
  company: { name: string; location?: { locality?: string } };
  start_date: string | null;
  end_date: string | null;
};

const readExperienceTitle = (exp: Record<string, unknown>): string => {
  const title = exp.title;
  if (typeof title === 'string' && title.trim().length > 0) {
    return title.trim();
  }
  if (
    title !== null &&
    title !== undefined &&
    typeof title === 'object' &&
    'name' in title
  ) {
    const name = (title as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim();
    }
  }
  const position = exp.position ?? exp.role ?? exp.job_title;
  return typeof position === 'string' ? position.trim() : '';
};

const readExperienceCompany = (exp: Record<string, unknown>): string => {
  const company =
    exp.company ?? exp.companyName ?? exp.company_name ?? exp.organization;
  if (typeof company === 'string' && company.trim().length > 0) {
    return company.trim();
  }
  if (
    company !== null &&
    company !== undefined &&
    typeof company === 'object' &&
    'name' in company
  ) {
    const name = (company as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim();
    }
  }
  return '';
};

const formatExperienceDate = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'object' && value !== null && 'year' in value) {
    const year = (value as { year?: unknown; month?: unknown }).year;
    const month = (value as { year?: unknown; month?: unknown }).month;
    if (typeof year === 'number' && Number.isFinite(year)) {
      const monthNum =
        typeof month === 'number' && Number.isFinite(month) ? month : 1;
      return `${year}-${String(monthNum).padStart(2, '0')}-01`;
    }
  }
  return null;
};

const mapRawExperienceToDrawerShape = (
  raw: Record<string, unknown>,
): DrawerExperienceEntry[] => {
  const sources = [
    raw.experience,
    raw.work_experience,
    raw.workExperience,
    raw.positions,
  ];
  for (const source of sources) {
    if (Array.isArray(source) === false || source.length === 0) {
      continue;
    }
    const mapped = source
      .filter(
        (entry): entry is Record<string, unknown> =>
          entry !== null && entry !== undefined && typeof entry === 'object',
      )
      .map((exp) => {
        const startDate =
          formatExperienceDate(exp.start_date) ??
          formatExperienceDate(exp.startDate) ??
          formatExperienceDate(exp.start);
        const endDate =
          formatExperienceDate(exp.end_date) ??
          formatExperienceDate(exp.endDate) ??
          formatExperienceDate(exp.end);
        const locality =
          typeof exp.location === 'string'
            ? exp.location
            : readOptionalString(
                (
                  exp.company as
                    | { location?: { locality?: unknown } }
                    | undefined
                )?.location?.locality,
              );
        return {
          title: { name: readExperienceTitle(exp) },
          company: {
            name: readExperienceCompany(exp),
            ...(locality !== undefined && locality.length > 0
              ? { location: { locality } }
              : {}),
          },
          start_date: startDate,
          end_date: endDate,
        };
      })
      .filter(
        (exp) => exp.title.name.length > 0 || exp.company.name.length > 0,
      );
    if (mapped.length > 0) {
      return mapped;
    }
  }
  return [];
};

/**
 * Maps an org-chart result row into a searchResults-shaped seed for CandidateChatDrawer.
 * Experience is included only when present on `item.raw`.
 */
export const contextResultItemToDrawerCandidate = (
  item: ContextResultItem,
  contactInfo?: { email?: string; phone?: string },
): OrgChartDrawerCandidateSeed => {
  const linkedinUrl = item.linkedinUrl?.trim() ?? '';
  const publicIdentifier = linkedinUrl
    ? linkedinUrl
        .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
        .split('/')[0]
        ?.split('?')[0]
    : '';
  const id =
    publicIdentifier !== undefined && publicIdentifier.length > 0
      ? publicIdentifier
      : `orgchart-${item.id}`;

  const email = contactInfo?.email?.trim() || item.email?.trim() || undefined;
  const phone = contactInfo?.phone?.trim() || item.phone?.trim() || undefined;

  const experience = mapRawExperienceToDrawerShape(item.raw ?? {});
  const locationParts = [
    item.locationName,
    item.locationRegion,
    item.locationCountry,
  ].filter((part): part is string => Boolean(part?.trim()));

  const otherFields: Record<string, unknown> = {
    ...(experience.length > 0 ? { experience } : {}),
    ...(item.locationName !== undefined && item.locationName.length > 0
      ? { location_name: item.locationName }
      : {}),
    ...(locationParts.length > 0 ? { location: locationParts.join(', ') } : {}),
    ...(item.headline.length > 0 ? { linkedin_headline: item.headline } : {}),
    ...(item.company.length > 0 ? { job_company_name: item.company } : {}),
  };

  return {
    id,
    name: item.fullName,
    fullName: item.fullName,
    headline: item.headline,
    jobTitle: item.headline,
    company: item.company,
    ...(linkedinUrl.length > 0
      ? {
          linkedin: linkedinUrl,
          linkedinUrl: { primaryLinkUrl: linkedinUrl },
        }
      : {}),
    ...(email !== undefined && email.length > 0
      ? { email: { primaryEmail: email } }
      : {}),
    ...(phone !== undefined && phone.length > 0 ? { phone } : {}),
    ...(item.networkDistance !== undefined && item.networkDistance.length > 0
      ? { networkDistance: item.networkDistance }
      : {}),
    ...(typeof item.sharedConnectionsCount === 'number'
      ? { sharedConnectionsCount: item.sharedConnectionsCount }
      : {}),
    ...(Object.keys(otherFields).length > 0 ? { otherFields } : {}),
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
          : contextModalMode === 'current_node' ||
              contextModalMode === 'selected_nodes'
            ? 'Selected positions'
            : 'Org chart';
  return `${companyName || 'Company'} – ${label}`;
};

const escapeCsvValue = (value: string): string =>
  `"${String(value).replace(/"/g, '""')}"`;

const CONTEXT_RESULT_CSV_COLUMNS: {
  key: keyof ContextResultItem;
  header: string;
}[] = [
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
