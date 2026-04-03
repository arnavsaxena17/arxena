import { expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { LoginPage } from '../pom/loginPage';

export const testingArxenaStorageStatePath = path.resolve(
  __dirname,
  '..',
  '..',
  '.auth',
  'testing-arxena-user.json',
);

if (!fs.existsSync(testingArxenaStorageStatePath)) {
  fs.mkdirSync(path.dirname(testingArxenaStorageStatePath), { recursive: true });
  fs.writeFileSync(
    testingArxenaStorageStatePath,
    JSON.stringify({ cookies: [], origins: [] }, null, 2),
  );
}

export const saveStorageState = async (context: BrowserContext) => {
  await context.storageState({ path: testingArxenaStorageStatePath });
};

export const isVisible = async (locator: ReturnType<Page['locator']>) =>
  locator.isVisible().catch(() => false);

export const isOnJobsUi = async (page: Page) => {
  const jobsHeading = page.getByRole('heading', { name: /jobs/i }).first();
  if (await isVisible(jobsHeading)) {
    return true;
  }

  const activeJobsText = page.getByText(/active jobs/i).first();
  if (await isVisible(activeJobsText)) {
    return true;
  }

  const companySearchInput = page
    .getByPlaceholder('Search company for org charts...')
    .first();

  return isVisible(companySearchInput);
};

export const isOnAuthUi = async (page: Page) => {
  if (/\/welcome(?:[/?#]|$)/.test(page.url())) {
    return true;
  }

  const continueWithEmail = page
    .getByRole('button', { name: /continue with email/i })
    .first();
  if (await isVisible(continueWithEmail)) {
    return true;
  }

  const emailInput = page
    .locator('input[placeholder="Email"], input[type="email"], input[name="email"]')
    .first();
  if (await isVisible(emailInput)) {
    return true;
  }

  return isVisible(page.getByText(/welcome to /i).first());
};

export const waitForAuthOrJobsUi = async (page: Page, timeoutMs = 30_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isOnJobsUi(page)) {
      return 'jobs' as const;
    }

    if (await isOnAuthUi(page)) {
      return 'auth' as const;
    }

    await page.waitForTimeout(500);
  }

  throw new Error('Timed out waiting for either auth UI or jobs UI');
};

export const completeOnboardingIfNeeded = async (page: Page) => {
  for (let i = 0; i < 12; i += 1) {
    if (await isOnJobsUi(page)) {
      return;
    }

    const signInButton = page.getByRole('button', { name: /^sign in$/i }).first();
    if (await isVisible(signInButton)) {
      const isDisabled = await signInButton.isDisabled().catch(() => false);
      if (isDisabled) {
        const consentToggle = page
          .locator(
            'button[role="switch"], [role="checkbox"], input[type="checkbox"]',
          )
          .first();
        if (await isVisible(consentToggle)) {
          await consentToggle.click();
        }
      }

      if (!(await signInButton.isDisabled().catch(() => true))) {
        await signInButton.click();
        await page.waitForTimeout(1_000);
        continue;
      }
    }

    if (await isVisible(page.getByText('Create your workspace').first())) {
      await page.getByPlaceholder('Apple').first().fill(`E2E ${Date.now()}`);
      const continueButton = page
        .locator('button:has-text("Continue"):not([disabled])')
        .first();
      if (await isVisible(continueButton)) {
        await continueButton.click();
      }
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Create profile').first())) {
      await page
        .locator('input[placeholder*="First"], input[placeholder="Tim"]')
        .first()
        .fill('Testing');
      await page
        .locator('input[placeholder*="Last"], input[placeholder="Cook"]')
        .first()
        .fill('Arxena');
      const continueButton = page
        .locator('button:has-text("Continue"):not([disabled])')
        .first();
      if (await isVisible(continueButton)) {
        await continueButton.click();
      }
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Install Arxena App').first())) {
      await page.getByRole('link', { name: /^skip$/i }).first().click();
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Connect LinkedIn').first())) {
      await page.getByRole('link', { name: /^skip$/i }).first().click();
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Emails and Calendar').first())) {
      await page
        .getByRole('link', { name: /continue without sync/i })
        .first()
        .click();
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await isVisible(page.getByText('Invite your team').first())) {
      await page.getByRole('link', { name: /^skip$/i }).first().click();
      await page.waitForTimeout(1_000);
      continue;
    }

    await page.waitForTimeout(1_000);
  }
};

export const ensureAuthenticatedJobsPage = async (
  page: Page,
  context: BrowserContext,
  input?: {
    baseUrl?: string;
    email?: string;
    password?: string;
  },
) => {
  const baseUrl = input?.baseUrl ?? process.env.WORKSPACE_ORIGIN ?? 'http://localhost:3001';
  const email = input?.email ?? process.env.DEFAULT_LOGIN ?? 'testing@arxena.com';
  const password = input?.password ?? process.env.DEFAULT_PASSWORD ?? 'Applecar2025';
  const loginPage = new LoginPage(page);

  await page.goto(`${baseUrl}/jobs`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });

  const landingUi = await waitForAuthOrJobsUi(page, 30_000);

  if (landingUi === 'jobs') {
    await saveStorageState(context);
    return;
  }

  if (await loginPage.hasVisibleLoginWithEmailButton()) {
    await loginPage.clickLoginWithEmail();
  }

  const emailInput = page
    .locator('input[placeholder="Email"], input[type="email"], input[name="email"]')
    .first();
  await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  await emailInput.fill(email);

  const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
  if (await isVisible(continueButton)) {
    await continueButton.click();
  }

  const passwordInput = page
    .locator('input[placeholder="Password"], input[type="password"]')
    .first();
  await passwordInput.waitFor({ state: 'visible', timeout: 30_000 });
  await passwordInput.fill(password);

  const signInButton = page.getByRole('button', { name: /^sign in$/i }).first();
  if (await isVisible(signInButton)) {
    await signInButton.click();
  } else if (await isVisible(continueButton)) {
    await continueButton.click();
  } else {
    await passwordInput.press('Enter');
  }

  await completeOnboardingIfNeeded(page);
  await expect(page.getByPlaceholder('Search company for org charts...').first()).toBeVisible({
    timeout: 90_000,
  });
  await saveStorageState(context);
};

export const getAuthToken = async (context: BrowserContext) => {
  const storageState = await context.storageState();
  const authCookie = storageState.cookies.find(
    (cookie) => cookie.name === 'tokenPair',
  );

  if (!authCookie) {
    throw new Error('No tokenPair auth cookie found');
  }

  return JSON.parse(decodeURIComponent(authCookie.value)).accessToken.token as string;
};

export const collectDeepStrings = (value: unknown, output: string[] = []) => {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectDeepStrings(item, output);
    }
    return output;
  }

  if (value && typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      collectDeepStrings(nestedValue, output);
    }
  }

  return output;
};
