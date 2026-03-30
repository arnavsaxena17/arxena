import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

test.use({
  storageState: { cookies: [], origins: [] },
});

const PASSWORD = 'Applecar2025';
const BASE_URL = 'http://app.localhost:3001';

const getNextAppleIndex = () => {
  const output = execSync(
    `PGPASSWORD=postgres psql -h localhost -U postgres -d default -t -A -c "select coalesce(max(nullif(substring(email from '^apple([0-9]+)@apple\\\\.com$'), '')::int), 0) from core.\\"user\\" where email ~ '^apple[0-9]+@apple\\\\.com$';"`,
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();

  const maxIndex = Number.parseInt(output, 10);

  return Number.isNaN(maxIndex) ? 1 : maxIndex + 1;
};

const firstAppleIndex = getNextAppleIndex();

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

test.describe('Onboarding intent paths', () => {
  test.setTimeout(300_000);

  test('Competitive research live walkthrough opens booking modal and can continue to jobs', async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await signUpAndReachIntentChoice(
      page,
      `apple${firstAppleIndex + 3}@apple.com`,
      'competitive-research-book-call',
    );

    await page.getByRole('button', { name: 'Competitive research' }).click();
    await page.waitForURL(/\/create\/competitive-research(?:[/?#]|$)/, {
      timeout: 120_000,
    });
    await expect(
      page.getByTestId('onboarding-path-competitive-research'),
    ).toBeVisible({
      timeout: 120_000,
    });

    await page.getByRole('button', { name: 'See it live - 20 min call' }).click();

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

      await signUpAndReachIntentChoice(page, branch.email, branch.branchId);

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
