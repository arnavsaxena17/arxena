import { expect, test } from '@playwright/test';
import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

import {
  ensureAuthenticatedJobsPage,
  getAuthToken,
  testingArxenaStorageStatePath,
} from '../lib/utils/orgChartE2eHelpers';

type XrayModeLabel = 'arxena' | 'bright_data';

type XrayMode = {
  label: XrayModeLabel;
  includePaginatedHtml: boolean;
  pollTimeoutMs: number;
};

type OrgChartCandidateRow = Record<string, unknown>;
type BrightDataOrganicEntry = Record<string, unknown>;
type BrightDataSnapshotItem = {
  url?: string;
  keyword?: string;
  general?: {
    results_cnt?: number;
  };
  pagination?: Array<{
    page?: number | string;
  }>;
  organic?: BrightDataOrganicEntry[];
};
type SnapshotCandidate = {
  id: string;
  name: string;
  headline: string;
  company: string;
  location: string | null;
  profileUrl: string;
};
type StandardizedOrgChartPerson = {
  full_name: string;
  job_title: string;
  job_company_linkedin_url: string;
  job_company_id: string;
  job_company_name: string;
  industry: string;
  country: string;
  job_company_website: string;
  linkedin_url: string;
  facebook_url: string;
  twitter_url: string;
  gender: string;
  location_country: string;
  location_region: string;
  location_locality: string;
  location_metro: string;
  location_name: string;
  inferred_salary: string;
  inferred_years_experience: string;
  emails: string;
  phone_numbers: string;
  profile_picture_url: string;
  id: string;
};

const targetEnv = (process.env.ARXENA_E2E_ENV ?? 'local').toLowerCase();
const appBaseUrl =
  process.env.ARXENA_E2E_BASE_URL ||
  (targetEnv === 'prod'
    ? 'https://cool-panda.arxena.com'
    : 'http://cool-panda.localhost:3001');
const apiBaseUrl =
  process.env.ARXENA_E2E_API_BASE_URL ||
  process.env.BACKEND_BASE_URL ||
  (targetEnv === 'prod'
    ? appBaseUrl
    : appBaseUrl.replace(/:3001(?:\/)?$/, ':3000'));
const email = process.env.ARXENA_E2E_EMAIL || 'arnav@arxena.com';
const password = process.env.ARXENA_E2E_PASSWORD || 'Applecar2025';
const companyId = 'batliboi-ltd';
const companyName = 'batliboi ltd';
const linkedinCompanyUrl = 'https://www.linkedin.com/company/batliboi-ltd/';
const rawQuery = 'people at Batliboi Ltd';
const xrayModeFilter = (process.env.ARXENA_E2E_XRAY_MODE ?? 'both').toLowerCase();
const brightDataSnapshotId =
  process.env.ARXENA_E2E_SNAPSHOT_ID ?? 'sd_mnj0ssfwu7e82tkce';
const pythonOrgChartUrl =
  process.env.ARXENA_E2E_PYTHON_ORGCHART_URL ??
  'http://localhost:5050/api/orgchart/build';
const twentyServerEnvPath = path.resolve(
  __dirname,
  '..',
  '..',
  'twenty-server',
  '.env',
);

dotenv.config({ path: twentyServerEnvPath });

const brightDataApiKey = process.env.BRIGHT_DATA_API_KEY ?? '';

const logStep = (message: string, detail?: Record<string, unknown>) => {
  const line = `[linkedin-xray regression] ${message}`;
  if (detail !== undefined) {
    console.log(line, JSON.stringify(detail));
    return;
  }
  console.log(line);
};

const allXrayModes: XrayMode[] = [
  {
    label: 'arxena',
    includePaginatedHtml: false,
    pollTimeoutMs: 4 * 60 * 1000,
  },
  {
    label: 'bright_data',
    includePaginatedHtml: true,
    pollTimeoutMs: 9 * 60 * 1000,
  },
];

const xrayModes = allXrayModes.filter((mode) => {
  if (xrayModeFilter === 'both') {
    return true;
  }

  if (xrayModeFilter === 'bright_data' || xrayModeFilter === 'true') {
    return mode.label === 'bright_data';
  }

  if (xrayModeFilter === 'arxena' || xrayModeFilter === 'false') {
    return mode.label === 'arxena';
  }

  return true;
});

const serverPackageRoot = path.resolve(
  __dirname,
  '..',
  '..',
  'twenty-server',
);

const parseJsonObject = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  const text = await response.text();

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Expected JSON object response but received: ${text.slice(0, 500)}`);
  }
};

const parseSnapshotBody = (
  payload: unknown,
): BrightDataSnapshotItem[] => {
  if (Array.isArray(payload)) {
    return payload as BrightDataSnapshotItem[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.data)) {
      return record.data as BrightDataSnapshotItem[];
    }

    const looksLikeSnapshotItem =
      'organic' in record ||
      'general' in record ||
      'pagination' in record ||
      ('url' in record && 'keyword' in record);

    if (looksLikeSnapshotItem) {
      return [record as BrightDataSnapshotItem];
    }
  }

  throw new Error(
    `Snapshot payload was not in expected Bright Data shape: ${JSON.stringify(payload).slice(0, 500)}`,
  );
};

const extractLinkedinProfileUrl = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '';
  }

  const trimmed = value.trim();
  const match = trimmed.match(
    /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[^\s?#"]+/i,
  );

  return match?.[0]?.replace(/\/+$/, '') ?? '';
};

const splitTitle = (
  title: string,
): { name: string; headline: string } => {
  const normalized = title.trim();

  if (!normalized) {
    return { name: '', headline: '' };
  }

  for (const separator of [' - ', ' | ', ' – ', ' — ']) {
    const index = normalized.indexOf(separator);

    if (index > 0) {
      return {
        name: normalized.slice(0, index).trim(),
        headline: normalized.slice(index + separator.length).trim(),
      };
    }
  }

  return { name: normalized, headline: '' };
};

const fallbackNameFromLinkedinUrl = (linkedinUrl: string): string => {
  try {
    const pathname = new URL(linkedinUrl).pathname;
    const parts = pathname.split('/').filter(Boolean);
    const publicIdentifier = parts[1] ?? parts[0] ?? '';

    return publicIdentifier
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return '';
  }
};

const getExtensionTexts = (entry: BrightDataOrganicEntry): string[] => {
  const extensions = entry.extensions;

  if (!Array.isArray(extensions)) {
    return [];
  }

  return extensions
    .map((extension) => {
      if (extension && typeof extension === 'object') {
        const text = (extension as Record<string, unknown>).text;

        return typeof text === 'string' ? text.trim() : '';
      }

      return '';
    })
    .filter((text) => text.length > 0);
};

const mapSnapshotItemsToCandidates = (
  snapshotItems: BrightDataSnapshotItem[],
): SnapshotCandidate[] => {
  const candidates: SnapshotCandidate[] = [];

  snapshotItems.forEach((item, itemIndex) => {
    (item.organic ?? []).forEach((entry, organicIndex) => {
      const link =
        (typeof entry.link === 'string' && entry.link) ||
        (typeof entry.url === 'string' && entry.url) ||
        '';
      const linkedinUrl = extractLinkedinProfileUrl(link);

      if (!linkedinUrl) {
        return;
      }

      const title = typeof entry.title === 'string' ? entry.title.trim() : '';
      const description =
        typeof entry.description === 'string' ? entry.description.trim() : '';
      const extensionTexts = getExtensionTexts(entry);
      const split = splitTitle(title);
      const location = extensionTexts[0] ?? null;
      const role = extensionTexts[1] ?? split.headline ?? '';
      const company = extensionTexts[2] ?? companyName;
      const name =
        split.name ||
        fallbackNameFromLinkedinUrl(linkedinUrl) ||
        title ||
        linkedinUrl;

      candidates.push({
        id: `snapshot-${itemIndex + 1}-${organicIndex + 1}`,
        name,
        headline: description || role || split.headline || '',
        company,
        location,
        profileUrl: linkedinUrl,
      });
    });
  });

  return candidates;
};

const mapCandidatesToStandardizedPeople = (
  candidates: SnapshotCandidate[],
): StandardizedOrgChartPerson[] =>
  candidates.map((candidate, index) => ({
    full_name: candidate.name,
    job_title: candidate.headline || candidate.company || companyName,
    job_company_linkedin_url: linkedinCompanyUrl.replace(/\/+$/, ''),
    job_company_id: companyId,
    job_company_name: companyName,
    industry: '',
    country: 'global',
    job_company_website: '',
    linkedin_url: candidate.profileUrl,
    facebook_url: '',
    twitter_url: '',
    gender: '',
    location_country: '',
    location_region: '',
    location_locality: '',
    location_metro: '',
    location_name: candidate.location ?? '',
    inferred_salary: '',
    inferred_years_experience: '',
    emails: '',
    phone_numbers: '',
    profile_picture_url: '',
    id: candidate.id || `${candidate.name}-${index + 1}`,
  }));

const waitForWorkerBoot = async (worker: ChildProcessWithoutNullStreams) => {
  logStep('Waiting for queue worker process to signal boot (Redis/Queue/initialized)...');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      logStep(
        'Queue worker boot wait: 8s elapsed without matching stdout; continuing anyway',
      );
      resolve();
    }, 8_000);
    const onExit = (code: number | null) => {
      clearTimeout(timer);
      reject(new Error(`Worker exited early with code ${code ?? 'unknown'}`));
    };
    worker.once('exit', onExit);
    worker.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (
        text.includes('Redis connection established') ||
        text.includes('initialized') ||
        text.includes('Queue')
      ) {
        clearTimeout(timer);
        worker.off('exit', onExit);
        logStep('Queue worker boot signal received');
        resolve();
      }
    });
    worker.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (/Error:/i.test(text)) {
        clearTimeout(timer);
        worker.off('exit', onExit);
        reject(new Error(text));
      }
    });
  });
};

const clearCompanyCache = async (input: {
  apiToken: string;
  origin: string;
}) => {
  logStep('POST org-chart company-cache clear', { companyId, companyName });
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/org-chart/company-cache/clear`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${input.apiToken}`,
        'x-origin-domain': input.origin,
      },
      body: JSON.stringify({
        companyId,
        companyName,
      }),
    },
  );

  const body = await response.json();

  expect(response.ok).toBeTruthy();
  expect(body).toMatchObject({ status: 'ok' });
  logStep('Company cache cleared', { status: (body as { status?: string }).status });
};

const getStringField = (
  row: OrgChartCandidateRow,
  keys: string[],
): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
};

const getCandidateSummary = (row: OrgChartCandidateRow) => ({
  fullName: getStringField(row, ['name', 'fullName', 'full_name']),
  jobTitle: getStringField(row, ['jobTitle', 'headline', 'title']),
  companyName: getStringField(row, ['jobCompanyName', 'company', 'job_company_name']),
});

const assertOrgChartCandidateParsing = (
  items: OrgChartCandidateRow[],
  mode: XrayModeLabel,
) => {
  expect(items.length).toBeGreaterThan(0);

  const sample = items.slice(0, Math.min(items.length, 25));
  const summaries = sample.map(getCandidateSummary);

  const rowsWithFullName = summaries.filter(
    (item) => item.fullName.length > 0 && !item.fullName.includes(' - '),
  );
  const rowsWithJobTitle = summaries.filter((item) => item.jobTitle.length > 0);
  const rowsWithCompanyName = summaries.filter(
    (item) =>
      item.companyName.length > 0 && item.companyName.toLowerCase().includes('batliboi'),
  );

  expect(rowsWithFullName.length, `${mode}: full name parsing should be populated`).toBeGreaterThan(
    Math.max(2, Math.floor(sample.length * 0.6)),
  );
  expect(rowsWithJobTitle.length, `${mode}: job title parsing should be populated`).toBeGreaterThan(
    Math.max(2, Math.floor(sample.length * 0.6)),
  );
  expect(
    rowsWithCompanyName.length,
    `${mode}: company name normalization should preserve Batliboi`,
  ).toBeGreaterThan(Math.max(2, Math.floor(sample.length * 0.6)));
};

const assertOrgChartResponseShape = (
  payload: Record<string, unknown>,
  mode: XrayModeLabel,
) => {
  expect(payload.success, `${mode}: success should be true`).toBe(true);
  expect(payload.mode, `${mode}: mode should stay entire_company`).toBe(
    'entire_company',
  );
  expect(payload.searchType, `${mode}: searchType should stay classic`).toBe(
    'classic',
  );
  expect(payload.companyName, `${mode}: companyName should stay normalized`).toBe(
    companyName,
  );
  expect(payload.candidateSource, `${mode}: candidate source should be linkedin_xray`).toBe(
    'linkedin_xray',
  );
  expect(Array.isArray(payload.items), `${mode}: items must be an array`).toBe(
    true,
  );
  expect(Number(payload.itemCount), `${mode}: itemCount must be > 0`).toBeGreaterThan(
    0,
  );
  expect(typeof payload.orgChart, `${mode}: orgChart must be an object`).toBe(
    'object',
  );
};

const searchRequestBody = (mode: XrayMode, requestId: string) => ({
  rawQuery,
  cleanedQuery: rawQuery,
  companyName,
  companyId,
  mode: 'entire_company',
  searchType: 'classic',
  candidateSource: 'linkedin_xray',
  linkedinCompanyUrl,
  xraySearchEngine: 'google',
  includePaginatedHtml: mode.includePaginatedHtml,
  requestId,
});

const postOrgChartSearch = async (input: {
  apiToken: string;
  origin: string;
  mode: XrayMode;
  requestId: string;
}) => {
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/org-chart/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${input.apiToken}`,
        'x-origin-domain': input.origin,
      },
      body: JSON.stringify(searchRequestBody(input.mode, input.requestId)),
    },
  );

  const text = await response.text();

  let body: Record<string, unknown> | string;

  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = text;
  }

  return {
    response,
    body,
  };
};

const pollForCompletedOrgChart = async (input: {
  apiToken: string;
  origin: string;
  mode: XrayMode;
  requestId: string;
}) => {
  const startedAt = Date.now();
  let attempts = 0;
  let lastBody: Record<string, unknown> | string | null = null;

  while (Date.now() - startedAt < input.mode.pollTimeoutMs) {
    attempts += 1;

    logStep('Polling org-chart search', {
      mode: input.mode.label,
      requestId: input.requestId,
      attempt: attempts,
      elapsedMs: Date.now() - startedAt,
    });

    const { response, body } = await postOrgChartSearch(input);

    expect(response.ok, `${input.mode.label}: polling response should stay ok`).toBeTruthy();
    expect(
      typeof body,
      `${input.mode.label}: polling response should parse as object`,
    ).toBe('object');

    lastBody = body;

    const payload = body as Record<string, unknown>;

    if (payload.queued === true) {
      logStep('Org-chart still queued; waiting 5s before next poll', {
        mode: input.mode.label,
        attempt: attempts,
      });
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      continue;
    }

    logStep('Org-chart search completed (not queued)', {
      mode: input.mode.label,
      attempts,
      elapsedMs: Date.now() - startedAt,
      itemCount: payload.itemCount,
    });

    return {
      payload,
      attempts,
      elapsedMs: Date.now() - startedAt,
    };
  }

  throw new Error(
    `${input.mode.label}: timed out waiting for org chart completion after ${attempts} polls. Last body: ${JSON.stringify(
      lastBody,
    )}`,
  );
};

test.describe('Batliboi LinkedIn x-ray regression', () => {
  test.use({
    storageState: testingArxenaStorageStatePath,
  });

  let workerProcess: ChildProcessWithoutNullStreams | null = null;

  test.beforeAll(async () => {
    if (process.env.ARXENA_E2E_SKIP_WORKER_LAUNCH === '1') {
      logStep('Skipping queue worker launch (ARXENA_E2E_SKIP_WORKER_LAUNCH=1)');
      return;
    }

    logStep('Spawning queue worker subprocess', { cwd: serverPackageRoot });
    workerProcess = spawn(
      '/bin/zsh',
      [
        '-lc',
        'source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22.17.1 >/dev/null && node dist/src/queue-worker/queue-worker.js',
      ],
      {
        cwd: serverPackageRoot,
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'development',
        },
        stdio: 'pipe',
      },
    );

    await waitForWorkerBoot(workerProcess);
    logStep('Queue worker ready for tests');
  });

  test.afterAll(async () => {
    if (process.env.ARXENA_E2E_SKIP_WORKER_LAUNCH === '1') {
      return;
    }

    if (!workerProcess || workerProcess.killed) {
      logStep('afterAll: no worker process to kill');
      return;
    }

    logStep('Sending SIGTERM to queue worker');
    workerProcess.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      workerProcess?.once('exit', () => {
        logStep('Queue worker process exited');
        resolve();
      });
      setTimeout(resolve, 5_000);
    });
  });

  test('queues and completes Batliboi org-chart builds for both x-ray pagination modes', async ({
    page,
    context,
  }) => {
    test.setTimeout(20 * 60 * 1000);

    logStep('Test start', {
      targetEnv,
      appBaseUrl,
      apiBaseUrl,
      companyId,
      xrayModeLabels: xrayModes.map((m) => m.label),
    });

    logStep('Ensuring authenticated jobs page');
    await ensureAuthenticatedJobsPage(page, context, {
      baseUrl: appBaseUrl,
      email,
      password,
    });
    logStep('Jobs page session ready');

    logStep('Fetching API auth token from storage');
    const apiToken = await getAuthToken(context);
    const origin = new URL(appBaseUrl).origin;
    logStep('API token obtained', { origin });
    const modeSummaries: Array<{
      mode: XrayModeLabel;
      queueElapsedMs: number;
      completionElapsedMs: number;
      pollAttempts: number;
      itemCount: number;
      topCandidates: Array<{
        fullName: string;
        jobTitle: string;
        companyName: string;
      }>;
    }> = [];

    for (const mode of xrayModes) {
      logStep('--- Mode iteration start ---', {
        mode: mode.label,
        includePaginatedHtml: mode.includePaginatedHtml,
        pollTimeoutMs: mode.pollTimeoutMs,
      });

      await clearCompanyCache({ apiToken, origin });

      const requestId = `batliboi-${mode.label}-${Date.now()}`;
      logStep('Posting initial org-chart search (expect queue)', {
        mode: mode.label,
        requestId,
      });
      const queueStartedAt = Date.now();
      const queuedResult = await postOrgChartSearch({
        apiToken,
        origin,
        mode,
        requestId,
      });
      const queueElapsedMs = Date.now() - queueStartedAt;

      expect(
        queuedResult.response.ok,
        `${mode.label}: initial org chart request should be accepted`,
      ).toBeTruthy();
      expect(
        typeof queuedResult.body,
        `${mode.label}: initial response should parse as object`,
      ).toBe('object');

      const queuedPayload = queuedResult.body as Record<string, unknown>;

      expect(queuedPayload.success, `${mode.label}: queued response should stay successful`).toBe(
        true,
      );
      expect(queuedPayload.queued, `${mode.label}: initial response should queue`).toBe(
        true,
      );
      expect(
        queuedPayload.candidateSource,
        `${mode.label}: queued response should keep linkedin_xray source`,
      ).toBe('linkedin_xray');
      expect(
        queuedPayload.companyName,
        `${mode.label}: queued response should keep Batliboi company`,
      ).toBe(companyName);
      expect(queueElapsedMs, `${mode.label}: queue response should be fast`).toBeLessThan(
        20_000,
      );

      logStep('Initial queue response validated', {
        mode: mode.label,
        queueElapsedMs,
        queued: queuedPayload.queued,
      });

      logStep('Polling until org-chart build completes', {
        mode: mode.label,
        requestId,
        pollTimeoutMs: mode.pollTimeoutMs,
      });
      const completed = await pollForCompletedOrgChart({
        apiToken,
        origin,
        mode,
        requestId,
      });

      logStep('Asserting org-chart response shape', { mode: mode.label });
      assertOrgChartResponseShape(completed.payload, mode.label);

      const items = (completed.payload.items as OrgChartCandidateRow[]) ?? [];
      logStep('Asserting candidate row parsing', {
        mode: mode.label,
        itemCount: items.length,
      });
      assertOrgChartCandidateParsing(items, mode.label);

      logStep('--- Mode iteration done ---', {
        mode: mode.label,
        pollAttempts: completed.attempts,
        completionElapsedMs: completed.elapsedMs,
        itemCount: Number(completed.payload.itemCount ?? 0),
      });

      modeSummaries.push({
        mode: mode.label,
        queueElapsedMs,
        completionElapsedMs: completed.elapsedMs,
        pollAttempts: completed.attempts,
        itemCount: Number(completed.payload.itemCount ?? 0),
        topCandidates: items.slice(0, 5).map(getCandidateSummary),
      });
    }

    expect(modeSummaries).toHaveLength(xrayModes.length);
    expect(modeSummaries.every((summary) => summary.itemCount > 0)).toBe(true);

    logStep('All modes passed; final summary', { modeSummaries });
    console.log(
      JSON.stringify(
        {
          queuedWorkerRuns: modeSummaries,
        },
        null,
        2,
      ),
    );
  });

  test('fetches a Bright Data snapshot directly and builds an org chart via Python', async () => {
    test.setTimeout(5 * 60 * 1000);

    expect(
      brightDataApiKey,
      'BRIGHT_DATA_API_KEY must be available to fetch Bright Data snapshots',
    ).toBeTruthy();

    logStep('Fetching Bright Data snapshot directly', {
      snapshotId: brightDataSnapshotId,
    });

    const snapshotResponse = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${encodeURIComponent(
        brightDataSnapshotId,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${brightDataApiKey}`,
        },
      },
    );

    expect(snapshotResponse.ok, 'snapshot fetch should succeed').toBeTruthy();

    const snapshotPayload = await parseJsonObject(snapshotResponse);
    const snapshotItems = parseSnapshotBody(snapshotPayload);

    logStep('Snapshot fetched and parsed', {
      snapshotId: brightDataSnapshotId,
      snapshotItems: snapshotItems.length,
    });

    const candidates = mapSnapshotItemsToCandidates(snapshotItems);

    expect(candidates.length, 'snapshot should produce candidate rows').toBeGreaterThan(
      0,
    );

    const sampleItems = candidates.slice(0, Math.min(candidates.length, 25)).map((row) => ({
      name: row.name,
      headline: row.headline,
      company: row.company,
    }));

    const populatedNames = sampleItems.filter((row) => row.name.trim().length > 0);
    const populatedHeadlines = sampleItems.filter(
      (row) => row.headline.trim().length > 0,
    );

    expect(populatedNames.length, 'snapshot parser should populate names').toBeGreaterThan(
      Math.max(2, Math.floor(sampleItems.length * 0.6)),
    );
    expect(
      populatedHeadlines.length,
      'snapshot parser should populate headlines/job titles',
    ).toBeGreaterThan(Math.max(2, Math.floor(sampleItems.length * 0.4)));

    const standardizedPeople = mapCandidatesToStandardizedPeople(candidates);

    expect(
      standardizedPeople.length,
      'standardized org-chart payload should keep all candidates',
    ).toBe(candidates.length);

    logStep('Posting standardized snapshot payload to Python org-chart service', {
      snapshotId: brightDataSnapshotId,
      people: standardizedPeople.length,
      pythonOrgChartUrl,
    });

    const pythonResponse = await fetch(pythonOrgChartUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        people: standardizedPeople,
        job_name: 'orgchart-batliboi-ltd-entire',
        job_id: companyId,
        function_root: null,
        country: '',
      }),
    });

    const pythonText = await pythonResponse.text();

    expect(pythonResponse.ok, `python org-chart build should succeed: ${pythonText}`).toBeTruthy();

    let pythonPayload: Record<string, unknown>;

    try {
      pythonPayload = JSON.parse(pythonText) as Record<string, unknown>;
    } catch {
      throw new Error(`Python org-chart build returned non-JSON: ${pythonText.slice(0, 500)}`);
    }

    expect(
      typeof pythonPayload,
      'python org-chart build should return an object payload',
    ).toBe('object');
    expect(
      Object.keys(pythonPayload).length,
      'python org-chart payload should not be empty',
    ).toBeGreaterThan(0);

    logStep('Direct snapshot -> Python build passed', {
      snapshotId: brightDataSnapshotId,
      candidateCount: candidates.length,
      standardizedPeople: standardizedPeople.length,
      responseKeys: Object.keys(pythonPayload).slice(0, 10),
    });
  });
});
