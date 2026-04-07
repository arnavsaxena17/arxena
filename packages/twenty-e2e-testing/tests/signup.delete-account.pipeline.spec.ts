import { expect, test } from '@playwright/test';

import { deleteAccountViaSettings } from '../lib/utils/deleteAccountViaSettings';
import { signUpAndReachIntentChoice } from '../lib/utils/signupOnboardingHelpers';
import { getWorkspaceAppOriginFromPageUrl } from '../lib/utils/workspaceAppUrl';

test.use({
  storageState: { cookies: [], origins: [] },
});

const BASE_URL =
  process.env.ARXENA_E2E_ONBOARDING_BASE_URL || 'http://app.localhost:3001';

test('Create account, onboard, reach jobs, then delete account', async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);

  const timestamp = Date.now();
  const email = `e2e_${timestamp}@arxena-e2e.test`;
  const workspaceSuffix = `delete-account-${timestamp}`;

  await context.clearCookies();

  await signUpAndReachIntentChoice(page, BASE_URL, email, {
    workspaceDisplayName: `Apple ${workspaceSuffix}`,
    firstName: 'Apple',
    lastName: workspaceSuffix,
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

  await page.getByRole('button', { name: 'Go to jobs' }).click();

  await page.waitForURL(/\/jobs(?:[/?#]|$)/, { timeout: 120_000 });
  await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/);
  await expect(page.getByText('Your workspace is ready')).toBeVisible({
    timeout: 30_000,
  });

  await page.screenshot({
    path: 'run_results/new-account-jobs-final.png',
    fullPage: true,
  });

  const workspaceAppUrl = getWorkspaceAppOriginFromPageUrl(page.url());
  await deleteAccountViaSettings(page, workspaceAppUrl, email);

  await page.screenshot({
    path: 'run_results/new-account-after-delete-final.png',
    fullPage: true,
  });
});
