import { expect, test, type Page } from '@playwright/test';

import { LoginPage } from '../lib/pom/loginPage';

test.use({ storageState: { cookies: [], origins: [] } });

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

test('Login flow lands existing user on jobs page', async ({ page }) => {
  test.setTimeout(180_000);

  const login = process.env.DEFAULT_LOGIN || 'arnav@arxena.com';
  const password = process.env.DEFAULT_PASSWORD || 'Applecar2025';

  expect(login, 'DEFAULT_LOGIN must be set for jobs login pipeline').toBeTruthy();
  expect(
    password,
    'DEFAULT_PASSWORD must be set for jobs login pipeline',
  ).toBeTruthy();

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
  await companySearchInput.fill('salesforce');

  const autocompleteResponse = await autocompleteResponsePromise;
  expect(autocompleteResponse.ok()).toBeTruthy();
  const autocompletePayload = (await autocompleteResponse.json()) as {
    status?: string;
    result?: Array<{ name?: string; meta?: { id?: string } }>;
  };
  expect(autocompletePayload.status).toBe('ok');
  expect((autocompletePayload.result?.length ?? 0) > 0).toBeTruthy();
  const salesforceOption = autocompletePayload.result?.find((item) =>
    (item.name ?? '').toLowerCase().includes('salesforce'),
  );
  expect(salesforceOption).toBeTruthy();

  const optionalOrgChartResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.ok() &&
      /\/org-chart\/[^/?#]+/.test(response.url()) &&
      !response.url().includes('/companies/') &&
      (response.headers()['content-type'] ?? '').includes('application/json'),
    { timeout: 20_000 },
  );

  await page.getByRole('option', { name: /salesforce/i }).first().click();

  await page.waitForTimeout(1_500);
  const orgChartResponse = await optionalOrgChartResponsePromise.catch(
    () => null,
  );
  if (orgChartResponse) {
    const orgChartPayload = (await orgChartResponse.json()) as {
      status?: string;
      result?: { orgchart?: string };
    };
    expect(orgChartPayload.status).toBe('ok');
    expect(typeof orgChartPayload.result?.orgchart === 'string').toBeTruthy();
    expect((orgChartPayload.result?.orgchart?.length ?? 0) > 0).toBeTruthy();
  }

  await expect(
    page.getByRole('button', { name: /back to jobs/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /salesforce/i }),
  ).toBeVisible();
  await expect(page.getByText(/Total .*profiles/i).first()).toBeVisible();
  await expect(page.locator('.orgchart-diagram').first()).toBeVisible();
  await expect(page.locator('.orgchart-diagram canvas').first()).toBeVisible();

  await page.screenshot({
    path: 'run_results/salesforce-orgchart-final.png',
    fullPage: true,
  });
});
