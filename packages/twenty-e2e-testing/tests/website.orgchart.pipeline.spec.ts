/**
 * Website org chart pipeline: Fetch full company, function-wise, geo-wise org charts.
 * Uses WEBSITE_BASE_URL. No login required.
 * Screenshots captured for each view.
 */
import { expect, test } from '@playwright/test';

const TEST_COMPANY = process.env.E2E_TEST_COMPANY || 'salesforce';

test('Website org chart pipeline: full company, function, geo views', async ({
  page,
}) => {
  test.setTimeout(120_000);

  const websiteBaseUrl =
    process.env.WEBSITE_BASE_URL || 'http://localhost:3002';
  await page.goto(websiteBaseUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  const autocompleteResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === 'POST' &&
      (response.url().includes('/api/org-chart/autocomplete') ||
        response.url().includes('/org-chart/companies/autocomplete'))
    );
  });

  const searchInput = page
    .locator(
      'input[placeholder*="Search any company"], input[placeholder*="Search company"], input[placeholder*="org chart"]',
    )
    .first();
  await expect(searchInput).toBeVisible();
  await searchInput.click();
  await searchInput.fill(TEST_COMPANY);

  const autocompleteResponse = await autocompleteResponsePromise;
  expect(autocompleteResponse.ok()).toBeTruthy();

  await page.getByRole('option', { name: new RegExp(TEST_COMPANY, 'i') }).first().click();

  await page.waitForURL(/\/org-chart\/[^/?#]+/);
  await expect(page).toHaveURL(/\/org-chart\/[^/?#]+/);

  await expect(
    page.getByRole('heading', { level: 1, name: new RegExp(TEST_COMPANY, 'i') }),
  ).toBeVisible();
  await expect(page.locator('.orgchart-diagram').first()).toBeVisible();
  await expect(page.locator('.orgchart-diagram canvas').first()).toBeVisible();

  await page.screenshot({
    path: 'run_results/website-01-full-company-orgchart.png',
    fullPage: true,
  });

  const countrySelect = page
    .locator('select')
    .filter({ has: page.locator('option') })
    .first();
  if (await countrySelect.isVisible().catch(() => false)) {
    const options = await countrySelect.locator('option').allTextContents();
    const nonGlobalOption = options.find(
      (o) =>
        o &&
        o.trim() &&
        !/^all$/i.test(o) &&
        !/^global($|\s|\))/i.test(o.trim()),
    );
    if (nonGlobalOption) {
      await countrySelect.selectOption({ label: nonGlobalOption });
      await page.waitForTimeout(3_000);
      await page.waitForURL(/\/org-chart\/[^/?#]+\/[^/?#]+/, { timeout: 30_000 });
      await page.screenshot({
        path: 'run_results/website-02-geo-view.png',
        fullPage: true,
      });
    }
  }

  const functionSelect = page
    .locator('select')
    .filter({ has: page.locator('option') })
    .nth(1);
  if (await functionSelect.isVisible().catch(() => false)) {
    const options = await functionSelect.locator('option').allTextContents();
    const nonFullCompanyOption = options.find(
      (o) =>
        o &&
        o.trim() &&
        !/^all$/i.test(o) &&
        !/^full\s*company($|\s|\))/i.test(o.trim()),
    );
    if (nonFullCompanyOption) {
      await functionSelect.selectOption({ label: nonFullCompanyOption });
      await page.waitForTimeout(3_000);
      await page.screenshot({
        path: 'run_results/website-03-function-view.png',
        fullPage: true,
      });
    }
  }

  await page.screenshot({
    path: 'run_results/website-04-final-orgchart.png',
    fullPage: true,
  });
});
