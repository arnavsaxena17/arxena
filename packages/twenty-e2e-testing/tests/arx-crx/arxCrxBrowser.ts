import { chromium, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { PASSWORD } from './arxCrxEnv';
import { logStage, logStageFailure } from './arxCrxLogging';

/**
 * Chromium window for extension E2E: headed vs headless.
 *
 * - Set `E2E_CRX_HEADLESS=1` / `true` / `yes` → headless (no UI).
 * - Set `E2E_CRX_HEADLESS=0` / `false` / `no` → headed (visible browser).
 * - When unset: headed locally; when `CI` is set (typical CI), headless unless you override with `E2E_CRX_HEADLESS=0`.
 */
export function getExtensionE2EHeadless(): boolean {
  const raw = process.env.E2E_CRX_HEADLESS?.trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') {
    return true;
  }
  if (raw === '0' || raw === 'false' || raw === 'no') {
    return false;
  }
  return Boolean(process.env.CI);
}

export const maybeClick = async (locator: Locator) => {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
};

export const clickSkipOnPhoneStep = async (page: Page) => {
  try {
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
  } catch (error) {
    logStageFailure('helper:clickSkipOnPhoneStep', error);
    throw error;
  }
};

export const createUniqueAppleIdentity = () => {
  const uniqueSuffix =
    Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 10) || 'eetest';

  return {
    email: `applee2e${uniqueSuffix}@apple.com`,
    workspaceName: `Apple ${uniqueSuffix}`,
    firstName: 'Apple',
    lastName: `Runner${uniqueSuffix}`,
  };
};

export const getExtensionId = async (context: BrowserContext) => {
  try {
    logStage('helper:getExtensionId: resolving service worker');
    let [serviceWorker] = context.serviceWorkers();

    if (!serviceWorker) {
      logStage('helper:getExtensionId: waiting for serviceworker event');
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const id = new URL(serviceWorker.url()).host;
    logStage('helper:getExtensionId: resolved', { extensionId: id });
    return id;
  } catch (error) {
    logStageFailure('helper:getExtensionId', error);
    throw error;
  }
};

export const launchExtensionContext = async (distDir: string) => {
  try {
    logStage('helper:launchExtensionContext: creating temp profile', { distDir });
    const userDataDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'arx-crx-playwright-profile-'),
    );
    const headless = getExtensionE2EHeadless();
    logStage('helper:launchExtensionContext: launching chromium', {
      userDataDir,
      headless,
    });

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless,
      args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`],
    });

    logStage('helper:launchExtensionContext: persistent context ready');
    return { context, userDataDir, headless };
  } catch (error) {
    logStageFailure('helper:launchExtensionContext', error, { distDir });
    throw error;
  }
};

export const waitForContentScriptPong = async (
  context: BrowserContext,
  appUrl: string,
  expectedExtensionId: string,
) => {
  logStage('helper:waitForContentScriptPong: new page + goto app', {
    appUrl,
    expectedExtensionId,
  });
  let page: Page | undefined;
  try {
    page = await context.newPage();
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    logStage('helper:waitForContentScriptPong: domcontentloaded, waiting for EXTENSION_PONG');

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
    logStage('helper:waitForContentScriptPong: pong matches extension id, closing temp page');
  } catch (error) {
    logStageFailure('helper:waitForContentScriptPong', error, {
      appUrl,
      expectedExtensionId,
    });
    throw error;
  } finally {
    await page?.close().catch(() => {});
  }
};

export const waitForExtensionStorageValue = async (
  context: BrowserContext,
  key: string,
  predicate: (value: unknown) => boolean = (value) => Boolean(value),
) => {
  try {
    logStage('helper:waitForExtensionStorageValue: start', { key });
    let [serviceWorker] = context.serviceWorkers();

    if (!serviceWorker) {
      logStage('helper:waitForExtensionStorageValue: waiting for serviceworker');
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
    logStage('helper:waitForExtensionStorageValue: predicate satisfied', { key });
  } catch (error) {
    logStageFailure('helper:waitForExtensionStorageValue', error, { key });
    throw error;
  }
};

export const openExtensionPopupAsInactiveTab = async (
  context: BrowserContext,
  extensionId: string,
) => {
  try {
    logStage('helper:openExtensionPopupAsInactiveTab: start', { extensionId });
    let [serviceWorker] = context.serviceWorkers();

    if (!serviceWorker) {
      logStage('helper:openExtensionPopupAsInactiveTab: waiting for serviceworker');
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const popupPagePromise = context.waitForEvent('page');
    logStage('helper:openExtensionPopupAsInactiveTab: chrome.tabs.create inactive popup');

    await serviceWorker.evaluate(
      async ({ popupUrl }) => {
        await chrome.tabs.create({ url: popupUrl, active: false });
      },
      { popupUrl: `chrome-extension://${extensionId}/index.html` },
    );

    const popupPage = await popupPagePromise;
    await popupPage.waitForLoadState('domcontentloaded');
    logStage('helper:openExtensionPopupAsInactiveTab: popup domcontentloaded');

    return popupPage;
  } catch (error) {
    logStageFailure('helper:openExtensionPopupAsInactiveTab', error, { extensionId });
    throw error;
  }
};

/** Open extension popup with a specific tab active (needed for popup LinkedIn context). */
export const openExtensionPopupWithActiveTab = async (
  context: BrowserContext,
  extensionId: string,
  targetPage: Page,
) => {
  try {
    logStage('helper:openExtensionPopupWithActiveTab: bringToFront + goto popup', {
      extensionId,
    });
    await targetPage.bringToFront();
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/index.html`, {
      waitUntil: 'domcontentloaded',
    });
    logStage('helper:openExtensionPopupWithActiveTab: popup ready');
    return popup;
  } catch (error) {
    logStageFailure('helper:openExtensionPopupWithActiveTab', error, { extensionId });
    throw error;
  }
};

export const signUpAndReachJobs = async (
  page: Page,
  appUrl: string,
): Promise<ReturnType<typeof createUniqueAppleIdentity>> => {
  const identity = createUniqueAppleIdentity();
  logStage('helper:signUpAndReachJobs: start', { appUrl, email: identity.email });

  try {
    await page.goto(`${appUrl}/welcome`);
    await page.waitForLoadState('domcontentloaded');
    logStage('helper:signUpAndReachJobs: /welcome loaded');

    await maybeClick(page.getByRole('button', { name: 'Continue with Email' }));
    logStage('helper:signUpAndReachJobs: email step (Continue with Email if present)');

    await page.getByPlaceholder('Email').fill(identity.email);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(page.getByPlaceholder('Password')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByPlaceholder('Password').fill(PASSWORD);
    logStage('helper:signUpAndReachJobs: password filled');

    if (!(await maybeClick(page.getByRole('button', { name: 'Sign up' })))) {
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }
    logStage('helper:signUpAndReachJobs: submitted sign up / continue');

    await expect(page.getByText('Create your workspace')).toBeVisible({
      timeout: 120_000,
    });
    await page.getByPlaceholder('Apple').fill(identity.workspaceName);
    await page.getByRole('button', { name: 'Continue' }).click();
    logStage('helper:signUpAndReachJobs: workspace created step');

    await expect(page.getByText('Create profile')).toBeVisible({
      timeout: 120_000,
    });
    await page.locator('input[placeholder="Tim"]').first().fill(identity.firstName);
    await page.locator('input[placeholder="Cook"]').first().fill(identity.lastName);

    await page.waitForTimeout(1_000);

    await page.getByRole('button', { name: 'Continue' }).click();
    logStage('helper:signUpAndReachJobs: profile step submitted');

    const phoneHeading = page.getByText('Add your phone number');
    if (await phoneHeading.isVisible().catch(() => false)) {
      logStage('helper:signUpAndReachJobs: phone step visible, skipping');
      await clickSkipOnPhoneStep(page);
    } else {
      await page.waitForTimeout(3_000);
      if (await phoneHeading.isVisible().catch(() => false)) {
        logStage('helper:signUpAndReachJobs: phone step appeared after wait, skipping');
        await clickSkipOnPhoneStep(page);
      } else {
        logStage('helper:signUpAndReachJobs: no phone step (or already passed)');
      }
    }

    await page.waitForURL(/\/create\/intent(?:[/?#]|$)/, {
      timeout: 120_000,
    });
    await expect(page.getByTestId('onboarding-intent-choice')).toBeVisible({
      timeout: 120_000,
    });
    logStage('helper:signUpAndReachJobs: intent choice visible');

    await page.getByRole('button', { name: 'Building my team' }).click();
    await page.waitForURL(/\/create\/extension-install(?:[/?#]|$)/, {
      timeout: 120_000,
    });
    await expect(page.getByTestId('onboarding-path-extension-install')).toBeVisible({
      timeout: 120_000,
    });
    logStage('helper:signUpAndReachJobs: extension-install step visible');

    await page.getByRole('button', { name: 'Go to jobs' }).click();
    await page.waitForURL(/\/jobs(?:[/?#]|$)/, {
      timeout: 120_000,
    });
    await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/);
    logStage('helper:signUpAndReachJobs: on /jobs');
    return identity;
  } catch (error) {
    logStageFailure('helper:signUpAndReachJobs', error, {
      appUrl,
      email: identity.email,
    });
    throw error;
  }
};

export async function pageWaitForAWhile() {
  try {
    logStage('helper:pageWaitForAWhile: sleeping 5s');
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    logStage('helper:pageWaitForAWhile: done');
  } catch (error) {
    logStageFailure('helper:pageWaitForAWhile', error);
    throw error;
  }
}
