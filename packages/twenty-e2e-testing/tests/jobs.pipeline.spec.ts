import { expect, test, type Page } from '@playwright/test';

import { LoginPage } from '../lib/pom/loginPage';

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
  await page.waitForLoadState('networkidle', { timeout: 90_000 });

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

  await page.getByRole('option', { name: /salesforce/i }).first().click();

  const orgChartResponse = await page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }

    if (!response.ok()) {
      return false;
    }

    const url = response.url();
    if (!/\/org-chart\/[^/?#]+/.test(url)) {
      return false;
    }
    if (
      url.includes('/companies/') ||
      url.includes('/company-logo') ||
      url.includes('/employee-count')
    ) {
      return false;
    }

    const contentType = response.headers()['content-type'] ?? '';
    return contentType.includes('application/json');
  });

  const orgChartPayload = (await orgChartResponse.json()) as {
    status?: string;
    result?: { orgchart?: string };
  };
  expect(orgChartPayload.status).toBe('ok');
  expect(typeof orgChartPayload.result?.orgchart === 'string').toBeTruthy();
  expect((orgChartPayload.result?.orgchart?.length ?? 0) > 0).toBeTruthy();

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
