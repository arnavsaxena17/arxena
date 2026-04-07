import { expect, test } from '@playwright/test';

import { runCandidateEngagementScenario } from '../lib/utils/candidateEngagementE2eHelpers';

const appBaseUrl =
  process.env.ARXENA_E2E_BASE_URL || 'http://testing-arxena.localhost:3001';

test('candidate engagement fast path reaches correct job and sends intro quickly', async ({
  page,
  context,
}) => {
  test.setTimeout(5 * 60 * 1000);

  const result = await runCandidateEngagementScenario(page, context, {
    appBaseUrl,
    stopAfterIntroMessage: true,
  });

  await expect(page).toHaveURL(/\/job\/d485761d-0c59-4caf-9c35-37a8391234d8(?:[/?#]|$)/);
  expect(result.firstRowHasPhone).toBe(true);
  expect(result.introMessageId).toBeTruthy();
  expect(result.introLatencyMs).toBeLessThan(20_000);
});
