import { expect, test } from '@playwright/test';

test.use({
  storageState: { cookies: [], origins: [] },
});

test('Create account, onboard, reach jobs, then delete account', async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);

  const email = `e2e_${Date.now()}@arxena-e2e.test`;
  const password = 'Applecar2025';
  const workspaceName = `E2E ${Date.now()}`;
  const firstName = 'E2E';
  const lastName = 'User';

  await context.clearCookies();

  await page.goto('/welcome');
  await page.waitForLoadState('domcontentloaded');

  const continueWithEmailButton = page.getByRole('button', {
    name: 'Continue with Email',
  });
  if (await continueWithEmailButton.isVisible().catch(() => false)) {
    await continueWithEmailButton.click();
  }

  await page.getByPlaceholder('Email').fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await page.getByPlaceholder('Password').fill(password);

  const signUpButton = page.getByRole('button', { name: 'Sign up' });
  if (await signUpButton.isVisible().catch(() => false)) {
    await signUpButton.click();
  } else {
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }

  for (let i = 0; i < 15; i += 1) {
    const isOnJobsPage =
      /\/jobs(?:[/?#]|$)/.test(page.url()) ||
      (await page.getByText('Your workspace is ready').isVisible().catch(() => false)) ||
      (await page.getByRole('link', { name: 'All Jobs' }).isVisible().catch(() => false));

    if (isOnJobsPage) {
      break;
    }

    if (await page.getByText('Create your workspace').isVisible().catch(() => false)) {
      const wsInput = page.getByPlaceholder('Apple');
      await wsInput.click();
      await wsInput.pressSequentially(workspaceName, { delay: 50 });
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Continue' }).click({ timeout: 10_000, noWaitAfter: true }).catch(() => {});
      await page.waitForTimeout(2_000);
      continue;
    }

    if (await page.getByText('Create profile').isVisible().catch(() => false)) {
      const firstInput = page.locator('input[placeholder="Tim"]').first();
      await firstInput.click();
      await firstInput.pressSequentially(firstName, { delay: 50 });
      const lastInput = page.locator('input[placeholder="Cook"]').first();
      await lastInput.click();
      await lastInput.pressSequentially(lastName, { delay: 50 });
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Continue' }).click({ timeout: 10_000, noWaitAfter: true }).catch(() => {});
      await page.waitForTimeout(2_000);
      continue;
    }

    if (await page.getByText('Install Arxena App').isVisible().catch(() => false)) {
      await page.getByRole('link', { name: 'Skip' }).first().click();
      await page.waitForTimeout(2_000);
      continue;
    }

    if (await page.getByText('Connect LinkedIn').isVisible().catch(() => false)) {
      await page.getByRole('link', { name: 'Skip' }).first().click();
      await page.waitForTimeout(2_000);
      continue;
    }

    if (await page.getByText('Emails and Calendar').isVisible().catch(() => false)) {
      await page.getByRole('link', { name: 'Continue without sync' }).click();
      await page.waitForTimeout(2_000);
      continue;
    }

    if (await page.getByText('Invite your team').isVisible().catch(() => false)) {
      await page.getByRole('link', { name: 'Skip' }).first().click();
      await page.waitForTimeout(2_000);
      continue;
    }

    await page.waitForTimeout(1_000);
  }

  await page.waitForURL(/\/jobs(?:[/?#]|$)/, { timeout: 120_000 });
  await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/);

  await page.screenshot({
    path: 'run_results/new-account-jobs-final.png',
    fullPage: true,
  });

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForURL(/\/settings(?:\/.*)?/, { timeout: 30_000 });
  await page.getByRole('link', { name: 'Profile' }).click();

  await expect(page.getByRole('button', { name: 'Delete account' })).toBeVisible();
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
