import { test } from '@playwright/test';

import {
  runAiFilteringAndValidate,
  waitForJobPageReady,
} from '../lib/utils/candidateSourcingE2eHelpers';
import {
  ensureAuthenticatedJobsPage,
  getAuthToken,
  testingArxenaStorageStatePath,
} from '../lib/utils/orgChartE2eHelpers';

const targetEnv = (process.env.ARXENA_E2E_ENV ?? 'local').toLowerCase();
const appBaseUrl =
  process.env.ARXENA_E2E_BASE_URL ||
  (targetEnv === 'prod'
    ? 'https://testing-arxena.arxena.com'
    : 'http://testing-arxena.localhost:3001');
const apiBaseUrl =
  process.env.ARXENA_E2E_API_BASE_URL ||
  process.env.BACKEND_BASE_URL ||
  (targetEnv === 'prod'
    ? appBaseUrl
    : appBaseUrl.replace(/:3001(?:\/)?$/, ':3000'));
const email = process.env.ARXENA_E2E_EMAIL || 'testing@arxena.com';
const password = process.env.ARXENA_E2E_PASSWORD || 'Applecar2025';

const jobId = '171d1d50-1c55-4ed3-a7c3-97d14eb0da3c';

test.describe('Job AI filtering', () => {
  test.use({
    storageState: testingArxenaStorageStatePath,
  });

  test('runs AI filtering and verifies created columns', async ({
    page,
    context,
  }) => {
    test.setTimeout(15 * 60 * 1000);

    await ensureAuthenticatedJobsPage(page, context, {
      baseUrl: appBaseUrl,
      email,
      password,
    });

    await page.goto(`${appBaseUrl}/job/${jobId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForURL(new RegExp(`/job/${jobId}(?:[/?#]|$)`), {
      timeout: 90_000,
    });
    await waitForJobPageReady(page);

    const authToken = await getAuthToken(context);
    await runAiFilteringAndValidate(page, authToken, {
      apiBaseUrl,
      jobId,
      filterDescription:
        'Which of these candidates are from family run companies',
    });
  });
});
