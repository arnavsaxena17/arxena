import { expect, type Page } from '@playwright/test';

import { logStage, logStageFailure } from '../e2eLogging';

/**
 * Deletes the signed-in workspace user via Settings → Profile → Delete account.
 * Pass any `Page` with an authenticated session (e.g. the main app tab or a fresh page from the same context).
 *
 * `appUrl` must be the **workspace** app origin (scheme + host + port), e.g. from
 * `getWorkspaceAppOriginFromPageUrl(page.url())` after `/jobs` — not the generic entry host
 * when tenants use subdomains.
 */
export const deleteAccountViaSettings = async (
  page: Page,
  appUrl: string,
  email: string,
): Promise<void> => {
  const base = appUrl.replace(/\/$/, '');
  logStage('deleteAccountViaSettings: start', { appUrl: base, email });
  try {
    await page.goto(`${base}/jobs`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.waitForURL(/\/settings(?:\/.*)?/, { timeout: 30_000 });
    await page.getByRole('link', { name: 'Profile' }).click();

    await expect(
      page.getByRole('button', { name: 'Delete account' }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Delete account' }).click();

    await page.getByTestId('confirmation-modal-input').fill(email);
    await page.getByTestId('confirmation-modal-confirm-button').click();

    await page.waitForURL(/\/welcome(?:[/?#]|$)/, { timeout: 60_000 });
    await expect(page.getByPlaceholder('Email')).toBeVisible({
      timeout: 30_000,
    });
    logStage('deleteAccountViaSettings: done', { appUrl: base });
  } catch (error) {
    logStageFailure('deleteAccountViaSettings', error, { appUrl: base, email });
    throw error;
  }
};
