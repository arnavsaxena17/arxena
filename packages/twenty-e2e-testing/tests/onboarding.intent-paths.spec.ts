import { expect, test } from '@playwright/test';

import {
  getNextAppleIndex,
  signUpAndReachIntentChoice,
} from '../lib/utils/authFlowE2eHelpers';

test.use({
  storageState: { cookies: [], origins: [] },
});

const firstAppleIndex = getNextAppleIndex();
const onboardingBaseUrl =
  process.env.ARXENA_E2E_ONBOARDING_BASE_URL || 'http://app.localhost:3001';

const branchConfigs = [
  {
    branchId: 'competitive-research',
    email: `apple${firstAppleIndex}@apple.com`,
    intentButton: 'Competitive research',
    pathUrl: /\/create\/competitive-research(?:[/?#]|$)/,
    pathTestId: 'onboarding-path-competitive-research',
    jobsScreenshot: 'run_results/intent-competitive-research-jobs.png',
  },
  {
    branchId: 'extension-install',
    email: `apple${firstAppleIndex + 1}@apple.com`,
    intentButton: 'Building my team',
    pathUrl: /\/create\/extension-install(?:[/?#]|$)/,
    pathTestId: 'onboarding-path-extension-install',
    jobsScreenshot: 'run_results/intent-extension-install-jobs.png',
  },
  {
    branchId: 'deal-diligence',
    email: `apple${firstAppleIndex + 2}@apple.com`,
    intentButton: 'Investment / deal diligence',
    pathUrl: /\/create\/deal-diligence(?:[/?#]|$)/,
    pathTestId: 'onboarding-path-deal-diligence',
    jobsScreenshot: 'run_results/intent-deal-diligence-jobs.png',
  },
];

test.describe('Onboarding intent paths', () => {
  test.setTimeout(300_000);

  test('Competitive research live walkthrough opens booking modal and can continue to jobs', async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await signUpAndReachIntentChoice(page, {
      email: `apple${firstAppleIndex + 3}@apple.com`,
      workspaceSuffix: 'competitive-research-book-call',
      baseUrl: onboardingBaseUrl,
    });

    await page.getByRole('button', { name: 'Competitive research' }).click();
    await page.waitForURL(/\/create\/competitive-research(?:[/?#]|$)/, {
      timeout: 120_000,
    });
    await expect(
      page.getByTestId('onboarding-path-competitive-research'),
    ).toBeVisible({
      timeout: 120_000,
    });

    await page.getByRole('button', { name: 'Book 20 minutes' }).click();

    await expect(
      page.getByText(`Let's map a target company live on the call`),
    ).toBeVisible({
      timeout: 120_000,
    });
    await expect(
      page.getByTestId('competitive-research-calendly-embed'),
    ).toBeVisible({
      timeout: 120_000,
    });
    await expect(page).toHaveURL(/\/create\/competitive-research(?:[/?#]|$)/);

    await page.screenshot({
      path: 'run_results/intent-competitive-research-booking-modal.png',
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Go to jobs' }).click();

    await page.waitForURL(/http:\/\/[^/]+\.localhost:3001\/jobs(?:[/?#]|$)/, {
      timeout: 120_000,
    });
    await expect(page.getByText('Your workspace is ready')).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({
      path: 'run_results/intent-competitive-research-booking-jobs.png',
      fullPage: true,
    });
  });

  for (const branch of branchConfigs) {
    test(`Welcome -> ${branch.branchId} -> jobs`, async ({ page, context }) => {
      await context.clearCookies();

      await signUpAndReachIntentChoice(page, {
        email: branch.email,
        workspaceSuffix: branch.branchId,
        baseUrl: onboardingBaseUrl,
      });

      await page.getByRole('button', { name: branch.intentButton }).click();
      await page.waitForURL(branch.pathUrl, { timeout: 120_000 });
      await expect(page.getByTestId(branch.pathTestId)).toBeVisible({
        timeout: 120_000,
      });

      await page.getByRole('button', { name: 'Go to jobs' }).click();

      await page.waitForURL(/http:\/\/[^/]+\.localhost:3001\/jobs(?:[/?#]|$)/, {
        timeout: 120_000,
      });
      await expect(page).toHaveURL(
        /http:\/\/[^/]+\.localhost:3001\/jobs(?:[/?#]|$)/,
      );
      await expect(page.getByText('Your workspace is ready')).toBeVisible({
        timeout: 30_000,
      });

      await page.screenshot({
        path: branch.jobsScreenshot,
        fullPage: true,
      });
    });
  }
});
