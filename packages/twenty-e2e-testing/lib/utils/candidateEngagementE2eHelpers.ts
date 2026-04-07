import { expect, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  getCandidatesByJobId,
  type CandidateNode,
  waitForJobPageReady,
} from './candidateSourcingE2eHelpers';
import {
  ensureAuthenticatedJobsPage,
  getAuthToken,
} from './orgChartE2eHelpers';
import { findWorkspaceMemberProfiles } from '../../../twenty-shared/src/graphql/queries';

const DEFAULT_JOB_ID = 'd485761d-0c59-4caf-9c35-37a8391234d8';
const DEFAULT_CANDIDATE_PHONE = '918411937769';
const DEFAULT_RECRUITER_WHATSAPP_UNIPILE_ID = 'tGLHYhlkTFylTd_IpFvmGA';
const DEFAULT_TWENTY_ENV_WHATSAPP_UNIPILE_ID = 'gPzCQMMASMmqaobjnPaZ4A';
const DEFAULT_RECRUITER_PHONE = '917718093083';
const DEFAULT_TUNNEL_URL = 'https://08fmdhkn-3000.inc1.devtunnels.ms/';
const DEFAULT_TUNNEL_HEALTHCHECK_PATH = '/webhook';
const DEFAULT_RECRUITER_EMAIL = 'testing@arxena.com';
const DEFAULT_RECRUITER_PASSWORD = 'Applecar2025';
const DEFAULT_CANDIDATE_REPLY = 'Yes sure';
const DEFAULT_JD_FOLLOW_UP_TEXT =
  'Have shared the JD. Would you be keen on this role?';
const DEFAULT_INTRO_TEXT = 'Recruiter at Testing Arxena';
const DEFAULT_ATTACHMENT_NAME = 'JD - SAP SD.pdf';
const ENGAGED_CANDIDATE_QUEUE_NAME = 'engaged-candidate-processing-queue';

const resolveApiBaseUrl = (input?: {
  apiBaseUrl?: string;
  appBaseUrl?: string;
}) => {
  const normalizeForNodeFetch = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed);

      if (url.hostname.endsWith('.localhost')) {
        url.hostname = 'localhost';
      }

      if (url.port === '3001') {
        url.port = '3000';
      }

      return url.toString().replace(/\/$/, '');
    } catch {
      return trimmed
        .replace('testing-arxena.localhost', 'localhost')
        .replace(/:3001(?:\/)?$/, ':3000');
    }
  };

  const explicitApiBaseUrl = input?.apiBaseUrl ?? process.env.ARXENA_E2E_API_BASE_URL;

  if (explicitApiBaseUrl?.trim()) {
    return normalizeForNodeFetch(explicitApiBaseUrl);
  }

  const appBaseUrl = input?.appBaseUrl ?? process.env.ARXENA_E2E_BASE_URL;

  if (appBaseUrl?.trim()) {
    return normalizeForNodeFetch(appBaseUrl);
  }

  return 'http://localhost:3000';
};

type CandidateMessageNode = {
  id?: string;
  name?: string | null;
  message?: string | null;
  phoneFrom?: string | null;
  phoneTo?: string | null;
  whatsappMessageId?: string | null;
  whatsappDeliveryStatus?: string | null;
  typeOfMessage?: string | null;
};

type CandidateEngagementCandidate = CandidateNode & {
  candConversationStatus?: string | null;
  startChat?: boolean | null;
  engagementStatus?: boolean | null;
  whatsappMessages?: {
    edges?: Array<{
      node?: CandidateMessageNode | null;
    }>;
  } | null;
  jobs?:
    | {
        id?: string | null;
        recruiterId?: string | null;
        name?: string | null;
      }
    | Array<{
        id?: string | null;
        recruiterId?: string | null;
        name?: string | null;
      }>
    | null;
};

type GraphQlResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type RedisQueueSnapshot = {
  available: boolean;
  matchingKeys: string[];
  delayedMatches: string[];
  waitingMatches: string[];
  activeMatches: string[];
  completedMatches: string[];
  failedMatches: string[];
  hasQueuedJob: boolean;
};

type CapturedWebhookEvent = {
  receivedAt: string;
  payload: {
    event?: string;
    message?: string | null;
    message_id?: string | null;
    account_id?: string | null;
    attachments?: Array<{
      attachment_name?: string | null;
      attachment_id?: string | null;
    }> | null;
    [key: string]: unknown;
  };
};

const attachmentsRoot = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'twenty-server',
  'unipile-attachments',
);

const normalizePhone = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

const getLastTenDigits = (value: string | null | undefined) =>
  normalizePhone(value).slice(-10);

const sleep = (timeoutMs: number) =>
  new Promise((resolve) => setTimeout(resolve, timeoutMs));

const listAttachmentFiles = () => {
  if (!fs.existsSync(attachmentsRoot)) {
    return [] as string[];
  }

  return fs
    .readdirSync(attachmentsRoot, { recursive: true })
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => path.join(attachmentsRoot, entry))
    .filter((entry) => fs.existsSync(entry) && fs.statSync(entry).isFile())
    .sort();
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

const getEngagedCandidateQueueRedisSnapshot = (
  candidateId: string,
): RedisQueueSnapshot => {
  try {
    const matchingKeys = runRedisCliLines([
      'keys',
      `bull:${ENGAGED_CANDIDATE_QUEUE_NAME}:engaged-candidate-${candidateId}-*`,
    ]);
    const delayedMatches = runRedisCliLines([
      'zrange',
      `bull:${ENGAGED_CANDIDATE_QUEUE_NAME}:delayed`,
      '0',
      '-1',
    ]).filter((entry) => entry.includes(candidateId));
    const waitingMatches = runRedisCliLines([
      'lrange',
      `bull:${ENGAGED_CANDIDATE_QUEUE_NAME}:wait`,
      '0',
      '-1',
    ]).filter((entry) => entry.includes(candidateId));
    const activeMatches = runRedisCliLines([
      'lrange',
      `bull:${ENGAGED_CANDIDATE_QUEUE_NAME}:active`,
      '0',
      '-1',
    ]).filter((entry) => entry.includes(candidateId));
    const completedMatches = runRedisCliLines([
      'zrange',
      `bull:${ENGAGED_CANDIDATE_QUEUE_NAME}:completed`,
      '0',
      '-1',
    ]).filter((entry) => entry.includes(candidateId));
    const failedMatches = runRedisCliLines([
      'zrange',
      `bull:${ENGAGED_CANDIDATE_QUEUE_NAME}:failed`,
      '0',
      '-1',
    ]).filter((entry) => entry.includes(candidateId));

    return {
      available: true,
      matchingKeys,
      delayedMatches,
      waitingMatches,
      activeMatches,
      completedMatches,
      failedMatches,
      hasQueuedJob:
        matchingKeys.length > 0 ||
        delayedMatches.length > 0 ||
        waitingMatches.length > 0 ||
        activeMatches.length > 0 ||
        completedMatches.length > 0 ||
        failedMatches.length > 0,
    };
  } catch {
    return {
      available: false,
      matchingKeys: [],
      delayedMatches: [],
      waitingMatches: [],
      activeMatches: [],
      completedMatches: [],
      failedMatches: [],
      hasQueuedJob: false,
    };
  }
};

const waitForEngagedCandidateJobQueuedInRedis = async (input: {
  candidateId: string;
  timeoutMs?: number;
}) => {
  const timeoutMs = input.timeoutMs ?? 30_000;
  const startedAt = Date.now();
  let lastSnapshot = getEngagedCandidateQueueRedisSnapshot(input.candidateId);

  expect(
    lastSnapshot.available,
    'redis-cli is required for engaged candidate queue checks',
  ).toBeTruthy();

  while (Date.now() - startedAt < timeoutMs) {
    lastSnapshot = getEngagedCandidateQueueRedisSnapshot(input.candidateId);

    if (lastSnapshot.hasQueuedJob) {
      return lastSnapshot;
    }

    await sleep(1_000);
  }

  throw new Error(
    `Timed out waiting for candidate ${input.candidateId} to appear in the engaged candidate queue: ${JSON.stringify(
      lastSnapshot,
    )}`,
  );
};

const postArxChatAction = async (
  authToken: string,
  apiBaseUrl: string,
  endpoint: string,
  candidateIds: string[],
) => {
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/arx-chat/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ candidateIds }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `POST /arx-chat/${endpoint} failed with ${response.status}: ${body}`,
    );
  }

  return response.json().catch(() => null);
};

const clearCapturedWebhookEvents = async (apiBaseUrl: string) => {
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/unipile-webhook/test-events`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `DELETE /unipile-webhook/test-events failed with ${response.status}: ${body}`,
    );
  }
};

const getCapturedWebhookEvents = async (
  apiBaseUrl: string,
  input?: {
    event?: string;
    messageIncludes?: string;
  },
) => {
  const url = new URL(
    `${apiBaseUrl.replace(/\/$/, '')}/unipile-webhook/test-events`,
  );

  if (input?.event) {
    url.searchParams.set('event', input.event);
  }

  if (input?.messageIncludes) {
    url.searchParams.set('messageIncludes', input.messageIncludes);
  }

  const response = await fetch(url.toString(), { method: 'GET' });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `GET /unipile-webhook/test-events failed with ${response.status}: ${body}`,
    );
  }

  const payload = (await response.json()) as {
    success?: boolean;
    count?: number;
    events?: CapturedWebhookEvent[];
  };

  return payload.events ?? [];
};

const waitForCapturedWebhookEvent = async (
  apiBaseUrl: string,
  input: {
    event?: string;
    messageIncludes?: string;
    predicate?: (entry: CapturedWebhookEvent) => boolean;
    timeoutMs?: number;
    intervals?: number[];
  },
) => {
  const timeoutMs = input.timeoutMs ?? 180_000;
  const intervals = input.intervals ?? [1_000, 2_000, 5_000];
  let matchedEvent: CapturedWebhookEvent | null = null;

  await expect
    .poll(
      async () => {
        const events = await getCapturedWebhookEvents(apiBaseUrl, {
          event: input.event,
          messageIncludes: input.messageIncludes,
        });

        matchedEvent =
          events.find((entry) => input.predicate?.(entry) ?? true) ?? null;

        return Boolean(matchedEvent);
      },
      { timeout: timeoutMs, intervals },
    )
    .toBeTruthy();

  expect(matchedEvent).toBeTruthy();

  return matchedEvent as CapturedWebhookEvent;
};

const sendWhatsappMessageViaUnipileApi = async (input: {
  accountId: string;
  attendeeId: string;
  message: string;
  unipileApiUrl: string;
  unipileAccessToken: string;
}) => {
  const formData = new FormData();
  formData.append('account_id', input.accountId);
  formData.append('attendees_ids', input.attendeeId);
  formData.append('text', input.message);

  const response = await fetch(
    `${input.unipileApiUrl.replace(/\/$/, '')}/api/v1/chats`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-API-KEY': input.unipileAccessToken,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Unipile send message failed with ${response.status}: ${body}`,
    );
  }

  return response.json().catch(() => null);
};

const readEnvValue = (filePath: string, key: string) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(
    new RegExp(`^\\s*${key}\\s*=\\s*([^\\n#]+)`, 'm'),
  );

  if (!match?.[1]) {
    return null;
  }

  return match[1].trim().replace(/^['"]|['"]$/g, '');
};

const executeGraphql = async <T>(
  authToken: string,
  apiBaseUrl: string,
  query: string,
  variables: Record<string, unknown>,
) => {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GraphQlResponse<T>;

  if (payload.errors?.length) {
    throw new Error(
      payload.errors.map((error) => error.message).filter(Boolean).join(', '),
    );
  }

  if (!payload.data) {
    throw new Error('GraphQL request completed without a data payload');
  }

  return payload.data;
};

const getJobRecruiterId = async (
  authToken: string,
  apiBaseUrl: string,
  jobId: string,
) => {
  const data = await executeGraphql<{
    jobs?: {
      edges?: Array<{
        node?: { id?: string | null; recruiterId?: string | null } | null;
      }>;
    };
  }>(
    authToken,
    apiBaseUrl,
    `query FindManyJobs($filter: JobFilterInput, $limit: Int) {
      jobs(filter: $filter, first: $limit) {
        edges {
          node {
            id
            recruiterId
          }
        }
      }
    }`,
    {
      filter: { id: { eq: jobId } },
      limit: 1,
    },
  );

  const recruiterId = data.jobs?.edges?.[0]?.node?.recruiterId;

  expect(recruiterId, `Job ${jobId} is missing recruiterId`).toBeTruthy();

  return recruiterId as string;
};

const getRecruiterWhatsappUnipileId = async (
  authToken: string,
  apiBaseUrl: string,
  recruiterId: string,
) => {
  const data = await executeGraphql<{
    workspaceMemberProfiles?: {
      edges?: Array<{
        node?: { whatsappUnipileAccountId?: string | null } | null;
      }>;
    };
  }>(authToken, apiBaseUrl, findWorkspaceMemberProfiles, {
    filter: { workspaceMemberId: { eq: recruiterId } },
    limit: 1,
  });

  return (
    data.workspaceMemberProfiles?.edges?.[0]?.node?.whatsappUnipileAccountId ??
    null
  );
};

const getCandidateForJob = async (
  authToken: string,
  apiBaseUrl: string,
  jobId: string,
  phoneNumber: string,
) => {
  const candidates = (await getCandidatesByJobId(authToken, {
    apiBaseUrl,
    jobId,
  })) as CandidateEngagementCandidate[];

  const candidate = candidates.find(
    (entry) =>
      getLastTenDigits(entry.phoneNumber?.primaryPhoneNumber) ===
      getLastTenDigits(phoneNumber),
  );

  expect(
    candidate,
    `Could not find candidate with phone ${phoneNumber} for job ${jobId}`,
  ).toBeTruthy();

  return candidate as CandidateEngagementCandidate;
};

const getCandidateMessages = (candidate: CandidateEngagementCandidate) =>
  (candidate.whatsappMessages?.edges ?? [])
    .map((edge) => edge.node)
    .filter((node): node is CandidateMessageNode => Boolean(node));

const pollCandidate = async (
  authToken: string,
  input: {
    apiBaseUrl: string;
    jobId: string;
    phoneNumber: string;
  },
) =>
  getCandidateForJob(authToken, input.apiBaseUrl, input.jobId, input.phoneNumber);

const waitForCandidateCondition = async (
  authToken: string,
  input: {
    apiBaseUrl: string;
    jobId: string;
    phoneNumber: string;
    timeoutMs?: number;
    intervals?: number[];
    predicate: (candidate: CandidateEngagementCandidate) => boolean;
  },
) => {
  const timeoutMs = input.timeoutMs ?? 180_000;
  const intervals = input.intervals ?? [1_000, 2_000, 5_000];
  let latestCandidate: CandidateEngagementCandidate | null = null;

  await expect
    .poll(
      async () => {
        latestCandidate = await pollCandidate(authToken, {
          apiBaseUrl: input.apiBaseUrl,
          jobId: input.jobId,
          phoneNumber: input.phoneNumber,
        });

        return input.predicate(latestCandidate);
      },
      { timeout: timeoutMs, intervals },
    )
    .toBeTruthy();

  expect(latestCandidate).toBeTruthy();

  return latestCandidate as CandidateEngagementCandidate;
};

const clickCandidateTableAction = async (page: Page, actionLabel: RegExp) => {
  const allActionsButton = page.getByRole('button', { name: /all actions/i }).first();
  await expect(allActionsButton).toBeVisible({ timeout: 30_000 });
  await allActionsButton.click();

  const action = page.getByRole('menuitem', { name: actionLabel }).first();
  const buttonFallback = page.getByRole('button', { name: actionLabel }).first();

  if (await action.isVisible().catch(() => false)) {
    await action.click();
    return;
  }

  await expect(buttonFallback).toBeVisible({ timeout: 15_000 });
  await buttonFallback.click();
};

const confirmModal = async (page: Page, title: RegExp, buttonLabel: RegExp) => {
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });
  const confirmButton = page.getByRole('button', { name: buttonLabel }).last();
  await expect(confirmButton).toBeVisible({ timeout: 30_000 });
  await confirmButton.click();
};

const assertTunnelAlive = async (tunnelUrl: string) => {
  const normalizedBaseUrl = tunnelUrl.replace(/\/$/, '');
  const healthcheckUrl = `${normalizedBaseUrl}${DEFAULT_TUNNEL_HEALTHCHECK_PATH}`;
  const response = await fetch(healthcheckUrl, {
    method: 'GET',
    redirect: 'follow',
  });

  expect(
    response.ok,
    `Expected tunnel healthcheck ${healthcheckUrl} to be alive, got status ${response.status}`,
  ).toBeTruthy();

  return response.status;
};

const openCandidateChatDrawerForFirstRow = async (page: Page, candidateName: string) => {
  const firstRow = page.locator('.htCore tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 30_000 });

  const namedCell = firstRow.getByText(candidateName, { exact: false }).first();

  if (await namedCell.isVisible().catch(() => false)) {
    await namedCell.click({ force: true });
  } else {
    const cells = firstRow.locator('td');
    const cellCount = await cells.count();
    let opened = false;

    for (let index = 0; index < cellCount; index += 1) {
      const cell = cells.nth(index);
      await cell.click({ force: true });

      const drawerTitle = page.getByText(/candidate info/i).first();
      if (await drawerTitle.isVisible().catch(() => false)) {
        opened = true;
        break;
      }
    }

    expect(opened, 'Expected clicking the first candidate row to open the chat drawer').toBeTruthy();
  }

  await expect(page.getByText(/candidate info/i).first()).toBeVisible({
    timeout: 30_000,
  });
};

export const runCandidateEngagementScenario = async (
  page: Page,
  context: BrowserContext,
  input?: {
    appBaseUrl?: string;
    apiBaseUrl?: string;
    email?: string;
    password?: string;
    jobId?: string;
    candidatePhoneNumber?: string;
    tunnelUrl?: string;
    authToken?: string | null;
    recruiterWhatsappUnipileId?: string;
    envWhatsappUnipileId?: string;
    stopAfterIntroMessage?: boolean;
  },
) => {
  const appBaseUrl =
    input?.appBaseUrl ??
    process.env.ARXENA_E2E_BASE_URL ??
    'http://testing-arxena.localhost:3001';
  const apiBaseUrl = resolveApiBaseUrl({
    apiBaseUrl: input?.apiBaseUrl,
    appBaseUrl,
  });
  const email = input?.email ?? DEFAULT_RECRUITER_EMAIL;
  const password = input?.password ?? DEFAULT_RECRUITER_PASSWORD;
  const jobId = input?.jobId ?? DEFAULT_JOB_ID;
  const candidatePhoneNumber =
    input?.candidatePhoneNumber ?? DEFAULT_CANDIDATE_PHONE;
  const tunnelUrl = input?.tunnelUrl ?? DEFAULT_TUNNEL_URL;
  const expectedRecruiterWhatsappUnipileId =
    input?.recruiterWhatsappUnipileId ??
    DEFAULT_RECRUITER_WHATSAPP_UNIPILE_ID;
  const expectedEnvWhatsappUnipileId =
    input?.envWhatsappUnipileId ?? DEFAULT_TWENTY_ENV_WHATSAPP_UNIPILE_ID;
  const stopAfterIntroMessage = input?.stopAfterIntroMessage ?? false;
  const unipileApiUrl =
    process.env.UNIPILE_API_URL ??
    readEnvValue(
      path.resolve(__dirname, '..', '..', '..', 'twenty-server', '.env.test'),
      'UNIPILE_API_URL',
    ) ??
    readEnvValue(
      path.resolve(__dirname, '..', '..', '..', 'twenty-server', '.env'),
      'UNIPILE_API_URL',
    );
  const unipileAccessToken =
    process.env.UNIPILE_ACCESS_TOKEN ??
    readEnvValue(
      path.resolve(__dirname, '..', '..', '..', 'twenty-server', '.env.test'),
      'UNIPILE_ACCESS_TOKEN',
    ) ??
    readEnvValue(
      path.resolve(__dirname, '..', '..', '..', 'twenty-server', '.env'),
      'UNIPILE_ACCESS_TOKEN',
    );

  await ensureAuthenticatedJobsPage(page, context, {
    baseUrl: appBaseUrl,
    email,
    password,
  });

  const authToken = input?.authToken ?? (await getAuthToken(context, page));
  const tunnelStatus = await assertTunnelAlive(tunnelUrl);

  const envTestFilePath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'twenty-server',
    '.env.test',
  );
  const envFilePath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'twenty-server',
    '.env',
  );
  const envWhatsappUnipileId =
    process.env.ARNAV_WHATSAPP_UNIPILE_ID ??
    readEnvValue(envTestFilePath, 'ARNAV_WHATSAPP_UNIPILE_ID') ??
    readEnvValue(envFilePath, 'ARNAV_WHATSAPP_UNIPILE_ID');

  expect(
    envWhatsappUnipileId,
    `ARNAV_WHATSAPP_UNIPILE_ID is missing from process.env, ${envTestFilePath}, and ${envFilePath}`,
  ).toBeTruthy();
  expect(envWhatsappUnipileId).toBe(expectedEnvWhatsappUnipileId);

  const recruiterId = await getJobRecruiterId(authToken, apiBaseUrl, jobId);
  const recruiterWhatsappUnipileId = await getRecruiterWhatsappUnipileId(
    authToken,
    apiBaseUrl,
    recruiterId,
  );

  expect(recruiterWhatsappUnipileId).toBe(expectedRecruiterWhatsappUnipileId);

  const beforeResetCandidate = await getCandidateForJob(
    authToken,
    apiBaseUrl,
    jobId,
    candidatePhoneNumber,
  );
  const candidateId = beforeResetCandidate.id;
  const candidateName = beforeResetCandidate.name ?? 'Candidate';

  await page.goto(`${appBaseUrl.replace(/\/$/, '')}/job/${jobId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForURL(new RegExp(`/job/${jobId}(?:[/?#]|$)`), {
    timeout: 90_000,
  });
  await waitForJobPageReady(page);

  const firstRowText = (
    (await page.locator('.htCore tbody tr').first().textContent()) ?? ''
  ).replace(/\s+/g, ' ');
  expect(
    firstRowText,
    `Expected the first candidate row to contain ${candidatePhoneNumber}`,
  ).toContain(candidatePhoneNumber);

  await clearCapturedWebhookEvents(apiBaseUrl);

  await postArxChatAction(
    authToken,
    apiBaseUrl,
    'reset-messages-from-whatsapp',
    [candidateId],
  );

  await expect
    .poll(
      async () => {
        const candidate = await pollCandidate(authToken, {
          apiBaseUrl,
          jobId,
          phoneNumber: candidatePhoneNumber,
        });
        return getCandidateMessages(candidate).length;
      },
      {
        timeout: 120_000,
        intervals: [1_000, 2_000, 5_000],
      },
    )
    .toBe(0);

  const startChatTriggeredAt = Date.now();
  await postArxChatAction(
    authToken,
    apiBaseUrl,
    'start-chats-by-candidate-ids',
    [candidateId],
  );

  const introCandidate = await waitForCandidateCondition(authToken, {
    apiBaseUrl,
    jobId,
    phoneNumber: candidatePhoneNumber,
    timeoutMs: 180_000,
    intervals: [1_000, 2_000, 5_000],
    predicate: (candidate) =>
      getCandidateMessages(candidate).some((message) =>
        (message.message ?? '').includes(DEFAULT_INTRO_TEXT),
      ),
  });

  const introMessages = getCandidateMessages(introCandidate);
  const introMessage = introMessages.find((message) =>
    (message.message ?? '').includes(DEFAULT_INTRO_TEXT),
  );

  expect(
    introMessage,
    `Expected intro message containing "${DEFAULT_INTRO_TEXT}" to be stored for candidate ${candidateId}`,
  ).toBeTruthy();
  const introLatencyMs = Date.now() - startChatTriggeredAt;

  const introWebhookEvent = await waitForCapturedWebhookEvent(apiBaseUrl, {
    event: 'message_received',
    messageIncludes: DEFAULT_INTRO_TEXT,
    timeoutMs: 120_000,
  });

  await openCandidateChatDrawerForFirstRow(page, candidateName);
  await expect(page.getByText(DEFAULT_INTRO_TEXT).first()).toBeVisible({
    timeout: 60_000,
  });

  if (stopAfterIntroMessage) {
    return {
      tunnelStatus,
      authToken,
      jobId,
      candidateId,
      recruiterId,
      recruiterWhatsappUnipileId,
      envWhatsappUnipileId,
      firstRowText,
      firstRowHasPhone: firstRowText.includes(candidatePhoneNumber),
      introMessageId: introMessage?.id ?? null,
      introWebhookMessageId: introWebhookEvent.payload.message_id ?? null,
      introLatencyMs,
      newAttachmentFiles: [],
      attachmentNameExpectation: DEFAULT_ATTACHMENT_NAME,
    };
  }

  await page.waitForTimeout(10_000);

  const attachmentFilesBeforeReply = listAttachmentFiles();
  expect(
    unipileApiUrl,
    'UNIPILE_API_URL must be configured to send the candidate reply via Unipile',
  ).toBeTruthy();
  expect(
    unipileAccessToken,
    'UNIPILE_ACCESS_TOKEN must be configured to send the candidate reply via Unipile',
  ).toBeTruthy();

  const candidateAttendeeId = `${DEFAULT_RECRUITER_PHONE}@s.whatsapp.net`;
  await sendWhatsappMessageViaUnipileApi({
    accountId: expectedEnvWhatsappUnipileId,
    attendeeId: candidateAttendeeId,
    message: DEFAULT_CANDIDATE_REPLY.toLowerCase(),
    unipileApiUrl: unipileApiUrl as string,
    unipileAccessToken: unipileAccessToken as string,
  });

  const candidateReplyWebhookEvent = await waitForCapturedWebhookEvent(
    apiBaseUrl,
    {
      event: 'message_received',
      messageIncludes: 'yes sure',
      timeoutMs: 120_000,
    },
  );

  const candidateAfterReply = await waitForCandidateCondition(authToken, {
    apiBaseUrl,
    jobId,
    phoneNumber: candidatePhoneNumber,
    timeoutMs: 180_000,
    intervals: [1_000, 2_000, 5_000],
    predicate: (candidate) =>
      getCandidateMessages(candidate).some(
        (message) =>
          (message.message ?? '').trim().toLowerCase() ===
          DEFAULT_CANDIDATE_REPLY.toLowerCase(),
      ),
  });

  const replyMessages = getCandidateMessages(candidateAfterReply);
  const candidateReply = replyMessages.find(
    (message) =>
      (message.message ?? '').trim().toLowerCase() ===
      DEFAULT_CANDIDATE_REPLY.toLowerCase(),
  );

  expect(
    candidateReply,
    `Expected candidate reply "${DEFAULT_CANDIDATE_REPLY}" to be persisted via the webhook`,
  ).toBeTruthy();

  const queuedSnapshot = await waitForEngagedCandidateJobQueuedInRedis({
    candidateId,
    timeoutMs: 45_000,
  });

  expect(
    queuedSnapshot.delayedMatches.length,
    `Expected candidate ${candidateId} to be queued with delay in Redis before worker processing`,
  ).toBeGreaterThan(0);

  const followUpCandidate = await waitForCandidateCondition(authToken, {
    apiBaseUrl,
    jobId,
    phoneNumber: candidatePhoneNumber,
    timeoutMs: 360_000,
    intervals: [2_000, 5_000, 10_000],
    predicate: (candidate) =>
      getCandidateMessages(candidate).some((message) =>
        (message.message ?? '').includes(DEFAULT_JD_FOLLOW_UP_TEXT),
      ),
  });

  const followUpMessages = getCandidateMessages(followUpCandidate);
  const jdFollowUpMessage = followUpMessages.find((message) =>
    (message.message ?? '').includes(DEFAULT_JD_FOLLOW_UP_TEXT),
  );

  const jdFollowUpWebhookEvent = await waitForCapturedWebhookEvent(apiBaseUrl, {
    event: 'message_received',
    messageIncludes: DEFAULT_JD_FOLLOW_UP_TEXT,
    timeoutMs: 360_000,
  });

  expect(
    jdFollowUpMessage,
    `Expected follow-up message containing "${DEFAULT_JD_FOLLOW_UP_TEXT}" after worker processing`,
  ).toBeTruthy();

  expect(
    followUpCandidate.candConversationStatus,
    'Expected candidate chat status to move to a keen-to-chat state after reply processing',
  ).toBe('CANDIDATE_IS_KEEN_TO_CHAT');

  await expect
    .poll(
      () => listAttachmentFiles().length,
      {
        timeout: 360_000,
        intervals: [2_000, 5_000, 10_000],
      },
    )
    .toBeGreaterThan(attachmentFilesBeforeReply.length);

  const attachmentFilesAfterReply = listAttachmentFiles();
  const newAttachmentFiles = attachmentFilesAfterReply.filter(
    (entry) => !attachmentFilesBeforeReply.includes(entry),
  );

  const jdAttachmentWebhookEvent = await waitForCapturedWebhookEvent(apiBaseUrl, {
    event: 'message_received',
    predicate: (entry) =>
      (entry.payload.attachments ?? []).some(
        (attachment) =>
          (attachment.attachment_name ?? '').trim() === DEFAULT_ATTACHMENT_NAME,
      ),
    timeoutMs: 360_000,
  });

  expect(
    newAttachmentFiles.some((entry) => entry.endsWith('.pdf') || entry.endsWith('.bin')),
    `Expected a new JD attachment file to be saved under ${attachmentsRoot}`,
  ).toBeTruthy();

  return {
    tunnelStatus,
    authToken,
    jobId,
    candidateId,
    recruiterId,
    recruiterWhatsappUnipileId,
    envWhatsappUnipileId,
    firstRowText,
    firstRowHasPhone: firstRowText.includes(candidatePhoneNumber),
    introMessageId: introMessage?.id ?? null,
    introWebhookMessageId: introWebhookEvent.payload.message_id ?? null,
    introLatencyMs,
    candidateReplyId: candidateReply?.id ?? null,
    candidateReplyWebhookMessageId:
      candidateReplyWebhookEvent.payload.message_id ?? null,
    followUpMessageId: jdFollowUpMessage?.id ?? null,
    followUpWebhookMessageId: jdFollowUpWebhookEvent.payload.message_id ?? null,
    jdAttachmentWebhookMessageId:
      jdAttachmentWebhookEvent.payload.message_id ?? null,
    newAttachmentFiles,
    attachmentNameExpectation: DEFAULT_ATTACHMENT_NAME,
  };
};
