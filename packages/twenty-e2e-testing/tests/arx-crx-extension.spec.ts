import { BrowserContext, expect, test, type Page } from '@playwright/test';
import { deleteAccountViaSettings } from '../lib/utils/deleteAccountViaSettings';
import { getWorkspaceAppOriginFromPageUrl } from '../lib/utils/workspaceAppUrl';
import {
  addLinkedInLiAtCookie,
  assertLinkedInFeedSessionWithLiAt,
  dismissLinkedinCookieConsentIfPresent,
  getAppUrl,
  getExtensionDistPath,
  getExtensionId,
  getLinkedInExpectedSessionNameFromEnv,
  getLinkedInLiAtFromEnv,
  launchExtensionContext,
  logStageFailure,
  openExtensionPopupAsInactiveTab,
  pageWaitForAWhile,
  signUpAndReachJobs,
  StageTracker,
  waitForContentScriptPong,
  waitForExtensionStorageValue,
  waitForLinkedinUnipilePillLifecycle,
} from './arx-crx/arxCrxExtensionHelpers';

const appUrl = getAppUrl();
const extensionDistPath = getExtensionDistPath();
const expectAppContentScript = true;

test.describe('@smoke arx-crx extension', () => {
  // test('service worker exposes [arx-crx] build (flavor, base_url, entrypoint hint)', async () => {
  //   test.setTimeout(60_000);
  //   const t = new StageTracker(7);
  //   t.log('service-worker-build: start', { extensionDistPath });

  //   const launched = await launchExtensionContext(extensionDistPath);
  //   t.log('service-worker-build: extension context launched');

  //   try {
  //     t.log('service-worker-build: fetching build from service worker');
  //     const payload = await getArxCrxBuildFromServiceWorker(launched.context);
  //     const flavorFromPath = getExtensionFlavorFromDistPath(extensionDistPath);
  //     const expectedFlavor = flavorFromPath === 'store' ? 'store' : 'internal';
  //     t.log('service-worker-build: got payload', {
  //       flavor: payload.flavor,
  //       base_url: payload.base_url,
  //       expectBackground: payload.expectBackground,
  //       expectedFlavor,
  //     });

  //     expect(payload.flavor).toBe(expectedFlavor);
  //     expect(payload.base_url).toMatch(/^https?:\/\//);

  //     const expectBaseUrl = getExpectedArxBaseUrl();
  //     if (expectBaseUrl) {
  //       expect(payload.base_url).toBe(expectBaseUrl);
  //     }

  //     if (expectedFlavor === 'store') {
  //       expect(payload.expectBackground).toContain('dist-store');
  //     } else {
  //       expect(payload.expectBackground).toContain('background.internal');
  //     }
  //     t.log('service-worker-build: assertions passed');
  //   } catch (error) {
  //     t.fail('service-worker-build: test body', error, {
  //       extensionDistPath,
  //       appUrl,
  //     });
  //     throw error;
  //   } finally {
  //     t.log('service-worker-build: closing context and removing userDataDir');
  //     await launched.context.close();
  //     await fs.rm(launched.userDataDir, { recursive: true, force: true });
  //     t.log('service-worker-build: done');
  //   }
  // });

  // test('ARX CRX loads and injects on app (when manifest allows)', async () => {
  //   test.setTimeout(120_000);


  //   const t = new StageTracker(7);
  //   t.log('content-script-inject: start', { appUrl, expectAppContentScript });

  //   const launched = await launchExtensionContext(extensionDistPath);
  //   const context: BrowserContext | undefined = launched.context;
  //   t.log('content-script-inject: extension context launched');

  //   try {
  //     const extensionId = await getExtensionId(context);
  //     t.log('content-script-inject: got extension id', { extensionId });
  //     t.log('content-script-inject: waiting for content script pong', {
  //       appUrl,
  //     });
  //     await waitForContentScriptPong(context, appUrl, extensionId);
  //     t.log('content-script-inject: pong received');
  //   } catch (error) {
  //     t.fail('content-script-inject: test body', error, {
  //       appUrl,
  //       extensionDistPath,
  //     });
  //     throw error;
  //   } finally {
  //     t.log('content-script-inject: closing context and removing userDataDir');
  //     await context?.close();
  //     await fs.rm(launched.userDataDir, { recursive: true, force: true });
  //     t.log('content-script-inject: done');
  //   }
  // });

  // test('ARX CRX injects on app and shows the signed-out popup', async () => {
  //   test.setTimeout(120_000);
  //   const t = new StageTracker(expectAppContentScript ? 10 : 9);
  //   t.log('signed-out-popup: start', { appUrl, expectAppContentScript });

  //   const launched = await launchExtensionContext(extensionDistPath);
  //   const context: BrowserContext | undefined = launched.context;
  //   t.log('signed-out-popup: extension context launched');

  //   try {
  //     const extensionId = await getExtensionId(context);
  //     t.log('signed-out-popup: got extension id', { extensionId });

  //     if (expectAppContentScript) {
  //       t.log('signed-out-popup: waiting for content script pong');
  //       await waitForContentScriptPong(context, appUrl, extensionId);
  //       t.log('signed-out-popup: pong received');
  //     } else {
  //       t.log(
  //         'signed-out-popup: skipping content script pong (not expected on this origin)',
  //       );
  //     }

  //     const popupPage = await context.newPage();
  //     t.log('signed-out-popup: opening extension popup page');
  //     await popupPage.goto(`chrome-extension://${extensionId}/index.html`, {
  //       waitUntil: 'domcontentloaded',
  //     });
  //     t.log('signed-out-popup: popup loaded, asserting signed-out message');

  //     await expect(
  //       popupPage.getByText('You are not signed in or token expired'),
  //     ).toBeVisible({ timeout: 20_000 });
  //     t.log('signed-out-popup: signed-out message visible');
  //   } catch (error) {
  //     t.fail('signed-out-popup: test body', error, {
  //       appUrl,
  //       extensionDistPath,
  //       expectAppContentScript,
  //     });
  //     throw error;
  //   } finally {
  //     t.log('signed-out-popup: closing context and removing userDataDir');
  //     await context?.close();
  //     await fs.rm(launched.userDataDir, { recursive: true, force: true });
  //     t.log('signed-out-popup: done');
  //   }
  // });

  // test('Onboarding: welcome screen is visible with extension loaded', async () => {
  //   test.setTimeout(180_000);
  //   const t = new StageTracker(expectAppContentScript ? 12 : 11);
  //   t.log('onboarding-welcome: start', { appUrl, expectAppContentScript });

  //   const launched = await launchExtensionContext(extensionDistPath);
  //   const context: BrowserContext | undefined = launched.context;
  //   t.log('onboarding-welcome: extension context launched');

  //   try {
  //     const extensionId = await getExtensionId(context);
  //     t.log('onboarding-welcome: got extension id', { extensionId });
  //     if (expectAppContentScript) {
  //       t.log('onboarding-welcome: waiting for content script pong');
  //       await waitForContentScriptPong(context, appUrl, extensionId);
  //       t.log('onboarding-welcome: pong received');
  //     } else {
  //       t.log('onboarding-welcome: skipping content script pong');
  //     }
  //     const page = await context.newPage();
  //     t.log('onboarding-welcome: navigating to /welcome');
  //     await page.goto(`${appUrl}/welcome`, { waitUntil: 'domcontentloaded' });
  //     await expect(page.getByPlaceholder('Email')).toBeVisible({
  //       timeout: 30_000,
  //     });
  //     t.log('onboarding-welcome: welcome Email field visible');

  //     const popupPage = await context.newPage();
  //     t.log('onboarding-welcome: opening extension popup');
  //     await popupPage.goto(`chrome-extension://${extensionId}/index.html`, {
  //       waitUntil: 'domcontentloaded',
  //     });
  //     t.log('onboarding-welcome: asserting signed-out popup');
  //     await expect(
  //       popupPage.getByText('You are not signed in or token expired'),
  //     ).toBeVisible({ timeout: 15_000 });
  //     t.log('onboarding-welcome: signed-out popup ok');
  //   } catch (error) {
  //     t.fail('onboarding-welcome: test body', error, {
  //       appUrl,
  //       extensionDistPath,
  //       expectAppContentScript,
  //     });
  //     throw error;
  //   } finally {
  //     t.log('onboarding-welcome: closing context and removing userDataDir');
  //     await context?.close();
  //     await fs.rm(launched.userDataDir, { recursive: true, force: true });
  //     t.log('onboarding-welcome: done');
  //   }
  // });

  test('ARX CRX shows the logged-in popup after a fresh onboarding flow reaches jobs', async () => {
    test.setTimeout(300_000);
    if (!expectAppContentScript) {
      const tSkip = new StageTracker(2);
      tSkip.log('logged-in-popup: start', { appUrl, expectAppContentScript });
      tSkip.log('logged-in-popup: skipped (needs content script on app)');
      test.skip(
        true,
        'Signed-in flow needs content script on app origin; use internal build or production app URL.',
      );
      return;
    }

    const t = new StageTracker(22);
    t.log('logged-in-popup: start', { appUrl, expectAppContentScript });

    const launched = await launchExtensionContext(extensionDistPath);
    const context: BrowserContext = launched.context;
    t.log('logged-in-popup: extension context launched');

    let accountEmailForCleanup: string | undefined;
    let workspaceAppUrlForCleanup: string | undefined;

    try {
      const extensionId = await getExtensionId(context);
      t.log('logged-in-popup: got extension id', { extensionId });
      const jobsPage = await context.newPage();
      t.log('logged-in-popup: starting signUpAndReachJobs (may take a while)');

      const identity = await signUpAndReachJobs(jobsPage, appUrl);
      accountEmailForCleanup = identity.email;
      workspaceAppUrlForCleanup = getWorkspaceAppOriginFromPageUrl(jobsPage.url());
      t.log('logged-in-popup: reached jobs after onboarding', {
        workspaceAppUrl: workspaceAppUrlForCleanup,
        entryAppUrl: appUrl,
      });

      await waitForContentScriptPong(
        context,
        workspaceAppUrlForCleanup,
        extensionId,
      );
      t.log('logged-in-popup: content script pong received');

      await jobsPage.bringToFront();
      await pageWaitForAWhile();
      t.log('logged-in-popup: waiting for extension storage auth_token');
      // App shell (e.g. MainNavigationDrawerItems) posts set_auth_token → content script
      // persists auth_token + origin; popup init loads token, then POST get_user_obj succeeds.
      await waitForExtensionStorageValue(context, 'auth_token');
      t.log('logged-in-popup: waiting for extension storage origin');
      await waitForExtensionStorageValue(context, 'origin');
      t.log('logged-in-popup: extension storage ready');

      const linkedInLiAt = getLinkedInLiAtFromEnv();
      const linkedInExpectedName = getLinkedInExpectedSessionNameFromEnv();
      let popupPage: Page;

      if (linkedInLiAt) {
        t.log('logged-in-popup: LINKEDIN_LI_AT present — LinkedIn feed + Unipile lifecycle', {
          hasExpectedName: Boolean(linkedInExpectedName),
        });
        await addLinkedInLiAtCookie(context, linkedInLiAt);
        const linkedinPage = await context.newPage();
        await assertLinkedInFeedSessionWithLiAt(linkedinPage, {
          expectedSessionName: linkedInExpectedName || undefined,
        });
        t.log('logged-in-popup: LinkedIn feed session OK (li_at)');
        await linkedinPage.bringToFront();
        // Same popup open path as the jobs flow (service worker chrome.tabs.create inactive) so the
        // extension uses the same auth storage; active tab stays LinkedIn for tab-query + Unipile.
        popupPage = await openExtensionPopupAsInactiveTab(context, extensionId);
        t.log(
          'logged-in-popup: popup opened as inactive tab (LinkedIn active), asserting main_content signed-in or consent',
        );
        await expect(
          popupPage
            .locator('#main_content')
            .getByText(/You are (now )?logged in|Allow LinkedIn account sync/i),
        ).toBeVisible({ timeout: 30_000 });
        await dismissLinkedinCookieConsentIfPresent(popupPage);
        await dismissLinkedinCookieConsentIfPresent(popupPage);
        t.log('logged-in-popup: waiting for LinkedIn pill Disconnected → Connecting… → Connected');
        await waitForLinkedinUnipilePillLifecycle(popupPage);
        t.log('logged-in-popup: Unipile LinkedIn pill Connected');

        await linkedinPage.close().catch(() => {});
      } else {
        popupPage = await openExtensionPopupAsInactiveTab(context, extensionId);
        t.log(
          'logged-in-popup: popup opened as inactive tab, asserting logged-in message',
        );
        await expect(popupPage.getByText(/You are (now )?logged in/i)).toBeVisible({
          timeout: 30_000,
        });
        t.log('logged-in-popup: logged-in message visible');
      }
    } catch (error) {
      t.fail('logged-in-popup: test body', error, {
        appUrl,
        extensionDistPath,
      });
      throw error;
    } finally {
      if (accountEmailForCleanup && workspaceAppUrlForCleanup) {
        t.log('logged-in-popup: deleting workspace account', {
          email: accountEmailForCleanup,
          workspaceAppUrl: workspaceAppUrlForCleanup,
        });
        const cleanupPage = await context.newPage();
        try {
          await deleteAccountViaSettings(
            cleanupPage,
            workspaceAppUrlForCleanup,
            accountEmailForCleanup,
          );
          t.log('logged-in-popup: workspace account deleted');
        } catch (cleanupError) {
          logStageFailure(
            'logged-in-popup: deleteAccountViaSettings (non-fatal)',
            cleanupError,
            {
              workspaceAppUrl: workspaceAppUrlForCleanup,
              email: accountEmailForCleanup,
            },
          );
        } finally {
          await cleanupPage.close().catch(() => {});
        }
      }

      await context.close();

      t.log('logged-in-popup: done');
    }
  });
});
