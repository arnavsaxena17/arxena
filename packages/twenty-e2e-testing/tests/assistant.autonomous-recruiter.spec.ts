import { expect, test } from '@playwright/test';

import { LoginPage } from '../lib/pom/loginPage';

test.use({ storageState: { cookies: [], origins: [] } });

const goToAssistantPage = async (page: import('@playwright/test').Page) => {
  // Navigate to jobs first (same pattern as other tests) then go to /assistant
  if (!/\/jobs(?:[/?#]|$)/.test(page.url())) {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }
  await page.waitForURL(/\/jobs(?:[\/?#]|$)/, { timeout: 60_000 }).catch(() => {});

  await page.goto('/assistant', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForURL(/\/assistant(?:[\/?#]|$)/, { timeout: 60_000 });
};

test('Assistant: recruiter prompt runs autonomous recruiter demo-thread end-to-end', async ({
  page,
}) => {
  test.setTimeout(240_000);

  const login = process.env.DEFAULT_LOGIN || 'arnav@arxena.com';
  const password = process.env.DEFAULT_PASSWORD || 'Applecar2025';

  expect(login, 'DEFAULT_LOGIN must be set').toBeTruthy();
  expect(password, 'DEFAULT_PASSWORD must be set').toBeTruthy();

  const loginPage = new LoginPage(page);

  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });

  const isAlreadyInApp = () =>
    /\/(welcome|jobs|assistant)(?:[\/?#]|$)/.test(page.url());

  if (!isAlreadyInApp()) {
    if (await loginPage.hasVisibleLoginWithEmailButton()) {
      await loginPage.clickLoginWithEmail();
    }

    const emailFieldVisible = await page
      .locator('input[placeholder="Email"], input[type="email"], input[name="email"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (emailFieldVisible) {
      await loginPage.typeEmail(login as string);
      await loginPage.clickContinueButton();

      // Reuse the simple password step logic from other tests
      const passwordField = page
        .locator('input[placeholder="Password"], input[type="password"], input[name="password"]')
        .first();
      const passwordVisible = await passwordField.isVisible().catch(() => false);
      if (passwordVisible) {
        await loginPage.typePassword(password as string);
        await loginPage.submitPasswordStep();
      }
    }
  }

  await goToAssistantPage(page);

  // Ensure the Assistant header and mode selector are visible
  await expect(page.getByRole('heading', { name: 'Assistant' })).toBeVisible();
  await expect(page.getByText('Mode')).toBeVisible();

  // Click the "Start demo" button in the assistant chat column
  const startDemoButton = page.getByRole('button', { name: /Start demo/i }).first();
  await expect(startDemoButton).toBeVisible({ timeout: 30_000 });

  // Intercept the autonomous recruiter demo-thread call to ensure it happens
  const demoThreadRequestPromise = page.waitForRequest((request) => {
    return (
      request.method() === 'POST' &&
      request.url().includes('/autonomous-recruiter/demo-thread')
    );
  });

  await startDemoButton.click();

  const demoThreadRequest = await demoThreadRequestPromise;
  expect(demoThreadRequest.postDataJSON()?.requirement).toContain(
    'senior React developers in Bangalore',
  );

  // After the demo-thread finishes, the frontend reloads the assistant thread.
  // Wait for at least one assistant bubble that looks like the autonomous recruiter summary.
  const autonomousSummary = page.getByText(
    /I found 3 strong candidates for this requirement/i,
  );
  await expect(autonomousSummary).toBeVisible({ timeout: 120_000 });

  // Optionally, assert that the tool calls summary is rendered in the chat bubbles
  const toolCallsSummary = page.getByText(/Used: .*filter_candidates_for_job/i);
  await expect(toolCallsSummary).toBeVisible({ timeout: 120_000 });
});

