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
  firstName: string;
  lastName: string;
};

export type SignUpToIntentChoiceOptions = {
  password?: string;
  /** Optional delay before Continue on the profile step (helps with flaky renders). */
  debounceMsBeforeProfileContinue?: number;
};

/**
 * Email/password signup: after sign-up the app activates the workspace automatically,
 * then profile + optional phone skip until `/create/intent` and the intent-choice screen.
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

    await expect(page.getByText('Create profile')).toBeVisible({
      timeout: 120_000,
    });
    await page.locator('input[placeholder="Tim"]').first().fill(profile.firstName);
    await page.locator('input[placeholder="Cook"]').first().fill(profile.lastName);

    if (debounceMs > 0) {
      await page.waitForTimeout(debounceMs);
    }

    const profileContinueButton = page.getByRole('button', { name: 'Continue' });
    const profileUrlPattern = /\/create\/profile(?:[/?#]|$)/;
    await profileContinueButton.click();

    const phoneHeading = page.getByText('Add your phone number');
    const intentUrlPattern = /\/create\/intent(?:[/?#]|$)/;
    const phoneUrlPattern = /\/create\/phone(?:[/?#]|$)/;

    await expect
      .poll(
        async () => {
          if (intentUrlPattern.test(page.url())) {
            return 'intent';
          }

          if (phoneUrlPattern.test(page.url())) {
            return 'phone';
          }

          if (await phoneHeading.isVisible().catch(() => false)) {
            return 'phone';
          }

          if (
            profileUrlPattern.test(page.url()) &&
            (await profileContinueButton.isVisible().catch(() => false))
          ) {
            await profileContinueButton.click().catch(() => false);
          }

          return 'waiting';
        },
        {
          timeout: 120_000,
          message:
            'Expected onboarding to reach phone collection or intent choice',
        },
      )
      .not.toBe('waiting');

    if (await phoneHeading.isVisible().catch(() => false)) {
      await clickSkipOnPhoneStep(page);
    } else if (phoneUrlPattern.test(page.url())) {
      const skipForNowLink = page.getByRole('link', { name: 'Skip for now' });
      if (await skipForNowLink.isVisible().catch(() => false)) {
        await skipForNowLink.click();
      } else {
        await clickSkipOnPhoneStep(page);
      }
    }

    await page.waitForURL(intentUrlPattern, {
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
