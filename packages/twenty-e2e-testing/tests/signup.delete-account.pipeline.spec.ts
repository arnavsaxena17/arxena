import { expect, test, type Page } from '@playwright/test';

test.use({
  storageState: { cookies: [], origins: [] },
});

const PASSWORD = 'Applecar2025';
const BASE_URL = 'http://app.localhost:3001';

const maybeClick = async (locator: ReturnType<Page['getByRole']>) => {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }

  return false;
};

const clickSkipOnPhoneStep = async (page: Page) => {
  const skipCandidates = [
    page.getByRole('button', { name: 'Skip' }),
    page.getByRole('link', { name: 'Skip for now' }),
    page.getByText('Skip for now').last(),
  ];

  for (const candidate of skipCandidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }

  throw new Error('Could not find a visible skip control on phone step');
};

const signUpAndReachIntentChoice = async (
  page: Page,
  email: string,
  workspaceSuffix: string,
) => {
  await page.goto(`${BASE_URL}/welcome`);
  await page.waitForLoadState('domcontentloaded');

  await maybeClick(page.getByRole('button', { name: 'Continue with Email' }));

  await page.getByPlaceholder('Email').fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.getByPlaceholder('Password')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByPlaceholder('Password').fill(PASSWORD);

  if (!(await maybeClick(page.getByRole('button', { name: 'Sign up' })))) {
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }

  await expect(page.getByText('Create your workspace')).toBeVisible({
    timeout: 120_000,
  });
  await page.getByPlaceholder('Apple').fill(`Apple ${workspaceSuffix}`);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Create profile')).toBeVisible({
    timeout: 120_000,
  });
  await page.locator('input[placeholder="Tim"]').first().fill('Apple');
  await page.locator('input[placeholder="Cook"]').first().fill(workspaceSuffix);
  await page.getByRole('button', { name: 'Continue' }).click();

  const phoneHeading = page.getByText('Add your phone number');
  if (await phoneHeading.isVisible().catch(() => false)) {
    await clickSkipOnPhoneStep(page);
  } else {
    await page.waitForTimeout(3_000);
    if (await phoneHeading.isVisible().catch(() => false)) {
      await clickSkipOnPhoneStep(page);
    }
  }

  await page.waitForURL(/\/create\/intent(?:[/?#]|$)/, {
    timeout: 120_000,
  });
  await expect(page.getByTestId('onboarding-intent-choice')).toBeVisible({
    timeout: 120_000,
  });
};

test('Create account, onboard, reach jobs, then delete account', async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);

  const timestamp = Date.now();
  const email = `e2e_${timestamp}@arxena-e2e.test`;
  const workspaceSuffix = `delete-account-${timestamp}`;

  await context.clearCookies();

  await signUpAndReachIntentChoice(page, email, workspaceSuffix);

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

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForURL(/\/settings(?:\/.*)?/, { timeout: 30_000 });
  await page.getByRole('link', { name: 'Profile' }).click();

  await expect(
    page.getByRole('button', { name: 'Delete account' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Delete account' }).click();

  await page.getByTestId('confirmation-modal-input').fill(email);
  await page.getByTestId('confirmation-modal-confirm-button').click();

  await page.waitForURL(/\/welcome(?:[/?#]|$)/, { timeout: 60_000 });
  await expect(page.getByPlaceholder('Email')).toBeVisible();

  await page.screenshot({
    path: 'run_results/new-account-after-delete-final.png',
    fullPage: true,
  });
});
