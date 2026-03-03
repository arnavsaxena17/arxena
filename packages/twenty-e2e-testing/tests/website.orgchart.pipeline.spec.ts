import { expect, test } from '@playwright/test';

test('Logged-out website loads Salesforce org chart and captures screenshot', async ({
  page,
}) => {
  const websiteBaseUrl = process.env.WEBSITE_BASE_URL || 'http://localhost:3002';
  await page.goto(websiteBaseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

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
  await searchInput.fill('salesforce');

  const autocompleteResponse = await autocompleteResponsePromise;
  expect(autocompleteResponse.ok()).toBeTruthy();

  await page.getByRole('option', { name: /salesforce/i }).first().click();

  await page.waitForURL(/\/org-chart\/[^/?#]+/);
  await expect(page).toHaveURL(/\/org-chart\/[^/?#]+/);

  await expect(page.getByRole('heading', { level: 1, name: /salesforce/i })).toBeVisible();
  await expect(page.locator('.orgchart-diagram').first()).toBeVisible();
  await expect(page.locator('.orgchart-diagram canvas').first()).toBeVisible();

  await page.screenshot({
    path: 'run_results/salesforce-orgchart-website-final.png',
    fullPage: true,
  });
});
