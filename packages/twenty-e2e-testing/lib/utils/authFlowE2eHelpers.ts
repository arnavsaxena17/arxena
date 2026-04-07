import { expect, type BrowserContext, type Page, type Request } from '@playwright/test';
import { execSync } from 'node:child_process';

import { LoginPage } from '../pom/loginPage';

export const DEFAULT_E2E_PASSWORD = 'Applecar2025';
export const DEFAULT_ONBOARDING_APP_BASE_URL =
  process.env.ARXENA_E2E_ONBOARDING_BASE_URL ||
  process.env.WORKSPACE_ORIGIN ||
  'http://app.localhost:3001';
export const DEFAULT_SIGNIN_APP_BASE_URL =
  process.env.ARXENA_E2E_BASE_URL || 'http://testing-arxena.localhost:3001';

const authTokenByContext = new WeakMap<BrowserContext, string>();

const maybeCaptureAuthTokenFromRequest = (
  context: BrowserContext,
  request: Request,
) => {
  const url = request.url();
  if (
    !url.includes('/candidate-sourcing/get-all-jobs') &&
    !url.endsWith('/graphql')
  ) {
    return;
  }

  const authorization =
    request.headers()['authorization'] ?? request.headers()['Authorization'];
  if (!authorization?.startsWith('Bearer ')) {
    return;
  }

  authTokenByContext.set(context, authorization.slice('Bearer '.length));
};

export const getCachedAuthTokenFromRequests = (context: BrowserContext) =>
  authTokenByContext.get(context) ?? null;

const maybeClick = async (
  locator: ReturnType<Page['getByRole']> | ReturnType<Page['getByText']>,
) => {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }

  return false;
};

const revealEmailAuthStep = async (
  page: Page,
  loginPage: LoginPage,
  emailInput: ReturnType<Page['locator']>,
  targetUrlPattern: RegExp,
) => {
  if (await emailInput.isVisible().catch(() => false)) {
    return;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await emailInput.isVisible().catch(() => false)) {
      return;
    }

    if (targetUrlPattern.test(page.url())) {
      return;
    }

    if (await loginPage.hasVisibleLoginWithEmailButton()) {
      try {
        await loginPage.clickLoginWithEmail();
      } catch {
        await page.waitForTimeout(500);
      }
    }

    await Promise.race([
      emailInput.waitFor({ state: 'visible', timeout: 7_500 }),
      page.waitForURL(targetUrlPattern, { timeout: 7_500 }),
    ]).catch(() => {});

    if (await emailInput.isVisible().catch(() => false)) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(
    `Email sign-in step did not appear after clicking Continue with Email. currentUrl=${page.url()}`,
  );
};

const hasTokenPairCookie = async (context: BrowserContext, baseUrl: string) => {
  const cookies = await context.cookies([baseUrl]).catch(() => []);

  return cookies.some((cookie) => cookie.name === 'tokenPair' && Boolean(cookie.value));
};

const isBackendUnavailableUiVisible = async (page: Page) => {
  const title = page.getByText(/unable to reach back-end/i).first();
  if (await title.isVisible().catch(() => false)) {
    return true;
  }

  return page.getByText(/failed to fetch/i).first().isVisible().catch(() => false);
};

const recoverBackendUnavailableUi = async (page: Page) => {
  const reloadButton = page.getByRole('button', { name: /reload/i }).first();

  if (await reloadButton.isVisible().catch(() => false)) {
    await reloadButton.click().catch(() => false);
    return;
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
};

const waitForInitialAuthUi = async (
  page: Page,
  loginPage: LoginPage,
  emailInput: ReturnType<Page['locator']>,
  passwordInput: ReturnType<Page['locator']>,
  targetUrlPattern: RegExp,
) => {
  await expect
    .poll(
      async () => {
        if (targetUrlPattern.test(page.url())) {
          return 'target';
        }

        if (await loginPage.hasVisibleLoginWithEmailButton()) {
          return 'auth-button';
        }

        if (await emailInput.isVisible().catch(() => false)) {
          return 'email';
        }

        if (await passwordInput.isVisible().catch(() => false)) {
          return 'password';
        }

        if (await isBackendUnavailableUiVisible(page)) {
          await recoverBackendUnavailableUi(page);
          return 'recovering-backend';
        }

        return 'waiting';
      },
      {
        timeout: 30_000,
        message: 'Expected initial auth UI to render on the welcome page',
      },
    )
    .not.toBe('waiting');
};

const isJobsUiVisible = async (page: Page) => {
  const jobsHeading = page.getByRole('heading', { name: /jobs/i }).first();
  if (await jobsHeading.isVisible().catch(() => false)) {
    return true;
  }

  const activeJobsText = page.getByText(/active jobs/i).first();
  if (await activeJobsText.isVisible().catch(() => false)) {
    return true;
  }

  return false;
};

export const getNextAppleIndex = () => {
  const output = execSync(
    `PGPASSWORD=postgres psql -h localhost -U postgres -d default -t -A -c "select coalesce(max(nullif(substring(email from '^apple([0-9]+)@apple\\\\.com$'), '')::int), 0) from core.\\"user\\" where email ~ '^apple[0-9]+@apple\\\\.com$';"`,
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();

  const maxIndex = Number.parseInt(output, 10);

  return Number.isNaN(maxIndex) ? 1 : maxIndex + 1;
};

export const clickSkipOnPhoneStep = async (page: Page) => {
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

export const signUpAndReachIntentChoice = async (
  page: Page,
  input: {
    email: string;
    workspaceSuffix: string;
    password?: string;
    baseUrl?: string;
  },
) => {
  const baseUrl = input.baseUrl ?? DEFAULT_ONBOARDING_APP_BASE_URL;
  const password = input.password ?? DEFAULT_E2E_PASSWORD;

  await page.goto(`${baseUrl}/welcome`);
  await page.waitForLoadState('domcontentloaded');

  await maybeClick(page.getByRole('button', { name: 'Continue with Email' }));

  await page.getByPlaceholder('Email').fill(input.email);
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
  await page.getByPlaceholder('Apple').fill(`Apple ${input.workspaceSuffix}`);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Create profile')).toBeVisible({
    timeout: 120_000,
  });
  await page.locator('input[placeholder="Tim"]').first().fill('Apple');
  await page.locator('input[placeholder="Cook"]').first().fill(
    input.workspaceSuffix,
  );
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
        message: 'Expected onboarding to reach phone collection or intent choice',
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
};

export const signInWithExistingCredentials = async (
  page: Page,
  input?: {
    email?: string;
    password?: string;
    targetPath?: string;
    baseUrl?: string;
  },
) => {
  const context = page.context();
  const baseUrl = input?.baseUrl ?? DEFAULT_SIGNIN_APP_BASE_URL;
  const email =
    input?.email ?? (process.env.ARXENA_E2E_EMAIL || 'testing@arxena.com');
  const password =
    input?.password ??
    (process.env.ARXENA_E2E_PASSWORD || DEFAULT_E2E_PASSWORD);
  const targetPath = input?.targetPath ?? '/jobs';
  const loginPage = new LoginPage(page);
  const targetUrlPattern = new RegExp(`${targetPath}(?:[/?#]|$)`);
  const requestListener = (request: Request) =>
    maybeCaptureAuthTokenFromRequest(context, request);

  context.on('request', requestListener);

  try {
    await context.clearCookies();

    await page.goto(`${baseUrl}/welcome`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });

    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    const emailInput = page
      .locator('input[placeholder="Email"], input[type="email"], input[name="email"]')
      .first();
    const passwordInput = page
      .locator('input[placeholder="Password"], input[type="password"]')
      .first();

    await waitForInitialAuthUi(
      page,
      loginPage,
      emailInput,
      passwordInput,
      targetUrlPattern,
    );

    if (await loginPage.hasVisibleLoginWithEmailButton()) {
      await revealEmailAuthStep(page, loginPage, emailInput, targetUrlPattern);
    } else {
      await Promise.race([
        emailInput.waitFor({ state: 'visible', timeout: 30_000 }),
        passwordInput.waitFor({ state: 'visible', timeout: 30_000 }),
        page.waitForURL(targetUrlPattern, { timeout: 30_000 }),
      ]).catch(() => {});
    }

    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(email);
      await loginPage.clickContinueButton();

      await Promise.race([
        passwordInput.waitFor({ state: 'visible', timeout: 30_000 }),
        page.waitForURL(targetUrlPattern, { timeout: 30_000 }),
      ]).catch(() => {});

      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.fill(password);
        await loginPage.submitPasswordStep();
        await Promise.race([
          page.waitForURL(targetUrlPattern, { timeout: 30_000 }),
          expect
            .poll(async () => hasTokenPairCookie(context, baseUrl), {
              timeout: 30_000,
              message: 'Expected tokenPair auth cookie after password submit',
            })
            .toBe(true),
        ]).catch(() => {});
      }
    } else if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill(password);
      await loginPage.submitPasswordStep();
      await Promise.race([
        page.waitForURL(targetUrlPattern, { timeout: 30_000 }),
        expect
          .poll(async () => hasTokenPairCookie(context, baseUrl), {
            timeout: 30_000,
            message: 'Expected tokenPair auth cookie after password submit',
          })
          .toBe(true),
      ]).catch(() => {});
    }

    const hasAuthCookie = await hasTokenPairCookie(context, baseUrl);

    if (!targetUrlPattern.test(page.url()) && hasAuthCookie) {
      await page.goto(`${baseUrl}${targetPath}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
    }

    if (targetPath === '/jobs') {
      await expect
        .poll(
          async () => {
            if (await isJobsUiVisible(page)) {
              return 'jobs';
            }

            if (/\/welcome(?:[/?#]|$)/.test(page.url())) {
              return 'welcome';
            }

            if (await loginPage.hasVisibleLoginWithEmailButton()) {
              return 'auth-button';
            }

            if (await emailInput.isVisible().catch(() => false)) {
              return 'email';
            }

            if (await passwordInput.isVisible().catch(() => false)) {
              return 'password';
            }

            return page.url();
          },
          {
            timeout: 90_000,
            message: 'Expected authenticated jobs UI after sign-in',
          },
        )
        .toBe('jobs');
    } else {
      await expect
        .poll(
          async () => {
            if (/\/welcome(?:[/?#]|$)/.test(page.url())) {
              return 'welcome';
            }

            if (await loginPage.hasVisibleLoginWithEmailButton()) {
              return 'auth-button';
            }

            if (await emailInput.isVisible().catch(() => false)) {
              return 'email';
            }

            if (await passwordInput.isVisible().catch(() => false)) {
              return 'password';
            }

            if (targetUrlPattern.test(page.url())) {
              return 'target';
            }

            return page.url();
          },
          {
            timeout: 90_000,
            message: `Expected authenticated navigation to ${targetPath}`,
          },
        )
        .toBe('target');
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  } finally {
    context.off('request', requestListener);
  }
};
