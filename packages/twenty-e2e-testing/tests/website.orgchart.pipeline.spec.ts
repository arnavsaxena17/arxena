import { expect, test } from '@playwright/test';

test('Logged-out website loads Salesforce org chart and captures screenshot', async ({
  page,
}) => {
  await page.goto('/');

  const autocompleteResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === 'POST' &&
      response.url().includes('/api/org-chart/autocomplete')
    );
  });

  const searchInput = page.getByPlaceholder("Search any company's org chart");
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
