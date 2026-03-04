/**
 * Jobs pipeline E2E: Login, go to org charts, fetch full company, leadership,
 * function-wise, geo-wise, and node-level candidate searches.
 * Uses UNIPILE_LINKEDIN_ACCOUNT_ID + UNIPILE_ACCESS_TOKEN from twenty-server .env.
 * Screenshots captured for each search result.
 */
import { expect, test, type Page } from '@playwright/test';

import { LoginPage } from '../lib/pom/loginPage';

test.use({ storageState: { cookies: [], origins: [] } });

const TEST_COMPANY = process.env.E2E_TEST_COMPANY || 'salesforce';

const waitForPasswordStepOrJobs = async (page: Page) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (/\/jobs(?:[/?#]|$)/.test(page.url())) {
      return 'jobs';
    }

    const isPasswordVisible = await page
      .getByPlaceholder('Password')
      .first()
      .isVisible()
      .catch(() => false);

    if (isPasswordVisible) {
      return 'password';
    }

    await page.waitForTimeout(500);
  }

  throw new Error('Timed out waiting for either password step or /jobs page');
};

const completeOnboardingIfNeeded = async (page: Page) => {
  for (let i = 0; i < 10; i += 1) {
    if (/\/jobs(?:[/?#]|$)/.test(page.url())) {
      return;
    }

    const signInButton = page.getByRole('button', { name: 'Sign in' }).first();
    const isSignInVisible = await signInButton.isVisible().catch(() => false);
    if (isSignInVisible) {
      const isDisabled = await signInButton.isDisabled().catch(() => false);
      if (isDisabled) {
        const consentToggle = page
          .locator('button[role="switch"], [role="checkbox"], input[type="checkbox"]')
          .first();
        if (await consentToggle.isVisible().catch(() => false)) {
          await consentToggle.click();
        }
      }

      if (!(await signInButton.isDisabled().catch(() => true))) {
        await signInButton.click();
        await page.waitForTimeout(1_500);
        continue;
      }
    }

    if (await page.getByText('Create your workspace').isVisible().catch(() => false)) {
      await page.getByPlaceholder('Apple').fill(`E2E ${Date.now()}`);
      const enabledContinueButton = page
        .locator('button:has-text("Continue"):not([disabled])')
        .first();
      if (await enabledContinueButton.isVisible().catch(() => false)) {
        await enabledContinueButton.click();
      }
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await page.getByText('Create profile').isVisible().catch(() => false)) {
      const firstNameInput = page
        .locator('input[placeholder*="First"], input[placeholder="Tim"]')
        .first();
      const lastNameInput = page
        .locator('input[placeholder*="Last"], input[placeholder="Cook"]')
        .first();
      await firstNameInput.fill('Arnav');
      await lastNameInput.fill('Saxena');
      const enabledContinueButton = page
        .locator('button:has-text("Continue"):not([disabled])')
        .first();
      if (await enabledContinueButton.isVisible().catch(() => false)) {
        await enabledContinueButton.click();
      }
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await page.getByText('Install Arxena App').isVisible().catch(() => false)) {
      await page.getByRole('link', { name: 'Skip' }).first().click();
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await page.getByText('Connect LinkedIn').isVisible().catch(() => false)) {
      await page.getByRole('link', { name: 'Skip' }).first().click();
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await page.getByText('Emails and Calendar').isVisible().catch(() => false)) {
      await page.getByRole('link', { name: 'Continue without sync' }).click();
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await page.getByText('Invite your team').isVisible().catch(() => false)) {
      await page.getByRole('link', { name: 'Skip' }).first().click();
      await page.waitForTimeout(1_000);
      continue;
    }

    await page.waitForTimeout(1_000);
  }
};

test('Jobs org chart pipeline: full company, leadership, functions, geos, nodes', async ({
  page,
}) => {
  test.setTimeout(300_000);

  const login = process.env.DEFAULT_LOGIN || 'arnav@arxena.com';
  const password = process.env.DEFAULT_PASSWORD || 'Applecar2025';

  expect(login, 'DEFAULT_LOGIN must be set').toBeTruthy();
  expect(password, 'DEFAULT_PASSWORD must be set').toBeTruthy();

  const loginPage = new LoginPage(page);

  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });

  if (await loginPage.hasVisibleLoginWithEmailButton()) {
    await loginPage.clickLoginWithEmail();
  }

  if (!/\/jobs(?:[/?#]|$)/.test(page.url())) {
    await loginPage.typeEmail(login as string);
    await loginPage.clickContinueButton();

    const nextStep = await waitForPasswordStepOrJobs(page);

    if (nextStep === 'password') {
      await loginPage.typePassword(password as string);
      await loginPage.submitPasswordStep();
    }
  }

  await completeOnboardingIfNeeded(page);
  if (!/\/jobs(?:[/?#]|$)/.test(page.url())) {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }
  await page.waitForURL(/\/jobs(?:[/?#]|$)/, { timeout: 60_000 });
  await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/);

  const autocompleteResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === 'POST' &&
      response.url().includes('/org-chart/companies/autocomplete')
    );
  });

  const companySearchInput = page.getByPlaceholder(
    'Search company for org charts...',
  );
  await expect(companySearchInput).toBeVisible();
  await companySearchInput.click();
  await companySearchInput.fill(TEST_COMPANY);

  const autocompleteResponse = await autocompleteResponsePromise;
  expect(autocompleteResponse.ok()).toBeTruthy();
  const autocompletePayload = (await autocompleteResponse.json()) as {
    status?: string;
    result?: Array<{ name?: string; meta?: { id?: string } }>;
  };
  expect(autocompletePayload.status).toBe('ok');
  expect((autocompletePayload.result?.length ?? 0) > 0).toBeTruthy();

  const companyOption = page.getByRole('option', {
    name: new RegExp(TEST_COMPANY, 'i'),
  }).first();
  await companyOption.click();

  await expect(
    page.getByRole('button', { name: /back to jobs/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: new RegExp(TEST_COMPANY, 'i') }),
  ).toBeVisible();

  const diagramOrLoading = page.locator(
    '.orgchart-diagram, [style*="Loading org chart"], [style*="loading"]',
  );
  await diagramOrLoading.first().waitFor({ state: 'visible', timeout: 60_000 });

  const templateBanner = page.getByText(/this is a template|template.*generate/i);
  if (await templateBanner.isVisible().catch(() => false)) {
    const allButton = page.getByRole('button', { name: 'All' }).first();
    await allButton.click();
    await page.waitForTimeout(5_000);
    await page.waitForSelector('.orgchart-diagram canvas', {
      state: 'visible',
      timeout: 180_000,
    });
  } else {
    await page.waitForSelector('.orgchart-diagram canvas', {
      state: 'visible',
      timeout: 90_000,
    });
  }

  await page.screenshot({
    path: 'run_results/jobs-01-full-company-orgchart.png',
    fullPage: true,
  });

  const allButton = page.getByRole('button', { name: 'All' }).first();
  if (await allButton.isVisible().catch(() => false)) {
    await allButton.click();
    await page.waitForTimeout(3_000);
    await page.screenshot({
      path: 'run_results/jobs-02-all-full-company.png',
      fullPage: true,
    });
  }

  const leadersButton = page.getByRole('button', { name: 'Leaders' }).first();
  if (await leadersButton.isVisible().catch(() => false)) {
    await leadersButton.click();
    await page.waitForTimeout(3_000);
    await page.screenshot({
      path: 'run_results/jobs-03-leadership-nodes.png',
      fullPage: true,
    });
  }

  const viewAllButton = page
    .getByRole('button', { name: /view all candidates/i })
    .first();
  if (await viewAllButton.isVisible().catch(() => false)) {
    await viewAllButton.click();
    await page.waitForTimeout(3_000);
    await page.screenshot({
      path: 'run_results/jobs-04-view-all-candidates.png',
      fullPage: true,
    });
  }

  const countrySelect = page.locator('select').filter({ has: page.locator('option') }).first();
  if (await countrySelect.isVisible().catch(() => false)) {
    const options = await countrySelect.locator('option').allTextContents();
    const nonEmptyOption = options.find((o) => o && o.trim() && !/^all$/i.test(o));
    if (nonEmptyOption) {
      await countrySelect.selectOption({ label: nonEmptyOption });
      await page.waitForTimeout(3_000);
      await page.screenshot({
        path: 'run_results/jobs-05-geo-filter.png',
        fullPage: true,
      });
    }
  }

  const functionSelect = page.locator('select').filter({ has: page.locator('option') }).nth(1);
  if (await functionSelect.isVisible().catch(() => false)) {
    const options = await functionSelect.locator('option').allTextContents();
    const nonEmptyOption = options.find((o) => o && o.trim() && !/^all$/i.test(o));
    if (nonEmptyOption) {
      await functionSelect.selectOption({ label: nonEmptyOption });
      await page.waitForTimeout(3_000);
      await page.screenshot({
        path: 'run_results/jobs-06-function-filter.png',
        fullPage: true,
      });
    }
  }

  const firstNode = page.locator('.orgchart-diagram [data-key]').first();
  if (await firstNode.isVisible().catch(() => false)) {
    await firstNode.dblclick();
    await page.waitForTimeout(2_000);
    const modal = page.locator('[role="dialog"], .modal, [data-testid="orgchart-result-modal"]').first();
    if (await modal.isVisible().catch(() => false)) {
      await page.screenshot({
        path: 'run_results/jobs-07-node-detail-modal.png',
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  await page.screenshot({
    path: 'run_results/jobs-08-final-orgchart.png',
    fullPage: true,
  });
});
