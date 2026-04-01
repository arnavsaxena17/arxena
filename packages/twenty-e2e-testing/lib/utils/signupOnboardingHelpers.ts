import { expect, type Locator, type Page } from '@playwright/test';

import { logStage, logStageFailure } from '../e2eLogging';

const defaultSignupPassword = (): string =>
  process.env.DEFAULT_PASSWORD?.trim() || 'Applecar2025';

const maybeClick = async (locator: Locator) => {
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

export type SignUpToIntentChoiceProfile = {
  /** Value for the workspace name field (e.g. `Apple my-workspace`). */
  workspaceDisplayName: string;
  firstName: string;
  lastName: string;
};

export type SignUpToIntentChoiceOptions = {
  password?: string;
  /** Optional delay before Continue on the profile step (helps with flaky renders). */
  debounceMsBeforeProfileContinue?: number;
};

/**
 * Email/password signup through workspace + profile + optional phone skip until
 * `/create/intent` and the intent-choice screen is visible.
 */
export const signUpAndReachIntentChoice = async (
  page: Page,
  appUrl: string,
  email: string,
  profile: SignUpToIntentChoiceProfile,
  options: SignUpToIntentChoiceOptions = {},
): Promise<void> => {
  const base = appUrl.replace(/\/$/, '');
  const password = options.password ?? defaultSignupPassword();
  const debounceMs = options.debounceMsBeforeProfileContinue ?? 0;

  logStage('signUpAndReachIntentChoice: start', {
    appUrl: base,
    email,
  });

  try {
    await page.goto(`${base}/welcome`);
    await page.waitForLoadState('domcontentloaded');

    await maybeClick(page.getByRole('button', { name: 'Continue with Email' }));

    await page.getByPlaceholder('Email').fill(email);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(page.getByPlaceholder('Password')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByPlaceholder('Password').fill(password);

    if (!(await maybeClick(page.getByRole('button', { name: 'Sign up' })))) {
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }

    await expect(page.getByText('Create your workspace')).toBeVisible({
      timeout: 120_000,
    });
    await page.getByPlaceholder('Apple').fill(profile.workspaceDisplayName);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Create profile')).toBeVisible({
      timeout: 120_000,
    });
    await page.locator('input[placeholder="Tim"]').first().fill(profile.firstName);
    await page.locator('input[placeholder="Cook"]').first().fill(profile.lastName);

    if (debounceMs > 0) {
      await page.waitForTimeout(debounceMs);
    }

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
    logStage('signUpAndReachIntentChoice: done', { appUrl: base });
  } catch (error) {
    logStageFailure('signUpAndReachIntentChoice', error, {
      appUrl: base,
      email,
    });
    throw error;
  }
};
