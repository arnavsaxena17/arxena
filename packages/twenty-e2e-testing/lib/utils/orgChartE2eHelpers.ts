import { expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { getCachedAuthTokenFromRequests } from './authFlowE2eHelpers';
import { LoginPage } from '../pom/loginPage';

export const testingArxenaStorageStatePath = path.resolve(
  __dirname,
  '..',
  '..',
  '.auth',
  'testing-arxena-user.json',
);

export const defaultStorageStatePath = path.resolve(
  __dirname,
  '..',
  '..',
  '.auth',
  'user.json',
);

for (const storageStatePath of [
  testingArxenaStorageStatePath,
  defaultStorageStatePath,
]) {
  if (!fs.existsSync(storageStatePath)) {
    fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
    fs.writeFileSync(
      storageStatePath,
      JSON.stringify({ cookies: [], origins: [] }, null, 2),
    );
  }
}

export const saveStorageState = async (context: BrowserContext) => {
  await context.storageState({ path: testingArxenaStorageStatePath });
  await context.storageState({ path: defaultStorageStatePath });
};

export const normalizeLinkedinUrlForLookup = (url?: string | null) => {
  if (!url) {
    return '';
  }

  const trimmed = url.trim();

  if (!trimmed) {
    return '';
  }

  if (!trimmed.includes('linkedin.com')) {
    return trimmed;
  }

  const withProtocol =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, '')}`;

  return withProtocol
    .replace(/^http:\/\//i, 'https://')
    .replace(/^https:\/\/www\.linkedin\.com\//i, 'https://linkedin.com/');
};

export const isVisible = async (locator: ReturnType<Page['locator']>) =>
  locator.isVisible().catch(() => false);

export const isOnJobsUi = async (page: Page) => {
  const jobsHeading = page.getByRole('heading', { name: /jobs/i }).first();
  if (await isVisible(jobsHeading)) {
    return true;
  }

  const activeJobsText = page.getByText(/active jobs/i).first();
  if (await isVisible(activeJobsText)) {
    return true;
  }

  const companySearchInput = page
    .getByPlaceholder('Search company for org charts...')
    .first();

  return isVisible(companySearchInput);
};

export const isOnAuthUi = async (page: Page) => {
  if (/\/welcome(?:[/?#]|$)/.test(page.url())) {
    return true;
  }

  const continueWithEmail = page
    .getByRole('button', { name: /continue with email/i })
    .first();
  if (await isVisible(continueWithEmail)) {
    return true;
  }

  const emailInput = page
    .locator('input[placeholder="Email"], input[type="email"], input[name="email"]')
    .first();
  if (await isVisible(emailInput)) {
    return true;
  }

  return isVisible(page.getByText(/welcome to /i).first());
};

export const waitForAuthOrJobsUi = async (page: Page, timeoutMs = 30_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isOnJobsUi(page)) {
      return 'jobs' as const;
    }

    if (await isOnAuthUi(page)) {
      return 'auth' as const;
    }

    await page.waitForTimeout(500);
  }

  throw new Error('Timed out waiting for either auth UI or jobs UI');
};

export const completeOnboardingIfNeeded = async (page: Page) => {
  for (let i = 0; i < 12; i += 1) {
    if (await isOnJobsUi(page)) {
      return;
    }

    const signInButton = page.getByRole('button', { name: /^sign in$/i }).first();
    if (await isVisible(signInButton)) {
      const isDisabled = await signInButton.isDisabled().catch(() => false);
      if (isDisabled) {
        const consentToggle = page
          .locator(
            'button[role="switch"], [role="checkbox"], input[type="checkbox"]',
          )
          .first();
        if (await isVisible(consentToggle)) {
          await consentToggle.click();
        }
      }

      if (!(await signInButton.isDisabled().catch(() => true))) {
        await signInButton.click();
        await page.waitForTimeout(1_000);
        continue;
      }
    }

    if (await isVisible(page.getByText('Create your workspace').first())) {
      await page.getByPlaceholder('Apple').first().fill(`E2E ${Date.now()}`);
      const continueButton = page
        .locator('button:has-text("Continue"):not([disabled])')
        .first();
      if (await isVisible(continueButton)) {
        await continueButton.click();
      }
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Create profile').first())) {
      await page
        .locator('input[placeholder*="First"], input[placeholder="Tim"]')
        .first()
        .fill('Testing');
      await page
        .locator('input[placeholder*="Last"], input[placeholder="Cook"]')
        .first()
        .fill('Arxena');
      const continueButton = page
        .locator('button:has-text("Continue"):not([disabled])')
        .first();
      if (await isVisible(continueButton)) {
        await continueButton.click();
      }
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Install Arxena App').first())) {
      await page.getByRole('link', { name: /^skip$/i }).first().click();
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Connect LinkedIn').first())) {
      await page.getByRole('link', { name: /^skip$/i }).first().click();
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Emails and Calendar').first())) {
      await page
        .getByRole('link', { name: /continue without sync/i })
        .first()
        .click();
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Invite your team').first())) {
      await page.getByRole('link', { name: /^skip$/i }).first().click();
      await page.waitForTimeout(1_000);
      continue;
    }

    await page.waitForTimeout(1_000);
  }
};

export const ensureAuthenticatedJobsPage = async (
  page: Page,
  context: BrowserContext,
  input?: {
    baseUrl?: string;
    email?: string;
    password?: string;
  },
) => {
  const baseUrl = input?.baseUrl ?? process.env.WORKSPACE_ORIGIN ?? 'http://localhost:3001';
  const email = input?.email ?? process.env.DEFAULT_LOGIN ?? 'testing@arxena.com';
  const password = input?.password ?? process.env.DEFAULT_PASSWORD ?? 'Applecar2025';
  const loginPage = new LoginPage(page);

  await page.goto(`${baseUrl}/jobs`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });

  const landingUi = await waitForAuthOrJobsUi(page, 30_000);

  if (landingUi === 'jobs') {
    await saveStorageState(context);
    return;
  }

  if (await loginPage.hasVisibleLoginWithEmailButton()) {
    await loginPage.clickLoginWithEmail();
  }

  const emailInput = page
    .locator('input[placeholder="Email"], input[type="email"], input[name="email"]')
    .first();
  await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  await emailInput.fill(email);

  const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
  if (await isVisible(continueButton)) {
    await continueButton.click();
  }

  const passwordInput = page
    .locator('input[placeholder="Password"], input[type="password"]')
    .first();
  await passwordInput.waitFor({ state: 'visible', timeout: 30_000 });
  await passwordInput.fill(password);

  const signInButton = page.getByRole('button', { name: /^sign in$/i }).first();
  if (await isVisible(signInButton)) {
    await signInButton.click();
  } else if (await isVisible(continueButton)) {
    await continueButton.click();
  } else {
    await passwordInput.press('Enter');
  }

  await completeOnboardingIfNeeded(page);
  await expect(page.getByPlaceholder('Search company for org charts...').first()).toBeVisible({
    timeout: 90_000,
  });
  await saveStorageState(context);
};

const extractAccessTokenFromCookieValue = (cookieValue?: string | null) => {
  if (!cookieValue) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(cookieValue)).accessToken.token as string;
  } catch {
    return null;
  }
};

export const getAuthToken = async (
  context: BrowserContext,
  page?: Page,
) => {
  const requestToken = getCachedAuthTokenFromRequests(context);
  if (requestToken) {
    return requestToken;
  }

  const storageState = await context.storageState();
  const storageCookie = storageState.cookies.find(
    (cookie) => cookie.name === 'tokenPair',
  );
  const storageToken = extractAccessTokenFromCookieValue(storageCookie?.value);

  if (storageToken) {
    return storageToken;
  }

  const liveCookies = await context.cookies([
    'http://testing-arxena.localhost:3001',
    'http://app.localhost:3001',
    'http://cool-panda.localhost:3001',
    'http://localhost:3001',
  ]);
  const liveCookie = liveCookies.find((cookie) => cookie.name === 'tokenPair');
  const liveToken = extractAccessTokenFromCookieValue(liveCookie?.value);

  if (liveToken) {
    return liveToken;
  }

  if (page) {
    const pageToken = await page
      .evaluate(() => {
        const tokenPairEntry = document.cookie
          .split('; ')
          .find((entry) => entry.startsWith('tokenPair='));

        if (!tokenPairEntry) {
          return null;
        }

        return tokenPairEntry.slice('tokenPair='.length);
      })
      .catch(() => null);
    const evaluatedToken = extractAccessTokenFromCookieValue(pageToken);

    if (evaluatedToken) {
      return evaluatedToken;
    }
  }

  throw new Error('No tokenPair auth cookie found');
};

export const searchAndOpenOrgChartCompany = async (
  page: Page,
  input: {
    companyQuery: string;
    companyOptionName: string;
  },
) => {
  const companySearchInput = page
    .getByPlaceholder('Search company for org charts...')
    .first();
  await expect(companySearchInput).toBeVisible({ timeout: 60_000 });

  const autocompleteResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === 'POST' &&
      response.url().includes('/org-chart/companies/autocomplete')
    );
  });

  await companySearchInput.click();
  await companySearchInput.fill('');
  await companySearchInput.fill(input.companyQuery);

  const autocompleteResponse = await autocompleteResponsePromise;
  expect(autocompleteResponse.ok()).toBeTruthy();

  const autocompletePayload = (await autocompleteResponse.json()) as {
    result?: Array<{ name?: string; meta?: { id?: string } }>;
  };
  const matchedCompany =
    autocompletePayload.result?.find((result) =>
      new RegExp(input.companyOptionName, 'i').test(result.name ?? ''),
    ) ?? null;

  const companyOption = page
    .getByRole('option', { name: new RegExp(input.companyOptionName, 'i') })
    .first();
  await companyOption.waitFor({ state: 'visible', timeout: 60_000 });
  await companyOption.click();

  return {
    companyId: matchedCompany?.meta?.id ?? null,
    companyName: matchedCompany?.name ?? input.companyOptionName,
  };
};

export const waitForOrgChartLoaded = async (page: Page) => {
  const diagram = page.locator('.orgchart-diagram').first();
  const canvas = page.locator('.orgchart-diagram canvas').first();

  await diagram.waitFor({ state: 'visible', timeout: 90_000 });
  await canvas.waitFor({ state: 'visible', timeout: 90_000 });

  await page
    .getByText(/loading org chart/i)
    .first()
    .waitFor({
      state: 'hidden',
      timeout: 90_000,
    })
    .catch(() => {});

  return { diagram, canvas };
};

export const expectPreviewTemplateVisible = async (page: Page) => {
  const previewTemplate = page
    .getByText(
      /This is a preview template\. Generate the full org chart to see all employees\./i,
    )
    .first();

  if (await previewTemplate.isVisible().catch(() => false)) {
    return;
  }

  await expect(
    page.getByRole('button', { name: /^(all|full org chart\b)/i }).first(),
  ).toBeVisible({ timeout: 60_000 });
};

export const clickGenerateFullOrgChartFromPreview = async (page: Page) => {
  const previewButton = page
    .getByRole('button', { name: /generate full org chart/i })
    .first();

  if (await previewButton.isVisible().catch(() => false)) {
    await previewButton.click();
    return;
  }

  const fullChartButton = page
    .getByRole('button', { name: /^(all|full org chart\b)/i })
    .first();
  await expect(fullChartButton).toBeVisible({ timeout: 60_000 });
  await fullChartButton.click();
};

export const openJobsPageMenu = async (page: Page) => {
  const trigger = page.getByTestId('candidate-table-jobs-menu').first();
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();
  await expect(
    page.getByText(/org chart data source/i).first(),
  ).toBeVisible({ timeout: 15_000 });
};

export type OrgChartLinkedinCandidateSource =
  | 'unipile'
  | 'apify'
  | 'linkedin_xray';

export const selectOrgChartDataSource = async (
  page: Page,
  source: OrgChartLinkedinCandidateSource,
) => {
  const testIdBySource: Record<OrgChartLinkedinCandidateSource, string> = {
    unipile: 'org-chart-source-linkedin',
    apify: 'org-chart-source-apify',
    linkedin_xray: 'org-chart-source-linkedin-xray',
  };

  const option = page.getByTestId(testIdBySource[source]).first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape').catch(() => {});
};

export const clearCompanyOrgChartCache = async (input: {
  page: Page;
  apiBaseUrl: string;
  authToken: string;
  companyId?: string | null;
  companyName?: string | null;
}) => {
  const result = await input.page.evaluate(
    async ({
      resolvedApiBaseUrl,
      token,
      companyId,
      companyName,
    }: {
      resolvedApiBaseUrl: string;
      token: string;
      companyId?: string | null;
      companyName?: string | null;
    }) => {
      const response = await fetch(
        `${resolvedApiBaseUrl.replace(/\/$/, '')}/org-chart/company-cache/clear`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ companyId, companyName }),
        },
      );

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        payload,
      };
    },
    {
      resolvedApiBaseUrl: input.apiBaseUrl,
      token: input.authToken,
      companyId: input.companyId,
      companyName: input.companyName,
    },
  );

  expect(result.ok).toBeTruthy();
  return result;
};

export const createJobViaGraphql = async (input: {
  page: Page;
  apiBaseUrl: string;
  authToken: string;
  jobName: string;
  recruiterId?: string | null;
}) => {
  const result = await input.page.evaluate(
    async ({
      resolvedApiBaseUrl,
      token,
      jobName,
      recruiterId,
    }: {
      resolvedApiBaseUrl: string;
      token: string;
      jobName: string;
      recruiterId?: string | null;
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
            query: `mutation CreateOneJob($input: JobCreateInput!) {
              createJob(data: $input) {
                id
              }
            }`,
            variables: {
              input: {
                name: jobName,
                isActive: true,
                ...(recruiterId ? { recruiterId } : {}),
              },
            },
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      return {
        ok: response.ok,
        status: response.status,
        payload,
      };
    },
    {
      resolvedApiBaseUrl: input.apiBaseUrl,
      token: input.authToken,
      jobName: input.jobName,
      recruiterId: input.recruiterId,
    },
  );

  expect(result.ok).toBeTruthy();
  const jobId = (
    result.payload as
      | { data?: { createJob?: { id?: string } } }
      | null
      | undefined
  )?.data?.createJob?.id;
  expect(jobId).toBeTruthy();

  return {
    ...result,
    jobId: jobId as string,
  };
};

export const fetchSavedCandidateByLinkedinUrl = async (input: {
  page: Page;
  apiBaseUrl: string;
  authToken: string;
  linkedinUrl: string;
  jobId?: string;
}) => {
  const normalizedLinkedinUrl = normalizeLinkedinUrlForLookup(input.linkedinUrl);

  return input.page.evaluate(
    async ({
      resolvedApiBaseUrl,
      token,
      linkedinUrl,
      jobId,
    }: {
      resolvedApiBaseUrl: string;
      token: string;
      linkedinUrl: string;
      jobId?: string;
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
            query: `query FindManyCandidates($filter: CandidateFilterInput) {
              candidates(filter: $filter, first: 10) {
                edges {
                  node {
                    id
                    name
                    email {
                      primaryEmail
                    }
                    phoneNumber {
                      primaryPhoneNumber
                    }
                    linkedinUrl {
                      primaryLinkUrl
                    }
                    jobs {
                      id
                      name
                    }
                  }
                }
              }
            }`,
            variables: {
              filter: jobId
                ? {
                    linkedinUrl: {
                      primaryLinkUrl: {
                        eq: linkedinUrl,
                      },
                    },
                    jobsId: {
                      eq: jobId,
                    },
                  }
                : {
                    linkedinUrl: {
                      primaryLinkUrl: {
                        eq: linkedinUrl,
                      },
                    },
                  },
            },
          }),
        },
      );

      const payload = await response.json().catch(() => null);
      const edges =
        (payload as
          | { data?: { candidates?: { edges?: Array<{ node?: Record<string, unknown> }> } } }
          | null
          | undefined)?.data?.candidates?.edges ?? [];

      return {
        ok: response.ok,
        status: response.status,
        payload,
        candidate: edges[0]?.node ?? null,
      };
    },
    {
      resolvedApiBaseUrl: input.apiBaseUrl,
      token: input.authToken,
      linkedinUrl: normalizedLinkedinUrl,
      jobId: input.jobId,
    },
  );
};

export type OrgChartStreamEvent = {
  eventName: string;
  payload: Record<string, unknown>;
  rawFrame: string;
};

const parseSocketIoEventFrame = (
  framePayload: string,
): OrgChartStreamEvent | null => {
  const normalized = framePayload.trim();
  if (!normalized.includes('["')) {
    return null;
  }

  const packetStart = normalized.indexOf('[');
  if (packetStart < 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized.slice(packetStart)) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return null;
    }

    const [eventName, payload] = parsed;
    if (typeof eventName !== 'string' || !payload || typeof payload !== 'object') {
      return null;
    }

    return {
      eventName,
      payload: payload as Record<string, unknown>,
      rawFrame: framePayload,
    };
  } catch {
    return null;
  }
};

export const attachOrgChartProgressCollector = (page: Page) => {
  const events: OrgChartStreamEvent[] = [];

  const handleSocket = (webSocket: {
    on: (
      event: 'framereceived',
      listener: (event: { payload: string }) => void,
    ) => void;
  }) => {
    webSocket.on('framereceived', (frame) => {
      const parsed = parseSocketIoEventFrame(frame.payload);
      if (!parsed || parsed.eventName !== 'orgchart-search-progress') {
        return;
      }

      events.push(parsed);
    });
  };

  page.on('websocket', handleSocket);

  return {
    getEvents: () => [...events],
    dispose: () => {
      page.off('websocket', handleSocket);
    },
  };
};

export const collectDeepStrings = (value: unknown, output: string[] = []) => {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectDeepStrings(item, output);
    }
    return output;
  }

  if (value && typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      collectDeepStrings(nestedValue, output);
    }
  }

  return output;
};
