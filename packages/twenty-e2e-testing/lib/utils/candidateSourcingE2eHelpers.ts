import { expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import * as XLSX from 'xlsx';

import { DataProcessingUtils } from '../../../twenty-server/src/engine/core-modules/candidate-sourcing/utils/data-processing.utils';

export type CandidateNode = {
  id: string;
  name?: string | null;
  jobsId?: string | null;
  peopleId?: string | null;
  uniqueStringKey?: string | null;
  source?: string | null;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  phoneNumber?: { primaryPhoneNumber?: string | null } | null;
  email?: { primaryEmail?: string | null } | null;
  hiringNaukriUrl?: { primaryLinkUrl?: string | null } | null;
  resdexNaukriUrl?: { primaryLinkUrl?: string | null } | null;
  linkedinUrl?: { primaryLinkUrl?: string | null } | null;
  jobs?: Array<{ id?: string | null; name?: string | null }> | null;
  candidateFieldValues?: {
    edges?: Array<{
      node?: {
        id?: string;
        name?: string | null;
        candidateFields?: { id?: string; name?: string | null } | null;
      } | null;
    }>;
  } | null;
};

export type PersonNode = {
  id: string;
  uniqueStringKey?: string | null;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  jobTitle?: string | null;
};

type ExistingLookup = {
  byUniqueStringKey: Map<string, CandidateNode>;
  byEmail: Map<string, CandidateNode>;
  byPhone: Map<string, CandidateNode>;
  byHiringUrl: Map<string, CandidateNode>;
  byResdexUrl: Map<string, CandidateNode>;
  byLinkedinUrl: Map<string, CandidateNode>;
};

export type AiFilteringSseSnapshot = {
  urls: string[];
  messages: Array<{
    raw: string;
    parsed: Record<string, unknown> | null;
  }>;
  openCount: number;
  errorCount: number;
};

export type CandidateUploadDataSource =
  | 'hiring_naukri'
  | 'spreadsheet_import';

const graphqlPeopleByIdsQuery = `
  query FindManyPeople($filter: PersonFilterInput, $orderBy: [PersonOrderByInput], $lastCursor: String, $limit: Int) {
    people(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          uniqueStringKey
          name {
            firstName
            lastName
          }
          phones {
            primaryPhoneNumber
          }
          emails {
            primaryEmail
          }
          jobTitle
        }
      }
    }
  }
`;

const dataProcessingUtils = new DataProcessingUtils();

export const hiringPayloadPath =
  '/Users/arnavsaxena/Downloads/payload - hiring.txt';
export const mergedWorkbookPath =
  '/Users/arnavsaxena/MEGA/arx/arxena-site/working_naukri_candidates/FintechandInsurance/results/downloadable_all_naukri_merged.xlsx';
export const headOfCorporateWorkbookPath =
  '/Users/arnavsaxena/Downloads/Head-of-Corporate-St_20250716171258_160.xlsx';

export const logCandidateSourcingStep = (
  message: string,
  details?: Record<string, unknown>,
) => {
  if (details && Object.keys(details).length > 0) {
    console.log(`[candidate-sourcing-e2e] ${message}`, details);
    return;
  }

  console.log(`[candidate-sourcing-e2e] ${message}`);
};

export const loadJsonFile = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

export const loadWorkbookRows = (filePath: string): Record<string, unknown>[] => {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
};

const normalizeUrl = (value: string | null | undefined): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(
      trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
    );
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, '')}${url.search}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/\/$/, '');
  }
};

const normalizeLinkedinUrl = (value: string | null | undefined): string =>
  normalizeUrl(value).replace(/^www\./, '');

const getHiringUrlFromRow = (row: Record<string, unknown>): string => {
  const applicationId =
    typeof row.applicationId === 'string' ? row.applicationId : '';
  const jobTrackingId =
    typeof (row.callTrackingParams as Record<string, unknown> | undefined)
      ?.jobId === 'string'
      ? ((row.callTrackingParams as Record<string, unknown>).jobId as string)
      : '';

  if (!applicationId || !jobTrackingId) {
    return '';
  }

  return normalizeUrl(
    `https://hiring.naukri.com/hiring/${jobTrackingId}/apply/${applicationId}`,
  );
};

const getResdexUrlFromRow = (row: Record<string, unknown>): string => {
  const raw =
    typeof row.profileUrl === 'string'
      ? row.profileUrl
      : typeof row.resdexNaukriUrl === 'string'
        ? row.resdexNaukriUrl
        : '';
  return normalizeUrl(raw);
};

const getLinkedinUrlFromRow = (row: Record<string, unknown>): string => {
  const raw =
    typeof row.linkedinUrl === 'string'
      ? row.linkedinUrl
      : typeof row.linkedin_url === 'string'
        ? (row.linkedin_url as string)
        : '';
  return normalizeLinkedinUrl(raw);
};

const getEmailFromRow = (row: Record<string, unknown>): string => {
  return (
    dataProcessingUtils.cleanEmailAddresses(
      row['Email ID'] ||
        row.Email ||
        row['Email (emails)'] ||
        row['Email (email)'] ||
        row.email ||
        row.email_address ||
        row.emailAddress ||
        '',
    )[0] || ''
  );
};

const getPhoneFromRow = (row: Record<string, unknown>): string => {
  return (
    dataProcessingUtils.cleanPhoneNumbers(
      row['Phone Number'] ||
        row['Phone number (phones)'] ||
        row['Phone number (phoneNumber)'] ||
        row.phoneNumber ||
        row.phone_number ||
        row.mobile_phone ||
        row.phone ||
        '',
    )[0] || ''
  );
};

const getUniqueStringKeyFromRow = (
  row: Record<string, unknown>,
  dataSource: CandidateUploadDataSource,
): string => dataProcessingUtils.generateUniqueStringKey(row, dataSource);

const getRowIdentityKey = (
  row: Record<string, unknown>,
  dataSource: CandidateUploadDataSource,
  rowIndex: number,
): string => {
  const hiringUrl = getHiringUrlFromRow(row);
  if (hiringUrl) return `hiring:${hiringUrl}`;

  const resdexUrl = getResdexUrlFromRow(row);
  if (resdexUrl) return `resdex:${resdexUrl}`;

  const linkedinUrl = getLinkedinUrlFromRow(row);
  if (linkedinUrl) return `linkedin:${linkedinUrl}`;

  const phone = getPhoneFromRow(row);
  if (phone) return `phone:${phone}`;

  const email = getEmailFromRow(row);
  if (email) return `email:${email}`;

  const uniqueStringKey = getUniqueStringKeyFromRow(row, dataSource);
  if (uniqueStringKey) return `usk:${uniqueStringKey}`;

  return `raw:${rowIndex}`;
};

const deduplicateRows = (
  rows: Record<string, unknown>[],
  dataSource: CandidateUploadDataSource,
) => {
  const map = new Map<string, Record<string, unknown>>();
  rows.forEach((row, index) => {
    map.set(getRowIdentityKey(row, dataSource, index), row);
  });
  return [...map.values()];
};

export const buildExistingLookup = (
  candidates: CandidateNode[],
): ExistingLookup => {
  const byUniqueStringKey = new Map<string, CandidateNode>();
  const byEmail = new Map<string, CandidateNode>();
  const byPhone = new Map<string, CandidateNode>();
  const byHiringUrl = new Map<string, CandidateNode>();
  const byResdexUrl = new Map<string, CandidateNode>();
  const byLinkedinUrl = new Map<string, CandidateNode>();

  for (const candidate of candidates) {
    if (candidate.uniqueStringKey?.trim()) {
      byUniqueStringKey.set(candidate.uniqueStringKey.trim(), candidate);
    }

    const emailValue = dataProcessingUtils
      .cleanEmailAddresses(candidate.email?.primaryEmail || '')
      .at(0);
    if (emailValue) {
      byEmail.set(emailValue, candidate);
    }

    const phoneValue = dataProcessingUtils
      .cleanPhoneNumbers(candidate.phoneNumber?.primaryPhoneNumber || '')
      .at(0);
    if (phoneValue) {
      byPhone.set(phoneValue, candidate);
    }

    const hiringUrl = normalizeUrl(candidate.hiringNaukriUrl?.primaryLinkUrl);
    if (hiringUrl) {
      byHiringUrl.set(hiringUrl, candidate);
    }

    const resdexUrl = normalizeUrl(candidate.resdexNaukriUrl?.primaryLinkUrl);
    if (resdexUrl) {
      byResdexUrl.set(resdexUrl, candidate);
    }

    const linkedinUrl = normalizeLinkedinUrl(
      candidate.linkedinUrl?.primaryLinkUrl,
    );
    if (linkedinUrl) {
      byLinkedinUrl.set(linkedinUrl, candidate);
    }
  }

  return {
    byUniqueStringKey,
    byEmail,
    byPhone,
    byHiringUrl,
    byResdexUrl,
    byLinkedinUrl,
  };
};

export const findMatchingCandidate = (
  lookup: ExistingLookup,
  row: Record<string, unknown>,
  dataSource: CandidateUploadDataSource,
): CandidateNode | undefined => {
  const hiringUrl = getHiringUrlFromRow(row);
  if (hiringUrl) {
    const candidate = lookup.byHiringUrl.get(hiringUrl);
    if (candidate) return candidate;
  }

  const resdexUrl = getResdexUrlFromRow(row);
  if (resdexUrl) {
    const candidate = lookup.byResdexUrl.get(resdexUrl);
    if (candidate) return candidate;
  }

  const linkedinUrl = getLinkedinUrlFromRow(row);
  if (linkedinUrl) {
    const candidate = lookup.byLinkedinUrl.get(linkedinUrl);
    if (candidate) return candidate;
  }

  const phone = getPhoneFromRow(row);
  if (phone) {
    const candidate = lookup.byPhone.get(phone);
    if (candidate) return candidate;
  }

  const email = getEmailFromRow(row);
  if (email) {
    const candidate = lookup.byEmail.get(email);
    if (candidate) return candidate;
  }

  const uniqueStringKey = getUniqueStringKeyFromRow(row, dataSource);
  if (uniqueStringKey) {
    return lookup.byUniqueStringKey.get(uniqueStringKey);
  }

  return undefined;
};

export const computeExpectedNewRows = (
  existingCandidates: CandidateNode[],
  rawRows: Record<string, unknown>[],
  dataSource: CandidateUploadDataSource,
) => {
  const lookup = buildExistingLookup(existingCandidates);
  const deduplicatedRows = deduplicateRows(rawRows, dataSource);
  return deduplicatedRows.filter(
    (row) => !findMatchingCandidate(lookup, row, dataSource),
  );
};

export const getCandidatesByJobId = async (
  authToken: string,
  input: {
    apiBaseUrl: string;
    jobId: string;
  },
): Promise<CandidateNode[]> => {
  const response = await fetch(
    `${input.apiBaseUrl}/candidate-sourcing/get-candidates-by-job-id`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ jobId: input.jobId }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch candidates for job ${input.jobId}: ${response.status}`,
    );
  }

  return (await response.json()) as CandidateNode[];
};

const getPeopleByIds = async (
  authToken: string,
  apiBaseUrl: string,
  personIds: string[],
) => {
  const people = new Map<string, PersonNode>();

  for (let index = 0; index < personIds.length; index += 200) {
    const chunk = personIds.slice(index, index + 200);
    if (chunk.length === 0) continue;

    const response = await fetch(`${apiBaseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        query: graphqlPeopleByIdsQuery,
        variables: {
          filter: { id: { in: chunk } },
          limit: chunk.length,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch people: ${response.status}`);
    }

    const payload = (await response.json()) as {
      errors?: Array<{ message?: string }>;
      data?: {
        people?: {
          edges?: Array<{ node?: PersonNode | null }>;
        };
      };
    };

    if (payload.errors?.length) {
      throw new Error(
        `GraphQL people query failed: ${payload.errors.map((error) => error.message).join(', ')}`,
      );
    }

    const nodes =
      payload.data?.people?.edges
        ?.map((edge) => edge.node)
        .filter((node): node is PersonNode => Boolean(node?.id)) || [];

    nodes.forEach((node) => people.set(node.id, node));
  }

  return people;
};

export const getPeopleForCandidates = async (
  authToken: string,
  apiBaseUrl: string,
  candidates: CandidateNode[],
) => {
  const personIds = [
    ...new Set(candidates.map((candidate) => candidate.peopleId).filter(Boolean)),
  ] as string[];
  return getPeopleByIds(authToken, apiBaseUrl, personIds);
};

export const uploadHiringPayload = async (
  authToken: string,
  input: {
    apiBaseUrl: string;
    appBaseUrl: string;
    jobId: string;
    sourcePayload: Record<string, any>;
  },
) => {
  const payload = JSON.parse(JSON.stringify(input.sourcePayload)) as Record<
    string,
    any
  >;
  payload.auth_token = authToken;
  payload.popup_data = {
    ...(payload.popup_data || {}),
    job_id: input.jobId,
  };

  const response = await fetch(
    `${input.apiBaseUrl}/candidate-sourcing/upload-profiles`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        Origin: input.appBaseUrl,
        'x-origin-domain': input.appBaseUrl,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Hiring upload failed with status ${response.status}`);
  }

  return (await response.json()) as Record<string, unknown>;
};

type WorkerQueueHealthSnapshot = {
  name: string;
  workers: number;
  metrics?: {
    failed?: number;
    completed?: number;
    waiting?: number;
    active?: number;
    delayed?: number;
    prioritized?: number;
  };
};

export const assertCandidateQueueWorkerAvailable = async (
  apiBaseUrl: string,
) => {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/healthz/worker`);
  const rawBody = await response.text();
  const payload = rawBody ? JSON.parse(rawBody) : null;
  const queues =
    ((payload as { info?: { worker?: { queues?: WorkerQueueHealthSnapshot[] } } })
      ?.info?.worker?.queues ?? []) as WorkerQueueHealthSnapshot[];
  const candidateQueue = queues.find((queue) => queue.name === 'candidate-queue');

  expect(response.ok, `Worker health endpoint failed: ${response.status} ${rawBody}`).toBeTruthy();
  expect(candidateQueue, `Candidate queue missing from worker health payload: ${rawBody}`).toBeTruthy();
  expect(
    candidateQueue?.workers ?? 0,
    `Candidate queue has no active workers: ${rawBody}`,
  ).toBeGreaterThan(0);

  return {
    status: response.status,
    queues,
    candidateQueue: candidateQueue as WorkerQueueHealthSnapshot,
  };
};

type CandidateQueueRedisSnapshot = {
  available: boolean;
  matchingKeys: string[];
  prioritizedMatches: string[];
  waitingMatches: string[];
  activeMatches: string[];
  completedMatches: string[];
  failedMatches: string[];
  hasQueuedJob: boolean;
};

const runRedisCliLines = (args: string[]) => {
  const output = execFileSync('redis-cli', ['--raw', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

  if (!output) {
    return [] as string[];
  }

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

export const getCandidateQueueRedisSnapshot = (
  jobId: string,
): CandidateQueueRedisSnapshot => {
  try {
    const matchingKeys = runRedisCliLines([
      'keys',
      `bull:candidate-queue:${jobId}-*`,
    ]);
    const prioritizedMatches = runRedisCliLines([
      'zrange',
      'bull:candidate-queue:prioritized',
      '0',
      '-1',
    ]).filter((entry) => entry.includes(jobId));
    const waitingMatches = runRedisCliLines([
      'lrange',
      'bull:candidate-queue:wait',
      '0',
      '-1',
    ]).filter((entry) => entry.includes(jobId));
    const activeMatches = runRedisCliLines([
      'lrange',
      'bull:candidate-queue:active',
      '0',
      '-1',
    ]).filter((entry) => entry.includes(jobId));
    const completedMatches = runRedisCliLines([
      'zrange',
      'bull:candidate-queue:completed',
      '0',
      '-1',
    ]).filter((entry) => entry.includes(jobId));
    const failedMatches = runRedisCliLines([
      'zrange',
      'bull:candidate-queue:failed',
      '0',
      '-1',
    ]).filter((entry) => entry.includes(jobId));

    return {
      available: true,
      matchingKeys,
      prioritizedMatches,
      waitingMatches,
      activeMatches,
      completedMatches,
      failedMatches,
      hasQueuedJob:
        matchingKeys.length > 0 ||
        prioritizedMatches.length > 0 ||
        waitingMatches.length > 0 ||
        activeMatches.length > 0 ||
        completedMatches.length > 0 ||
        failedMatches.length > 0,
    };
  } catch {
    return {
      available: false,
      matchingKeys: [],
      prioritizedMatches: [],
      waitingMatches: [],
      activeMatches: [],
      completedMatches: [],
      failedMatches: [],
      hasQueuedJob: false,
    };
  }
};

export const waitForCandidateJobQueuedInRedis = async (input: {
  jobId: string;
  timeoutMs?: number;
}) => {
  const timeoutMs = input.timeoutMs ?? 20_000;
  const startedAt = Date.now();
  let lastSnapshot = getCandidateQueueRedisSnapshot(input.jobId);

  expect(lastSnapshot.available, 'redis-cli is required for local candidate queue checks').toBeTruthy();

  while (Date.now() - startedAt < timeoutMs) {
    lastSnapshot = getCandidateQueueRedisSnapshot(input.jobId);

    if (lastSnapshot.hasQueuedJob) {
      return lastSnapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(
    `Timed out waiting for job ${input.jobId} to appear in Redis candidate queue: ${JSON.stringify(
      lastSnapshot,
    )}`,
  );
};

export const waitForCandidateCount = async (
  authToken: string,
  input: {
    apiBaseUrl: string;
    jobId: string;
    expectedCount: number;
  },
) => {
  await expect
    .poll(
      async () => {
        const candidates = await getCandidatesByJobId(authToken, {
          apiBaseUrl: input.apiBaseUrl,
          jobId: input.jobId,
        });
        return candidates.length;
      },
      {
        timeout: 240_000,
        intervals: [1_000, 2_000, 5_000],
      },
    )
    .toBe(input.expectedCount);
};

export const waitForJobPageReady = async (page: Page) => {
  await expect
    .poll(
      async () => {
        const searchCandidates = await page
          .getByPlaceholder(/Search candidates/i)
          .first()
          .isVisible()
          .catch(() => false);
        const noCandidates = await page
          .getByText(/No candidates found/i)
          .first()
          .isVisible()
          .catch(() => false);
        const importButton = await page
          .getByRole('button', { name: /Import candidates/i })
          .first()
          .isVisible()
          .catch(() => false);

        return searchCandidates || noCandidates || importButton;
      },
      { timeout: 90_000, intervals: [500, 1_000, 2_000] },
    )
    .toBeTruthy();
};

const openImportDialog = async (page: Page) => {
  const uploadModalTitle = page
    .getByText(
      /Upload \.xlsx, \.xls, \.csv, \.json, \.pdf, \.docx or \.doc files/i,
    )
    .first();

  const waitForImportModal = async () => {
    await expect(uploadModalTitle).toBeVisible({ timeout: 10_000 });
  };

  const candidates = [
    page.getByRole('button', { name: /Import candidates/i }).first(),
    page.getByLabel(/Import candidates/i).first(),
    page.locator('button[aria-label="Import candidates"]').first(),
    page.getByTitle(/Import Candidates/i).first(),
    page.locator('button[title="Import Candidates"]').first(),
  ];

  for (const locator of candidates) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ force: true });
      try {
        await waitForImportModal();
        return;
      } catch {
        // Keep trying other import triggers if the modal did not open.
      }
    }
  }

  const iconButtons = page.locator('button:has(svg)');
  const tooltipLocator = page.getByText(/Import Candidates/i).first();
  const iconCount = await iconButtons.count();

  for (let i = 0; i < Math.min(iconCount, 20); i += 1) {
    const tooltipAnchor = iconButtons
      .nth(i)
      .locator('xpath=ancestor-or-self::*[starts-with(@id,"tooltip-")][1]');

    await tooltipAnchor.hover({ force: true }).catch(() => {});

    try {
      await expect(tooltipLocator).toBeVisible({ timeout: 2_000 });
      await iconButtons.nth(i).click({ force: true });
      await waitForImportModal();
      return;
    } catch {
      // Keep scanning icon buttons until we find the import tooltip.
    }
  }

  throw new Error('Could not find an Import Candidates trigger on the job page');
};

const waitForUploadProgressSnackbars = async (page: Page, label: string) => {
  const startedTitle = /Upload Started/i;
  const startedDetail = /Processing \d+ candidates in \d+ batches/i;
  const processingTitle = /Uploading Candidates/i;
  const processingDetail = /Processing batch \d+\/\d+ - \d+\/\d+ candidates/i;
  const completedTitle = /Upload Completed/i;
  const completedDetail = /Successfully processed \d+ candidates/i;
  const failedTitle = /Upload Failed/i;

  const seen = {
    startedTitle: false,
    startedDetail: false,
    processingTitle: false,
    processingDetail: false,
    completedTitle: false,
    completedDetail: false,
  };
  const processingMessages = new Set<string>();
  const timeoutAt = Date.now() + 240_000;

  while (Date.now() < timeoutAt) {
    const bodyText = await page.locator('body').innerText().catch(() => '');

    if (failedTitle.test(bodyText)) {
      throw new Error(
        `${label}: upload progress snackbar reported "Upload Failed".`,
      );
    }

    if (!seen.startedTitle && startedTitle.test(bodyText)) {
      seen.startedTitle = true;
    }

    if (!seen.startedDetail && startedDetail.test(bodyText)) {
      seen.startedDetail = true;
    }

    if (!seen.processingTitle && processingTitle.test(bodyText)) {
      seen.processingTitle = true;
    }

    const processingMatch = bodyText.match(processingDetail);
    if (processingMatch) {
      seen.processingDetail = true;
      processingMessages.add(processingMatch[0]);
    }

    if (!seen.completedTitle && completedTitle.test(bodyText)) {
      seen.completedTitle = true;
    }

    if (!seen.completedDetail && completedDetail.test(bodyText)) {
      seen.completedDetail = true;
    }

    if (
      seen.startedTitle &&
      seen.startedDetail &&
      seen.processingTitle &&
      seen.processingDetail &&
      seen.completedTitle &&
      seen.completedDetail
    ) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(
    `${label}: timed out waiting for upload progress snackbars. Seen states=${JSON.stringify(
      {
        ...seen,
        processingUpdatesSeen: processingMessages.size,
      },
    )}`,
  );
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const phoneHeaderAliases = [
  'Phone Number',
  'Phone number',
  'phoneNumber',
  'phone',
  'contact',
  'Contact',
];

const emailHeaderAliases = [
  'Email ID',
  'Email',
  'email',
  'email id',
  'email address',
  'Email Address',
];

const findVisibleMatchColumnsHeader = async (
  page: Page,
  aliases: string[],
) => {
  for (const alias of aliases) {
    const locator = page.getByText(new RegExp(`^${escapeRegExp(alias)}$`, 'i')).first();
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  return null;
};

const ensureMatchColumnMapping = async (
  page: Page,
  aliases: string[],
  targetFieldLabel: string,
) => {
  const importedHeader = await findVisibleMatchColumnsHeader(page, aliases);
  expect(
    importedHeader,
    `Could not find any imported-data header matching ${aliases.join(', ')}`,
  ).toBeTruthy();

  const targetField = page
    .getByText(new RegExp(`^${escapeRegExp(targetFieldLabel)}$`, 'i'))
    .first();
  if (await targetField.isVisible().catch(() => false)) {
    return;
  }

  const rowContainer = page
    .locator('div')
    .filter({
      has: importedHeader!,
    })
    .filter({
      has: page.getByText(
        /Select column|Do not import|Email \(email\)|Phone number \(phoneNumber\)/i,
      ),
    })
    .first();

  const mappingTrigger = rowContainer
    .getByText(
      /Select column|Do not import|Email \(email\)|Phone number \(phoneNumber\)/i,
    )
    .last();

  await expect(mappingTrigger).toBeVisible({ timeout: 10_000 });
  await mappingTrigger.click({ force: true });

  await page.getByRole('option', { name: targetFieldLabel }).waitFor({
    state: 'visible',
    timeout: 10_000,
  });

  await page.getByRole('option', { name: targetFieldLabel }).click();
  await expect(targetField).toBeVisible({ timeout: 10_000 });
};

export const importSpreadsheetViaStepper = async (
  page: Page,
  input: {
    filePath: string;
    label: string;
    expectedVisibleCandidateNames?: string[];
  },
) => {
  await openImportDialog(page);
  await expect(
    page.getByText(
      /Upload \.xlsx, \.xls, \.csv, \.json, \.pdf, \.docx or \.doc files/i,
    ),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: /Select files/i }).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.locator('input[type="file"]').last().setInputFiles(input.filePath);

  if (
    await page
      .getByText(/Select the sheet to use/i)
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole('button', { name: /^Next Step$/i }).click();
  }

  if (
    await page
      .getByText(/Select header row/i)
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole('button', { name: /^Continue$/i }).click();
  }

  await expect(page.getByText(/Match Columns/i).first()).toBeVisible({
    timeout: 60_000,
  });
  await ensureMatchColumnMapping(
    page,
    phoneHeaderAliases,
    'Phone number (phoneNumber)',
  );
  await ensureMatchColumnMapping(page, emailHeaderAliases, 'Email (email)');
  await page.getByRole('button', { name: /^Next Step$/i }).click();

  if (
    await page
      .getByText(/Not all columns matched/i)
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole('button', { name: /^Continue$/i }).last().click();
  }

  await expect(page.getByText(/Review your import/i).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page
      .getByText(/All \d+ rows are ready for import|\d+ of \d+ rows are ready for import/i)
      .first(),
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(/0 rows have errors/i)).toBeHidden().catch(() => {});
  const uploadProgressPromise = waitForUploadProgressSnackbars(page, input.label);
  await page.getByRole('button', { name: /^Confirm$/i }).click();

  if (
    await page
      .getByText(/Finish flow with errors/i)
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole('button', { name: /^Submit$/i }).last().click();
  }

  await uploadProgressPromise;
  await expect(page.getByText(/Review your import/i))
    .toBeHidden({ timeout: 180_000 })
    .catch(() => {});

  if (input.expectedVisibleCandidateNames?.length) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    const searchCandidatesInput = page
      .getByPlaceholder(/Search candidates/i)
      .first();
    await expect(searchCandidatesInput).toBeVisible({ timeout: 60_000 });

    for (const candidateName of input.expectedVisibleCandidateNames) {
      if (!candidateName.trim()) {
        continue;
      }

      await searchCandidatesInput.fill('');
      await searchCandidatesInput.fill(candidateName);

      const candidateLocator = page
        .getByText(new RegExp(escapeRegExp(candidateName), 'i'))
        .first();
      if (await candidateLocator.isVisible().catch(() => false)) {
        return;
      }

      try {
        await expect(candidateLocator).toBeVisible({ timeout: 10_000 });
        return;
      } catch {
        // Keep trying alternative imported candidate names until one is visible.
      }
    }

    throw new Error(
      `Could not find any imported candidate in the table after searching for: ${input.expectedVisibleCandidateNames.join(', ')}`,
    );
  }
};

export const installAiFilteringSseCapture = async (page: Page) => {
  await page.evaluate(() => {
    const browserWindow = window as typeof window & {
      __aiFilteringSseCaptureInstalled?: boolean;
      __aiFilteringSseUrls?: string[];
      __aiFilteringSseMessages?: string[];
      __aiFilteringSseOpenCount?: number;
      __aiFilteringSseErrorCount?: number;
    };

    if (browserWindow.__aiFilteringSseCaptureInstalled) {
      browserWindow.__aiFilteringSseUrls = [];
      browserWindow.__aiFilteringSseMessages = [];
      browserWindow.__aiFilteringSseOpenCount = 0;
      browserWindow.__aiFilteringSseErrorCount = 0;
      return;
    }

    const NativeEventSource = window.EventSource;

    browserWindow.__aiFilteringSseCaptureInstalled = true;
    browserWindow.__aiFilteringSseUrls = [];
    browserWindow.__aiFilteringSseMessages = [];
    browserWindow.__aiFilteringSseOpenCount = 0;
    browserWindow.__aiFilteringSseErrorCount = 0;

    class TrackingEventSource extends NativeEventSource {
      constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
        super(url, eventSourceInitDict);
        browserWindow.__aiFilteringSseUrls?.push(String(url));
        this.addEventListener('open', () => {
          browserWindow.__aiFilteringSseOpenCount =
            (browserWindow.__aiFilteringSseOpenCount || 0) + 1;
        });
        this.addEventListener('error', () => {
          browserWindow.__aiFilteringSseErrorCount =
            (browserWindow.__aiFilteringSseErrorCount || 0) + 1;
        });
        this.addEventListener('message', (event) => {
          browserWindow.__aiFilteringSseMessages?.push(String(event.data));
        });
      }
    }

    window.EventSource = TrackingEventSource as typeof EventSource;
  });
};

const parseAiFilteringSsePayload = (
  rawMessage: string,
): Record<string, unknown> | null => {
  try {
    const sanitized = rawMessage.startsWith('data: ')
      ? rawMessage.slice('data: '.length)
      : rawMessage;
    return JSON.parse(sanitized) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const readAiFilteringSseSnapshot = async (
  page: Page,
): Promise<AiFilteringSseSnapshot> => {
  const snapshot = await page.evaluate(() => {
    const browserWindow = window as typeof window & {
      __aiFilteringSseUrls?: string[];
      __aiFilteringSseMessages?: string[];
      __aiFilteringSseOpenCount?: number;
      __aiFilteringSseErrorCount?: number;
    };

    return {
      urls: browserWindow.__aiFilteringSseUrls || [],
      rawMessages: browserWindow.__aiFilteringSseMessages || [],
      openCount: browserWindow.__aiFilteringSseOpenCount || 0,
      errorCount: browserWindow.__aiFilteringSseErrorCount || 0,
    };
  });

  return {
    urls: snapshot.urls,
    openCount: snapshot.openCount,
    errorCount: snapshot.errorCount,
    messages: snapshot.rawMessages.map((raw) => ({
      raw,
      parsed: parseAiFilteringSsePayload(raw),
    })),
  };
};

export const waitForAiFilteringSseProgress = async (
  page: Page,
): Promise<AiFilteringSseSnapshot> => {
  await expect
    .poll(
      async () => {
        const snapshot = await readAiFilteringSseSnapshot(page);
        const steps = snapshot.messages
          .map((message) => message.parsed?.step)
          .filter((step): step is string => typeof step === 'string');

        return JSON.stringify({
          hasStreamUrl: snapshot.urls.some((url) =>
            url.includes('/ai-filtering-progress/stream'),
          ),
          hasStarted: steps.includes('started'),
          hasProcessing: steps.includes('processing'),
          hasCompleted: steps.includes('completed'),
        });
      },
      {
        timeout: 180_000,
        intervals: [1_000, 2_000, 5_000],
      },
    )
    .toBe(
      JSON.stringify({
        hasStreamUrl: true,
        hasStarted: true,
        hasProcessing: true,
        hasCompleted: true,
      }),
    );

  return readAiFilteringSseSnapshot(page);
};

export const selectAllVisibleCandidates = async (page: Page) => {
  const headerCheckbox = page
    .locator('.handsontable thead input[type="checkbox"]')
    .first();
  await expect(headerCheckbox).toBeVisible({ timeout: 60_000 });
  await headerCheckbox.click({ force: true });

  await expect
    .poll(
      async () => {
        const headingText = (
          await page.getByRole('heading').first().textContent().catch(() => '')
        )?.trim();
        const match = headingText?.match(/(\d+)\s+selected/i);
        return match ? Number(match[1]) : 0;
      },
      { timeout: 60_000, intervals: [500, 1_000, 2_000] },
    )
    .toBeGreaterThan(0);
};

export const openAiFilteringModal = async (page: Page) => {
  await page.getByRole('button', { name: /AI Filtering/i }).click();
  await expect(page.getByText(/^AI Filtering$/i)).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole('button', { name: /Process AI Filter/i }),
  ).toBeVisible({
    timeout: 60_000,
  });
};

export const fillAiFilterDescription = async (
  page: Page,
  filterDescription: string,
) => {
  const filterDescriptionInput = page
    .getByPlaceholder(/Enter your AI filter description here/i)
    .first();
  await expect(filterDescriptionInput).toBeVisible({ timeout: 30_000 });
  await filterDescriptionInput.fill(filterDescription);
  await expect(filterDescriptionInput).toHaveValue(filterDescription);
};

export const assertPlannedAiFilterColumnNamesVisible = async (
  page: Page,
  plannedColumnNames: string[],
) => {
  for (const plannedColumnName of plannedColumnNames) {
    await expect(
      page
        .getByText(new RegExp(`^${escapeRegExp(plannedColumnName)}$`))
        .first(),
    ).toBeVisible({
      timeout: 60_000,
    });
  }
};

const readTokenUsageNumbers = async (page: Page) => {
  return page.evaluate(() => {
    const metricFromLabel = (label: string) => {
      const labels = Array.from(document.querySelectorAll('*')).filter(
        (element) => element.textContent?.trim() === label,
      );
      const row = labels[0]?.parentElement;
      return row?.lastElementChild?.textContent?.trim() || '';
    };

    const parseNumeric = (value: string) => {
      const normalized = value.replace(/[$,]/g, '').trim();
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    };

    return {
      inputTokens: parseNumeric(metricFromLabel('Input Tokens')),
      outputTokens: parseNumeric(metricFromLabel('Output Tokens')),
      totalCandidates: parseNumeric(metricFromLabel('Total Candidates')),
      totalCost: parseNumeric(metricFromLabel('Total Cost')),
    };
  });
};

export const waitForTokenUsageNumbers = async (page: Page) => {
  await expect
    .poll(
      async () => {
        const metrics = await readTokenUsageNumbers(page);
        return Number(
          Number.isFinite(metrics.inputTokens) &&
            metrics.inputTokens >= 0 &&
            Number.isFinite(metrics.outputTokens) &&
            metrics.outputTokens >= 0 &&
            Number.isFinite(metrics.totalCandidates) &&
            metrics.totalCandidates > 0 &&
            Number.isFinite(metrics.totalCost) &&
            metrics.totalCost >= 0,
        );
      },
      { timeout: 120_000, intervals: [1_000, 2_000, 5_000] },
    )
    .toBe(1);

  return readTokenUsageNumbers(page);
};

export const waitForCandidatesToContainFieldNames = async (
  authToken: string,
  input: {
    apiBaseUrl: string;
    jobId: string;
    fieldNames: string[];
  },
): Promise<CandidateNode[]> => {
  let latestCandidates: CandidateNode[] = [];

  await expect
    .poll(
      async () => {
        latestCandidates = await getCandidatesByJobId(authToken, {
          apiBaseUrl: input.apiBaseUrl,
          jobId: input.jobId,
        });
        return latestCandidates.filter((candidate) =>
          input.fieldNames.every((fieldName) =>
            (candidate.candidateFieldValues?.edges ?? []).some(
              (edge) => edge.node?.candidateFields?.name === fieldName,
            ),
          ),
        ).length;
      },
      { timeout: 180_000, intervals: [1_000, 2_000, 5_000] },
    )
    .toBeGreaterThan(0);

  return latestCandidates;
};

export const validateSpreadsheetContacts = async (
  authToken: string,
  input: {
    apiBaseUrl: string;
    afterCandidates: CandidateNode[];
    expectedNewRows: Record<string, unknown>[];
    issues: string[];
    label: string;
  },
) => {
  if (input.expectedNewRows.length === 0) {
    return;
  }

  const people = await getPeopleForCandidates(
    authToken,
    input.apiBaseUrl,
    input.afterCandidates,
  );
  const lookup = buildExistingLookup(input.afterCandidates);

  for (const row of input.expectedNewRows) {
    const candidate = findMatchingCandidate(
      lookup,
      row,
      'spreadsheet_import',
    );
    if (!candidate) {
      input.issues.push(
        `${input.label}: missing candidate for "${String(row.name || row.Name || 'unknown')}".`,
      );
      continue;
    }

    const person = candidate.peopleId ? people.get(candidate.peopleId) : undefined;
    if (!candidate.peopleId || !person) {
      input.issues.push(
        `${input.label}: candidate "${candidate.name || candidate.id}" is missing its linked person.`,
      );
      continue;
    }

    const expectedEmail = getEmailFromRow(row);
    if (expectedEmail) {
      const candidateEmail = dataProcessingUtils
        .cleanEmailAddresses(candidate.email?.primaryEmail || '')
        .at(0);
      const personEmail = dataProcessingUtils
        .cleanEmailAddresses(person.emails?.primaryEmail || '')
        .at(0);

      if (candidateEmail !== expectedEmail && personEmail !== expectedEmail) {
        input.issues.push(
          `${input.label}: email mismatch for "${candidate.name || candidate.id}". Expected "${expectedEmail}", candidate="${candidateEmail || ''}", person="${personEmail || ''}".`,
        );
      }
    }

    const expectedPhone = getPhoneFromRow(row);
    if (expectedPhone) {
      const candidatePhone = dataProcessingUtils
        .cleanPhoneNumbers(candidate.phoneNumber?.primaryPhoneNumber || '')
        .at(0);
      const personPhone = dataProcessingUtils
        .cleanPhoneNumbers(person.phones?.primaryPhoneNumber || '')
        .at(0);

      if (candidatePhone !== expectedPhone && personPhone !== expectedPhone) {
        input.issues.push(
          `${input.label}: phone mismatch for "${candidate.name || candidate.id}". Expected "${expectedPhone}", candidate="${candidatePhone || ''}", person="${personPhone || ''}".`,
        );
      }
    }
  }
};

export const runAiFilteringAndValidate = async (
  page: Page,
  authToken: string,
  input: {
    apiBaseUrl: string;
    jobId: string;
    filterDescription: string;
  },
) => {
  await installAiFilteringSseCapture(page);

  const beforeCandidates = await getCandidatesByJobId(authToken, {
    apiBaseUrl: input.apiBaseUrl,
    jobId: input.jobId,
  });
  if (beforeCandidates.length === 0) {
    throw new Error(
      `Cannot run AI filtering for job ${input.jobId} because no candidates were found.`,
    );
  }

  await selectAllVisibleCandidates(page);
  await openAiFilteringModal(page);

  const processFilterResponsePromise = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes('/candidate-sourcing/process-filter-description') &&
      response.request().method() === 'POST',
  );

  await fillAiFilterDescription(page, input.filterDescription);
  await page.getByRole('button', { name: /Process AI Filter/i }).click();

  const processFilterResponse = await processFilterResponsePromise;
  expect(processFilterResponse.ok()).toBeTruthy();
  const processFilterResponseBody =
    (await processFilterResponse.json()) as {
      status?: string;
      data?: {
        fields?: Array<{ name?: string | null }>;
      };
    };
  expect(processFilterResponseBody.status?.toLowerCase()).toBe('success');

  const promptField = page.getByPlaceholder(/Enter your prompt here/i).first();
  await expect(promptField).toBeVisible({ timeout: 60_000 });
  const promptValue = await promptField.inputValue();
  expect(promptValue.trim().length).toBeGreaterThan(0);

  await expect(
    page.locator('input[type="checkbox"][id^="field-job_company_name-"]').first(),
  ).toBeChecked({ timeout: 30_000 });

  const plannedColumnNames =
    processFilterResponseBody.data?.fields
      ?.map((field) => field.name?.trim() || '')
      .filter(Boolean) || [];
  await assertPlannedAiFilterColumnNamesVisible(page, plannedColumnNames);
  expect(plannedColumnNames.length).toBeGreaterThan(0);

  const computeTokensResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/candidate-sourcing/compute-tokens') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Compute Token Usage/i }).click();

  const computeTokensResponse = await computeTokensResponsePromise;
  expect(computeTokensResponse.ok()).toBeTruthy();
  const computeTokensResponseBody =
    (await computeTokensResponse.json()) as {
      status?: string;
    };
  expect(computeTokensResponseBody.status?.toLowerCase()).toBe('success');

  const tokenUsageNumbers = await waitForTokenUsageNumbers(page);
  expect(tokenUsageNumbers.totalCandidates).toBeGreaterThan(0);

  const createAiFilterResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/candidate-sourcing/process-ai-filters') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Create AI Filter/i }).click();

  const createAiFilterResponse = await createAiFilterResponsePromise;
  expect(createAiFilterResponse.ok()).toBeTruthy();
  const createAiFilterResponseBody =
    (await createAiFilterResponse.json()) as {
      status?: string;
    };
  expect(createAiFilterResponseBody.status?.toLowerCase()).toBe('success');

  const sseSnapshot = await waitForAiFilteringSseProgress(page);
  await expect(
    page.getByRole('button', { name: /Create AI Filter/i }),
  ).toBeHidden({
    timeout: 120_000,
  });

  const afterCandidates = await waitForCandidatesToContainFieldNames(authToken, {
    apiBaseUrl: input.apiBaseUrl,
    jobId: input.jobId,
    fieldNames: plannedColumnNames,
  });

  const candidatesWithPlannedColumns = afterCandidates.filter((candidate) =>
    plannedColumnNames.every((fieldName) =>
      (candidate.candidateFieldValues?.edges ?? []).some(
        (edge) => edge.node?.candidateFields?.name === fieldName,
      ),
    ),
  );
  expect(candidatesWithPlannedColumns.length).toBeGreaterThan(0);

  return {
    plannedColumnNames,
    tokenUsageNumbers,
    sseSnapshot,
    candidatesWithPlannedColumns,
  };
};

export const findJobByNameViaGraphql = async (input: {
  page: Page;
  apiBaseUrl: string;
  authToken: string;
  jobName: string;
}) => {
  const result = await input.page.evaluate(
    async ({
      resolvedApiBaseUrl,
      token,
      jobName,
    }: {
      resolvedApiBaseUrl: string;
      token: string;
      jobName: string;
    }) => {
      const response = await fetch(
        `${resolvedApiBaseUrl.replace(/\/$/, '')}/graphql`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `query FindManyJobs($filter: JobFilterInput) {
              jobs(filter: $filter, first: 10) {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }`,
            variables: {
              filter: {
                name: {
                  eq: jobName,
                },
              },
            },
          }),
        },
      );

      const payload = await response.json().catch(() => null);
      const edges =
        (payload as
          | { data?: { jobs?: { edges?: Array<{ node?: { id?: string; name?: string } }> } } }
          | null
          | undefined)?.data?.jobs?.edges ?? [];

      return {
        ok: response.ok,
        status: response.status,
        payload,
        job: edges[0]?.node ?? null,
      };
    },
    {
      resolvedApiBaseUrl: input.apiBaseUrl,
      token: input.authToken,
      jobName: input.jobName,
    },
  );

  expect(result.ok).toBeTruthy();
  expect(result.job?.id).toBeTruthy();
  return result.job as { id: string; name?: string };
};
