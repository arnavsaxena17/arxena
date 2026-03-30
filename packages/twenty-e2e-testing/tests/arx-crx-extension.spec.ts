import { expect, test, chromium, type BrowserContext, type Locator, type Page } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const APP_URL = 'http://app.localhost:3001';
const EXTENSION_DIST_PATH = '/Users/arnavsaxena/MEGA/arx/arx-crx/dist';
const PASSWORD = 'Applecar2025';

const maybeClick = async (locator: Locator) => {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }

  return false;
};

const clickSkipOnPhoneStep = async (
  page: Page,
) => {
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

const createUniqueAppleIdentity = () => {
  const uniqueSuffix =
    Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 10) || 'eetest';

  return {
    email: `applee2e${uniqueSuffix}@apple.com`,
    workspaceName: `Apple ${uniqueSuffix}`,
    firstName: 'Apple',
    lastName: `Runner${uniqueSuffix}`,
  };
};

const getExtensionId = async (context: BrowserContext) => {
  let [serviceWorker] = context.serviceWorkers();

  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  return new URL(serviceWorker.url()).host;
};

const launchExtensionContext = async () => {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'arx-crx-playwright-profile-'),
  );

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIST_PATH}`,
      `--load-extension=${EXTENSION_DIST_PATH}`,
    ],
  });

  return { context, userDataDir };
};

const waitForContentScriptPong = async (
  context: BrowserContext,
  expectedExtensionId: string,
) => {
  const page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

  const extensionIdFromPage = await page.evaluate(async () => {
    return await new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Timed out waiting for EXTENSION_PONG'));
      }, 15_000);

      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window) {
          return;
        }

        if (event.data?.type === 'EXTENSION_PONG') {
          window.clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          resolve(String(event.data.extensionId ?? ''));
        }
      };

      window.addEventListener('message', handleMessage);
      window.postMessage({ type: 'EXTENSION_PING' }, window.location.origin);
    });
  });

  expect(extensionIdFromPage).toBe(expectedExtensionId);
  await page.close();
};

const waitForExtensionStorageValue = async (
  context: BrowserContext,
  key: string,
  predicate: (value: unknown) => boolean = (value) => Boolean(value),
) => {
  let [serviceWorker] = context.serviceWorkers();

  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  await expect
    .poll(
      async () => {
        const value = await serviceWorker.evaluate(
          async ({ storageKey }) => {
            const result = await chrome.storage.local.get([storageKey]);
            return result[storageKey] ?? null;
          },
          { storageKey: key },
        );

        return predicate(value);
      },
      { timeout: 30_000 },
    )
    .toBe(true);
};

const openExtensionPopupAsInactiveTab = async (
  context: BrowserContext,
  extensionId: string,
) => {
  let [serviceWorker] = context.serviceWorkers();

  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const popupPagePromise = context.waitForEvent('page');

  await serviceWorker.evaluate(
    async ({ popupUrl }) => {
      await chrome.tabs.create({ url: popupUrl, active: false });
    },
    { popupUrl: `chrome-extension://${extensionId}/index.html` },
  );

  const popupPage = await popupPagePromise;
  await popupPage.waitForLoadState('domcontentloaded');

  return popupPage;
};

const signUpAndReachJobs = async (
  page: Page,
) => {
  const identity = createUniqueAppleIdentity();

  await page.goto(`${APP_URL}/welcome`);
  await page.waitForLoadState('domcontentloaded');

  await maybeClick(page.getByRole('button', { name: 'Continue with Email' }));

  await page.getByPlaceholder('Email').fill(identity.email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.getByPlaceholder('Password')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByPlaceholder('Password').fill(PASSWORD);

  if (!(await maybeClick(page.getByRole('button', { name: 'Sign up' })))) {
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }

  await expect(page.getByText('Create your workspace')).toBeVisible({
    timeout: 120_000,
  });
  await page.getByPlaceholder('Apple').fill(identity.workspaceName);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Create profile')).toBeVisible({
    timeout: 120_000,
  });
  await page.locator('input[placeholder="Tim"]').first().fill(identity.firstName);
  await page.locator('input[placeholder="Cook"]').first().fill(identity.lastName);
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

  await page.getByRole('button', { name: 'Building my team' }).click();
  await page.waitForURL(/\/create\/extension-install(?:[/?#]|$)/, {
    timeout: 120_000,
  });
  await expect(page.getByTestId('onboarding-path-extension-install')).toBeVisible({
    timeout: 120_000,
  });

  await page.getByRole('button', { name: 'Go to jobs' }).click();
  await page.waitForURL(/http:\/\/[^/]+\.localhost:3001\/jobs(?:[/?#]|$)/, {
    timeout: 120_000,
  });
  await expect(page).toHaveURL(/http:\/\/[^/]+\.localhost:3001\/jobs(?:[/?#]|$)/);
};

test('ARX CRX injects on app.localhost and shows the signed-out popup', async () => {
  test.setTimeout(120_000);

  const launched = await launchExtensionContext();
  let context: BrowserContext | undefined = launched.context;

  try {
    const extensionId = await getExtensionId(context);

    await waitForContentScriptPong(context, extensionId);

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/index.html`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      popupPage.getByText('You are not signed in or token expired'),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await context?.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
});

test('ARX CRX shows the logged-in popup after a fresh onboarding flow reaches jobs', async () => {
  test.setTimeout(300_000);

  const launched = await launchExtensionContext();
  let context: BrowserContext | undefined = launched.context;

  try {
    const extensionId = await getExtensionId(context);
    const jobsPage = await context.newPage();

    await signUpAndReachJobs(jobsPage);
    await waitForContentScriptPong(context, extensionId);

    await jobsPage.bringToFront();
    await pageWaitForAWhile();
    await waitForExtensionStorageValue(context, 'auth_token');
    await waitForExtensionStorageValue(context, 'origin');

    const popupPage = await openExtensionPopupAsInactiveTab(context, extensionId);

    await expect(
      popupPage.getByText('You are now logged in. What do you want to do?'),
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    await context?.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
});

async function pageWaitForAWhile() {
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
