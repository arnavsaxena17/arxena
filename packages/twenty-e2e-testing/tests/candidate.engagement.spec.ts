import { test } from '@playwright/test';

import { runCandidateEngagementScenario } from '../lib/utils/candidateEngagementE2eHelpers';

const appBaseUrl =
  process.env.ARXENA_E2E_BASE_URL || 'http://testing-arxena.localhost:3001';
const apiBaseUrl =
  process.env.ARXENA_E2E_API_BASE_URL || 'http://testing-arxena.localhost:3000';

test('candidate engagement resets messages, starts chat, processes reply, and sends JD follow-up', async ({
  page,
  context,
}) => {
  test.setTimeout(20 * 60 * 1000);

  await runCandidateEngagementScenario(page, context, {
    appBaseUrl,
    apiBaseUrl,
    email: 'testing@arxena.com',
  });
});
